import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { IoBackspaceOutline } from 'react-icons/io5';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase';
import { ref, get } from 'firebase/database';

function LockScreen({ isLocked, onUnlock }) {
  const { currentUser } = useAuth();
  const [pin, setPin] = useState('');
  const [savedPin, setSavedPin] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  // Use localStorage as a quick cache to avoid showing the screen while fetching if no pin exists
  useEffect(() => {
    if (!currentUser) return;
    const fetchPin = async () => {
      try {
        const snap = await get(ref(db, `users/${currentUser.uid}/appLockPin`));
        if (snap.exists()) {
          setSavedPin(snap.val());
        } else {
          // If no PIN is configured, unlock immediately
          onUnlock();
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    
    if (isLocked) {
      fetchPin();
    }
  }, [isLocked, currentUser, onUnlock]);

  const handlePress = (digit) => {
    if (pin.length < 4) {
      const newPin = pin + digit;
      setPin(newPin);
      setError('');
      
      if (newPin.length === 4) {
        verifyPin(newPin);
      }
    }
  };

  const handleDelete = () => {
    setPin(pin.slice(0, -1));
    setError('');
  };

  const verifyPin = (enteredPin) => {
    if (enteredPin === savedPin) {
      setTimeout(() => {
        setPin('');
        onUnlock();
      }, 300);
    } else {
      setTimeout(() => {
        setError('Incorrect PIN');
        setPin('');
      }, 300);
    }
  };

  if (!isLocked || !currentUser || loading || !savedPin) return null;

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }}
        style={{ 
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
          background: 'var(--bg-primary)', zIndex: 9999, 
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(20px)'
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{ width: '80px', height: '80px', margin: '0 auto 20px', borderRadius: '24px', background: 'var(--brand-gradient)', display: 'flex', justifyContent: 'center', alignItems: 'center', boxShadow: '0 10px 30px rgba(0, 113, 227, 0.3)' }}>
            <img src="/logo.png" alt="Avora" style={{ width: '40px' }} />
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '10px' }}>Enter PIN to unlock</h2>
          <p style={{ color: 'var(--text-secondary)' }}>Avora is locked for your privacy</p>
        </div>

        <div style={{ display: 'flex', gap: '15px', marginBottom: '40px' }}>
          {[0, 1, 2, 3].map(i => (
            <motion.div 
              key={i} 
              animate={{ 
                backgroundColor: pin.length > i ? 'var(--brand-primary)' : 'var(--bg-secondary)',
                scale: pin.length > i ? 1.1 : 1
              }}
              style={{ 
                width: '18px', height: '18px', borderRadius: '50%', 
                border: `2px solid ${pin.length > i ? 'var(--brand-primary)' : 'var(--border-subtle)'}`,
                transition: 'border-color 0.2s'
              }} 
            />
          ))}
        </div>

        {error && <motion.div initial={{ x: -10 }} animate={{ x: [0, -10, 10, -10, 10, 0] }} transition={{ duration: 0.4 }} style={{ color: 'var(--danger)', marginBottom: '20px', fontWeight: 600 }}>{error}</motion.div>}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', maxWidth: '300px', width: '100%' }}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
            <button 
              key={num} 
              onClick={() => handlePress(num.toString())}
              style={{ 
                width: '75px', height: '75px', borderRadius: '50%', 
                background: 'var(--bg-secondary)', border: 'none', 
                fontSize: '1.8rem', fontWeight: 600, color: 'var(--text-primary)',
                display: 'flex', justifyContent: 'center', alignItems: 'center',
                margin: '0 auto', cursor: 'pointer',
                boxShadow: '0 4px 10px rgba(0,0,0,0.05)'
              }}
            >
              {num}
            </button>
          ))}
          <div /> {/* Empty space for alignment */}
          <button 
            onClick={() => handlePress('0')}
            style={{ 
              width: '75px', height: '75px', borderRadius: '50%', 
              background: 'var(--bg-secondary)', border: 'none', 
              fontSize: '1.8rem', fontWeight: 600, color: 'var(--text-primary)',
              display: 'flex', justifyContent: 'center', alignItems: 'center',
              margin: '0 auto', cursor: 'pointer',
              boxShadow: '0 4px 10px rgba(0,0,0,0.05)'
            }}
          >
            0
          </button>
          <button 
            onClick={handleDelete}
            style={{ 
              width: '75px', height: '75px', borderRadius: '50%', 
              background: 'transparent', border: 'none', 
              fontSize: '1.8rem', color: 'var(--text-secondary)',
              display: 'flex', justifyContent: 'center', alignItems: 'center',
              margin: '0 auto', cursor: 'pointer'
            }}
          >
            <IoBackspaceOutline />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

export default LockScreen;
