import React, { useState, useEffect } from 'react';

export default function App() {
  const [callActive, setCallActive] = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  useEffect(() => {
    if (!callActive) return;
    const int = setInterval(() => setCallDuration(p => p + 1), 1000);
    return () => clearInterval(int);
  }, [callActive]);

  const formatTime = (s) => `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      <div className="h-screen flex flex-col">
        <div className="bg-slate-900/50 border-b border-slate-700/50 px-6 py-4 flex justify-between">
          <div className="flex gap-3 items-center">
            <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse"></div>
            <h1 className="text-xl font-bold">Live Call System</h1>
          </div>
          <div className="text-slate-400">
            {callActive && <span className="font-mono text-emerald-400 mr-2">{formatTime(callDuration)}</span>}
            ABC Brands
          </div>
        </div>
        <div className="flex-1 flex gap-4 p-4 overflow-hidden">
          <div className="w-80 flex flex-col gap-4">
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-4">
              <p className="text-xs text-slate-400 uppercase mb-2">Supplier</p>
              <p className="text-lg font-semibold mb-3">ABC Brands</p>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div><p className="text-xs text-slate-400">Contact</p><p className="text-sm">John Smith</p></div>
                <div><p className="text-xs text-slate-400">Stage</p><p className="text-sm">Contact</p></div>
              </div>
              <div className="flex items-center gap-2">
                <p className="text-xs text-slate-400">Trust</p>
                <div className="flex-1 bg-slate-700 h-2 rounded"><div className="h-full bg-cyan-400 w-1/2"></div></div>
                <span className="text-sm text-cyan-400">5/10</span>
              </div>
            </div>
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-4 flex-1">
              <p className="text-xs text-slate-400 uppercase mb-2">Mission</p>
              <p className="text-lg font-semibold mb-3">Discovery</p>
              <ul className="space-y-1 text-sm"><li>✓ Pain points</li><li>✓ Goals</li><li>✓ Partnership</li></ul>
            </div>
          </div>
          <div className="flex-1 flex flex-col gap-4">
            <div className="flex-1 bg-slate-800/30 border border-slate-700/50 rounded-lg p-4">
              <p className="text-sm font-semibold mb-3">Live Transcript</p>
              <div className="flex items-center justify-center h-full text-slate-500">Ready to start call</div>
            </div>
            <div className="bg-emerald-900/20 border border-emerald-700/50 rounded-lg p-4">
              <p className="text-sm font-semibold text-emerald-400 mb-2">💡 Live Guidance</p>
              <p className="text-sm text-slate-200">AI coaching will appear here during the call...</p>
            </div>
            <div className="flex gap-4 justify-center">
              <button onClick={() => setCallActive(!callActive)} className={`px-6 py-3 rounded-lg font-semibold text-white ${callActive ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
                {callActive ? 'End Call' : 'Start Call'}
              </button>
              <button className="px-4 py-3 rounded-lg bg-slate-700 text-slate-300 font-semibold">Save Call</button>
            </div>
          </div>
        </div>
        <div className="bg-slate-900/50 border-t border-slate-700/50 px-6 py-2 text-xs text-slate-400">Vortex Live Call System • Ready for Production</div>
      </div>
    </div>
  );
}
