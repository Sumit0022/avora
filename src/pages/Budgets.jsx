import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase';
import { ref, onValue } from 'firebase/database';
import { motion } from 'framer-motion';
import { useCategories } from '../context/CategoryContext';

import { useNavigate, Link } from 'react-router-dom';
import { IoChevronBack } from 'react-icons/io5';

function Budgets() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const { categories } = useCategories();
  const [transactions, setTransactions] = useState([]);
  const [period, setPeriod] = useState('monthly'); // 'monthly', 'yearly', 'all'

  useEffect(() => {
    if (!currentUser) return;
    const txRef = ref(db, `transactions/${currentUser.uid}`);
    const unsubTx = onValue(txRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setTransactions(Object.keys(data).map(k => ({ id: k, ...data[k] })));
      } else {
        setTransactions([]);
      }
    });
    return () => unsubTx();
  }, [currentUser]);

  // Aggregate spending by category
  const aggregatedData = useMemo(() => {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    let filteredTx = transactions.filter(tx => tx.type === 'expense');

    if (period === 'monthly') {
      filteredTx = filteredTx.filter(tx => {
        const txDate = new Date(tx.date);
        return txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear;
      });
    } else if (period === 'yearly') {
      filteredTx = filteredTx.filter(tx => {
        const txDate = new Date(tx.date);
        return txDate.getFullYear() === currentYear;
      });
    }

    const catTotals = {};
    let totalSpent = 0;

    filteredTx.forEach(tx => {
      if (!catTotals[tx.categoryId]) catTotals[tx.categoryId] = 0;
      catTotals[tx.categoryId] += Number(tx.amount);
      totalSpent += Number(tx.amount);
    });

    const categoryArray = Object.keys(catTotals).map(catId => {
      const catDef = categories.expense.find(c => c.id === catId) || { name: 'Uncategorized', icon: '📝', color: 'var(--brand-primary)' };
      return {
        id: catId,
        name: catDef.name,
        icon: catDef.icon,
        color: catDef.color || 'var(--brand-primary)',
        total: catTotals[catId]
      };
    });

    // Sort by highest spending
    categoryArray.sort((a, b) => b.total - a.total);

    return { totalSpent, categories: categoryArray };
  }, [transactions, period, categories]);

  return (
    <div style={{ backgroundColor: 'var(--bg-primary)', minHeight: '100vh', paddingBottom: '100px' }}>
      <div className="container" style={{ paddingTop: '20px' }}>
        <header style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '30px' }}>
          <Link to="/dashboard" style={{ color: 'var(--text-primary)' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--bg-secondary)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <IoChevronBack size={24} />
            </div>
          </Link>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 800, margin: 0 }}>Budget Insights</h2>
        </header>
      
      {/* Period Selector */}
      <div style={{ display: 'flex', background: 'var(--bg-secondary)', borderRadius: '16px', padding: '5px', marginBottom: '30px' }}>
        <button onClick={() => setPeriod('monthly')} style={{ flex: 1, padding: '12px', borderRadius: '12px', border: 'none', background: period === 'monthly' ? 'var(--bg-primary)' : 'transparent', color: period === 'monthly' ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: 600, boxShadow: period === 'monthly' ? '0 4px 10px rgba(0,0,0,0.1)' : 'none', cursor: 'pointer', transition: '0.2s' }}>This Month</button>
        <button onClick={() => setPeriod('yearly')} style={{ flex: 1, padding: '12px', borderRadius: '12px', border: 'none', background: period === 'yearly' ? 'var(--bg-primary)' : 'transparent', color: period === 'yearly' ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: 600, boxShadow: period === 'yearly' ? '0 4px 10px rgba(0,0,0,0.1)' : 'none', cursor: 'pointer', transition: '0.2s' }}>This Year</button>
        <button onClick={() => setPeriod('all')} style={{ flex: 1, padding: '12px', borderRadius: '12px', border: 'none', background: period === 'all' ? 'var(--bg-primary)' : 'transparent', color: period === 'all' ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: 600, boxShadow: period === 'all' ? '0 4px 10px rgba(0,0,0,0.1)' : 'none', cursor: 'pointer', transition: '0.2s' }}>All Time</button>
      </div>

      <div className="panel" style={{ padding: '30px', textAlign: 'center', marginBottom: '30px', background: 'var(--brand-gradient)', color: 'white' }}>
        <p style={{ margin: 0, opacity: 0.9, fontWeight: 500 }}>Total Spent</p>
        <h2 style={{ margin: '10px 0 0', fontSize: '3rem', fontWeight: 800 }}>₹{aggregatedData.totalSpent.toLocaleString('en-IN')}</h2>
      </div>

      <h3 style={{ fontSize: '1.2rem', marginBottom: '15px' }}>Spending by Category</h3>
      
      {aggregatedData.categories.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-tertiary)' }}>No expenses recorded for this period.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {aggregatedData.categories.map((cat, idx) => {
            const percentage = ((cat.total / aggregatedData.totalSpent) * 100).toFixed(1);
            return (
              <motion.div 
                key={cat.id} 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="panel" style={{ padding: '20px' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ fontSize: '1.5rem', background: 'var(--bg-secondary)', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '12px' }}>{cat.icon}</div>
                    <span style={{ fontWeight: 600 }}>{cat.name}</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>₹{cat.total.toLocaleString('en-IN')}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{percentage}%</div>
                  </div>
                </div>
                {/* Progress Bar */}
                <div style={{ height: '8px', background: 'var(--bg-secondary)', borderRadius: '4px', overflow: 'hidden' }}>
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${percentage}%` }}
                    transition={{ duration: 1, delay: idx * 0.1 }}
                    style={{ height: '100%', background: 'var(--brand-primary)', borderRadius: '4px' }}
                  />
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
      </div>
    </div>
  );
}

export default Budgets;
