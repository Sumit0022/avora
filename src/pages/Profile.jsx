import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase';
import { ref, get, update } from 'firebase/database';
import { IoPersonOutline, IoLogOutOutline, IoColorPaletteOutline, IoQrCodeOutline, IoChevronForward, IoCloseOutline } from 'react-icons/io5';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

function Profile() {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  
  const [profile, setProfile] = useState({
    name: '',
    email: '',
    upiId: '',
    theme: localStorage.getItem('avora-theme') || 'light'
  });
  
  const [isUpiModalOpen, setIsUpiModalOpen] = useState(false);
  const [tempUpi, setTempUpi] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!currentUser) return;
    
    const fetchProfile = async () => {
      const snap = await get(ref(db, `users/${currentUser.uid}`));
      if (snap.exists()) {
        const data = snap.val();
        setProfile(prev => ({ 
          ...prev, 
          ...data, 
          // Handle both 'name' and fallback to Google displayName
          name: data.name || data.fullName || currentUser.displayName || 'User',
          email: currentUser.email 
        }));
      }
    };
    fetchProfile();
  }, [currentUser]);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error("Failed to log out", error);
    }
  };

  const toggleTheme = async () => {
    const newTheme = profile.theme === 'light' ? 'dark' : 'light';
    setProfile(prev => ({ ...prev, theme: newTheme }));
    localStorage.setItem('avora-theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  const openUpiModal = () => {
    setTempUpi(profile.upiId || '');
    setMessage('');
    setIsUpiModalOpen(true);
  };

  const saveUpiId = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage('');
    try {
      await update(ref(db, `users/${currentUser.uid}`), {
        upiId: tempUpi,
      });
      setProfile(prev => ({ ...prev, upiId: tempUpi }));
      setIsUpiModalOpen(false);
    } catch (error) {
      console.error(error);
      setMessage('Failed to update UPI ID.');
    }
    setIsSaving(false);
  };

  return (
    <div className="container" style={{ paddingBottom: '100px', maxWidth: '600px', margin: '0 auto' }}>
      
      {/* Premium Header */}
      <div style={{ textAlign: 'center', marginBottom: '30px' }}>
        <div style={{ 
          width: '100px', height: '100px', borderRadius: '50%', background: 'var(--brand-gradient)', 
          display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'white', 
          fontSize: '3rem', fontWeight: 'bold', margin: '0 auto 15px auto',
          boxShadow: '0 10px 30px rgba(0, 113, 227, 0.3)',
          border: '4px solid var(--bg-secondary)'
        }}>
          {profile.name ? profile.name.charAt(0).toUpperCase() : <IoPersonOutline />}
        </div>
        <h2 style={{ fontSize: '1.8rem', fontWeight: 800, margin: '0 0 5px 0' }}>{profile.name}</h2>
        <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.95rem' }}>{profile.email}</p>
      </div>

      <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '15px', paddingLeft: '10px', color: 'var(--text-secondary)' }}>Settings</h3>
      
      {/* iOS Style Settings Block */}
      <div style={{ background: 'var(--bg-secondary)', borderRadius: '24px', overflow: 'hidden', marginBottom: '40px', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border-subtle)' }}>
        
        {/* Manage UPI Row */}
        <motion.div 
          onClick={openUpiModal}
          whileHover={{ backgroundColor: 'var(--bg-glass)' }}
          whileTap={{ backgroundColor: 'var(--border-subtle)' }}
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 20px', cursor: 'pointer', borderBottom: '1px solid var(--border-subtle)' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <div style={{ background: 'rgba(52, 199, 89, 0.1)', padding: '8px', borderRadius: '10px' }}>
              <IoQrCodeOutline size={22} color="var(--success)" />
            </div>
            <div>
              <span style={{ fontSize: '1.05rem', fontWeight: 600, display: 'block' }}>Manage UPI ID</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>{profile.upiId ? 'Configured' : 'Not setup'}</span>
            </div>
          </div>
          <IoChevronForward color="var(--text-tertiary)" size={20} />
        </motion.div>

        {/* Theme Row */}
        <motion.div 
          onClick={toggleTheme}
          whileHover={{ backgroundColor: 'var(--bg-glass)' }}
          whileTap={{ backgroundColor: 'var(--border-subtle)' }}
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 20px', cursor: 'pointer', borderBottom: '1px solid var(--border-subtle)' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <div style={{ background: 'rgba(0, 113, 227, 0.1)', padding: '8px', borderRadius: '10px' }}>
              <IoColorPaletteOutline size={22} color="var(--brand-primary)" />
            </div>
            <span style={{ fontSize: '1.05rem', fontWeight: 600 }}>App Theme</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: 'var(--text-secondary)', textTransform: 'capitalize', fontSize: '0.9rem' }}>{profile.theme}</span>
            <IoChevronForward color="var(--text-tertiary)" size={20} />
          </div>
        </motion.div>

        {/* Logout Row */}
        <motion.div 
          onClick={handleLogout}
          whileHover={{ backgroundColor: 'var(--bg-glass)' }}
          whileTap={{ backgroundColor: 'var(--border-subtle)' }}
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 20px', cursor: 'pointer' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <div style={{ background: 'rgba(255, 59, 48, 0.1)', padding: '8px', borderRadius: '10px' }}>
              <IoLogOutOutline size={22} color="var(--danger)" />
            </div>
            <span style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--danger)' }}>Log Out</span>
          </div>
        </motion.div>
      </div>


      {/* Manage UPI Modal */}
      <AnimatePresence>
        {isUpiModalOpen && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'flex-end' }}>
            <motion.div 
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="panel"
              style={{ width: '100%', maxWidth: '500px', background: 'var(--bg-primary)', padding: '25px', borderRadius: '24px 24px 0 0', paddingBottom: 'env(safe-area-inset-bottom, 40px)' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700 }}>Global UPI ID</h3>
                <button onClick={() => setIsUpiModalOpen(false)} style={{ background: 'var(--bg-secondary)', border: 'none', width: '36px', height: '36px', borderRadius: '18px', display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer', color: 'var(--text-primary)' }}>
                  <IoCloseOutline size={24} />
                </button>
              </div>
              
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '20px' }}>
                Set your UPI ID to receive payments directly from group members when you split bills. This is private and only used for settlements.
              </p>

              <form onSubmit={saveUpiId}>
                <div style={{ marginBottom: '20px' }}>
                  <input 
                    type="text" 
                    value={tempUpi} 
                    onChange={(e) => setTempUpi(e.target.value)} 
                    placeholder="e.g. yourname@okhdfcbank"
                    style={{ width: '100%', padding: '16px', borderRadius: '16px', border: '1px solid var(--brand-primary)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '1rem', outline: 'none', boxShadow: '0 0 0 4px rgba(0, 113, 227, 0.1)' }} 
                  />
                </div>
                
                {message && <div style={{ color: 'var(--danger)', fontSize: '0.9rem', marginBottom: '15px', textAlign: 'center' }}>{message}</div>}

                <button type="submit" disabled={isSaving} className="btn-primary" style={{ width: '100%', padding: '16px', borderRadius: '16px', fontSize: '1.1rem', fontWeight: 700 }}>
                  {isSaving ? 'Saving...' : 'Save UPI ID'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}

export default Profile;
