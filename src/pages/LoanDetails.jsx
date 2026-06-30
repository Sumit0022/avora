import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { IoChevronBack, IoWalletOutline, IoCalendarOutline, IoCashOutline, IoPieChartOutline } from 'react-icons/io5';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase';
import { ref, get, update, push, onValue } from 'firebase/database';
import { motion } from 'framer-motion';

function LoanDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  
  const [loan, setLoan] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [accounts, setAccounts] = useState([]);
  const [accountId, setAccountId] = useState('');
  
  const [repaymentAmount, setRepaymentAmount] = useState('');
  const [isPaying, setIsPaying] = useState(false);

  useEffect(() => {
    if (!currentUser) return;

    const loanRef = ref(db, `loans/${currentUser.uid}/${id}`);
    const unsub = onValue(loanRef, (snapshot) => {
      if (snapshot.exists()) {
        setLoan(snapshot.val());
        if (!repaymentAmount) setRepaymentAmount(snapshot.val().emiAmount || '');
      } else {
        toast.error("Loan not found");
        navigate('/loans');
      }
      setLoading(false);
    });

    const accountsRef = ref(db, `accounts/${currentUser.uid}`);
    onValue(accountsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const accList = Object.keys(data).map(k => ({ id: k, ...data[k] }));
        setAccounts(accList);
        if (accList.length > 0) setAccountId(accList[0].id);
      }
    }, { onlyOnce: true });

    return () => unsub();
  }, [currentUser, id, navigate]);

  const handleRepayment = async (e) => {
    e.preventDefault();
    if (!accountId) return toast.error("Select an account to pay from/to.");
    
    setIsPaying(true);
    try {
      const amount = Number(repaymentAmount);
      
      // Math to split interest vs principal
      let interestComponent = 0;
      let principalComponent = amount;

      if (loan.interestType === 'reducing' && loan.interestRate > 0) {
        const r_monthly = (loan.interestRate / 100) / 12;
        interestComponent = loan.outstandingPrincipal * r_monthly;
        principalComponent = amount - interestComponent;
      } else if (loan.interestType === 'flat' && loan.interestRate > 0) {
        const r_annual = loan.interestRate / 100;
        const totalInterest = loan.principalAmount * r_annual * (loan.durationMonths / 12);
        interestComponent = totalInterest / loan.durationMonths;
        principalComponent = amount - interestComponent;
      }

      // If they pay less than interest, outstanding principal actually goes UP! (Negative principal component)
      const newOutstanding = loan.outstandingPrincipal - principalComponent;

      const repaymentId = push(ref(db, `loans/${currentUser.uid}/${id}/repayments`)).key;
      const txId = push(ref(db, `transactions/${currentUser.uid}`)).key;

      const updates = {};
      
      // Update Loan
      updates[`loans/${currentUser.uid}/${id}/outstandingPrincipal`] = Math.max(0, newOutstanding);
      if (newOutstanding <= 0.01) {
        updates[`loans/${currentUser.uid}/${id}/status`] = 'closed';
      }

      // Add Repayment Record
      updates[`loans/${currentUser.uid}/${id}/repayments/${repaymentId}`] = {
        amount,
        principalComponent,
        interestComponent,
        date: new Date().toISOString(),
        accountId
      };

      // Update Wallet & add transaction
      const accSnapshot = await get(ref(db, `accounts/${currentUser.uid}/${accountId}`));
      if (accSnapshot.exists()) {
        const acc = accSnapshot.val();
        
        // If loan was GIVEN (Asset), repayment means money comes IN to our account (Income)
        // If loan was TAKEN (Liab), repayment means money goes OUT of our account (Expense)
        if (loan.type === 'given') {
          updates[`accounts/${currentUser.uid}/${accountId}/balance`] = acc.type === 'Credit Card' 
            ? Number(acc.balance) - amount // CC balance goes down (debt reduced)
            : Number(acc.balance) + amount;
        } else {
          updates[`accounts/${currentUser.uid}/${accountId}/balance`] = acc.type === 'Credit Card' 
            ? Number(acc.balance) + amount // CC debt increases
            : Number(acc.balance) - amount;
        }

        updates[`transactions/${currentUser.uid}/${txId}`] = {
          id: txId,
          type: loan.type === 'given' ? 'income' : 'expense',
          amount: amount,
          accountId,
          categoryId: 'loan_repayment',
          note: `EMI Repayment: ${loan.personName}`,
          date: new Date().toISOString().split('T')[0],
          time: new Date().toTimeString().slice(0, 5),
          isLoanTransaction: true,
          loanId: id,
          createdAt: new Date().toISOString()
        };
      }

      await update(ref(db), updates);
      toast.success('Repayment recorded successfully!');
      
    } catch (err) {
      console.error(err);
      toast.error('Failed to log repayment.');
    }
    setIsPaying(false);
  };

  if (loading || !loan) return <div style={{ padding: '20px', textAlign: 'center' }}>Loading Loan Details...</div>;

  const totalPaidPrincipal = loan.principalAmount - loan.outstandingPrincipal;
  const progressPercent = Math.min(100, Math.max(0, (totalPaidPrincipal / loan.principalAmount) * 100));

  const repaymentsList = loan.repayments ? Object.keys(loan.repayments).map(k => ({ id: k, ...loan.repayments[k] })).sort((a,b) => new Date(b.date) - new Date(a.date)) : [];

  return (
    <div className="container" style={{ paddingBottom: '100px', paddingTop: '20px' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '30px' }}>
        <button onClick={() => navigate('/loans')} style={{ width: '45px', height: '45px', borderRadius: '50%', background: 'var(--bg-secondary)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-primary)' }}>
          <IoChevronBack size={22} />
        </button>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700 }}>{loan.personName}</h2>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{loan.category} • {loan.type === 'given' ? 'Lent' : 'Borrowed'}</p>
        </div>
      </header>

      {/* Progress Card */}
      <div style={{ background: 'var(--brand-gradient)', padding: '25px', borderRadius: '24px', color: 'white', marginBottom: '25px', boxShadow: '0 10px 30px rgba(0,113,227,0.3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '20px' }}>
          <div>
            <p style={{ margin: 0, fontSize: '0.9rem', opacity: 0.9 }}>Outstanding Principal</p>
            <h1 style={{ margin: '5px 0 0', fontSize: '2.5rem', fontWeight: 800 }}>₹{loan.outstandingPrincipal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</h1>
          </div>
          {loan.status === 'closed' && (
            <div style={{ background: 'rgba(255,255,255,0.2)', padding: '5px 12px', borderRadius: '12px', fontWeight: 700 }}>SETTLED</div>
          )}
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '8px', opacity: 0.9 }}>
            <span>₹{totalPaidPrincipal.toLocaleString('en-IN', { maximumFractionDigits: 0 })} Repaid</span>
            <span>₹{loan.principalAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })} Total</span>
          </div>
          <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.2)', borderRadius: '4px', overflow: 'hidden' }}>
            <motion.div initial={{ width: 0 }} animate={{ width: `${progressPercent}%` }} style={{ height: '100%', background: 'white', borderRadius: '4px' }} />
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '30px' }}>
        <div style={{ background: 'var(--bg-secondary)', padding: '15px', borderRadius: '16px' }}>
          <IoPieChartOutline size={20} color="var(--brand-primary)" style={{ marginBottom: '10px' }} />
          <h4 style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Interest Rate</h4>
          <p style={{ margin: '2px 0 0', fontSize: '1.1rem', fontWeight: 700 }}>{loan.interestRate}% {loan.interestType}</p>
        </div>
        <div style={{ background: 'var(--bg-secondary)', padding: '15px', borderRadius: '16px' }}>
          <IoCalendarOutline size={20} color="var(--brand-primary)" style={{ marginBottom: '10px' }} />
          <h4 style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Duration</h4>
          <p style={{ margin: '2px 0 0', fontSize: '1.1rem', fontWeight: 700 }}>{loan.durationMonths} Months</p>
        </div>
      </div>

      {loan.status === 'active' && (
        <div style={{ background: 'var(--bg-secondary)', padding: '20px', borderRadius: '24px', marginBottom: '30px' }}>
          <h3 style={{ margin: '0 0 15px', fontSize: '1.1rem', fontWeight: 700 }}>Log Repayment</h3>
          <form onSubmit={handleRepayment}>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', background: 'var(--bg-primary)', borderRadius: '16px', border: '1px solid var(--border-subtle)', padding: '0 15px' }}>
                <span style={{ fontWeight: 700, color: 'var(--text-secondary)' }}>₹</span>
                <input type="number" value={repaymentAmount} onChange={e => setRepaymentAmount(e.target.value)} required step="0.01" style={{ width: '100%', padding: '16px 10px', border: 'none', background: 'transparent', color: 'var(--text-primary)', fontSize: '1.1rem', outline: 'none', fontWeight: 700 }} />
              </div>
              <button type="submit" disabled={isPaying || !repaymentAmount} style={{ background: loan.type === 'given' ? 'var(--success)' : 'var(--danger)', color: 'white', border: 'none', padding: '0 25px', borderRadius: '16px', fontWeight: 700, fontSize: '1rem', cursor: 'pointer', opacity: isPaying ? 0.5 : 1 }}>
                {isPaying ? '...' : 'Pay'}
              </button>
            </div>
            
            <select value={accountId} onChange={e => setAccountId(e.target.value)} required style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--border-subtle)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '0.9rem', outline: 'none' }}>
              <option value="" disabled>Select wallet account...</option>
              {accounts.map(acc => (
                <option key={acc.id} value={acc.id}>{acc.name}</option>
              ))}
            </select>
            
            <p style={{ margin: '15px 0 0', fontSize: '0.8rem', color: 'var(--text-tertiary)', textAlign: 'center' }}>
              We will automatically calculate the Principal vs Interest split.
            </p>
          </form>
        </div>
      )}

      <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '15px' }}>Repayment History</h3>
      {repaymentsList.length === 0 ? (
        <p style={{ color: 'var(--text-tertiary)', textAlign: 'center', padding: '20px' }}>No repayments logged yet.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {repaymentsList.map((rep) => (
            <div key={rep.id} style={{ background: 'var(--bg-secondary)', padding: '15px', borderRadius: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ margin: 0, fontWeight: 700, fontSize: '1rem' }}>₹{rep.amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p>
                <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{new Date(rep.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--success)' }}>-₹{rep.principalComponent.toLocaleString('en-IN', { maximumFractionDigits: 0 })} Principal</p>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--danger)' }}>-₹{rep.interestComponent.toLocaleString('en-IN', { maximumFractionDigits: 0 })} Interest</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default LoanDetails;
