import { useState, useEffect } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { Toaster } from 'react-hot-toast';
import './index.css';
import Home from './pages/Home';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ProfileSetup from './pages/ProfileSetup';
import Layout from './components/Layout';
import Accounts from './pages/Accounts';
import Savings from './pages/Savings';
import Budgets from './pages/Budgets';
import Subscriptions from './pages/Subscriptions';
import Transactions from './pages/Transactions';
import CreditCardBill from './pages/CreditCardBill';
import AccountTransactions from './pages/AccountTransactions';
import Profile from './pages/Profile';
import Groups from './pages/Groups';
import GroupDetails from './pages/GroupDetails';
import LockScreen from './components/LockScreen';
import GlobalSearch from './components/GlobalSearch';
import { IoSearchOutline } from 'react-icons/io5';


function App() {
  const [theme, setTheme] = useState('light');
  const [isLocked, setIsLocked] = useState(false);
  const location = useLocation();

  useEffect(() => {
    let hiddenTime = 0;
    
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        hiddenTime = Date.now();
      } else if (document.visibilityState === 'visible') {
        // 30 seconds grace period
        if (hiddenTime && (Date.now() - hiddenTime > 30000)) {
          setIsLocked(true);
        }
        hiddenTime = 0;
      }
    };
    
    // Also lock on initial load to verify PIN
    setIsLocked(true);

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  useEffect(() => {
    // Check local storage for theme preference, default to light
    const savedTheme = localStorage.getItem('avora-theme') || 'light';
    setTheme(savedTheme);
    document.documentElement.setAttribute('data-theme', savedTheme);
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('avora-theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  const hideHeaderRoutes = ['/login', '/signup', '/profile-setup', '/budgets', '/subscriptions', '/savings', '/transactions', '/groups'];
  const isCreditBillRoute = location.pathname.startsWith('/credit-bill');
  const isAccountTxRoute = location.pathname.startsWith('/account-transactions');
  const isGroupRoute = location.pathname.startsWith('/groups');
  const hideHeader = hideHeaderRoutes.includes(location.pathname) || isCreditBillRoute || isAccountTxRoute || isGroupRoute;

  return (
    <>
      <LockScreen isLocked={isLocked} onUnlock={() => setIsLocked(false)} />
      <GlobalSearch />
      
      <Toaster position="top-center" toastOptions={{ style: { background: 'var(--bg-glass)', color: 'var(--text-primary)', borderRadius: '16px', backdropFilter: 'blur(20px)', border: '1px solid var(--border-subtle)' } }} />
      {!hideHeader && (
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px', maxWidth: '1000px', margin: '0 auto' }}>
          <Link to="/" style={{ textDecoration: 'none' }}>
            <h1 style={{ fontSize: '1.8rem', fontWeight: 900, color: 'var(--text-primary)', margin: 0, letterSpacing: '-1px', display: 'flex', alignItems: 'center', gap: '12px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
              <img src="/logo.png" alt="Avora Logo" className="brand-logo" />
              AVORA
            </h1>
          </Link>
          <button 
            onClick={() => window.dispatchEvent(new Event('openGlobalSearch'))}
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', width: '42px', height: '42px', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer', color: 'var(--text-primary)' }}
          >
            <IoSearchOutline size={22} />
          </button>
        </header>
      )}

      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/profile-setup" element={<ProfileSetup />} />
          
          {/* Protected Routes wrapped in Layout */}
          <Route element={<Layout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/accounts" element={<Accounts />} />
            <Route path="/groups" element={<Groups />} />
            <Route path="/groups/:groupId" element={<GroupDetails />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/savings" element={<Savings />} />
            <Route path="/budgets" element={<Budgets />} />
            <Route path="/subscriptions" element={<Subscriptions />} />
            <Route path="/transactions" element={<Transactions />} />
            <Route path="/credit-bill/:accountId" element={<CreditCardBill />} />
            <Route path="/account-transactions/:accountId" element={<AccountTransactions />} />
          </Route>
        </Routes>
      </AnimatePresence>
    </>
  );
}

export default App;




