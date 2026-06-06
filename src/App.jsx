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
    description: 'You\'re buying from them',
    color: '#8b5cf6'
  }
};

const DISCOVERY_CHECKLISTS = {
  distributor_inquiry: {
    title: 'DISCOVERY CHECKLIST',
    items: [
      { id: 'decision_maker', label: 'Decision maker confirmed' },
      { id: 'accounts_open', label: 'Do they accept new accounts?' },
      { id: 'moq', label: 'MOQ discovered' },
      { id: 'reseller_cert', label: 'Reseller certificate required?' },
      { id: 'approval_process', label: 'Approval process discovered' },
      { id: 'approval_timeline', label: 'Timeline discovered' },
      { id: 'brands_carried', label: 'Brands/categories discovered' },
      { id: 'documents', label: 'Documents required discovered' },
      { id: 'next_step', label: 'Next step secured' }
    ]
  },
  quick_note: {
    title: 'DISCOVERY CHECKLIST',
    items: [
      { id: 'decision_maker', label: 'Decision maker identified' },
      { id: 'wholesale_open', label: 'Do they accept wholesale?' },
      { id: 'approval_process', label: 'Approval process learned' },
      { id: 'requirements', label: 'Requirements discovered' },
      { id: 'moq', label: 'Volume expectations learned' },
      { id: 'next_step', label: 'Next step secured' }
    ]
  },
  brand_registry: {
    title: 'DISCOVERY CHECKLIST',
    items: [
      { id: 'aware_issue', label: 'They\'re aware of Amazon challenges' },
      { id: 'decision_maker', label: 'Decision maker identified' },
      { id: 'current_situation', label: 'Current Amazon situation understood' },
      { id: 'brand_registry', label: 'Brand Registry status learned' },
      { id: 'unauthorized_sellers', label: 'Unauthorized seller concern raised' },
      { id: 'interest_level', label: 'Interest level assessed' },
      { id: 'next_step', label: 'Next step secured' }
    ]
  },
  retail_inquiry: {
    title: 'DISCOVERY CHECKLIST',
    items: [
      { id: 'decision_maker', label: 'Decision maker identified' },
      { id: 'current_channels', label: 'Current distribution understood' },
      { id: 'wholesale_willing', label: 'Open to wholesale partners?' },
      { id: 'requirements', label: 'Partner requirements learned' },
      { id: 'ideal_partner', label: 'Ideal partner profile learned' },
      { id: 'approval_process', label: 'Approval process discovered' },
      { id: 'next_step', label: 'Next step secured' }
    ]
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
  const [callType, setCallType] = useState('distributor_inquiry');
  const [callTypeSelected, setCallTypeSelected] = useState('');
  const [checkedItems, setCheckedItems] = useState({});
  
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
    setCheckedItems({});
  };

  const endCall = () => {
    if (isListening) {
      stopListening();
    }
    setCallActive(false);
  };

  const toggleCheckbox = (itemId) => {
    setCheckedItems(prev => ({
      ...prev,
      [itemId]: !prev[itemId]
    }));
  };

  const saveCall = () => {
    const transcript = conversationHistory.map(item => 
      `[${item.timestamp}] ${item.speaker === 'supplier' ? 'CONTACT' : 'YOU'}: ${item.text}`
    ).join('\n\n');

    const fullText = `CALL TYPE: ${CALL_TYPES[callTypeSelected]?.label || 'Unknown'}

BRIEF:
${briefText}

DISCOVERY CHECKLIST:
${Object.entries(checkedItems).map(([k, v]) => v ? '✓' : '○').join('')}

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
    mainContent: {
      flex: 1,
      display: 'flex',
      gap: '16px',
      padding: '16px',
      overflow: 'hidden'
    },
    leftPanel: {
      width: '340px',
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
      display: 'flex',
      flexDirection: 'column',
      gap: '16px',
      overflow: 'hidden'
    },
    dialogBox: {
      background: 'rgba(15, 23, 42, 0.3)',
      border: '1px solid rgba(51, 65, 85, 0.5)',
      borderRadius: '8px',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      flex: 1
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
    checklistItem: {
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      padding: '8px',
      fontSize: '13px',
      color: '#cbd5e1',
      cursor: 'pointer',
      borderRadius: '4px',
      transition: 'background 0.2s'
    },
    checkbox: {
      width: '18px',
      height: '18px',
      borderRadius: '4px',
      border: '2px solid rgba(51, 65, 85, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      transition: 'all 0.2s'
    },
    checkboxChecked: {
      background: '#10b981',
      borderColor: '#10b981'
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
    footer: {
      background: 'rgba(15, 23, 42, 0.5)',
      borderTop: '1px solid rgba(51, 65, 85, 0.5)',
      padding: '8px 24px',
      fontSize: '12px',
      color: '#94a3b8'
    }
  };

  const checklist = DISCOVERY_CHECKLISTS[callTypeSelected] || DISCOVERY_CHECKLISTS.distributor_inquiry;

  return (
    <div style={styles.container}>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>

      <div style={styles.header}>
        <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 'bold' }}>Live Call System</h1>
        <div style={{ color: '#cbd5e1' }}>
          {callActive && <span style={{ fontFamily: 'monospace', color: '#10b981', marginRight: '16px' }}>{formatTime(callDuration)}</span>}
          {callActive && CALL_TYPES[callTypeSelected]?.label}
        </div>
      </div>

      <div style={styles.mainContent}>
        <div style={styles.leftPanel}>
          {!callActive && (
            <>
              <div style={styles.card}>
                <p style={{ fontSize: '12px', fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase', margin: '0 0 12px 0' }}>Call Type</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px' }}>
                  {Object.entries(CALL_TYPES).map(([key, value]) => (
                    <button
                      key={key}
                      onClick={() => setCallType(key)}
                      style={{
                        padding: '12px',
                        background: callType === key ? 'rgba(16, 185, 129, 0.1)' : 'rgba(15, 23, 42, 0.5)',
                        border: callType === key ? '2px solid #10b981' : '1px solid rgba(51, 65, 85, 0.5)',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        color: '#cbd5e1',
                        textAlign: 'left',
                        transition: 'all 0.2s'
                      }}
                    >
                      <div style={{ fontWeight: '600', fontSize: '13px' }}>{value.label}</div>
                      <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>{value.description}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ ...styles.card, flex: 1 }}>
                <p style={{ fontSize: '12px', fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase', margin: '0 0 12px 0' }}>Brief</p>
                <textarea
                  value={briefInput}
                  onChange={(e) => setBriefInput(e.target.value)}
                  placeholder="What's the focus of this call?"
                  style={{
                    width: '100%',
                    padding: '12px',
                    background: 'rgba(15, 23, 42, 0.5)',
                    border: '1px solid rgba(51, 65, 85, 0.5)',
                    borderRadius: '6px',
                    color: '#cbd5e1',
                    fontSize: '13px',
                    fontFamily: 'system-ui',
                    resize: 'none',
                    height: '100px'
                  }}
                />
              </div>
            </>
          )}

          {callActive && (
            <div style={styles.card}>
              <p style={{ fontSize: '12px', fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase', margin: '0 0 12px 0' }}>
                {checklist.title}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {checklist.items.map(item => (
                  <div
                    key={item.id}
                    onClick={() => toggleCheckbox(item.id)}
                    style={{
                      ...styles.checklistItem,
                      background: checkedItems[item.id] ? 'rgba(16, 185, 129, 0.1)' : 'transparent'
                    }}
                  >
                    <div style={{
                      ...styles.checkbox,
                      ...(checkedItems[item.id] ? styles.checkboxChecked : {})
                    }}>
                      {checkedItems[item.id] && '✓'}
                    </div>
                    <span>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={styles.rightPanel}>
          <div style={styles.dialogContainer}>
            <div style={styles.dialogBox}>
              <div style={styles.dialogLabel}>📞 Conversation</div>
              <div style={styles.dialogContent}>
                {conversationHistory.length === 0 ? (
                  <div style={{ color: '#64748b', textAlign: 'center', marginTop: '40px' }}>Start call to begin</div>
                ) : (
                  conversationHistory.map((item, idx) => (
                    <div key={idx} style={{
                      padding: '12px',
                      borderRadius: '6px',
                      fontSize: '13px',
                      lineHeight: '1.5',
                      background: item.speaker === 'supplier' ? 'rgba(248, 113, 113, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                      borderLeft: item.speaker === 'supplier' ? '3px solid #f87171' : '3px solid #10b981',
                      color: item.speaker === 'supplier' ? '#fca5a5' : '#a7f3d0'
                    }}>
                      <strong>{item.speaker === 'supplier' ? '🗣️ CONTACT' : '💬 YOU'}:</strong> {item.text}
                    </div>
                  ))
                )}
              </div>
            </div>

            <div style={styles.dialogBox}>
              <div style={{...styles.dialogLabel, color: '#3b82f6'}}>✨ Coaching</div>
              <div style={styles.dialogContent}>
                {isGenerating ? (
                  <div style={{ color: '#64748b' }}>Analyzing...</div>
                ) : suggestedResponse ? (
                  <div style={{ fontSize: '13px', lineHeight: '1.6', whiteSpace: 'pre-wrap', color: '#cbd5e1' }}>
                    {suggestedResponse}
                  </div>
                ) : (
                  <div style={{ color: '#64748b', textAlign: 'center', marginTop: '40px' }}>Listen to contact</div>
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
                    style={{...styles.button, background: '#f59e0b', color: '#fff'}}
                  >
                    ⏹️ Stop Listening
                  </button>
                ) : (
                  <button
                    onClick={startListening}
                    style={{...styles.button, ...styles.buttonDanger}}
                  >
                    🎤 Listen
                  </button>
                )}
                {suggestedResponse && (
                  <button
                    onClick={addMyResponse}
                    style={{...styles.button, ...styles.buttonPrimary}}
                  >
                    ✅ Add Response
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
                style={{...styles.button, background: '#475569', color: '#e2e8f0'}}
              >
                💾 Save Call
              </button>
            )}
          </div>
        </div>
      </div>

      <div style={styles.footer}>
        <span>Discovery-focused coaching system</span>
      </div>
    </div>
  );
}
