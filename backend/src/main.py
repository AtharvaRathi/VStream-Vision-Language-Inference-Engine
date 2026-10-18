import asyncio
import cv2
import base64
import json
import logging
import os
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from .vlm_client import generate_narration, generate_narration_sync

# Global flag to track background VLM processing state
is_vlm_busy: bool = False

# Attempt to import the C++ pruner module. If it fails, fallback to a Python implementation
try:
    import pruner
    HAS_PRUNER = True
except ImportError:
    HAS_PRUNER = False
    print("WARNING: C++ pruner module not found. Falling back to Python OpenCV absolute difference.")

app = FastAPI(title="VStream Backend")
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

DIFF_THRESHOLD = 0.05 # percentage difference to keep frame (0.0 to 1.0)

def python_compute_diff(frame_a, frame_b):
    if frame_a is None or frame_b is None:
        return {"is_novel": False, "diff_percent": 0.0, "bbox": [0, 0, frame_b.shape[1], frame_b.shape[0]]}
    
    gray_a = cv2.cvtColor(frame_a, cv2.COLOR_BGR2GRAY)
    gray_b = cv2.cvtColor(frame_b, cv2.COLOR_BGR2GRAY)
    
    gray_a = cv2.GaussianBlur(gray_a, (5, 5), 0)
    gray_b = cv2.GaussianBlur(gray_b, (5, 5), 0)
    
    diff = cv2.absdiff(gray_a, gray_b)
    _, thresh = cv2.threshold(diff, 30, 255, cv2.THRESH_BINARY)
    
    non_zero = np.count_nonzero(thresh)
    total_pixels = gray_a.shape[0] * gray_a.shape[1]
    pct = non_zero / total_pixels
    
    is_novel = pct >= DIFF_THRESHOLD
    
    h, w = frame_b.shape[:2]
    bx, by, bw, bh = 0, 0, w, h
    
    if is_novel:
        contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if contours:
            c = max(contours, key=cv2.contourArea)
            x, y, cw, ch = cv2.boundingRect(c)
            bx = max(0, x - 50)
            by = max(0, y - 50)
            maxX = min(w, x + cw + 50)
            maxY = min(h, y + ch + 50)
            bw = maxX - bx
            bh = maxY - by

    return {"is_novel": is_novel, "diff_percent": pct, "bbox": [bx, by, bw, bh]}

import time
import numpy as np

def create_synthetic_video(path: str, title: str):
    if os.path.exists(path):
        return
    os.makedirs(os.path.dirname(path), exist_ok=True)
    out = cv2.VideoWriter(path, cv2.VideoWriter_fourcc(*'mp4v'), 30, (640, 480))
    for i in range(100):
        frame = np.zeros((480, 640, 3), dtype=np.uint8)
        x = i * 6
        cv2.putText(frame, title, (50, 50), cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2)
        cv2.rectangle(frame, (x, 200), (x+50, 250), (0, 255, 0), -1)
        out.write(frame)
    out.release()

@app.websocket("/ws/stream")
async def websocket_endpoint(websocket: WebSocket, source: str = "webcam"):
    global is_vlm_busy
    await websocket.accept()
    logger.info(f"WebSocket connected. Source: {source}")
    
    total_frames = 0
    dropped_frames = 0
    prev_frame = None
    last_narration_text = ""
    last_narration_time = 0.0
    last_vlm_trigger_time = 0.0
    pending_narration = None
    pending_vlm_latency = None
    active_vlm_task = None
    
    synthetic = False
    if source == "webcam":
        cap = cv2.VideoCapture(0)
        if not cap.isOpened():
            logger.warning("Could not open webcam, using synthetic video stream.")
            synthetic = True
    else:
        assets_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "assets"))
        candidates = [
            os.path.join(assets_dir, f"{source}.mp4"),
            os.path.join(assets_dir, f"{source.replace('_', '-')}.mp4"),
            os.path.join(assets_dir, f"{source.replace('-', '_')}.mp4"),
            f"assets/{source}.mp4",
        ]
        if source in ["cctv", "cctv-sample", "cctv_sample"]:
            candidates.insert(0, os.path.join(assets_dir, "cctv-sample.mp4"))
            candidates.insert(1, "assets/cctv-sample.mp4")
        elif source in ["traffic", "intersection"]:
            candidates.insert(0, os.path.join(assets_dir, "traffic.mp4"))
            candidates.insert(1, os.path.join(assets_dir, "intersection.mp4"))

        video_path = None
        for cand in candidates:
            if os.path.exists(cand):
                video_path = cand
                break

        if not video_path:
            video_path = os.path.join(assets_dir, f"{source}.mp4")
            create_synthetic_video(video_path, f"{source.capitalize()} Cam")

        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            logger.warning(f"Could not open {video_path}, falling back to synthetic.")
            synthetic = True

    # Framerate pacing: Extract FPS or default to 30.0 FPS
    fps = 30.0
    if not synthetic and 'cap' in locals() and cap.isOpened():
        video_fps = cap.get(cv2.CAP_PROP_FPS)
        if video_fps and video_fps > 0 and not np.isnan(video_fps) and video_fps < 120:
            fps = float(video_fps)
    frame_delay = 1.0 / fps

    x, y, dx = 0, 100, 10

    async def run_vlm_background(roi_base64: str):
        global is_vlm_busy
        nonlocal pending_narration, pending_vlm_latency, last_narration_text, last_narration_time
        try:
            start_t = time.perf_counter()
            # Non-blocking VLM execution via worker thread
            raw_narration = await asyncio.to_thread(generate_narration_sync, roi_base64)
            latency = (time.perf_counter() - start_t) * 1000.0

            # Narrative Deduplication & Cooldown
            cur_t = time.perf_counter()
            import difflib
            similarity = 0.0
            if last_narration_text and raw_narration and (cur_t - last_narration_time) < 3.5:
                similarity = difflib.SequenceMatcher(None, last_narration_text.lower(), raw_narration.lower()).ratio()

            if similarity <= 0.65 and raw_narration != "No narration generated.":
                pending_narration = raw_narration
                last_narration_text = raw_narration
                last_narration_time = cur_t
            pending_vlm_latency = latency
        except Exception as err:
            logger.error(f"Background VLM error: {err}")
        finally:
            is_vlm_busy = False

    try:
        while True:
            if synthetic:
                frame = np.zeros((480, 640, 3), dtype=np.uint8)
                cv2.rectangle(frame, (x, y), (x+50, y+50), (255, 255, 255), -1)
                x += dx
                if x > 640 or x < 0:
                    dx = -dx
            else:
                ret, frame = cap.read()
                if not ret:
                    cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                    ret, frame = cap.read()
                    if not ret:
                        await asyncio.sleep(frame_delay)
                        continue
                # Downscale ultra-high-resolution frames (e.g. 4K) to maintain realtime performance
                h, w = frame.shape[:2]
                if max(h, w) > 960:
                    scale = 960.0 / max(h, w)
                    frame = cv2.resize(frame, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)

            total_frames += 1
            is_novel = False
            diff_pct = 0.0
            
            pruner_start = time.perf_counter()

            if prev_frame is None:
                is_novel = True
                h, w = frame.shape[:2]
                bbox = [0, 0, w, h]
            else:
                if HAS_PRUNER:
                    diff_data = pruner.compute_diff(prev_frame, frame)
                else:
                    diff_data = python_compute_diff(prev_frame, frame)
                
                is_novel = diff_data.get("is_novel", False)
                bbox = diff_data.get("bbox", [0, 0, frame.shape[1], frame.shape[0]])
                
                if not is_novel:
                    dropped_frames += 1

            pruner_latency = (time.perf_counter() - pruner_start) * 1000.0
            prev_frame = frame.copy()
            bandwidth_saved = (dropped_frames / total_frames) * 100.0 if total_frames > 0 else 0.0
            
            # Annotate full frame with green bounding box around motion area
            annotated_frame = frame.copy()
            if is_novel:
                bx, by, bw, bh = bbox
                cv2.rectangle(annotated_frame, (bx, by), (bx + bw, by + bh), (0, 255, 0), 2)

            # Convert annotated frame to base64 for transmission and VLM
            _, buffer = cv2.imencode('.jpg', annotated_frame, [cv2.IMWRITE_JPEG_QUALITY, 50])
            frame_b64 = base64.b64encode(buffer).decode('utf-8')

            # Non-blocking VLM Inference with Motion Stabilization & 3.5s Rate Limiting
            current_time = time.perf_counter()
            if is_novel:
                if not is_vlm_busy and (current_time - last_vlm_trigger_time) >= 3.5:
                    is_vlm_busy = True
                    last_vlm_trigger_time = current_time
                    # Pass full frame with visible bounding box overlay to VLM
                    active_vlm_task = asyncio.create_task(run_vlm_background(frame_b64))
                # Otherwise: VLM is busy or within 3.5s cooldown -> frame dropped from VLM inference

            # Pick up narration and latency if completed by background task
            narration = pending_narration
            pending_narration = None

            vlm_latency = pending_vlm_latency
            pending_vlm_latency = None

            payload = {
                "type": "frame",
                "totalFrames": total_frames,
                "droppedFrames": dropped_frames,
                "bandwidthSavedPct": bandwidth_saved,
                "prunerLatencyMs": pruner_latency,
                "vlmLatencyMs": vlm_latency,
                "narration": narration,
                "image": frame_b64
            }
                
            await websocket.send_text(json.dumps(payload))
            await asyncio.sleep(frame_delay)
            
    except WebSocketDisconnect:
        logger.info("WebSocket disconnected.")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        is_vlm_busy = False
        if active_vlm_task and not active_vlm_task.done():
            active_vlm_task.cancel()
        if not synthetic and 'cap' in locals():
            cap.release()
