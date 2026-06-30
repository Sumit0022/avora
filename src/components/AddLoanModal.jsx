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

  const [allUsers, setAllUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [linkedUser, setLinkedUser] = useState(null);

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

      get(ref(db, 'users')).then(snap => {
        if (snap.exists()) {
          const data = snap.val();
          setAllUsers(Object.keys(data).map(k => ({ uid: k, ...data[k] })));
        }
      });

      setType('taken');
      setCategory('Bank');
      setPersonName('');
      setSearchQuery('');
      setLinkedUser(null);
      setIsOngoing(false);
      setPrincipal('');
      setInterestRate('');
      setInterestType('reducing');
      setDuration('');
      setStartDate(new Date().toISOString().split('T')[0]);
    }
  }, [isOpen, currentUser]);

  useEffect(() => {
    if (type === 'given') {
      setCategory('Informal');
    } else if (type === 'taken' && category === 'Informal') {
      setCategory('Bank');
    }
  }, [type]);

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
    if (!accountId) return toast.error("Please select a default account.");
    if (category === 'Informal' && !linkedUser && !personName) {
      return toast.error("Please provide a name or select an Avora user.");
    }
    
    setIsSaving(true);
    try {
      const loanId = push(ref(db, `loans/${currentUser.uid}`)).key;
      const emi = calculateEMI();
      const finalPersonName = linkedUser ? (linkedUser.name || linkedUser.username) : personName;
      const selectedAcc = accounts.find(a => a.id === accountId);

      let finalOutstanding = Number(principal);
      const autoRepayments = {};

      if (isOngoing && startDate) {
        let emiDateNum = 1;
        if (category === 'Credit Card' && selectedAcc && selectedAcc.type === 'Credit Card') {
          emiDateNum = Number(selectedAcc.billingDate) || 1;
        } else {
          emiDateNum = new Date(startDate).getDate();
        }

        const start = new Date(startDate);
        const today = new Date();
        
        let checkDate = new Date(start.getFullYear(), start.getMonth(), emiDateNum);
        if (start.getDate() > emiDateNum) {
          checkDate.setMonth(checkDate.getMonth() + 1);
        }

        while (checkDate <= today) {
           const repId = push(ref(db, 'dummy')).key;
           let interestComponent = 0;
           let principalComponent = emi;
           
           if (interestType === 'reducing' && Number(interestRate) > 0) {
             const r_monthly = (Number(interestRate) / 100) / 12;
             interestComponent = finalOutstanding * r_monthly;
             principalComponent = emi - interestComponent;
           } else if (interestType === 'flat' && Number(interestRate) > 0) {
             const r_annual = Number(interestRate) / 100;
             const totalInterest = Number(principal) * r_annual * (Number(duration) / 12);
             interestComponent = totalInterest / Number(duration);
             principalComponent = emi - interestComponent;
           }

           if (finalOutstanding <= 0) break;
           if (principalComponent > finalOutstanding) {
             principalComponent = finalOutstanding;
           }

           autoRepayments[repId] = {
             amount: Number(emi.toFixed(2)),
             principalComponent: Number(principalComponent.toFixed(2)),
             interestComponent: Number(interestComponent.toFixed(2)),
             date: checkDate.toISOString(),
             accountId: accountId,
             isAutoAdjusted: true
           };

           finalOutstanding -= principalComponent;
           checkDate.setMonth(checkDate.getMonth() + 1);
        }
        finalOutstanding = Math.max(0, finalOutstanding);
      }

      const loanData = {
        id: loanId,
        type,
        category,
        accountId, // Store account ID so CC Bill knows which card this loan belongs to
        personName: finalPersonName,
        isOngoing,
        principalAmount: Number(principal),
        outstandingPrincipal: Number(finalOutstanding.toFixed(2)),
        interestRate: Number(interestRate) || 0,
        interestType,
        durationMonths: Number(duration),
        startDate,
        emiAmount: Number(emi.toFixed(2)),
        status: finalOutstanding <= 0.01 ? 'closed' : 'active',
        createdAt: new Date().toISOString()
      };

      if (Object.keys(autoRepayments).length > 0) {
        loanData.repayments = autoRepayments;
      }

      if (linkedUser) {
        // Send a Linked Loan Request
        const requestId = push(ref(db, `loanRequests/${linkedUser.uid}`)).key;
        await update(ref(db), {
          [`loanRequests/${linkedUser.uid}/${requestId}`]: {
            id: requestId,
            senderId: currentUser.uid,
            senderAccountId: accountId, // Used later if wallet tx is executed
            type: type === 'given' ? 'taken' : 'given', // Inverse for receiver
            loanData: {
              ...loanData,
              personName: currentUser.displayName || 'User',
              linkedUserId: currentUser.uid
            },
            status: 'pending',
            createdAt: new Date().toISOString()
          }
        });
        toast.success(`Loan request sent to ${linkedUser.username}!`);
        onClose();
        setIsSaving(false);
        return;
      }

      // Standard Offline Loan Execution
      const updates = {};
      updates[`loans/${currentUser.uid}/${loanId}`] = loanData;

      if (selectedAcc) {
        const acc = selectedAcc;
        let amountChange = category === 'Credit Card' ? Number(finalOutstanding.toFixed(2)) : Number(principal);
        
        // If it's a CC loan, always block the limit (increase balance/debt) even if isOngoing!
        if (category === 'Credit Card' && acc.type === 'Credit Card') {
          updates[`accounts/${currentUser.uid}/${accountId}/balance`] = Number(acc.balance || 0) + amountChange;
          
          const txId = push(ref(db, `transactions/${currentUser.uid}`)).key;
          updates[`transactions/${currentUser.uid}/${txId}`] = {
            id: txId, type: 'expense', amount: amountChange, accountId, categoryId: 'loan_disbursement', note: `Loan EMI Block: ${finalPersonName}`, date: isOngoing ? new Date().toISOString().split('T')[0] : startDate, time: new Date().toTimeString().slice(0, 5), isLoanTransaction: true, loanId, createdAt: new Date().toISOString()
          };
        } else if (!isOngoing) {
          // Standard bank/cash logic for non-ongoing
          if (type === 'given') {
            updates[`accounts/${currentUser.uid}/${accountId}/balance`] = acc.type === 'Credit Card' 
              ? Number(acc.balance) + amountChange 
              : Number(acc.balance) - amountChange;
          } else {
            updates[`accounts/${currentUser.uid}/${accountId}/balance`] = acc.type === 'Credit Card' 
              ? Number(acc.balance) - amountChange 
              : Number(acc.balance) + amountChange;
          }

          const txId = push(ref(db, `transactions/${currentUser.uid}`)).key;
          updates[`transactions/${currentUser.uid}/${txId}`] = {
            id: txId,
            type: type === 'given' ? 'expense' : 'income',
            amount: amountChange,
            accountId,
            categoryId: 'loan_disbursement',
            note: `${type === 'given' ? 'Loan given to' : 'Loan taken from'} ${finalPersonName}`,
            date: startDate,
            time: new Date().toTimeString().slice(0, 5),
            isLoanTransaction: true,
            loanId: loanId,
            createdAt: new Date().toISOString()
          };
        }
      }

      await update(ref(db), updates);
      if (category === 'Credit Card' && selectedAcc?.type === 'Credit Card') {
        toast.success(`Loan added! CC Limit blocked by ₹${(category === 'Credit Card' ? Number(finalOutstanding.toFixed(2)) : Number(principal)).toLocaleString()}`);
      } else {
        toast.success('Loan added successfully!');
      }
      onClose();
    } catch (err) {
      console.error(err);
      toast.error('Failed to save loan');
    }
    setIsSaving(false);
  };

  const emiPreview = calculateEMI();
  
  let liveOutstanding = Number(principal) || 0;
  let livePaidEMIs = 0;
  let livePaidAmount = 0;

  if (isOngoing && principal && duration && startDate) {
     const selectedAcc = accounts.find(a => a.id === accountId);
     let emiDateNum = 1;
     if (category === 'Credit Card' && selectedAcc && selectedAcc.type === 'Credit Card') {
       emiDateNum = Number(selectedAcc.billingDate) || 1;
     } else {
       emiDateNum = new Date(startDate).getDate();
     }

     const start = new Date(startDate);
     const today = new Date();
     let checkDate = new Date(start.getFullYear(), start.getMonth(), emiDateNum);
     if (start.getDate() > emiDateNum) {
       checkDate.setMonth(checkDate.getMonth() + 1);
     }

     while (checkDate <= today) {
       let interestComponent = 0;
       let principalComponent = emiPreview;
       
       if (interestType === 'reducing' && Number(interestRate) > 0) {
         const r_monthly = (Number(interestRate) / 100) / 12;
         interestComponent = liveOutstanding * r_monthly;
         principalComponent = emiPreview - interestComponent;
       } else if (interestType === 'flat' && Number(interestRate) > 0) {
         const r_annual = Number(interestRate) / 100;
         const totalInterest = Number(principal) * r_annual * (Number(duration) / 12);
         interestComponent = totalInterest / Number(duration);
         principalComponent = emiPreview - interestComponent;
       }

       if (liveOutstanding <= 0) break;
       if (principalComponent > liveOutstanding) {
         principalComponent = liveOutstanding;
       }

       liveOutstanding -= principalComponent;
       livePaidEMIs++;
       livePaidAmount += emiPreview;
       checkDate.setMonth(checkDate.getMonth() + 1);
     }
     liveOutstanding = Math.max(0, liveOutstanding);
  }
  
  const searchResults = searchQuery.trim().length > 0 ? allUsers.filter(u => 
    u.uid !== currentUser.uid && 
    (u.email?.toLowerCase().includes(searchQuery.toLowerCase()) || 
     u.username?.toLowerCase().includes(searchQuery.toLowerCase()))
  ).slice(0, 5) : [];

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
                <div style={{ flex: 1, paddingRight: '15px' }}>
                  <h4 style={{ margin: 0, fontSize: '0.95rem', color: '#FF9500', fontWeight: 700 }}>Existing / Ongoing Loan?</h4>
                  <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Turn on if this loan is already running so it doesn't affect your current wallet balance.</p>
                </div>
                <div style={{ width: '50px', height: '30px', background: isOngoing ? '#FF9500' : 'var(--border-subtle)', borderRadius: '15px', position: 'relative', cursor: 'pointer', transition: '0.3s', flexShrink: 0 }} onClick={() => setIsOngoing(!isOngoing)}>
                  <div style={{ width: '26px', height: '26px', background: 'white', borderRadius: '50%', position: 'absolute', top: '2px', left: isOngoing ? '22px' : '2px', transition: '0.3s', boxShadow: '0 2px 5px rgba(0,0,0,0.2)' }} />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 600 }}>
                  <IoWalletOutline size={16} style={{transform: 'translateY(3px)'}} /> 
                  {isOngoing || linkedUser ? 'Default Linked Account (For EMIs)' : 'Account for Disbursement'}
                </label>
                <select value={accountId} onChange={e => setAccountId(e.target.value)} required style={{ width: '100%', padding: '16px', borderRadius: '16px', border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '1rem', outline: 'none', WebkitAppearance: 'none' }}>
                  <option value="" disabled>Select personal account...</option>
                  {accounts.filter(acc => {
                    if (category === 'Credit Card') return acc.type === 'Credit Card';
                    if (category === 'Informal') return acc.type !== 'Credit Card';
                    return true;
                  }).map(acc => (
                    <option key={acc.id} value={acc.id}>{acc.name} (₹{acc.type === 'Credit Card' ? Number(acc.creditLimit || 0) - Number(acc.balance || 0) : acc.balance})</option>
                  ))}
                </select>
              </div>

              {/* Category */}
              <div style={{ display: 'flex', gap: '10px' }}>
                {type === 'taken' ? (
                  ['Bank', 'Credit Card', 'Informal'].map(cat => (
                    <button key={cat} type="button" onClick={() => setCategory(cat)} style={{ flex: 1, padding: '10px', borderRadius: '12px', border: '1px solid', borderColor: category === cat ? 'var(--text-primary)' : 'var(--border-subtle)', background: category === cat ? 'var(--text-primary)' : 'transparent', color: category === cat ? 'var(--bg-primary)' : 'var(--text-primary)', fontWeight: 600, transition: '0.2s', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '5px' }}>
                      {cat === 'Bank' ? <IoBriefcaseOutline /> : cat === 'Credit Card' ? <IoCardOutline /> : <IoPersonOutline />}
                      {cat}
                    </button>
                  ))
                ) : (
                  <button type="button" style={{ flex: 1, padding: '10px', borderRadius: '12px', border: '1px solid var(--text-primary)', background: 'var(--text-primary)', color: 'var(--bg-primary)', fontWeight: 600, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '5px' }}>
                    <IoPersonOutline />
                    Informal
                  </button>
                )}
              </div>

              {category === 'Informal' ? (
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 600 }}>Link Avora User (Optional) or Enter Name</label>
                  {linkedUser ? (
                    <div style={{ background: 'rgba(0, 113, 227, 0.1)', padding: '15px', borderRadius: '16px', border: '1px solid var(--brand-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <IoPersonOutline size={20} color="var(--brand-primary)" />
                        <div>
                          <p style={{ margin: 0, fontWeight: 700, color: 'var(--brand-primary)' }}>@{linkedUser.username}</p>
                          <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{linkedUser.email}</p>
                        </div>
                      </div>
                      <button type="button" onClick={() => setLinkedUser(null)} style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '5px' }}>
                        <IoClose size={20} />
                      </button>
                    </div>
                  ) : (
                    <div style={{ position: 'relative' }}>
                      <input 
                        type="text" 
                        value={searchQuery} 
                        onChange={(e) => {
                          setSearchQuery(e.target.value);
                          setPersonName(e.target.value); // Fallback to manual name
                        }}
                        placeholder="Type username, email, or enter manual name..." 
                        style={{ width: '100%', padding: '16px', borderRadius: '16px', border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '1rem', outline: 'none' }} 
                      />
                      
                      {searchResults.length > 0 && (
                        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)', borderRadius: '12px', marginTop: '5px', zIndex: 10, boxShadow: '0 5px 15px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
                          {searchResults.map(u => (
                            <div 
                              key={u.uid} 
                              onClick={() => { setLinkedUser(u); setSearchQuery(''); setPersonName(''); }}
                              style={{ padding: '12px 15px', borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer', display: 'flex', flexDirection: 'column' }}
                            >
                              <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>@{u.username}</span>
                              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{u.email}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 600 }}>{type === 'taken' ? 'Lender Name (Bank)' : 'Borrower Name'}</label>
                  <input type="text" value={personName} onChange={e => setPersonName(e.target.value)} placeholder="e.g. HDFC Bank" required style={{ width: '100%', padding: '16px', borderRadius: '16px', border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '1rem', outline: 'none' }} />
                </div>
              )}

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
                  
                  {isOngoing && livePaidEMIs > 0 && (
                    <div style={{ marginTop: '15px', paddingTop: '15px', borderTop: '1px solid var(--border-subtle)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                       <div>
                         <p style={{ margin: '0 0 5px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>EMIs Paid So Far</p>
                         <h4 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--success)' }}>{livePaidEMIs} <span style={{fontSize: '0.8rem'}}>(₹{livePaidAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })})</span></h4>
                       </div>
                       <div>
                         <p style={{ margin: '0 0 5px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Adjusted Principal</p>
                         <h4 style={{ margin: 0, fontSize: '1.2rem', color: '#FF9500' }}>₹{liveOutstanding.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</h4>
                       </div>
                    </div>
                  )}
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
