import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Phone, PhoneOff, Copy, Download, Settings } from 'lucide-react';

export default function LiveCallUI() {
  const [isRecording, setIsRecording] = useState(false);
  const [callActive, setCallActive] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [guidance, setGuidance] = useState('');
  const [supplier, setSupplier] = useState({
    name: 'ABC Brands',
    contact: 'John Smith',
    stage: 'Contact',
    trustScore: 5,
  });
  const [missionBrief, setMissionBrief] = useState({
    type: 'Discovery',
    objective: 'Understand supplier challenges and partnership appetite',
    criteria: ['Pain points identified', 'Growth goals understood', 'Partnership openness confirmed'],
  });

  useEffect(() => {
    let interval;
    if (callActive) {
      interval = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [callActive]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStartCall = () => {
    setCallActive(true);
    setIsRecording(true);
    setCallDuration(0);
  };

  const handleEndCall = () => {
    setCallActive(false);
    setIsRecording(false);
  };

  const handleCopyGuidance = () => {
    navigator.clipboard.writeText(guidance);
  };

  useEffect(() => {
    if (!callActive) return;
    
    const sampleTranscripts = [
      'Hi John, this is Sanaullah from Vortex Origin Brands.',
      'We work with brands across categories on wholesale distribution.',
      'I came across ABC Brands and thought there might be an opportunity.',
      'Do you have 15 minutes to chat?',
      'Great! So tell me, what\'s your biggest challenge on Amazon right now?',
    ];

    let index = 0;
    const interval = setInterval(() => {
      if (index < sampleTranscripts.length) {
        setTranscript((prev) => prev + (prev ? '\n' : '') + sampleTranscripts[index]);
        index++;
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [callActive]);

  useEffect(() => {
    if (!callActive) return;

    const guidanceMessages = [
      'They seem engaged. Keep the momentum.',
      'Good opening. Now listen more.',
      'Ask a follow-up about their growth plans.',
      'You\'re building rapport well. Stay in discovery mode.',
    ];

    let index = 0;
    const interval = setInterval(() => {
      if (index < guidanceMessages.length) {
        setGuidance(guidanceMessages[index]);
        index++;
      }
    }, 8000);

    return () => clearInterval(interval);
  }, [callActive]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-50 font-sans overflow-hidden">
      <div className="fixed inset-0 opacity-10">
        <div className="absolute inset-0" style={{
          backgroundImage: 'linear-gradient(0deg, transparent 24%, rgba(148, 163, 184, 0.05) 25%, rgba(148, 163, 184, 0.05) 26%, transparent 27%, transparent 74%, rgba(148, 163, 184, 0.05) 75%, rgba(148, 163, 184, 0.05) 76%, transparent 77%, transparent), linear-gradient(90deg, transparent 24%, rgba(148, 163, 184, 0.05) 25%, rgba(148, 163, 184, 0.05) 26%, transparent 27%, transparent 74%, rgba(148, 163, 184, 0.05) 75%, rgba(148, 163, 184, 0.05) 76%, transparent 77%, transparent)',
          backgroundSize: '50px 50px'
        }} />
      </div>

      <div className="relative h-screen flex flex-col">
        <div className="bg-slate-900/50 backdrop-blur-sm border-b border-slate-700/50 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse"></div>
            <h1 className="text-xl font-bold text-white">Live Call System</h1>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-400">
            {callActive && (
              <>
                <span className="font-mono text-emerald-400 font-semibold">{formatTime(callDuration)}</span>
                <span>•</span>
              </>
            )}
            <span>{supplier.name}</span>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden gap-1 p-4">
          <div className="w-80 flex flex-col gap-4 overflow-auto">
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-4 space-y-3">
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wider">Supplier</p>
                <p className="text-lg font-semibold text-white">{supplier.name}</p>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-slate-400">Contact</p>
                  <p className="text-slate-100">{supplier.contact}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Stage</p>
                  <p className="text-slate-100">{supplier.stage}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <p className="text-xs text-slate-400">Trust Score</p>
                <div className="flex-1 bg-slate-700 h-2 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-blue-500 to-cyan-400"
                    style={{ width: `${(supplier.trustScore / 10) * 100}%` }}
                  />
                </div>
                <span className="text-sm font-semibold text-cyan-400">{supplier.trustScore}/10</span>
              </div>
            </div>

            <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-4 space-y-3 flex-1">
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wider">Mission</p>
                <p className="text-lg font-semibold text-white">{missionBrief.type}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-1">Objective</p>
                <p className="text-sm text-slate-200 leading-relaxed">{missionBrief.objective}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-2">Success Criteria</p>
                <ul className="space-y-1">
                  {missionBrief.criteria.map((item, i) => (
                    <li key={i} className="text-sm text-slate-300 flex items-start gap-2">
                      <span className="text-emerald-400 mt-1">✓</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <div className="flex-1 flex flex-col gap-4 min-w-0">
            <div className="flex-1 flex flex-col bg-slate-800/30 border border-slate-700/50 rounded-lg overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-700/50 bg-slate-800/50">
                <p className="text-sm font-semibold text-slate-300">Live Transcript</p>
              </div>
              <div className="flex-1 overflow-auto p-4 space-y-2 font-mono text-sm">
                {transcript ? (
                  transcript.split('\n').map((line, i) => (
                    <div key={i} className="text-slate-300 animate-fadeIn">
                      <span className="text-slate-500">{i + 1}.</span> {line}
                    </div>
                  ))
                ) : (
                  <div className="flex items-center justify-center h-full text-slate-500">
                    {callActive ? 'Waiting for transcript...' : 'Ready to start call'}
                  </div>
                )}
              </div>
            </div>

            <div className="bg-gradient-to-br from-emerald-900/20 to-cyan-900/20 border border-emerald-700/50 rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-emerald-400">💡 Live Guidance</p>
                {guidance && (
                  <button
                    onClick={handleCopyGuidance}
                    className="p-1 hover:bg-slate-700/50 rounded transition-colors"
                  >
                    <Copy className="w-4 h-4 text-slate-400" />
                  </button>
                )}
              </div>
              <div className="text-slate-200 text-sm leading-relaxed min-h-12">
                {guidance || (
                  <span className="text-slate-500">AI guidance will appear here as you speak...</span>
                )}
              </div>
            </div>

            <div className="flex items-center justify-center gap-4">
              <button
                onClick={callActive ? handleEndCall : handleStartCall}
                className={`flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all ${
                  callActive
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                }`}
              >
                {callActive ? (
                  <>
                    <PhoneOff className="w-5 h-5" />
                    End Call
                  </>
                ) : (
                  <>
                    <Phone className="w-5 h-5" />
                    Start Call
                  </>
                )}
              </button>

              {callActive && (
                <button
                  onClick={() => setIsRecording(!isRecording)}
                  className={`flex items-center gap-2 px-4 py-3 rounded-lg font-semibold transition-all ${
                    isRecording
                      ? 'bg-slate-700 hover:bg-slate-600 text-white'
                      : 'bg-slate-700 hover:bg-slate-600 text-slate-400'
                  }`}
                >
                  {isRecording ? (
                    <>
                      <Mic className="w-5 h-5 animate-pulse" />
                      Recording
                    </>
                  ) : (
                    <>
                      <MicOff className="w-5 h-5" />
                      Paused
                    </>
                  )}
                </button>
              )}

              <button className="flex items-center gap-2 px-4 py-3 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 font-semibold transition-all">
                <Download className="w-5 h-5" />
                Save Call
              </button>
            </div>
          </div>
        </div>

        <div className="bg-slate-900/50 backdrop-blur-sm border-t border-slate-700/50 px-6 py-2 flex items-center justify-between text-xs text-slate-400">
          <span>Real-time powered by Deepgram + Claude</span>
          <span>Ready for production</span>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }

        ::-webkit-scrollbar {
          width: 6px;
        }

        ::-webkit-scrollbar-track {
          background: transparent;
        }

        ::-webkit-scrollbar-thumb {
          background: rgba(148, 163, 184, 0.3);
          border-radius: 3px;
        }

        ::-webkit-scrollbar-thumb:hover {
          background: rgba(148, 163, 184, 0.5);
        }
      `}</style>
    </div>
  );
}
