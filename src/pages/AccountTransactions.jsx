import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase';
import { ref, onValue, get } from 'firebase/database';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { IoChevronBack } from 'react-icons/io5';
import { useCategories } from '../context/CategoryContext';
import { motion } from 'framer-motion';
import AddTransactionModal from '../components/AddTransactionModal';

function AccountTransactions() {
  const { accountId } = useParams();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const { categories } = useCategories();
  
  const [account, setAccount] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingTx, setEditingTx] = useState(null);

  useEffect(() => {
    if (!currentUser) return;
    
    // Fetch Account Info
    get(ref(db, `accounts/${currentUser.uid}/${accountId}`)).then(snap => {
      if(snap.exists()) {
        setAccount({ id: accountId, ...snap.val() });
      } else {
        navigate('/accounts');
      }
    });

    const txRef = ref(db, `transactions/${currentUser.uid}`);
    const unsub = onValue(txRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const txList = Object.keys(data)
          .map(k => ({ id: k, ...data[k] }))
          // Filter only transactions related to this account
          .filter(tx => tx.accountId === accountId || tx.toAccountId === accountId)
          .sort((a, b) => {
            const dateDiff = new Date(b.date) - new Date(a.date);
            if (dateDiff !== 0) return dateDiff;
            return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
          });
        setTransactions(txList);
      } else {
        setTransactions([]);
      }
      setLoading(false);
    });
    return () => unsub();
  }, [currentUser, accountId, navigate]);

  const getCategoryDetails = (tx) => {
    if (tx.type === 'transfer') return { name: 'Transfer', icon: '🔄' };
    if (tx.type === 'save') return { name: 'Saved to Goal', icon: '🎯' };
    if (tx.isSubscription) return { name: 'Subscription', icon: '📆' };
    if (tx.isGoalWithdrawal) return { name: 'Goal Withdrawal', icon: '🐷' };
    const allCats = [...categories.expense, ...categories.income];
    const cat = allCats.find(c => c.id === tx.categoryId);
    return cat || { name: 'Unknown', icon: '📝' };
  };

  return (
    <div style={{ backgroundColor: 'var(--bg-primary)', minHeight: '100vh', paddingBottom: '100px' }}>
      
      <div className="container" style={{ paddingTop: '20px' }}>
        <header style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '10px' }}>
          <Link to="/accounts" style={{ color: 'var(--text-primary)', flexShrink: 0 }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--bg-secondary)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <IoChevronBack size={24} />
            </div>
          </Link>
          <div style={{ flex: 1, minWidth: 0, gap: '10px' }}>
            <h2 style={{ fontSize: 'clamp(1.3rem, 5vw, 1.8rem)', fontWeight: 800, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Wallet</h2>
          </div>
        </header>

        {account && (
          <div style={{ marginBottom: '30px', textAlign: 'center' }}>
            <h2 style={{ fontSize: '2rem', fontWeight: 800, margin: '0 0 5px 0' }}>{account.name}</h2>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: 0, textTransform: 'uppercase', letterSpacing: '1px' }}>
               {account.type === 'Credit Card' ? 'Outstanding Debt' : 'Current Balance'}
            </p>
            <h3 style={{ fontSize: '2.5rem', fontWeight: 700, margin: '5px 0 0 0', color: account.type === 'Credit Card' ? 'var(--danger)' : 'var(--text-primary)' }}>
              ₹{Number(account.balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </h3>
          </div>
        )}

        <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '20px' }}>Transaction History</h3>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>Loading...</div>
        ) : transactions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-tertiary)' }}>
            <p>No transactions found for this account.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {transactions.map((tx, idx) => {
              const cat = getCategoryDetails(tx);
              
              // Determine if this transaction acts as an income or expense from the PERSPECTIVE OF THIS ACCOUNT
              let isCredit = false;
              if (tx.type === 'income' && tx.accountId === accountId) isCredit = true;
              if (tx.type === 'transfer' && tx.toAccountId === accountId) isCredit = true;
              // For credit cards, paying the bill (transfer to CC) decreases debt (shows as positive/credit). 
              // Buying things (expense on CC) increases debt (shows as negative/debit).
              
              // Standard debit
              let isDebit = false;
              if (tx.type === 'expense' && tx.accountId === accountId) isDebit = true;
              if (tx.type === 'transfer' && tx.accountId === accountId) isDebit = true;
              if (tx.type === 'save' && tx.accountId === accountId) isDebit = true;

              return (
                <motion.div 
                  key={tx.id}
                  onClick={() => setEditingTx(tx)}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(idx * 0.05, 0.5) }}
                  style={{ 
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
                    padding: '16px', borderRadius: '16px', background: 'var(--bg-secondary)',
                    cursor: 'pointer'
                  }}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <div style={{ 
                      width: '45px', height: '45px', borderRadius: '14px', 
                      background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '1.4rem'
                    }}>
                      {cat.icon}
                    </div>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {tx.note || cat.name}
                      </h4>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', fontWeight: 500 }}>
                        {new Date(tx.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} 
                        {tx.time && ` • ${tx.time}`} • {cat.name}
                      </span>
                    </div>
                  </div>
                  
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ 
                      fontSize: '1.1rem', fontWeight: 700, 
                      color: isCredit ? 'var(--success)' : isDebit ? 'var(--text-primary)' : 'var(--text-secondary)' 
                    }}>
                      {isDebit ? '-' : isCredit ? '+' : ''}₹{Number(tx.amount).toLocaleString('en-IN')}
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      <AddTransactionModal 
        isOpen={!!editingTx} 
        onClose={() => setEditingTx(null)} 
        initialData={editingTx} 
      />
    </div>
  );
}

export default AccountTransactions;
