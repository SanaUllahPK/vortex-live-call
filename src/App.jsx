import React, { useState, useEffect, useRef } from 'react';

const DEEPGRAM_API_KEY = import.meta.env.VITE_DEEPGRAM_API_KEY;

const CALL_TYPES = {
  quick_note: { label: '📝 Quick Note', color: '#64748b' },
  brand_registry: { label: '🏷️ Brand Registry', color: '#f59e0b' },
  retail_inquiry: { label: '🏬 Retail Inquiry', color: '#06b6d4' },
  distributor_inquiry: { label: '🚚 Distributor Inquiry', color: '#8b5cf6' }
};

export default function LiveCallUI() {
  const [callActive, setCallActive] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [conversationHistory, setConversationHistory] = useState([]);
  const [sayNow, setSayNow] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [briefInput, setBriefInput] = useState('');
  const [briefText, setBriefText] = useState('');
  const [callType, setCallType] = useState('distributor_inquiry');
  const [callTypeSelected, setCallTypeSelected] = useState('');
  
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null);
  const transcriptEndRef = useRef(null);

  useEffect(() => {
    let interval;
    if (callActive) {
      interval = setInterval(() => setCallDuration(p => p + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [callActive]);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversationHistory]);

  const formatTime = (s) => `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`;

  const sendToDeepgram = async (audioBlob) => {
    try {
      const response = await fetch(
        `https://api.deepgram.com/v1/listen?model=nova-2&encoding=linear16&language=en&smart_format=true&filler_words=false`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Token ${DEEPGRAM_API_KEY}`,
            'Content-Type': 'audio/wav'
          },
          body: audioBlob
        }
      );

      if (!response.ok) return;

      const result = await response.json();
      if (result.results?.channels?.[0]?.alternatives?.[0]?.transcript) {
        const contactWords = result.results.channels[0].alternatives[0].transcript;
        if (contactWords.trim()) {
          const updatedHistory = [...conversationHistory, {
            speaker: 'contact',
            text: contactWords,
            timestamp: new Date().toLocaleTimeString()
          }];
          setConversationHistory(updatedHistory);
          generateResponse(contactWords, updatedHistory);
        }
      }
    } catch (err) {
      console.error('Deepgram request failed:', err);
    }
  };

  const generateResponse = async (text, history) => {
    setIsGenerating(true);
    setSayNow('');
    try {
      const response = await fetch(import.meta.env.VITE_API_URL + '/api/analyze-live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: text,
          conversationHistory: history,
          brief: briefText,
          callType: callTypeSelected
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setSayNow(data.guidance || '');
      }
    } catch (err) {
      console.error('Claude response error:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const startListening = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        await sendToDeepgram(audioBlob);
        audioChunksRef.current = [];
      };

      mediaRecorder.start();
      setIsListening(true);
    } catch (err) {
      alert('Please allow microphone access');
    }
  };

  const stopListening = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    setIsListening(false);
  };

  const startCall = () => {
    setBriefText(briefInput);
    setCallTypeSelected(callType);
    setCallActive(true);
    setCallDuration(0);
    setConversationHistory([]);
    setSayNow('');
  };

  const endCall = () => {
    if (isListening) stopListening();
    setCallActive(false);
  };

  const saveCall = () => {
    const transcript = conversationHistory.map(item => 
      `[${item.timestamp}] ${item.speaker === 'contact' ? 'CONTACT' : 'YOU'}: ${item.text}`
    ).join('\n\n');

    const fullText = `CALL TYPE: ${CALL_TYPES[callTypeSelected]?.label}
BRIEF: ${briefText}

---

${transcript}`;

    const blob = new Blob([fullText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Vortex-${callTypeSelected}-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
  };

  const addMyAnswer = () => {
    if (sayNow.trim()) {
      setConversationHistory([...conversationHistory, {
        speaker: 'you',
        text: sayNow.replace(/^SAY NOW:\s*/i, '').trim(),
        timestamp: new Date().toLocaleTimeString()
      }]);
      setSayNow('');
    }
  };

  const styles = {
    container: {
      height: '100vh',
      background: 'linear-gradient(to bottom right, #0f172a, #0f1419)',
      color: '#fff',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    },
    header: {
      background: 'rgba(15, 23, 42, 0.8)',
      borderBottom: '1px solid rgba(51, 65, 85, 0.5)',
      padding: '12px 24px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      fontSize: '14px',
      fontWeight: '700'
    },
    mainContent: {
      flex: 1,
      display: 'flex',
      gap: '16px',
      padding: '16px',
      overflow: 'hidden'
    },
    setupPanel: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      gap: '16px',
      justifyContent: 'center',
      alignItems: 'center'
    },
    setupCard: {
      background: 'rgba(30, 41, 59, 0.5)',
      border: '1px solid rgba(51, 65, 85, 0.5)',
      borderRadius: '8px',
      padding: '32px',
      maxWidth: '500px',
      width: '100%'
    },
    setupLabel: {
      fontSize: '12px',
      fontWeight: '700',
      color: '#94a3b8',
      textTransform: 'uppercase',
      marginBottom: '16px',
      letterSpacing: '0.5px'
    },
    typeGrid: {
      display: 'grid',
      gridTemplateColumns: '1fr',
      gap: '8px',
      marginBottom: '24px'
    },
    typeButton: {
      padding: '16px',
      background: 'rgba(15, 23, 42, 0.5)',
      border: '1px solid rgba(51, 65, 85, 0.5)',
      borderRadius: '6px',
      cursor: 'pointer',
      color: '#cbd5e1',
      textAlign: 'left',
      fontSize: '13px',
      fontWeight: '600',
      transition: 'all 0.2s'
    },
    typeButtonActive: {
      background: 'rgba(16, 185, 129, 0.1)',
      border: '2px solid #10b981',
      color: '#10b981'
    },
    textarea: {
      width: '100%',
      padding: '12px',
      background: 'rgba(15, 23, 42, 0.5)',
      border: '1px solid rgba(51, 65, 85, 0.5)',
      borderRadius: '6px',
      color: '#cbd5e1',
      fontSize: '13px',
      fontFamily: 'system-ui',
      resize: 'vertical',
      minHeight: '120px',
      marginBottom: '16px'
    },
    startButton: {
      width: '100%',
      padding: '14px',
      background: '#10b981',
      color: '#fff',
      border: 'none',
      borderRadius: '6px',
      fontSize: '14px',
      fontWeight: '700',
      cursor: 'pointer',
      transition: 'all 0.2s'
    },
    callPanel: {
      flex: 1,
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '16px',
      overflow: 'hidden'
    },
    conversationBox: {
      background: 'rgba(15, 23, 42, 0.4)',
      border: '1px solid rgba(51, 65, 85, 0.5)',
      borderRadius: '8px',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    },
    boxHeader: {
      fontSize: '11px',
      fontWeight: '700',
      color: '#64748b',
      textTransform: 'uppercase',
      padding: '12px',
      borderBottom: '1px solid rgba(51, 65, 85, 0.5)',
      background: 'rgba(15, 23, 42, 0.8)',
      letterSpacing: '0.5px'
    },
    boxContent: {
      flex: 1,
      overflow: 'auto',
      padding: '12px',
      display: 'flex',
      flexDirection: 'column',
      gap: '10px'
    },
    message: {
      padding: '12px',
      borderRadius: '6px',
      fontSize: '12px',
      lineHeight: '1.5'
    },
    contactMessage: {
      background: 'rgba(248, 113, 113, 0.1)',
      borderLeft: '3px solid #f87171',
      color: '#fca5a5'
    },
    yourMessage: {
      background: 'rgba(16, 185, 129, 0.1)',
      borderLeft: '3px solid #10b981',
      color: '#a7f3d0'
    },
    sayNowBox: {
      background: 'rgba(15, 23, 42, 0.4)',
      border: '2px solid rgba(59, 130, 246, 0.5)',
      borderRadius: '8px',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    },
    sayNowHeader: {
      fontSize: '11px',
      fontWeight: '700',
      color: '#3b82f6',
      textTransform: 'uppercase',
      padding: '12px',
      borderBottom: '1px solid rgba(59, 130, 246, 0.3)',
      background: 'rgba(15, 23, 42, 0.8)',
      letterSpacing: '0.5px'
    },
    sayNowContent: {
      flex: 1,
      overflow: 'auto',
      padding: '20px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    },
    sayNowText: {
      fontSize: '16px',
      lineHeight: '1.7',
      color: '#a5d6ff',
      fontWeight: '500',
      textAlign: 'left'
    },
    buttonRow: {
      display: 'flex',
      gap: '10px',
      justifyContent: 'center',
      flexWrap: 'wrap',
      padding: '12px'
    },
    button: {
      padding: '10px 16px',
      borderRadius: '6px',
      border: 'none',
      fontWeight: '600',
      cursor: 'pointer',
      fontSize: '13px',
      transition: 'all 0.2s'
    },
    buttonDanger: {
      background: '#ef4444',
      color: '#fff'
    },
    buttonWarning: {
      background: '#f59e0b',
      color: '#fff'
    },
    buttonSecondary: {
      background: '#475569',
      color: '#e2e8f0'
    },
    buttonSuccess: {
      background: '#10b981',
      color: '#fff'
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span>VORTEX LIVE CALL COPILOT</span>
        {callActive && <span style={{ color: '#10b981', fontFamily: 'monospace', fontSize: '13px' }}>{formatTime(callDuration)} | {CALL_TYPES[callTypeSelected]?.label}</span>}
      </div>

      <div style={styles.mainContent}>
        {!callActive ? (
          <div style={styles.setupPanel}>
            <div style={styles.setupCard}>
              <div style={styles.setupLabel}>📞 Call Type</div>
              <div style={styles.typeGrid}>
                {Object.entries(CALL_TYPES).map(([key, value]) => (
                  <button
                    key={key}
                    onClick={() => setCallType(key)}
                    style={{
                      ...styles.typeButton,
                      ...(callType === key ? styles.typeButtonActive : {})
                    }}
                  >
                    {value.label}
                  </button>
                ))}
              </div>

              <div style={styles.setupLabel}>📝 Brief</div>
              <textarea
                value={briefInput}
                onChange={(e) => setBriefInput(e.target.value)}
                placeholder="What's the focus? Who are you talking to? What do you want to learn?"
                style={styles.textarea}
              />

              <button
                onClick={startCall}
                disabled={!briefInput.trim()}
                style={{
                  ...styles.startButton,
                  opacity: briefInput.trim() ? 1 : 0.5,
                  cursor: briefInput.trim() ? 'pointer' : 'not-allowed'
                }}
              >
                🎤 START CALL
              </button>
            </div>
          </div>
        ) : (
          <div style={styles.callPanel}>
            {/* CONVERSATION */}
            <div style={styles.conversationBox}>
              <div style={styles.boxHeader}>📞 Full Transcript</div>
              <div style={styles.boxContent}>
                {conversationHistory.length === 0 ? (
                  <div style={{ color: '#64748b', textAlign: 'center', marginTop: '40px' }}>Start listening...</div>
                ) : (
                  <>
                    {conversationHistory.map((item, idx) => (
                      <div
                        key={idx}
                        style={{
                          ...styles.message,
                          ...(item.speaker === 'contact' ? styles.contactMessage : styles.yourMessage)
                        }}
                      >
                        <strong>{item.speaker === 'contact' ? '🗣️ CONTACT' : '💬 YOU'}</strong>
                        <div style={{ marginTop: '6px' }}>{item.text}</div>
                      </div>
                    ))}
                    <div ref={transcriptEndRef} />
                  </>
                )}
              </div>
            </div>

            {/* SAY NOW */}
            <div style={styles.sayNowBox}>
              <div style={styles.sayNowHeader}>✨ SAY NOW</div>
              <div style={styles.sayNowContent}>
                {isGenerating ? (
                  <div style={styles.sayNowText}>⏳ Listening...</div>
                ) : sayNow ? (
                  <div style={styles.sayNowText}>{sayNow.replace(/^SAY NOW:\s*/i, '').trim()}</div>
                ) : (
                  <div style={{ color: '#64748b', textAlign: 'center' }}>Listen to them</div>
                )}
              </div>
              <div style={styles.buttonRow}>
                {isListening ? (
                  <button onClick={stopListening} style={{...styles.button, ...styles.buttonWarning}}>
                    ⏹️ STOP
                  </button>
                ) : (
                  <button onClick={startListening} style={{...styles.button, ...styles.buttonDanger}}>
                    🎤 LISTEN
                  </button>
                )}
                <button onClick={endCall} style={{...styles.button, ...styles.buttonDanger}}>
                  📞 END CALL
                </button>
                {conversationHistory.length > 0 && (
                  <button onClick={saveCall} style={{...styles.button, ...styles.buttonSecondary}}>
                    💾 SAVE
                  </button>
                )}
              </div>
              {sayNow && (
                <button
                  onClick={addMyAnswer}
                  style={{
                    width: 'calc(100% - 24px)',
                    padding: '10px',
                    margin: '12px',
                    background: '#10b981',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    fontWeight: '600',
                    fontSize: '12px',
                    cursor: 'pointer'
                  }}
                >
                  ✅ Add My Answer
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
