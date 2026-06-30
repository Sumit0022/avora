import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase';
import { ref, onValue, push, update, get } from 'firebase/database';
import { motion, AnimatePresence } from 'framer-motion';
import { IoAddOutline, IoCloseOutline, IoWalletOutline } from 'react-icons/io5';

import { useNavigate, Link } from 'react-router-dom';
import { IoChevronBack } from 'react-icons/io5';

function Savings() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [goals, setGoals] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [isAdding, setIsAdding] = useState(false);
  
  // New Goal State
  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [icon, setIcon] = useState('🎯');

  // Withdrawal State
  const [withdrawingGoal, setWithdrawingGoal] = useState(null);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [toAccountId, setToAccountId] = useState('');

  useEffect(() => {
    if (!currentUser) return;
    
    // Fetch Goals
    const goalsRef = ref(db, `goals/${currentUser.uid}`);
    const unsubGoals = onValue(goalsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setGoals(Object.keys(data).map(k => ({ id: k, ...data[k] })));
      } else {
        setGoals([]);
      }
    });

    // Fetch Accounts for withdrawal
    const accRef = ref(db, `accounts/${currentUser.uid}`);
    const unsubAcc = onValue(accRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setAccounts(Object.keys(data).map(k => ({ id: k, ...data[k] })));
        if (Object.keys(data).length > 0) setToAccountId(Object.keys(data)[0]);
      }
    });

    return () => {
      unsubGoals();
      unsubAcc();
    };
  }, [currentUser]);

  const handleCreateGoal = async (e) => {
    e.preventDefault();
    if (!name || !targetAmount) return;

    try {
      const goalRef = push(ref(db, `goals/${currentUser.uid}`));
      await update(ref(db), {
        [`goals/${currentUser.uid}/${goalRef.key}`]: {
          id: goalRef.key,
          name,
          targetAmount: Number(targetAmount),
          currentAmount: 0,
          icon,
          createdAt: new Date().toISOString()
        }
      });
      setIsAdding(false);
      setName('');
      setTargetAmount('');
    } catch (err) {
      console.error(err);
      toast.error('Failed to create goal');
    }
  };

  const handleWithdraw = async (e) => {
    e.preventDefault();
    if (!withdrawAmount || Number(withdrawAmount) <= 0 || !toAccountId) return toast.error('Invalid withdrawal');
    if (Number(withdrawAmount) > withdrawingGoal.currentAmount) return toast.error('Insufficient funds in goal');

    try {
      const numAmount = Number(withdrawAmount);
      
      // Update Goal
      const updates = {};
      updates[`goals/${currentUser.uid}/${withdrawingGoal.id}/currentAmount`] = withdrawingGoal.currentAmount - numAmount;
      
      // Update Account
      const accSnapshot = await get(ref(db, `accounts/${currentUser.uid}/${toAccountId}`));
      const acc = accSnapshot.val();
      if (acc) {
        updates[`accounts/${currentUser.uid}/${toAccountId}/balance`] = Number(acc.balance) + numAmount;
      }

      // Log Transaction (Refund/Withdrawal)
      const txId = push(ref(db, `transactions/${currentUser.uid}`)).key;
      updates[`transactions/${currentUser.uid}/${txId}`] = {
        id: txId,
        type: 'income',
        amount: numAmount,
        accountId: toAccountId,
        note: `Withdrawal from ${withdrawingGoal.name} goal`,
        date: new Date().toISOString().split('T')[0],
        time: new Date().toTimeString().slice(0,5),
        createdAt: new Date().toISOString(),
        isGoalWithdrawal: true
      };

      await update(ref(db), updates);
      setWithdrawingGoal(null);
      setWithdrawAmount('');
    } catch (err) {
      console.error(err);
      toast.error('Failed to withdraw');
    }
  };

  return (
    <div style={{ backgroundColor: 'var(--bg-primary)', minHeight: '100vh', paddingBottom: '100px' }}>
      <div className="container" style={{ paddingTop: '20px' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <Link to="/dashboard" style={{ color: 'var(--text-primary)' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--bg-secondary)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <IoChevronBack size={24} />
              </div>
            </Link>
            <h2 style={{ fontSize: '1.8rem', fontWeight: 800, margin: 0 }}>Savings Goals</h2>
          </div>
          <button onClick={() => setIsAdding(true)} className="btn-primary" style={{ padding: '10px 20px', borderRadius: '16px', display: 'flex', gap: '5px', alignItems: 'center' }}>
            <IoAddOutline size={20}/> New Goal
          </button>
        </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
        {goals.map(goal => {
          const progress = Math.min((goal.currentAmount / goal.targetAmount) * 100, 100);
          return (
            <motion.div key={goal.id} className="panel" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                  <div style={{ fontSize: '2.5rem' }}>{goal.icon}</div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.2rem' }}>{goal.name}</h3>
                    <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>₹{goal.currentAmount.toLocaleString()} saved</p>
                  </div>
                </div>
              </div>
              
              <div style={{ height: '12px', background: 'var(--bg-secondary)', borderRadius: '10px', overflow: 'hidden', marginBottom: '10px' }}>
                <motion.div 
                  initial={{ width: 0 }} 
                  animate={{ width: `${progress}%` }} 
                  transition={{ duration: 1 }}
                  style={{ height: '100%', background: progress >= 100 ? 'var(--success)' : 'var(--brand-gradient)', borderRadius: '10px' }}
                />
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-tertiary)', fontSize: '0.85rem', fontWeight: 600 }}>
                <span>{progress.toFixed(1)}%</span>
                <span>Target: ₹{goal.targetAmount.toLocaleString()}</span>
              </div>

              <div style={{ marginTop: '20px', borderTop: '1px solid var(--border-subtle)', paddingTop: '15px' }}>
                <button 
                  onClick={() => setWithdrawingGoal(goal)}
                  disabled={goal.currentAmount <= 0}
                  style={{ width: '100%', padding: '10px', background: 'var(--bg-secondary)', color: goal.currentAmount > 0 ? 'var(--text-primary)' : 'var(--text-tertiary)', border: 'none', borderRadius: '12px', fontWeight: 600, cursor: goal.currentAmount > 0 ? 'pointer' : 'not-allowed' }}
                >
                  Withdraw Funds
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>

      {goals.length === 0 && !isAdding && (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-secondary)' }}>
          <div style={{ fontSize: '4rem', marginBottom: '15px' }}>🐷</div>
          <h3>No savings goals yet</h3>
          <p>Create a goal to start saving for your dreams!</p>
        </div>
      )}

      {/* Add Goal Modal */}
      <AnimatePresence>
        {isAdding && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 2000, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} style={{ background: 'var(--bg-primary)', padding: '30px', borderRadius: '24px', width: '90%', maxWidth: '400px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                <h3 style={{ margin: 0 }}>Create Goal</h3>
                <IoCloseOutline size={24} style={{ cursor: 'pointer' }} onClick={() => setIsAdding(false)} />
              </div>
              <form onSubmit={handleCreateGoal} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Goal Name (e.g., MacBook Pro)" required style={{ width: '100%', padding: '15px', borderRadius: '12px', border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }} />
                <input type="number" value={targetAmount} onChange={e => setTargetAmount(e.target.value)} placeholder="Target Amount (₹)" required style={{ width: '100%', padding: '15px', borderRadius: '12px', border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }} />
                <input type="text" value={icon} onChange={e => setIcon(e.target.value)} placeholder="Emoji Icon (e.g., 💻)" required style={{ width: '100%', padding: '15px', borderRadius: '12px', border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }} />
                <button type="submit" className="btn-primary" style={{ padding: '15px', borderRadius: '12px' }}>Save Goal</button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Withdraw Modal */}
      <AnimatePresence>
        {withdrawingGoal && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 2000, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} style={{ background: 'var(--bg-primary)', padding: '30px', borderRadius: '24px', width: '90%', maxWidth: '400px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                <h3 style={{ margin: 0 }}>Withdraw from {withdrawingGoal.name}</h3>
                <IoCloseOutline size={24} style={{ cursor: 'pointer' }} onClick={() => setWithdrawingGoal(null)} />
              </div>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>Available: ₹{withdrawingGoal.currentAmount.toLocaleString()}</p>
              <form onSubmit={handleWithdraw} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <input type="number" value={withdrawAmount} onChange={e => setWithdrawAmount(e.target.value)} placeholder="Amount to withdraw" max={withdrawingGoal.currentAmount} required style={{ width: '100%', padding: '15px', borderRadius: '12px', border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }} />
                <select value={toAccountId} onChange={e => setToAccountId(e.target.value)} required style={{ width: '100%', padding: '15px', borderRadius: '12px', border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>
                  {accounts.map(a => <option key={a.id} value={a.id}>Transfer to {a.name}</option>)}
                </select>
                <button type="submit" className="btn-primary" style={{ padding: '15px', borderRadius: '12px' }}>Confirm Transfer</button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      </div>
    </div>
  );
}

export default Savings;
