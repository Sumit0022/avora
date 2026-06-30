import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { db } from '../firebase';
import { ref, get, child, onValue, query, orderByChild, limitToLast, remove, update } from 'firebase/database';
import { motion, AnimatePresence } from 'framer-motion';
import { useCategories } from '../context/CategoryContext';
import { IoChevronForward, IoPieChart, IoCalendar, IoWalletOutline, IoEyeOutline, IoEyeOffOutline, IoPeopleOutline, IoTrashOutline, IoPencilOutline, IoDocumentTextOutline } from 'react-icons/io5';
import AddTransactionModal from '../components/AddTransactionModal';
import { processRecurringSubscriptions } from '../utils/subscriptions';
import { useLongPress } from 'use-long-press';
import PwaInstallPrompt from '../components/PwaInstallPrompt';

function Dashboard() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const { categories } = useCategories();
  
  const [profile, setProfile] = useState(null);
  const [netWorth, setNetWorth] = useState(0);
  const [showNetWorth, setShowNetWorth] = useState(false);
  const [recentTransactions, setRecentTransactions] = useState([]);
  
  const [editingTx, setEditingTx] = useState(null);
  const [actionSheetItem, setActionSheetItem] = useState(null);

  const [pendingBills, setPendingBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!currentUser) {
      navigate('/login');
      return;
    }

    processRecurringSubscriptions(currentUser.uid);

    const fetchProfile = async () => {
      try {
        const dbRef = ref(db);
        const fetchPromise = get(child(dbRef, `users/${currentUser.uid}`));
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000));
        const snapshot = await Promise.race([fetchPromise, timeoutPromise]);
        
        if (snapshot.exists()) setProfile(snapshot.val());
        else navigate('/profile-setup');
      } catch (err) {
        if (err.message === 'timeout' || err.message.includes('Client is offline')) setError("Could not connect to Realtime Database.");
        else setError("An error occurred while fetching your profile: " + err.message);
      }
    };

    fetchProfile();

    const accountsRef = ref(db, `accounts/${currentUser.uid}`);
    const unsubAccounts = onValue(accountsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const accList = Object.keys(data).map(k => ({ id: k, ...data[k] }));
        const total = accList.reduce((acc, curr) => curr.type === 'Credit Card' ? acc - Number(curr.balance || 0) : acc + Number(curr.balance || 0), 0);
        setNetWorth(total);

        const hasCC = accList.some(a => a.type === 'Credit Card');
        if (hasCC) {
          get(ref(db, `transactions/${currentUser.uid}`)).then(txSnap => {
            const txData = txSnap.val() || {};
            const txList = Object.keys(txData).map(k => ({ id: k, ...txData[k] }));
            import('../utils/billing').then(({ calculateCreditCardBill }) => {
              const pending = [];
              accList.filter(a => a.type === 'Credit Card').forEach(cc => {
                const bill = calculateCreditCardBill(cc, txList);
                if (bill && (bill.remainingBill > 0)) {
                  pending.push(bill);
                  if (bill.isOverdue) toast(`🚨 URGENT: Your ${bill.accountName} bill of ₹${bill.remainingBill.toLocaleString()} is OVERDUE!`, { icon: '🚨', duration: 8000 });
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

    const txRef = query(ref(db, `transactions/${currentUser.uid}`), orderByChild('createdAt'), limitToLast(5));
    const unsubTx = onValue(txRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const txList = Object.keys(data).map(k => ({ id: k, ...data[k] })).reverse();
        setRecentTransactions(txList);
      } else {
        setRecentTransactions([]);
      }
      setLoading(false);
    });

    return () => { unsubAccounts(); unsubTx(); };
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

  const bindLongPress = useLongPress((event, { context }) => {
    setActionSheetItem(context);
  }, { threshold: 400, cancelOnMovement: true });

  const handleDeletePersonalTx = async (tx) => {
    if (tx.isGroupExpense || tx.isGroupSettlement) {
      toast.error('Group expenses must be deleted from within the Group.');
      setActionSheetItem(null);
      return;
    }
    
    if (!window.confirm("Delete this transaction? It will reverse the balance change.")) return;
    try {
      const updates = {};
      updates[`transactions/${currentUser.uid}/${tx.id}`] = null;
      
      const accSnapshot = await get(ref(db, `accounts/${currentUser.uid}`));
      const currentAccounts = accSnapshot.val() || {};
      
      const goalsSnapshot = await get(ref(db, `goals/${currentUser.uid}`));
      const currentGoals = goalsSnapshot.val() || {};

      const oldAmount = Number(tx.amount);
      if (tx.type === 'expense' && tx.accountId) {
        const acc = currentAccounts[tx.accountId];
        if (acc) updates[`accounts/${currentUser.uid}/${tx.accountId}/balance`] = acc.type === 'Credit Card' ? Number(acc.balance) - oldAmount : Number(acc.balance) + oldAmount;
      } else if (tx.type === 'income' && tx.accountId) {
        const acc = currentAccounts[tx.accountId];
        if (acc) updates[`accounts/${currentUser.uid}/${tx.accountId}/balance`] = acc.type === 'Credit Card' ? Number(acc.balance) + oldAmount : Number(acc.balance) - oldAmount;
      } else if (tx.type === 'transfer' && tx.accountId && tx.toAccountId) {
        const fromAcc = currentAccounts[tx.accountId];
        const toAcc = currentAccounts[tx.toAccountId];
        if (fromAcc) updates[`accounts/${currentUser.uid}/${tx.accountId}/balance`] = fromAcc.type === 'Credit Card' ? Number(fromAcc.balance) - oldAmount : Number(fromAcc.balance) + oldAmount;
        if (toAcc) updates[`accounts/${currentUser.uid}/${tx.toAccountId}/balance`] = toAcc.type === 'Credit Card' ? Number(toAcc.balance) + oldAmount : Number(toAcc.balance) - oldAmount;
      } else if (tx.type === 'save' && tx.accountId && tx.toGoalId) {
        const fromAcc = currentAccounts[tx.accountId];
        const goal = currentGoals[tx.toGoalId];
        if (fromAcc) updates[`accounts/${currentUser.uid}/${tx.accountId}/balance`] = fromAcc.type === 'Credit Card' ? Number(fromAcc.balance) - oldAmount : Number(fromAcc.balance) + oldAmount;
        if (goal) updates[`goals/${currentUser.uid}/${tx.toGoalId}/currentAmount`] = Number(goal.currentAmount) - oldAmount;
      }

      await update(ref(db), updates);
      toast.success('Deleted transaction');
      setActionSheetItem(null);
    } catch (err) {
      toast.error('Failed to delete transaction.');
    }
  };

  const handleEditTx = (tx) => {
    if (tx.isGroupExpense || tx.isGroupSettlement) {
      toast('Manage group transactions within their respective groups.', { icon: 'ℹ️' });
      setActionSheetItem(null);
      return;
    }
    setEditingTx(tx);
    setActionSheetItem(null);
  };

  if (loading) return <div style={{ textAlign: 'center', padding: '50px' }}>Loading Dashboard...</div>;
  if (error) return <div style={{ textAlign: 'center', padding: '50px', color: 'red' }}>{error}</div>;

  return (
    <div className="container">
      <div style={{ marginBottom: '25px' }}>
        <div className="panel" style={{ padding: '24px', background: 'var(--brand-gradient)', color: 'white', border: 'none', boxShadow: '0 10px 30px rgba(0, 113, 227, 0.3)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <h3 style={{ fontSize: '1rem', margin: 0, fontWeight: '500', opacity: 0.9 }}>Net Worth</h3>
            <button onClick={() => setShowNetWorth(!showNetWorth)} style={{ background: 'none', border: 'none', color: 'white', opacity: 0.8, cursor: 'pointer', display: 'flex' }}>
              {showNetWorth ? <IoEyeOffOutline size={20} /> : <IoEyeOutline size={20} />}
            </button>
          </div>
          <div style={{ fontSize: '2.5rem', fontWeight: '700', marginBottom: '10px' }}>
            {showNetWorth ? `₹${netWorth.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '₹ ••••••'}
          </div>
        </div>

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

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '40px' }}>
        <Link to="/budgets" style={{ textDecoration: 'none' }}>
          <div className="panel" style={{ minHeight: '160px', padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', cursor: 'pointer' }}>
            <div style={{ width: '60px', height: '60px', borderRadius: '50%', backgroundColor: 'rgba(0, 113, 227, 0.1)', color: 'var(--brand-primary)', display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '15px' }}><IoPieChart size={32} /></div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '5px' }}>Budgets</h3>
          </div>
        </Link>
        <Link to="/subscriptions" style={{ textDecoration: 'none' }}>
          <div className="panel" style={{ minHeight: '160px', padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', cursor: 'pointer' }}>
            <div style={{ width: '60px', height: '60px', borderRadius: '50%', backgroundColor: 'rgba(255, 149, 0, 0.1)', color: '#FF9500', display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '15px' }}><IoCalendar size={32} /></div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '5px' }}>Subscriptions</h3>
          </div>
        </Link>
        <Link to="/savings" style={{ textDecoration: 'none' }}>
          <div className="panel" style={{ minHeight: '160px', padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', cursor: 'pointer' }}>
            <div style={{ width: '60px', height: '60px', borderRadius: '50%', backgroundColor: 'rgba(52, 199, 89, 0.1)', color: 'var(--success)', display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '15px' }}><IoWalletOutline size={32} /></div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '5px' }}>Savings Goals</h3>
          </div>
        </Link>
        <Link to="/reports" style={{ textDecoration: 'none' }}>
          <div className="panel" style={{ minHeight: '160px', padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', cursor: 'pointer' }}>
            <div style={{ width: '60px', height: '60px', borderRadius: '50%', backgroundColor: 'rgba(175, 82, 222, 0.1)', color: '#AF52DE', display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '15px' }}><IoDocumentTextOutline size={32} /></div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '5px' }}>Reports</h3>
          </div>
        </Link>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 600 }}>Recent Transactions</h3>
          <Link to="/transactions" style={{ textDecoration: 'none', color: 'var(--brand-primary)', fontSize: '0.9rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '2px' }}>See more <IoChevronForward /></Link>
        </div>
        <p style={{fontSize: '0.8rem', color: 'var(--text-tertiary)', marginBottom: '15px'}}>Long-press a transaction to edit or delete.</p>

        <div style={{ background: 'var(--bg-secondary)', borderRadius: '24px', padding: '10px' }}>
          {recentTransactions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-tertiary)' }}>No transactions yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              {recentTransactions.map((tx, idx) => {
                const cat = getCategoryDetails(tx);
                const isGroup = tx.isGroupExpense || tx.isGroupSettlement;
                
                return (
                  <motion.div 
                    key={tx.id}
                    {...bindLongPress({ context: tx })}
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }}
                    style={{ 
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
                      padding: '16px', borderRadius: '16px', background: 'var(--bg-primary)',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.02)', cursor: 'pointer',
                      borderLeft: isGroup ? '4px solid #AF52DE' : 'none',
                      userSelect: 'none'
                    }}
                    whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                      <div style={{ width: '45px', height: '45px', borderRadius: '14px', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem' }}>
                        {isGroup ? <IoPeopleOutline color="#AF52DE" /> : cat.icon}
                      </div>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {tx.note || cat.name}
                        </h4>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', fontWeight: 500 }}>
                          {new Date(tx.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} 
                          {isGroup && ' • Group'}
                        </span>
                      </div>
                    </div>
                    
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '1.1rem', fontWeight: 700, color: tx.type === 'expense' ? 'var(--text-primary)' : tx.type === 'income' ? 'var(--success)' : 'var(--text-secondary)' }}>
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
      
      <AddTransactionModal isOpen={!!editingTx} onClose={() => setEditingTx(null)} initialData={editingTx} />

      <AnimatePresence>
        {actionSheetItem && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 3000, display: 'flex', justifyContent: 'center', alignItems: 'flex-end', backdropFilter: 'blur(5px)' }}>
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 300 }} style={{ background: 'var(--bg-primary)', width: '100%', maxWidth: '600px', borderTopLeftRadius: '32px', borderTopRightRadius: '32px', padding: '30px' }}>
              <h3 style={{ margin: '0 0 20px 0', fontSize: '1.2rem', fontWeight: 700, textAlign: 'center' }}>Manage Transaction</h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <button onClick={() => handleEditTx(actionSheetItem)} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '16px', borderRadius: '16px', background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: 'none', fontSize: '1.1rem', fontWeight: 600, cursor: 'pointer' }}>
                  <IoPencilOutline size={22} /> Edit Transaction
                </button>
                <button onClick={() => handleDeletePersonalTx(actionSheetItem)} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '16px', borderRadius: '16px', background: 'rgba(255, 69, 58, 0.1)', color: 'var(--danger)', border: 'none', fontSize: '1.1rem', fontWeight: 600, cursor: 'pointer' }}>
                  <IoTrashOutline size={22} /> Delete Transaction
                </button>
              </div>
              <button onClick={() => setActionSheetItem(null)} style={{ width: '100%', padding: '16px', borderRadius: '16px', background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: 'none', fontWeight: 700, fontSize: '1.1rem', marginTop: '20px', cursor: 'pointer' }}>Cancel</button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    <PwaInstallPrompt />
    </div>
  );
}

export default Dashboard;
