import React, { useState, useEffect, useRef } from 'react';

const DEEPGRAM_API_KEY = import.meta.env.VITE_DEEPGRAM_API_KEY;
const API_URL = import.meta.env.VITE_API_URL;

const CALL_TYPES = {
  quick_note: { label: '📝 Quick Note', color: '#64748b' },
  brand_registry: { label: '🏷️ Brand Registry', color: '#f59e0b' },
  retail_inquiry: { label: '🏬 Retail Inquiry', color: '#06b6d4' },
  distributor_inquiry: { label: '🚚 Distributor Inquiry', color: '#8b5cf6' }
};

export default function LiveCallUI() {
  // Dashboard State
  const [screen, setScreen] = useState('dashboard'); // dashboard | brief | call | summary
  const [suppliers, setSuppliers] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);

  // Supplier State
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [supplierProfile, setSupplierProfile] = useState(null);

  // Call State
  const [callActive, setCallActive] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [conversationHistory, setConversationHistory] = useState([]);
  const [sayNow, setSayNow] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  // Brief State
  const [briefInput, setBriefInput] = useState('');
  const [briefText, setBriefText] = useState('');
  const [callType, setCallType] = useState('distributor_inquiry');

  // Summary State
  const [callSummary, setCallSummary] = useState(null);
  const [followUpDate, setFollowUpDate] = useState('');
  const [callOutcome, setCallOutcome] = useState('Follow Up');

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null);

  // ════════════════════════════════════════
  // LOAD SUPPLIERS (Dashboard)
  // ════════════════════════════════════════

  useEffect(() => {
    if (screen === 'dashboard') {
      loadSuppliers();
    }
  }, [screen, statusFilter]);

  const loadSuppliers = async () => {
    setLoadingSuppliers(true);
    try {
      const query = statusFilter === 'all' ? '' : `?status=${statusFilter}`;
      const response = await fetch(`${API_URL}/api/suppliers/dashboard${query}`);
      const data = await response.json();
      setSuppliers(data.suppliers || []);
    } catch (err) {
      console.error('Error loading suppliers:', err);
      alert('Failed to load suppliers');
    } finally {
      setLoadingSuppliers(false);
    }
  };

  // ════════════════════════════════════════
  // LOAD SUPPLIER PROFILE (Before Call)
  // ════════════════════════════════════════

  const selectSupplier = async (supplier) => {
    setSelectedSupplier(supplier);
    try {
      const response = await fetch(`${API_URL}/api/supplier/load`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ supplier_id: supplier.supplier_id })
      });
      const profile = await response.json();
      setSupplierProfile(profile);
      setScreen('brief');
    } catch (err) {
      console.error('Error loading supplier profile:', err);
      alert('Failed to load supplier profile');
    }
  };

  // ════════════════════════════════════════
  // LIVE CALL FUNCTIONS
  // ════════════════════════════════════════

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
    setSayNow('');
    try {
      const response = await fetch(`${API_URL}/api/analyze-live`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: text,
          conversationHistory: history,
          brief: briefText,
          callType,
          supplierProfile
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
    setCallActive(true);
    setCallDuration(0);
    setConversationHistory([]);
    setSayNow('');
    setScreen('call');
  };

  const endCall = async () => {
    if (isListening) stopListening();
    
    // Generate summary
    try {
      const response = await fetch(`${API_URL}/api/interaction/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplier_id: selectedSupplier.supplier_id,
          contact_id: supplierProfile?.primary_contact?.contact_id,
          transcript: conversationHistory.map(h => `${h.speaker}: ${h.text}`).join('\n'),
          duration_minutes: callDuration,
          call_outcome: callOutcome,
          next_step: briefText,
          follow_up_date: followUpDate
        })
      });

      if (response.ok) {
        const summary = await response.json();
        setCallSummary(summary);
        setCallActive(false);
        setScreen('summary');
      }
    } catch (err) {
      console.error('Error saving call:', err);
      alert('Failed to save call');
    }
  };

  const finalizeSummary = () => {
    setScreen('dashboard');
    setSelectedSupplier(null);
    setSupplierProfile(null);
    setConversationHistory([]);
    setCallSummary(null);
    setBriefInput('');
  };

  // ════════════════════════════════════════
  // STYLES
  // ════════════════════════════════════════

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
    content: {
      flex: 1,
      overflow: 'auto',
      padding: '16px'
    },
    card: {
      background: 'rgba(30, 41, 59, 0.5)',
      border: '1px solid rgba(51, 65, 85, 0.5)',
      borderRadius: '8px',
      padding: '16px'
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
    buttonPrimary: {
      background: '#10b981',
      color: '#fff'
    },
    buttonDanger: {
      background: '#ef4444',
      color: '#fff'
    }
  };

  // ════════════════════════════════════════
  // SCREENS
  // ════════════════════════════════════════

  // DASHBOARD SCREEN
  if (screen === 'dashboard') {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <span>📊 SUPPLIER DASHBOARD</span>
          <span>Total: {suppliers.length} suppliers</span>
        </div>
        
        <div style={styles.content}>
          <div style={{ marginBottom: '16px', display: 'flex', gap: '8px' }}>
            {['all', 'New', 'Engaged', 'Interested', 'Applied', 'Approved', 'Active'].map(status => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                style={{
                  ...styles.button,
                  background: statusFilter === status ? '#10b981' : '#475569',
                  color: '#fff'
                }}
              >
                {status === 'all' ? 'All Suppliers' : status}
              </button>
            ))}
          </div>

          {loadingSuppliers ? (
            <div>Loading suppliers...</div>
          ) : suppliers.length === 0 ? (
            <div>No suppliers found</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px' }}>
              {suppliers.map(supplier => (
                <div
                  key={supplier.supplier_id}
                  onClick={() => selectSupplier(supplier)}
                  style={{
                    ...styles.card,
                    cursor: 'pointer',
                    display: 'grid',
                    gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr',
                    alignItems: 'center',
                    gap: '16px',
                    padding: '12px'
                  }}
                >
                  <div>
                    <div style={{ fontWeight: '600' }}>{supplier.company_name}</div>
                    <div style={{ fontSize: '12px', color: '#94a3b8' }}>Status: {supplier.relationship_status}</div>
                  </div>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                    <div>Last: {supplier.last_contact_date || 'Never'}</div>
                  </div>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                    <div>Follow Up: {supplier.next_follow_up_date || '-'}</div>
                  </div>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                    <div>Likelihood: {supplier.approval_likelihood}</div>
                  </div>
                  <div style={{ fontSize: '12px', color: supplier.missing_count > 0 ? '#f87171' : '#10b981' }}>
                    <div>Missing: {supplier.missing_count} items</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // BRIEF SCREEN (Before Call - Show Supplier Memory)
  if (screen === 'brief') {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <span>📋 PRE-CALL BRIEF</span>
          <button onClick={() => setScreen('dashboard')} style={{...styles.button, background: '#475569', color: '#fff'}}>
            ← Back
          </button>
        </div>

        <div style={styles.content}>
          <div style={{maxWidth: '800px', margin: '0 auto'}}>
            {/* Supplier Info */}
            <div style={{...styles.card, marginBottom: '16px'}}>
              <div style={{fontSize: '18px', fontWeight: '700', marginBottom: '8px'}}>
                {supplierProfile?.supplier.company_name}
              </div>
              <div style={{color: '#94a3b8', fontSize: '13px'}}>
                <div>Contact: {supplierProfile?.primary_contact?.name || 'Not specified'}</div>
                <div>Status: {supplierProfile?.supplier.relationship_status}</div>
                <div>Last Contact: {supplierProfile?.supplier.last_contact_date || 'Never'}</div>
              </div>
            </div>

            {/* Known Information */}
            <div style={{...styles.card, marginBottom: '16px'}}>
              <div style={{fontSize: '14px', fontWeight: '700', marginBottom: '12px'}}>✓ KNOWN INFORMATION</div>
              <div style={{fontSize: '13px', color: '#cbd5e1', lineHeight: '1.8'}}>
                {Object.entries(supplierProfile?.known_information || {})
                  .filter(([k, v]) => v)
                  .map(([k, v]) => (
                    <div key={k}>
                      <span style={{color: '#94a3b8'}}>{k.replace(/_/g, ' ')}:</span> {v}
                    </div>
                  ))}
                {Object.values(supplierProfile?.known_information || {}).filter(v => v).length === 0 && (
                  <div style={{color: '#94a3b8'}}>Nothing known yet</div>
                )}
              </div>
            </div>

            {/* Missing Information */}
            <div style={{...styles.card, marginBottom: '16px', borderColor: '#f87171'}}>
              <div style={{fontSize: '14px', fontWeight: '700', marginBottom: '12px', color: '#fca5a5'}}>□ MISSING INFORMATION</div>
              <div style={{fontSize: '13px', color: '#fca5a5', lineHeight: '1.8'}}>
                {supplierProfile?.missing_information.map((item, idx) => (
                  <div key={idx}>□ {item}</div>
                ))}
              </div>
            </div>

            {/* Call Setup */}
            <div style={{...styles.card, marginBottom: '16px'}}>
              <div style={{fontSize: '14px', fontWeight: '700', marginBottom: '12px'}}>📞 CALL SETUP</div>
              
              <div style={{marginBottom: '12px'}}>
                <label style={{fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '4px'}}>Call Type</label>
                <select
                  value={callType}
                  onChange={(e) => setCallType(e.target.value)}
                  style={{width: '100%', padding: '8px', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px'}}
                >
                  {Object.entries(CALL_TYPES).map(([key, value]) => (
                    <option key={key} value={key}>{value.label}</option>
                  ))}
                </select>
              </div>

              <div style={{marginBottom: '12px'}}>
                <label style={{fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '4px'}}>Call Notes</label>
                <textarea
                  value={briefInput}
                  onChange={(e) => setBriefInput(e.target.value)}
                  placeholder="What's the focus of this call?"
                  style={{width: '100%', padding: '8px', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px', minHeight: '80px', fontFamily: 'system-ui'}}
                />
              </div>

              <button
                onClick={startCall}
                disabled={!briefInput.trim()}
                style={{
                  ...styles.button,
                  ...styles.buttonPrimary,
                  width: '100%',
                  opacity: briefInput.trim() ? 1 : 0.5,
                  cursor: briefInput.trim() ? 'pointer' : 'not-allowed'
                }}
              >
                🎤 START CALL
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // CALL SCREEN (During Call)
  if (screen === 'call') {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <span>📞 LIVE CALL</span>
          <span style={{color: '#10b981', fontFamily: 'monospace'}}>{formatTime(callDuration)}</span>
        </div>

        <div style={{...styles.content, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px'}}>
          {/* Conversation */}
          <div style={{...styles.card, display: 'flex', flexDirection: 'column', height: 'calc(100vh - 100px)'}}>
            <div style={{fontSize: '12px', fontWeight: '700', color: '#94a3b8', marginBottom: '12px', textTransform: 'uppercase'}}>📞 Conversation</div>
            <div style={{flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px'}}>
              {conversationHistory.map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '10px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    lineHeight: '1.5',
                    background: item.speaker === 'contact' ? 'rgba(248, 113, 113, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                    borderLeft: item.speaker === 'contact' ? '2px solid #f87171' : '2px solid #10b981',
                    color: item.speaker === 'contact' ? '#fca5a5' : '#a7f3d0'
                  }}
                >
                  <strong>{item.speaker === 'contact' ? '🗣️ CONTACT' : '💬 YOU'}</strong>
                  <div style={{marginTop: '4px'}}>{item.text}</div>
                </div>
              ))}
            </div>
          </div>

          {/* SAY NOW */}
          <div style={{...styles.card, display: 'flex', flexDirection: 'column', height: 'calc(100vh - 100px)'}}>
            <div style={{fontSize: '12px', fontWeight: '700', color: '#3b82f6', marginBottom: '12px', textTransform: 'uppercase'}}>✨ SAY NOW</div>
            <div style={{flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
              {isGenerating ? (
                <div style={{color: '#64748b'}}>⏳ Listening...</div>
              ) : sayNow ? (
                <div style={{fontSize: '15px', lineHeight: '1.7', color: '#a5d6ff'}}>
                  {sayNow.replace(/^SAY NOW:\s*/i, '').trim()}
                </div>
              ) : (
                <div style={{color: '#64748b'}}>Listen to them</div>
              )}
            </div>
            
            <div style={{display: 'flex', gap: '8px', justifyContent: 'center', paddingTop: '12px', borderTop: '1px solid rgba(51, 65, 85, 0.5)'}}>
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
                  style={{...styles.button, ...styles.buttonDanger}}
                >
                  🎤 LISTEN
                </button>
              )}
              <button
                onClick={endCall}
                style={{...styles.button, ...styles.buttonDanger}}
              >
                📞 END CALL
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // SUMMARY SCREEN (After Call)
  if (screen === 'summary' && callSummary) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <span>✅ CALL SUMMARY</span>
        </div>

        <div style={{...styles.content, maxWidth: '800px', margin: '0 auto'}}>
          <div style={{...styles.card, marginBottom: '16px'}}>
            <div style={{fontSize: '16px', fontWeight: '700', marginBottom: '12px'}}>Call Completed</div>
            <div style={{fontSize: '13px', color: '#cbd5e1', lineHeight: '1.8'}}>
              <div><strong>Supplier:</strong> {supplierProfile?.supplier.company_name}</div>
              <div><strong>Contact:</strong> {supplierProfile?.primary_contact?.name || 'Not specified'}</div>
              <div><strong>Duration:</strong> {callDuration} seconds</div>
              <div><strong>Summary:</strong> {callSummary.summary}</div>
            </div>
          </div>

          <div style={{...styles.card, marginBottom: '16px'}}>
            <div style={{fontSize: '14px', fontWeight: '700', marginBottom: '12px', color: '#10b981'}}>✓ Key Discoveries</div>
            <div style={{fontSize: '13px', color: '#cbd5e1'}}>
              {callSummary.key_discoveries?.map((d, idx) => (
                <div key={idx}>✓ {d}</div>
              )) || <div>None</div>}
            </div>
          </div>

          <div style={{...styles.card, marginBottom: '16px'}}>
            <div style={{fontSize: '14px', fontWeight: '700', marginBottom: '12px', color: '#fca5a5'}}>□ Next Steps</div>
            <div style={{fontSize: '13px', color: '#cbd5e1'}}>
              {callSummary.next_steps?.map((s, idx) => (
                <div key={idx}>→ {s}</div>
              )) || <div>None</div>}
            </div>
          </div>

          <div style={{...styles.card, marginBottom: '16px'}}>
            <div style={{fontSize: '14px', fontWeight: '700', marginBottom: '12px'}}>📅 Follow Up</div>
            <input
              type="date"
              value={followUpDate}
              onChange={(e) => setFollowUpDate(e.target.value)}
              style={{width: '100%', padding: '8px', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px'}}
            />
          </div>

          <div style={{...styles.card, marginBottom: '16px'}}>
            <div style={{fontSize: '14px', fontWeight: '700', marginBottom: '12px'}}>Call Outcome</div>
            <select
              value={callOutcome}
              onChange={(e) => setCallOutcome(e.target.value)}
              style={{width: '100%', padding: '8px', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px'}}
            >
              <option>No Fit</option>
              <option>Follow Up</option>
              <option>Application Sent</option>
              <option>Waiting Approval</option>
              <option>Approved</option>
              <option>Ordering</option>
            </select>
          </div>

          <div style={{display: 'flex', gap: '8px'}}>
            <button
              onClick={finalizeSummary}
              style={{...styles.button, ...styles.buttonPrimary, flex: 1}}
            >
              ✅ SAVE & CLOSE
            </button>
            <button
              onClick={() => setScreen('dashboard')}
              style={{...styles.button, background: '#475569', color: '#fff'}}
            >
              ← Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <div style={styles.container}><div style={styles.header}>Loading...</div></div>;
}
