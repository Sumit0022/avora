import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { IoClose, IoCalculatorOutline, IoPersonOutline, IoPeopleOutline, IoWalletOutline } from 'react-icons/io5';
import { useCategories } from '../context/CategoryContext';
import { db } from '../firebase';
import { ref, push, update, get, onValue } from 'firebase/database';
import { useAuth } from '../context/AuthContext';

function AddGroupExpenseModal({ isOpen, onClose, groupId, members, usersInfo }) {
  const { categories } = useCategories();
  const { currentUser } = useAuth();
  
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState(categories.expense[0]?.id || '');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [time, setTime] = useState(new Date().toTimeString().slice(0, 5));
  
  const [splitAmong, setSplitAmong] = useState([]);
  const [selectAll, setSelectAll] = useState(true);
  const [hasGuest, setHasGuest] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // New state for personal account syncing
  const [accounts, setAccounts] = useState([]);
  const [accountId, setAccountId] = useState('');

  useEffect(() => {
    if (isOpen && currentUser) {
      // Fetch user's personal accounts to deduct from
      const accountsRef = ref(db, `accounts/${currentUser.uid}`);
      onValue(accountsRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          const accList = Object.keys(data).map(k => ({ id: k, ...data[k] }));
          setAccounts(accList);
          if (accList.length > 0 && !accountId) {
            setAccountId(accList[0].id);
          }
        }
      }, { onlyOnce: true });

      // Default to selecting all approved members
      const allUids = members.filter(m => m.status === 'approved').map(m => m.uid);
      setSplitAmong(allUids);
      setSelectAll(true);
      
      // Reset form
      setAmount('');
      setNote('');
      setHasGuest(false);
      setDate(new Date().toISOString().split('T')[0]);
      setTime(new Date().toTimeString().slice(0, 5));
    }
  }, [isOpen, members, currentUser]);

  const handleToggleMember = (uid) => {
    setSplitAmong(prev => {
      const newSplit = prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid];
      setSelectAll(newSplit.length === members.filter(m => m.status === 'approved').length);
      return newSplit;
    });
  };

  const handleToggleAll = () => {
    if (selectAll) {
      setSplitAmong([]);
      setSelectAll(false);
    } else {
      const allUids = members.filter(m => m.status === 'approved').map(m => m.uid);
      setSplitAmong(allUids);
      setSelectAll(true);
    }
  };

  const calculateSplitPerPerson = () => {
    if (!amount || isNaN(amount) || splitAmong.length === 0) return 0;
    const numPeople = splitAmong.length + (hasGuest ? 1 : 0);
    return Number(amount) / numPeople;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!accountId) {
      toast.error("Please select a personal account to pay from.");
      return;
    }
    if (splitAmong.length === 0 && !hasGuest) {
      toast.error("Please select at least one person for the split.");
      return;
    }
    
    setIsSaving(true);
    try {
      const numAmount = Number(amount);
      const expenseId = push(ref(db, `groupExpenses/${groupId}`)).key;
      const numPeople = splitAmong.length + (hasGuest ? 1 : 0);
      const splitAmount = numAmount / numPeople;
      
      const splits = {};
      splitAmong.forEach(uid => {
        splits[uid] = Number(splitAmount.toFixed(2));
      });
      if (hasGuest) {
        splits['guest'] = Number(splitAmount.toFixed(2));
      }

      // Group Expense Data
      const expenseData = {
        id: expenseId,
        amount: numAmount,
        paidBy: currentUser.uid,
        categoryId,
        note,
        date,
        time,
        hasGuest,
        splitAmong,
        splits,
        createdAt: new Date().toISOString(),
        linkedTransactionId: null // We will set this dynamically
      };

      // Create Personal Transaction linked to this group expense
      const txId = push(ref(db, `transactions/${currentUser.uid}`)).key;
      const transactionData = {
        id: txId,
        type: 'expense', // Normal expense on personal dashboard
        amount: numAmount,
        accountId,
        categoryId,
        note: `Group Expense: ${note}`, // Tag it visually in note
        isGroupExpense: true,
        groupId,
        groupExpenseId: expenseId,
        date,
        time,
        createdAt: new Date().toISOString()
      };
      
      expenseData.linkedTransactionId = txId;

      const updates = {};
      updates[`groupExpenses/${groupId}/${expenseId}`] = expenseData;
      updates[`transactions/${currentUser.uid}/${txId}`] = transactionData;

      // Safely fetch and deduct account balance
      const accSnapshot = await get(ref(db, `accounts/${currentUser.uid}/${accountId}`));
      if (accSnapshot.exists()) {
        const acc = accSnapshot.val();
        updates[`accounts/${currentUser.uid}/${accountId}/balance`] = acc.type === 'Credit Card' 
          ? Number(acc.balance) + numAmount 
          : Number(acc.balance) - numAmount;
      }

      await update(ref(db), updates);
      
      toast.success('Group expense added successfully!');
      onClose();
    } catch (err) {
      console.error(err);
      toast.error('Failed to save group expense');
    }
    setIsSaving(false);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 2000, display: 'flex', justifyContent: 'center', alignItems: 'flex-end', backdropFilter: 'blur(5px)' }}>
          <motion.div 
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            style={{ background: 'var(--bg-primary)', width: '100%', maxWidth: '600px', borderTopLeftRadius: '32px', borderTopRightRadius: '32px', padding: '30px', maxHeight: '90vh', overflowY: 'auto' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
              <h3 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800 }}>Add Group Expense</h3>
              <button onClick={onClose} style={{ background: 'var(--bg-secondary)', border: 'none', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer' }}>
                <IoClose size={24} color="var(--text-primary)" />
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Amount Input */}
              <div style={{ textAlign: 'center', padding: '10px 0' }}>
                <label style={{ display: 'block', fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '1px' }}>Total Amount</label>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
                  <span style={{ fontSize: '2.5rem', fontWeight: 700, color: 'var(--text-secondary)' }}>₹</span>
                  <input 
                    type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" required min="1" step="0.01"
                    style={{ fontSize: '3rem', fontWeight: 800, width: '150px', background: 'transparent', border: 'none', color: 'var(--text-primary)', outline: 'none', textAlign: 'left' }}
                  />
                </div>
              </div>
              
              {/* Paid From Account */}
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 600 }}><IoWalletOutline size={16} style={{transform: 'translateY(3px)'}} /> Paid From Account</label>
                <select value={accountId} onChange={e => setAccountId(e.target.value)} required style={{ width: '100%', padding: '16px', borderRadius: '16px', border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '1rem', outline: 'none', WebkitAppearance: 'none' }}>
                  <option value="" disabled>Select personal account...</option>
                  {accounts.map(acc => (
                    <option key={acc.id} value={acc.id}>{acc.name} (₹{acc.type === 'Credit Card' ? Number(acc.creditLimit || 0) - Number(acc.balance || 0) : acc.balance})</option>
                  ))}
                </select>
              </div>

              {/* Basic Info */}
              <div style={{ display: 'flex', gap: '15px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 600 }}>Category</label>
                  <select value={categoryId} onChange={e => setCategoryId(e.target.value)} required style={{ width: '100%', padding: '16px', borderRadius: '16px', border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '1rem', outline: 'none' }}>
                    {categories.expense.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                  </select>
                </div>
              </div>
              
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 600 }}>What was this for?</label>
                <input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Dinner at Olive" required style={{ width: '100%', padding: '16px', borderRadius: '16px', border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '1rem', outline: 'none' }} />
              </div>

              <div style={{ display: 'flex', gap: '15px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 600 }}>Date</label>
                  <input type="date" value={date} onChange={e => setDate(e.target.value)} required style={{ width: '100%', padding: '16px', borderRadius: '16px', border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '1rem', outline: 'none' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 600 }}>Time</label>
                  <input type="time" value={time} onChange={e => setTime(e.target.value)} required style={{ width: '100%', padding: '16px', borderRadius: '16px', border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '1rem', outline: 'none' }} />
                </div>
              </div>

              {/* Split Settings */}
              <div style={{ background: 'var(--bg-secondary)', borderRadius: '24px', padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                  <h4 style={{ margin: 0, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}><IoPeopleOutline size={20} /> Split Among</h4>
                  <div style={{ color: 'var(--brand-primary)', fontWeight: 700, fontSize: '1.1rem' }}>
                    ₹{calculateSplitPerPerson().toLocaleString('en-IN', { minimumFractionDigits: 2 })} / person
                  </div>
                </div>
                
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                  <button type="button" onClick={handleToggleAll} style={{ padding: '8px 16px', borderRadius: '20px', border: '1px solid', borderColor: selectAll ? 'var(--brand-primary)' : 'var(--border-subtle)', background: selectAll ? 'var(--brand-primary)' : 'transparent', color: selectAll ? 'white' : 'var(--text-primary)', fontWeight: 600, transition: 'all 0.2s', cursor: 'pointer' }}>
                    All Members
                  </button>
                  
                  {members.filter(m => m.status === 'approved').map(m => {
                    const isSelected = splitAmong.includes(m.uid);
                    return (
                      <button 
                        key={m.uid} type="button" onClick={() => handleToggleMember(m.uid)}
                        style={{ padding: '8px 16px', borderRadius: '20px', border: '1px solid', borderColor: isSelected ? 'var(--text-primary)' : 'var(--border-subtle)', background: isSelected ? 'var(--text-primary)' : 'transparent', color: isSelected ? 'var(--bg-primary)' : 'var(--text-primary)', fontWeight: 600, transition: 'all 0.2s', cursor: 'pointer' }}
                      >
                        {m.uid === currentUser.uid ? 'You' : (usersInfo[m.uid]?.name || 'Unknown')}
                      </button>
                    );
                  })}
                  
                  <button 
                    type="button" onClick={() => setHasGuest(!hasGuest)}
                    style={{ padding: '8px 16px', borderRadius: '20px', border: '1px solid', borderColor: hasGuest ? '#FF9500' : 'var(--border-subtle)', background: hasGuest ? '#FF9500' : 'transparent', color: hasGuest ? 'white' : 'var(--text-primary)', fontWeight: 600, transition: 'all 0.2s', cursor: 'pointer' }}
                  >
                    + Guest
                  </button>
                </div>
                {hasGuest && (
                  <p style={{ margin: '15px 0 0 0', fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>
                    Guest share will be factored into the math but will not be recorded as actionable debt.
                  </p>
                )}
              </div>

              <div style={{ textAlign: 'center', fontSize: '0.9rem', color: 'var(--text-secondary)', padding: '10px 0' }}>
                Paid by <strong>You</strong>
              </div>

              <button type="submit" disabled={isSaving || !amount} className="btn-primary" style={{ padding: '18px', borderRadius: '16px', fontSize: '1.2rem', fontWeight: 800, marginTop: '10px' }}>
                {isSaving ? 'Adding...' : 'Add Group Expense'}
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export default AddGroupExpenseModal;
