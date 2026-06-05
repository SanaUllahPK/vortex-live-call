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
        <div className="bg-slate-900/50 border-b border-slate-700/50 px-6 py-4 flex justify-between items-center">
          <div className="flex gap-3 items-center">
            <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse"></div>
            <h1 className="text-2xl font-bold">Live Call System</h1>
          </div>
          <div className="text-slate-400">
            {callActive && <span className="font-mono text-emerald-400 mr-4 text-lg">{formatTime(callDuration)}</span>}
            <span>ABC Brands</span>
          </div>
        </div>

        <div className="flex-1 flex gap-4 p-4 overflow-hidden">
          <div className="w-96 flex flex-col gap-4 flex-shrink-0">
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-4">
              <p className="text-xs text-slate-400 uppercase mb-2 font-bold">Supplier</p>
              <p className="text-xl font-semibold mb-4">ABC Brands</p>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-xs text-slate-400">Contact Person</p>
                  <p className="text-slate-200">John Smith</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Current Stage</p>
                  <p className="text-slate-200">Contact</p>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2">
                <p className="text-xs text-slate-400">Trust Score</p>
                <div className="flex-1 bg-slate-700 h-2 rounded"><div className="h-full bg-cyan-400 w-1/2"></div></div>
                <span className="text-sm text-cyan-400 font-bold">5/10</span>
              </div>
            </div>

            <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-4 flex-1 flex flex-col">
              <p className="text-xs text-slate-400 uppercase mb-3 font-bold">Current Mission</p>
              <p className="text-lg font-semibold mb-3">Discovery</p>
              <p className="text-xs text-slate-400 mb-2">Goal</p>
              <p className="text-sm text-slate-200 mb-4">Understand supplier challenges and partnership appetite</p>
              <p className="text-xs text-slate-400 mb-2">Success Criteria</p>
              <ul className="space-y-2 text-sm flex-1">
                <li className="text-slate-300">✓ Pain points identified</li>
                <li className="text-slate-300">✓ Growth goals understood</li>
                <li className="text-slate-300">✓ Partnership openness confirmed</li>
              </ul>
            </div>
          </div>

          <div className="flex-1 flex flex-col gap-4 min-w-0">
            <div className="flex-1 flex flex-col bg-slate-800/30 border border-slate-700/50 rounded-lg overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-700/50 bg-slate-800/50">
                <p className="text-sm font-semibold">📝 Live Transcript</p>
              </div>
              <div className="flex-1 overflow-auto p-4 space-y-3 font-mono text-sm">
                <div className="flex items-center justify-center h-full text-slate-500">
                  Ready to start call
                </div>
              </div>
            </div>

            <div className="bg-emerald-900/20 border border-emerald-700/50 rounded-lg p-4">
              <p className="text-sm font-semibold text-emerald-400 mb-2">💡 Live AI Guidance</p>
              <p className="text-sm text-slate-200">
                Real-time coaching will appear here as you speak during the call...
              </p>
            </div>

            <div className="flex gap-4 justify-center">
              <button
                onClick={() => setCallActive(!callActive)}
                className={`px-8 py-3 rounded-lg font-semibold text-white transition-all ${
                  callActive ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {callActive ? '📞 End Call' : '📞 Start Call'}
              </button>
              <button className="px-6 py-3 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 font-semibold transition-all">
                💾 Save Call
              </button>
            </div>
          </div>
        </div>

        <div className="bg-slate-900/50 border-t border-slate-700/50 px-6 py-2 text-xs text-slate-400 flex justify-between">
          <span>Vortex Origin Brands • Live Call System</span>
          <span>Production Ready</span>
        </div>
      </div>
    </div>
  );
}
