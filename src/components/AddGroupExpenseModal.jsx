import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { IoClose, IoCalculatorOutline, IoPieChartOutline, IoSwapHorizontalOutline, IoPeopleOutline, IoWalletOutline } from 'react-icons/io5';
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

  // Advanced Splitting State
  const [splitMode, setSplitMode] = useState('equal'); // 'equal', 'exact', 'percentage', 'shares'
  const [customSplits, setCustomSplits] = useState({}); // { uid: number }

  const [accounts, setAccounts] = useState([]);
  const [accountId, setAccountId] = useState('');

  useEffect(() => {
    if (isOpen && currentUser) {
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

      const allUids = members.filter(m => m.status === 'approved').map(m => m.uid);
      setSplitAmong(allUids);
      setSelectAll(true);
      
      setAmount('');
      setNote('');
      setHasGuest(false);
      setDate(new Date().toISOString().split('T')[0]);
      setTime(new Date().toTimeString().slice(0, 5));
      setSplitMode('equal');
      setCustomSplits({});
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

  const handleCustomSplitChange = (uid, value) => {
    setCustomSplits(prev => ({ ...prev, [uid]: value === '' ? '' : Number(value) }));
  };

  const calculateSplitPerPersonEqual = () => {
    if (!amount || isNaN(amount) || splitAmong.length === 0) return 0;
    const numPeople = splitAmong.length + (hasGuest ? 1 : 0);
    return Number(amount) / numPeople;
  };

  const getSplitValidation = () => {
    const numAmount = Number(amount) || 0;
    if (splitMode === 'equal') return { isValid: true, message: '' };

    let currentSum = 0;
    splitAmong.forEach(uid => {
      currentSum += (customSplits[uid] || 0);
    });
    if (hasGuest) {
      currentSum += (customSplits['guest'] || 0);
    }

    if (splitMode === 'exact') {
      const diff = numAmount - currentSum;
      if (Math.abs(diff) < 0.01) return { isValid: true, message: '0.00 left', type: 'success' };
      return { isValid: false, message: `₹${diff.toFixed(2)} left`, type: diff > 0 ? 'warning' : 'error' };
    }
    
    if (splitMode === 'percentage') {
      const diff = 100 - currentSum;
      if (Math.abs(diff) < 0.01) return { isValid: true, message: '0% left', type: 'success' };
      return { isValid: false, message: `${diff.toFixed(1)}% left`, type: diff > 0 ? 'warning' : 'error' };
    }

    if (splitMode === 'shares') {
      if (currentSum === 0) return { isValid: false, message: 'Enter shares', type: 'warning' };
      return { isValid: true, message: `${currentSum} total shares`, type: 'success' };
    }

    return { isValid: true };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!accountId) return toast.error("Please select a personal account to pay from.");
    if (splitAmong.length === 0 && !hasGuest) return toast.error("Please select at least one person for the split.");
    
    const validation = getSplitValidation();
    if (!validation.isValid) return toast.error("Please fix the split distribution before saving.");

    setIsSaving(true);
    try {
      const numAmount = Number(amount);
      const expenseId = push(ref(db, `groupExpenses/${groupId}`)).key;
      
      const splits = {};
      
      if (splitMode === 'equal') {
        const splitAmount = numAmount / (splitAmong.length + (hasGuest ? 1 : 0));
        splitAmong.forEach(uid => splits[uid] = Number(splitAmount.toFixed(2)));
        if (hasGuest) splits['guest'] = Number(splitAmount.toFixed(2));
      } else if (splitMode === 'exact') {
        splitAmong.forEach(uid => splits[uid] = Number((customSplits[uid] || 0).toFixed(2)));
        if (hasGuest) splits['guest'] = Number((customSplits['guest'] || 0).toFixed(2));
      } else if (splitMode === 'percentage') {
        splitAmong.forEach(uid => splits[uid] = Number(((numAmount * (customSplits[uid] || 0)) / 100).toFixed(2)));
        if (hasGuest) splits['guest'] = Number(((numAmount * (customSplits['guest'] || 0)) / 100).toFixed(2));
      } else if (splitMode === 'shares') {
        let totalShares = 0;
        splitAmong.forEach(uid => totalShares += (customSplits[uid] || 0));
        if (hasGuest) totalShares += (customSplits['guest'] || 0);
        
        splitAmong.forEach(uid => splits[uid] = Number(((numAmount * (customSplits[uid] || 0)) / totalShares).toFixed(2)));
        if (hasGuest) splits['guest'] = Number(((numAmount * (customSplits['guest'] || 0)) / totalShares).toFixed(2));
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
        splitMode, // Save the mode used
        splits,
        createdAt: new Date().toISOString(),
        linkedTransactionId: null 
      };

      // Create Personal Transaction linked to this group expense
      const txId = push(ref(db, `transactions/${currentUser.uid}`)).key;
      const transactionData = {
        id: txId,
        type: 'expense',
        amount: numAmount,
        accountId,
        categoryId,
        note: `Group Expense: ${note}`,
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

  const validation = getSplitValidation();

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
              <button type="button" onClick={onClose} style={{ background: 'var(--bg-secondary)', border: 'none', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer' }}>
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
                    style={{ fontSize: 'clamp(1.8rem, 6vw, 3rem)', fontWeight: 800, width: '150px', background: 'transparent', border: 'none', color: 'var(--text-primary)', outline: 'none', textAlign: 'left' }}
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
                  <select value={categoryId} onChange={e => setCategoryId(e.target.value)} required style={{ width: '100%', padding: '16px', borderRadius: '16px', border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '1rem', outline: 'none', WebkitAppearance: 'none' }}>
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
                </div>
                
                {/* Mode Selector */}
                <div style={{ display: 'flex', background: 'var(--bg-primary)', padding: '5px', borderRadius: '16px', marginBottom: '20px' }}>
                  {[
                    { id: 'equal', icon: <IoSwapHorizontalOutline size={16} />, label: 'Equal' },
                    { id: 'exact', icon: <IoCalculatorOutline size={16} />, label: 'Exact' },
                    { id: 'percentage', icon: <IoPieChartOutline size={16} />, label: '%' },
                    { id: 'shares', icon: <IoPeopleOutline size={16} />, label: 'Shares' },
                  ].map(mode => (
                    <button 
                      key={mode.id} type="button" onClick={() => setSplitMode(mode.id)}
                      style={{ flex: 1, padding: '10px 5px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', border: 'none', background: splitMode === mode.id ? 'var(--brand-primary)' : 'transparent', color: splitMode === mode.id ? 'white' : 'var(--text-secondary)', borderRadius: '12px', fontWeight: 600, fontSize: '0.85rem', transition: '0.2s', cursor: 'pointer' }}
                    >
                      {mode.icon} {mode.label}
                    </button>
                  ))}
                </div>

                {splitMode !== 'equal' && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '15px' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, padding: '5px 10px', borderRadius: '8px', background: validation.type === 'success' ? 'rgba(50, 215, 75, 0.1)' : validation.type === 'error' ? 'rgba(255, 69, 58, 0.1)' : 'rgba(255, 159, 10, 0.1)', color: validation.type === 'success' ? '#32D74B' : validation.type === 'error' ? '#FF453A' : '#FF9F0A' }}>
                      {validation.message}
                    </span>
                  </div>
                )}

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: splitMode === 'equal' ? '0' : '15px' }}>
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

                {splitMode === 'equal' && (
                  <div style={{ marginTop: '15px', color: 'var(--brand-primary)', fontWeight: 700, fontSize: '1.1rem', textAlign: 'center', padding: '15px', background: 'var(--bg-primary)', borderRadius: '16px' }}>
                    ₹{calculateSplitPerPersonEqual().toLocaleString('en-IN', { minimumFractionDigits: 2 })} / person
                  </div>
                )}

                {splitMode !== 'equal' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '20px' }}>
                    {splitAmong.map(uid => (
                      <div key={uid} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 15px', background: 'var(--bg-primary)', borderRadius: '12px' }}>
                        <span style={{ fontWeight: 600 }}>{uid === currentUser.uid ? 'You' : (usersInfo[uid]?.name || 'Unknown')}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          {splitMode === 'exact' && <span style={{ color: 'var(--text-secondary)' }}>₹</span>}
                          <input 
                            type="number" value={customSplits[uid] === undefined ? '' : customSplits[uid]} onChange={(e) => handleCustomSplitChange(uid, e.target.value)}
                            placeholder="0" step="0.01"
                            style={{ width: '80px', padding: '8px', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', textAlign: 'right', outline: 'none', fontWeight: 600 }}
                          />
                          {splitMode === 'percentage' && <span style={{ color: 'var(--text-secondary)' }}>%</span>}
                        </div>
                      </div>
                    ))}
                    {hasGuest && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 15px', background: 'rgba(255, 149, 0, 0.1)', borderRadius: '12px', border: '1px solid rgba(255, 149, 0, 0.3)' }}>
                        <span style={{ fontWeight: 600, color: '#FF9500' }}>Guest</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          {splitMode === 'exact' && <span style={{ color: '#FF9500' }}>₹</span>}
                          <input 
                            type="number" value={customSplits['guest'] === undefined ? '' : customSplits['guest']} onChange={(e) => handleCustomSplitChange('guest', e.target.value)}
                            placeholder="0" step="0.01"
                            style={{ width: '80px', padding: '8px', borderRadius: '8px', border: '1px solid rgba(255, 149, 0, 0.3)', background: 'transparent', color: '#FF9500', textAlign: 'right', outline: 'none', fontWeight: 600 }}
                          />
                          {splitMode === 'percentage' && <span style={{ color: '#FF9500' }}>%</span>}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                
                {hasGuest && splitMode === 'equal' && (
                  <p style={{ margin: '15px 0 0 0', fontSize: '0.85rem', color: 'var(--text-tertiary)', textAlign: 'center' }}>
                    Guest share will be factored into the math but will not be recorded as actionable debt.
                  </p>
                )}
              </div>

              <div style={{ textAlign: 'center', fontSize: '0.9rem', color: 'var(--text-secondary)', padding: '10px 0' }}>
                Paid by <strong>You</strong>
              </div>

              <button type="submit" disabled={isSaving || !amount || (splitMode !== 'equal' && !validation.isValid)} className="btn-primary" style={{ padding: '18px', borderRadius: '16px', fontSize: '1.2rem', fontWeight: 800, marginTop: '10px', opacity: (isSaving || !amount || (splitMode !== 'equal' && !validation.isValid)) ? 0.5 : 1 }}>
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
