import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { IoChevronBack, IoAddOutline, IoCashOutline, IoPersonOutline, IoLibraryOutline } from 'react-icons/io5';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase';
import { ref, onValue } from 'firebase/database';
import AddLoanModal from '../components/AddLoanModal';

function Loans() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [loans, setLoans] = useState([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) return;
    const loansRef = ref(db, `loans/${currentUser.uid}`);
    const unsub = onValue(loansRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setLoans(Object.keys(data).map(k => ({ id: k, ...data[k] })));
      } else {
        setLoans([]);
      }
      setLoading(false);
    });
    return () => unsub();
  }, [currentUser]);

  const givenLoans = loans.filter(l => l.type === 'given' && l.status === 'active');
  const takenLoans = loans.filter(l => l.type === 'taken' && l.status === 'active');

  const totalGiven = givenLoans.reduce((sum, l) => sum + Number(l.outstandingPrincipal || l.principalAmount), 0);
  const totalTaken = takenLoans.reduce((sum, l) => sum + Number(l.outstandingPrincipal || l.principalAmount), 0);

  const getCategoryIcon = (cat) => {
    if (cat === 'Bank') return <IoLibraryOutline size={20} />;
    return <IoPersonOutline size={20} />;
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
