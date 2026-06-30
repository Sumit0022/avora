import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { IoCloseOutline, IoSearchOutline, IoWalletOutline, IoPeopleOutline, IoChevronForward } from 'react-icons/io5';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase';
import { ref, get } from 'firebase/database';
import { useCategories } from '../context/CategoryContext';

function GlobalSearch() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  
  const [transactions, setTransactions] = useState([]);
  const [groups, setGroups] = useState([]);
  
  const inputRef = useRef(null);
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { categories } = useCategories();

  useEffect(() => {
    const handleOpen = () => {
      setIsOpen(true);
      setQuery('');
      if (currentUser) {
        fetchData();
      }
      setTimeout(() => {
        if (inputRef.current) inputRef.current.focus();
      }, 100);
    };

    window.addEventListener('openGlobalSearch', handleOpen);
    return () => window.removeEventListener('openGlobalSearch', handleOpen);
  }, [currentUser]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch Transactions
      const txSnap = await get(ref(db, `transactions/${currentUser.uid}`));
      let txList = [];
      if (txSnap.exists()) {
        const data = txSnap.val();
        txList = Object.keys(data).map(k => ({ id: k, ...data[k] })).sort((a,b) => new Date(b.date) - new Date(a.date));
      }
      setTransactions(txList);

      // Fetch Groups
      const userGroupsSnap = await get(ref(db, `userGroups/${currentUser.uid}`));
      let grpList = [];
      if (userGroupsSnap.exists()) {
        const groupIds = Object.keys(userGroupsSnap.val());
        const groupPromises = groupIds.map(async (gId) => {
          const gSnap = await get(ref(db, `groups/${gId}`));
          if (gSnap.exists()) {
            return { id: gId, ...gSnap.val() };
          }
          return null;
        });
        const resolved = await Promise.all(groupPromises);
        grpList = resolved.filter(g => g !== null);
      }
      setGroups(grpList);
      
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const getCategoryDetails = (tx) => {
    if (tx.type === 'transfer') return { name: 'Transfer', icon: '🔄' };
    if (tx.type === 'save') return { name: 'Saved to Goal', icon: '🎯' };
    const allCats = [...categories.expense, ...categories.income];
    const cat = allCats.find(c => c.id === tx.categoryId);
    return cat || { name: 'Unknown', icon: '📝' };
  };

  const filteredData = () => {
    if (!query.trim()) return { txs: [], grps: [] };
    const q = query.toLowerCase();
    
    const matchedTxs = transactions.filter(tx => {
      const cat = getCategoryDetails(tx);
      const noteMatch = tx.note && tx.note.toLowerCase().includes(q);
      const catMatch = cat.name.toLowerCase().includes(q);
      const amountMatch = tx.amount.toString().includes(q);
      return noteMatch || catMatch || amountMatch;
    }).slice(0, 10); // Limit to 10 for performance

    const matchedGrps = groups.filter(g => {
      return g.name && g.name.toLowerCase().includes(q) || g.type.toLowerCase().includes(q);
    });

    return { txs: matchedTxs, grps: matchedGrps };
  };

  const { txs, grps } = filteredData();
  const hasResults = txs.length > 0 || grps.length > 0;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }} 
          animate={{ opacity: 1, y: 0 }} 
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.2 }}
          style={{ 
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
            background: 'var(--bg-primary)', zIndex: 9999,
            display: 'flex', flexDirection: 'column'
          }}
        >
          {/* Header */}
          <div style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '15px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-glass)' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <IoSearchOutline size={20} color="var(--text-tertiary)" style={{ position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)' }} />
              <input 
                ref={inputRef}
                type="text" 
                value={query} 
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search transactions, groups, amounts..." 
                style={{ width: '100%', padding: '15px 15px 15px 45px', borderRadius: '16px', border: 'none', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '1.05rem', outline: 'none' }}
              />
            </div>
            <button onClick={() => setIsOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-primary)', fontWeight: 600, fontSize: '1rem', cursor: 'pointer', padding: '10px' }}>
              Cancel
            </button>
          </div>

          {/* Results */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
            {loading ? (
              <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', marginTop: '40px' }}>Loading data...</div>
            ) : !query.trim() ? (
              <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', marginTop: '40px' }}>
                <IoSearchOutline size={48} style={{ opacity: 0.2, marginBottom: '10px' }} />
                <p>Type to start searching across everything.</p>
              </div>
            ) : !hasResults ? (
              <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', marginTop: '40px' }}>
                <p>No results found for "{query}"</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
                
                {/* Groups Section */}
                {grps.length > 0 && (
                  <div>
                    <h3 style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '1px' }}>Groups</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {grps.map(g => (
                        <div 
                          key={g.id} 
                          onClick={() => { setIsOpen(false); navigate(`/groups/${g.id}`); }}
                          style={{ background: 'var(--bg-secondary)', borderRadius: '16px', padding: '15px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                            <div style={{ width: '45px', height: '45px', borderRadius: '14px', background: 'rgba(0, 113, 227, 0.1)', color: 'var(--brand-primary)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                              <IoPeopleOutline size={22} />
                            </div>
                            <div>
                              <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600 }}>{g.name}</h4>
                              <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>{g.type} Group</span>
                            </div>
                          </div>
                          <IoChevronForward color="var(--text-tertiary)" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Transactions Section */}
                {txs.length > 0 && (
                  <div>
                    <h3 style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '1px' }}>Transactions</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {txs.map(tx => {
                        const cat = getCategoryDetails(tx);
                        return (
                          <div 
                            key={tx.id} 
                            onClick={() => { setIsOpen(false); navigate('/transactions'); }}
                            style={{ background: 'var(--bg-secondary)', borderRadius: '16px', padding: '15px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                              <div style={{ width: '45px', height: '45px', borderRadius: '14px', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem' }}>
                                {cat.icon}
                              </div>
                              <div>
                                <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600 }}>{tx.note || cat.name}</h4>
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>{new Date(tx.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                              </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <span style={{ fontSize: '1.1rem', fontWeight: 700, color: tx.type === 'expense' ? 'var(--text-primary)' : tx.type === 'income' ? 'var(--success)' : 'var(--text-secondary)' }}>
                                {tx.type === 'expense' ? '-' : tx.type === 'income' ? '+' : ''}₹{Number(tx.amount).toLocaleString('en-IN')}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default GlobalSearch;
