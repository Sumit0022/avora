import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';

function Home() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (currentUser) {
      navigate('/dashboard');
    }
  }, [currentUser, navigate]);

  return (
    <div style={{ backgroundColor: '#000', minHeight: '100vh', overflow: 'hidden', position: 'relative', color: '#fff' }}>
      
      {/* Animated Background Blobs */}
      <motion.div 
        animate={{ 
          scale: [1, 1.2, 1],
          rotate: [0, 90, 0],
          opacity: [0.3, 0.5, 0.3]
        }}
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        style={{
          position: 'absolute', top: '-20%', left: '-10%', width: '70vw', height: '70vw',
          background: 'radial-gradient(circle, rgba(0,113,227,0.4) 0%, rgba(0,0,0,0) 70%)',
          borderRadius: '50%', filter: 'blur(60px)', zIndex: 0
        }}
      />
      <motion.div 
        animate={{ 
          scale: [1, 1.5, 1],
          rotate: [0, -90, 0],
          opacity: [0.2, 0.4, 0.2]
        }}
        transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
        style={{
          position: 'absolute', bottom: '-20%', right: '-10%', width: '60vw', height: '60vw',
          background: 'radial-gradient(circle, rgba(94,92,230,0.4) 0%, rgba(0,0,0,0) 70%)',
          borderRadius: '50%', filter: 'blur(60px)', zIndex: 0
        }}
      />

      <div className="container" style={{ position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        
        {/* Header */}
        <header style={{ padding: '30px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <img src="/logo.png" alt="Avora Logo" style={{ width: '36px', height: '36px' }} />
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0, letterSpacing: '-0.5px' }}>AVORA</h1>
          </div>
          <Link to="/login" style={{ textDecoration: 'none' }}>
            <button style={{ 
              background: 'rgba(255, 255, 255, 0.1)', border: '1px solid rgba(255, 255, 255, 0.2)',
              color: 'white', padding: '10px 24px', borderRadius: '20px', fontWeight: 600,
              cursor: 'pointer', transition: 'all 0.3s ease', backdropFilter: 'blur(10px)'
            }}
            onMouseEnter={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.2)'}
            onMouseLeave={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.1)'}
            >
              Sign In
            </button>
          </Link>
        </header>

        {/* Hero Section */}
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', padding: '40px 0' }}>
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            style={{ maxWidth: '800px' }}
          >
            <div style={{ display: 'inline-block', padding: '8px 16px', background: 'rgba(0, 113, 227, 0.15)', border: '1px solid rgba(0, 113, 227, 0.3)', borderRadius: '30px', color: '#66b3ff', fontWeight: 600, fontSize: '0.9rem', marginBottom: '30px' }}>
              ✨ The Future of Personal Finance
            </div>
            
            <h2 style={{ fontSize: 'clamp(3rem, 8vw, 5rem)', fontWeight: 900, lineHeight: 1.1, letterSpacing: '-2px', marginBottom: '24px', background: 'linear-gradient(135deg, #fff 0%, #a1a1a6 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Master your money.<br/>Split with friends.
            </h2>
            
            <p style={{ fontSize: 'clamp(1.1rem, 3vw, 1.3rem)', color: '#a1a1a6', lineHeight: 1.6, maxWidth: '600px', margin: '0 auto 40px auto' }}>
              Avora seamlessly blends advanced expense tracking, smart bill splitting, and comprehensive financial insights into one beautifully crafted application.
            </p>
            
            <Link to="/login" style={{ textDecoration: 'none' }}>
              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                style={{ 
                  background: 'var(--brand-gradient)', color: 'white', border: 'none',
                  padding: '18px 40px', borderRadius: '100px', fontSize: '1.1rem', fontWeight: 700,
                  cursor: 'pointer', boxShadow: '0 10px 30px rgba(0, 113, 227, 0.4)',
                  display: 'inline-flex', alignItems: 'center', gap: '10px'
                }}
              >
                Get Started for Free
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                  <polyline points="12 5 19 12 12 19"></polyline>
                </svg>
              </motion.button>
            </Link>
          </motion.div>

          {/* Feature Grid */}
          <motion.div 
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
            style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px', width: '100%', marginTop: '80px', marginBottom: '40px' }}
          >
            {[
              { title: 'Personal Wealth', icon: '💰', desc: 'Track accounts, budgets, and net worth effortlessly.' },
              { title: 'Group Engine', icon: '🤝', desc: 'Settle flatmate expenses with smart debt simplification.' },
              { title: 'Subscriptions', icon: '📅', desc: 'Never miss a recurring payment with automated tracking.' }
            ].map((feature, i) => (
              <div key={i} style={{ 
                background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.05)',
                padding: '30px', borderRadius: '24px', textAlign: 'left',
                backdropFilter: 'blur(10px)'
              }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '15px' }}>{feature.icon}</div>
                <h3 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '10px' }}>{feature.title}</h3>
                <p style={{ color: '#86868b', lineHeight: 1.5 }}>{feature.desc}</p>
              </div>
            ))}
          </motion.div>
        </main>
      </div>
    </div>
  );
}

export default Home;
