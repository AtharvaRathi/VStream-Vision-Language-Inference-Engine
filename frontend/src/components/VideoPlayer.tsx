import React from 'react';

interface VideoPlayerProps {
  frame: string | null;
  isConnected: boolean;
}

export default function VideoPlayer({ frame, isConnected }: VideoPlayerProps) {
  if (!isConnected) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 z-10 text-gray-500">
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mb-4 opacity-50"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
        <p className="text-lg font-medium">Stream Offline</p>
        <p className="text-sm mt-2 max-w-sm text-center">Ensure the FastAPI backend is running and the WebSocket connection is active.</p>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 bg-black flex items-center justify-center overflow-hidden">
      {frame ? (
        <img 
          src={frame} 
          alt="Live Stream" 
          className="w-full h-full object-contain"
        />
      ) : (
        <div className="flex flex-col items-center justify-center text-gray-500">
          <div className="w-12 h-12 border-4 border-gray-700 border-t-indigo-500 rounded-full animate-spin mb-4"></div>
          <p className="animate-pulse">Waiting for video frames...</p>
        </div>
      )}
      
      {/* Overlay indicator */}
      <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-md flex items-center gap-2 border border-white/10">
        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
        <span className="text-xs font-bold text-white tracking-widest uppercase">REC</span>
      </div>
    </div>
  );
}
