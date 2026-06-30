import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { IoCloseOutline, IoDownloadOutline, IoShareOutline, IoPhonePortraitOutline } from 'react-icons/io5';

function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
      return; // Already installed, do nothing
    }

    // Check if user dismissed it recently
    const hasDismissed = localStorage.getItem('avora-pwa-dismissed');
    if (hasDismissed) {
      const dismissDate = new Date(parseInt(hasDismissed));
      const now = new Date();
      // Show again after 7 days
      if (now - dismissDate < 7 * 24 * 60 * 60 * 1000) {
        return; 
      }
    }

    // Detect iOS
    const ua = window.navigator.userAgent;
    const webkit = !!ua.match(/WebKit/i);
    const isIOSDevice = !!ua.match(/iPad/i) || !!ua.match(/iPhone/i);
    const isSafari = isIOSDevice && webkit && !ua.match(/CriOS/i);
    
    if (isIOSDevice && isSafari) {
      setIsIOS(true);
      setTimeout(() => setShowPrompt(true), 2000);
    }

    // Standard PWA install event (Android / Chrome)
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setTimeout(() => setShowPrompt(true), 2000);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setShowPrompt(false);
      }
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('avora-pwa-dismissed', Date.now().toString());
  };

  return (
    <AnimatePresence>
      {showPrompt && (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 5000, display: 'flex', justifyContent: 'center', padding: '20px', pointerEvents: 'none' }}>
          <motion.div 
            initial={{ y: 150, opacity: 0 }} 
            animate={{ y: 0, opacity: 1 }} 
            exit={{ y: 150, opacity: 0 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            style={{ 
              background: 'var(--bg-glass)', backdropFilter: 'blur(20px)', border: '1px solid var(--border-subtle)',
              borderRadius: '24px', padding: '20px', width: '100%', maxWidth: '400px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)', pointerEvents: 'auto',
              position: 'relative'
            }}
          >
            <button onClick={handleDismiss} style={{ position: 'absolute', top: '15px', right: '15px', background: 'var(--bg-secondary)', border: 'none', width: '32px', height: '32px', borderRadius: '16px', display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer', color: 'var(--text-tertiary)' }}>
              <IoCloseOutline size={20} />
            </button>

            <div style={{ display: 'flex', gap: '15px', alignItems: 'center', marginBottom: '15px' }}>
              <div style={{ width: '50px', height: '50px', borderRadius: '14px', background: 'var(--brand-gradient)', display: 'flex', justifyContent: 'center', alignItems: 'center', boxShadow: '0 5px 15px rgba(0, 113, 227, 0.3)' }}>
                <img src="/logo.png" alt="Avora" style={{ width: '24px' }} />
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Install Avora App</h4>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Get the full premium experience</p>
              </div>
            </div>

            {isIOS ? (
              <div style={{ background: 'var(--bg-secondary)', padding: '15px', borderRadius: '16px', fontSize: '0.9rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ background: 'var(--bg-primary)', padding: '6px', borderRadius: '8px' }}><IoShareOutline size={18} color="var(--brand-primary)" /></div>
                  <span>1. Tap the <b>Share</b> button below</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ background: 'var(--bg-primary)', padding: '6px', borderRadius: '8px' }}><IoPhonePortraitOutline size={18} color="var(--brand-primary)" /></div>
                  <span>2. Select <b>Add to Home Screen</b></span>
                </div>
              </div>
            ) : (
              <button onClick={handleInstallClick} className="btn-primary" style={{ width: '100%', padding: '14px', borderRadius: '16px', fontWeight: 700, fontSize: '1.05rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
                <IoDownloadOutline size={22} /> Install App
              </button>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export default PwaInstallPrompt;
