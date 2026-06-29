import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase';
import { ref, onValue, push, set, remove, update } from 'firebase/database';
import { motion, AnimatePresence } from 'framer-motion';
import { IoAdd, IoClose, IoPencil, IoTrashOutline } from 'react-icons/io5';
import { useNavigate } from 'react-router-dom';
import AddAccountModal from '../components/AddAccountModal';
import AccountCard from '../components/AccountCard';

function Accounts() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [totalBalance, setTotalBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  
  // Action sheet state
  const [actionAccount, setActionAccount] = useState(null);
  const [editingAccount, setEditingAccount] = useState(null);
  
  // Pay Early state
  const [isPayEarlyModalOpen, setIsPayEarlyModalOpen] = useState(false);
  const [payEarlyAmount, setPayEarlyAmount] = useState('');

  const handlePayEarlySubmit = async (e) => {
    e.preventDefault();
    const amount = Number(payEarlyAmount);
    if (!amount || amount <= 0 || amount > actionAccount.balance) return toast.error('Invalid amount');

    try {
      // Create a transfer transaction
      const txId = push(ref(db, `transactions/${currentUser.uid}`)).key;
      const updates = {};
      updates[`transactions/${currentUser.uid}/${txId}`] = {
        id: txId,
        type: 'transfer', // Treat as a transfer/payment
        amount: amount,
        toAccountId: actionAccount.id,
        note: `Pre-payment / Added Balance`,
        date: new Date().toISOString().split('T')[0],
        time: new Date().toTimeString().slice(0,5),
        createdAt: new Date().toISOString()
      };
      // Reduce the CC debt
      updates[`accounts/${currentUser.uid}/${actionAccount.id}/balance`] = Number(actionAccount.balance) - amount;

      await update(ref(db), updates);
      setIsPayEarlyModalOpen(false);
      setPayEarlyAmount('');
      setActionAccount(null);
    } catch (err) {
      console.error(err);
      toast.error('Failed to add balance');
    }
  };

  useEffect(() => {
    if (!currentUser) return;

    const accountsRef = ref(db, `accounts/${currentUser.uid}`);
    
    // Listen for real-time updates
    const unsubscribe = onValue(accountsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const accountsList = Object.keys(data).map(key => ({
          id: key,
          ...data[key]
        }));
        // Reverse so newest is on top by default, or keep a specific order
        setAccounts(accountsList);
        
        const total = accountsList.reduce((sum, acc) => {
          if (acc.type === 'Credit Card') {
            return sum - (Number(acc.balance) || 0); // CC balance is debt
          }
          return sum + (Number(acc.balance) || 0);
        }, 0);
        setTotalBalance(total);
      } else {
        setAccounts([]);
        setTotalBalance(0);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser]);

  const handleSaveAccount = async (accountData) => {
    try {
      if (editingAccount) {
        // Edit existing
        const accountRef = ref(db, `accounts/${currentUser.uid}/${editingAccount.id}`);
        await update(accountRef, {
          ...accountData,
          updatedAt: new Date().toISOString()
        });
      } else {
        // Create new
        const accountsListRef = ref(db, `accounts/${currentUser.uid}`);
        const newAccountRef = push(accountsListRef);
        await set(newAccountRef, {
          ...accountData,
          createdAt: new Date().toISOString()
        });
      }
      setIsModalOpen(false);
      setEditingAccount(null);
    } catch (error) {
      console.error("Error saving account: ", error);
      toast.error("Failed to save account");
    }
  };

  const handleSwipe = (id) => {
    // Move the swiped card to the back of the array
    setAccounts(prev => {
      const swipedIndex = prev.findIndex(acc => acc.id === id);
      if (swipedIndex === -1) return prev;
      
      const newAccounts = [...prev];
      const [swipedCard] = newAccounts.splice(swipedIndex, 1);
      newAccounts.push(swipedCard); // add to end (bottom of stack)
      return newAccounts;
    });
  };

  const handleHold = (account) => {
    setActionAccount(account);
  };

  const handleEdit = () => {
    setEditingAccount(actionAccount);
    setIsModalOpen(true);
    setActionAccount(null);
  };

  const handleDelete = () => {
    if (window.confirm(`Are you sure you want to delete ${actionAccount.name}? This action is irreversible.`)) {
      const accountRef = ref(db, `accounts/${currentUser.uid}/${actionAccount.id}`);
      remove(accountRef);
      setActionAccount(null);
    }
  };

  const handleCardClick = (account) => {
    navigate(`/account-transactions/${account.id}`);
  };

  if (loading) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>Loading Accounts...</div>;
  }

  return (
    <div className="container" style={{ paddingTop: '20px', paddingBottom: '100px', maxWidth: '450px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <h2 style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.5px' }}>My Wallet</h2>
        <motion.button 
          whileTap={{ scale: 0.9 }}
          onClick={() => { setEditingAccount(null); setIsModalOpen(true); }}
          className="btn-primary" 
          style={{ padding: '10px 18px', display: 'flex', alignItems: 'center', gap: '6px', borderRadius: '24px', fontWeight: 600 }}
        >
          <IoAdd size={20} /> Add
        </motion.button>
      </div>

      {/* 3D Card Stack Container */}
      <div style={{ position: 'relative', height: '420px', marginBottom: '40px', display: 'flex', justifyContent: 'center' }}>
        {accounts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-tertiary)', border: '2px dashed var(--border-subtle)', borderRadius: '24px' }}>
            No cards in your wallet.<br/>Click Add to create one.
          </div>
        ) : (
          accounts.map((account, index) => (
            <AccountCard 
              key={account.id}
              account={account}
              index={index}
              totalCards={accounts.length}
              onSwipe={handleSwipe}
              onClick={handleCardClick}
              onHold={handleHold}
            />
          ))
        )}
      </div>

      {/* Total Balance Summary */}
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        style={{ textAlign: 'center', padding: '20px' }}
      >
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '5px' }}>Total Net Worth</p>
        <h1 style={{ fontSize: '3rem', fontWeight: 800, margin: 0, letterSpacing: '-1px' }}>
          ₹{totalBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </h1>
      </motion.div>

      {/* Add / Edit Account Modal */}
      <AddAccountModal 
        isOpen={isModalOpen} 
        onClose={() => { setIsModalOpen(false); setEditingAccount(null); }} 
        onSave={handleSaveAccount}
        initialData={editingAccount} 
      />

      {/* Pay Early / Add Balance Modal */}
      <AnimatePresence>
        {isPayEarlyModalOpen && actionAccount && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 2000, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} style={{ background: 'var(--bg-primary)', padding: '30px', borderRadius: '24px', width: '90%', maxWidth: '400px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                <h3 style={{ margin: 0 }}>Add Balance</h3>
                <IoClose size={24} style={{ cursor: 'pointer' }} onClick={() => setIsPayEarlyModalOpen(false)} />
              </div>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '20px', fontSize: '0.9rem' }}>
                You have ₹{Number(actionAccount.balance).toLocaleString()} outstanding. Adding balance will restore your available limit.
              </p>
              <form onSubmit={handlePayEarlySubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <input 
                  type="number" value={payEarlyAmount} onChange={e => setPayEarlyAmount(e.target.value)} 
                  placeholder="Amount to add" required max={actionAccount.balance} step="0.01"
                  style={{ width: '100%', padding: '15px', borderRadius: '12px', border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }} 
                />
                <button type="submit" className="btn-primary" style={{ padding: '15px', borderRadius: '12px' }}>Confirm Payment</button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Apple-style Action Sheet for Hold */}
      <AnimatePresence>
        {actionAccount && !isPayEarlyModalOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setActionAccount(null)}
              style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1005 }}
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              style={{
                position: 'fixed', bottom: '20px', left: '20px', right: '20px',
                zIndex: 1006, maxWidth: '400px', margin: '0 auto'
              }}
            >
              <div style={{ background: 'var(--bg-glass)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderRadius: '16px', overflow: 'hidden', marginBottom: '10px' }}>
                
                {actionAccount.type === 'Credit Card' && (
                  <button 
                    onClick={() => setIsPayEarlyModalOpen(true)}
                    style={{ width: '100%', padding: '16px', background: 'transparent', border: 'none', borderBottom: '1px solid var(--border-subtle)', color: 'var(--success)', fontSize: '1.1rem', fontWeight: 600, cursor: 'pointer', display: 'flex', justifyContent: 'center', gap: '8px', alignItems: 'center' }}
                  >
                    <IoAdd size={20} /> Add Balance (Pre-Pay)
                  </button>
                )}

                <button 
                  onClick={handleEdit}
                  style={{ width: '100%', padding: '16px', background: 'transparent', border: 'none', borderBottom: '1px solid var(--border-subtle)', color: 'var(--brand-primary)', fontSize: '1.1rem', fontWeight: 600, cursor: 'pointer', display: 'flex', justifyContent: 'center', gap: '8px', alignItems: 'center' }}
                >
                  <IoPencil size={20} /> Edit Account
                </button>
                <button 
                  onClick={handleDelete}
                  style={{ width: '100%', padding: '16px', background: 'transparent', border: 'none', color: 'var(--danger)', fontSize: '1.1rem', fontWeight: 600, cursor: 'pointer', display: 'flex', justifyContent: 'center', gap: '8px', alignItems: 'center' }}
                >
                  <IoTrashOutline size={20} /> Delete Account
                </button>
              </div>
              <button 
                onClick={() => setActionAccount(null)}
                style={{ width: '100%', padding: '16px', background: 'var(--bg-glass)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: 'none', borderRadius: '16px', color: 'var(--text-primary)', fontSize: '1.1rem', fontWeight: 600, cursor: 'pointer' }}
              >
                Cancel
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

export default Accounts;

