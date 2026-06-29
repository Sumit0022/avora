import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { IoHomeOutline, IoHome, IoWalletOutline, IoWallet, IoPeopleOutline, IoPeople, IoPersonOutline, IoPerson } from 'react-icons/io5';
import AddTransactionModal from './AddTransactionModal';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase';
import { ref, get } from 'firebase/database';

function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  // Enforce Profile Setup
  useEffect(() => {
    if (currentUser) {
      get(ref(db, `users/${currentUser.uid}`)).then(snap => {
        if (!snap.exists()) {
          navigate('/profile-setup');
        }
      }).catch(err => console.error("Error checking profile:", err));
    }
  }, [currentUser, navigate]);

  // Scroll to top on route change
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  const navItems = [
    { path: '/dashboard', label: 'Home', icon: IoHomeOutline, activeIcon: IoHome },
    { path: '/accounts', label: 'Accounts', icon: IoWalletOutline, activeIcon: IoWallet },
    { path: '/groups', label: 'Groups', icon: IoPeopleOutline, activeIcon: IoPeople },
    { path: '/profile', label: 'Profile', icon: IoPersonOutline, activeIcon: IoPerson },
  ];

  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);

  return (
    <div style={{ paddingBottom: '90px', minHeight: '100vh', position: 'relative' }}>
      {/* Main Content Area */}
      <motion.main 
        key={location.pathname}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
      >
        <Outlet />
      </motion.main>

      {/* Apple-inspired Bottom Tab Bar with FAB */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'center',
        padding: '0 20px 20px 20px',
        zIndex: 1000,
        pointerEvents: 'none' // allow clicking through empty space
      }}>
        <nav className="bottom-tab-bar" style={{ pointerEvents: 'auto', display: 'flex', alignItems: 'center', position: 'relative' }}>
          
          {/* Left Navigation Items */}
          {navItems.slice(0, 2).map((item) => {
            const isActive = location.pathname.startsWith(item.path);
            const Icon = isActive ? item.activeIcon : item.icon;
            return (
              <NavLink key={item.path} to={item.path} className="tab-item" style={{ textDecoration: 'none', WebkitTapHighlightColor: 'transparent' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', color: isActive ? 'var(--brand-primary)' : 'var(--text-tertiary)', transition: 'color 0.2s ease' }}>
                  <motion.div whileTap={{ scale: 0.85 }} transition={{ type: 'spring', stiffness: 400, damping: 25 }}>
                    <Icon size={24} />
                  </motion.div>
                  <span style={{ fontSize: '0.65rem', fontWeight: isActive ? '600' : '500' }}>{item.label}</span>
                </div>
              </NavLink>
            );
          })}

          {/* Center FAB (Floating Action Button) */}
          <div style={{ padding: '0 10px', display: 'flex', justifyContent: 'center', alignItems: 'center', transform: 'translateY(-15px)' }}>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => {
                const isGroupRoute = location.pathname.match(/^\/groups\/([^/]+)$/);
                if (isGroupRoute) {
                  window.dispatchEvent(new Event('openGroupExpenseModal'));
                } else {
                  setIsTransactionModalOpen(true);
                }
              }}
              style={{
                width: '60px', height: '60px',
                borderRadius: '50%',
                background: 'var(--brand-gradient)',
                border: '4px solid var(--bg-primary)',
                color: 'white',
                display: 'flex', justifyContent: 'center', alignItems: 'center',
                boxShadow: '0 10px 20px rgba(0, 113, 227, 0.3)',
                cursor: 'pointer',
                zIndex: 10
              }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 5V19M5 12H19" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </motion.button>
          </div>

          {/* Right Navigation Items */}
          {navItems.slice(2, 4).map((item) => {
            const isActive = location.pathname.startsWith(item.path);
            const Icon = isActive ? item.activeIcon : item.icon;
            return (
              <NavLink key={item.path} to={item.path} className="tab-item" style={{ textDecoration: 'none', WebkitTapHighlightColor: 'transparent' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', color: isActive ? 'var(--brand-primary)' : 'var(--text-tertiary)', transition: 'color 0.2s ease' }}>
                  <motion.div whileTap={{ scale: 0.85 }} transition={{ type: 'spring', stiffness: 400, damping: 25 }}>
                    <Icon size={24} />
                  </motion.div>
                  <span style={{ fontSize: '0.65rem', fontWeight: isActive ? '600' : '500' }}>{item.label}</span>
                </div>
              </NavLink>
            );
          })}

        </nav>
      </div>
      
      <AddTransactionModal 
        isOpen={isTransactionModalOpen} 
        onClose={() => setIsTransactionModalOpen(false)} 
      />
    </div>
  );
}

export default Layout;
