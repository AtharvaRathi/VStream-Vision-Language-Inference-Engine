import React from 'react';

interface MetricsBarProps {
  metrics: {
    totalFrames: number;
    droppedFrames: number;
    bandwidthSavedPct: number;
    prunerLatencyMs: number;
    vlmLatencyMs: number;
  };
}

export default function MetricsBar({ metrics }: MetricsBarProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center justify-between shadow-lg">
          <div>
            <p className="text-sm font-medium text-gray-500 mb-1">Total Frames</p>
            <p className="text-3xl font-bold text-gray-100">{metrics.totalFrames}</p>
          </div>
          <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>
          </div>
        </div>
        
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center justify-between shadow-lg">
          <div>
            <p className="text-sm font-medium text-gray-500 mb-1">Dropped (Pruned)</p>
            <p className="text-3xl font-bold text-gray-100">{metrics.droppedFrames}</p>
          </div>
          <div className="w-12 h-12 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-400">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
          </div>
        </div>
        
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center justify-between shadow-lg">
          <div>
            <p className="text-sm font-medium text-gray-500 mb-1">Bandwidth Saved</p>
            <p className="text-3xl font-bold text-emerald-400">{metrics.bandwidthSavedPct.toFixed(1)}%</p>
          </div>
          <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>
          </div>
        </div>
      </div>

      <div className="bg-gray-800/50 p-6 rounded-xl border border-gray-700/50">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Performance Telemetry</h3>
          <span className="text-xs font-mono text-emerald-400/80 bg-emerald-400/10 px-2 py-1 rounded">Optimization: Motion BBox Overlay Active</span>
        </div>
        <div className="grid grid-cols-2 gap-8">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">C++ Edge Filter Latency</span>
              <span className="font-mono text-indigo-400">~{metrics.prunerLatencyMs.toFixed(2)} ms</span>
            </div>
            <div className="h-1.5 w-full bg-gray-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-indigo-500 rounded-full transition-all duration-300" 
                style={{ width: `${Math.min(100, (metrics.prunerLatencyMs / 5) * 100)}%` }}
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">VLM Inference Latency</span>
              <span className="font-mono text-purple-400">~{metrics.vlmLatencyMs.toFixed(0)} ms</span>
            </div>
            <div className="h-1.5 w-full bg-gray-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-purple-500 rounded-full transition-all duration-300" 
                style={{ width: `${Math.min(100, (metrics.vlmLatencyMs / 2000) * 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
