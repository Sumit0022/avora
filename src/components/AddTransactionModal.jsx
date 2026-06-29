import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { IoClose, IoSettingsOutline, IoSwapHorizontalOutline, IoTrashOutline } from 'react-icons/io5';
import { useCategories } from '../context/CategoryContext';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase';
import { ref, onValue, push, update, get, remove } from 'firebase/database';
import CategoryManagerModal from './CategoryManagerModal';

function AddTransactionModal({ isOpen, onClose, initialData = null }) {
  const { currentUser } = useAuth();
  const { categories } = useCategories();
  
  const [type, setType] = useState('expense');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [toGoalId, setToGoalId] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [time, setTime] = useState(new Date().toTimeString().slice(0,5)); // HH:MM format
  
  const [accounts, setAccounts] = useState([]);
  const [goals, setGoals] = useState([]);
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!currentUser || !isOpen) return;
    
    // Fetch Accounts
    const accountsRef = ref(db, `accounts/${currentUser.uid}`);
    onValue(accountsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const accList = Object.keys(data).map(k => ({ id: k, ...data[k] }));
        setAccounts(accList);
        if (accList.length > 0 && !accountId && !initialData) {
          setAccountId(accList[0].id);
        }
      }
    }, { onlyOnce: true });

    // Fetch Goals
    const goalsRef = ref(db, `goals/${currentUser.uid}`);
    onValue(goalsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setGoals(Object.keys(data).map(k => ({ id: k, ...data[k] })));
      }
    }, { onlyOnce: true });
  }, [currentUser, isOpen, initialData, accountId]);

  // Reset or populate form when opened
  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setType(initialData.type || 'expense');
        setAmount(initialData.amount ? initialData.amount.toString() : '');
        setCategoryId(initialData.categoryId || '');
        setAccountId(initialData.accountId || '');
        setToAccountId(initialData.toAccountId || '');
        setToGoalId(initialData.toGoalId || '');
        setNote(initialData.note || '');
        setDate(initialData.date || new Date().toISOString().split('T')[0]);
        setTime(initialData.time || new Date().toTimeString().slice(0,5));
      } else {
        setAmount('');
        setNote('');
        setCategoryId('');
        setToAccountId('');
        setToGoalId('');
        setTime(new Date().toTimeString().slice(0,5));
      }
    }
  }, [isOpen, initialData]);

  // Helper to reverse an old transaction's balance effect
  const reverseOldTransaction = (oldTx, currentAccountsData, currentGoalsData, updates) => {
    const oldAmount = Number(oldTx.amount);
    if (oldTx.type === 'expense' && oldTx.accountId) {
      const acc = currentAccountsData[oldTx.accountId];
      if (acc) {
        updates[`accounts/${currentUser.uid}/${oldTx.accountId}/balance`] = acc.type === 'Credit Card' 
          ? Number(acc.balance) - oldAmount 
          : Number(acc.balance) + oldAmount;
      }
    } else if (oldTx.type === 'income' && oldTx.accountId) {
      const acc = currentAccountsData[oldTx.accountId];
      if (acc) {
        updates[`accounts/${currentUser.uid}/${oldTx.accountId}/balance`] = acc.type === 'Credit Card'
          ? Number(acc.balance) + oldAmount
          : Number(acc.balance) - oldAmount;
      }
    } else if (oldTx.type === 'transfer' && oldTx.accountId && oldTx.toAccountId) {
      const fromAcc = currentAccountsData[oldTx.accountId];
      const toAcc = currentAccountsData[oldTx.toAccountId];
      if (fromAcc) updates[`accounts/${currentUser.uid}/${oldTx.accountId}/balance`] = fromAcc.type === 'Credit Card' ? Number(fromAcc.balance) - oldAmount : Number(fromAcc.balance) + oldAmount;
      if (toAcc) updates[`accounts/${currentUser.uid}/${oldTx.toAccountId}/balance`] = toAcc.type === 'Credit Card' ? Number(toAcc.balance) + oldAmount : Number(toAcc.balance) - oldAmount;
    } else if (oldTx.type === 'save' && oldTx.accountId && oldTx.toGoalId) {
      const fromAcc = currentAccountsData[oldTx.accountId];
      const goal = currentGoalsData[oldTx.toGoalId];
      if (fromAcc) updates[`accounts/${currentUser.uid}/${oldTx.accountId}/balance`] = fromAcc.type === 'Credit Card' ? Number(fromAcc.balance) - oldAmount : Number(fromAcc.balance) + oldAmount;
      if (goal) updates[`goals/${currentUser.uid}/${oldTx.toGoalId}/currentAmount`] = Number(goal.currentAmount) - oldAmount;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) return alert('Enter a valid amount');
    if (!accountId) return alert('Select an account');
    if (type !== 'transfer' && type !== 'save' && !categoryId) return alert('Select a category');
    if (type === 'transfer' && (!toAccountId || accountId === toAccountId)) return alert('Select a valid destination account');
    if (type === 'save' && !toGoalId) return alert('Select a goal to save into');

    setIsSaving(true);
    try {
      const numAmount = parseFloat(amount);
      const isEditing = !!initialData;
      const txId = isEditing ? initialData.id : push(ref(db, `transactions/${currentUser.uid}`)).key;
      
      const transactionData = {
        id: txId,
        type,
        amount: numAmount,
        accountId,
        categoryId: (type !== 'transfer' && type !== 'save') ? categoryId : null,
        toAccountId: type === 'transfer' ? toAccountId : null,
        toGoalId: type === 'save' ? toGoalId : null,
        note,
        date,
        time,
        createdAt: isEditing ? initialData.createdAt : new Date().toISOString()
      };

      const updates = {};
      updates[`transactions/${currentUser.uid}/${txId}`] = transactionData;

      // Fetch all accounts and goals to ensure we have the absolute latest balances for safe math
      const accSnapshot = await get(ref(db, `accounts/${currentUser.uid}`));
      let currentAccounts = accSnapshot.val() || {};
      
      const goalsSnapshot = await get(ref(db, `goals/${currentUser.uid}`));
      let currentGoals = goalsSnapshot.val() || {};

      if (isEditing) {
        // Reverse the old transaction's effect first using the live data
        reverseOldTransaction(initialData, currentAccounts, currentGoals, updates);
        
        // Mock apply the updates to our local currentAccounts object so the next step calculates correctly
        Object.keys(updates).forEach(path => {
          if (path.startsWith(`accounts/${currentUser.uid}/`)) {
            const accId = path.split('/')[3];
            if (currentAccounts[accId]) {
              currentAccounts[accId].balance = updates[path];
            }
          }
          if (path.startsWith(`goals/${currentUser.uid}/`)) {
            const gId = path.split('/')[3];
            if (currentGoals[gId]) {
              currentGoals[gId].currentAmount = updates[path];
            }
          }
        });
      }

      // Apply the new transaction's effect
      const fromAcc = currentAccounts[accountId];
      if (type === 'expense' && fromAcc) {
        updates[`accounts/${currentUser.uid}/${accountId}/balance`] = fromAcc.type === 'Credit Card' 
          ? Number(fromAcc.balance) + numAmount 
          : Number(fromAcc.balance) - numAmount;
      } else if (type === 'income' && fromAcc) {
        updates[`accounts/${currentUser.uid}/${accountId}/balance`] = fromAcc.type === 'Credit Card'
          ? Number(fromAcc.balance) - numAmount
          : Number(fromAcc.balance) + numAmount;
      } else if (type === 'transfer') {
        const toAcc = currentAccounts[toAccountId];
        if (fromAcc) updates[`accounts/${currentUser.uid}/${accountId}/balance`] = fromAcc.type === 'Credit Card' ? Number(fromAcc.balance) + numAmount : Number(fromAcc.balance) - numAmount;
        if (toAcc) updates[`accounts/${currentUser.uid}/${toAccountId}/balance`] = toAcc.type === 'Credit Card' ? Number(toAcc.balance) - numAmount : Number(toAcc.balance) + numAmount;
      } else if (type === 'save') {
        const goal = currentGoals[toGoalId];
        if (fromAcc) updates[`accounts/${currentUser.uid}/${accountId}/balance`] = fromAcc.type === 'Credit Card' ? Number(fromAcc.balance) + numAmount : Number(fromAcc.balance) - numAmount;
        if (goal) updates[`goals/${currentUser.uid}/${toGoalId}/currentAmount`] = Number(goal.currentAmount) + numAmount;
      }

      await update(ref(db), updates);
      
      setIsSaving(false);
      onClose();
    } catch (error) {
      console.error("Transaction failed", error);
      alert("Failed to save transaction.");
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!initialData || !window.confirm("Are you sure you want to delete this transaction? This will reverse its effect on your account balances.")) return;
    
    setIsSaving(true);
    try {
      const updates = {};
      updates[`transactions/${currentUser.uid}/${initialData.id}`] = null; // Delete it
      
      const accSnapshot = await get(ref(db, `accounts/${currentUser.uid}`));
      const currentAccounts = accSnapshot.val() || {};

      const goalsSnapshot = await get(ref(db, `goals/${currentUser.uid}`));
      const currentGoals = goalsSnapshot.val() || {};
      
      reverseOldTransaction(initialData, currentAccounts, currentGoals, updates);
      
      await update(ref(db), updates);
      setIsSaving(false);
      onClose();
    } catch (error) {
      console.error("Delete failed", error);
      alert("Failed to delete transaction.");
      setIsSaving(false);
    }
  };

  const currentCategories = type === 'expense' ? categories.expense : categories.income;

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={onClose}
              style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 2001 }}
            />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              style={{
                position: 'fixed', bottom: 0, left: 0, right: 0,
                backgroundColor: 'var(--bg-primary)', borderTopLeftRadius: '32px', borderTopRightRadius: '32px',
                padding: '30px', zIndex: 2002, maxHeight: '90vh', overflowY: 'auto', maxWidth: '600px', margin: '0 auto',
                boxShadow: '0 -10px 40px rgba(0,0,0,0.2)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
                <h3 style={{ fontSize: '1.4rem', fontWeight: 700 }}>{initialData ? 'Edit Transaction' : 'New Transaction'}</h3>
                <div style={{ display: 'flex', gap: '10px' }}>
                  {initialData && (
                    <button onClick={handleDelete} style={{ background: 'var(--bg-secondary)', borderRadius: '50%', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '8px', display: 'flex' }}>
                      <IoTrashOutline size={24} />
                    </button>
                  )}
                  <button onClick={onClose} style={{ background: 'var(--bg-secondary)', borderRadius: '50%', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '8px', display: 'flex' }}>
                    <IoClose size={24} />
                  </button>
                </div>
              </div>

              {/* Type Switcher */}
              <div style={{ display: 'flex', background: 'var(--bg-secondary)', borderRadius: '16px', padding: '5px', marginBottom: '25px', pointerEvents: initialData ? 'none' : 'auto', opacity: initialData ? 0.6 : 1, overflowX: 'auto', scrollbarWidth: 'none' }}>
                <button onClick={() => setType('expense')} style={{ flex: 1, minWidth: '80px', padding: '10px', borderRadius: '12px', border: 'none', background: type === 'expense' ? 'var(--bg-primary)' : 'transparent', color: type === 'expense' ? 'var(--danger)' : 'var(--text-secondary)', fontWeight: 600, boxShadow: type === 'expense' ? '0 4px 10px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.2s', cursor: 'pointer' }}>Expense</button>
                <button onClick={() => setType('income')} style={{ flex: 1, minWidth: '80px', padding: '10px', borderRadius: '12px', border: 'none', background: type === 'income' ? 'var(--bg-primary)' : 'transparent', color: type === 'income' ? 'var(--success)' : 'var(--text-secondary)', fontWeight: 600, boxShadow: type === 'income' ? '0 4px 10px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.2s', cursor: 'pointer' }}>Income</button>
                <button onClick={() => setType('transfer')} style={{ flex: 1, minWidth: '80px', padding: '10px', borderRadius: '12px', border: 'none', background: type === 'transfer' ? 'var(--bg-primary)' : 'transparent', color: type === 'transfer' ? 'var(--brand-primary)' : 'var(--text-secondary)', fontWeight: 600, boxShadow: type === 'transfer' ? '0 4px 10px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.2s', cursor: 'pointer' }}>Transfer</button>
                <button onClick={() => setType('save')} style={{ flex: 1, minWidth: '80px', padding: '10px', borderRadius: '12px', border: 'none', background: type === 'save' ? 'var(--bg-primary)' : 'transparent', color: type === 'save' ? '#FF9500' : 'var(--text-secondary)', fontWeight: 600, boxShadow: type === 'save' ? '0 4px 10px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.2s', cursor: 'pointer' }}>Save</button>
              </div>

              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                
                {/* Amount Input */}
                <div style={{ textAlign: 'center', marginBottom: '10px' }}>
                  <label style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '1px' }}>Amount</label>
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'baseline', gap: '5px', marginTop: '10px' }}>
                    <span style={{ fontSize: '2.5rem', fontWeight: 600, color: type === 'expense' ? 'var(--danger)' : type === 'income' ? 'var(--success)' : type === 'save' ? '#FF9500' : 'var(--text-primary)' }}>₹</span>
                    <input 
                      type="number" value={amount} onChange={e => setAmount(e.target.value)}
                      placeholder="0" step="0.01" required autoFocus
                      style={{ 
                        fontSize: '3.5rem', fontWeight: 800, background: 'transparent', border: 'none', color: 'var(--text-primary)', outline: 'none', width: '200px', textAlign: 'left',
                        padding: 0
                      }}
                    />
                  </div>
                </div>

                {/* Account Selection */}
                <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 500 }}>{type === 'transfer' ? 'From Account' : type === 'save' ? 'From Account' : 'Account'}</label>
                    <select value={accountId} onChange={e => setAccountId(e.target.value)} required style={{ width: '100%', padding: '14px', borderRadius: '16px', border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', outline: 'none', fontSize: '1rem', WebkitAppearance: 'none' }}>
                      <option value="" disabled>Select Account</option>
                      {accounts
                        .filter(acc => type === 'income' ? acc.type !== 'Credit Card' : true)
                        .map(acc => <option key={acc.id} value={acc.id}>{acc.name} (₹{acc.type === 'Credit Card' ? Number(acc.creditLimit || 0) - Number(acc.balance || 0) : acc.balance})</option>)
                      }
                    </select>
                  </div>
                  
                  {type === 'transfer' && (
                    <>
                      <div style={{ transform: 'translateY(10px)', color: 'var(--text-tertiary)' }}><IoSwapHorizontalOutline size={24}/></div>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 500 }}>To Account</label>
                        <select value={toAccountId} onChange={e => setToAccountId(e.target.value)} required style={{ width: '100%', padding: '14px', borderRadius: '16px', border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', outline: 'none', fontSize: '1rem', WebkitAppearance: 'none' }}>
                          <option value="" disabled>Select Account</option>
                          {accounts
                            .filter(acc => acc.type !== 'Credit Card')
                            .map(acc => <option key={acc.id} value={acc.id} disabled={acc.id === accountId}>{acc.name}</option>)
                          }
                        </select>
                      </div>
                    </>
                  )}

                  {type === 'save' && (
                    <>
                      <div style={{ transform: 'translateY(10px)', color: 'var(--text-tertiary)' }}>🎯</div>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 500 }}>To Goal</label>
                        <select value={toGoalId} onChange={e => setToGoalId(e.target.value)} required style={{ width: '100%', padding: '14px', borderRadius: '16px', border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', outline: 'none', fontSize: '1rem', WebkitAppearance: 'none' }}>
                          <option value="" disabled>Select Goal</option>
                          {goals.length === 0 && <option disabled>No goals found. Create one first!</option>}
                          {goals.map(g => <option key={g.id} value={g.id}>{g.icon} {g.name}</option>)}
                        </select>
                      </div>
                    </>
                  )}
                </div>

                {/* Categories Grid (Not for transfers/saves) */}
                {(type !== 'transfer' && type !== 'save') && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <label style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 500 }}>Category</label>
                      <button type="button" onClick={() => setIsCategoryManagerOpen(true)} style={{ background: 'none', border: 'none', color: 'var(--brand-primary)', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <IoSettingsOutline size={16}/> Manage
                      </button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                      {currentCategories.map(cat => (
                        <div 
                          key={cat.id} 
                          onClick={() => setCategoryId(cat.id)}
                          style={{ 
                            background: categoryId === cat.id ? 'var(--brand-gradient)' : 'var(--bg-secondary)',
                            color: categoryId === cat.id ? 'white' : 'var(--text-primary)',
                            padding: '12px 5px', borderRadius: '16px', textAlign: 'center', cursor: 'pointer',
                            boxShadow: categoryId === cat.id ? '0 8px 16px rgba(0, 113, 227, 0.3)' : 'none',
                            transition: 'all 0.2s'
                          }}
                        >
                          <div style={{ fontSize: '1.8rem', marginBottom: '5px' }}>{cat.icon}</div>
                          <div style={{ fontSize: '0.7rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cat.name}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '15px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 500 }}>Date</label>
                    <input type="date" value={date} onChange={e => setDate(e.target.value)} required style={{ width: '100%', padding: '14px', borderRadius: '16px', border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', outline: 'none', fontSize: '1rem', WebkitAppearance: 'none' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 500 }}>Time</label>
                    <input type="time" value={time} onChange={e => setTime(e.target.value)} required style={{ width: '100%', padding: '14px', borderRadius: '16px', border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', outline: 'none', fontSize: '1rem', WebkitAppearance: 'none' }} />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 500 }}>Note (Optional)</label>
                  <input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="What was this for?" style={{ width: '100%', padding: '14px', borderRadius: '16px', border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', outline: 'none', fontSize: '1rem' }} />
                </div>

                <button type="submit" disabled={isSaving} className="btn-primary" style={{ width: '100%', marginTop: '10px', padding: '16px', fontSize: '1.2rem', borderRadius: '16px', fontWeight: 700, display: 'flex', justifyContent: 'center' }}>
                  {isSaving ? 'Saving...' : initialData ? 'Save Changes' : 'Save Transaction'}
                </button>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <CategoryManagerModal isOpen={isCategoryManagerOpen} onClose={() => setIsCategoryManagerOpen(false)} />
    </>
  );
}

export default AddTransactionModal;
