import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { motion, useScroll, useTransform } from 'framer-motion';
import { IoWalletOutline, IoPeopleOutline, IoPieChartOutline, IoShieldCheckmarkOutline, IoFlashOutline, IoPhonePortraitOutline } from 'react-icons/io5';

function Home() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const { scrollYProgress } = useScroll();
  const yPosAnim = useTransform(scrollYProgress, [0, 1], [0, -200]);

  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (currentUser) {
      navigate('/dashboard');
    }
  }, [currentUser, navigate]);

  const handleMouseMove = (e) => {
    const { clientX, clientY } = e;
    const { innerWidth, innerHeight } = window;
    const x = (clientX / innerWidth - 0.5) * 20; // -10 to 10 deg
    const y = (clientY / innerHeight - 0.5) * -20; // 10 to -10 deg
    setMousePos({ x, y });
  };

  const resetMouse = () => setMousePos({ x: 0, y: 0 });

  return (
    <div style={{ backgroundColor: '#fbfbfd', minHeight: '100vh', overflowX: 'hidden', color: '#1d1d1f', fontFamily: '"Inter", -apple-system, sans-serif' }}>
      
      {/* Background Animated Gradients */}
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0, pointerEvents: 'none', overflow: 'hidden' }}>
        <motion.div 
          animate={{ scale: [1, 1.2, 1], rotate: [0, 90, 0], opacity: [0.4, 0.6, 0.4] }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          style={{ position: 'absolute', top: '-20%', left: '-10%', width: '60vw', height: '60vw', background: 'radial-gradient(circle, rgba(0,113,227,0.08) 0%, rgba(255,255,255,0) 70%)', borderRadius: '50%', filter: 'blur(60px)' }}
        />
        <motion.div 
          animate={{ scale: [1, 1.3, 1], rotate: [0, -90, 0], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
          style={{ position: 'absolute', bottom: '10%', right: '-10%', width: '50vw', height: '50vw', background: 'radial-gradient(circle, rgba(94,92,230,0.08) 0%, rgba(255,255,255,0) 70%)', borderRadius: '50%', filter: 'blur(60px)' }}
        />
      </div>

      <div style={{ position: 'relative', zIndex: 10 }}>
        
        {/* Navbar */}
        <header style={{ position: 'sticky', top: 0, background: 'rgba(251, 251, 253, 0.8)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(0,0,0,0.05)', padding: '15px 0', zIndex: 100 }}>
          <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <img src="/logo.png" alt="Avora Logo" style={{ width: '32px', height: '32px' }} />
              <h1 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0, letterSpacing: '-0.5px', color: '#1d1d1f' }}>AVORA</h1>
            </div>
            <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
              <Link to="/login" style={{ textDecoration: 'none', color: '#1d1d1f', fontWeight: 600, fontSize: '0.95rem', padding: '8px 12px' }}>Sign In</Link>
              <Link to="/login" style={{ textDecoration: 'none' }}>
                <button style={{ background: '#1d1d1f', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '100px', fontWeight: 600, fontSize: '0.95rem', cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} onMouseEnter={(e) => e.target.style.transform = 'translateY(-2px)'} onMouseLeave={(e) => e.target.style.transform = 'translateY(0)'}>
                  Get Started
                </button>
              </Link>
            </div>
          </div>
        </header>

        {/* Hero Section */}
        <section style={{ maxWidth: '1200px', margin: '0 auto', padding: '80px 24px 120px 24px', display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '60px', minHeight: 'calc(100vh - 70px)' }} className="hero-section">
          
          <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8, ease: "easeOut" }} style={{ flex: 1 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 16px', background: 'rgba(0, 113, 227, 0.1)', border: '1px solid rgba(0, 113, 227, 0.2)', borderRadius: '100px', color: '#0071e3', fontWeight: 600, fontSize: '0.9rem', marginBottom: '24px' }}>
              <IoFlashOutline /> The New Standard for Finance
            </div>
            <h1 style={{ fontSize: 'clamp(3.5rem, 6vw, 5rem)', fontWeight: 900, lineHeight: 1.05, letterSpacing: '-2px', margin: '0 0 24px 0', color: '#1d1d1f' }}>
              Master your money.<br/>
              <span style={{ background: 'var(--brand-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Split with friends.</span>
            </h1>
            <p style={{ fontSize: 'clamp(1.1rem, 2vw, 1.3rem)', color: '#52525b', lineHeight: 1.6, marginBottom: '40px', maxWidth: '540px' }}>
              Avora beautifully blends personal expense tracking with powerful group bill splitting. Experience financial clarity like never before.
            </p>
            <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
              <Link to="/login" style={{ textDecoration: 'none' }}>
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} style={{ background: 'var(--brand-gradient)', color: 'white', border: 'none', padding: '18px 36px', borderRadius: '100px', fontSize: '1.1rem', fontWeight: 700, cursor: 'pointer', boxShadow: '0 12px 24px rgba(0, 113, 227, 0.3)', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                  Open Avora Free <IoWalletOutline size={20} />
                </motion.button>
              </Link>
            </div>
          </motion.div>

          {/* 3D Interactive Mockup */}
          <div style={{ flex: 1, display: 'flex', justifyContent: 'center', perspective: 1000 }} onMouseMove={handleMouseMove} onMouseLeave={resetMouse} className="hero-mockup">
            <motion.div animate={{ rotateX: mousePos.y, rotateY: mousePos.x }} transition={{ type: 'spring', stiffness: 70, damping: 30 }} style={{ transformStyle: 'preserve-3d', position: 'relative' }}>
              
              {/* Main Card */}
              <div style={{ width: '340px', height: '520px', background: 'rgba(255, 255, 255, 0.8)', backdropFilter: 'blur(30px)', border: '1px solid rgba(255,255,255,0.6)', borderRadius: '32px', boxShadow: '0 30px 60px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,1)', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', transform: 'translateZ(20px)' }}>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <div style={{ width: '40px', height: '40px', background: 'var(--brand-gradient)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold' }}>A</div>
                    <div>
                      <div style={{ fontSize: '0.8rem', color: '#86868b' }}>Good Morning,</div>
                      <div style={{ fontSize: '1rem', fontWeight: 700, color: '#1d1d1f' }}>Alex</div>
                    </div>
                  </div>
                  <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#f5f5f7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <IoPieChartOutline color="#1d1d1f" />
                  </div>
                </div>

                <div style={{ background: '#1d1d1f', borderRadius: '24px', padding: '24px', color: 'white', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }}>
                  <div style={{ fontSize: '0.9rem', opacity: 0.8, marginBottom: '8px' }}>Total Net Worth</div>
                  <div style={{ fontSize: '2.2rem', fontWeight: 800, marginBottom: '20px' }}>₹1,42,500</div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <div style={{ background: 'rgba(255,255,255,0.1)', padding: '8px 12px', borderRadius: '12px', fontSize: '0.8rem' }}>+12% this month</div>
                  </div>
                </div>

                <div>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: '1rem', color: '#1d1d1f' }}>Recent Activity</h4>
                  {[ 
                    { name: 'Goa Trip', amount: '-₹4,500', color: '#ff3b30', icon: '🌴' },
                    { name: 'Salary', amount: '+₹85,000', color: '#34c759', icon: '💼' },
                    { name: 'Netflix', amount: '-₹649', color: '#ff3b30', icon: '🍿' }
                  ].map((item, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: i < 2 ? '1px solid #f0f0f0' : 'none' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '40px', height: '40px', background: '#f5f5f7', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>{item.icon}</div>
                        <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{item.name}</div>
                      </div>
                      <div style={{ fontWeight: 700, color: item.color }}>{item.amount}</div>
                    </div>
                  ))}
                </div>

              </div>

              {/* Floating Element 1 */}
              <motion.div animate={{ y: [0, -10, 0] }} transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }} style={{ position: 'absolute', top: '40px', right: '-40px', background: 'white', padding: '16px 20px', borderRadius: '20px', boxShadow: '0 15px 35px rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', gap: '12px', transform: 'translateZ(60px)' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(52, 199, 89, 0.1)', color: '#34c759', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <IoShieldCheckmarkOutline size={20} />
                </div>
                <div>
                  <div style={{ fontSize: '0.8rem', color: '#86868b' }}>Bill Split</div>
                  <div style={{ fontWeight: 700, color: '#1d1d1f' }}>Settled Up!</div>
                </div>
              </motion.div>

              {/* Floating Element 2 */}
              <motion.div animate={{ y: [0, 15, 0] }} transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }} style={{ position: 'absolute', bottom: '60px', left: '-50px', background: 'white', padding: '16px 20px', borderRadius: '20px', boxShadow: '0 15px 35px rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', gap: '12px', transform: 'translateZ(80px)' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(0, 113, 227, 0.1)', color: '#0071e3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <IoPeopleOutline size={20} />
                </div>
                <div>
                  <div style={{ fontSize: '0.8rem', color: '#86868b' }}>Group Trip</div>
                  <div style={{ fontWeight: 700, color: '#1d1d1f' }}>You owe ₹0</div>
                </div>
              </motion.div>

            </motion.div>
          </div>
        </section>

        {/* Feature Highlights - Bento Box Style */}
        <section style={{ maxWidth: '1200px', margin: '0 auto', padding: '60px 24px' }}>
          <div style={{ textAlign: 'center', marginBottom: '60px' }}>
            <h2 style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 800, color: '#1d1d1f', marginBottom: '16px' }}>Everything you need. <span style={{ color: '#86868b' }}>Nothing you don't.</span></h2>
            <p style={{ fontSize: '1.1rem', color: '#52525b', maxWidth: '600px', margin: '0 auto' }}>Designed meticulously to give you perfect control over personal and shared finances.</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
            
            {/* Bento 1 */}
            <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }} style={{ background: '#fff', borderRadius: '32px', padding: '40px', boxShadow: '0 10px 40px rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.03)', gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: '20px', position: 'relative', overflow: 'hidden' }}>
              <div style={{ zIndex: 1, maxWidth: '400px' }}>
                <div style={{ width: '56px', height: '56px', background: 'rgba(0,113,227,0.1)', color: '#0071e3', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px' }}>
                  <IoWalletOutline size={28} />
                </div>
                <h3 style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: '12px', color: '#1d1d1f' }}>Holistic Wealth Tracking</h3>
                <p style={{ color: '#52525b', fontSize: '1.05rem', lineHeight: 1.6 }}>Connect bank accounts, cash wallets, and credit cards. See your entire financial picture in one beautifully organized dashboard.</p>
              </div>
              <img src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&q=80&w=600" alt="Dashboard" style={{ position: 'absolute', right: '-10%', bottom: '-20%', width: '350px', borderRadius: '24px', boxShadow: '0 20px 40px rgba(0,0,0,0.2)', opacity: 0.8, filter: 'grayscale(0.2)' }} className="bento-img" />
            </motion.div>

            {/* Bento 2 */}
            <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.1 }} style={{ background: '#fff', borderRadius: '32px', padding: '40px', boxShadow: '0 10px 40px rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.03)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ width: '56px', height: '56px', background: 'rgba(52,199,89,0.1)', color: '#34c759', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px' }}>
                <IoPeopleOutline size={28} />
              </div>
              <h3 style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: '12px', color: '#1d1d1f' }}>Smart Group Splits</h3>
              <p style={{ color: '#52525b', fontSize: '1.05rem', lineHeight: 1.6 }}>Split exactly, by percentage, or equally. Our engine minimizes total transactions needed to settle debts.</p>
            </motion.div>

            {/* Bento 3 */}
            <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.2 }} style={{ background: 'var(--brand-gradient)', borderRadius: '32px', padding: '40px', color: 'white', boxShadow: '0 20px 40px rgba(0,113,227,0.2)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ width: '56px', height: '56px', background: 'rgba(255,255,255,0.2)', color: 'white', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px' }}>
                <IoPhonePortraitOutline size={28} />
              </div>
              <h3 style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: '12px' }}>PWA Ready</h3>
              <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: '1.05rem', lineHeight: 1.6 }}>Install Avora directly on your phone's home screen. App-like experience, zero App Store hassle.</p>
            </motion.div>

          </div>
        </section>

        {/* CTA Section */}
        <section style={{ maxWidth: '1000px', margin: '80px auto 100px auto', padding: '0 24px' }}>
          <motion.div initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} style={{ background: '#1d1d1f', borderRadius: '40px', padding: '80px 40px', textAlign: 'center', color: 'white', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: '-50%', left: '50%', transform: 'translateX(-50%)', width: '100%', height: '100%', background: 'radial-gradient(ellipse at bottom, rgba(0,113,227,0.4) 0%, rgba(0,0,0,0) 70%)', pointerEvents: 'none' }}></div>
            
            <h2 style={{ fontSize: 'clamp(2.5rem, 5vw, 4rem)', fontWeight: 900, marginBottom: '20px', position: 'relative', zIndex: 1 }}>Ready to take control?</h2>
            <p style={{ fontSize: '1.2rem', color: '#a1a1a6', marginBottom: '40px', position: 'relative', zIndex: 1, maxWidth: '500px', margin: '0 auto 40px auto' }}>Join thousands of users managing their finances smarter with Avora.</p>
            
            <Link to="/login" style={{ position: 'relative', zIndex: 1, textDecoration: 'none' }}>
              <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} style={{ background: 'white', color: '#1d1d1f', border: 'none', padding: '18px 40px', borderRadius: '100px', fontSize: '1.1rem', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                Create Free Account
              </motion.button>
            </Link>
          </motion.div>
        </section>

        {/* Footer */}
        <footer style={{ borderTop: '1px solid rgba(0,0,0,0.05)', padding: '40px 24px', textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <img src="/logo.png" alt="Avora Logo" style={{ width: '24px', height: '24px', filter: 'grayscale(1)' }} />
            <span style={{ fontWeight: 800, color: '#1d1d1f', letterSpacing: '-0.5px' }}>AVORA</span>
          </div>
          <p style={{ color: '#86868b', fontSize: '0.9rem' }}>© 2026 Avora Inc. All rights reserved.</p>
          <p style={{ color: '#86868b', fontSize: '0.85rem', marginTop: '8px' }}>Made with ❤️ in India.</p>
        </footer>

      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @media (max-width: 768px) {
          .hero-section {
            flex-direction: column !important;
            text-align: center;
            padding-top: 40px !important;
          }
          .hero-section > div {
            display: flex;
            flex-direction: column;
            align-items: center;
          }
          .hero-mockup {
            transform: scale(0.9);
            margin-top: -20px;
          }
          .bento-img {
            display: none;
          }
        }
      `}} />
    </div>
  );
}

export default Home;
