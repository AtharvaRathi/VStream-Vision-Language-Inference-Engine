# VStream: Real-Time Vision-Language Inference Engine

VStream is an edge-optimized, real-time vision-language streaming pipeline designed for surveillance and live camera feeds. It couples a high-speed C++/OpenCV frame differencing engine with local Vision-Language Models (VLMs) via Ollama, streaming annotated video feeds and narrative telemetry over WebSockets to a Next.js dashboard.

---

## Key Architecture & Features

1. **C++ Edge Differencing & Motion Detection (`backend/src/pruner.cpp`)**:
   - High-throughput Pybind11 module utilizing OpenCV for structural frame-to-frame diffing.
   - Applies a 5x5 Gaussian blur, absolute differencing, thresholding, and contour extraction to detect moving subjects while filtering sensor noise.
   - Automatically drops redundant frames at the edge to reduce bandwidth and downstream VLM computation.

2. **Full-Frame Context with Bounding Box Overlay**:
   - Rather than sending isolated crops that strip surrounding context, VStream overlays a green bounding box around the active motion region directly on the full frame (`cv2.rectangle(..., (0, 255, 0), 2)`).
   - Preserves full environmental context for the VLM while anchoring its attention to the moving subject.

3. **Asynchronous Non-Blocking Inference Loop**:
   - Decouples heavy VLM inference from the primary video capture and WebSocket loop using `asyncio.to_thread()`.
   - Video frames and edge pruning telemetry stream uninterrupted at the camera's native framerate (30 FPS), with narrative descriptions appended asynchronously as background threads finish.
   - Global `is_vlm_busy` concurrency locking drops redundant frames during active inference to eliminate memory backlogs and prevent video freezing.

4. **Motion Stabilization & Rate Limiting**:
   - Enforces a minimum 3.5-second cooldown between VLM inference triggers during continuous motion.
   - Text similarity deduplication (`difflib.SequenceMatcher`) suppresses repetitive thoughts and log spam while maintaining live metrics.

5. **Multi-Source Video Input**:
   - Supports live hardware webcams (`/dev/video0`), recorded MP4 video feeds (e.g., `cctv-sample.mp4`, `traffic.mp4`, `hallway.mp4`), and auto-generated synthetic test patterns.

6. **Next.js Real-Time Dashboard (`frontend/`)**:
   - Next.js 16 (Turbopack) dashboard styled with Tailwind CSS.
   - Real-time video player with automatic aspect ratio scaling (`object-contain`).
   - Live telemetry panel reporting edge filter latency (ms), VLM inference latency (ms), bandwidth savings (%), and active optimization flags.
   - Terminal log viewer for timestamped surveillance narrations.

---

## Tech Stack

- **Backend**: Python 3.9+, FastAPI, WebSockets, OpenCV (`cv2`), NumPy, Pybind11, C++17, Uvicorn
- **VLM Inference**: Ollama (`llava:7b`, `moondream`), `ollama-python`
- **Frontend**: Next.js 16, React 19, TypeScript, Tailwind CSS
- **Containerization**: Docker, Docker Compose (Multi-stage C++ build)

---

## Project Structure

```text
VStream/
├── backend/
│   ├── assets/              # Sample MP4 video feeds (CCTV, Traffic, Hallway)
│   ├── src/
│   │   ├── main.py          # FastAPI app, WebSocket loop, frame pacing & bbox overlay
│   │   ├── pruner.cpp       # C++ Pybind11 edge motion filter & contour detection
│   │   └── vlm_client.py    # Ollama vision client & prompt engineering
│   ├── Dockerfile           # Multi-stage C++ compilation & backend runner
│   ├── requirements.txt     # Python dependencies
│   ├── setup.py             # C++ extension build script
│   └── .env.example         # Environment template
├── frontend/
│   ├── src/
│   │   ├── app/             # Next.js App Router
│   │   └── components/      # Dashboard, VideoPlayer, MetricsBar, TerminalLog
│   ├── Dockerfile           # Next.js production build container
│   ├── package.json
│   └── tsconfig.json
├── docker-compose.yml       # Full-stack composition
├── .gitignore
└── README.md
```

---

## Getting Started

### Prerequisites

- **Python 3.9+** and a C++17 compiler (Clang / GCC)
- **Node.js 18+** and `npm`
- **Ollama** installed and running locally with your vision model of choice:
  ```bash
  ollama run llava:7b
  # or
  ollama run moondream
  ```

---

### Local Installation

#### 1. Backend Setup

```bash
cd backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Compile C++ Pybind11 pruner extension (optional, falls back to Python OpenCV)
pip install -e .

# Configure environment
cp .env.example .env
# Ensure OLLAMA_MODEL is set to your preferred model (e.g., llava:7b)

# Start backend server
uvicorn src.main:app --host 0.0.0.0 --port 8000
```

#### 2. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start Next.js development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

### Running with Docker Compose

Run the entire pipeline (Backend + Frontend) in containerized mode:

```bash
docker-compose up --build
```

---

## Surveillance Prompting Strategy

VStream utilizes structured surveillance prompts targeting moving subjects identified by the edge detector:

```text
"This is security camera footage. Focus on the green bounding box or primary subject in motion.
Describe the specific security event or person's action in one clear, objective sentence.
If the image is unclear, state 'Subject in motion near the camera.'"
```

---

## License

MIT License. See [LICENSE](LICENSE) for details.
