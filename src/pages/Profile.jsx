import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase';
import { ref, get, update, remove } from 'firebase/database';
import { deleteUser } from 'firebase/auth';
import { IoPersonOutline, IoLogOutOutline, IoColorPaletteOutline, IoQrCodeOutline, IoChevronForward, IoCloseOutline, IoLockClosedOutline, IoKeypadOutline, IoFingerPrintOutline, IoWarningOutline } from 'react-icons/io5';
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

  // Account Deletion State
  const [isDeleteStep1Open, setIsDeleteStep1Open] = useState(false);
  const [isDeleteStep2Open, setIsDeleteStep2Open] = useState(false);
  const [isDeleteStep3Open, setIsDeleteStep3Open] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

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

  const executeDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      const uid = currentUser.uid;
      const updates = {};
      
      const userGroupsSnap = await get(ref(db, `userGroups/${uid}`));
      if (userGroupsSnap.exists()) {
        const groups = Object.keys(userGroupsSnap.val());
        for (const gId of groups) {
          const membersSnap = await get(ref(db, `groupMembers/${gId}`));
          if (membersSnap.exists()) {
            const members = membersSnap.val();
            const me = members[uid];
            if (me && me.role === 'admin') {
              const others = Object.keys(members).filter(k => k !== uid && members[k].status === 'approved');
              if (others.length > 0) {
                updates[`groupMembers/${gId}/${others[0]}/role`] = 'admin';
              }
            }
            updates[`groupMembers/${gId}/${uid}/status`] = 'deleted';
          }
        }
      }

      updates[`accounts/${uid}`] = null;
      updates[`transactions/${uid}`] = null;
      updates[`goals/${uid}`] = null;
      updates[`loans/${uid}`] = null;
      updates[`loanRequests/${uid}`] = null;
      updates[`categories/${uid}`] = null;
      updates[`userGroups/${uid}`] = null;
      updates[`users/${uid}`] = null;

      await update(ref(db), updates);
      await deleteUser(currentUser);
      
      toast.success("Account deleted successfully.");
      navigate('/login');
    } catch(err) {
      console.error(err);
      if (err.code === 'auth/requires-recent-login') {
        toast.error("Security: Please log out and log back in before deleting your account.");
      } else {
        toast.error("Failed to delete account. You may need to re-authenticate.");
      }
    }
    setIsDeleting(false);
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

        {/* Delete Account Row */}
        <motion.div 
          onClick={() => setIsDeleteStep1Open(true)}
          whileHover={{ backgroundColor: 'var(--bg-glass)' }}
          whileTap={{ backgroundColor: 'var(--border-subtle)' }}
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 20px', cursor: 'pointer', borderTop: '1px solid var(--border-subtle)' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <div style={{ background: 'rgba(255, 69, 58, 0.1)', padding: '8px', borderRadius: '10px' }}>
              <IoWarningOutline size={22} color="var(--danger)" />
            </div>
            <span style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--danger)' }}>Delete Account</span>
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
      {/* Delete Account Step 1 Modal */}
      <AnimatePresence>
        {isDeleteStep1Open && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 4000, display: 'flex', justifyContent: 'center', alignItems: 'center', backdropFilter: 'blur(5px)' }}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} style={{ background: 'var(--bg-primary)', padding: '30px', borderRadius: '24px', width: '90%', maxWidth: '400px', textAlign: 'center' }}>
              <div style={{ width: '60px', height: '60px', borderRadius: '30px', background: 'rgba(255,69,58,0.1)', color: 'var(--danger)', display: 'flex', justifyContent: 'center', alignItems: 'center', margin: '0 auto 20px auto' }}>
                <IoWarningOutline size={32} />
              </div>
              <h3 style={{ margin: '0 0 10px 0', fontSize: '1.4rem', fontWeight: 800 }}>Wait, don't leave!</h3>
              <p style={{ margin: '0 0 25px 0', color: 'var(--text-secondary)' }}>Are you sure you want to delete your account? Avora helps you manage your finances and split expenses easily. Stay with us!</p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <button onClick={() => setIsDeleteStep1Open(false)} style={{ padding: '16px', borderRadius: '16px', background: 'var(--brand-primary)', color: 'white', border: 'none', fontWeight: 700, fontSize: '1.1rem', cursor: 'pointer' }}>I'll Stay</button>
                <button onClick={() => { setIsDeleteStep1Open(false); setIsDeleteStep2Open(true); }} style={{ padding: '16px', borderRadius: '16px', background: 'transparent', color: 'var(--text-tertiary)', border: '1px solid var(--border-subtle)', fontWeight: 600, fontSize: '1rem', cursor: 'pointer' }}>Continue to Delete</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Account Step 2 Modal */}
      <AnimatePresence>
        {isDeleteStep2Open && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 4000, display: 'flex', justifyContent: 'center', alignItems: 'center', backdropFilter: 'blur(5px)' }}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} style={{ background: 'var(--bg-primary)', padding: '30px', borderRadius: '24px', width: '90%', maxWidth: '400px', textAlign: 'center' }}>
              <h3 style={{ margin: '0 0 10px 0', fontSize: '1.4rem', fontWeight: 800, color: 'var(--danger)' }}>Final Warning</h3>
              <p style={{ margin: '0 0 25px 0', color: 'var(--text-secondary)' }}>This action is <strong style={{color: 'var(--danger)'}}>irreversible</strong>. You will permanently lose all your accounts, transactions, goals, loans, and group memberships. You can recreate your account later, but data cannot be recovered.</p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <button onClick={() => { setIsDeleteStep2Open(false); setIsDeleteStep3Open(true); }} style={{ padding: '16px', borderRadius: '16px', background: 'rgba(255, 69, 58, 0.1)', color: 'var(--danger)', border: 'none', fontWeight: 700, fontSize: '1.1rem', cursor: 'pointer' }}>Verify & Delete</button>
                <button onClick={() => setIsDeleteStep2Open(false)} style={{ padding: '16px', borderRadius: '16px', background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: 'none', fontWeight: 600, fontSize: '1rem', cursor: 'pointer' }}>Cancel</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Biometric Verification Modal */}
      <AnimatePresence>
        {isDeleteStep3Open && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 5000, display: 'flex', justifyContent: 'center', alignItems: 'center', backdropFilter: 'blur(10px)' }}>
            <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }} style={{ background: 'var(--bg-primary)', padding: '40px 30px', borderRadius: '32px', textAlign: 'center', width: '90%', maxWidth: '340px', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
              <div style={{ margin: '0 auto 20px auto', width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(255, 69, 58, 0.1)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ repeat: Infinity, duration: 2 }}>
                  <IoFingerPrintOutline size={48} color="var(--danger)" />
                </motion.div>
              </div>
              <h3 style={{ margin: '0 0 10px 0', fontSize: '1.3rem', fontWeight: 700 }}>Verify Identity</h3>
              <p style={{ margin: '0 0 30px 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Scan your fingerprint to authorize account deletion.</p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <button 
                  onClick={() => {
                    setIsDeleteStep3Open(false);
                    executeDeleteAccount();
                  }} 
                  disabled={isDeleting}
                  style={{ width: '100%', padding: '16px', borderRadius: '16px', background: 'var(--danger)', color: 'white', border: 'none', fontWeight: 700, fontSize: '1.1rem', cursor: 'pointer', opacity: isDeleting ? 0.7 : 1 }}
                >
                  {isDeleting ? 'Deleting...' : 'Simulate Fingerprint Scan'}
                </button>
                <button 
                  onClick={() => setIsDeleteStep3Open(false)}
                  disabled={isDeleting}
                  style={{ width: '100%', padding: '16px', borderRadius: '16px', background: 'transparent', color: 'var(--text-secondary)', border: 'none', fontWeight: 600, fontSize: '1rem', cursor: 'pointer' }}
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}

export default Profile;
