import React, { useState, useEffect, useRef } from 'react';

const DEEPGRAM_API_KEY = import.meta.env.VITE_DEEPGRAM_API_KEY;

const CALL_TYPES = {
  quick_note: {
    label: '📝 Quick Note',
    description: 'Light exploratory outreach',
    color: '#64748b'
  },
  brand_registry: {
    label: '🏷️ Brand Registry',
    description: 'Amazon-specific partnership',
    color: '#f59e0b'
  },
  retail_inquiry: {
    label: '🏬 Retail Inquiry',
    description: 'Retail distribution opportunity',
    color: '#06b6d4'
  },
  distributor_inquiry: {
    label: '🚚 Distributor Inquiry',
    description: 'Distributor network opportunity',
    color: '#8b5cf6'
  },
  wholesale_partnership: {
    label: '🤝 Wholesale Partnership',
    description: 'Direct wholesale opportunity',
    color: '#10b981'
  }
};

export default function LiveCallUI() {
  const [callActive, setCallActive] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [conversationHistory, setConversationHistory] = useState([]);
  const [suggestedResponse, setSuggestedResponse] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [briefInput, setBriefInput] = useState('');
  const [briefText, setBriefText] = useState('');
  const [callType, setCallType] = useState('wholesale_partnership');
  const [callTypeSelected, setCallTypeSelected] = useState('');
  
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null);

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
        const supplierWords = result.results.channels[0].alternatives[0].transcript;
        if (supplierWords) {
          const updatedHistory = [...conversationHistory, {
            speaker: 'supplier',
            text: supplierWords,
            timestamp: new Date().toLocaleTimeString()
          }];
          setConversationHistory(updatedHistory);
          generateResponse(supplierWords, updatedHistory);
        }
      }
    } catch (err) {
      console.error('Deepgram request failed:', err);
    }
  };

  const generateResponse = async (text, history) => {
    setIsGenerating(true);
    try {
      const response = await fetch(import.meta.env.VITE_API_URL + '/api/analyze-live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: text,
          missionType: 'Discovery',
          conversationHistory: history,
          brief: briefText,
          callType: callTypeSelected
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setSuggestedResponse(data.guidance || '');
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
      console.error('Microphone access error:', err);
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

  const addMyResponse = () => {
    if (suggestedResponse) {
      setConversationHistory(prev => [...prev, {
        speaker: 'you',
        text: suggestedResponse,
        timestamp: new Date().toLocaleTimeString()
      }]);
      setSuggestedResponse('');
    }
  };

  const startCall = () => {
    setBriefText(briefInput);
    setCallTypeSelected(callType);
    setCallActive(true);
    setCallDuration(0);
    setConversationHistory([]);
  };

  const endCall = () => {
    if (isListening) {
      stopListening();
    }
    setCallActive(false);
  };

  const saveCall = () => {
    const transcript = conversationHistory.map(item => 
      `[${item.timestamp}] ${item.speaker === 'supplier' ? 'SUPPLIER' : 'YOU'}: ${item.text}`
    ).join('\n\n');

    const fullText = `CALL TYPE: ${CALL_TYPES[callTypeSelected]?.label || 'Unknown'}

DISCOVERY BRIEF:
${briefText}

---

CONVERSATION TRANSCRIPT:

${transcript}`;

    const blob = new Blob([fullText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Vortex-Call-${callTypeSelected}-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
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
      flexDirection: 'column',
      gap: '12px'
    },
    conversationItem: {
      padding: '12px',
      borderRadius: '6px',
      fontSize: '13px',
      lineHeight: '1.5'
    },
    supplierMessage: {
      background: 'rgba(248, 113, 113, 0.1)',
      borderLeft: '3px solid #f87171',
      color: '#fca5a5'
    },
    yourMessage: {
      background: 'rgba(16, 185, 129, 0.1)',
      borderLeft: '3px solid #10b981',
      color: '#a7f3d0'
    },
    currentResponse: {
      background: 'rgba(59, 130, 246, 0.1)',
      borderLeft: '3px solid #3b82f6',
      padding: '16px',
      minHeight: '80px'
    },
    callTypeSelector: {
      display: 'flex',
      flexDirection: 'column',
      gap: '12px'
    },
    callTypeLabel: {
      fontSize: '12px',
      fontWeight: '600',
      color: '#94a3b8',
      textTransform: 'uppercase'
    },
    callTypeGrid: {
      display: 'grid',
      gridTemplateColumns: '1fr',
      gap: '8px'
    },
    callTypeOption: {
      padding: '12px',
      background: 'rgba(15, 23, 42, 0.5)',
      border: '2px solid rgba(51, 65, 85, 0.5)',
      borderRadius: '6px',
      cursor: 'pointer',
      transition: 'all 0.2s',
      color: '#cbd5e1',
      textAlign: 'left'
    },
    callTypeOptionActive: {
      borderColor: '#10b981',
      background: 'rgba(16, 185, 129, 0.1)'
    },
    briefInput: {
      width: '100%',
      padding: '12px',
      background: 'rgba(15, 23, 42, 0.5)',
      border: '1px solid rgba(51, 65, 85, 0.5)',
      borderRadius: '6px',
      color: '#cbd5e1',
      fontSize: '13px',
      lineHeight: '1.5',
      fontFamily: 'system-ui',
      resize: 'none',
      height: '100px'
    },
    buttonGroup: {
      display: 'flex',
      gap: '12px',
      justifyContent: 'center',
      flexWrap: 'wrap'
    },
    button: {
      padding: '10px 20px',
      borderRadius: '6px',
      border: 'none',
      fontWeight: '600',
      cursor: 'pointer',
      fontSize: '14px',
      transition: 'all 0.2s'
    },
    buttonPrimary: {
      background: '#10b981',
      color: '#fff'
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
          {callActive && CALL_TYPES[callTypeSelected]?.label}
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

          {!callActive && (
            <>
              <div style={styles.card}>
                <p style={styles.callTypeLabel}>Call Type</p>
                <div style={styles.callTypeGrid}>
                  {Object.entries(CALL_TYPES).map(([key, value]) => (
                    <button
                      key={key}
                      onClick={() => setCallType(key)}
                      style={{
                        ...styles.callTypeOption,
                        ...(callType === key ? styles.callTypeOptionActive : {})
                      }}
                    >
                      <div style={{ fontWeight: '600', fontSize: '13px' }}>{value.label}</div>
                      <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>{value.description}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ ...styles.card, flex: 1, display: 'flex', flexDirection: 'column' }}>
                <p style={{ margin: '0 0 12px 0', fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: '600' }}>Discovery Brief</p>
                <p style={{ margin: '0 0 12px 0', fontSize: '12px', color: '#cbd5e1' }}>What's the focus of this call?</p>
                <textarea
                  value={briefInput}
                  onChange={(e) => setBriefInput(e.target.value)}
                  placeholder="E.g., Understand their distribution model, learn about wholesale interest, identify decision makers..."
                  style={styles.briefInput}
                />
              </div>
            </>
          )}

          {callActive && (
            <div style={{ ...styles.card, flex: 1, display: 'flex', flexDirection: 'column' }}>
              <p style={{ margin: '0 0 12px 0', fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: '600' }}>Call Type</p>
              <p style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: '600', color: CALL_TYPES[callTypeSelected]?.color }}>
                {CALL_TYPES[callTypeSelected]?.label}
              </p>
              <p style={{ margin: '0 0 12px 0', fontSize: '12px', color: '#cbd5e1' }}>Brief:</p>
              <p style={{ margin: 0, fontSize: '12px', color: '#cbd5e1', lineHeight: '1.5' }}>{briefText}</p>
            </div>
          )}
        </div>

        <div style={styles.rightPanel}>
          <div style={styles.dialogContainer}>
            <div style={styles.dialogBox}>
              <div style={{...styles.dialogLabel}}>📋 Conversation History</div>
              <div style={styles.dialogContent}>
                {conversationHistory.length === 0 ? (
                  <div style={{ color: '#64748b', textAlign: 'center', marginTop: '40px' }}>
                    Start call to begin
                  </div>
                ) : (
                  conversationHistory.map((item, idx) => (
                    <div key={idx} style={{...styles.conversationItem, ...(item.speaker === 'supplier' ? styles.supplierMessage : styles.yourMessage)}}>
                      <strong>{item.speaker === 'supplier' ? '🗣️ SUPPLIER' : '💬 YOU'}:</strong> {item.text}
                    </div>
                  ))
                )}
              </div>
            </div>

            <div style={styles.dialogBox}>
              <div style={{...styles.dialogLabel, color: '#3b82f6'}}>✨ Claude Suggested Response</div>
              <div style={styles.dialogContent}>
                {isGenerating ? (
                  <div style={{ color: '#64748b' }}>Generating...</div>
                ) : suggestedResponse ? (
                  <div style={styles.currentResponse}>
                    {suggestedResponse}
                  </div>
                ) : (
                  <div style={{ color: '#64748b', textAlign: 'center', marginTop: '40px' }}>
                    Listen to supplier
                  </div>
                )}
              </div>
            </div>
          </div>

          <div style={styles.buttonGroup}>
            {!callActive ? (
              <button
                onClick={startCall}
                disabled={!briefInput.trim()}
                style={{
                  ...styles.button,
                  ...styles.buttonPrimary,
                  opacity: briefInput.trim() ? 1 : 0.5,
                  cursor: briefInput.trim() ? 'pointer' : 'not-allowed'
                }}
              >
                📞 Start Call
              </button>
            ) : (
              <>
                {isListening ? (
                  <button
                    onClick={stopListening}
                    style={{...styles.button, ...styles.buttonWarning}}
                  >
                    ⏹️ Stop Listening
                  </button>
                ) : (
                  <button
                    onClick={startListening}
                    style={{...styles.button, ...styles.buttonDanger}}
                  >
                    🎤 Listen to Supplier
                  </button>
                )}
                {suggestedResponse && (
                  <button
                    onClick={addMyResponse}
                    style={{...styles.button, ...styles.buttonPrimary}}
                  >
                    ✅ Add My Response
                  </button>
                )}
                <button
                  onClick={endCall}
                  style={{...styles.button, ...styles.buttonDanger}}
                >
                  📞 End Call
                </button>
              </>
            )}
            {conversationHistory.length > 0 && (
              <button
                onClick={saveCall}
                style={{...styles.button, ...styles.buttonSecondary}}
              >
                💾 Save Call
              </button>
            )}
          </div>
        </div>
      </div>

      <div style={styles.footer}>
        <span>Call type guides coaching strategy</span>
        <span>Discovery-focused approach</span>
      </div>
    </div>
  );
}
