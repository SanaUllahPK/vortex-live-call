import React, { useState, useEffect, useRef } from 'react';

const DEEPGRAM_API_KEY = import.meta.env.VITE_DEEPGRAM_API_KEY;

export default function LiveCallUI() {
  const [callActive, setCallActive] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [theirWords, setTheirWords] = useState('');
  const [suggestedResponse, setSuggestedResponse] = useState('');
  const [mediaRecorderRef, setMediaRecorderRef] = useState(null);
  const [audioChunksRef, setAudioChunksRef] = useState([]);
  const [streamRef, setStreamRef] = useState(null);

  useEffect(() => {
    let interval;
    if (callActive) {
      interval = setInterval(() => setCallDuration(p => p + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [callActive]);

  const formatTime = (s) => `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`;

  const sendToDeepgram = async (audioBlob) => {
    try {
      const response = await fetch(
        `https://api.deepgram.com/v1/listen?model=nova-2&encoding=linear16&language=en`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Token ${DEEPGRAM_API_KEY}`,
            'Content-Type': 'audio/wav'
          },
          body: audioBlob
        }
      );

      if (!response.ok) {
        console.error('Deepgram error:', response.statusText);
        return;
      }

      const result = await response.json();
      if (result.results?.channels?.[0]?.alternatives?.[0]?.transcript) {
        const newTranscript = result.results.channels[0].alternatives[0].transcript;
        if (newTranscript) {
          setTheirWords(newTranscript);
          generateResponse(newTranscript);
        }
      }
    } catch (err) {
      console.error('Deepgram request failed:', err);
    }
  };

  const generateResponse = async (transcript) => {
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
        setSuggestedResponse(data.guidance || '');
      }
    } catch (err) {
      console.error('Claude response error:', err);
    }
  };

  const handleStartCall = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setStreamRef(stream);
      
      const mediaRecorder = new MediaRecorder(stream);
      setMediaRecorderRef(mediaRecorder);
      const audioChunks = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunks.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
        await sendToDeepgram(audioBlob);
        audioChunks.length = 0;
      };

      mediaRecorder.start();
      
      setCallActive(true);
      setCallDuration(0);
      setTheirWords('');
      setSuggestedResponse('');

      // Send audio every 3 seconds
      const interval = setInterval(() => {
        if (mediaRecorder.state === 'recording') {
          mediaRecorder.stop();
          mediaRecorder.start();
        }
      }, 3000);

      return () => clearInterval(interval);
    } catch (err) {
      console.error('Microphone access error:', err);
      alert('Please allow microphone access');
    }
  };

  const handleEndCall = () => {
    if (mediaRecorderRef && mediaRecorderRef.state === 'recording') {
      mediaRecorderRef.stop();
    }
    if (streamRef) {
      streamRef.getTracks().forEach(track => track.stop());
    }
    setCallActive(false);
  };

  const handleTheirWordsChange = (e) => {
    const text = e.target.value;
    setTheirWords(text);
    if (text.trim()) {
      generateResponse(text);
    }
  };

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
    dialogContainer: {
      flex: 1,
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '16px',
      overflow: 'hidden'
    },
    dialogBox: {
      background: 'rgba(15, 23, 42, 0.3)',
      border: '1px solid rgba(51, 65, 85, 0.5)',
      borderRadius: '8px',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    },
    dialogLabel: {
      fontSize: '12px',
      fontWeight: '600',
      color: '#94a3b8',
      textTransform: 'uppercase',
      padding: '12px',
      borderBottom: '1px solid rgba(51, 65, 85, 0.5)',
      background: 'rgba(15, 23, 42, 0.5)'
    },
    dialogContent: {
      flex: 1,
      overflow: 'auto',
      padding: '16px',
      fontSize: '14px',
      lineHeight: '1.6',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    },
    dialogInput: {
      flex: 1,
      overflow: 'auto',
      padding: '16px',
      fontSize: '14px',
      lineHeight: '1.6',
      background: 'transparent',
      border: 'none',
      color: '#cbd5e1',
      resize: 'none',
      fontFamily: 'monospace'
    },
    dialogText: {
      color: '#cbd5e1',
      textAlign: 'left'
    },
    theyLabel: {
      color: '#f87171'
    },
    youLabel: {
      color: '#10b981'
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
          <div style={styles.dialogContainer}>
            {/* THEY SAID */}
            <div style={styles.dialogBox}>
              <div style={{...styles.dialogLabel, ...styles.theyLabel}}>🗣️ They Said</div>
              {callActive ? (
                <textarea
                  value={theirWords}
                  onChange={handleTheirWordsChange}
                  placeholder="Listening... or type what they said..."
                  style={{...styles.dialogInput, color: '#cbd5e1'}}
                />
              ) : (
                <div style={styles.dialogContent}>
                  {theirWords ? (
                    <div style={styles.dialogText}>{theirWords}</div>
                  ) : (
                    <div style={{ color: '#64748b' }}>Ready to listen...</div>
                  )}
                </div>
              )}
            </div>

            {/* YOU SHOULD SAY */}
            <div style={styles.dialogBox}>
              <div style={{...styles.dialogLabel, ...styles.youLabel}}>💬 You Should Say</div>
              <div style={{...styles.dialogContent, alignItems: 'flex-start', justifyContent: 'flex-start', paddingTop: '16px'}}>
                {suggestedResponse ? (
                  <div style={styles.dialogText}>{suggestedResponse}</div>
                ) : (
                  <div style={{ color: '#64748b' }}>Claude will suggest responses here...</div>
                )}
              </div>
            </div>
          </div>

          <div style={styles.buttonGroup}>
            <button
              onClick={callActive ? handleEndCall : handleStartCall}
              style={{...styles.button, ...(callActive ? styles.buttonEnd : styles.buttonStart)}}
            >
              {callActive ? '📞 End Call' : '🎤 Record Supplier'}
            </button>
            <button style={{...styles.button, ...styles.buttonSecondary}}>
              💾 Save Call
            </button>
          </div>
        </div>
      </div>

      <div style={styles.footer}>
        <span>Two-way dialogue powered by Deepgram + Claude</span>
        <span>Ready for production</span>
      </div>
    </div>
  );
}
