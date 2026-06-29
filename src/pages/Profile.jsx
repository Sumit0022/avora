import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase';
import { ref, get, update } from 'firebase/database';
import { IoPersonOutline, IoMailOutline, IoLogOutOutline, IoColorPaletteOutline, IoQrCodeOutline, IoChevronForward } from 'react-icons/io5';
import { motion } from 'framer-motion';
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
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!currentUser) return;
    
    const fetchProfile = async () => {
      const snap = await get(ref(db, `users/${currentUser.uid}`));
      if (snap.exists()) {
        setProfile(prev => ({ ...prev, ...snap.val(), email: currentUser.email }));
      }
    };
    fetchProfile();
  }, [currentUser]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setProfile(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage('');
    try {
      await update(ref(db, `users/${currentUser.uid}`), {
        name: profile.name,
        upiId: profile.upiId,
      });
      setMessage('Profile updated successfully!');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error(error);
      setMessage('Failed to update profile.');
    }
    setIsSaving(false);
  };

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

  return (
    <div className="container" style={{ paddingBottom: '100px', maxWidth: '600px', margin: '0 auto' }}>
      <h2 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '30px' }}>Profile Settings</h2>

      <div style={{ background: 'var(--bg-secondary)', borderRadius: '24px', padding: '20px', marginBottom: '30px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '20px' }}>
          <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'var(--brand-gradient)', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'white', fontSize: '2rem', fontWeight: 'bold' }}>
            {profile.name ? profile.name.charAt(0).toUpperCase() : <IoPersonOutline />}
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.4rem' }}>{profile.name || 'User'}</h3>
            <p style={{ margin: 0, color: 'var(--text-secondary)' }}>{profile.email}</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '40px' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 600 }}>
            <IoPersonOutline style={{ marginRight: '5px' }} /> Full Name
          </label>
          <input 
            type="text" name="name" value={profile.name} onChange={handleChange} required
            style={{ width: '100%', padding: '16px', borderRadius: '16px', border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '1rem', outline: 'none' }} 
          />
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 600 }}>
            <IoQrCodeOutline style={{ marginRight: '5px' }} /> Global UPI ID (For Group Settlements)
          </label>
          <input 
            type="text" name="upiId" value={profile.upiId || ''} onChange={handleChange} 
            placeholder="e.g. name@okhdfcbank"
            style={{ width: '100%', padding: '16px', borderRadius: '16px', border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '1rem', outline: 'none' }} 
          />
          <p style={{ margin: '8px 0 0', fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
            This will be used by your friends to settle group expenses with you directly.
          </p>
        </div>

        {message && (
          <div style={{ padding: '15px', borderRadius: '12px', background: message.includes('Failed') ? 'rgba(255, 69, 58, 0.1)' : 'rgba(52, 199, 89, 0.1)', color: message.includes('Failed') ? 'var(--danger)' : 'var(--success)', textAlign: 'center', fontWeight: 600 }}>
            {message}
          </div>
        )}

        <button type="submit" disabled={isSaving} className="btn-primary" style={{ padding: '16px', borderRadius: '16px', fontSize: '1.1rem', fontWeight: 700 }}>
          {isSaving ? 'Saving...' : 'Save Profile'}
        </button>
      </form>

      <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '15px' }}>Preferences</h3>
      <div style={{ background: 'var(--bg-secondary)', borderRadius: '24px', overflow: 'hidden', marginBottom: '40px' }}>
        <motion.div 
          onClick={toggleTheme}
          whileHover={{ backgroundColor: 'var(--bg-glass)' }}
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px', cursor: 'pointer', borderBottom: '1px solid var(--border-subtle)' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <IoColorPaletteOutline size={24} color="var(--brand-primary)" />
            <span style={{ fontSize: '1.1rem', fontWeight: 500 }}>App Theme</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{profile.theme}</span>
            <IoChevronForward color="var(--text-tertiary)" />
          </div>
        </motion.div>

        <motion.div 
          onClick={handleLogout}
          whileHover={{ backgroundColor: 'var(--bg-glass)' }}
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px', cursor: 'pointer' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <IoLogOutOutline size={24} color="var(--danger)" />
            <span style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--danger)' }}>Log Out</span>
          </div>
        </motion.div>
      </div>

    </div>
  );
}

export default Profile;
