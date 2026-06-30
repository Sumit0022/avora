import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase';
import { ref, get, push, update } from 'firebase/database';
import { calculateCreditCardBill } from '../utils/billing';
import { IoChevronBack, IoAddOutline, IoCheckmarkCircleOutline } from 'react-icons/io5';
import { motion, AnimatePresence } from 'framer-motion';

function CreditCardBill() {
  const { accountId } = useParams();
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [account, setAccount] = useState(null);
  const [bill, setBill] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [fundingAccounts, setFundingAccounts] = useState([]);
  const [pendingVirtualEmis, setPendingVirtualEmis] = useState([]);
  const [activeLoans, setActiveLoans] = useState([]);
  
  const [loading, setLoading] = useState(true);
  
  // Payment Flow State
  const [isPaying, setIsPaying] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [selectedBankId, setSelectedBankId] = useState('');

  // Reconcile Flow State (Add manual fee/penalty)
  const [isReconciling, setIsReconciling] = useState(false);
  const [reconcileAmount, setReconcileAmount] = useState('');
  const [reconcileNote, setReconcileNote] = useState('Late Fee / Finance Charge');

  useEffect(() => {
    if (!currentUser) return;

    const fetchData = async () => {
      try {
        // Fetch specific CC Account
        const accSnap = await get(ref(db, `accounts/${currentUser.uid}/${accountId}`));
        if (!accSnap.exists()) {
          navigate('/dashboard');
          return;
        }
        const accData = { id: accountId, ...accSnap.val() };
        setAccount(accData);

        // Fetch All Accounts (to find funding banks)
        const allAccSnap = await get(ref(db, `accounts/${currentUser.uid}`));
        const allAccData = allAccSnap.val() || {};
        const banks = Object.keys(allAccData)
          .map(k => ({ id: k, ...allAccData[k] }))
          .filter(a => a.type !== 'Credit Card' && a.id !== accountId);
        setFundingAccounts(banks);
        if (banks.length > 0) setSelectedBankId(banks[0].id);

        // Fetch all transactions to calculate bill and show list
        const txSnap = await get(ref(db, `transactions/${currentUser.uid}`));
        const txData = txSnap.val() || {};
        const txList = Object.keys(txData).map(k => ({ id: k, ...txData[k] }));

        const calculatedBill = calculateCreditCardBill(accData, txList);
        
        // Fetch active CC loans to generate virtual EMIs
        const loansSnap = await get(ref(db, `loans/${currentUser.uid}`));
        const loansData = loansSnap.val() || {};
        const ccLoans = Object.keys(loansData)
          .map(k => ({ id: k, ...loansData[k] }))
          .filter(l => l.category === 'Credit Card' && l.accountId === accountId && l.status === 'active');
        
        setActiveLoans(ccLoans);
        let virtualEmis = [];
        let totalVirtualAmount = 0;

        if (calculatedBill) {
          ccLoans.forEach(loan => {
            const start = new Date(loan.startDate);
            const billDateNum = Number(accData.billingDate) || 1;
            let emiDate = new Date(start.getFullYear(), start.getMonth(), billDateNum);
            
            if (start.getDate() > billDateNum) emiDate.setMonth(emiDate.getMonth() + 1);
            
            let currentOutstanding = loan.outstandingPrincipal;
            
            while (emiDate <= calculatedBill.periodEnd) {
              const isPaid = loan.repayments && Object.values(loan.repayments).some(rep => {
                const rDate = new Date(rep.date);
                return rDate.getMonth() === emiDate.getMonth() && rDate.getFullYear() === emiDate.getFullYear();
              });

              if (!isPaid) {
                let interestComponent = 0;
                let principalComponent = loan.emiAmount;
                if (loan.interestType === 'reducing' && loan.interestRate > 0) {
                  const r_monthly = (loan.interestRate / 100) / 12;
                  interestComponent = currentOutstanding * r_monthly;
                  principalComponent = loan.emiAmount - interestComponent;
                } else if (loan.interestType === 'flat' && loan.interestRate > 0) {
                  const r_annual = loan.interestRate / 100;
                  const totalInterest = loan.principalAmount * r_annual * (loan.durationMonths / 12);
                  interestComponent = totalInterest / loan.durationMonths;
                  principalComponent = loan.emiAmount - interestComponent;
                }
                
                if (principalComponent > currentOutstanding) principalComponent = currentOutstanding;

                const vEmi = {
                  id: `virtual_${loan.id}_${emiDate.getTime()}`,
                  type: 'expense',
                  amount: Number(loan.emiAmount),
                  principalComponent: Number(principalComponent),
                  interestComponent: Number(interestComponent),
                  accountId: accountId,
                  note: `EMI: ${loan.personName}`,
                  date: emiDate.toISOString().split('T')[0],
                  time: '23:59',
                  isVirtualEmi: true,
                  loanId: loan.id
                };
                
                virtualEmis.push(vEmi);
                totalVirtualAmount += vEmi.amount;
                currentOutstanding -= principalComponent;
              }
              emiDate.setMonth(emiDate.getMonth() + 1);
            }
          });

          // Add virtual EMIs to the bill
          calculatedBill.billedAmount += totalVirtualAmount;
          calculatedBill.remainingBill += totalVirtualAmount;
          if (calculatedBill.remainingBill > 0) {
            const todayStr = new Date().toISOString().split('T')[0];
            const dueStr = calculatedBill.dueDate.toISOString().split('T')[0];
            calculatedBill.isOverdue = todayStr > dueStr;
          }

          setBill(calculatedBill);
          setPendingVirtualEmis(virtualEmis);

          // Filter transactions for this specific billing period, including virtual EMIs
          const periodTx = [...txList, ...virtualEmis].filter(tx => {
            if (tx.accountId !== accountId && tx.toAccountId !== accountId) return false;
            const txDate = new Date(`${tx.date}T${tx.time || '00:00'}:00`);
            return txDate >= calculatedBill.periodStart && txDate <= calculatedBill.periodEnd;
          }).sort((a, b) => new Date(`${b.date}T${b.time || '00:00'}`) - new Date(`${a.date}T${a.time || '00:00'}`));
          
          setTransactions(periodTx);
        }

        setLoading(false);
      } catch (err) {
        console.error(err);
        setLoading(false);
      }
    };

    fetchData();
  }, [currentUser, accountId, navigate]);

  const handleReconcile = async (e) => {
    e.preventDefault();
    if (!reconcileAmount || Number(reconcileAmount) <= 0) return;

    try {
      const txId = push(ref(db, `transactions/${currentUser.uid}`)).key;
      const updates = {};
      
      // We log this as a standard expense on the CC
      updates[`transactions/${currentUser.uid}/${txId}`] = {
        id: txId,
        type: 'expense',
        amount: Number(reconcileAmount),
        accountId: account.id,
        note: reconcileNote,
        date: bill.periodEnd.toISOString().split('T')[0], // Log it on the last day of the billing cycle so it catches in the bill!
        time: '23:59',
        createdAt: new Date().toISOString()
      };

      // Increase debt
      updates[`accounts/${currentUser.uid}/${account.id}/balance`] = Number(account.balance) + Number(reconcileAmount);

      await update(ref(db), updates);
      window.location.reload(); // Refresh to recalculate
    } catch (err) {
      toast.error('Failed to add charge');
    }
  };

  const handlePayBill = async (e) => {
    e.preventDefault();
    const amount = Number(payAmount);
    if (!amount || amount <= 0 || amount > bill.remainingBill) return toast.error('Invalid payment amount');
    if (!selectedBankId) return toast.error('Select a funding account');

    try {
      const fundingBank = fundingAccounts.find(b => b.id === selectedBankId);
      if (amount > fundingBank.balance) return toast.error('Insufficient funds in the selected bank account');

      const txId = push(ref(db, `transactions/${currentUser.uid}`)).key;
      const updates = {};
      
      // Log transfer from Bank to CC
      updates[`transactions/${currentUser.uid}/${txId}`] = {
        id: txId,
        type: 'transfer',
        amount: amount,
        accountId: selectedBankId, // From Bank
        toAccountId: account.id,   // To CC
        note: `${account.name} Bill Payment`,
        date: new Date().toISOString().split('T')[0],
        time: new Date().toTimeString().slice(0,5),
        createdAt: new Date().toISOString()
      };

      // Decrease Bank Balance
      updates[`accounts/${currentUser.uid}/${selectedBankId}/balance`] = Number(fundingBank.balance) - amount;
      
      // Decrease CC Debt (Increase Available Limit)
      updates[`accounts/${currentUser.uid}/${account.id}/balance`] = Number(account.balance) - amount;

      // Process Virtual EMIs (Mark them as paid in Loan Management)
      pendingVirtualEmis.forEach(vEmi => {
        const loan = activeLoans.find(l => l.id === vEmi.loanId);
        if (loan) {
          const repId = push(ref(db, 'dummy')).key;
          const newOutstanding = Math.max(0, loan.outstandingPrincipal - vEmi.principalComponent);
          
          updates[`loans/${currentUser.uid}/${loan.id}/outstandingPrincipal`] = newOutstanding;
          if (newOutstanding <= 0.01) {
            updates[`loans/${currentUser.uid}/${loan.id}/status`] = 'closed';
          }
          
          updates[`loans/${currentUser.uid}/${loan.id}/repayments/${repId}`] = {
            amount: vEmi.amount,
            principalComponent: vEmi.principalComponent,
            interestComponent: vEmi.interestComponent,
            date: vEmi.date,
            accountId: account.id,
            isBillSync: true
          };
          
          // Update local state to chain calculations if there are multiple EMIs for the same loan
          loan.outstandingPrincipal = newOutstanding;
        }
      });

      await update(ref(db), updates);
      toast.success('Payment Successful! 🎉');
      navigate('/dashboard');
    } catch (err) {
      toast.error('Payment failed');
    }
  };

  if (loading) return <div style={{ color: 'var(--text-primary)', textAlign: 'center', marginTop: '50px' }}>Loading Bill Details...</div>;
  if (!bill) return <div style={{ color: 'var(--text-primary)', textAlign: 'center', marginTop: '50px' }}>No bill found.</div>;

  return (
    <div style={{ backgroundColor: 'var(--bg-primary)', minHeight: '100vh', color: 'var(--text-primary)', paddingBottom: '100px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      
      {/* Sleek CRED-style Header */}
      <div style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: 'var(--bg-glass)', backdropFilter: 'blur(20px)', zIndex: 100 }}>
        <Link to="/dashboard" style={{ color: 'var(--text-primary)', textDecoration: 'none', flexShrink: 0 }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <IoChevronBack size={24} />
          </div>
        </Link>
        <div style={{ flex: 1, minWidth: 0, gap: '10px', display: 'flex', justifyContent: 'flex-end' }}>
          <span style={{ fontWeight: 600, opacity: 0.8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Clear your dues</span>
        </div>
      </div>

      <div className="container" style={{ paddingTop: '20px', maxWidth: '500px', margin: '0 auto' }}>
        
        {/* Massive Bill Display */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          style={{ textAlign: 'center', marginBottom: '40px' }}
        >
          <div style={{ fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '2px', opacity: 0.6, marginBottom: '10px' }}>{account.name} Bill</div>
          <h1 style={{ fontSize: 'clamp(2.5rem, 8vw, 4.5rem)', fontWeight: 800, margin: 0, letterSpacing: '-2px', background: 'linear-gradient(180deg, #FFFFFF 0%, #A0A0A0 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            ₹{bill.remainingBill.toLocaleString()}
          </h1>
          <p style={{ margin: '10px 0 0', color: bill.isOverdue ? 'var(--danger)' : 'var(--success)', fontWeight: 600, fontSize: '1.1rem' }}>
            {bill.isOverdue ? 'OVERDUE' : `Due on ${new Date(bill.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`}
          </p>
        </motion.div>

        {/* Action Buttons */}
        {bill.remainingBill > 0 ? (
          <div style={{ display: 'flex', gap: '15px', marginBottom: '40px' }}>
            <button 
              onClick={() => { setPayAmount(bill.remainingBill); setIsPaying(true); }}
              style={{ flex: 1, padding: '20px', background: 'white', color: 'black', border: 'none', borderRadius: '20px', fontSize: '1.2rem', fontWeight: 700, cursor: 'pointer', boxShadow: '0 10px 30px rgba(255,255,255,0.2)' }}
            >
              Pay in full
            </button>
            <button 
              onClick={() => setIsPaying(true)}
              style={{ flex: 1, padding: '20px', background: 'rgba(255,255,255,0.1)', color: 'var(--text-primary)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '20px', fontSize: '1.2rem', fontWeight: 700, cursor: 'pointer' }}
            >
              Pay partial
            </button>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '20px', background: 'rgba(50, 215, 75, 0.1)', color: 'var(--success)', borderRadius: '20px', marginBottom: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', fontSize: '1.2rem', fontWeight: 600 }}>
            <IoCheckmarkCircleOutline size={28} /> All dues cleared
          </div>
        )}

        {/* Transactions in this Cycle */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 600, margin: 0 }}>Statement</h3>
            <button onClick={() => setIsReconciling(true)} style={{ background: 'none', border: 'none', color: 'var(--brand-primary)', fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <IoAddOutline size={18} /> Reconcile
            </button>
          </div>
          <p style={{ fontSize: '0.8rem', opacity: 0.5, marginBottom: '20px' }}>
            {bill.periodStart.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – {bill.periodEnd.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {transactions.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', opacity: 0.5 }}>No transactions in this cycle.</div>
            ) : (
              transactions.map((tx) => (
                <div key={tx.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px', background: 'rgba(255,255,255,0.05)', borderRadius: '16px' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '1rem', marginBottom: '4px' }}>
                      {tx.note || 'Credit Card Expense'}
                    </div>
                    <div style={{ fontSize: '0.75rem', opacity: 0.5 }}>
                      {new Date(tx.date).toLocaleDateString('en-GB')} {tx.time && `• ${tx.time}`}
                    </div>
                    {tx.isVirtualEmi && (
                      <div style={{ fontSize: '0.75rem', marginTop: '6px' }}>
                        <span style={{ color: 'var(--success)' }}>₹{tx.principalComponent.toLocaleString('en-IN', {minimumFractionDigits: 2})} Principal</span>
                        <span style={{ margin: '0 5px', opacity: 0.5 }}>|</span>
                        <span style={{ color: 'var(--danger)' }}>₹{tx.interestComponent.toLocaleString('en-IN', {minimumFractionDigits: 2})} Interest</span>
                      </div>
                    )}
                  </div>
                  <div style={{ fontWeight: 700, fontSize: '1.1rem', color: tx.type === 'expense' ? 'var(--text-primary)' : 'var(--success)' }}>
                    {tx.type === 'expense' ? '' : '+'}{Number(tx.amount).toLocaleString('en-IN')}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* Payment Modal */}
      <AnimatePresence>
        {isPaying && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 2000, background: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'flex-end' }}>
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 300 }} style={{ background: 'var(--bg-secondary)', padding: '30px', borderTopLeftRadius: '32px', borderTopRightRadius: '32px', width: '100%', maxWidth: '500px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '30px' }}>
                <h3 style={{ margin: 0, fontSize: '1.4rem' }}>Make Payment</h3>
                <button onClick={() => setIsPaying(false)} style={{ background: 'none', border: 'none', color: 'var(--text-primary)', opacity: 0.5, cursor: 'pointer', fontSize: '1rem' }}>Cancel</button>
              </div>
              
              <form onSubmit={handlePayBill} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '10px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Amount</label>
                  <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-primary)', borderRadius: '16px', padding: '15px' }}>
                    <span style={{ fontSize: '1.5rem', marginRight: '10px' }}>₹</span>
                    <input 
                      type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)} 
                      max={bill.remainingBill} required step="0.01"
                      style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: '1.5rem', fontWeight: 700, width: '100%', outline: 'none' }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '10px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Pay from Bank Account</label>
                  <select 
                    value={selectedBankId} onChange={e => setSelectedBankId(e.target.value)} required 
                    style={{ width: '100%', padding: '15px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '1.1rem', outline: 'none', WebkitAppearance: 'none' }}
                  >
                    <option value="" disabled>Select Bank</option>
                    {fundingAccounts.map(b => (
                      <option key={b.id} value={b.id}>{b.name} (Balance: ₹{b.balance})</option>
                    ))}
                  </select>
                </div>

                <button type="submit" style={{ width: '100%', padding: '20px', background: 'white', color: 'black', border: 'none', borderRadius: '20px', fontSize: '1.2rem', fontWeight: 700, cursor: 'pointer', marginTop: '10px' }}>
                  Swipe to Pay
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Reconcile Modal */}
      <AnimatePresence>
        {isReconciling && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 2000, background: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} style={{ background: 'var(--bg-secondary)', padding: '30px', borderRadius: '24px', width: '90%', maxWidth: '400px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                <h3 style={{ margin: 0 }}>Add Missing Charge</h3>
                <button onClick={() => setIsReconciling(false)} style={{ background: 'none', border: 'none', color: 'var(--text-primary)', opacity: 0.5, cursor: 'pointer' }}>Close</button>
              </div>
              <p style={{ opacity: 0.7, marginBottom: '20px', fontSize: '0.9rem' }}>Record penalties, late fees, or missing transactions to match your real statement.</p>
              <form onSubmit={handleReconcile} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <input 
                  type="text" value={reconcileNote} onChange={e => setReconcileNote(e.target.value)} 
                  placeholder="Charge Name" required
                  style={{ width: '100%', padding: '15px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }} 
                />
                <input 
                  type="number" value={reconcileAmount} onChange={e => setReconcileAmount(e.target.value)} 
                  placeholder="Amount" required step="0.01"
                  style={{ width: '100%', padding: '15px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }} 
                />
                <button type="submit" style={{ padding: '15px', borderRadius: '12px', background: 'white', color: 'black', fontWeight: 700, border: 'none', cursor: 'pointer' }}>Add to Bill</button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default CreditCardBill;
