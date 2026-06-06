import React, { useState, useEffect, useRef } from 'react';

const DEEPGRAM_API_KEY = import.meta.env.VITE_DEEPGRAM_API_KEY;
const API_URL = import.meta.env.VITE_API_URL;

console.log('[DEBUG] API_URL:', API_URL);

export default function LiveCallUI() {
  const [screen, setScreen] = useState('dashboard');
  const [suppliers, setSuppliers] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [supplierProfile, setSupplierProfile] = useState(null);

  const [callActive, setCallActive] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [conversationHistory, setConversationHistory] = useState([]);
  const [sayNow, setSayNow] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const [briefInput, setBriefInput] = useState('');
  const [briefText, setBriefText] = useState('');
  const [callType, setCallType] = useState('distributor_inquiry');

  const [callSummary, setCallSummary] = useState(null);
  const [followUpDate, setFollowUpDate] = useState('');
  const [callOutcome, setCallOutcome] = useState('Follow Up');

  // Load suppliers when screen changes or filter changes
  useEffect(() => {
    if (screen === 'dashboard') {
      loadSuppliers();
    }
  }, [screen, statusFilter]);

  const loadSuppliers = async () => {
    setLoadingSuppliers(true);
    try {
      // Build query with filter
      const query = statusFilter === 'all' ? '' : `?status=${statusFilter}`;
      const url = `${API_URL}/api/suppliers/dashboard${query}`;
      
      console.log('[DEBUG] Loading suppliers...');
      console.log('[DEBUG] Filter:', statusFilter);
      console.log('[DEBUG] URL:', url);

      const response = await fetch(url);
      const data = await response.json();

      console.log('[DEBUG] Response:', data);
      console.log('[DEBUG] Total suppliers returned:', data.suppliers?.length || 0);
      console.log('[DEBUG] Supplier statuses:', data.suppliers?.map(s => ({ name: s.company_name, status: s.relationship_status })));

      setSuppliers(data.suppliers || []);
    } catch (err) {
      console.error('[ERROR] Failed to load suppliers:', err);
      alert('Failed to load suppliers: ' + err.message);
    } finally {
      setLoadingSuppliers(false);
    }
  };

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
    }
  };

  // DASHBOARD SCREEN
  if (screen === 'dashboard') {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <span>📊 SUPPLIER DASHBOARD</span>
          <span>Total: {suppliers.length} suppliers | Filter: {statusFilter}</span>
        </div>
        
        <div style={styles.content}>
          <div style={{ marginBottom: '16px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {['all', 'New', 'Engaged', 'Interested', 'Applied', 'Approved', 'Active'].map(status => (
              <button
                key={status}
                onClick={() => {
                  console.log('[DEBUG] Filter clicked:', status);
                  setStatusFilter(status);
                }}
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
            <div>⏳ Loading suppliers...</div>
          ) : suppliers.length === 0 ? (
            <div style={{...styles.card, color: '#94a3b8'}}>
              No suppliers found for status: {statusFilter}
            </div>
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
                    <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                      Status: {supplier.relationship_status}
                    </div>
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

  return <div style={styles.container}><div style={styles.header}>Loading...</div></div>;
}
