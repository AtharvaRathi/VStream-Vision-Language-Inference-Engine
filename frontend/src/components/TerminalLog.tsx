import React, { useEffect, useRef } from 'react';

interface TerminalLogProps {
  logs: { timestamp: string; text: string }[];
}

export default function TerminalLog({ logs }: TerminalLogProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  if (logs.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-gray-600 font-mono text-sm space-y-4">
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        <p>Awaiting VLM narrations...</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 font-mono text-sm">
      {logs.map((log, i) => (
        <div key={i} className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="text-indigo-400 text-xs mb-1">[{log.timestamp}]</div>
          <div className="text-gray-300 leading-relaxed bg-gray-800/50 p-3 rounded-lg border border-gray-700/50">
            {log.text}
          </div>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
