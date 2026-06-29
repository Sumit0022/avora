import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { db } from '../firebase';
import { ref, get, child, onValue, query, orderByChild, limitToLast } from 'firebase/database';
import { motion } from 'framer-motion';
import { useCategories } from '../context/CategoryContext';
import { IoChevronForward, IoPieChart, IoCalendar, IoWalletOutline, IoEyeOutline, IoEyeOffOutline } from 'react-icons/io5';
import AddTransactionModal from '../components/AddTransactionModal';
import { processRecurringSubscriptions } from '../utils/subscriptions';

function Dashboard() {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const { categories } = useCategories();
  
  const [profile, setProfile] = useState(null);
  const [netWorth, setNetWorth] = useState(0);
  const [showNetWorth, setShowNetWorth] = useState(false);
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [editingTx, setEditingTx] = useState(null);
  const [pendingBills, setPendingBills] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!currentUser) {
      navigate('/login');
      return;
    }

    // Process Subscriptions Lazy Eval
    processRecurringSubscriptions(currentUser.uid);

    const fetchProfile = async () => {
      try {
        const dbRef = ref(db);
        const fetchPromise = get(child(dbRef, `users/${currentUser.uid}`));
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('timeout')), 5000)
        );

        const snapshot = await Promise.race([fetchPromise, timeoutPromise]);
        
        if (snapshot.exists()) {
          setProfile(snapshot.val());
        } else {
          navigate('/profile-setup');
        }
      } catch (err) {
        if (err.message === 'timeout' || err.message.includes('Client is offline')) {
          setError("Could not connect to Realtime Database.");
        } else {
          setError("An error occurred while fetching your profile: " + err.message);
        }
      }
    };

    fetchProfile();

    // Listen to Accounts for Net Worth & Billing
    const accountsRef = ref(db, `accounts/${currentUser.uid}`);
    const unsubAccounts = onValue(accountsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const accList = Object.keys(data).map(k => ({ id: k, ...data[k] }));
        
        // Net Worth
        const total = accList.reduce((acc, curr) => {
          if (curr.type === 'Credit Card') return acc - Number(curr.balance || 0);
          return acc + Number(curr.balance || 0);
        }, 0);
        setNetWorth(total);

        // Fetch all transactions for Billing Logic (only if user has a CC)
        const hasCC = accList.some(a => a.type === 'Credit Card');
        if (hasCC) {
          get(ref(db, `transactions/${currentUser.uid}`)).then(txSnap => {
            const txData = txSnap.val() || {};
            const txList = Object.keys(txData).map(k => ({ id: k, ...txData[k] }));
            
            // We need the billing function here
            import('../utils/billing').then(({ calculateCreditCardBill }) => {
              const pending = [];
              accList.filter(a => a.type === 'Credit Card').forEach(cc => {
                const bill = calculateCreditCardBill(cc, txList);
                if (bill && (bill.remainingBill > 0)) {
                  pending.push(bill);
                  // Check overdue
                  if (bill.isOverdue) {
                    alert(`🚨 URGENT: Your ${bill.accountName} bill of ₹${bill.remainingBill.toLocaleString()} is OVERDUE! Please settle it immediately to avoid penalties.`);
                  }
                }
              });
              setPendingBills(pending);
            });
          });
        }
      } else {
        setNetWorth(0);
      }
    });

    // Listen to Transactions
    const txRef = query(ref(db, `transactions/${currentUser.uid}`), orderByChild('createdAt'), limitToLast(5));
    const unsubTx = onValue(txRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        // Reverse to show newest first
        const txList = Object.keys(data).map(k => ({ id: k, ...data[k] })).reverse();
        setRecentTransactions(txList);
      } else {
        setRecentTransactions([]);
      }
      setLoading(false);
    });

    return () => {
      unsubAccounts();
      unsubTx();
    };
  }, [currentUser, navigate]);


  const getCategoryDetails = (tx) => {
    if (tx.type === 'transfer') return { name: 'Transfer', icon: '🔄' };
    if (tx.type === 'save') return { name: 'Saved to Goal', icon: '🎯' };
    if (tx.isSubscription) return { name: 'Subscription', icon: '📆' };
    if (tx.isGoalWithdrawal) return { name: 'Goal Withdrawal', icon: '🐷' };
    const allCats = [...categories.expense, ...categories.income];
    const cat = allCats.find(c => c.id === tx.categoryId);
    return cat || { name: 'Unknown', icon: '📝' };
  };

  if (loading) return <div style={{ textAlign: 'center', padding: '50px' }}>Loading Dashboard...</div>;
  if (error) return <div style={{ textAlign: 'center', padding: '50px', color: 'red' }}>{error}</div>;

  return (
    <div className="container">
      {/* Hero Stats */}
      <div style={{ marginBottom: '25px' }}>
        <div className="panel" style={{ padding: '24px', background: 'var(--brand-gradient)', color: 'white', border: 'none', boxShadow: '0 10px 30px rgba(0, 113, 227, 0.3)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <h3 style={{ fontSize: '1rem', margin: 0, fontWeight: '500', opacity: 0.9 }}>Net Worth</h3>
            <button 
              onClick={() => setShowNetWorth(!showNetWorth)} 
              style={{ background: 'none', border: 'none', color: 'white', opacity: 0.8, cursor: 'pointer', display: 'flex' }}
            >
              {showNetWorth ? <IoEyeOffOutline size={20} /> : <IoEyeOutline size={20} />}
            </button>
          </div>
          <div style={{ fontSize: '2.5rem', fontWeight: '700', marginBottom: '10px' }}>
            {showNetWorth ? `₹${netWorth.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '₹ ••••••'}
          </div>
        </div>

        {/* Dynamic Bill Notices */}
        {pendingBills && pendingBills.map(bill => (
          <div key={bill.accountId} style={{ marginTop: '15px', background: 'var(--bg-secondary)', padding: '16px', borderRadius: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderLeft: bill.isOverdue ? '4px solid var(--danger)' : '4px solid #FF9500' }}>
            <div>
              <h4 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-primary)' }}>{bill.accountName} Bill</h4>
              <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: bill.isOverdue ? 'var(--danger)' : 'var(--text-secondary)' }}>
                {bill.isOverdue ? 'OVERDUE' : `Due by ${new Date(bill.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`}
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>₹{bill.remainingBill.toLocaleString()}</div>
              <Link to={`/credit-bill/${bill.accountId}`} style={{ fontSize: '0.8rem', color: 'var(--brand-primary)', fontWeight: 600, textDecoration: 'none' }}>Pay Now</Link>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Links Grid (50-50 Split and full width) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '40px' }}>
        
        {/* Budgets */}
        <Link to="/budgets" style={{ textDecoration: 'none' }}>
          <div className="panel" style={{ minHeight: '160px', padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', cursor: 'pointer' }}>
            <div style={{ width: '60px', height: '60px', borderRadius: '50%', backgroundColor: 'rgba(0, 113, 227, 0.1)', color: 'var(--brand-primary)', display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '15px' }}>
              <IoPieChart size={32} />
            </div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '5px' }}>Budgets</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Track Spending</p>
          </div>
        </Link>

        {/* Subscriptions */}
        <Link to="/subscriptions" style={{ textDecoration: 'none' }}>
          <div className="panel" style={{ minHeight: '160px', padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', cursor: 'pointer' }}>
            <div style={{ width: '60px', height: '60px', borderRadius: '50%', backgroundColor: 'rgba(255, 149, 0, 0.1)', color: '#FF9500', display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '15px' }}>
              <IoCalendar size={32} />
            </div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '5px' }}>Subscriptions</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Manage Auto-pay</p>
          </div>
        </Link>

        {/* Savings Goals (Full Width Row) */}
        <Link to="/savings" style={{ textDecoration: 'none', gridColumn: '1 / -1' }}>
          <div className="panel" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '20px', cursor: 'pointer' }}>
            <div style={{ width: '50px', height: '50px', borderRadius: '50%', backgroundColor: 'rgba(52, 199, 89, 0.1)', color: 'var(--success)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <IoWalletOutline size={28} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>Savings Goals</h3>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Save for your dreams</p>
            </div>
            <IoChevronForward style={{ marginLeft: 'auto', color: 'var(--text-tertiary)' }} size={24} />
          </div>
        </Link>
      </div>

      {/* Recent Transactions - Minimalist & Clean */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 600 }}>Recent Transactions</h3>
          <Link to="/transactions" style={{ textDecoration: 'none', color: 'var(--brand-primary)', fontSize: '0.9rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '2px' }}>
            See more <IoChevronForward />
          </Link>
        </div>

        <div style={{ background: 'var(--bg-secondary)', borderRadius: '24px', padding: '10px' }}>
          {recentTransactions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-tertiary)' }}>
              No transactions yet. Click the + button below to add one.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              {recentTransactions.map((tx, idx) => {
                const cat = getCategoryDetails(tx);
                return (
                  <motion.div 
                    key={tx.id}
                    onClick={() => setEditingTx(tx)}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    style={{ 
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
                      padding: '16px', borderRadius: '16px', background: 'var(--bg-primary)',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                      cursor: 'pointer'
                    }}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                      <div style={{ 
                        width: '45px', height: '45px', borderRadius: '14px', 
                        background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '1.4rem'
                      }}>
                        {cat.icon}
                      </div>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {tx.note || cat.name}
                        </h4>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', fontWeight: 500 }}>
                          {new Date(tx.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} 
                          {tx.time && ` • ${tx.time}`} • {cat.name}
                        </span>
                      </div>
                    </div>
                    
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ 
                        fontSize: '1.1rem', fontWeight: 700, 
                        color: tx.type === 'expense' ? 'var(--text-primary)' : tx.type === 'income' ? 'var(--success)' : 'var(--text-secondary)' 
                      }}>
                        {tx.type === 'expense' ? '-' : tx.type === 'income' ? '+' : ''}₹{Number(tx.amount).toLocaleString('en-IN')}
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      
      {/* Edit Transaction Modal */}
      <AddTransactionModal 
        isOpen={!!editingTx} 
        onClose={() => setEditingTx(null)} 
        initialData={editingTx} 
      />
    </div>
  );
}

export default Dashboard;

