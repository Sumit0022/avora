import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { IoChevronBack, IoAddOutline, IoCashOutline, IoPersonOutline, IoLibraryOutline } from 'react-icons/io5';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase';
import { ref, onValue, push } from 'firebase/database';
import AddLoanModal from '../components/AddLoanModal';
import toast from 'react-hot-toast';

function Loans() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [loans, setLoans] = useState([]);
  const [loanRequests, setLoanRequests] = useState([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showSettled, setShowSettled] = useState(false);

  const [accounts, setAccounts] = useState([]);
  const [selectedAccounts, setSelectedAccounts] = useState({});
  const [processingId, setProcessingId] = useState(null);

  useEffect(() => {
    if (!currentUser) return;
    const loansRef = ref(db, `loans/${currentUser.uid}`);
    const unsubLoans = onValue(loansRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setLoans(Object.keys(data).map(k => ({ id: k, ...data[k] })));
      } else {
        setLoans([]);
      }
      setLoading(false);
    });

    const reqsRef = ref(db, `loanRequests/${currentUser.uid}`);
    const unsubReqs = onValue(reqsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setLoanRequests(Object.keys(data).map(k => ({ reqId: k, ...data[k] })).filter(r => r.status === 'pending'));
      } else {
        setLoanRequests([]);
      }
    });

    const accountsRef = ref(db, `accounts/${currentUser.uid}`);
    const unsubAccounts = onValue(accountsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setAccounts(Object.keys(data).map(k => ({ id: k, ...data[k] })));
      }
    });

    return () => { unsubLoans(); unsubReqs(); unsubAccounts(); };
  }, [currentUser]);

  const givenLoans = loans.filter(l => l.type === 'given' && l.status === 'active');
  const takenLoans = loans.filter(l => l.type === 'taken' && l.status === 'active');

  const totalGiven = givenLoans.reduce((sum, l) => sum + Number(l.outstandingPrincipal || l.principalAmount), 0);
  const totalTaken = takenLoans.reduce((sum, l) => sum + Number(l.outstandingPrincipal || l.principalAmount), 0);

  const getCategoryIcon = (cat) => {
    if (cat === 'Bank') return <IoLibraryOutline size={20} />;
    return <IoPersonOutline size={20} />;
  };

  const handleAccountSelect = (reqId, accountId) => {
    setSelectedAccounts(prev => ({ ...prev, [reqId]: accountId }));
  };

  const handleAcceptRequest = async (req) => {
    const accId = selectedAccounts[req.reqId];
    if (!req.loanData.isOngoing && !accId) {
      return toast.error("Please select an account for the transfer.");
    }
    setProcessingId(req.reqId);

    try {
      const { senderId, senderAccountId, loanData } = req;
      
      const receiverLoanId = loanData.id; 
      // Generate a new ID for the sender's copy
      const senderLoanId = push(ref(db, `loans/${senderId}`)).key;

      const updates = {};
      
      // Update Receiver's (Current User) Loan
      updates[`loans/${currentUser.uid}/${receiverLoanId}`] = {
        ...loanData,
        type: req.type,
        personName: loanData.personName, // the sender's name
        linkedUserId: senderId,
        linkedLoanId: senderLoanId
      };

      // Update Sender's Loan
      updates[`loans/${senderId}/${senderLoanId}`] = {
        ...loanData,
        type: req.type === 'given' ? 'taken' : 'given', // Inverse
        personName: currentUser.displayName || 'User',
        linkedUserId: currentUser.uid,
        linkedLoanId: receiverLoanId
      };

      // Delete the request
      updates[`loanRequests/${currentUser.uid}/${req.reqId}`] = null;

      // Handle Wallet Updates if not ongoing
      if (!loanData.isOngoing) {
        const { get } = require('firebase/database');
        const receiverAccSnap = await get(ref(db, `accounts/${currentUser.uid}/${accId}`));
        const senderAccSnap = await get(ref(db, `accounts/${senderId}/${senderAccountId}`));
        
        let amount = Number(loanData.principalAmount);
        
        if (receiverAccSnap.exists()) {
          const rAcc = receiverAccSnap.val();
          if (req.type === 'given') { // Receiver is giving money
            updates[`accounts/${currentUser.uid}/${accId}/balance`] = rAcc.type === 'Credit Card' ? Number(rAcc.balance) + amount : Number(rAcc.balance) - amount;
          } else { // Receiver is taking money
            updates[`accounts/${currentUser.uid}/${accId}/balance`] = rAcc.type === 'Credit Card' ? Number(rAcc.balance) - amount : Number(rAcc.balance) + amount;
          }
          const rTxId = push(ref(db, `transactions/${currentUser.uid}`)).key;
          updates[`transactions/${currentUser.uid}/${rTxId}`] = {
            id: rTxId, type: req.type === 'given' ? 'expense' : 'income', amount, accountId: accId, categoryId: 'loan_disbursement', note: `Linked Loan: ${loanData.personName}`, date: new Date().toISOString().split('T')[0], time: new Date().toTimeString().slice(0, 5), isLoanTransaction: true, loanId: receiverLoanId, createdAt: new Date().toISOString()
          };
        }

        if (senderAccSnap.exists()) {
          const sAcc = senderAccSnap.val();
          if (req.type === 'given') { // Sender is taking money
            updates[`accounts/${senderId}/${senderAccountId}/balance`] = sAcc.type === 'Credit Card' ? Number(sAcc.balance) - amount : Number(sAcc.balance) + amount;
          } else { // Sender is giving money
            updates[`accounts/${senderId}/${senderAccountId}/balance`] = sAcc.type === 'Credit Card' ? Number(sAcc.balance) + amount : Number(sAcc.balance) - amount;
          }
          const sTxId = push(ref(db, `transactions/${senderId}`)).key;
          updates[`transactions/${senderId}/${sTxId}`] = {
            id: sTxId, type: req.type === 'given' ? 'income' : 'expense', amount, accountId: senderAccountId, categoryId: 'loan_disbursement', note: `Linked Loan: ${currentUser.displayName || 'User'}`, date: new Date().toISOString().split('T')[0], time: new Date().toTimeString().slice(0, 5), isLoanTransaction: true, loanId: senderLoanId, createdAt: new Date().toISOString()
          };
        }
      }

      const { update } = require('firebase/database');
      await update(ref(db), updates);
      toast.success("Loan linked and active!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to accept loan request");
    }
    setProcessingId(null);
  };

  const handleRejectRequest = async (reqId) => {
    setProcessingId(reqId);
    try {
      const { update } = require('firebase/database');
      await update(ref(db), {
        [`loanRequests/${currentUser.uid}/${reqId}`]: null
      });
      toast.success("Loan request rejected");
    } catch (err) {
      console.error(err);
    }
    setProcessingId(null);
  };

  return (
    <div className="container" style={{ paddingBottom: '100px', paddingTop: '20px' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '30px' }}>
        <button onClick={() => navigate('/dashboard')} style={{ width: '45px', height: '45px', borderRadius: '50%', background: 'var(--bg-secondary)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-primary)' }}>
          <IoChevronBack size={22} />
        </button>
        <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700 }}>Loan Management</h2>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '30px' }}>
        <div style={{ background: 'rgba(52, 199, 89, 0.1)', padding: '20px', borderRadius: '20px', border: '1px solid rgba(52, 199, 89, 0.2)' }}>
          <div style={{ color: 'var(--success)', marginBottom: '10px' }}><IoCashOutline size={24} /></div>
          <h3 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Loans Given (Assets)</h3>
          <p style={{ margin: '5px 0 0', fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)' }}>₹{totalGiven.toLocaleString('en-IN', {minimumFractionDigits: 2})}</p>
        </div>
        <div style={{ background: 'rgba(255, 69, 58, 0.1)', padding: '20px', borderRadius: '20px', border: '1px solid rgba(255, 69, 58, 0.2)' }}>
          <div style={{ color: 'var(--danger)', marginBottom: '10px' }}><IoCashOutline size={24} /></div>
          <h3 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Loans Taken (Liab.)</h3>
          <p style={{ margin: '5px 0 0', fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)' }}>₹{totalTaken.toLocaleString('en-IN', {minimumFractionDigits: 2})}</p>
        </div>
      </div>

      {loanRequests.length > 0 && (
        <div style={{ marginBottom: '30px' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '15px', color: '#FF9500' }}>Pending Requests ({loanRequests.length})</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {loanRequests.map(req => (
              <div key={req.reqId} style={{ background: 'rgba(255, 149, 0, 0.05)', border: '1px solid rgba(255, 149, 0, 0.3)', padding: '20px', borderRadius: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
                  <div>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>Linked Request from</p>
                    <h4 style={{ margin: '2px 0 0', fontSize: '1.1rem', fontWeight: 700 }}>{req.loanData.personName}</h4>
                    <p style={{ margin: '5px 0 0', fontSize: '0.9rem', color: req.type === 'given' ? 'var(--success)' : 'var(--danger)', fontWeight: 600 }}>
                      {req.type === 'given' ? 'Needs to borrow from you' : 'Wants to lend to you'}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>₹{req.loanData.principalAmount.toLocaleString('en-IN')}</p>
                    <p style={{ margin: '2px 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{req.loanData.interestRate}% ({req.loanData.interestType})</p>
                  </div>
                </div>

                {!req.loanData.isOngoing && (
                  <div style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '5px' }}>Account for transfer</label>
                    <select value={selectedAccounts[req.reqId] || ''} onChange={e => handleAccountSelect(req.reqId, e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '12px', border: '1px solid var(--border-subtle)', background: 'var(--bg-primary)', color: 'var(--text-primary)', outline: 'none' }}>
                      <option value="" disabled>Select account...</option>
                      {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name} (₹{acc.type === 'Credit Card' ? Number(acc.creditLimit||0)-Number(acc.balance||0) : acc.balance})</option>)}
                    </select>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={() => handleAcceptRequest(req)} disabled={processingId === req.reqId} style={{ flex: 1, padding: '12px', borderRadius: '12px', background: 'var(--brand-primary)', color: 'white', border: 'none', fontWeight: 600, cursor: 'pointer', opacity: processingId === req.reqId ? 0.5 : 1 }}>
                    {processingId === req.reqId ? 'Processing...' : 'Accept'}
                  </button>
                  <button onClick={() => handleRejectRequest(req.reqId)} disabled={processingId === req.reqId} style={{ padding: '12px 20px', borderRadius: '12px', background: 'rgba(255, 59, 48, 0.1)', color: 'var(--danger)', border: 'none', fontWeight: 600, cursor: 'pointer', opacity: processingId === req.reqId ? 0.5 : 1 }}>
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '15px' }}>Active Loans</h3>
      {loading ? (
        <p style={{ textAlign: 'center', color: 'var(--text-tertiary)' }}>Loading...</p>
      ) : loans.filter(l => l.status === 'active').length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', background: 'var(--bg-secondary)', borderRadius: '24px', color: 'var(--text-tertiary)' }}>
          No active loans found.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          {loans.filter(l => l.status === 'active').map(loan => (
            <Link key={loan.id} to={`/loans/${loan.id}`} style={{ textDecoration: 'none' }}>
              <motion.div whileTap={{ scale: 0.98 }} style={{ background: 'var(--bg-secondary)', padding: '20px', borderRadius: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                  <div style={{ width: '45px', height: '45px', borderRadius: '12px', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: loan.type === 'given' ? 'var(--success)' : 'var(--danger)' }}>
                    {getCategoryIcon(loan.category)}
                  </div>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)' }}>{loan.personName}</h4>
                    <p style={{ margin: '2px 0 0', fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>
                      {loan.type === 'given' ? 'You lent' : 'You borrowed'} • {loan.interestRate}% {loan.interestType}
                    </p>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: loan.type === 'given' ? 'var(--success)' : 'var(--text-primary)' }}>
                    ₹{Number(loan.outstandingPrincipal || loan.principalAmount).toLocaleString('en-IN')}
                  </p>
                  <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>Outstanding</p>
                </div>
              </motion.div>
            </Link>
          ))}
        </div>
      )}

      {loans.filter(l => l.status === 'closed').length > 0 && (
        <div style={{ marginTop: '40px' }}>
          <button onClick={() => setShowSettled(!showSettled)} style={{ background: 'none', border: 'none', width: '100%', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
            {showSettled ? 'Hide' : 'See'} Settled Loans
          </button>
          
          <AnimatePresence>
            {showSettled && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} style={{ overflow: 'hidden', marginTop: '15px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  {loans.filter(l => l.status === 'closed').map(loan => (
                    <Link key={loan.id} to={`/loans/${loan.id}`} style={{ textDecoration: 'none' }}>
                      <motion.div whileTap={{ scale: 0.98 }} style={{ background: 'var(--bg-secondary)', padding: '20px', borderRadius: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: 0.7 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                          <div style={{ width: '45px', height: '45px', borderRadius: '12px', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)' }}>
                            {getCategoryIcon(loan.category)}
                          </div>
                          <div>
                            <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)' }}>{loan.personName}</h4>
                            <p style={{ margin: '2px 0 0', fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>
                              {loan.type === 'given' ? 'You lent' : 'You borrowed'} • SETTLED
                            </p>
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                            ₹{Number(loan.principalAmount).toLocaleString('en-IN')}
                          </p>
                          <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>Closed</p>
                        </div>
                      </motion.div>
                    </Link>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      <button
        onClick={() => setIsAddModalOpen(true)}
        style={{
          position: 'fixed',
          bottom: '100px',
          right: '20px',
          width: '60px',
          height: '60px',
          borderRadius: '50%',
          background: 'var(--brand-primary)',
          color: 'white',
          border: 'none',
          boxShadow: '0 10px 20px rgba(0, 113, 227, 0.4)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          cursor: 'pointer',
          zIndex: 100
        }}
      >
        <IoAddOutline size={30} />
      </button>

      <AddLoanModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} />
    </div>
  );
}

export default Loans;
