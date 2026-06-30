import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { IoClose, IoSwapHorizontalOutline, IoBriefcaseOutline, IoCardOutline, IoPersonOutline, IoWalletOutline } from 'react-icons/io5';
import { db } from '../firebase';
import { ref, push, update, get, onValue } from 'firebase/database';
import { useAuth } from '../context/AuthContext';

function AddLoanModal({ isOpen, onClose }) {
  const { currentUser } = useAuth();
  
  const [type, setType] = useState('taken'); // 'taken' or 'given'
  const [category, setCategory] = useState('Bank'); // 'Bank', 'Credit Card', 'Informal'
  const [personName, setPersonName] = useState('');
  
  const [isOngoing, setIsOngoing] = useState(false); // If true, don't affect wallet balance for principal

  const [principal, setPrincipal] = useState('');
  const [interestRate, setInterestRate] = useState('');
  const [interestType, setInterestType] = useState('reducing'); // 'reducing', 'flat', 'none'
  const [duration, setDuration] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [accounts, setAccounts] = useState([]);
  const [accountId, setAccountId] = useState('');
  const [isSaving, setIsSaving] = useState(false);

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

      setType('taken');
      setCategory('Bank');
      setPersonName('');
      setIsOngoing(false);
      setPrincipal('');
      setInterestRate('');
      setInterestType('reducing');
      setDuration('');
      setStartDate(new Date().toISOString().split('T')[0]);
    }
  }, [isOpen, currentUser]);

  const calculateEMI = () => {
    const P = Number(principal);
    const n = Number(duration);
    if (!P || !n) return 0;

    if (interestType === 'none' || Number(interestRate) === 0) {
      return P / n;
    }

    if (interestType === 'flat') {
      const r_annual = Number(interestRate) / 100;
      const totalInterest = P * r_annual * (n / 12);
      return (P + totalInterest) / n;
    }

    if (interestType === 'reducing') {
      const r_monthly = (Number(interestRate) / 100) / 12;
      // EMI = P * r * (1 + r)^n / ((1 + r)^n - 1)
      const emi = P * r_monthly * Math.pow(1 + r_monthly, n) / (Math.pow(1 + r_monthly, n) - 1);
      return emi;
    }
    return 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isOngoing && !accountId) return toast.error("Please select an account for the disbursement.");
    
    setIsSaving(true);
    try {
      const loanId = push(ref(db, `loans/${currentUser.uid}`)).key;
      const emi = calculateEMI();

      const loanData = {
        id: loanId,
        type,
        category,
        personName,
        isOngoing,
        principalAmount: Number(principal),
        outstandingPrincipal: Number(principal),
        interestRate: Number(interestRate) || 0,
        interestType,
        durationMonths: Number(duration),
        startDate,
        emiAmount: Number(emi.toFixed(2)),
        status: 'active',
        createdAt: new Date().toISOString()
      };

      const updates = {};
      updates[`loans/${currentUser.uid}/${loanId}`] = loanData;

      // If it's a new loan, it affects the wallet balance!
      if (!isOngoing) {
        const accSnapshot = await get(ref(db, `accounts/${currentUser.uid}/${accountId}`));
        if (accSnapshot.exists()) {
          const acc = accSnapshot.val();
          
          let amountChange = Number(principal);
          // If you GIVE a loan, money leaves your account (Expense-like)
          // If you TAKE a loan, money enters your account (Income-like)
          
          if (type === 'given') {
            updates[`accounts/${currentUser.uid}/${accountId}/balance`] = acc.type === 'Credit Card' 
              ? Number(acc.balance) + amountChange // CC balance goes up (more debt)
              : Number(acc.balance) - amountChange;
          } else {
            updates[`accounts/${currentUser.uid}/${accountId}/balance`] = acc.type === 'Credit Card' 
              ? Number(acc.balance) - amountChange 
              : Number(acc.balance) + amountChange;
          }

          // Also log a transaction for it
          const txId = push(ref(db, `transactions/${currentUser.uid}`)).key;
          updates[`transactions/${currentUser.uid}/${txId}`] = {
            id: txId,
            type: type === 'given' ? 'expense' : 'income',
            amount: amountChange,
            accountId,
            categoryId: 'loan_disbursement',
            note: `${type === 'given' ? 'Loan given to' : 'Loan taken from'} ${personName}`,
            date: startDate,
            time: new Date().toTimeString().slice(0, 5),
            isLoanTransaction: true,
            loanId: loanId,
            createdAt: new Date().toISOString()
          };
        }
      }

      await update(ref(db), updates);
      
      toast.success('Loan added successfully!');
      onClose();
    } catch (err) {
      console.error(err);
      toast.error('Failed to save loan');
    }
    setIsSaving(false);
  };

  const emiPreview = calculateEMI();

  return (
    <AnimatePresence>
      {isOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 2000, display: 'flex', justifyContent: 'center', alignItems: 'flex-end', backdropFilter: 'blur(5px)' }}>
          <motion.div 
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            style={{ background: 'var(--bg-primary)', width: '100%', maxWidth: '600px', borderTopLeftRadius: '32px', borderTopRightRadius: '32px', padding: '30px', maxHeight: '90vh', overflowY: 'auto' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
              <h3 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800 }}>Add Loan</h3>
              <button type="button" onClick={onClose} style={{ background: 'var(--bg-secondary)', border: 'none', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer' }}>
                <IoClose size={24} color="var(--text-primary)" />
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Type Selector */}
              <div style={{ display: 'flex', background: 'var(--bg-secondary)', padding: '5px', borderRadius: '16px' }}>
                <button type="button" onClick={() => setType('taken')} style={{ flex: 1, padding: '12px', borderRadius: '12px', border: 'none', background: type === 'taken' ? 'var(--brand-primary)' : 'transparent', color: type === 'taken' ? 'white' : 'var(--text-secondary)', fontWeight: 600, transition: '0.2s', cursor: 'pointer' }}>
                  I Borrowed (Liability)
                </button>
                <button type="button" onClick={() => setType('given')} style={{ flex: 1, padding: '12px', borderRadius: '12px', border: 'none', background: type === 'given' ? 'var(--success)' : 'transparent', color: type === 'given' ? 'white' : 'var(--text-secondary)', fontWeight: 600, transition: '0.2s', cursor: 'pointer' }}>
                  I Lent (Asset)
                </button>
              </div>

              {/* Ongoing Toggle */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255, 149, 0, 0.1)', padding: '15px', borderRadius: '16px', border: '1px solid rgba(255, 149, 0, 0.2)' }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.95rem', color: '#FF9500', fontWeight: 700 }}>Existing / Ongoing Loan?</h4>
                  <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Turn on if this loan is already running so it doesn't affect your current wallet balance.</p>
                </div>
                <div style={{ width: '50px', height: '30px', background: isOngoing ? '#FF9500' : 'var(--border-subtle)', borderRadius: '15px', position: 'relative', cursor: 'pointer', transition: '0.3s' }} onClick={() => setIsOngoing(!isOngoing)}>
                  <div style={{ width: '26px', height: '26px', background: 'white', borderRadius: '50%', position: 'absolute', top: '2px', left: isOngoing ? '22px' : '2px', transition: '0.3s', boxShadow: '0 2px 5px rgba(0,0,0,0.2)' }} />
                </div>
              </div>

              {!isOngoing && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 600 }}><IoWalletOutline size={16} style={{transform: 'translateY(3px)'}} /> Account for Disbursement</label>
                  <select value={accountId} onChange={e => setAccountId(e.target.value)} required={!isOngoing} style={{ width: '100%', padding: '16px', borderRadius: '16px', border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '1rem', outline: 'none', WebkitAppearance: 'none' }}>
                    <option value="" disabled>Select personal account...</option>
                    {accounts.map(acc => (
                      <option key={acc.id} value={acc.id}>{acc.name} (₹{acc.type === 'Credit Card' ? Number(acc.creditLimit || 0) - Number(acc.balance || 0) : acc.balance})</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Category */}
              <div style={{ display: 'flex', gap: '10px' }}>
                {['Bank', 'Credit Card', 'Informal'].map(cat => (
                  <button key={cat} type="button" onClick={() => setCategory(cat)} style={{ flex: 1, padding: '10px', borderRadius: '12px', border: '1px solid', borderColor: category === cat ? 'var(--text-primary)' : 'var(--border-subtle)', background: category === cat ? 'var(--text-primary)' : 'transparent', color: category === cat ? 'var(--bg-primary)' : 'var(--text-primary)', fontWeight: 600, transition: '0.2s', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '5px' }}>
                    {cat === 'Bank' ? <IoBriefcaseOutline /> : cat === 'Credit Card' ? <IoCardOutline /> : <IoPersonOutline />}
                    {cat}
                  </button>
                ))}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 600 }}>{type === 'taken' ? 'Lender Name (Bank/Person)' : 'Borrower Name'}</label>
                <input type="text" value={personName} onChange={e => setPersonName(e.target.value)} placeholder="e.g. HDFC Bank, Rahul" required style={{ width: '100%', padding: '16px', borderRadius: '16px', border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '1rem', outline: 'none' }} />
              </div>

              <div style={{ display: 'flex', gap: '15px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 600 }}>{isOngoing ? 'Outstanding Principal' : 'Principal Amount'}</label>
                  <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-secondary)', borderRadius: '16px', border: '1px solid var(--border-subtle)', padding: '0 15px' }}>
                    <span style={{ fontWeight: 700, color: 'var(--text-secondary)' }}>₹</span>
                    <input type="number" value={principal} onChange={e => setPrincipal(e.target.value)} placeholder="100000" required step="0.01" style={{ width: '100%', padding: '16px 10px', border: 'none', background: 'transparent', color: 'var(--text-primary)', fontSize: '1rem', outline: 'none' }} />
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 600 }}>Duration (Months)</label>
                  <input type="number" value={duration} onChange={e => setDuration(e.target.value)} placeholder="12" required style={{ width: '100%', padding: '16px', borderRadius: '16px', border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '1rem', outline: 'none' }} />
                </div>
              </div>

              <div style={{ background: 'var(--bg-secondary)', padding: '15px', borderRadius: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.9rem', color: 'var(--text-primary)', marginBottom: '15px', fontWeight: 700 }}>Interest Details</label>
                
                <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                  <button type="button" onClick={() => setInterestType('reducing')} style={{ flex: 1, padding: '10px', borderRadius: '12px', border: '1px solid', borderColor: interestType === 'reducing' ? 'var(--brand-primary)' : 'var(--border-subtle)', background: interestType === 'reducing' ? 'rgba(0, 113, 227, 0.1)' : 'transparent', color: interestType === 'reducing' ? 'var(--brand-primary)' : 'var(--text-secondary)', fontWeight: 600, transition: '0.2s', cursor: 'pointer' }}>
                    Reducing
                  </button>
                  <button type="button" onClick={() => setInterestType('flat')} style={{ flex: 1, padding: '10px', borderRadius: '12px', border: '1px solid', borderColor: interestType === 'flat' ? 'var(--brand-primary)' : 'var(--border-subtle)', background: interestType === 'flat' ? 'rgba(0, 113, 227, 0.1)' : 'transparent', color: interestType === 'flat' ? 'var(--brand-primary)' : 'var(--text-secondary)', fontWeight: 600, transition: '0.2s', cursor: 'pointer' }}>
                    Flat
                  </button>
                  <button type="button" onClick={() => {setInterestType('none'); setInterestRate('0');}} style={{ flex: 1, padding: '10px', borderRadius: '12px', border: '1px solid', borderColor: interestType === 'none' ? 'var(--brand-primary)' : 'var(--border-subtle)', background: interestType === 'none' ? 'rgba(0, 113, 227, 0.1)' : 'transparent', color: interestType === 'none' ? 'var(--brand-primary)' : 'var(--text-secondary)', fontWeight: 600, transition: '0.2s', cursor: 'pointer' }}>
                    0%
                  </button>
                </div>

                {interestType !== 'none' && (
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 600 }}>Annual Interest Rate (%)</label>
                    <input type="number" value={interestRate} onChange={e => setInterestRate(e.target.value)} placeholder="12.5" required step="0.01" style={{ width: '100%', padding: '16px', borderRadius: '16px', border: '1px solid var(--border-subtle)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '1rem', outline: 'none' }} />
                  </div>
                )}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 600 }}>Start Date</label>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required style={{ width: '100%', padding: '16px', borderRadius: '16px', border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '1rem', outline: 'none' }} />
              </div>

              {principal && duration && (
                <div style={{ background: 'var(--bg-primary)', padding: '20px', borderRadius: '16px', textAlign: 'center', border: '2px dashed var(--brand-primary)' }}>
                  <p style={{ margin: '0 0 5px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Calculated Monthly EMI</p>
                  <h2 style={{ margin: 0, fontSize: '2rem', color: 'var(--brand-primary)' }}>₹{emiPreview.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</h2>
                  <p style={{ margin: '5px 0 0', fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Based on NBFC standard formula</p>
                </div>
              )}

              <button type="submit" disabled={isSaving || !principal || !duration} className="btn-primary" style={{ padding: '18px', borderRadius: '16px', fontSize: '1.2rem', fontWeight: 800, marginTop: '10px', opacity: (isSaving || !principal || !duration) ? 0.5 : 1 }}>
                {isSaving ? 'Adding Loan...' : 'Add Loan'}
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export default AddLoanModal;
