import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { IoClose } from 'react-icons/io5';
import { cardColors } from './AccountCard';

function AddAccountModal({ isOpen, onClose, onSave, initialData }) {
  const [formData, setFormData] = useState({
    name: '',
    type: 'Bank',
    balance: '',
    last4Digits: '',
    color: 'blue'
  });

  useEffect(() => {
    if (initialData && isOpen) {
      setFormData({
        ...initialData,
        balance: initialData.balance.toString()
      });
    } else if (isOpen) {
      // Reset form if opening fresh
      setFormData({ name: '', type: 'Bank', balance: '', last4Digits: '', color: 'blue' });
    }
  }, [initialData, isOpen]);

  const accountTypes = ['Bank', 'Cash', 'Credit Card', 'Digital Wallet', 'Investment'];

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name) return;
    if (formData.type !== 'Credit Card' && formData.balance === '') return;
    if (formData.type === 'Credit Card' && (!formData.creditLimit || !formData.billingDate)) return;

    const payload = {
      name: formData.name,
      type: formData.type,
      color: formData.color,
      last4Digits: formData.last4Digits || ''
    };

    if (formData.type === 'Credit Card') {
      payload.balance = 0;
      payload.creditLimit = parseFloat(formData.creditLimit);
      payload.billingDate = parseInt(formData.billingDate);
    } else {
      payload.balance = parseFloat(formData.balance);
    }

    onSave(payload);
  };


  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.4)', backdropFilter: 'blur(4px)',
              zIndex: 1001
            }}
          />
          <motion.div
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            style={{
              position: 'fixed', bottom: 0, left: 0, right: 0,
              backgroundColor: 'var(--bg-primary)',
              borderTopLeftRadius: '32px', borderTopRightRadius: '32px',
              padding: '30px', zIndex: 1002,
              boxShadow: '0 -10px 40px rgba(0,0,0,0.2)',
              maxWidth: '600px', margin: '0 auto',
              maxHeight: '85vh', overflowY: 'auto'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
              <h3 style={{ fontSize: '1.4rem', fontWeight: 700 }}>{initialData ? 'Edit Account' : 'Add New Account'}</h3>
              <button onClick={onClose} style={{ background: 'var(--bg-secondary)', borderRadius: '50%', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '8px', display: 'flex' }}>
                <IoClose size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 500 }}>Account Name</label>
                <input 
                  type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})}
                  placeholder="e.g. HDFC Bank, ICICI Credit" required
                  style={{ width: '100%', padding: '14px', borderRadius: '16px', border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', outline: 'none', fontSize: '1rem' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '15px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 500 }}>Account Type</label>
                  <select 
                    value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})}
                    style={{ width: '100%', padding: '14px', borderRadius: '16px', border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', outline: 'none', fontSize: '1rem', WebkitAppearance: 'none' }}
                  >
                    {accountTypes.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
                
                {(formData.type === 'Bank' || formData.type === 'Credit Card') && (
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 500 }}>Last 4 Digits (Opt)</label>
                    <input 
                      type="text" maxLength="4" value={formData.last4Digits} onChange={e => setFormData({...formData, last4Digits: e.target.value.replace(/\D/g, '')})}
                      placeholder="e.g. 9021"
                      style={{ width: '100%', padding: '14px', borderRadius: '16px', border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', outline: 'none', fontSize: '1rem', fontFamily: 'monospace' }}
                    />
                  </div>
                )}
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 500 }}>Card Color</label>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  {cardColors.map(color => (
                    <button
                      key={color.id}
                      type="button"
                      onClick={() => setFormData({...formData, color: color.id})}
                      style={{
                        width: '45px', height: '45px', borderRadius: '50%',
                        background: color.background, border: 'none', cursor: 'pointer',
                        boxShadow: formData.color === color.id ? '0 0 0 3px var(--bg-primary), 0 0 0 6px var(--brand-primary)' : '0 4px 10px rgba(0,0,0,0.1)',
                        transition: 'all 0.2s ease',
                        transform: formData.color === color.id ? 'scale(1.1)' : 'scale(1)'
                      }}
                    />
                  ))}
                </div>
              </div>

              {formData.type !== 'Credit Card' ? (
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 500 }}>Current Balance</label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', fontSize: '1.2rem', color: 'var(--text-secondary)', fontWeight: 600 }}>₹</span>
                    <input 
                      type="number" value={formData.balance} onChange={e => setFormData({...formData, balance: e.target.value})}
                      placeholder="0.00" required step="0.01"
                      style={{ width: '100%', padding: '16px 16px 16px 40px', borderRadius: '16px', border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', outline: 'none', fontSize: '1.2rem', fontWeight: 600 }}
                    />
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: '15px' }}>
                  <div style={{ flex: 2 }}>
                    <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 500 }}>Credit Limit</label>
                    <div style={{ position: 'relative' }}>
                      <span style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', fontSize: '1.2rem', color: 'var(--text-secondary)', fontWeight: 600 }}>₹</span>
                      <input 
                        type="number" value={formData.creditLimit || ''} onChange={e => setFormData({...formData, creditLimit: e.target.value, balance: '0'})}
                        placeholder="50000" required step="1"
                        style={{ width: '100%', padding: '16px 16px 16px 40px', borderRadius: '16px', border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', outline: 'none', fontSize: '1.2rem', fontWeight: 600 }}
                      />
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 500 }}>Billing Date</label>
                    <input 
                      type="number" value={formData.billingDate || ''} onChange={e => setFormData({...formData, billingDate: e.target.value})}
                      placeholder="e.g. 20" required min="1" max="31" step="1"
                      style={{ width: '100%', padding: '16px', borderRadius: '16px', border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', outline: 'none', fontSize: '1.2rem', fontWeight: 600 }}
                    />
                  </div>
                </div>
              )}

              <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '15px', padding: '16px', fontSize: '1.1rem', borderRadius: '16px', fontWeight: 600 }}>
                Save Account
              </button>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default AddAccountModal;
