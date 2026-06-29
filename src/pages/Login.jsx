import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  
  const { login, signup, resetPassword, loginWithGoogle } = useAuth();
  const navigate = useNavigate();

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
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column',
      justifyContent: 'center', 
      alignItems: 'center', 
      minHeight: '80vh',
      padding: '20px'
    }}>
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="glass-panel" 
        style={{ 
          padding: '40px 30px', 
          width: '100%', 
          maxWidth: '420px',
          borderRadius: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px'
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '10px' }}>
          <h2 style={{ fontSize: '2rem', fontWeight: 800, margin: '0 0 5px 0', letterSpacing: '-0.5px' }}>
            {mode === 'login' ? 'Welcome Back' : mode === 'signup' ? 'Create Account' : 'Reset Password'}
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', margin: 0 }}>
            {mode === 'login' ? 'Sign in to continue to Avora' : mode === 'signup' ? 'Join Avora to manage your finances' : 'Enter your email to get a reset link'}
          </p>
        </div>
        
        {error && <div style={{ background: 'rgba(255, 69, 58, 0.1)', color: 'var(--danger)', padding: '12px', borderRadius: '12px', textAlign: 'center', fontSize: '0.9rem', fontWeight: 500 }}>{error}</div>}
        {message && <div style={{ background: 'rgba(52, 199, 89, 0.1)', color: 'var(--success)', padding: '12px', borderRadius: '12px', textAlign: 'center', fontSize: '0.9rem', fontWeight: 500 }}>{message}</div>}

        {mode !== 'forgot' && (
          <>
            <button 
              onClick={handleGoogleLogin}
              disabled={loading}
              style={{ 
                width: '100%', padding: '14px', borderRadius: '14px', 
                background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)',
                color: 'var(--text-primary)', display: 'flex', alignItems: 'center', 
                justifyContent: 'center', gap: '10px', fontSize: '1rem', cursor: loading ? 'not-allowed' : 'pointer',
                fontWeight: '600', transition: 'all 0.2s ease',
                boxShadow: 'var(--shadow-sm)'
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
            >
              <FcGoogle size={24} /> Continue with Google
            </button>

            <div style={{ display: 'flex', alignItems: 'center', margin: '5px 0' }}>
              <div style={{ flex: 1, height: '1px', background: 'var(--border-subtle)' }}></div>
              <span style={{ padding: '0 15px', color: 'var(--text-tertiary)', fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase' }}>or email</span>
              <div style={{ flex: 1, height: '1px', background: 'var(--border-subtle)' }}></div>
            </div>
          </>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 600 }}>Email Address</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
              style={{
                width: '100%', padding: '14px', borderRadius: '14px',
                border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)',
                color: 'var(--text-primary)', outline: 'none', fontFamily: 'inherit',
                fontSize: '1rem', transition: 'border-color 0.2s'
              }} 
              onFocus={(e) => e.target.style.borderColor = 'var(--brand-primary)'}
              onBlur={(e) => e.target.style.borderColor = 'var(--border-subtle)'}
            />
          </div>
          
          {mode !== 'forgot' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 600, margin: 0 }}>Password</label>
                {mode === 'login' && (
                  <button type="button" onClick={() => { setMode('forgot'); setError(''); setMessage(''); }} style={{ background: 'none', border: 'none', color: 'var(--brand-primary)', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', padding: 0 }}>
                    Forgot?
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
                  width: '100%', padding: '14px', borderRadius: '14px',
                  border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)',
                  color: 'var(--text-primary)', outline: 'none', fontFamily: 'inherit',
                  fontSize: '1rem', transition: 'border-color 0.2s'
                }} 
                onFocus={(e) => e.target.style.borderColor = 'var(--brand-primary)'}
                onBlur={(e) => e.target.style.borderColor = 'var(--border-subtle)'}
              />
            </div>
          )}
          
          <button type="submit" disabled={loading} className="btn-primary" style={{ width: '100%', marginTop: '10px', padding: '16px', borderRadius: '14px', fontSize: '1.05rem', fontWeight: 700, opacity: loading ? 0.7 : 1 }}>
            {loading ? 'Processing...' : mode === 'login' ? 'Sign In' : mode === 'signup' ? 'Create Account' : 'Send Reset Link'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '10px' }}>
          {mode === 'login' ? (
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
              Don't have an account? <button type="button" onClick={() => { setMode('signup'); setError(''); }} style={{ background: 'none', border: 'none', color: 'var(--brand-primary)', fontWeight: 700, cursor: 'pointer', padding: 0 }}>Sign Up</button>
            </p>
          ) : (
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
              Back to <button type="button" onClick={() => { setMode('login'); setError(''); setMessage(''); }} style={{ background: 'none', border: 'none', color: 'var(--brand-primary)', fontWeight: 700, cursor: 'pointer', padding: 0 }}>Sign In</button>
            </p>
          )}
        </div>
      </motion.div>
    </div>
  );
}

export default Login;
