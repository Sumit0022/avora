import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase';
import { ref, onValue } from 'firebase/database';
import { Link, useNavigate } from 'react-router-dom';
import { IoChevronBack, IoFilterOutline, IoCloseOutline } from 'react-icons/io5';
import { useCategories } from '../context/CategoryContext';
import { motion, AnimatePresence } from 'framer-motion';
import AddTransactionModal from '../components/AddTransactionModal';

function Transactions() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const { categories } = useCategories();
  
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingTx, setEditingTx] = useState(null);

  // Filters State
  const [typeFilter, setTypeFilter] = useState('all'); // all, expense, income, save
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [dateMode, setDateMode] = useState('all'); // all, month, custom
  const [selectedMonth, setSelectedMonth] = useState(''); // YYYY-MM
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

    // 1. Type Filter
    if (typeFilter !== 'all') {
      result = result.filter(tx => tx.type === typeFilter);
    }

    // 2. Category Filter
    if (categoryFilter !== 'all') {
      // For 'save' type, we don't have standard category IDs. If they select a category, it implies expense/income.
      result = result.filter(tx => tx.categoryId === categoryFilter);
    }

    // 3. Date Filter
    if (dateMode === 'month' && selectedMonth) {
      result = result.filter(tx => {
        const txDateStr = tx.date; // YYYY-MM-DD
        return txDateStr.startsWith(selectedMonth);
      });
    } else if (dateMode === 'custom' && customStartDate && customEndDate) {
      result = result.filter(tx => {
        return tx.date >= customStartDate && tx.date <= customEndDate;
      });
    }

    return result;
  }, [transactions, typeFilter, categoryFilter, dateMode, selectedMonth, customStartDate, customEndDate]);

  const allCategoriesList = [...categories.expense, ...categories.income];

  return (
    <div style={{ backgroundColor: 'var(--bg-primary)', minHeight: '100vh', paddingBottom: '100px' }}>
      
      {/* Custom Minimal Header */}
      <div style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: 'var(--bg-glass)', backdropFilter: 'blur(10px)', zIndex: 100 }}>
        <button onClick={() => navigate('/dashboard')} style={{ background: 'none', border: 'none', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '1rem', fontWeight: 600, color: 'var(--brand-primary)', cursor: 'pointer' }}>
          <IoChevronBack size={20} /> Home
        </button>
        <button onClick={() => setShowFilterModal(true)} style={{ background: 'var(--bg-secondary)', border: 'none', padding: '8px 12px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', cursor: 'pointer' }}>
          <IoFilterOutline size={18} /> Filters
        </button>
      </div>

      <div className="container" style={{ paddingTop: '10px' }}>
        <h2 style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: '20px' }}>All Transactions</h2>

        {/* Active Filter Chips */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '20px' }}>
          {typeFilter !== 'all' && (
            <div style={{ background: 'var(--brand-primary)', color: 'white', padding: '4px 10px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600 }}>
              Type: {typeFilter}
            </div>
          )}
          {categoryFilter !== 'all' && (
            <div style={{ background: 'var(--brand-primary)', color: 'white', padding: '4px 10px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600 }}>
              Category: {allCategoriesList.find(c=>c.id === categoryFilter)?.name || 'Filtered'}
            </div>
          )}
          {dateMode === 'month' && selectedMonth && (
            <div style={{ background: 'var(--brand-primary)', color: 'white', padding: '4px 10px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600 }}>
              Month: {selectedMonth}
            </div>
          )}
          {dateMode === 'custom' && customStartDate && customEndDate && (
            <div style={{ background: 'var(--brand-primary)', color: 'white', padding: '4px 10px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600 }}>
              Range: {customStartDate} to {customEndDate}
            </div>
          )}
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
              return (
                <motion.div 
                  key={tx.id}
                  onClick={() => setEditingTx(tx)}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(idx * 0.05, 0.5) }} // Cap delay
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

      {/* Filter Modal */}
      <AnimatePresence>
        {showFilterModal && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 2000, display: 'flex', justifyContent: 'center', alignItems: 'flex-end' }}>
            <motion.div 
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              style={{ width: '100%', maxWidth: '600px', background: 'var(--bg-primary)', padding: '30px', borderTopLeftRadius: '24px', borderTopRightRadius: '24px', maxHeight: '90vh', overflowY: 'auto' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ margin: 0, fontSize: '1.2rem' }}>Advanced Filters</h3>
                <button onClick={() => setShowFilterModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><IoCloseOutline size={24} /></button>
              </div>

              {/* Type Filter */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 600 }}>Transaction Type</label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  {['all', 'expense', 'income', 'save'].map(t => (
                    <button key={t} onClick={() => setTypeFilter(t)} style={{ flex: 1, padding: '10px', borderRadius: '10px', border: 'none', background: typeFilter === t ? 'var(--brand-primary)' : 'var(--bg-secondary)', color: typeFilter === t ? 'white' : 'var(--text-primary)', fontWeight: 600, textTransform: 'capitalize', cursor: 'pointer' }}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date Filter */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 600 }}>Time Period</label>
                <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                  <button onClick={() => setDateMode('all')} style={{ flex: 1, padding: '10px', borderRadius: '10px', border: 'none', background: dateMode === 'all' ? 'var(--brand-primary)' : 'var(--bg-secondary)', color: dateMode === 'all' ? 'white' : 'var(--text-primary)', fontWeight: 600, cursor: 'pointer' }}>All Time</button>
                  <button onClick={() => setDateMode('month')} style={{ flex: 1, padding: '10px', borderRadius: '10px', border: 'none', background: dateMode === 'month' ? 'var(--brand-primary)' : 'var(--bg-secondary)', color: dateMode === 'month' ? 'white' : 'var(--text-primary)', fontWeight: 600, cursor: 'pointer' }}>Specific Month</button>
                  <button onClick={() => setDateMode('custom')} style={{ flex: 1, padding: '10px', borderRadius: '10px', border: 'none', background: dateMode === 'custom' ? 'var(--brand-primary)' : 'var(--bg-secondary)', color: dateMode === 'custom' ? 'white' : 'var(--text-primary)', fontWeight: 600, cursor: 'pointer' }}>Custom Range</button>
                </div>
                
                {dateMode === 'month' && (
                  <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }} />
                )}
                {dateMode === 'custom' && (
                  <div style={{ display: 'flex', gap: '15px' }}>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>Start Date</span>
                      <input type="date" value={customStartDate} onChange={(e) => setCustomStartDate(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>End Date</span>
                      <input type="date" value={customEndDate} onChange={(e) => setCustomEndDate(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }} />
                    </div>
                  </div>
                )}
              </div>

              {/* Category Filter */}
              <div style={{ marginBottom: '30px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 600 }}>Category</label>
                <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>
                  <option value="all">All Categories</option>
                  <optgroup label="Expenses">
                    {categories.expense.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                  </optgroup>
                  <optgroup label="Incomes">
                    {categories.income.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                  </optgroup>
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

      <AddTransactionModal 
        isOpen={!!editingTx} 
        onClose={() => setEditingTx(null)} 
        initialData={editingTx} 
      />
    </div>
  );
}

export default Transactions;
