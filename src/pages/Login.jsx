import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FcGoogle } from 'react-icons/fc';
import { useAuth } from '../context/AuthContext';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    try {
      setError('');
      setLoading(true);
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError('Failed to log in: ' + err.message);
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
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '70vh' }}>
      <div className="glass-panel" style={{ padding: '40px', width: '100%', maxWidth: '400px' }}>
        <h2 style={{ fontSize: '1.8rem', marginBottom: '10px', textAlign: 'center' }}>Welcome Back</h2>
        <p style={{ color: 'var(--text-secondary)', textAlign: 'center', marginBottom: '30px' }}>Sign in to continue to Avora</p>
        
        {error && <div style={{ background: 'rgba(255, 59, 48, 0.1)', color: 'var(--danger)', padding: '10px', borderRadius: '8px', marginBottom: '20px', textAlign: 'center', fontSize: '0.9rem' }}>{error}</div>}

        <button 
          onClick={handleGoogleLogin}
          disabled={loading}
          style={{ 
            width: '100%', padding: '12px', borderRadius: '12px', 
            background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)',
            color: 'var(--text-primary)', display: 'flex', alignItems: 'center', 
            justifyContent: 'center', gap: '10px', fontSize: '1rem', cursor: loading ? 'not-allowed' : 'pointer',
            marginBottom: '20px', fontWeight: '500', transition: 'background 0.2s',
            boxShadow: 'var(--shadow-sm)'
          }}
        >
          <FcGoogle size={24} /> Continue with Google
        </button>

        <div style={{ display: 'flex', alignItems: 'center', margin: '20px 0' }}>
          <div style={{ flex: 1, height: '1px', background: 'var(--border-subtle)' }}></div>
          <span style={{ padding: '0 10px', color: 'var(--text-tertiary)', fontSize: '0.9rem' }}>or</span>
          <div style={{ flex: 1, height: '1px', background: 'var(--border-subtle)' }}></div>
        </div>

        <form onSubmit={handleEmailLogin} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Email</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                width: '100%', padding: '12px', borderRadius: '10px',
                border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)',
                color: 'var(--text-primary)', outline: 'none', fontFamily: 'inherit'
              }} 
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Password</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                width: '100%', padding: '12px', borderRadius: '10px',
                border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)',
                color: 'var(--text-primary)', outline: 'none', fontFamily: 'inherit'
              }} 
            />
          </div>
          <button type="submit" disabled={loading} className="btn-primary" style={{ width: '100%', marginTop: '10px', opacity: loading ? 0.7 : 1 }}>
            Sign In
          </button>
        </form>
      </div>
    </div>
  );
}

export default Login;

