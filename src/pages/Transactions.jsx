import React, { useState, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase';
import { ref, onValue, get, update } from 'firebase/database';
import { Link, useNavigate } from 'react-router-dom';
import { IoChevronBack, IoFilterOutline, IoCloseOutline, IoPeopleOutline, IoTrashOutline, IoPencilOutline } from 'react-icons/io5';
import { useCategories } from '../context/CategoryContext';
import { motion, AnimatePresence } from 'framer-motion';
import AddTransactionModal from '../components/AddTransactionModal';
import { useLongPress } from 'use-long-press';

function Transactions() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const { categories } = useCategories();
  
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [editingTx, setEditingTx] = useState(null);
  const [actionSheetItem, setActionSheetItem] = useState(null);

  // Filters State
  const [typeFilter, setTypeFilter] = useState('all'); 
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [dateMode, setDateMode] = useState('all'); 
  const [selectedMonth, setSelectedMonth] = useState(''); 
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  
  const [showFilterModal, setShowFilterModal] = useState(false);

  useEffect(() => {
    if (!currentUser) return;
    const txRef = ref(db, `transactions/${currentUser.uid}`);
    const unsub = onValue(txRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const txList = Object.keys(data).map(k => ({ id: k, ...data[k] })).sort((a, b) => {
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
  }, [currentUser]);

  const bindLongPress = useLongPress((event, { context }) => {
    setActionSheetItem(context);
  }, { threshold: 400, cancelOnMovement: true });

  const getCategoryDetails = (tx) => {
    if (tx.type === 'transfer') return { name: 'Transfer', icon: '🔄' };
    if (tx.type === 'save') return { name: 'Saved to Goal', icon: '🎯' };
    if (tx.isSubscription) return { name: 'Subscription', icon: '📆' };
    if (tx.isGoalWithdrawal) return { name: 'Goal Withdrawal', icon: '🐷' };
    const allCats = [...categories.expense, ...categories.income];
    const cat = allCats.find(c => c.id === tx.categoryId);
    return cat || { name: 'Unknown', icon: '📝' };
  };

  const filteredTransactions = useMemo(() => {
    let result = [...transactions];
    if (typeFilter !== 'all') result = result.filter(tx => tx.type === typeFilter);
    if (categoryFilter !== 'all') result = result.filter(tx => tx.categoryId === categoryFilter);
    if (dateMode === 'month' && selectedMonth) {
      result = result.filter(tx => tx.date.startsWith(selectedMonth));
    } else if (dateMode === 'custom' && customStartDate && customEndDate) {
      result = result.filter(tx => tx.date >= customStartDate && tx.date <= customEndDate);
    }
    return result;
  }, [transactions, typeFilter, categoryFilter, dateMode, selectedMonth, customStartDate, customEndDate]);

  const allCategoriesList = [...categories.expense, ...categories.income];

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

  return (
    <div style={{ backgroundColor: 'var(--bg-primary)', minHeight: '100vh', paddingBottom: '100px' }}>
      
      <div style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: 'var(--bg-glass)', backdropFilter: 'blur(10px)', zIndex: 100 }}>
        <button onClick={() => navigate('/dashboard')} style={{ background: 'none', border: 'none', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '1rem', fontWeight: 600, color: 'var(--brand-primary)', cursor: 'pointer' }}>
          <IoChevronBack size={20} /> Home
        </button>
        <button onClick={() => setShowFilterModal(true)} style={{ background: 'var(--bg-secondary)', border: 'none', padding: '8px 12px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', cursor: 'pointer' }}>
          <IoFilterOutline size={18} /> Filters
        </button>
      </div>

      <div className="container" style={{ paddingTop: '10px' }}>
        <h2 style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: '5px' }}>All Transactions</h2>
        <p style={{fontSize: '0.8rem', color: 'var(--text-tertiary)', marginBottom: '20px'}}>Long-press a transaction to edit or delete.</p>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '20px' }}>
          {typeFilter !== 'all' && <div style={{ background: 'var(--brand-primary)', color: 'white', padding: '4px 10px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600 }}>Type: {typeFilter}</div>}
          {categoryFilter !== 'all' && <div style={{ background: 'var(--brand-primary)', color: 'white', padding: '4px 10px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600 }}>Category: {allCategoriesList.find(c=>c.id === categoryFilter)?.name || 'Filtered'}</div>}
          {dateMode === 'month' && selectedMonth && <div style={{ background: 'var(--brand-primary)', color: 'white', padding: '4px 10px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600 }}>Month: {selectedMonth}</div>}
          {dateMode === 'custom' && customStartDate && customEndDate && <div style={{ background: 'var(--brand-primary)', color: 'white', padding: '4px 10px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600 }}>Range: {customStartDate} to {customEndDate}</div>}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>Loading...</div>
        ) : filteredTransactions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-tertiary)' }}>
            <IoFilterOutline size={48} style={{ opacity: 0.5, marginBottom: '10px' }} />
            <p>No transactions found for these filters.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {filteredTransactions.map((tx, idx) => {
              const cat = getCategoryDetails(tx);
              const isGroup = tx.isGroupExpense || tx.isGroupSettlement;
              return (
                <motion.div 
                  key={tx.id}
                  {...bindLongPress({ context: tx })}
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(idx * 0.05, 0.5) }}
                  style={{ 
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
                    padding: '16px', borderRadius: '16px', background: 'var(--bg-secondary)',
                    cursor: 'pointer', borderLeft: isGroup ? '4px solid #AF52DE' : 'none',
                    userSelect: 'none'
                  }}
                  whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <div style={{ width: '45px', height: '45px', borderRadius: '14px', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem' }}>
                      {isGroup ? <IoPeopleOutline color="#AF52DE" /> : cat.icon}
                    </div>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {tx.note || cat.name}
                      </h4>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', fontWeight: 500 }}>
                        {new Date(tx.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} 
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

      <AnimatePresence>
        {showFilterModal && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 2000, display: 'flex', justifyContent: 'center', alignItems: 'flex-end' }}>
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 300 }} style={{ width: '100%', maxWidth: '600px', background: 'var(--bg-primary)', padding: '30px', borderTopLeftRadius: '24px', borderTopRightRadius: '24px', maxHeight: '90vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ margin: 0, fontSize: '1.2rem' }}>Advanced Filters</h3>
                <button onClick={() => setShowFilterModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><IoCloseOutline size={24} /></button>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 600 }}>Transaction Type</label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  {['all', 'expense', 'income', 'save'].map(t => (
                    <button key={t} onClick={() => setTypeFilter(t)} style={{ flex: 1, padding: '10px', borderRadius: '10px', border: 'none', background: typeFilter === t ? 'var(--brand-primary)' : 'var(--bg-secondary)', color: typeFilter === t ? 'white' : 'var(--text-primary)', fontWeight: 600, textTransform: 'capitalize', cursor: 'pointer' }}>{t}</button>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 600 }}>Time Period</label>
                <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                  <button onClick={() => setDateMode('all')} style={{ flex: 1, padding: '10px', borderRadius: '10px', border: 'none', background: dateMode === 'all' ? 'var(--brand-primary)' : 'var(--bg-secondary)', color: dateMode === 'all' ? 'white' : 'var(--text-primary)', fontWeight: 600, cursor: 'pointer' }}>All Time</button>
                  <button onClick={() => setDateMode('month')} style={{ flex: 1, padding: '10px', borderRadius: '10px', border: 'none', background: dateMode === 'month' ? 'var(--brand-primary)' : 'var(--bg-secondary)', color: dateMode === 'month' ? 'white' : 'var(--text-primary)', fontWeight: 600, cursor: 'pointer' }}>Specific Month</button>
                  <button onClick={() => setDateMode('custom')} style={{ flex: 1, padding: '10px', borderRadius: '10px', border: 'none', background: dateMode === 'custom' ? 'var(--brand-primary)' : 'var(--bg-secondary)', color: dateMode === 'custom' ? 'white' : 'var(--text-primary)', fontWeight: 600, cursor: 'pointer' }}>Custom Range</button>
                </div>
                
                {dateMode === 'month' && <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }} />}
                {dateMode === 'custom' && (
                  <div style={{ display: 'flex', gap: '15px' }}>
                    <div style={{ flex: 1 }}><span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>Start Date</span><input type="date" value={customStartDate} onChange={(e) => setCustomStartDate(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }} /></div>
                    <div style={{ flex: 1 }}><span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>End Date</span><input type="date" value={customEndDate} onChange={(e) => setCustomEndDate(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }} /></div>
                  </div>
                )}
              </div>

              <div style={{ marginBottom: '30px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 600 }}>Category</label>
                <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>
                  <option value="all">All Categories</option>
                  <optgroup label="Expenses">{categories.expense.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}</optgroup>
                  <optgroup label="Incomes">{categories.income.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}</optgroup>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '15px' }}>
                <button onClick={() => { setTypeFilter('all'); setCategoryFilter('all'); setDateMode('all'); setSelectedMonth(''); setCustomStartDate(''); setCustomEndDate(''); }} style={{ flex: 1, padding: '15px', borderRadius: '12px', border: 'none', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontWeight: 600, cursor: 'pointer' }}>Reset All</button>
                <button onClick={() => setShowFilterModal(false)} className="btn-primary" style={{ flex: 2, padding: '15px', borderRadius: '12px', border: 'none' }}>Apply Filters</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
    </div>
  );
}

export default Transactions;
