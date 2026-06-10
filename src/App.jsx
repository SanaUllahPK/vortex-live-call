import React, { useState, useEffect, useRef } from 'react';
import { Routes, Route, NavLink, useNavigate, useParams } from 'react-router-dom';

const DEEPGRAM_API_KEY = import.meta.env.VITE_DEEPGRAM_API_KEY;

const CALL_TYPES = {
  quick_note: { label: '📝 Quick Note', color: '#64748b' },
  brand_registry: { label: '🏷️ Brand Registry', color: '#f59e0b' },
  retail_inquiry: { label: '🏬 Retail Inquiry', color: '#06b6d4' },
  distributor_inquiry: { label: '🚚 Distributor Inquiry', color: '#8b5cf6' },
  wholesale_inquiry: { label: '📦 Wholesale Inquiry', color: '#10b981' }
};

function CallPage() {
  const [callActive, setCallActive] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [conversationHistory, setConversationHistory] = useState([]);
  const [sayNow, setSayNow] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [briefInput, setBriefInput] = useState('');
  const [companyInput, setCompanyInput] = useState('');

  useEffect(() => {
    const stored = sessionStorage.getItem('selected_supplier');
    const storedSummary = sessionStorage.getItem('selected_supplier_summary');
    if (stored) {
      setCompanyInput(stored);
      sessionStorage.removeItem('selected_supplier');
    }
    if (storedSummary) {
      setBriefInput(storedSummary);
      sessionStorage.removeItem('selected_supplier_summary');
    }
  }, []);
  const [showAddSupplier, setShowAddSupplier] = useState(false);
  const [newSupplier, setNewSupplier] = useState({
    company_name: '',
    website: '',
    supplier_category: '',
    primary_workflow: 'distributor_inquiry',
    relationship_stage: 'Prospect',
    relationship_summary: '',
    contact_name: '',
    contact_email: '',
    contact_phone: '',
    open_questions: [],
    known_objections: [],
    known_restrictions: [],
  });
  const [addingSupplier, setAddingSupplier] = useState(false);
  const [addError, setAddError] = useState('');
  const [briefText, setBriefText] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [supplierDetails, setSupplierDetails] = useState(null);
  const [intelligenceData, setIntelligenceData] = useState(null);
  const [callType, setCallType] = useState('distributor_inquiry');

  // Auto-select callType from supplier's primary_workflow when company is recognized
  React.useEffect(() => {
    if (!companyInput || companyInput.trim().length < 2) return;
    const handle = setTimeout(async () => {
      try {
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
        const resp = await fetch(`${apiUrl}/api/suppliers`);
        const data = await resp.json();
        const found = (data.suppliers || []).find(s =>
          (s.company_name || '').toLowerCase() === companyInput.trim().toLowerCase()
        );
        if (found && found.primary_workflow) {
          setCallType(found.primary_workflow);
        }
      } catch (e) { /* silent */ }
    }, 400);
    return () => clearTimeout(handle);
  }, [companyInput]);
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
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
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
        body: JSON.stringify({ session_id: sessionIdRef.current,
          transcript: text,
          conversationHistory: history,
          companyName: companyName || briefText,
          callType: callTypeSelected,
          brief: briefText
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setSayNow((typeof data.suggested_response === 'object' ? data.suggested_response?.text : data.suggested_response) || data.combined_recommendation?.suggested_discovery_question || '');
        setIntelligenceData(data);
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
    return new Promise((resolve) => {
      const mr = mediaRecorderRef.current;
      if (mr && mr.state === 'recording') {
        // Wait for onstop to finish (Deepgram processing) before resolving
        const originalOnstop = mr.onstop;
        mr.onstop = async (ev) => {
          if (originalOnstop) await originalOnstop(ev);
          resolve();
        };
        mr.stop();
      } else {
        resolve();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      setIsListening(false);
    });
  };

  const handleAddSupplier = async () => {
    if (!newSupplier.company_name.trim()) {
      setAddError('Company name required');
      return;
    }
    setAddingSupplier(true);
    setAddError('');
    try {
      const body = {
        company_name: newSupplier.company_name.trim(),
        website: newSupplier.website.trim() || null,
        supplier_category: newSupplier.supplier_category.trim() || null,
        primary_workflow: newSupplier.primary_workflow || 'distributor_inquiry',
        relationship_stage: newSupplier.relationship_stage,
        relationship_summary: newSupplier.relationship_summary.trim() || null,
        contact_name: newSupplier.contact_name.trim() || null,
        contact_email: newSupplier.contact_email.trim() || null,
        contact_phone: newSupplier.contact_phone.trim() || null,
        primary_workflow: newSupplier.primary_workflow || 'distributor_inquiry',
        open_questions: newSupplier.open_questions
          .filter(q => q.question && q.question.trim())
          .map(q => ({ question: q.question.trim(), priority: q.priority || 'medium' })),
        known_objections: newSupplier.known_objections.filter(s => s && s.trim()).map(s => s.trim()),
        known_restrictions: newSupplier.known_restrictions.filter(s => s && s.trim()).map(s => s.trim()),
      };
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const resp = await fetch(`${apiUrl}/api/suppliers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setAddError(data.error || 'Failed to add supplier');
        setAddingSupplier(false);
        return;
      }
      setCompanyInput(body.company_name);
      setShowAddSupplier(false);
      setNewSupplier({
        company_name: '', website: '', supplier_category: '',
        primary_workflow: 'distributor_inquiry',
        relationship_stage: 'Prospect', relationship_summary: '',
        contact_name: '', contact_email: '', contact_phone: '',
        open_questions: [], known_objections: [], known_restrictions: [],
      });
      setAddingSupplier(false);
    } catch (err) {
      setAddError(err.message);
      setAddingSupplier(false);
    }
  };

  const startCall = () => {
    setBriefText(briefInput);
    setCompanyName(companyInput);
    // Fetch supplier details for context bar
    (async () => {
      try {
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
        const resp = await fetch(`${apiUrl}/api/suppliers`);
        const data = await resp.json();
        const found = (data.suppliers || []).find(s =>
          (s.company_name || '').toLowerCase() === companyInput.trim().toLowerCase()
        );
        if (found) {
          const detResp = await fetch(`${apiUrl}/api/suppliers/${found.id}`);
          const detData = await detResp.json();
          setSupplierDetails(detData.supplier || found);
        }
      } catch (e) { console.error('Failed to load supplier details:', e); }
    })();
    setCallTypeSelected(callType);
    sessionIdRef.current = (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);
    setCallActive(true);
    setCallDuration(0);
    setConversationHistory([]);
    setSayNow('');
  };

  const endCallInFlight = React.useRef(false);
  const sessionIdRef = React.useRef(null);
  const endCall = async () => {
    if (endCallInFlight.current) return;
    endCallInFlight.current = true;

    // Instantly stop mic + close UI (no awaiting)
    if (isListening) {
      try { stopListening(); } catch (e) { /* silent */ }
    }
    setCallActive(false);

    // Snapshot transcript NOW so background submit uses it
    const snapshotHistory = conversationHistory.slice();
    const snapshotCompany = companyName || briefText;
    const snapshotCallType = callTypeSelected;
    const snapshotBrief = briefText;
    const snapshotSessionId = sessionIdRef.current;

    // Background submit — user already moved on
    (async () => {
      // Tiny wait for any in-flight Deepgram final chunk to land
      await new Promise(r => setTimeout(r, 600));
      const fullTranscript = snapshotHistory.map(t => t.text || "").join(" ");
      if (!fullTranscript.trim() || snapshotHistory.length === 0) {
        console.warn("endCall: empty transcript, skipping API call");
        endCallInFlight.current = false;
        return;
      }
      try {
      const fullTranscript = conversationHistory.map(t => t.text || "").join(" ");
      // Skip if transcript is empty (nothing to extract)
      if (!fullTranscript.trim() || conversationHistory.length === 0) {
        console.warn("endCall: empty transcript, skipping API call");
        setCallActive(false);
        endCallInFlight.current = false;
        return;
      }
        await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:3001"}/api/call-end`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            companyName: snapshotCompany,
            callType: snapshotCallType,
            transcript: fullTranscript,
            conversationHistory: snapshotHistory,
            brief: snapshotBrief,
            session_id: snapshotSessionId,
          }),
        });
      } catch (err) {
        console.error("call-end failed:", err);
      }
      endCallInFlight.current = false;
    })();
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
      background: 'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(16,185,129,0.06), transparent), linear-gradient(180deg, #0a0e14 0%, #07090d 100%)',
      color: '#fff',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: "'Inter', -apple-system, sans-serif"
    },
    header: {
      display: 'none'
    },
    mainContent: {
      flex: 1,
      display: 'flex',
      gap: '16px',
      padding: '0',
      overflow: 'hidden',
      minHeight: 0
    },
    setupPanel: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      gap: '16px',
      justifyContent: 'flex-start',
      alignItems: 'center',
      padding: '32px 16px',
      overflow: 'auto'
    },
    setupCard: {
      background: 'linear-gradient(180deg, rgba(22,28,38,0.9), rgba(13,17,23,0.95))',
      border: '1px solid #232d3b',
      borderRadius: '16px',
      padding: '32px 36px',
      maxWidth: '720px',
      width: '100%',
      boxShadow: '0 24px 48px -16px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.04)',
      backdropFilter: 'blur(8px)'
    },
    setupLabel: {
      fontSize: '11px',
      fontWeight: 700,
      color: '#64748b',
      textTransform: 'uppercase',
      marginBottom: '10px',
      marginTop: '4px',
      letterSpacing: '0.6px'
    },
    typeGrid: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '8px',
      marginBottom: '20px'
    },
    typeButton: {
      padding: '13px 15px',
      background: 'rgba(11,15,20,0.8)',
      border: '1px solid #222c3a',
      borderRadius: '10px',
      cursor: 'pointer',
      color: '#b6c2cf',
      textAlign: 'left',
      fontSize: '13px',
      fontWeight: 600,
      transition: 'all 0.15s'
    },
    typeButtonActive: {
      background: 'linear-gradient(180deg, rgba(16,185,129,0.16), rgba(16,185,129,0.08))',
      border: '1px solid rgba(16,185,129,0.7)',
      color: '#34d399',
      boxShadow: '0 0 0 1px rgba(16,185,129,0.25), 0 0 20px rgba(16,185,129,0.12)'
    },
    textarea: {
      width: '100%',
      padding: '11px 12px',
      background: '#0b0f14',
      border: '1px solid #1f2937',
      borderRadius: '6px',
      color: '#e2e8f0',
      fontSize: '13px',
      fontFamily: 'system-ui',
      resize: 'vertical',
      minHeight: '90px',
      marginBottom: '18px',
      boxSizing: 'border-box',
      outline: 'none'
    },
    startButton: {
      width: '100%',
      padding: '15px',
      background: 'linear-gradient(180deg, #14cc94, #0ea372)',
      color: '#04110c',
      border: 'none',
      borderRadius: '12px',
      fontSize: '14px',
      fontWeight: 800,
      cursor: 'pointer',
      letterSpacing: '0.4px',
      boxShadow: '0 8px 24px -8px rgba(16,185,129,0.5), inset 0 1px 0 rgba(255,255,255,0.25)',
      transition: 'all 0.15s'
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
      justifyContent: 'center',
      fontSize: '24px',
      lineHeight: '1.6',
      fontWeight: 500,
      color: '#e2e8f0'
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
        <span></span>
        {/* timer + call type moved to supplier bar */}
      </div>

      <div style={styles.mainContent}>
        {showAddSupplier && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.75)', zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '20px',
          }}>
            <div style={{
              background: '#1a202c', padding: '0', borderRadius: '12px',
              maxWidth: '600px', width: '100%', maxHeight: '90vh',
              border: '1px solid #2d3748', display: 'flex', flexDirection: 'column',
            }}>
              <div style={{padding: '20px 24px', borderBottom: '1px solid #2d3748', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                <h2 style={{color: '#e2e8f0', margin: 0, fontSize: '18px'}}>Add New Supplier</h2>
                <button onClick={() => { setShowAddSupplier(false); setAddError(''); }}
                  style={{background: 'transparent', border: 'none', color: '#a0aec0', fontSize: '22px', cursor: 'pointer', padding: 0, lineHeight: 1}}>×</button>
              </div>

              <div style={{padding: '20px 24px', overflowY: 'auto', flex: 1}}>

                <div style={{color: '#718096', fontSize: '11px', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '12px'}}>Identity</div>
                <div style={{display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px'}}>
                  <div>
                    <label style={{color: '#a0aec0', fontSize: '13px', marginBottom: '4px', display: 'block'}}>Company Name *</label>
                    <input type="text" value={newSupplier.company_name}
                      onChange={(e) => setNewSupplier({...newSupplier, company_name: e.target.value})}
                      placeholder="e.g. ABC Wholesale Supply"
                      style={{...styles.textarea, minHeight: '38px', height: '38px'}}/>
                  </div>
                  <div>
                    <label style={{color: '#a0aec0', fontSize: '13px', marginBottom: '4px', display: 'block'}}>Website</label>
                    <input type="text" value={newSupplier.website}
                      onChange={(e) => setNewSupplier({...newSupplier, website: e.target.value})}
                      placeholder="https://..."
                      style={{...styles.textarea, minHeight: '38px', height: '38px'}}/>
                  </div>
                  <div>
                    <label style={{color: '#a0aec0', fontSize: '13px', marginBottom: '4px', display: 'block'}}>Category</label>
                    <input type="text" value={newSupplier.supplier_category}
                      onChange={(e) => setNewSupplier({...newSupplier, supplier_category: e.target.value})}
                      placeholder="Hair Care, Supplements, Personal Care..."
                      style={{...styles.textarea, minHeight: '38px', height: '38px'}}/>
                  </div>
                  <div>
                    <label style={{color: '#a0aec0', fontSize: '13px', marginBottom: '4px', display: 'block'}}>Primary Workflow *</label>
                    <select value={newSupplier.primary_workflow}
                      onChange={(e) => setNewSupplier({...newSupplier, primary_workflow: e.target.value})}
                      style={{...styles.textarea, minHeight: '38px', height: '38px', cursor: 'pointer'}}>
                      <option value="distributor_inquiry">Distributor Inquiry</option>
                      <option value="brand_registry">Brand Registry</option>
                      <option value="retail_inquiry">Retail Inquiry</option>
                      <option value="quick_note">Quick Note</option>
                      <option value="wholesale_inquiry">Wholesale Inquiry</option>
                    </select>
                    <div style={{color: '#718096', fontSize: '11px', marginTop: '4px'}}>Determines which AI workflow runs on calls with this supplier.</div>
                  </div>
                </div>

                <div style={{color: '#718096', fontSize: '11px', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '12px'}}>Relationship</div>
                <div style={{display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px'}}>
                  <div>
                    <label style={{color: '#a0aec0', fontSize: '13px', marginBottom: '4px', display: 'block'}}>Stage</label>
                    <select value={newSupplier.relationship_stage}
                      onChange={(e) => setNewSupplier({...newSupplier, relationship_stage: e.target.value})}
                      style={{...styles.textarea, minHeight: '38px', height: '38px'}}>
                      <option value="Prospect">Prospect</option>
                      <option value="Contacted">Contacted</option>
                      <option value="In Discussion">In Discussion</option>
                      <option value="Approved">Approved</option>
                      <option value="Active Supplier">Active Supplier</option>
                      <option value="Rejected">Rejected</option>
                    </select>
                  </div>
                  <div>
                    <label style={{color: '#a0aec0', fontSize: '13px', marginBottom: '4px', display: 'block'}}>Relationship Summary</label>
                    <textarea value={newSupplier.relationship_summary}
                      onChange={(e) => setNewSupplier({...newSupplier, relationship_summary: e.target.value})}
                      placeholder="Brief context about this supplier..."
                      style={{...styles.textarea, minHeight: '70px'}}/>
                  </div>
                </div>

                <div style={{color: '#718096', fontSize: '11px', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '12px'}}>Contact</div>
                <div style={{display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px'}}>
                  <div>
                    <label style={{color: '#a0aec0', fontSize: '13px', marginBottom: '4px', display: 'block'}}>Contact Name</label>
                    <input type="text" value={newSupplier.contact_name}
                      onChange={(e) => setNewSupplier({...newSupplier, contact_name: e.target.value})}
                      placeholder="e.g. John Smith"
                      style={{...styles.textarea, minHeight: '38px', height: '38px'}}/>
                  </div>
                  <div>
                    <label style={{color: '#a0aec0', fontSize: '13px', marginBottom: '4px', display: 'block'}}>Contact Email</label>
                    <input type="email" value={newSupplier.contact_email}
                      onChange={(e) => setNewSupplier({...newSupplier, contact_email: e.target.value})}
                      placeholder="john@example.com"
                      style={{...styles.textarea, minHeight: '38px', height: '38px'}}/>
                  </div>
                  <div>
                    <label style={{color: '#a0aec0', fontSize: '13px', marginBottom: '4px', display: 'block'}}>Contact Phone</label>
                    <input type="tel" value={newSupplier.contact_phone}
                      onChange={(e) => setNewSupplier({...newSupplier, contact_phone: e.target.value})}
                      placeholder="+1 555 123 4567"
                      style={{...styles.textarea, minHeight: '38px', height: '38px'}}/>
                  </div>
                </div>

                <div style={{color: '#718096', fontSize: '11px', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '12px'}}>Intelligence</div>

                <div style={{marginBottom: '16px'}}>
                  <label style={{color: '#a0aec0', fontSize: '13px', marginBottom: '6px', display: 'block'}}>Open Questions</label>
                  {newSupplier.open_questions.map((q, i) => (
                    <div key={i} style={{display: 'flex', gap: '6px', marginBottom: '6px'}}>
                      <input type="text" value={q.question}
                        onChange={(e) => { const arr = [...newSupplier.open_questions]; arr[i] = {...arr[i], question: e.target.value}; setNewSupplier({...newSupplier, open_questions: arr}); }}
                        placeholder="e.g. What is your MOQ?"
                        style={{...styles.textarea, minHeight: '36px', height: '36px', flex: 1}}/>
                      <select value={q.priority || 'medium'}
                        onChange={(e) => { const arr = [...newSupplier.open_questions]; arr[i] = {...arr[i], priority: e.target.value}; setNewSupplier({...newSupplier, open_questions: arr}); }}
                        style={{...styles.textarea, minHeight: '36px', height: '36px', width: '90px'}}>
                        <option value="high">High</option>
                        <option value="medium">Med</option>
                        <option value="low">Low</option>
                      </select>
                      <button onClick={() => { const arr = newSupplier.open_questions.filter((_, idx) => idx !== i); setNewSupplier({...newSupplier, open_questions: arr}); }}
                        style={{background: '#2d3748', border: 'none', color: '#fc8181', borderRadius: '6px', width: '36px', cursor: 'pointer'}}>×</button>
                    </div>
                  ))}
                  <button onClick={() => setNewSupplier({...newSupplier, open_questions: [...newSupplier.open_questions, { question: '', priority: 'high' }]})}
                    style={{background: 'transparent', border: '1px dashed #4a5568', color: '#a0aec0', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', marginTop: '4px'}}>+ Add Question</button>
                </div>

                <div style={{marginBottom: '16px'}}>
                  <label style={{color: '#a0aec0', fontSize: '13px', marginBottom: '6px', display: 'block'}}>Known Objections</label>
                  {newSupplier.known_objections.map((o, i) => (
                    <div key={i} style={{display: 'flex', gap: '6px', marginBottom: '6px'}}>
                      <input type="text" value={o}
                        onChange={(e) => { const arr = [...newSupplier.known_objections]; arr[i] = e.target.value; setNewSupplier({...newSupplier, known_objections: arr}); }}
                        placeholder="e.g. Cautious about Amazon resellers"
                        style={{...styles.textarea, minHeight: '36px', height: '36px', flex: 1}}/>
                      <button onClick={() => { const arr = newSupplier.known_objections.filter((_, idx) => idx !== i); setNewSupplier({...newSupplier, known_objections: arr}); }}
                        style={{background: '#2d3748', border: 'none', color: '#fc8181', borderRadius: '6px', width: '36px', cursor: 'pointer'}}>×</button>
                    </div>
                  ))}
                  <button onClick={() => setNewSupplier({...newSupplier, known_objections: [...newSupplier.known_objections, '']})}
                    style={{background: 'transparent', border: '1px dashed #4a5568', color: '#a0aec0', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', marginTop: '4px'}}>+ Add Objection</button>
                </div>

                <div style={{marginBottom: '16px'}}>
                  <label style={{color: '#a0aec0', fontSize: '13px', marginBottom: '6px', display: 'block'}}>Known Restrictions</label>
                  {newSupplier.known_restrictions.map((r, i) => (
                    <div key={i} style={{display: 'flex', gap: '6px', marginBottom: '6px'}}>
                      <input type="text" value={r}
                        onChange={(e) => { const arr = [...newSupplier.known_restrictions]; arr[i] = e.target.value; setNewSupplier({...newSupplier, known_restrictions: arr}); }}
                        placeholder="e.g. MAP policy strictly enforced"
                        style={{...styles.textarea, minHeight: '36px', height: '36px', flex: 1}}/>
                      <button onClick={() => { const arr = newSupplier.known_restrictions.filter((_, idx) => idx !== i); setNewSupplier({...newSupplier, known_restrictions: arr}); }}
                        style={{background: '#2d3748', border: 'none', color: '#fc8181', borderRadius: '6px', width: '36px', cursor: 'pointer'}}>×</button>
                    </div>
                  ))}
                  <button onClick={() => setNewSupplier({...newSupplier, known_restrictions: [...newSupplier.known_restrictions, '']})}
                    style={{background: 'transparent', border: '1px dashed #4a5568', color: '#a0aec0', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', marginTop: '4px'}}>+ Add Restriction</button>
                </div>

                {addError && <div style={{color: '#fc8181', fontSize: '13px', marginTop: '8px'}}>{addError}</div>}
              </div>

              <div style={{padding: '16px 24px', borderTop: '1px solid #2d3748', display: 'flex', gap: '10px'}}>
                <button onClick={() => { setShowAddSupplier(false); setAddError(''); }}
                  style={{flex: 1, padding: '10px', background: '#2d3748', color: '#e2e8f0', border: 'none', borderRadius: '6px', cursor: 'pointer'}}>
                  Cancel
                </button>
                <button onClick={handleAddSupplier} disabled={addingSupplier}
                  style={{flex: 1, padding: '10px', background: addingSupplier ? '#4a5568' : '#38a169', color: 'white', border: 'none', borderRadius: '6px', cursor: addingSupplier ? 'not-allowed' : 'pointer'}}>
                  {addingSupplier ? 'Adding...' : 'Add Supplier'}
                </button>
              </div>
            </div>
          </div>
        )}

        
        {!callActive ? (
          <div style={styles.setupPanel}>
            <div style={styles.setupCard}>
              <div style={{fontSize: '18px', fontWeight: 700, color: '#e2e8f0', marginBottom: '4px'}}>Start a Live Call</div>
              <div style={{fontSize: '13px', color: '#64748b', marginBottom: '24px'}}>Pick a call type, enter the supplier and your focus, then start.</div>
              <div style={styles.setupLabel}>Call Type</div>
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

              <div style={styles.setupLabel}>🏢 Company Name</div>
              <input
                type="text"
                value={companyInput}
                onChange={(e) => setCompanyInput(e.target.value)}
                placeholder="Exact supplier name (e.g. Essential Palace)"
                style={{...styles.textarea, minHeight: '40px', height: '40px'}}
              />


              <div style={styles.setupLabel}>📝 Brief</div>
              <textarea
                value={briefInput}
                onChange={(e) => setBriefInput(e.target.value)}
                placeholder={`Guide the AI before the call starts.

WHAT IS THIS CALL ABOUT?
e.g. "First-touch Brand Registry call. Found their products on Amazon with 6 unauthorized sellers."

WHAT DO YOU ALREADY KNOW?
e.g. "Brand: Apex Beauty Labs, hair care, 20yrs in business, no Brand Registry, multiple resellers, no A+ content."

WHAT TO ASK ABOUT?
e.g. "Confirm they're aware of sellers. Ask about pricing consistency. Probe internal Amazon team."

WHAT TO AVOID?
e.g. "Do not pitch services. Do not mention Brand Registry until they describe a control problem. Do not assume they're the decision maker."

ANY OBSERVATIONS FROM RESEARCH?
e.g. "6 sellers on main ASIN. Lowest at $14.99 vs MSRP $19.99. Listing missing brand story / A+ content."`}
                style={styles.textarea}
              />

              <button
                onClick={startCall}
                disabled={!companyInput.trim() || !briefInput.trim()}
                style={{
                  ...styles.startButton,
                  opacity: (companyInput.trim() && briefInput.trim()) ? 1 : 0.5,
                  cursor: (companyInput.trim() && briefInput.trim()) ? 'pointer' : 'not-allowed'
                }}
              >
                🎤 START CALL
              </button>
            </div>
          </div>
        ) : (
          <div style={{display: 'flex', flexDirection: 'column', gap: '12px', height: '100%', width: '100%', padding: '12px', overflow: 'hidden', boxSizing: 'border-box'}}>
            {supplierDetails && (
              <div style={{
                background: '#0f1419', border: '1px solid #1f2937', borderRadius: '8px',
                padding: '8px 14px', marginBottom: '10px',
                display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap',
                fontSize: '13px', color: '#e2e8f0'
              }}>
                <span style={{fontWeight: 600, fontSize: '14px'}}>{supplierDetails.company_name}</span>
                {supplierDetails.supplier_category && <span style={{color: '#64748b'}}>• {supplierDetails.supplier_category}</span>}
                <span style={{color: '#64748b'}}>•</span>
                <span style={{background: 'rgba(245,158,11,0.15)', color: '#f59e0b', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600}}>{supplierDetails.relationship_stage || 'Prospect'}</span>
                <span style={{color: '#64748b'}}>•</span>
                <span><span style={{color: '#10b981', fontWeight: 700}}>Trust {supplierDetails.trust_score ?? '—'}</span><span style={{color: '#64748b'}}>/10</span></span>
                <span style={{color: '#64748b'}}>•</span>
                <span><span style={{fontWeight: 600}}>{supplierDetails.total_calls_count || 0}</span> <span style={{color: '#64748b'}}>calls</span></span>
                {supplierDetails.contact_name && (<>
                  <span style={{color: '#64748b'}}>•</span>
                  <span>{supplierDetails.contact_name}{supplierDetails.contact_phone ? ` (${supplierDetails.contact_phone})` : ''}</span>
                </>)}
                {callActive && (<>
                  <span style={{marginLeft: 'auto', color: '#10b981', fontFamily: 'monospace', fontSize: '13px', fontWeight: 600}}>{formatTime(callDuration)}</span>
                  <span style={{color: '#64748b'}}>•</span>
                  <span style={{color: '#10b981', fontSize: '12px', fontWeight: 500}}>{CALL_TYPES[callTypeSelected]?.label}</span>
                </>)}
              </div>
            )}
            <div style={{display: 'grid', gridTemplateColumns: '30fr 50fr 20fr', gap: '12px', flex: 1, minHeight: 0}}>
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
              <div style={{minWidth: 0, background: '#0f1419', border: '1px solid #1f2937', borderRadius: '12px', padding: '20px', overflowY: 'auto', height: '100%'}}>
                {intelligenceData && (<>
                  <div style={{fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '14px', fontWeight: 600}}>Intelligence</div>

                  <div style={{marginBottom: '16px'}}>
                    <div style={{fontSize: '11px', color: '#64748b', marginBottom: '4px'}}>Current Stage</div>
                    <div style={{fontSize: '14px', color: '#e2e8f0', fontWeight: 600}}>{intelligenceData.combined_recommendation?.current_assessment?.stage || 'Initial'}</div>
                  </div>

                  <div style={{marginBottom: '16px'}}>
                    <div style={{fontSize: '11px', color: '#64748b', marginBottom: '4px'}}>Confidence</div>
                    <div style={{fontSize: '14px', color: '#10b981', fontWeight: 600}}>{intelligenceData.combined_recommendation?.progression_confidence || 'N/A'}</div>
                  </div>

                  <div style={{marginBottom: '16px'}}>
                    <div style={{fontSize: '11px', color: '#64748b', marginBottom: '4px'}}>Pattern</div>
                    <div style={{fontSize: '14px', color: '#94a3b8'}}>{intelligenceData.message_based_insights?.pattern_match?.best_match || '—'}</div>
                  </div>

                  {(intelligenceData.combined_recommendation?.risk_alerts || []).length > 0 && (
                    <div style={{marginBottom: '16px'}}>
                      <div style={{fontSize: '11px', color: '#fc8181', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px', fontWeight: 600}}>⚠ Risk Flags</div>
                      {intelligenceData.combined_recommendation.risk_alerts.map((r, i) => (
                        <div key={i} style={{fontSize: '12px', color: '#fc8181', background: 'rgba(252,129,129,0.08)', padding: '6px 10px', borderRadius: '6px', marginBottom: '4px'}}>{r}</div>
                      ))}
                    </div>
                  )}

                  {(intelligenceData.combined_recommendation?.positive_indicators || []).length > 0 && (
                    <div style={{marginBottom: '16px'}}>
                      <div style={{fontSize: '11px', color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px', fontWeight: 600}}>✓ Positive Signals</div>
                      {intelligenceData.combined_recommendation.positive_indicators.map((s, i) => (
                        <div key={i} style={{fontSize: '12px', color: '#10b981', background: 'rgba(16,185,129,0.08)', padding: '6px 10px', borderRadius: '6px', marginBottom: '4px'}}>{s}</div>
                      ))}
                    </div>
                  )}

                  {(intelligenceData.memory_based_insights?.known_gaps || []).length > 0 && (
                    <div style={{marginBottom: '16px'}}>
                      <div style={{fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px', fontWeight: 600}}>Open Questions</div>
                      {intelligenceData.memory_based_insights.known_gaps.slice(0, 5).map((g, i) => (
                        <div key={i} style={{fontSize: '12px', color: '#94a3b8', padding: '4px 0', borderBottom: '1px solid #1f2937'}}>□ {g}</div>
                      ))}
                    </div>
                  )}
                </>)}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


const sidebarStyles = {
  container: {
    display: 'flex',
    minHeight: '100vh',
    background: '#0b0f14',
    color: '#e2e8f0',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  sidebar: {
    width: '220px',
    background: '#0f1419',
    borderRight: '1px solid #1f2937',
    padding: '20px 0',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
  },
  logo: {
    padding: '0 20px 24px 20px',
    fontSize: '14px',
    fontWeight: 700,
    letterSpacing: '0.5px',
    color: '#10b981',
    borderBottom: '1px solid #1f2937',
    marginBottom: '12px',
  },
  navLink: (isActive) => ({
    padding: '10px 20px',
    color: isActive ? '#10b981' : '#94a3b8',
    background: isActive ? 'rgba(16,185,129,0.08)' : 'transparent',
    borderLeft: isActive ? '2px solid #10b981' : '2px solid transparent',
    textDecoration: 'none',
    fontSize: '14px',
    fontWeight: isActive ? 600 : 500,
    cursor: 'pointer',
    display: 'block',
  }),
  content: {
    flex: 1,
    overflowY: 'auto',
    minWidth: 0,
  },
};

function Sidebar() {
  return (
    <nav style={sidebarStyles.sidebar}>
      <div style={sidebarStyles.logo}>VORTEX COPILOT</div>
      <NavLink to="/" end style={({isActive}) => sidebarStyles.navLink(isActive)}>Dashboard</NavLink>
      <NavLink to="/suppliers" style={({isActive}) => sidebarStyles.navLink(isActive)}>Suppliers</NavLink>
      <NavLink to="/call" style={({isActive}) => sidebarStyles.navLink(isActive)}>Live Call</NavLink>
      <NavLink to="/follow-ups" style={({isActive}) => sidebarStyles.navLink(isActive)}>Follow-Ups</NavLink>
    </nav>
  );
}

function DashboardPlaceholder() {
  const [kpis, setKpis] = React.useState(null);
  const [recentSuppliers, setRecentSuppliers] = React.useState([]);
  const [pendingFollowUps, setPendingFollowUps] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const navigate = useNavigate();

  React.useEffect(() => {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    Promise.all([
      fetch(`${apiUrl}/api/dashboard/kpis`).then(r => r.json()).catch(() => null),
      fetch(`${apiUrl}/api/suppliers`).then(r => r.json()).catch(() => ({suppliers: []})),
      fetch(`${apiUrl}/api/follow-ups`).then(r => r.json()).catch(() => ({follow_ups: []})),
    ]).then(([kpiData, supData, fuData]) => {
      setKpis(kpiData);
      const sups = (supData.suppliers || []).slice().sort((a, b) => {
        const ad = a.last_call_date ? new Date(a.last_call_date).getTime() : 0;
        const bd = b.last_call_date ? new Date(b.last_call_date).getTime() : 0;
        return bd - ad;
      }).slice(0, 5);
      setRecentSuppliers(sups);
      setPendingFollowUps((fuData.follow_ups || []).slice(0, 5));
      setLoading(false);
    });
  }, []);

  const cardStyle = {
    background: '#0f1419',
    border: '1px solid #1f2937',
    borderRadius: '10px',
    padding: '18px 20px',
  };

  const kpiCardStyle = {
    ...cardStyle,
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  };

  const kpiLabel = {fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600};
  const kpiValue = {fontSize: '28px', fontWeight: 700, color: '#e2e8f0'};

  return (
    <div style={{padding: '24px 28px', color: '#e2e8f0', maxWidth: '1400px'}}>
      <div style={{marginBottom: '24px'}}>
        <h1 style={{margin: 0, fontSize: '22px', fontWeight: 700, color: '#e2e8f0'}}>Dashboard</h1>
        <div style={{fontSize: '13px', color: '#64748b', marginTop: '4px'}}>Overview of your supplier pipeline</div>
      </div>

      {loading ? (
        <div style={{color: '#64748b', padding: '40px 0'}}>Loading...</div>
      ) : (
        <>
          <div style={{display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '24px'}}>
            <div style={kpiCardStyle}>
              <div style={kpiLabel}>Total Suppliers</div>
              <div style={kpiValue}>{kpis?.total_suppliers ?? '—'}</div>
            </div>
            <div style={kpiCardStyle}>
              <div style={kpiLabel}>Active</div>
              <div style={{...kpiValue, color: '#10b981'}}>{kpis?.active_suppliers ?? '—'}</div>
            </div>
            <div style={kpiCardStyle}>
              <div style={kpiLabel}>Pending Follow-Ups</div>
              <div style={{...kpiValue, color: '#f59e0b'}}>{kpis?.pending_follow_ups ?? '—'}</div>
            </div>
            <div style={kpiCardStyle}>
              <div style={kpiLabel}>Calls (7 days)</div>
              <div style={kpiValue}>{kpis?.calls_last_7_days ?? '—'}</div>
            </div>
          </div>

          <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px'}}>
            <div style={cardStyle}>
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px'}}>
                <div style={{fontSize: '13px', fontWeight: 700, color: '#e2e8f0', textTransform: 'uppercase', letterSpacing: '0.5px'}}>Recent Suppliers</div>
                <span onClick={() => navigate('/suppliers')} style={{fontSize: '12px', color: '#10b981', cursor: 'pointer'}}>View all →</span>
              </div>
              {recentSuppliers.length === 0 ? (
                <div style={{color: '#64748b', fontSize: '13px'}}>No suppliers yet.</div>
              ) : recentSuppliers.map(s => (
                <div key={s.id} onClick={() => navigate('/suppliers')} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 0', borderBottom: '1px solid #1f2937', cursor: 'pointer'
                }}>
                  <div>
                    <div style={{fontSize: '14px', color: '#e2e8f0', fontWeight: 500}}>{s.company_name}</div>
                    <div style={{fontSize: '11px', color: '#64748b', marginTop: '2px'}}>{s.supplier_category || '—'} • {s.relationship_stage || 'Prospect'}</div>
                  </div>
                  <div style={{fontSize: '12px', color: '#10b981'}}>{s.total_calls_count || 0} calls</div>
                </div>
              ))}
            </div>

            <div style={cardStyle}>
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px'}}>
                <div style={{fontSize: '13px', fontWeight: 700, color: '#e2e8f0', textTransform: 'uppercase', letterSpacing: '0.5px'}}>Pending Follow-Ups</div>
                <span onClick={() => navigate('/follow-ups')} style={{fontSize: '12px', color: '#10b981', cursor: 'pointer'}}>View all →</span>
              </div>
              {pendingFollowUps.length === 0 ? (
                <div style={{color: '#64748b', fontSize: '13px'}}>Nothing pending. 🎉</div>
              ) : pendingFollowUps.map(f => {
                const due = f.due_date ? new Date(f.due_date) : null;
                const overdue = due && due < new Date();
                return (
                  <div key={f.id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '10px 0', borderBottom: '1px solid #1f2937'
                  }}>
                    <div>
                      <div style={{fontSize: '14px', color: '#e2e8f0', fontWeight: 500}}>{f.supplier_name || f.company_name || 'Supplier'}</div>
                      <div style={{fontSize: '11px', color: '#64748b', marginTop: '2px'}}>{f.note || f.follow_up_type || '—'}</div>
                    </div>
                    <div style={{fontSize: '12px', color: overdue ? '#fc8181' : '#94a3b8'}}>
                      {due ? due.toLocaleDateString() : '—'}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
function SuppliersListPage() {
  const [suppliers, setSuppliers] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [sortBy, setSortBy] = React.useState('company_name');
  const navigate = useNavigate();

  React.useEffect(() => {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    fetch(`${apiUrl}/api/suppliers`)
      .then(r => r.json())
      .then(data => { setSuppliers(data.suppliers || []); setLoading(false); })
      .catch(e => { console.error(e); setLoading(false); });
  }, []);

  const filtered = suppliers.filter(s =>
    !search || s.company_name?.toLowerCase().includes(search.toLowerCase())
  ).sort((a, b) => {
    if (sortBy === 'last_call_date') {
      return (b.last_call_date || '').localeCompare(a.last_call_date || '');
    }
    if (sortBy === 'total_calls_count') {
      return (b.total_calls_count || 0) - (a.total_calls_count || 0);
    }
    if (sortBy === 'trust_score') {
      return (b.trust_score || 0) - (a.trust_score || 0);
    }
    return (a.company_name || '').localeCompare(b.company_name || '');
  });

  const handleRowClick = (supplier) => {
    navigate(`/suppliers/${supplier.id}`);
  };

  const fmtDate = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const stageColor = (stage) => {
    const map = {
      'Prospect': '#64748b',
      'Contacted': '#3b82f6',
      'In Discussion': '#f59e0b',
      'Approved': '#10b981',
      'Active Supplier': '#10b981',
      'Rejected': '#ef4444',
    };
    return map[stage] || '#64748b';
  };

  return (
    <div style={{padding: '32px', color: '#e2e8f0'}}>
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px'}}>
        <div>
          <h1 style={{margin: 0, fontSize: '24px', fontWeight: 600}}>Suppliers</h1>
          <p style={{margin: '4px 0 0 0', color: '#64748b', fontSize: '13px'}}>{filtered.length} of {suppliers.length} suppliers</p>
        </div>
        <div style={{display: 'flex', gap: '12px', alignItems: 'center'}}>
          <input
            type="text"
            placeholder="Search suppliers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              background: '#0f1419', border: '1px solid #1f2937', color: '#e2e8f0',
              borderRadius: '8px', padding: '10px 14px', fontSize: '14px', width: '260px',
            }}
          />
          <button
            onClick={() => navigate('/add-supplier')}
            style={{
              background: '#10b981', color: 'white', border: 'none',
              borderRadius: '8px', padding: '10px 18px', fontSize: '14px', fontWeight: 600,
              cursor: 'pointer',
            }}
          >+ Add Supplier</button>
        </div>
      </div>

      {loading ? (
        <div style={{color: '#64748b', padding: '40px', textAlign: 'center'}}>Loading...</div>
      ) : filtered.length === 0 ? (
        <div style={{color: '#64748b', padding: '40px', textAlign: 'center'}}>
          {search ? 'No suppliers match your search.' : 'No suppliers yet. Add one from Live Call.'}
        </div>
      ) : (
        <div style={{background: '#0f1419', border: '1px solid #1f2937', borderRadius: '12px', overflow: 'hidden'}}>
          <table style={{width: '100%', borderCollapse: 'collapse'}}>
            <thead>
              <tr style={{background: '#0b0f14', borderBottom: '1px solid #1f2937'}}>
                <th onClick={() => setSortBy('company_name')} style={thStyle}>Company</th>
                <th style={thStyle}>Workflow</th>
                <th style={thStyle}>Category</th>
                <th style={thStyle}>Stage</th>
                <th onClick={() => setSortBy('trust_score')} style={thStyle}>Trust</th>
                <th onClick={() => setSortBy('total_calls_count')} style={thStyle}>Calls</th>
                <th onClick={() => setSortBy('last_call_date')} style={thStyle}>Last Call</th>
                <th style={{...thStyle, textAlign: 'right'}}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => {
                const WORKFLOW_BADGE = {
                  brand_registry:    { label: 'BRAND REGISTRY',    color: '#a855f7' },
                  distributor_inquiry: { label: 'DISTRIBUTOR',     color: '#3b82f6' },
                  retail_inquiry:    { label: 'RETAIL',            color: '#f59e0b' },
                  quick_note:        { label: 'QUICK NOTE',        color: '#64748b' },
                  wholesale_inquiry: { label: 'WHOLESALE',         color: '#10b981' },
                };
                const wf = WORKFLOW_BADGE[s.primary_workflow] || WORKFLOW_BADGE.distributor_inquiry;
                const onArchive = async (e) => {
                  e.stopPropagation();
                  if (!window.confirm(`Delete supplier "${s.company_name}"? This action cannot be undone — call history and follow-ups remain attached but the supplier disappears from the list.`)) return;
                  try {
                    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
                    const resp = await fetch(`${apiUrl}/api/suppliers/${s.id}/archive`, { method: 'POST' });
                    if (!resp.ok) {
                      const j = await resp.json().catch(() => ({}));
                      alert('Archive failed: ' + (j.error || resp.status));
                      return;
                    }
                    // Refetch list
                    const list = await fetch(`${apiUrl}/api/suppliers`).then(r => r.json());
                    setSuppliers(list.suppliers || []);
                  } catch (err) {
                    alert('Archive failed: ' + err.message);
                  }
                };
                const onEdit = (e) => {
                  e.stopPropagation();
                  navigate(`/suppliers/${s.id}?edit=1`);
                };
                return (
                <tr key={s.id}
                    onClick={() => handleRowClick(s)}
                    style={{cursor: 'pointer', borderBottom: '1px solid #1f2937'}}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#1a202c'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                  <td style={tdStyle}>
                    <div style={{fontWeight: 600}}>{s.company_name}</div>
                  </td>
                  <td style={tdStyle}>
                    <span style={{
                      background: wf.color + '22', color: wf.color,
                      padding: '3px 8px', borderRadius: '4px', fontSize: '10px',
                      fontWeight: 700, letterSpacing: '0.4px',
                    }}>{wf.label}</span>
                  </td>
                  <td style={{...tdStyle, color: '#94a3b8'}}>{s.supplier_category || '—'}</td>
                  <td style={tdStyle}>
                    <span style={{
                      background: stageColor(s.relationship_stage) + '22',
                      color: stageColor(s.relationship_stage),
                      padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 500,
                    }}>{s.relationship_stage || 'Prospect'}</span>
                  </td>
                  <td style={{...tdStyle, color: '#10b981', fontWeight: 600}}>{s.trust_score ?? '—'}</td>
                  <td style={{...tdStyle, color: '#94a3b8'}}>{s.total_calls_count || 0}</td>
                  <td style={{...tdStyle, color: '#94a3b8'}}>{fmtDate(s.last_call_date)}</td>
                  <td style={{...tdStyle, textAlign: 'right', whiteSpace: 'nowrap'}}>
                    <button onClick={onEdit} style={{
                      padding: '6px 10px', marginRight: '6px',
                      background: '#1f2937', color: '#e2e8f0',
                      border: 'none', borderRadius: '6px', cursor: 'pointer',
                      fontSize: '12px', fontWeight: 500,
                    }}>Edit</button>
                    <button onClick={onArchive} style={{
                      padding: '6px 10px',
                      background: '#dc2626', color: 'white',
                      border: 'none', borderRadius: '6px', cursor: 'pointer',
                      fontSize: '12px', fontWeight: 600,
                    }}>Delete</button>
                  </td>
                </tr>
              );})}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const thStyle = {
  textAlign: 'left', padding: '14px 18px', fontSize: '11px', fontWeight: 600,
  color: '#64748b', letterSpacing: '0.5px', textTransform: 'uppercase', cursor: 'pointer',
};
const tdStyle = {
  padding: '14px 18px', fontSize: '14px', color: '#e2e8f0',
};
function FollowUpsPlaceholder() {
  const [followUps, setFollowUps] = React.useState([]);
  const [suppliers, setSuppliers] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [showAdd, setShowAdd] = React.useState(false);
  const [newFu, setNewFu] = React.useState({supplier_id: '', due_date: '', follow_up_type: 'call', note: ''});
  const [saving, setSaving] = React.useState(false);
  const [err, setErr] = React.useState('');

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';

  const load = React.useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch(`${apiUrl}/api/follow-ups`).then(r => r.json()).catch(() => ({follow_ups: []})),
      fetch(`${apiUrl}/api/suppliers`).then(r => r.json()).catch(() => ({suppliers: []})),
    ]).then(([fu, sup]) => {
      setFollowUps(fu.follow_ups || []);
      setSuppliers(sup.suppliers || []);
      setLoading(false);
    });
  }, [apiUrl]);

  React.useEffect(() => { load(); }, [load]);

  const complete = async (id) => {
    await fetch(`${apiUrl}/api/follow-ups/${id}`, {
      method: 'PATCH',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({status: 'completed'})
    });
    load();
  };

  const create = async () => {
    setErr('');
    if (!newFu.supplier_id || !newFu.due_date) { setErr('Pick a supplier and a date.'); return; }
    setSaving(true);
    const res = await fetch(`${apiUrl}/api/follow-ups`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(newFu)
    });
    setSaving(false);
    if (!res.ok) { const e = await res.json().catch(() => ({})); setErr(e.error || 'Failed'); return; }
    setNewFu({supplier_id: '', due_date: '', follow_up_type: 'call', note: ''});
    setShowAdd(false);
    load();
  };

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(startOfToday.getTime() + 24*60*60*1000);
  const endOfWeek = new Date(startOfToday.getTime() + 7*24*60*60*1000);

  const buckets = {overdue: [], today: [], week: [], later: []};
  followUps.forEach(f => {
    const d = f.due_date ? new Date(f.due_date) : null;
    if (!d) { buckets.later.push(f); return; }
    if (d < startOfToday) buckets.overdue.push(f);
    else if (d < endOfToday) buckets.today.push(f);
    else if (d < endOfWeek) buckets.week.push(f);
    else buckets.later.push(f);
  });

  const cardStyle = {background: '#0f1419', border: '1px solid #1f2937', borderRadius: '10px', padding: '16px 20px', marginBottom: '14px'};
  const sectionTitle = (label, color, count) => (
    <div style={{display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px', marginTop: '20px'}}>
      <span style={{fontSize: '12px', fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.6px'}}>{label}</span>
      <span style={{fontSize: '12px', color: '#64748b'}}>{count}</span>
    </div>
  );

  const renderRow = (f, overdue) => {
    const supplierName = f.supplier_memory?.company_name || 'Supplier';
    const due = f.due_date ? new Date(f.due_date) : null;
    return (
      <div key={f.id} style={{...cardStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px'}}>
        <div style={{flex: 1}}>
          <div style={{fontSize: '14px', fontWeight: 600, color: '#e2e8f0'}}>{supplierName}</div>
          <div style={{fontSize: '12px', color: '#94a3b8', marginTop: '4px'}}>{f.note || f.follow_up_type || 'Follow up'}</div>
        </div>
        <div style={{fontSize: '12px', color: overdue ? '#fc8181' : '#94a3b8', marginRight: '14px', minWidth: '90px', textAlign: 'right'}}>
          {due ? due.toLocaleDateString() : '—'}
        </div>
        <button onClick={() => complete(f.id)} style={{
          background: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)',
          padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer'
        }}>✓ Done</button>
      </div>
    );
  };

  const inputStyle = {width: '100%', padding: '10px 12px', background: '#0b0f14', border: '1px solid #1f2937', borderRadius: '6px', color: '#e2e8f0', fontSize: '13px', boxSizing: 'border-box', outline: 'none', marginBottom: '12px'};

  return (
    <div style={{padding: '24px 28px', color: '#e2e8f0', maxWidth: '1100px'}}>
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
        <div>
          <h1 style={{margin: 0, fontSize: '22px', fontWeight: 700, color: '#e2e8f0'}}>Follow-Ups</h1>
          <div style={{fontSize: '13px', color: '#64748b', marginTop: '4px'}}>What needs your attention</div>
        </div>
        <button onClick={() => setShowAdd(true)} style={{
          background: '#10b981', color: '#0b0f14', border: 'none', padding: '10px 16px',
          borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer'
        }}>+ Add Follow-Up</button>
      </div>

      {showAdd && (
        <div style={{...cardStyle, marginBottom: '20px'}}>
          <div style={{fontSize: '14px', fontWeight: 700, color: '#e2e8f0', marginBottom: '14px'}}>New Follow-Up</div>
          <select value={newFu.supplier_id} onChange={e => setNewFu({...newFu, supplier_id: e.target.value})} style={inputStyle}>
            <option value="">Select supplier...</option>
            {suppliers.map(s => <option key={s.id} value={s.id}>{s.company_name}</option>)}
          </select>
          <input
            type="date"
            value={newFu.due_date}
            onChange={e => setNewFu({...newFu, due_date: e.target.value})}
            onClick={e => e.target.showPicker && e.target.showPicker()}
            onFocus={e => e.target.showPicker && e.target.showPicker()}
            style={{...inputStyle, colorScheme: 'dark', cursor: 'pointer'}}
          />
          <select value={newFu.follow_up_type} onChange={e => setNewFu({...newFu, follow_up_type: e.target.value})} style={inputStyle}>
            <option value="call">Call</option>
            <option value="email">Email</option>
            <option value="meeting">Meeting</option>
            <option value="other">Other</option>
          </select>
          <input type="text" placeholder="Note (optional)" value={newFu.note} onChange={e => setNewFu({...newFu, note: e.target.value})} style={inputStyle} />
          {err && <div style={{color: '#fc8181', fontSize: '12px', marginBottom: '10px'}}>{err}</div>}
          <div style={{display: 'flex', gap: '10px'}}>
            <button onClick={create} disabled={saving} style={{
              background: '#10b981', color: '#0b0f14', border: 'none', padding: '10px 16px',
              borderRadius: '6px', fontSize: '13px', fontWeight: 700, cursor: saving ? 'wait' : 'pointer'
            }}>{saving ? 'Saving...' : 'Save'}</button>
            <button onClick={() => { setShowAdd(false); setErr(''); }} style={{
              background: 'transparent', color: '#94a3b8', border: '1px solid #1f2937',
              padding: '10px 16px', borderRadius: '6px', fontSize: '13px', cursor: 'pointer'
            }}>Cancel</button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{color: '#64748b', padding: '40px 0'}}>Loading...</div>
      ) : followUps.length === 0 ? (
        <div style={{...cardStyle, textAlign: 'center', padding: '40px 20px'}}>
          <div style={{fontSize: '14px', color: '#94a3b8'}}>Nothing pending. 🎉</div>
        </div>
      ) : (
        <>
          {buckets.overdue.length > 0 && <>{sectionTitle('Overdue', '#fc8181', buckets.overdue.length)}{buckets.overdue.map(f => renderRow(f, true))}</>}
          {buckets.today.length > 0 && <>{sectionTitle('Due Today', '#f59e0b', buckets.today.length)}{buckets.today.map(f => renderRow(f, false))}</>}
          {buckets.week.length > 0 && <>{sectionTitle('This Week', '#10b981', buckets.week.length)}{buckets.week.map(f => renderRow(f, false))}</>}
          {buckets.later.length > 0 && <>{sectionTitle('Later', '#94a3b8', buckets.later.length)}{buckets.later.map(f => renderRow(f, false))}</>}
        </>
      )}
    </div>
  );
}


function SupplierProfilePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [supplier, setSupplier] = React.useState(null);
  const [calls, setCalls] = React.useState([]);
  const [followUps, setFollowUps] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [tab, setTab] = React.useState('overview');
  const [editing, setEditing] = React.useState(false);
  const [form, setForm] = React.useState({});
  const [saving, setSaving] = React.useState(false);
  const [err, setErr] = React.useState('');
  const [aiSummary, setAiSummary] = React.useState(null);
  const [aiSummaryLoading, setAiSummaryLoading] = React.useState(false);
  const [stageRec, setStageRec] = React.useState(null);

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';

  const load = React.useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch(`${apiUrl}/api/suppliers/${id}`).then(r => r.json()),
      fetch(`${apiUrl}/api/suppliers/${id}/calls`).then(r => r.json()).catch(() => ({calls: []})),
      fetch(`${apiUrl}/api/suppliers/${id}/follow-ups`).then(r => r.json()).catch(() => ({follow_ups: []})),
    ]).then(([sup, cl, fu]) => {
      if (sup.supplier) {
        setSupplier(sup.supplier);
        setForm({
          company_name: sup.supplier.company_name || '',
          website: sup.supplier.website || '',
          supplier_category: sup.supplier.supplier_category || '',
          relationship_stage: sup.supplier.relationship_stage || 'Prospect',
          relationship_summary: sup.supplier.relationship_summary || '',
          contact_name: sup.supplier.contact_name || '',
          contact_email: sup.supplier.contact_email || '',
          contact_phone: sup.supplier.contact_phone || '',
        });
      }
      setCalls(cl.calls || []);
      setFollowUps(fu.follow_ups || []);
      setLoading(false);
    }).catch(e => { console.error(e); setLoading(false); });
  }, [apiUrl, id]);

  React.useEffect(() => { load(); }, [load]);

  const loadSummary = React.useCallback(async (force = false) => {
    setAiSummaryLoading(true);
    try {
      const url = `${apiUrl}/api/suppliers/${id}/summary${force ? '?refresh=1' : ''}`;
      const r = await fetch(url);
      const d = await r.json();
      // Always store the response (even when fully gated) so empty states can render
      setAiSummary({
        ai_summary: d.ai_summary,
        trust_breakdown: d.trust_breakdown,
        fit_score: d.fit_score,
        updated_at: d.updated_at,
        cached: d.cached,
        evidence: d.evidence || null,
      });
      if (d.stage_recommendation) setStageRec(d.stage_recommendation);
    } catch (e) { console.error('loadSummary error', e); }
    setAiSummaryLoading(false);
  }, [apiUrl, id]);

  React.useEffect(() => { if (supplier?.id) loadSummary(false); }, [supplier?.id, loadSummary]);

  const save = async () => {
    setErr('');
    setSaving(true);
    const res = await fetch(`${apiUrl}/api/suppliers/${id}`, {
      method: 'PATCH',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (!res.ok) { const e = await res.json().catch(() => ({})); setErr(e.error || 'Save failed'); return; }
    setEditing(false);
    load();
  };

  const startCallWith = () => {
    sessionStorage.setItem('selected_supplier', supplier.company_name);
    sessionStorage.setItem('selected_supplier_summary', supplier.relationship_summary || '');
    navigate('/call');
  };

  const cardStyle = {background: '#0f1419', border: '1px solid #1f2937', borderRadius: '10px', padding: '20px'};
  const labelStyle = {fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600, marginBottom: '6px'};
  const inputStyle = {width: '100%', padding: '10px 12px', background: '#0b0f14', border: '1px solid #1f2937', borderRadius: '6px', color: '#e2e8f0', fontSize: '13px', boxSizing: 'border-box', outline: 'none'};
  const tabStyle = (active) => ({
    padding: '10px 18px', cursor: 'pointer', fontSize: '13px', fontWeight: 600,
    color: active ? '#10b981' : '#94a3b8',
    borderBottom: active ? '2px solid #10b981' : '2px solid transparent',
    marginBottom: '-1px',
  });

  if (loading) return <div style={{padding: '40px', color: '#64748b'}}>Loading...</div>;
  if (!supplier) return <div style={{padding: '40px', color: '#fc8181'}}>Supplier not found. <span onClick={() => navigate('/suppliers')} style={{color: '#10b981', cursor: 'pointer'}}>Back to list</span></div>;

  return (
    <div style={{padding: '24px 28px', color: '#e2e8f0', maxWidth: '1200px'}}>
      <div style={{fontSize: '12px', color: '#64748b', marginBottom: '8px', cursor: 'pointer'}} onClick={() => navigate('/suppliers')}>← Back to Suppliers</div>

      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px'}}>
        <div>
          <h1 style={{margin: 0, fontSize: '24px', fontWeight: 700, color: '#e2e8f0'}}>{supplier.company_name}</h1>
          <div style={{fontSize: '13px', color: '#94a3b8', marginTop: '6px', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap'}}>
            {supplier.supplier_category && <span>{supplier.supplier_category}</span>}
            <span style={{background: 'rgba(245,158,11,0.15)', color: '#f59e0b', padding: '3px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: 600}}>{supplier.relationship_stage || 'Prospect'}</span>
            <span style={{color: '#10b981', fontWeight: 600}}>Trust {(supplier.total_calls_count || 0) >= 2 ? `${supplier.trust_score ?? '—'}/10` : '—'}</span>
            <span style={{color: '#64748b'}}>{supplier.total_calls_count || 0} calls</span>
          </div>
        </div>
        <button onClick={startCallWith} style={{
          background: '#10b981', color: '#0b0f14', border: 'none', padding: '10px 18px',
          borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer'
        }}>🎤 Start Call</button>
      </div>

      {/* AI Relationship Summary + Trust/Fit cards */}
      {aiSummary && (
        <div style={{display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '14px', marginBottom: '16px'}}>
          {/* AI Relationship Summary */}
          <div style={cardStyle}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px'}}>
              <div style={{fontSize: '11px', color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.6px', fontWeight: 700}}>🧠 AI Relationship Summary</div>
              <button onClick={() => loadSummary(true)} disabled={aiSummaryLoading} style={{background: 'transparent', border: '1px solid #1f2937', color: '#94a3b8', fontSize: '11px', padding: '3px 8px', borderRadius: '4px', cursor: aiSummaryLoading ? 'wait' : 'pointer'}}>{aiSummaryLoading ? 'Generating...' : '↻ Refresh'}</button>
            </div>
            {aiSummary.evidence && (() => {
              const lvl = aiSummary.evidence.evidence_level;
              const colors = {low: {bg: 'rgba(245,158,11,0.1)', text: '#f59e0b', border: 'rgba(245,158,11,0.3)'}, medium: {bg: 'rgba(59,130,246,0.1)', text: '#3b82f6', border: 'rgba(59,130,246,0.3)'}, high: {bg: 'rgba(16,185,129,0.1)', text: '#10b981', border: 'rgba(16,185,129,0.3)'}};
              const c = colors[lvl] || colors.low;
              return (
                <div style={{display: 'inline-block', background: c.bg, color: c.text, border: `1px solid ${c.border}`, padding: '4px 10px', borderRadius: '4px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px'}}>
                  {lvl} confidence · {aiSummary.evidence.evidence_label}
                </div>
              );
            })()}
            {aiSummary.ai_summary?.relationship_status && (
              <div style={{fontSize: '13px', color: '#cbd5e1', lineHeight: 1.5, marginBottom: '12px', fontStyle: 'italic'}}>{aiSummary.ai_summary.relationship_status}</div>
            )}
            {Array.isArray(aiSummary.ai_summary?.known_facts) && aiSummary.ai_summary.known_facts.length > 0 && (
              <div style={{marginBottom: '10px'}}>
                <div style={{fontSize: '10px', color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 700, marginBottom: '5px'}}>Known Facts</div>
                <ul style={{margin: 0, paddingLeft: '18px', fontSize: '12px', color: '#cbd5e1'}}>{aiSummary.ai_summary.known_facts.map((f,i)=>(<li key={i} style={{marginBottom: '3px'}}>{f}</li>))}</ul>
              </div>
            )}
            {Array.isArray(aiSummary.ai_summary?.known_concerns) && aiSummary.ai_summary.known_concerns.length > 0 && (
              <div style={{marginBottom: '10px'}}>
                <div style={{fontSize: '10px', color: '#fc8181', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 700, marginBottom: '5px'}}>Known Concerns</div>
                <ul style={{margin: 0, paddingLeft: '18px', fontSize: '12px', color: '#cbd5e1'}}>{aiSummary.ai_summary.known_concerns.map((f,i)=>(<li key={i} style={{marginBottom: '3px'}}>{f}</li>))}</ul>
              </div>
            )}
            {Array.isArray(aiSummary.ai_summary?.open_questions) && aiSummary.ai_summary.open_questions.length > 0 && (
              <div style={{marginBottom: '10px'}}>
                <div style={{fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 700, marginBottom: '5px'}}>Open Questions</div>
                <ul style={{margin: 0, paddingLeft: '18px', fontSize: '12px', color: '#94a3b8'}}>{aiSummary.ai_summary.open_questions.map((f,i)=>(<li key={i} style={{marginBottom: '3px'}}>{f}</li>))}</ul>
              </div>
            )}
            {aiSummary.ai_summary?.recommended_next_step && (
              <div style={{marginTop: '10px', padding: '10px 12px', background: 'rgba(16,185,129,0.06)', borderRadius: '6px', border: '1px solid rgba(16,185,129,0.2)'}}>
                <div style={{fontSize: '10px', color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 700, marginBottom: '4px'}}>Recommended Next Step</div>
                <div style={{fontSize: '13px', color: '#e2e8f0', fontWeight: 500}}>{aiSummary.ai_summary.recommended_next_step}</div>
              </div>
            )}
            {aiSummary.updated_at && (
              <div style={{fontSize: '10px', color: '#64748b', marginTop: '12px', textAlign: 'right'}}>Updated {new Date(aiSummary.updated_at).toLocaleString()}</div>
            )}
          </div>

          {/* Trust + Fit Score (with evidence gating) */}
          <div style={{display: 'flex', flexDirection: 'column', gap: '12px'}}>
            {aiSummary.evidence?.gates?.trust === 'gated' ? (
              <div style={{...cardStyle, opacity: 0.7}}>
                <div style={{fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.6px', fontWeight: 700, marginBottom: '10px'}}>Trust Score</div>
                <div style={{fontSize: '28px', fontWeight: 700, color: '#64748b', marginBottom: '6px'}}>—</div>
                <div style={{fontSize: '12px', color: '#94a3b8', fontWeight: 600, marginBottom: '4px'}}>Not Enough Data Yet</div>
                <div style={{fontSize: '11px', color: '#64748b', lineHeight: 1.5}}>{aiSummary.evidence.gate_reasons.trust}</div>
              </div>
            ) : aiSummary.trust_breakdown && (
              <div style={cardStyle}>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '12px'}}>
                  <div style={{fontSize: '11px', color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.6px', fontWeight: 700}}>Trust Score</div>
                  <div style={{fontSize: '22px', fontWeight: 700, color: '#10b981'}}>{aiSummary.trust_breakdown.overall ?? '—'}<span style={{fontSize: '12px', color: '#64748b', fontWeight: 400}}> / 10</span></div>
                </div>
                {['responsiveness','communication','openness','account_potential','restrictions_risk'].map(k => {
                  const v = aiSummary.trust_breakdown[k];
                  if (!v) return null;
                  const pct = (v.score / (v.max || 10)) * 100;
                  return (
                    <div key={k} style={{marginBottom: '8px'}}>
                      <div style={{display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#94a3b8', marginBottom: '3px'}}>
                        <span style={{textTransform: 'capitalize'}}>{k.replace(/_/g, ' ')}</span>
                        <span style={{color: '#e2e8f0', fontWeight: 600}}>{v.score}/{v.max || 10}</span>
                      </div>
                      <div style={{height: '4px', background: '#1f2937', borderRadius: '2px', overflow: 'hidden'}}>
                        <div style={{height: '100%', width: `${pct}%`, background: pct >= 70 ? '#10b981' : pct >= 40 ? '#f59e0b' : '#fc8181'}} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {aiSummary.evidence?.gates?.fit === 'gated' ? (
              <div style={{...cardStyle, opacity: 0.7}}>
                <div style={{fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.6px', fontWeight: 700, marginBottom: '10px'}}>Fit Score</div>
                <div style={{fontSize: '28px', fontWeight: 700, color: '#64748b', marginBottom: '6px'}}>—</div>
                <div style={{fontSize: '12px', color: '#94a3b8', fontWeight: 600, marginBottom: '4px'}}>More Information Required</div>
                <div style={{fontSize: '11px', color: '#64748b', lineHeight: 1.5}}>{aiSummary.evidence.gate_reasons.fit}</div>
              </div>
            ) : aiSummary.fit_score && (
              <div style={cardStyle}>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '12px'}}>
                  <div style={{fontSize: '11px', color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.6px', fontWeight: 700}}>Fit Score</div>
                  <div style={{fontSize: '22px', fontWeight: 700, color: '#10b981'}}>{aiSummary.fit_score.overall ?? '—'}<span style={{fontSize: '12px', color: '#64748b', fontWeight: 400}}> / 100</span></div>
                </div>
                {['moq_compatibility','payment_terms','product_fit','communication_quality','restrictions'].map(k => {
                  const v = aiSummary.fit_score[k];
                  if (!v) return null;
                  const pct = (v.score / (v.max || 25)) * 100;
                  return (
                    <div key={k} style={{marginBottom: '6px'}}>
                      <div style={{display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#94a3b8'}}>
                        <span style={{textTransform: 'capitalize'}}>{k.replace(/_/g, ' ')}</span>
                        <span style={{color: '#e2e8f0', fontWeight: 600}}>{v.score}/{v.max}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Stage Recommendation */}
      {stageRec && stageRec.should_change && (
        <div style={{
          background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)',
          borderRadius: '10px', padding: '12px 16px', marginBottom: '16px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '14px'
        }}>
          <div style={{flex: 1}}>
            <div style={{fontSize: '10px', color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.6px', fontWeight: 700, marginBottom: '4px'}}>📈 Stage Recommendation</div>
            <div style={{fontSize: '13px', color: '#e2e8f0', marginBottom: '3px'}}>Move from <span style={{fontWeight: 700}}>{stageRec.current_stage}</span> → <span style={{fontWeight: 700, color: '#f59e0b'}}>{stageRec.suggested_stage}</span></div>
            <div style={{fontSize: '12px', color: '#94a3b8'}}>{stageRec.reason}</div>
          </div>
          <button onClick={async () => {
            await fetch(`${apiUrl}/api/suppliers/${id}`, {method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({relationship_stage: stageRec.suggested_stage})});
            setStageRec(null);
            load();
          }} style={{background: '#f59e0b', color: '#0b0f14', border: 'none', padding: '8px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: 700, cursor: 'pointer'}}>Apply</button>
        </div>
      )}

      {supplier.next_best_action && supplier.next_best_action.action && (
        <div style={{
          background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.3)',
          borderRadius: '10px', padding: '14px 18px', marginBottom: '18px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px'
        }}>
          <div style={{flex: 1}}>
            <div style={{fontSize: '10px', color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.6px', fontWeight: 700, marginBottom: '6px'}}>⚡ Next Best Action</div>
            <div style={{fontSize: '15px', fontWeight: 600, color: '#e2e8f0', marginBottom: '4px'}}>{supplier.next_best_action.action}</div>
            <div style={{fontSize: '12px', color: '#94a3b8'}}>{supplier.next_best_action.reason}</div>
          </div>
          <div style={{textAlign: 'right'}}>
            <div style={{
              fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px',
              padding: '3px 8px', borderRadius: '4px', display: 'inline-block', marginBottom: '4px',
              background: supplier.next_best_action.priority === 'high' ? 'rgba(252,129,129,0.15)' : supplier.next_best_action.priority === 'low' ? 'rgba(100,116,139,0.15)' : 'rgba(245,158,11,0.15)',
              color: supplier.next_best_action.priority === 'high' ? '#fc8181' : supplier.next_best_action.priority === 'low' ? '#94a3b8' : '#f59e0b',
            }}>{supplier.next_best_action.priority || 'medium'}</div>
            <div style={{fontSize: '11px', color: '#64748b'}}>Due {supplier.next_best_action.due_date ? new Date(supplier.next_best_action.due_date).toLocaleDateString() : '—'}</div>
          </div>
        </div>
      )}

      <div style={{display: 'flex', gap: '4px', borderBottom: '1px solid #1f2937', marginBottom: '20px', flexWrap: 'wrap'}}>
        <div style={tabStyle(tab === 'overview')} onClick={() => setTab('overview')}>Overview</div>
        <div style={tabStyle(tab === 'scorecard')} onClick={() => setTab('scorecard')}>Intelligence Scorecard</div>
        <div style={tabStyle(tab === 'timeline')} onClick={() => setTab('timeline')}>Timeline ({calls.length})</div>
        <div style={tabStyle(tab === 'followups')} onClick={() => setTab('followups')}>Follow-Ups ({followUps.length})</div>
        <div style={tabStyle(tab === 'intel')} onClick={() => setTab('intel')}>Notes</div>
      </div>

      {tab === 'overview' && (
        <div style={cardStyle}>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px'}}>
            <div style={{fontSize: '14px', fontWeight: 700, color: '#e2e8f0'}}>Details</div>
            {!editing ? (
              <button onClick={() => setEditing(true)} style={{background: 'transparent', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)', padding: '6px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer'}}>Edit</button>
            ) : (
              <div style={{display: 'flex', gap: '8px'}}>
                <button onClick={save} disabled={saving} style={{background: '#10b981', color: '#0b0f14', border: 'none', padding: '6px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: 700, cursor: saving ? 'wait' : 'pointer'}}>{saving ? 'Saving...' : 'Save'}</button>
                <button onClick={() => { setEditing(false); setErr(''); load(); }} style={{background: 'transparent', color: '#94a3b8', border: '1px solid #1f2937', padding: '6px 14px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer'}}>Cancel</button>
              </div>
            )}
          </div>
          {err && <div style={{color: '#fc8181', fontSize: '12px', marginBottom: '12px'}}>{err}</div>}

          <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px'}}>
            {[
              ['Company Name', 'company_name', 'text'],
              ['Website', 'website', 'text'],
              ['Category', 'supplier_category', 'text'],
              ['Workflow', 'primary_workflow', 'workflow'],
              ['Stage', 'relationship_stage', 'select'],
              ['Contact Name', 'contact_name', 'text'],
              ['Contact Email', 'contact_email', 'text'],
              ['Contact Phone', 'contact_phone', 'text'],
            ].map(([label, key, type]) => {
              const WORKFLOW_LABELS = {
                brand_registry: 'Brand Registry',
                distributor_inquiry: 'Distributor Inquiry',
                retail_inquiry: 'Retail Inquiry',
                quick_note: 'Quick Note',
                wholesale_inquiry: 'Wholesale Inquiry',
              };
              const renderValue = () => {
                if (type === 'workflow') {
                  return WORKFLOW_LABELS[supplier[key]] || supplier[key] || '—';
                }
                return supplier[key] || '—';
              };
              return (
                <div key={key}>
                  <div style={labelStyle}>{label}</div>
                  {!editing ? (
                    <div style={{fontSize: '13px', color: '#e2e8f0'}}>{renderValue()}</div>
                  ) : type === 'select' ? (
                    <select value={form[key]} onChange={e => setForm({...form, [key]: e.target.value})} style={inputStyle}>
                      {['Prospect','Contacted','In Discussion','Approved','Active Supplier','Rejected'].map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  ) : type === 'workflow' ? (
                    <select value={form[key] || 'distributor_inquiry'} onChange={e => setForm({...form, [key]: e.target.value})} style={inputStyle}>
                      <option value="distributor_inquiry">Distributor Inquiry</option>
                      <option value="brand_registry">Brand Registry</option>
                      <option value="retail_inquiry">Retail Inquiry</option>
                      <option value="quick_note">Quick Note</option>
                      <option value="wholesale_inquiry">Wholesale Inquiry</option>
                    </select>
                  ) : (
                    <input type="text" value={form[key]} onChange={e => setForm({...form, [key]: e.target.value})} style={inputStyle} />
                  )}
                </div>
              );
            })}
            <div style={{gridColumn: '1 / 3'}}>
              <div style={labelStyle}>Relationship Summary</div>
              {!editing ? (
                <div style={{fontSize: '13px', color: '#e2e8f0', whiteSpace: 'pre-wrap'}}>{supplier.relationship_summary || '—'}</div>
              ) : (
                <textarea value={form.relationship_summary} onChange={e => setForm({...form, relationship_summary: e.target.value})} style={{...inputStyle, minHeight: '80px', resize: 'vertical', fontFamily: 'inherit'}} />
              )}
            </div>
          </div>
        </div>
      )}

      {tab === 'calls' && (
        <div style={cardStyle}>
          {calls.length === 0 ? (
            <div style={{color: '#64748b', fontSize: '13px', textAlign: 'center', padding: '20px'}}>No calls logged yet.</div>
          ) : calls.map(c => (
            <div key={c.id} style={{padding: '14px 0', borderBottom: '1px solid #1f2937'}}>
              <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '6px'}}>
                <div style={{fontSize: '13px', fontWeight: 600, color: '#e2e8f0'}}>{c.call_type || 'Call'}</div>
                <div style={{fontSize: '12px', color: '#94a3b8'}}>{c.call_date ? new Date(c.call_date).toLocaleString() : '—'}</div>
              </div>
              {c.transcript_summary && <div style={{fontSize: '12px', color: '#94a3b8', marginTop: '4px'}}>{c.transcript_summary}</div>}
              {c.engagement_pattern && <div style={{fontSize: '11px', color: '#64748b', marginTop: '4px'}}>Pattern: {c.engagement_pattern}</div>}
            </div>
          ))}
        </div>
      )}

      {tab === 'followups' && (
        <div style={{display: 'flex', flexDirection: 'column', gap: '12px'}}>
          {followUps.length === 0 ? (
            <div style={cardStyle}><div style={{color: '#64748b', fontSize: '13px', textAlign: 'center', padding: '20px'}}>No follow-ups for this supplier.</div></div>
          ) : followUps.map(f => (
            <div key={f.id} style={cardStyle}>
              <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '10px'}}>
                <div style={{fontSize: '14px', fontWeight: 600, color: '#e2e8f0'}}>{f.reason || f.note || f.follow_up_type}</div>
                <div style={{fontSize: '12px', color: f.status === 'pending' ? '#f59e0b' : '#94a3b8'}}>
                  {f.due_date ? new Date(f.due_date).toLocaleDateString() : '—'}
                </div>
              </div>
              {f.context && <div style={{fontSize: '12px', color: '#94a3b8', marginBottom: '10px', lineHeight: 1.5}}>{f.context}</div>}
              {f.suggested_message && (
                <div style={{background: '#0b0f14', border: '1px solid #1f2937', borderRadius: '6px', padding: '10px 12px', marginTop: '8px'}}>
                  <div style={{fontSize: '10px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600, marginBottom: '6px'}}>Suggested Message</div>
                  <div style={{fontSize: '13px', color: '#cbd5e1', lineHeight: 1.5, fontStyle: 'italic'}}>"{f.suggested_message}"</div>
                </div>
              )}
              <div style={{fontSize: '11px', color: '#64748b', marginTop: '8px'}}>Status: {f.status}</div>
            </div>
          ))}
        </div>
      )}

      {tab === 'scorecard' && (() => {
        const sc = supplier.intelligence_scorecard || {};
        const SECTIONS = [
          ['Account Requirements', 'account_requirements', [
            ['reseller_certificate_required', 'Reseller Certificate'],
            ['ein_required', 'EIN'],
            ['credit_application_required', 'Credit Application'],
            ['wholesale_agreement_required', 'Wholesale Agreement'],
            ['references_required', 'References'],
          ]],
          ['Commercial Terms', 'commercial_terms', [
            ['moq', 'MOQ'],
            ['reorder_minimum', 'Reorder Minimum'],
            ['payment_terms', 'Payment Terms'],
            ['net_terms', 'Net Terms'],
            ['freight_terms', 'Freight Terms'],
            ['approval_timeline', 'Approval Timeline'],
          ]],
          ['Product Information', 'product_information', [
            ['product_categories', 'Product Categories'],
            ['key_brands', 'Key Brands'],
            ['fast_growing_categories', 'Fast-Growing Categories'],
            ['focus_segments', 'Focus Segments'],
          ]],
          ['Restrictions', 'restrictions', [
            ['marketplace_restrictions', 'Marketplace'],
            ['brand_restrictions', 'Brand'],
            ['geographic_restrictions', 'Geographic'],
            ['dealer_requirements', 'Dealer Requirements'],
          ]],
          ['Opportunities', 'opportunities', [
            ['categories_of_interest', 'Categories of Interest'],
            ['expansion_opportunities', 'Expansion Opportunities'],
            ['high_potential_brands', 'High Potential Brands'],
          ]],
        ];
        const confBadge = (conf) => {
          if (!conf) return null;
          const colors = {high: '#10b981', medium: '#f59e0b', low: '#94a3b8'};
          return <span style={{fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', color: colors[conf] || '#94a3b8', marginLeft: '6px', letterSpacing: '0.4px'}}>{conf}</span>;
        };
        const renderValue = (raw) => {
          // Support both legacy plain values AND new {value, confidence} shape
          const isObj = raw && typeof raw === 'object' && !Array.isArray(raw) && 'value' in raw;
          const val = isObj ? raw.value : raw;
          const conf = isObj ? raw.confidence : null;
          if (val === null || val === undefined || val === '') return <span style={{color: '#64748b', fontSize: '12px'}}>—</span>;
          if (typeof val === 'boolean') return <span style={{color: val ? '#10b981' : '#94a3b8', fontWeight: 600, fontSize: '13px'}}>{val ? 'Yes' : 'No'}{confBadge(conf)}</span>;
          if (Array.isArray(val)) {
            if (val.length === 0) return <span style={{color: '#64748b', fontSize: '12px'}}>—</span>;
            return <div><div style={{display: 'flex', flexWrap: 'wrap', gap: '4px'}}>{val.map((v, i) => <span key={i} style={{fontSize: '11px', background: '#1f2937', color: '#e2e8f0', padding: '2px 8px', borderRadius: '4px'}}>{v}</span>)}</div>{conf && <div style={{marginTop: '4px'}}>{confBadge(conf)}</div>}</div>;
          }
          return <span style={{color: '#e2e8f0', fontSize: '13px'}}>{val}{confBadge(conf)}</span>;
        };
        const isEmpty = Object.keys(sc).length === 0 || SECTIONS.every(([,key]) => !sc[key] || Object.keys(sc[key]).length === 0);
        if (isEmpty) {
          return <div style={cardStyle}><div style={{color: '#64748b', fontSize: '13px', textAlign: 'center', padding: '20px'}}>No intelligence captured yet. Complete a call to start building the scorecard.</div></div>;
        }
        return (
          <div style={{display: 'flex', flexDirection: 'column', gap: '14px'}}>
            {SECTIONS.map(([label, key, fields]) => {
              const section = sc[key] || {};
              const hasAny = fields.some(([f]) => section[f] !== undefined && section[f] !== null && section[f] !== '');
              if (!hasAny) return null;
              return (
                <div key={key} style={cardStyle}>
                  <div style={{...labelStyle, marginBottom: '14px', color: '#10b981'}}>{label}</div>
                  <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px'}}>
                    {fields.map(([f, flabel]) => (
                      <div key={f}>
                        <div style={{fontSize: '11px', color: '#64748b', marginBottom: '4px'}}>{flabel}</div>
                        {renderValue(section[f])}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}

      {tab === 'timeline' && (
        <div style={{display: 'flex', flexDirection: 'column', gap: '12px'}}>
          {calls.length === 0 ? (
            <div style={cardStyle}><div style={{color: '#64748b', fontSize: '13px', textAlign: 'center', padding: '20px'}}>No calls yet.</div></div>
          ) : calls.map((c, idx) => (
            <div key={c.id} style={{...cardStyle, borderLeft: '3px solid #10b981'}}>
              <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '10px'}}>
                <div>
                  <div style={{fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600}}>Call #{calls.length - idx} • {c.call_type || 'Call'}</div>
                  <div style={{fontSize: '15px', fontWeight: 700, color: '#e2e8f0', marginTop: '4px'}}>{c.call_date ? new Date(c.call_date).toLocaleDateString(undefined, {month: 'long', day: 'numeric', year: 'numeric'}) : '—'}</div>
                </div>
                {c.outcome && <span style={{fontSize: '11px', background: 'rgba(16,185,129,0.15)', color: '#10b981', padding: '4px 10px', borderRadius: '4px', fontWeight: 600, alignSelf: 'flex-start'}}>{c.outcome}</span>}
              </div>
              {c.call_summary && <div style={{fontSize: '13px', color: '#cbd5e1', marginBottom: '10px', lineHeight: 1.5}}>{c.call_summary}</div>}
              {Array.isArray(c.key_learnings) && c.key_learnings.length > 0 && (
                <div>
                  <div style={{fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600, marginBottom: '6px'}}>Key Learnings</div>
                  <ul style={{margin: 0, paddingLeft: '18px', color: '#94a3b8', fontSize: '13px'}}>
                    {c.key_learnings.map((l, i) => <li key={i} style={{marginBottom: '4px'}}>{typeof l === 'string' ? l : JSON.stringify(l)}</li>)}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === 'intel' && (
        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px'}}>
          {[
            ['Open Questions', 'open_questions', '#94a3b8'],
            ['Known Objections', 'known_objections', '#fc8181'],
            ['Restrictions', 'known_restrictions', '#f59e0b'],
          ].map(([label, key, color]) => {
            const items = supplier[key] || [];
            return (
              <div key={key} style={cardStyle}>
                <div style={{...labelStyle, color, marginBottom: '12px'}}>{label}</div>
                {(!items || items.length === 0) ? (
                  <div style={{fontSize: '12px', color: '#64748b'}}>None</div>
                ) : items.map((item, i) => (
                  <div key={i} style={{fontSize: '13px', color: '#e2e8f0', padding: '6px 0', borderBottom: i < items.length - 1 ? '1px solid #1f2937' : 'none'}}>
                    {typeof item === 'string' ? item : (item.text || item.question || JSON.stringify(item))}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AddSupplierPage() {
  const [newSupplier, setNewSupplier] = React.useState({
    company_name: '',
    website: '',
    supplier_category: '',
    primary_workflow: 'distributor_inquiry',
    relationship_stage: 'Prospect',
    relationship_summary: '',
    contact_name: '',
    contact_email: '',
    contact_phone: '',
    open_questions: [],
    known_objections: [],
    known_restrictions: [],
  });
  const [adding, setAdding] = React.useState(false);
  const [error, setError] = React.useState('');
  const [success, setSuccess] = React.useState('');
  const navigate = useNavigate();

  const submit = async () => {
    if (!newSupplier.company_name.trim()) {
      setError('Company name required');
      return;
    }
    setAdding(true); setError(''); setSuccess('');
    try {
      const body = {
        company_name: newSupplier.company_name.trim(),
        website: newSupplier.website.trim() || null,
        supplier_category: newSupplier.supplier_category.trim() || null,
        relationship_stage: newSupplier.relationship_stage,
        relationship_summary: newSupplier.relationship_summary.trim() || null,
        contact_name: newSupplier.contact_name.trim() || null,
        contact_email: newSupplier.contact_email.trim() || null,
        contact_phone: newSupplier.contact_phone.trim() || null,
        open_questions: newSupplier.open_questions
          .filter(q => q.question && q.question.trim())
          .map(q => ({ question: q.question.trim(), priority: q.priority || 'medium' })),
        known_objections: newSupplier.known_objections.filter(s => s && s.trim()).map(s => s.trim()),
        known_restrictions: newSupplier.known_restrictions.filter(s => s && s.trim()).map(s => s.trim()),
      };
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const resp = await fetch(`${apiUrl}/api/suppliers`, {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(body),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setError(data.error || 'Failed to add supplier');
        setAdding(false); return;
      }
      setSuccess(`${body.company_name} added successfully.`);
      setAdding(false);
      setTimeout(() => navigate('/suppliers'), 1200);
    } catch (e) {
      setError(e.message); setAdding(false);
    }
  };

  const inputStyle = {
    background: '#0f1419', border: '1px solid #1f2937', color: '#e2e8f0',
    borderRadius: '8px', padding: '10px 14px', fontSize: '14px', width: '100%',
    boxSizing: 'border-box',
  };
  const labelStyle = {color: '#94a3b8', fontSize: '13px', marginBottom: '6px', display: 'block'};
  const sectionTitle = {color: '#64748b', fontSize: '11px', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '14px', marginTop: '24px'};

  return (
    <div style={{padding: '32px', color: '#e2e8f0', maxWidth: '720px'}}>
      <h1 style={{margin: '0 0 4px 0', fontSize: '24px', fontWeight: 600}}>Add Supplier</h1>
      <p style={{margin: '0 0 24px 0', color: '#64748b', fontSize: '13px'}}>Add a new supplier to your CRM. All fields except Company Name are optional.</p>

      <div style={sectionTitle}>Identity</div>
      <div style={{display: 'flex', flexDirection: 'column', gap: '12px'}}>
        <div>
          <label style={labelStyle}>Company Name *</label>
          <input type="text" value={newSupplier.company_name} onChange={(e) => setNewSupplier({...newSupplier, company_name: e.target.value})} placeholder="e.g. ABC Wholesale Supply" style={inputStyle}/>
        </div>
        <div>
          <label style={labelStyle}>Website</label>
          <input type="text" value={newSupplier.website} onChange={(e) => setNewSupplier({...newSupplier, website: e.target.value})} placeholder="https://..." style={inputStyle}/>
        </div>
        <div>
          <label style={labelStyle}>Category</label>
          <input type="text" value={newSupplier.supplier_category} onChange={(e) => setNewSupplier({...newSupplier, supplier_category: e.target.value})} placeholder="Hair Care, Supplements, Personal Care..." style={inputStyle}/>
        </div>
        <div>
          <label style={labelStyle}>Primary Workflow *</label>
          <select value={newSupplier.primary_workflow} onChange={(e) => setNewSupplier({...newSupplier, primary_workflow: e.target.value})} style={inputStyle}>
            <option value="distributor_inquiry">Distributor Inquiry</option>
            <option value="brand_registry">Brand Registry</option>
            <option value="retail_inquiry">Retail Inquiry</option>
            <option value="quick_note">Quick Note</option>
            <option value="wholesale_inquiry">Wholesale Inquiry</option>
          </select>
          <div style={{color: '#64748b', fontSize: '11px', marginTop: '4px'}}>Determines which AI workflow runs on calls with this supplier.</div>
        </div>
      </div>

      <div style={sectionTitle}>Relationship</div>
      <div style={{display: 'flex', flexDirection: 'column', gap: '12px'}}>
        <div>
          <label style={labelStyle}>Stage</label>
          <select value={newSupplier.relationship_stage} onChange={(e) => setNewSupplier({...newSupplier, relationship_stage: e.target.value})} style={inputStyle}>
            <option value="Prospect">Prospect</option>
            <option value="Contacted">Contacted</option>
            <option value="In Discussion">In Discussion</option>
            <option value="Approved">Approved</option>
            <option value="Active Supplier">Active Supplier</option>
            <option value="Rejected">Rejected</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>Relationship Summary</label>
          <textarea value={newSupplier.relationship_summary} onChange={(e) => setNewSupplier({...newSupplier, relationship_summary: e.target.value})} placeholder="Brief context about this supplier. This pre-fills the Brief on Live Call." style={{...inputStyle, minHeight: '90px', resize: 'vertical'}}/>
        </div>
      </div>

      <div style={sectionTitle}>Contact</div>
      <div style={{display: 'flex', flexDirection: 'column', gap: '12px'}}>
        <div><label style={labelStyle}>Contact Name</label><input type="text" value={newSupplier.contact_name} onChange={(e) => setNewSupplier({...newSupplier, contact_name: e.target.value})} placeholder="e.g. John Smith" style={inputStyle}/></div>
        <div><label style={labelStyle}>Contact Email</label><input type="email" value={newSupplier.contact_email} onChange={(e) => setNewSupplier({...newSupplier, contact_email: e.target.value})} placeholder="john@example.com" style={inputStyle}/></div>
        <div><label style={labelStyle}>Contact Phone</label><input type="tel" value={newSupplier.contact_phone} onChange={(e) => setNewSupplier({...newSupplier, contact_phone: e.target.value})} placeholder="+1 555 123 4567" style={inputStyle}/></div>
      </div>

      <div style={sectionTitle}>Intelligence</div>

      <div style={{marginBottom: '16px'}}>
        <label style={labelStyle}>Open Questions</label>
        {newSupplier.open_questions.map((q, i) => (
          <div key={i} style={{display: 'flex', gap: '6px', marginBottom: '6px'}}>
            <input type="text" value={q.question} onChange={(e) => { const arr = [...newSupplier.open_questions]; arr[i] = {...arr[i], question: e.target.value}; setNewSupplier({...newSupplier, open_questions: arr}); }} placeholder="e.g. What is your MOQ?" style={{...inputStyle, flex: 1}}/>
            <select value={q.priority || 'medium'} onChange={(e) => { const arr = [...newSupplier.open_questions]; arr[i] = {...arr[i], priority: e.target.value}; setNewSupplier({...newSupplier, open_questions: arr}); }} style={{...inputStyle, width: '90px'}}>
              <option value="high">High</option><option value="medium">Med</option><option value="low">Low</option>
            </select>
            <button onClick={() => { const arr = newSupplier.open_questions.filter((_, idx) => idx !== i); setNewSupplier({...newSupplier, open_questions: arr}); }} style={{background: '#1f2937', border: 'none', color: '#fc8181', borderRadius: '8px', width: '40px', cursor: 'pointer'}}>×</button>
          </div>
        ))}
        <button onClick={() => setNewSupplier({...newSupplier, open_questions: [...newSupplier.open_questions, { question: '', priority: 'high' }]})} style={{background: 'transparent', border: '1px dashed #1f2937', color: '#94a3b8', padding: '8px 14px', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', marginTop: '4px'}}>+ Add Question</button>
      </div>

      <div style={{marginBottom: '16px'}}>
        <label style={labelStyle}>Known Objections</label>
        {newSupplier.known_objections.map((o, i) => (
          <div key={i} style={{display: 'flex', gap: '6px', marginBottom: '6px'}}>
            <input type="text" value={o} onChange={(e) => { const arr = [...newSupplier.known_objections]; arr[i] = e.target.value; setNewSupplier({...newSupplier, known_objections: arr}); }} placeholder="e.g. Cautious about Amazon resellers" style={{...inputStyle, flex: 1}}/>
            <button onClick={() => { const arr = newSupplier.known_objections.filter((_, idx) => idx !== i); setNewSupplier({...newSupplier, known_objections: arr}); }} style={{background: '#1f2937', border: 'none', color: '#fc8181', borderRadius: '8px', width: '40px', cursor: 'pointer'}}>×</button>
          </div>
        ))}
        <button onClick={() => setNewSupplier({...newSupplier, known_objections: [...newSupplier.known_objections, '']})} style={{background: 'transparent', border: '1px dashed #1f2937', color: '#94a3b8', padding: '8px 14px', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', marginTop: '4px'}}>+ Add Objection</button>
      </div>

      <div style={{marginBottom: '16px'}}>
        <label style={labelStyle}>Known Restrictions</label>
        {newSupplier.known_restrictions.map((r, i) => (
          <div key={i} style={{display: 'flex', gap: '6px', marginBottom: '6px'}}>
            <input type="text" value={r} onChange={(e) => { const arr = [...newSupplier.known_restrictions]; arr[i] = e.target.value; setNewSupplier({...newSupplier, known_restrictions: arr}); }} placeholder="e.g. MAP policy strictly enforced" style={{...inputStyle, flex: 1}}/>
            <button onClick={() => { const arr = newSupplier.known_restrictions.filter((_, idx) => idx !== i); setNewSupplier({...newSupplier, known_restrictions: arr}); }} style={{background: '#1f2937', border: 'none', color: '#fc8181', borderRadius: '8px', width: '40px', cursor: 'pointer'}}>×</button>
          </div>
        ))}
        <button onClick={() => setNewSupplier({...newSupplier, known_restrictions: [...newSupplier.known_restrictions, '']})} style={{background: 'transparent', border: '1px dashed #1f2937', color: '#94a3b8', padding: '8px 14px', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', marginTop: '4px'}}>+ Add Restriction</button>
      </div>

      {error && <div style={{color: '#fc8181', fontSize: '14px', marginTop: '16px', padding: '12px', background: 'rgba(252,129,129,0.08)', borderRadius: '8px'}}>{error}</div>}
      {success && <div style={{color: '#10b981', fontSize: '14px', marginTop: '16px', padding: '12px', background: 'rgba(16,185,129,0.08)', borderRadius: '8px'}}>{success}</div>}

      <div style={{display: 'flex', gap: '12px', marginTop: '24px', paddingTop: '24px', borderTop: '1px solid #1f2937'}}>
        <button onClick={() => navigate('/suppliers')} style={{padding: '12px 24px', background: '#1f2937', color: '#e2e8f0', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 500}}>Cancel</button>
        <button onClick={submit} disabled={adding} style={{padding: '12px 24px', background: adding ? '#374151' : '#10b981', color: 'white', border: 'none', borderRadius: '8px', cursor: adding ? 'not-allowed' : 'pointer', fontSize: '14px', fontWeight: 600, flex: 1}}>{adding ? 'Adding...' : 'Add Supplier'}</button>
      </div>
    </div>
  );
}

export default function AppShell() {
  return (
    <div style={sidebarStyles.container}>
      <Sidebar />
      <div style={sidebarStyles.content}>
        <Routes>
          <Route path="/" element={<DashboardPlaceholder />} />
          <Route path="/suppliers" element={<SuppliersListPage />} />
          <Route path="/suppliers/:id" element={<SupplierProfilePage />} />
          <Route path="/add-supplier" element={<AddSupplierPage />} />
          <Route path="/call" element={<CallPage />} />
          <Route path="/follow-ups" element={<FollowUpsPlaceholder />} />
        </Routes>
      </div>
    </div>
  );
}
