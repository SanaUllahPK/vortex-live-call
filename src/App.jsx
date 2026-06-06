import React, { useState, useEffect, useRef } from 'react';

const DEEPGRAM_API_KEY = import.meta.env.VITE_DEEPGRAM_API_KEY;

const CALL_TYPES = {
  quick_note: { label: '📝 Quick Note', color: '#64748b' },
  brand_registry: { label: '🏷️ Brand Registry', color: '#f59e0b' },
  retail_inquiry: { label: '🏬 Retail Inquiry', color: '#06b6d4' },
  distributor_inquiry: { label: '🚚 Distributor Inquiry', color: '#8b5cf6' }
};

const CHECKLIST_ITEMS = {
  distributor_inquiry: [
    { id: 'decision_maker', label: 'Decision maker' },
    { id: 'accounts_open', label: 'Accepts new accounts?' },
    { id: 'moq', label: 'MOQ' },
    { id: 'reseller_cert', label: 'Reseller cert required?' },
    { id: 'documents', label: 'Documents required' },
    { id: 'approval_process', label: 'Approval process' },
    { id: 'approval_timeline', label: 'Approval timeline' },
    { id: 'brands_carried', label: 'Brands/categories' },
    { id: 'payment_terms', label: 'Payment terms' },
    { id: 'shipping_policy', label: 'Shipping policy' }
  ],
  quick_note: [
    { id: 'decision_maker', label: 'Decision maker' },
    { id: 'wholesale_open', label: 'Open to wholesale?' },
    { id: 'approval_process', label: 'Approval process' },
    { id: 'requirements', label: 'Requirements' },
    { id: 'moq', label: 'Volume expectations' },
    { id: 'next_step', label: 'Next step' }
  ],
  brand_registry: [
    { id: 'decision_maker', label: 'Decision maker' },
    { id: 'current_situation', label: 'Current Amazon situation' },
    { id: 'brand_registry', label: 'Brand Registry status' },
    { id: 'challenges', label: 'Main challenges' },
    { id: 'interest', label: 'Interest level' },
    { id: 'next_step', label: 'Next step' }
  ],
  retail_inquiry: [
    { id: 'decision_maker', label: 'Decision maker' },
    { id: 'current_channels', label: 'Current distribution' },
    { id: 'wholesale_willing', label: 'Open to wholesale?' },
    { id: 'requirements', label: 'Requirements' },
    { id: 'ideal_partner', label: 'Ideal partner' },
    { id: 'next_step', label: 'Next step' }
  ]
};

export default function LiveCallUI() {
  const [callActive, setCallActive] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [conversationHistory, setConversationHistory] = useState([]);
  const [nextQuestion, setNextQuestion] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [briefInput, setBriefInput] = useState('');
  const [briefText, setBriefText] = useState('');
  const [callType, setCallType] = useState('distributor_inquiry');
  const [callTypeSelected, setCallTypeSelected] = useState('');
  const [checkedItems, setCheckedItems] = useState({});
  const [currentStage, setCurrentStage] = useState('Introduction');
  const [discoveryScore, setDiscoveryScore] = useState(0);
  const [missingItems, setMissingItems] = useState([]);
  
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

      if (!response.ok) return;

      const result = await response.json();
      if (result.results?.channels?.[0]?.alternatives?.[0]?.transcript) {
        const contactWords = result.results.channels[0].alternatives[0].transcript;
        if (contactWords) {
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
    try {
      const response = await fetch(import.meta.env.VITE_API_URL + '/api/analyze-live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: text,
          conversationHistory: history,
          brief: briefText,
          callType: callTypeSelected,
          checkedItems
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setNextQuestion(data.nextQuestion || '');
        setCurrentStage(data.currentStage || '');
        setDiscoveryScore(data.discoveryScore || 0);
        setMissingItems(data.missingItems || []);
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

  const toggleCheckbox = (itemId) => {
    setCheckedItems(prev => ({ ...prev, [itemId]: !prev[itemId] }));
  };

  const startCall = () => {
    setBriefText(briefInput);
    setCallTypeSelected(callType);
    setCallActive(true);
    setCallDuration(0);
    setConversationHistory([]);
    setCheckedItems({});
    setDiscoveryScore(0);
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
DISCOVERY SCORE: ${discoveryScore}/10

---

${transcript}`;

    const blob = new Blob([fullText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Vortex-${callTypeSelected}-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
  };

  const checklistItems = CHECKLIST_ITEMS[callTypeSelected] || CHECKLIST_ITEMS.distributor_inquiry;

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
      fontSize: '14px'
    },
    mainContent: {
      flex: 1,
      display: 'flex',
      gap: '16px',
      padding: '16px',
      overflow: 'hidden'
    },
    leftPanel: {
      width: '300px',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      overflow: 'auto'
    },
    hudCard: {
      background: 'rgba(15, 23, 42, 0.6)',
      border: '1px solid rgba(51, 65, 85, 0.5)',
      borderRadius: '6px',
      padding: '12px',
      fontSize: '12px'
    },
    hudLabel: {
      color: '#64748b',
      textTransform: 'uppercase',
      fontSize: '10px',
      fontWeight: '700',
      marginBottom: '6px',
      letterSpacing: '0.5px'
    },
    hudValue: {
      color: '#e2e8f0',
      fontSize: '13px',
      fontWeight: '600',
      marginBottom: '8px'
    },
    scoreBar: {
      height: '6px',
      background: 'rgba(51, 65, 85, 0.3)',
      borderRadius: '3px',
      overflow: 'hidden',
      marginTop: '4px'
    },
    scoreFill: {
      height: '100%',
      background: 'linear-gradient(to right, #06b6d4, #10b981)',
      transition: 'width 0.3s'
    },
    missingList: {
      display: 'flex',
      flexDirection: 'column',
      gap: '6px'
    },
    missingItem: {
      color: '#94a3b8',
      fontSize: '12px',
      padding: '4px 0',
      borderLeft: '2px solid rgba(51, 65, 85, 0.5)',
      paddingLeft: '8px'
    },
    nextQuestion: {
      background: 'rgba(59, 130, 246, 0.1)',
      border: '1px solid rgba(59, 130, 246, 0.3)',
      color: '#a5d6ff',
      padding: '12px',
      borderRadius: '6px',
      fontSize: '13px',
      lineHeight: '1.5',
      fontStyle: 'italic'
    },
    rightPanel: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      overflow: 'hidden'
    },
    dialogBox: {
      background: 'rgba(15, 23, 42, 0.4)',
      border: '1px solid rgba(51, 65, 85, 0.5)',
      borderRadius: '6px',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      flex: 1
    },
    dialogLabel: {
      fontSize: '11px',
      fontWeight: '700',
      color: '#64748b',
      textTransform: 'uppercase',
      padding: '10px',
      borderBottom: '1px solid rgba(51, 65, 85, 0.5)',
      background: 'rgba(15, 23, 42, 0.8)',
      letterSpacing: '0.5px'
    },
    dialogContent: {
      flex: 1,
      overflow: 'auto',
      padding: '12px',
      display: 'flex',
      flexDirection: 'column',
      gap: '10px'
    },
    message: {
      padding: '10px',
      borderRadius: '4px',
      fontSize: '12px',
      lineHeight: '1.5'
    },
    checklistPanel: {
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
      maxHeight: '200px',
      overflow: 'auto'
    },
    checklistItem: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '6px',
      cursor: 'pointer',
      borderRadius: '4px',
      fontSize: '12px',
      transition: 'background 0.2s'
    },
    checkbox: {
      width: '16px',
      height: '16px',
      borderRadius: '3px',
      border: '1.5px solid rgba(51, 65, 85, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '10px',
      transition: 'all 0.2s'
    },
    buttonGroup: {
      display: 'flex',
      gap: '8px',
      flexWrap: 'wrap',
      justifyContent: 'center'
    },
    button: {
      padding: '8px 16px',
      borderRadius: '4px',
      border: 'none',
      fontWeight: '600',
      cursor: 'pointer',
      fontSize: '12px',
      transition: 'all 0.2s'
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span style={{ fontWeight: '700' }}>VORTEX LIVE CALL</span>
        {callActive && <span style={{ color: '#10b981', fontFamily: 'monospace' }}>{formatTime(callDuration)} | {CALL_TYPES[callTypeSelected]?.label}</span>}
      </div>

      <div style={styles.mainContent}>
        {/* LEFT PANEL - HUD */}
        <div style={styles.leftPanel}>
          {!callActive ? (
            <>
              <div style={styles.hudCard}>
                <div style={styles.hudLabel}>Call Type</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '6px' }}>
                  {Object.entries(CALL_TYPES).map(([key, value]) => (
                    <button
                      key={key}
                      onClick={() => setCallType(key)}
                      style={{
                        padding: '8px',
                        background: callType === key ? 'rgba(16, 185, 129, 0.15)' : 'rgba(15, 23, 42, 0.5)',
                        border: callType === key ? '1.5px solid #10b981' : '1px solid rgba(51, 65, 85, 0.5)',
                        borderRadius: '4px',
                        color: callType === key ? '#10b981' : '#cbd5e1',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: '600',
                        transition: 'all 0.2s'
                      }}
                    >
                      {value.label}
                    </button>
                  ))}
                </div>
              </div>

              <div style={styles.hudCard}>
                <div style={styles.hudLabel}>Brief</div>
                <textarea
                  value={briefInput}
                  onChange={(e) => setBriefInput(e.target.value)}
                  placeholder="What's the focus?"
                  style={{
                    width: '100%',
                    padding: '8px',
                    background: 'rgba(15, 23, 42, 0.5)',
                    border: '1px solid rgba(51, 65, 85, 0.5)',
                    borderRadius: '4px',
                    color: '#cbd5e1',
                    fontSize: '11px',
                    fontFamily: 'system-ui',
                    resize: 'none',
                    height: '70px'
                  }}
                />
                <button
                  onClick={startCall}
                  disabled={!briefInput.trim()}
                  style={{
                    ...styles.button,
                    marginTop: '8px',
                    width: '100%',
                    background: briefInput.trim() ? '#10b981' : '#475569',
                    color: '#fff',
                    cursor: briefInput.trim() ? 'pointer' : 'not-allowed'
                  }}
                >
                  📞 START CALL
                </button>
              </div>
            </>
          ) : (
            <>
              {/* HUD DISPLAY */}
              <div style={styles.hudCard}>
                <div style={styles.hudLabel}>Current Stage</div>
                <div style={styles.hudValue}>{currentStage}</div>
              </div>

              <div style={styles.hudCard}>
                <div style={styles.hudLabel}>Discovery Progress</div>
                <div style={styles.hudValue}>{discoveryScore}/10</div>
                <div style={styles.scoreBar}>
                  <div style={{...styles.scoreFill, width: `${discoveryScore * 10}%`}}></div>
                </div>
              </div>

              <div style={styles.hudCard}>
                <div style={styles.hudLabel}>Missing</div>
                <div style={styles.missingList}>
                  {missingItems.length > 0 ? (
                    missingItems.map((item, idx) => (
                      <div key={idx} style={styles.missingItem}>☐ {item}</div>
                    ))
                  ) : (
                    <div style={{...styles.missingItem, color: '#10b981'}}>✓ All discovered</div>
                  )}
                </div>
              </div>

              <div style={styles.hudCard}>
                <div style={styles.hudLabel}>Next Question</div>
                <div style={styles.nextQuestion}>
                  {isGenerating ? '⏳ Analyzing...' : nextQuestion || 'Listen to contact'}
                </div>
              </div>

              {/* CHECKLIST */}
              <div style={styles.hudCard}>
                <div style={styles.hudLabel}>Checklist</div>
                <div style={styles.checklistPanel}>
                  {checklistItems.map(item => (
                    <div
                      key={item.id}
                      onClick={() => toggleCheckbox(item.id)}
                      style={{
                        ...styles.checklistItem,
                        background: checkedItems[item.id] ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                        color: checkedItems[item.id] ? '#10b981' : '#cbd5e1'
                      }}
                    >
                      <div
                        style={{
                          ...styles.checkbox,
                          background: checkedItems[item.id] ? '#10b981' : 'transparent',
                          borderColor: checkedItems[item.id] ? '#10b981' : 'rgba(51, 65, 85, 0.5)',
                          color: '#fff'
                        }}
                      >
                        {checkedItems[item.id] ? '✓' : ''}
                      </div>
                      <span>{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* RIGHT PANEL - CONVERSATION */}
        {callActive && (
          <div style={styles.rightPanel}>
            <div style={styles.dialogBox}>
              <div style={styles.dialogLabel}>📞 CONVERSATION</div>
              <div style={styles.dialogContent}>
                {conversationHistory.length === 0 ? (
                  <div style={{ color: '#64748b', textAlign: 'center', marginTop: '40px', fontSize: '12px' }}>Start listening...</div>
                ) : (
                  conversationHistory.map((item, idx) => (
                    <div
                      key={idx}
                      style={{
                        ...styles.message,
                        background: item.speaker === 'contact' ? 'rgba(248, 113, 113, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                        borderLeft: item.speaker === 'contact' ? '2px solid #f87171' : '2px solid #10b981',
                        color: item.speaker === 'contact' ? '#fca5a5' : '#a7f3d0'
                      }}
                    >
                      <strong>{item.speaker === 'contact' ? '🗣️ CONTACT' : '💬 YOU'}</strong>
                      <div style={{ marginTop: '4px' }}>{item.text}</div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div style={styles.buttonGroup}>
              {isListening ? (
                <button
                  onClick={stopListening}
                  style={{...styles.button, background: '#f59e0b', color: '#fff'}}
                >
                  ⏹️ STOP
                </button>
              ) : (
                <button
                  onClick={startListening}
                  style={{...styles.button, background: '#ef4444', color: '#fff'}}
                >
                  🎤 LISTEN
                </button>
              )}
              <button
                onClick={endCall}
                style={{...styles.button, background: '#ef4444', color: '#fff'}}
              >
                📞 END CALL
              </button>
              {conversationHistory.length > 0 && (
                <button
                  onClick={saveCall}
                  style={{...styles.button, background: '#475569', color: '#e2e8f0'}}
                >
                  💾 SAVE
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
