import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { FcGoogle } from 'react-icons/fc';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState('login'); // 'login', 'signup', 'forgot'
  
  const { login, signup, resetPassword, loginWithGoogle, currentUser } = useAuth();
  const navigate = useNavigate();

  // Redirect if already logged in
  useEffect(() => {
    if (currentUser) {
      navigate('/dashboard');
    }
  }, [currentUser, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      if (mode === 'login') {
        await login(email, password);
        navigate('/dashboard');
      } else if (mode === 'signup') {
        await signup(email, password);
        navigate('/dashboard');
      } else if (mode === 'forgot') {
        await resetPassword(email);
        setMessage('Check your inbox for password reset instructions.');
      }
    } catch (err) {
      setError(err.message.replace('Firebase: ', ''));
    }
    
    setLoading(false);
  };

  const handleGoogleLogin = async () => {
    try {
      setError('');
      setLoading(true);
      await loginWithGoogle();
      navigate('/dashboard');
    } catch (err) {
      setError('Failed to log in with Google: ' + err.message);
    }
    setLoading(false);
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--bg-primary)' }}>
      
      {/* Left Branding Panel (Hidden on Mobile) */}
      <div style={{
        flex: 1, display: 'none', '@media (minWidth: 768px)': { display: 'flex' },
        background: 'var(--brand-gradient)', color: 'white', padding: '60px',
        flexDirection: 'column', justifyContent: 'space-between', position: 'relative',
        overflow: 'hidden'
      }} className="desktop-branding">
        <motion.div 
          animate={{ scale: [1, 1.2, 1], rotate: [0, 90, 0], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          style={{ position: 'absolute', top: '-10%', left: '-10%', width: '50vw', height: '50vw', background: 'radial-gradient(circle, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0) 70%)', borderRadius: '50%', filter: 'blur(40px)', zIndex: 0 }}
        />
        
        <div style={{ position: 'relative', zIndex: 10 }}>
          <Link to="/" style={{ textDecoration: 'none', color: 'white', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <img src="/logo.png" alt="Avora Logo" style={{ width: '40px', height: '40px', filter: 'brightness(0) invert(1)' }} />
            <h1 style={{ fontSize: '1.8rem', fontWeight: 900, margin: 0, letterSpacing: '-0.5px' }}>AVORA</h1>
          </Link>
        </div>
        
        <div style={{ position: 'relative', zIndex: 10, maxWidth: '500px' }}>
          <h2 style={{ fontSize: 'clamp(2.5rem, 4vw, 3.5rem)', fontWeight: 800, lineHeight: 1.1, marginBottom: '20px' }}>
            Take control of your financial journey.
          </h2>
          <p style={{ fontSize: '1.1rem', opacity: 0.9, lineHeight: 1.6 }}>
            Avora combines elegant personal finance tracking with smart flatmate expense sharing in one unified platform.
          </p>
        </div>
        
        <div style={{ position: 'relative', zIndex: 10 }}>
          <p style={{ fontSize: '0.9rem', opacity: 0.7 }}>&copy; 2026 Avora Inc. Made in India.</p>
        </div>
      </div>

      {/* Right Auth Panel */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '20px', position: 'relative' }}>
        
        {/* Mobile Header (Hidden on Desktop) */}
        <div className="mobile-header" style={{ position: 'absolute', top: '30px', left: '30px' }}>
          <Link to="/" style={{ textDecoration: 'none', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <img src="/logo.png" alt="Avora Logo" style={{ width: '32px', height: '32px' }} />
            <span style={{ fontSize: '1.2rem', fontWeight: 800 }}>AVORA</span>
          </Link>
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          style={{ width: '100%', maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '24px' }}
        >
          <div style={{ textAlign: 'left', marginBottom: '10px' }}>
            <h2 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.2rem)', fontWeight: 800, margin: '0 0 8px 0', letterSpacing: '-0.5px', color: 'var(--text-primary)' }}>
              {mode === 'login' ? 'Welcome back' : mode === 'signup' ? 'Create an account' : 'Reset password'}
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', margin: 0 }}>
              {mode === 'login' ? 'Enter your details to access your account.' : mode === 'signup' ? 'Join Avora to manage your finances seamlessly.' : 'Enter your email to get a reset link.'}
            </p>
          </div>
          
          {error && <div style={{ background: 'rgba(255, 69, 58, 0.1)', color: 'var(--danger)', padding: '12px', borderRadius: '12px', fontSize: '0.9rem', fontWeight: 500, borderLeft: '4px solid var(--danger)' }}>{error}</div>}
          {message && <div style={{ background: 'rgba(52, 199, 89, 0.1)', color: 'var(--success)', padding: '12px', borderRadius: '12px', fontSize: '0.9rem', fontWeight: 500, borderLeft: '4px solid var(--success)' }}>{message}</div>}

          {mode !== 'forgot' && (
            <>
              <button 
                onClick={handleGoogleLogin}
                disabled={loading}
                style={{ 
                  width: '100%', padding: '14px', borderRadius: '16px', 
                  background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)',
                  color: 'var(--text-primary)', display: 'flex', alignItems: 'center', 
                  justifyContent: 'center', gap: '12px', fontSize: '1rem', cursor: loading ? 'not-allowed' : 'pointer',
                  fontWeight: '600', transition: 'all 0.2s ease', boxShadow: 'var(--shadow-sm)'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; }}
              >
                <FcGoogle size={24} /> Continue with Google
              </button>

              <div style={{ display: 'flex', alignItems: 'center', margin: '5px 0' }}>
                <div style={{ flex: 1, height: '1px', background: 'var(--border-subtle)' }}></div>
                <span style={{ padding: '0 15px', color: 'var(--text-tertiary)', fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase' }}>or</span>
                <div style={{ flex: 1, height: '1px', background: 'var(--border-subtle)' }}></div>
              </div>
            </>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 600 }}>Email</label>
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                style={{
                  width: '100%', padding: '16px', borderRadius: '16px',
                  border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)',
                  color: 'var(--text-primary)', outline: 'none', fontFamily: 'inherit',
                  fontSize: '1rem', transition: 'all 0.2s'
                }} 
              />
            </div>
            
            {mode !== 'forgot' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 600, margin: 0 }}>Password</label>
                  {mode === 'login' && (
                    <button type="button" onClick={() => { setMode('forgot'); setError(''); setMessage(''); }} style={{ background: 'none', border: 'none', color: 'var(--brand-primary)', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', padding: 0 }}>
                      Forgot password?
                    </button>
                  )}
                </div>
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  style={{
                    width: '100%', padding: '16px', borderRadius: '16px',
                    border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)',
                    color: 'var(--text-primary)', outline: 'none', fontFamily: 'inherit',
                    fontSize: '1rem', transition: 'all 0.2s'
                  }} 
                />
              </div>
            )}
            
            <button type="submit" disabled={loading} className="btn-primary" style={{ width: '100%', marginTop: '10px', padding: '16px', borderRadius: '16px', fontSize: '1.05rem', fontWeight: 700, opacity: loading ? 0.7 : 1, boxShadow: '0 4px 12px rgba(0, 113, 227, 0.2)' }}>
              {loading ? 'Processing...' : mode === 'login' ? 'Sign In' : mode === 'signup' ? 'Create Account' : 'Send Reset Link'}
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: '10px' }}>
            {mode === 'login' ? (
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
                Don't have an account? <button type="button" onClick={() => { setMode('signup'); setError(''); }} style={{ background: 'none', border: 'none', color: 'var(--brand-primary)', fontWeight: 700, cursor: 'pointer', padding: 0 }}>Sign up</button>
              </p>
            ) : (
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
                Back to <button type="button" onClick={() => { setMode('login'); setError(''); setMessage(''); }} style={{ background: 'none', border: 'none', color: 'var(--brand-primary)', fontWeight: 700, cursor: 'pointer', padding: 0 }}>Sign in</button>
              </p>
            )}
          </div>
        </motion.div>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @media (max-width: 767px) {
          .desktop-branding { display: none !important; }
        }
        @media (min-width: 768px) {
          .mobile-header { display: none !important; }
        }
      `}} />
    </div>
  );
}

export default Login;
