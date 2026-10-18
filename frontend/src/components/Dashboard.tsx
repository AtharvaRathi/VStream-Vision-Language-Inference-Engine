"use client";

import React, { useState, useEffect, useRef } from 'react';
import MetricsBar from './MetricsBar';
import VideoPlayer from './VideoPlayer';
import TerminalLog from './TerminalLog';

export default function Dashboard() {
  const [isConnected, setIsConnected] = useState(false);
  const [scenario, setScenario] = useState("webcam");
  const [metrics, setMetrics] = useState({
    totalFrames: 0,
    droppedFrames: 0,
    bandwidthSavedPct: 0,
    prunerLatencyMs: 0,
    vlmLatencyMs: 0,
  });
  const [logs, setLogs] = useState<{ timestamp: string; text: string }[]>([]);
  const [videoFrame, setVideoFrame] = useState<string | null>(null);
  
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (wsRef.current) {
        wsRef.current.close();
    }
    // Connect to WebSocket backend with scenario query param
    const ws = new WebSocket(`ws://localhost:8000/ws/stream?source=${scenario}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      console.log(`Connected to VStream backend (${scenario})`);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'frame') {
          // Update frame if provided (e.g. base64 image)
          if (data.image) setVideoFrame(`data:image/jpeg;base64,${data.image}`);
          
          // Update metrics
          setMetrics(prev => ({
            totalFrames: data.totalFrames || 0,
            droppedFrames: data.droppedFrames || 0,
            bandwidthSavedPct: data.bandwidthSavedPct || 0,
            prunerLatencyMs: data.prunerLatencyMs || prev.prunerLatencyMs,
            vlmLatencyMs: data.vlmLatencyMs || prev.vlmLatencyMs,
          }));
          
          // Update logs if there is narration
          if (data.narration) {
            setLogs(prev => [...prev, {
              timestamp: new Date().toLocaleTimeString(),
              text: data.narration
            }].slice(-50)); // keep last 50 logs
          }
        }
      } catch (err) {
        console.error('Failed to parse WebSocket message', err);
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      console.log('Disconnected from VStream backend');
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
          ws.close();
      }
    };
  }, [scenario]);

  return (
    <div className="flex flex-col h-screen max-h-screen bg-gray-950 text-gray-100 font-sans">
      {/* Top Header & Metrics */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-gray-800 bg-gray-900/50 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/20">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white"><path d="m22 8-6 4 6 4V8Z"/><rect width="14" height="12" x="2" y="6" rx="2" ry="2"/></svg>
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">VStream</h1>
            <p className="text-xs text-gray-500 font-medium tracking-wide uppercase">Vision-Language Pipeline</p>
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
            <span className="text-sm font-medium text-gray-400">{isConnected ? 'Live' : 'Disconnected'}</span>
          </div>
          <select 
            id="video-source-selector"
            value={scenario}
            onChange={(e) => setScenario(e.target.value)}
            className="bg-gray-800 text-gray-100 border border-gray-700 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow cursor-pointer">
            <option value="webcam" className="bg-gray-900 text-white">Live Webcam</option>
            <option value="cctv-sample" className="bg-gray-900 text-white">CCTV Sample (cctv-sample.mp4)</option>
            <option value="hallway" className="bg-gray-900 text-white">Hallway CCTV</option>
            <option value="traffic" className="bg-gray-900 text-white">Traffic Intersection</option>
          </select>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden p-6 gap-6">
        {/* Left Column: Video & Metrics */}
        <div className="flex-1 flex flex-col gap-6 overflow-y-auto pr-2">
          <MetricsBar metrics={metrics} />
          <div className="flex-1 rounded-2xl overflow-hidden border border-gray-800 bg-gray-900 shadow-2xl relative group min-h-[400px]">
            <VideoPlayer frame={videoFrame} isConnected={isConnected} />
          </div>
        </div>

        {/* Right Column: Terminal Log */}
        <div className="w-96 flex flex-col bg-gray-900 border border-gray-800 rounded-2xl shadow-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-800 bg-gray-900/80 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400"><polyline points="4 17 10 11 4 5"/><line x1="12" x2="20" y1="19" y2="19"/></svg>
            <span className="text-sm font-semibold text-gray-300">VLM Narration Log</span>
          </div>
          <div className="flex-1 p-4 overflow-y-auto">
            <TerminalLog logs={logs} />
          </div>
        </div>
      </div>
    </div>
  );
}
