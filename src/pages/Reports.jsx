import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase';
import { ref, get, child } from 'firebase/database';
import { IoChevronBack, IoDownloadOutline, IoPieChart } from 'react-icons/io5';
import { Link } from 'react-router-dom';
import { generatePDFReport } from '../utils/pdfGenerator';
import { useCategories } from '../context/CategoryContext';
import { motion } from 'framer-motion';

function Reports() {
  const { currentUser } = useAuth();
  const { categories } = useCategories();
  const [profile, setProfile] = useState({});
  const [transactions, setTransactions] = useState([]);
  const [netWorth, setNetWorth] = useState(0);
  const [loading, setLoading] = useState(true);
  
  const [range, setRange] = useState('thisMonth');
  const [summary, setSummary] = useState({ income: 0, expense: 0, net: 0 });
  const [filteredTxs, setFilteredTxs] = useState([]);
  const [topCategories, setTopCategories] = useState([]);
  
  useEffect(() => {
    const fetchData = async () => {
      try {
        const profSnap = await get(child(ref(db), `users/${currentUser.uid}`));
        if (profSnap.exists()) setProfile(profSnap.val());
        
        const accSnap = await get(child(ref(db), `accounts/${currentUser.uid}`));
        let currentNetWorth = 0;
        if (accSnap.exists()) {
          const accData = accSnap.val();
          Object.values(accData).forEach(a => {
            currentNetWorth += a.type === 'Credit Card' ? -Number(a.balance || 0) : Number(a.balance || 0);
          });
        }
        setNetWorth(currentNetWorth);
        
        const txSnap = await get(child(ref(db), `transactions/${currentUser.uid}`));
        if (txSnap.exists()) {
          const txData = txSnap.val();
          const txList = Object.keys(txData).map(k => ({ id: k, ...txData[k] }));
          
          const allCats = [...categories.expense, ...categories.income];
          txList.forEach(tx => {
            const cat = allCats.find(c => c.id === tx.categoryId);
            tx.categoryName = cat ? cat.name : (tx.isGroupExpense ? 'Group Expense' : 'Other');
          });
          
          const validTxs = txList.filter(tx => tx.type === 'expense' || tx.type === 'income');
          validTxs.sort((a, b) => new Date(b.date) - new Date(a.date));
          setTransactions(validTxs);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [currentUser, categories]);
  
  useEffect(() => {
    if (!transactions.length) return;
    
    const now = new Date();
    let startDate, endDate;
    
    if (range === 'thisMonth') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    } else if (range === 'lastMonth') {
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      endDate = new Date(now.getFullYear(), now.getMonth(), 0);
    } else if (range === 'thisYear') {
      startDate = new Date(now.getFullYear(), 0, 1);
      endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
    } else {
      startDate = new Date(2000, 0, 1);
      endDate = new Date(2100, 0, 1);
    }
    
    const filtered = transactions.filter(tx => {
      const txDate = new Date(tx.date);
      return txDate >= startDate && txDate <= endDate;
    });
    
    let inc = 0, exp = 0;
    let netIncomeAfterEndDate = 0;
    const catTotals = {};
    
    transactions.forEach(tx => {
      const txDate = new Date(tx.date);
      const amt = Number(tx.amount);
      if (tx.type === 'income') {
        if (txDate >= startDate && txDate <= endDate) inc += amt;
        if (txDate > endDate) netIncomeAfterEndDate += amt;
      }
      if (tx.type === 'expense') {
        if (txDate >= startDate && txDate <= endDate) {
          exp += amt;
          catTotals[tx.categoryName] = (catTotals[tx.categoryName] || 0) + amt;
        }
        if (txDate > endDate) netIncomeAfterEndDate -= amt;
      }
    });
    
    const closingBalance = netWorth - netIncomeAfterEndDate;
    const openingBalance = closingBalance - (inc - exp);
    
    const topCats = Object.keys(catTotals).map(k => ({ name: k, total: catTotals[k] }))
      .sort((a, b) => b.total - a.total).slice(0, 5);
    
    setFilteredTxs(filtered);
    setSummary({ income: inc, expense: exp, net: inc - exp, openingBalance, closingBalance });
    setTopCategories(topCats);
    
  }, [range, transactions, netWorth]);

  const getLogoBase64 = async () => {
    try {
      const response = await fetch('/logo.png');
      const blob = await response.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      return null;
    }
  };

  const handleDownload = async () => {
    if (filteredTxs.length === 0) return alert('No transactions found for this period.');
    
    const now = new Date();
    let startDate, endDate;
    if (range === 'thisMonth') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    } else if (range === 'lastMonth') {
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      endDate = new Date(now.getFullYear(), now.getMonth(), 0);
    } else if (range === 'thisYear') {
      startDate = new Date(now.getFullYear(), 0, 1);
      endDate = new Date(now.getFullYear(), 11, 31);
    }
    
    let rangeStr = 'All Time';
    if (startDate && endDate) {
      const options = { day: '2-digit', month: 'short', year: 'numeric' };
      rangeStr = `${startDate.toLocaleDateString('en-GB', options)} to ${endDate.toLocaleDateString('en-GB', options)}`;
    }
    
    const logoBase64 = await getLogoBase64();
    generatePDFReport(filteredTxs, summary, rangeStr, profile, logoBase64);
  };

  if (loading) return <div style={{ textAlign: 'center', padding: '50px' }}>Loading Reports...</div>;

  return (
    <div className="container" style={{ paddingBottom: '100px' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '30px' }}>
        <Link to="/dashboard" style={{ color: 'var(--text-primary)', flexShrink: 0 }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--bg-secondary)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <IoChevronBack size={24} />
          </div>
        </Link>
        <div style={{ flex: 1, minWidth: 0, gap: '10px' }}>
          <h2 style={{ fontSize: 'clamp(1.3rem, 5vw, 1.8rem)', fontWeight: 800, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Reports</h2>
        </div>
      </header>

      <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '15px', marginBottom: '20px', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
        {['thisMonth', 'lastMonth', 'thisYear', 'allTime'].map(r => (
          <button 
            key={r}
            onClick={() => setRange(r)}
            style={{ 
              padding: '10px 20px', borderRadius: '20px', border: 'none',
              background: range === r ? 'var(--brand-primary)' : 'var(--bg-secondary)',
              color: range === r ? 'white' : 'var(--text-primary)',
              fontWeight: 600, whiteSpace: 'nowrap', cursor: 'pointer',
              boxShadow: range === r ? '0 5px 15px rgba(0, 113, 227, 0.3)' : 'none'
            }}
          >
            {r === 'thisMonth' ? 'This Month' : r === 'lastMonth' ? 'Last Month' : r === 'thisYear' ? 'This Year' : 'All Time'}
          </button>
        ))}
      </div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="panel" style={{ padding: '24px', marginBottom: '30px', background: 'var(--brand-gradient)', color: 'white', border: 'none', boxShadow: '0 10px 30px rgba(0, 113, 227, 0.2)' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '20px', opacity: 0.9 }}>Financial Summary</h3>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div>
            <span style={{ fontSize: '0.85rem', opacity: 0.8 }}>Total Income</span>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#34C759' }}>+₹{summary.income.toLocaleString()}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '0.85rem', opacity: 0.8 }}>Total Expense</span>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#FF453A' }}>-₹{summary.expense.toLocaleString()}</div>
          </div>
        </div>

        <div style={{ padding: '15px', background: 'rgba(255,255,255,0.1)', borderRadius: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '1rem', fontWeight: 600 }}>Net Balance</span>
          <span style={{ fontSize: '1.4rem', fontWeight: 800 }}>
            {summary.net >= 0 ? '+' : ''}₹{summary.net.toLocaleString()}
          </span>
        </div>
      </motion.div>

      <button onClick={handleDownload} className="btn-primary" style={{ width: '100%', padding: '16px', borderRadius: '16px', fontSize: '1.1rem', fontWeight: 700, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px', marginBottom: '30px' }}>
        <IoDownloadOutline size={24} /> Export as PDF
      </button>
      
      <div className="panel" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
          <div style={{ padding: '8px', borderRadius: '10px', background: 'rgba(255, 149, 0, 0.1)', color: '#FF9500' }}>
            <IoPieChart size={20} />
          </div>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 600, margin: 0 }}>Top Expenses</h3>
        </div>
        
        {topCategories.length === 0 ? <p style={{ color: 'var(--text-tertiary)', textAlign: 'center', padding: '20px 0' }}>No expenses found for this period.</p> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {topCategories.map(cat => {
              const percent = Math.round((cat.total / summary.expense) * 100);
              return (
                <div key={cat.name}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{cat.name}</span>
                    <span style={{ fontWeight: 700, color: 'var(--text-secondary)' }}>₹{cat.total.toLocaleString()}</span>
                  </div>
                  <div style={{ width: '100%', height: '8px', background: 'var(--bg-secondary)', borderRadius: '4px', overflow: 'hidden' }}>
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${percent}%` }}
                      transition={{ duration: 1, type: 'spring' }}
                      style={{ height: '100%', background: 'var(--brand-primary)', borderRadius: '4px' }} 
                    />
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '4px', textAlign: 'right' }}>
                    {percent}% of total
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default Reports;
