import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase';
import { ref, get, update, remove } from 'firebase/database';
import { IoPersonOutline, IoLogOutOutline, IoColorPaletteOutline, IoQrCodeOutline, IoChevronForward, IoCloseOutline, IoLockClosedOutline, IoKeypadOutline, IoFingerPrintOutline } from 'react-icons/io5';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

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
  
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [isManagePinModalOpen, setIsManagePinModalOpen] = useState(false);
  const [tempPin, setTempPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinStep, setPinStep] = useState(1); // 1: set, 2: confirm

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
      await update(ref(db, `users/${currentUser.uid}`), { upiId: tempUpi });
      setProfile(prev => ({ ...prev, upiId: tempUpi }));
      setIsUpiModalOpen(false);
    } catch (error) {
      console.error(error);
      setMessage('Failed to update UPI ID.');
    }
    setIsSaving(false);
  };

  const openPinModal = () => {
    setTempPin('');
    setConfirmPin('');
    setPinStep(1);
    setMessage('');
    setIsPinModalOpen(true);
  };

  const handlePinSubmit = async (e) => {
    e.preventDefault();
    if (tempPin.length !== 4) return setMessage('PIN must be 4 digits.');
    
    if (pinStep === 1) {
      setPinStep(2);
      setMessage('');
    } else {
      if (tempPin !== confirmPin) return setMessage('PINs do not match.');
      
      setIsSaving(true);
      try {
        await update(ref(db, `users/${currentUser.uid}`), { appLockPin: tempPin });
        setProfile(prev => ({ ...prev, appLockPin: tempPin }));
        setIsPinModalOpen(false);
      } catch (err) {
        setMessage('Failed to save PIN.');
      }
      setIsSaving(false);
    }
  };

  const handleAppLockClick = () => {
    if (profile.appLockPin) {
      setIsManagePinModalOpen(true);
    } else {
      openPinModal();
    }
  };

  const handleRemovePin = async () => {
    try {
      await remove(ref(db, `users/${currentUser.uid}/appLockPin`));
      await remove(ref(db, `users/${currentUser.uid}/biometricId`));
      setProfile(prev => ({ ...prev, appLockPin: null, biometricId: null }));
      setIsManagePinModalOpen(false);
    } catch (err) {
      console.error(err);
      setMessage('Failed to remove PIN.');
    }
  };

  const handleBiometricToggle = async () => {
    if (!profile.appLockPin) {
      return toast.error("Please set a 4-digit PIN first.");
    }
    
    if (profile.biometricId) {
      try {
        await remove(ref(db, `users/${currentUser.uid}/biometricId`));
        setProfile(prev => ({ ...prev, biometricId: null }));
        toast.success("Biometric unlock disabled.");
      } catch (err) {
        toast.error("Failed to disable biometrics.");
      }
    } else {
      try {
        const challenge = new Uint8Array(32);
        window.crypto.getRandomValues(challenge);
        
        const credential = await navigator.credentials.create({
          publicKey: {
            challenge,
            rp: { name: "Avora", id: window.location.hostname },
            user: {
              id: new Uint8Array(16),
              name: currentUser.email,
              displayName: profile.name || "Avora User"
            },
            pubKeyCredParams: [{ type: "public-key", alg: -7 }],
            authenticatorSelection: {
              authenticatorAttachment: "platform",
              userVerification: "required"
            },
            timeout: 60000
          }
        });

        const buffer = credential.rawId;
        const base64id = btoa(String.fromCharCode.apply(null, new Uint8Array(buffer)));
        
        await update(ref(db, `users/${currentUser.uid}`), { biometricId: base64id });
        setProfile(prev => ({ ...prev, biometricId: base64id }));
        toast.success("Biometric unlock enabled!");
      } catch (err) {
        console.error(err);
        toast.error("Failed to setup biometrics.");
      }
    }
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

        {/* App Lock PIN Row */}
        <motion.div 
          onClick={handleAppLockClick}
          whileHover={{ backgroundColor: 'var(--bg-glass)' }}
          whileTap={{ backgroundColor: 'var(--border-subtle)' }}
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 20px', cursor: 'pointer', borderBottom: '1px solid var(--border-subtle)' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <div style={{ background: 'rgba(175, 82, 222, 0.1)', padding: '8px', borderRadius: '10px' }}>
              {profile.appLockPin ? <IoLockClosedOutline size={22} color="#AF52DE" /> : <IoKeypadOutline size={22} color="#AF52DE" />}
            </div>
            <div>
              <span style={{ fontSize: '1.05rem', fontWeight: 600, display: 'block' }}>App Lock</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>{profile.appLockPin ? 'Enabled (Tap to remove)' : 'Secure app with PIN'}</span>
            </div>
          </div>
          {!profile.appLockPin && <IoChevronForward color="var(--text-tertiary)" size={20} />}
        </motion.div>

        {/* Biometric Row */}
        {profile.appLockPin && (
          <motion.div 
            onClick={handleBiometricToggle}
            whileHover={{ backgroundColor: 'var(--bg-glass)' }}
            whileTap={{ backgroundColor: 'var(--border-subtle)' }}
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 20px', cursor: 'pointer', borderBottom: '1px solid var(--border-subtle)' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
              <div style={{ background: 'rgba(255, 149, 0, 0.1)', padding: '8px', borderRadius: '10px' }}>
                <IoFingerPrintOutline size={22} color="#FF9500" />
              </div>
              <div>
                <span style={{ fontSize: '1.05rem', fontWeight: 600, display: 'block' }}>Biometric Unlock</span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>{profile.biometricId ? 'Enabled' : 'Use Face ID / Fingerprint'}</span>
              </div>
            </div>
            <div style={{ 
              width: '50px', height: '28px', borderRadius: '14px', 
              background: profile.biometricId ? 'var(--success)' : 'var(--bg-primary)', 
              border: profile.biometricId ? 'none' : '2px solid var(--border-subtle)',
              position: 'relative', transition: 'all 0.3s ease'
            }}>
              <div style={{
                position: 'absolute', top: profile.biometricId ? '2px' : '0px', left: profile.biometricId ? '24px' : '0px',
                width: '24px', height: '24px', borderRadius: '50%', background: 'white',
                boxShadow: '0 2px 5px rgba(0,0,0,0.2)', transition: 'all 0.3s ease'
              }} />
            </div>
          </motion.div>
        )}

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
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 2000, display: 'flex', justifyContent: 'center', alignItems: 'flex-end' }}>
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

      {/* Set PIN Modal */}
      <AnimatePresence>
        {isPinModalOpen && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 2000, display: 'flex', justifyContent: 'center', alignItems: 'flex-end' }}>
            <motion.div 
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="panel"
              style={{ width: '100%', maxWidth: '500px', background: 'var(--bg-primary)', padding: '25px', borderRadius: '24px 24px 0 0', paddingBottom: 'env(safe-area-inset-bottom, 40px)' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700 }}>{pinStep === 1 ? 'Set PIN' : 'Confirm PIN'}</h3>
                <button onClick={() => setIsPinModalOpen(false)} style={{ background: 'var(--bg-secondary)', border: 'none', width: '36px', height: '36px', borderRadius: '18px', display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer', color: 'var(--text-primary)' }}>
                  <IoCloseOutline size={24} />
                </button>
              </div>
              
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '20px' }}>
                {pinStep === 1 ? 'Enter a 4-digit PIN to lock your app.' : 'Re-enter your PIN to confirm.'}
              </p>

              <form onSubmit={handlePinSubmit}>
                <div style={{ marginBottom: '20px' }}>
                  <input 
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    value={pinStep === 1 ? tempPin : confirmPin} 
                    onChange={(e) => pinStep === 1 ? setTempPin(e.target.value) : setConfirmPin(e.target.value)} 
                    placeholder="****"
                    style={{ width: '100%', padding: '16px', borderRadius: '16px', border: '1px solid #AF52DE', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '2rem', outline: 'none', textAlign: 'center', letterSpacing: '10px' }} 
                  />
                </div>
                
                {message && <div style={{ color: 'var(--danger)', fontSize: '0.9rem', marginBottom: '15px', textAlign: 'center' }}>{message}</div>}

                <button type="submit" disabled={isSaving || (pinStep === 1 ? tempPin.length !== 4 : confirmPin.length !== 4)} className="btn-primary" style={{ width: '100%', padding: '16px', borderRadius: '16px', fontSize: '1.1rem', fontWeight: 700, background: '#AF52DE' }}>
                  {pinStep === 1 ? 'Continue' : isSaving ? 'Saving...' : 'Enable App Lock'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Manage PIN Action Sheet */}
      <AnimatePresence>
        {isManagePinModalOpen && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 3000, display: 'flex', justifyContent: 'center', alignItems: 'flex-end', backdropFilter: 'blur(5px)' }}>
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 300 }} style={{ background: 'var(--bg-primary)', width: '100%', maxWidth: '600px', borderTopLeftRadius: '32px', borderTopRightRadius: '32px', padding: '30px', paddingBottom: 'env(safe-area-inset-bottom, 40px)' }}>
              <h3 style={{ margin: '0 0 20px 0', fontSize: '1.2rem', fontWeight: 700, textAlign: 'center' }}>Manage App Lock</h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <button 
                  onClick={() => { setIsManagePinModalOpen(false); openPinModal(); }} 
                  style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '16px', borderRadius: '16px', background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: 'none', fontSize: '1.1rem', fontWeight: 600, cursor: 'pointer' }}
                >
                  <IoKeypadOutline size={22} /> Change PIN
                </button>
                <button 
                  onClick={handleRemovePin} 
                  style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '16px', borderRadius: '16px', background: 'rgba(255, 69, 58, 0.1)', color: 'var(--danger)', border: 'none', fontSize: '1.1rem', fontWeight: 600, cursor: 'pointer' }}
                >
                  <IoLockClosedOutline size={22} /> Remove PIN
                </button>
              </div>
              <button onClick={() => setIsManagePinModalOpen(false)} style={{ width: '100%', padding: '16px', borderRadius: '16px', background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: 'none', fontWeight: 700, fontSize: '1.1rem', marginTop: '20px', cursor: 'pointer' }}>Cancel</button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}

export default Profile;
