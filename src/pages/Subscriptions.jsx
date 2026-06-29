import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase';
import { ref, onValue, push, update, get } from 'firebase/database';
import { motion, AnimatePresence } from 'framer-motion';
import { IoAddOutline, IoCloseOutline, IoCheckmarkCircleOutline, IoChevronBack } from 'react-icons/io5';
import { useNavigate } from 'react-router-dom';

// Top Indian Subscriptions
const INDIAN_APPS = [
  { id: 'netflix', name: 'Netflix', icon: '🍿', color: '#E50914' },
  { id: 'prime', name: 'Amazon Prime', icon: '📦', color: '#00A8E1' },
  { id: 'hotstar', name: 'Disney+ Hotstar', icon: '🏰', color: '#113CCF' },
  { id: 'spotify', name: 'Spotify', icon: '🎧', color: '#1DB954' },
  { id: 'youtube', name: 'YouTube Premium', icon: '▶️', color: '#FF0000' },
  { id: 'zomato', name: 'Zomato Gold', icon: '🍔', color: '#E23744' },
  { id: 'swiggy', name: 'Swiggy One', icon: '🛵', color: '#FC8019' },
  { id: 'jio', name: 'JioCinema', icon: '🎬', color: '#E60073' },
];

function Subscriptions() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [subscriptions, setSubscriptions] = useState([]);
  const [accounts, setAccounts] = useState([]);
  
  // UI State
  const [isAdding, setIsAdding] = useState(false);
  const [step, setStep] = useState(1); // 1: Type Select, 2: App Select, 3: Details
  const [subType, setSubType] = useState(''); // 'app' or 'other'
  
  // Form State
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('📝');
  const [color, setColor] = useState('var(--brand-primary)');
  const [amount, setAmount] = useState('');
  const [cycle, setCycle] = useState('monthly'); // monthly, yearly
  const [accountId, setAccountId] = useState('');
  const [nextDate, setNextDate] = useState('');

  useEffect(() => {
    if (!currentUser) return;
    
    // Fetch Subscriptions
    const subRef = ref(db, `subscriptions/${currentUser.uid}`);
    const unsubSub = onValue(subRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setSubscriptions(Object.keys(data).map(k => ({ id: k, ...data[k] })));
      } else {
        setSubscriptions([]);
      }
    });

    // Fetch Accounts
    const accRef = ref(db, `accounts/${currentUser.uid}`);
    const unsubAcc = onValue(accRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setAccounts(Object.keys(data).map(k => ({ id: k, ...data[k] })));
        if (Object.keys(data).length > 0) setAccountId(Object.keys(data)[0]);
      }
    });

    return () => {
      unsubSub();
      unsubAcc();
    };
  }, [currentUser]);

  const handleAppSelect = (app) => {
    setName(app.name);
    setIcon(app.icon);
    setColor(app.color);
    setStep(3);
  };

  const resetForm = () => {
    setIsAdding(false);
    setStep(1);
    setSubType('');
    setName('');
    setIcon('📝');
    setColor('var(--brand-primary)');
    setAmount('');
    setNextDate('');
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!name || !amount || !accountId || !nextDate) return toast.error('Fill all details');

    try {
      const newRef = push(ref(db, `subscriptions/${currentUser.uid}`));
      await update(ref(db), {
        [`subscriptions/${currentUser.uid}/${newRef.key}`]: {
          id: newRef.key,
          name,
          icon,
          color,
          amount: Number(amount),
          cycle,
          accountId,
          nextDate,
          isActive: true,
          createdAt: new Date().toISOString()
        }
      });
      resetForm();
    } catch (err) {
      console.error(err);
      toast.error('Failed to save subscription');
    }
  };

  const handleToggleStatus = async (sub) => {
    try {
      await update(ref(db), {
        [`subscriptions/${currentUser.uid}/${sub.id}/isActive`]: !sub.isActive
      });
    } catch (err) {
      console.error(err);
    }
  };

  const totalMonthly = subscriptions
    .filter(s => s.isActive)
    .reduce((acc, curr) => acc + (curr.cycle === 'yearly' ? curr.amount / 12 : curr.amount), 0);

  return (
    <div style={{ backgroundColor: 'var(--bg-primary)', minHeight: '100vh', paddingBottom: '100px' }}>
      {/* Custom Minimal Header */}
      <div style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: 'var(--bg-glass)', backdropFilter: 'blur(10px)', zIndex: 100 }}>
        <button onClick={() => navigate('/dashboard')} style={{ background: 'none', border: 'none', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '1rem', fontWeight: 600, color: 'var(--brand-primary)', cursor: 'pointer' }}>
          <IoChevronBack size={20} /> Home
        </button>
      </div>

      <div className="container" style={{ paddingTop: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
          <h2 style={{ fontSize: '2rem', fontWeight: 800 }}>Subscriptions</h2>
        <button onClick={() => setIsAdding(true)} className="btn-primary" style={{ padding: '10px 20px', borderRadius: '16px', display: 'flex', gap: '5px', alignItems: 'center' }}>
          <IoAddOutline size={20}/> Add New
        </button>
      </div>

      <div className="panel" style={{ padding: '24px', background: 'var(--brand-gradient)', color: 'white', marginBottom: '30px' }}>
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 500, opacity: 0.9 }}>Total Monthly Spends</h3>
        <div style={{ fontSize: '2.5rem', fontWeight: 800, marginTop: '10px' }}>₹{totalMonthly.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
        <p style={{ margin: 0, fontSize: '0.85rem', opacity: 0.8, marginTop: '5px' }}>Assuming yearly plans are divided into 12 months.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
        {subscriptions.map(sub => (
          <motion.div key={sub.id} className="panel" style={{ padding: '20px', opacity: sub.isActive ? 1 : 0.6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <div style={{ width: '50px', height: '50px', borderRadius: '16px', background: `${sub.color}20`, color: sub.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem' }}>
                  {sub.icon}
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.2rem' }}>{sub.name}</h3>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{sub.cycle === 'yearly' ? 'Yearly' : 'Monthly'} • Auto-pay</p>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <h3 style={{ margin: 0, fontSize: '1.2rem' }}>₹{sub.amount.toLocaleString()}</h3>
              </div>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-subtle)', paddingTop: '15px' }}>
              <div>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>Next Billing</span>
                <p style={{ margin: 0, fontWeight: 600, fontSize: '0.95rem' }}>{new Date(sub.nextDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
              </div>
              <button 
                onClick={() => handleToggleStatus(sub)}
                style={{ padding: '6px 12px', borderRadius: '10px', border: 'none', background: sub.isActive ? 'rgba(255, 59, 48, 0.1)' : 'rgba(52, 199, 89, 0.1)', color: sub.isActive ? 'var(--danger)' : 'var(--success)', fontWeight: 600, cursor: 'pointer' }}
              >
                {sub.isActive ? 'Pause' : 'Resume'}
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      {subscriptions.length === 0 && !isAdding && (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-secondary)' }}>
          <div style={{ fontSize: '4rem', marginBottom: '15px' }}>📆</div>
          <h3>No Subscriptions Found</h3>
          <p>Add your Netflix, Gym, or any recurring bills here.</p>
        </div>
      )}

      {/* Add Subscription Flow Modal */}
      <AnimatePresence>
        {isAdding && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 2000, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} style={{ background: 'var(--bg-primary)', padding: '30px', borderRadius: '24px', width: '90%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto' }}>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                <h3 style={{ margin: 0 }}>Add Subscription</h3>
                <IoCloseOutline size={24} style={{ cursor: 'pointer' }} onClick={resetForm} />
              </div>

              {/* STEP 1: App vs Other */}
              {step === 1 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  <p style={{ color: 'var(--text-secondary)', marginBottom: '10px' }}>What kind of subscription are you adding?</p>
                  
                  <div onClick={() => { setSubType('app'); setStep(2); }} className="panel" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '15px', cursor: 'pointer' }}>
                    <div style={{ fontSize: '2rem' }}>📱</div>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '1.1rem' }}>App / Streaming / Tech</h4>
                      <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>Netflix, Spotify, Zomato, etc.</p>
                    </div>
                  </div>

                  <div onClick={() => { setSubType('other'); setStep(3); }} className="panel" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '15px', cursor: 'pointer' }}>
                    <div style={{ fontSize: '2rem' }}>🏋️</div>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '1.1rem' }}>Other Service</h4>
                      <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>Gym, Rent, Maid, Society Maintenance.</p>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 2: App Selection */}
              {step === 2 && (
                <div>
                  <button onClick={() => setStep(1)} style={{ background: 'none', border: 'none', color: 'var(--brand-primary)', marginBottom: '15px', cursor: 'pointer', fontWeight: 600 }}>← Back</button>
                  <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>Select from popular apps:</p>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                    {INDIAN_APPS.map(app => (
                      <div key={app.id} onClick={() => handleAppSelect(app)} className="panel" style={{ padding: '15px', textAlign: 'center', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                        <div style={{ fontSize: '2rem' }}>{app.icon}</div>
                        <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{app.name}</span>
                      </div>
                    ))}
                    <div onClick={() => setStep(3)} className="panel" style={{ padding: '15px', textAlign: 'center', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                      <div style={{ fontSize: '2rem' }}>➕</div>
                      <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Custom App</span>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 3: Final Details */}
              {step === 3 && (
                <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  <button type="button" onClick={() => setStep(subType === 'app' ? 2 : 1)} style={{ background: 'none', border: 'none', color: 'var(--brand-primary)', marginBottom: '5px', cursor: 'pointer', fontWeight: 600, alignSelf: 'flex-start' }}>← Back</button>
                  
                  <div style={{ display: 'flex', gap: '15px' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Name</label>
                      <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="E.g. Cult.fit" required style={{ width: '100%', padding: '15px', borderRadius: '12px', border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }} />
                    </div>
                    <div style={{ width: '80px' }}>
                      <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Emoji</label>
                      <input type="text" value={icon} onChange={e => setIcon(e.target.value)} placeholder="💪" required style={{ width: '100%', padding: '15px', borderRadius: '12px', border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', textAlign: 'center' }} />
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Amount (₹)</label>
                    <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" required style={{ width: '100%', padding: '15px', borderRadius: '12px', border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }} />
                  </div>

                  <div style={{ display: 'flex', gap: '15px' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Billing Cycle</label>
                      <select value={cycle} onChange={e => setCycle(e.target.value)} style={{ width: '100%', padding: '15px', borderRadius: '12px', border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>
                        <option value="monthly">Monthly</option>
                        <option value="yearly">Yearly</option>
                      </select>
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Next Billing Date</label>
                      <input type="date" value={nextDate} onChange={e => setNextDate(e.target.value)} required style={{ width: '100%', padding: '15px', borderRadius: '12px', border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }} />
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Pay From Account (Auto-deduct)</label>
                    <select value={accountId} onChange={e => setAccountId(e.target.value)} required style={{ width: '100%', padding: '15px', borderRadius: '12px', border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>
                      {accounts.map(a => <option key={a.id} value={a.id}>{a.name} (₹{a.balance})</option>)}
                    </select>
                  </div>

                  <button type="submit" className="btn-primary" style={{ padding: '15px', borderRadius: '12px', marginTop: '10px' }}>Save Subscription</button>
                </form>
              )}

            </motion.div>
          </div>
        )}
      </AnimatePresence>
      </div>
    </div>
  );
}

export default Subscriptions;
