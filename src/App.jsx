import React, { useState, useEffect, useRef } from 'react';

const DEEPGRAM_API_KEY = import.meta.env.VITE_DEEPGRAM_API_KEY;

export default function LiveCallUI() {
  const [isRecording, setIsRecording] = useState(false);
  const [callActive, setCallActive] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [guidance, setGuidance] = useState('');
  const mediaStreamRef = useRef(null);
  const processorRef = useRef(null);
  const websocketRef = useRef(null);
  const audioContextRef = useRef(null);
  const lineCountRef = useRef(0);

  useEffect(() => {
    let interval;
    if (callActive) {
      interval = setInterval(() => setCallDuration(p => p + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [callActive]);

  const formatTime = (s) => `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`;

  const startDeepgram = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      const websocket = new WebSocket(
        `wss://api.deepgram.com/v1/listen?key=${DEEPGRAM_API_KEY}&model=nova-2&encoding=linear16&sample_rate=16000`
      );
      websocketRef.current = websocket;

      websocket.onopen = () => console.log('Deepgram connected');

      websocket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.channel?.alternatives?.[0]?.transcript) {
          const newText = data.channel.alternatives[0].transcript;
          if (newText) {
            setTranscript(prev => {
              const lines = prev ? prev.split('\n') : [];
              if (data.is_final) {
                lineCountRef.current++;
                return prev ? prev + '\n' + lineCountRef.current + '. ' + newText : lineCountRef.current + '. ' + newText;
              } else {
                return prev ? prev + ' ' + newText : newText;
              }
            });
          }
        }
      };

      websocket.onerror = (err) => {
        console.error('Deepgram error:', err);
      };

      websocket.onclose = () => console.log('Deepgram disconnected');

      processor.onaudioprocess = (event) => {
        const audioData = event.inputBuffer.getChannelData(0);
        const pcmData = new Int16Array(audioData.length);
        for (let i = 0; i < audioData.length; i++) {
          pcmData[i] = Math.max(-32768, Math.min(32767, audioData[i] * 32767));
        }
        if (websocket.readyState === WebSocket.OPEN) {
          websocket.send(pcmData.buffer);
        }
      };

      source.connect(processor);
      processor.connect(audioContext.destination);
    } catch (err) {
      console.error('Microphone access error:', err);
      alert('Please allow microphone access to use Live Call System');
    }
  };

  const stopDeepgram = () => {
    if (websocketRef.current) websocketRef.current.close();
    if (processorRef.current) processorRef.current.disconnect();
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
    }
    if (audioContextRef.current) audioContextRef.current.close();
  };

  const handleStartCall = async () => {
    setCallActive(true);
    setIsRecording(true);
    setCallDuration(0);
    setTranscript('');
    lineCountRef.current = 0;
    await startDeepgram();
  };

  const handleEndCall = () => {
    setCallActive(false);
    setIsRecording(false);
    stopDeepgram();
  };

  useEffect(() => {
    if (!transcript || !callActive) return;
    
    const generateGuidance = async () => {
      try {
        const response = await fetch(import.meta.env.VITE_API_URL + '/api/analyze-live', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transcript: transcript,
            missionType: 'Discovery'
          })
        });
        
        if (response.ok) {
          const data = await response.json();
          setGuidance(data.guidance || '');
        }
      } catch (err) {
        console.error('Guidance error:', err);
      }
    };

    const timer = setTimeout(generateGuidance, 3000);
    return () => clearTimeout(timer);
  }, [transcript, callActive]);

  const styles = {
    container: {
      height: '100vh',
      background: 'linear-gradient(to bottom right, #0f172a, #0f1419, #0f172a)',
      color: '#fff',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    },
    header: {
      background: 'rgba(15, 23, 42, 0.5)',
      borderBottom: '1px solid rgba(51, 65, 85, 0.5)',
      padding: '16px 24px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    },
    headerTitle: {
      display: 'flex',
      alignItems: 'center',
      gap: '12px'
    },
    pulse: {
      width: '12px',
      height: '12px',
      background: '#10b981',
      borderRadius: '50%',
      animation: 'pulse 2s infinite'
    },
    mainContent: {
      flex: 1,
      display: 'flex',
      gap: '16px',
      padding: '16px',
      overflow: 'hidden'
    },
    leftPanel: {
      width: '320px',
      display: 'flex',
      flexDirection: 'column',
      gap: '16px',
      overflow: 'auto'
    },
    card: {
      background: 'rgba(30, 41, 59, 0.5)',
      border: '1px solid rgba(51, 65, 85, 0.5)',
      borderRadius: '8px',
      padding: '16px'
    },
    rightPanel: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      gap: '16px',
      overflow: 'hidden'
    },
    transcriptBox: {
      flex: 1,
      background: 'rgba(15, 23, 42, 0.3)',
      border: '1px solid rgba(51, 65, 85, 0.5)',
      borderRadius: '8px',
      overflow: 'auto',
      padding: '16px',
      fontFamily: 'monospace',
      fontSize: '14px',
      lineHeight: '1.6'
    },
    guidanceBox: {
      background: 'rgba(5, 60, 35, 0.2)',
      border: '1px solid rgba(34, 197, 94, 0.5)',
      borderRadius: '8px',
      padding: '16px'
    },
    buttonGroup: {
      display: 'flex',
      gap: '16px',
      justifyContent: 'center'
    },
    button: {
      padding: '12px 24px',
      borderRadius: '8px',
      border: 'none',
      fontWeight: '600',
      cursor: 'pointer',
      fontSize: '16px',
      transition: 'all 0.2s'
    },
    buttonStart: {
      background: '#10b981',
      color: '#fff'
    },
    buttonEnd: {
      background: '#ef4444',
      color: '#fff'
    },
    buttonSecondary: {
      background: '#475569',
      color: '#e2e8f0'
    },
    footer: {
      background: 'rgba(15, 23, 42, 0.5)',
      borderTop: '1px solid rgba(51, 65, 85, 0.5)',
      padding: '8px 24px',
      fontSize: '12px',
      color: '#94a3b8',
      display: 'flex',
      justifyContent: 'space-between'
    }
  };

  return (
    <div style={styles.container}>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>

      <div style={styles.header}>
        <div style={styles.headerTitle}>
          <div style={styles.pulse}></div>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 'bold' }}>Live Call System</h1>
        </div>
        <div style={{ color: '#cbd5e1' }}>
          {callActive && <span style={{ fontFamily: 'monospace', color: '#10b981', marginRight: '16px' }}>{formatTime(callDuration)}</span>}
          ABC Brands
        </div>
      </div>

      <div style={styles.mainContent}>
        <div style={styles.leftPanel}>
          <div style={styles.card}>
            <p style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase' }}>Supplier</p>
            <p style={{ margin: '0 0 16px 0', fontSize: '20px', fontWeight: '600' }}>ABC Brands</p>
            <div>
              <div style={{ marginBottom: '12px' }}>
                <p style={{ margin: '0 0 4px 0', fontSize: '12px', color: '#94a3b8' }}>Contact</p>
                <p style={{ margin: 0, fontSize: '14px' }}>John Smith</p>
              </div>
              <div>
                <p style={{ margin: '0 0 4px 0', fontSize: '12px', color: '#94a3b8' }}>Stage</p>
                <p style={{ margin: 0, fontSize: '14px' }}>Contact</p>
              </div>
            </div>
            <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8' }}>Trust</p>
              <div style={{ flex: 1, height: '8px', background: '#334155', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ height: '100%', background: '#06b6d4', width: '50%' }}></div>
              </div>
              <span style={{ fontSize: '12px', color: '#06b6d4', fontWeight: '600' }}>5/10</span>
            </div>
          </div>

          <div style={{ ...styles.card, flex: 1, display: 'flex', flexDirection: 'column' }}>
            <p style={{ margin: '0 0 12px 0', fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: '600' }}>Mission</p>
            <p style={{ margin: '0 0 12px 0', fontSize: '18px', fontWeight: '600' }}>Discovery</p>
            <p style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#cbd5e1' }}>Understand supplier challenges and partnership appetite</p>
            <p style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#94a3b8' }}>Success Criteria</p>
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px' }}>
              <li style={{ marginBottom: '4px' }}>✓ Pain points identified</li>
              <li style={{ marginBottom: '4px' }}>✓ Growth goals understood</li>
              <li>✓ Partnership openness confirmed</li>
            </ul>
          </div>
        </div>

        <div style={styles.rightPanel}>
          <div style={styles.transcriptBox}>
            {transcript ? transcript.split('\n').map((l, i) => (
              <div key={i} style={{ color: '#cbd5e1', marginBottom: '8px' }}>{l}</div>
            )) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#64748b' }}>
                {callActive ? '🎤 Listening... Speak now!' : 'Ready to start call'}
              </div>
            )}
          </div>

          <div style={styles.guidanceBox}>
            <p style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: '600', color: '#10b981' }}>💡 Live Guidance</p>
            <p style={{ margin: 0, fontSize: '14px', color: '#cbd5e1', lineHeight: '1.6' }}>
              {guidance || 'Claude AI coaching will appear here...'}
            </p>
          </div>

          <div style={styles.buttonGroup}>
            <button
              onClick={callActive ? handleEndCall : handleStartCall}
              style={{...styles.button, ...(callActive ? styles.buttonEnd : styles.buttonStart)}}
            >
              {callActive ? '📞 End Call' : '📞 Start Call'}
            </button>
            {callActive && (
              <button style={{...styles.button, ...styles.buttonSecondary}}>
                🎤 Recording
              </button>
            )}
            <button style={{...styles.button, ...styles.buttonSecondary}}>
              💾 Save Call
            </button>
          </div>
        </div>
      </div>

      <div style={styles.footer}>
        <span>Real-time powered by Deepgram + Claude</span>
        <span>Ready for production</span>
      </div>
    </div>
  );
}
