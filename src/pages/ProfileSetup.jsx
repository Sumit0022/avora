import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase';
import { ref, set, get, child } from 'firebase/database';

function ProfileSetup() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    fullName: '',
    username: '',
    currency: 'INR',
    upiId: '',
    bio: ''
  });

  useEffect(() => {
    if (!currentUser) {
      navigate('/login');
      return;
    }

    const checkProfile = async () => {
      try {
        const dbRef = ref(db);
        const snapshot = await get(child(dbRef, `users/${currentUser.uid}`));
        if (snapshot.exists()) {
          // Profile already exists, redirect to dashboard
          navigate('/dashboard');
        } else {
          // Pre-fill name if available from Google auth
          if (currentUser.displayName) {
            setFormData(prev => ({ ...prev, fullName: currentUser.displayName }));
          }
          setLoading(false);
        }
      } catch (err) {
        console.error("Error checking profile:", err);
        setError("Failed to verify profile status.");
        setLoading(false);
      }
    };
    
    checkProfile();
  }, [currentUser, navigate]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      // Basic validation
      if (formData.username.length < 3) {
        throw new Error("Username must be at least 3 characters.");
      }

      await set(ref(db, 'users/' + currentUser.uid), {
        uid: currentUser.uid,
        email: currentUser.email,
        photoURL: currentUser.photoURL || null,
        fullName: formData.fullName,
        username: formData.username.toLowerCase(),
        currency: formData.currency,
        upiId: formData.upiId,
        bio: formData.bio,
        createdAt: new Date().toISOString()
      });

      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };


  if (loading) return <div style={{ textAlign: 'center', padding: '50px' }}>Loading...</div>;

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '70vh' }}>
      <div className="glass-panel" style={{ padding: '40px', width: '100%', maxWidth: '500px' }}>
        <h2 style={{ fontSize: '1.8rem', marginBottom: '10px', textAlign: 'center' }}>Complete Your Profile</h2>
        <p style={{ color: 'var(--text-secondary)', textAlign: 'center', marginBottom: '30px' }}>Let's set up your Avora account</p>
        
        {error && <div style={{ background: 'rgba(255, 59, 48, 0.1)', color: 'var(--danger)', padding: '10px', borderRadius: '8px', marginBottom: '20px', textAlign: 'center', fontSize: '0.9rem' }}>{error}</div>}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Full Name</label>
            <input 
              type="text" name="fullName" value={formData.fullName} onChange={handleChange} required
              style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', outline: 'none' }} 
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Username (Unique)</label>
            <input 
              type="text" name="username" value={formData.username} onChange={handleChange} required
              style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', outline: 'none' }} 
            />
          </div>
          <div style={{ display: 'flex', gap: '15px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '5px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Currency</label>
              <select 
                name="currency" value={formData.currency} onChange={handleChange}
                style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', outline: 'none' }}
              >
                <option value="INR">₹ INR</option>
                <option value="USD">$ USD</option>
                <option value="EUR">€ EUR</option>
                <option value="GBP">£ GBP</option>
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '5px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>UPI ID (Optional)</label>
              <input 
                type="text" name="upiId" value={formData.upiId} onChange={handleChange} placeholder="e.g. name@okhdfc"
                style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', outline: 'none' }} 
              />
            </div>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Bio (Optional)</label>
            <textarea 
              name="bio" value={formData.bio} onChange={handleChange} rows="3"
              style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', outline: 'none', resize: 'vertical' }} 
            />
          </div>
          <button type="submit" disabled={saving} className="btn-primary" style={{ width: '100%', marginTop: '10px', opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Saving...' : 'Complete Setup'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default ProfileSetup;
