import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase';
import { ref, onValue, get, update, remove, push } from 'firebase/database';
import { IoChevronBack, IoSettingsOutline, IoTimeOutline, IoWalletOutline, IoPieChartOutline, IoCheckmarkCircle, IoCloseCircle, IoAdd, IoTrashOutline, IoPencilOutline } from 'react-icons/io5';
import { motion, AnimatePresence } from 'framer-motion';
import { useCategories } from '../context/CategoryContext';
import { calculateSimplifiedDebts } from '../utils/debtSimplifier';
import AddGroupExpenseModal from '../components/AddGroupExpenseModal';
import { useLongPress } from 'use-long-press';

function GroupDetails() {
  const { groupId } = useParams();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const { categories } = useCategories();

  const [group, setGroup] = useState(null);
  const [members, setMembers] = useState([]);
  const [usersInfo, setUsersInfo] = useState({});
  const [expenses, setExpenses] = useState([]);
  const [settlements, setSettlements] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [myRole, setMyRole] = useState('member');
  const [activeTab, setActiveTab] = useState('timeline');
  const [loading, setLoading] = useState(true);
  
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);

  // New Modals State
  const [settleUpData, setSettleUpData] = useState(null);
  const [confirmData, setConfirmData] = useState(null);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  
  const [actionSheetItem, setActionSheetItem] = useState(null);

  useEffect(() => {
    if (!currentUser) return;

    // Fetch Accounts
    const accountsRef = ref(db, `accounts/${currentUser.uid}`);
    const unsubAccounts = onValue(accountsRef, (snap) => {
      const data = snap.val();
      if (data) {
        setAccounts(Object.keys(data).map(k => ({ id: k, ...data[k] })));
      } else {
        setAccounts([]);
      }
    });

    // Fetch Group Details
    const groupRef = ref(db, `groups/${groupId}`);
    const unsubGroup = onValue(groupRef, (snap) => {
      if (snap.exists()) {
        setGroup({ id: groupId, ...snap.val() });
      } else {
        navigate('/groups');
      }
    });

    // Fetch Members
    const membersRef = ref(db, `groupMembers/${groupId}`);
    const unsubMembers = onValue(membersRef, async (snap) => {
      const data = snap.val();
      if (data) {
        const memberList = Object.keys(data).map(uid => ({ uid, ...data[uid] }));

        const uInfos = {};
        await Promise.all(memberList.map(async (m) => {
          try {
            const uSnap = await get(ref(db, `users/${m.uid}`));
            if (uSnap.exists()) {
              uInfos[m.uid] = uSnap.val();
            } else {
              uInfos[m.uid] = { name: 'Unknown User (No Profile)' };
            }
          } catch (err) {
            console.error("Error fetching user", m.uid, err);
            uInfos[m.uid] = { name: 'Unknown User (Error)' };
          }
        }));
        
        setUsersInfo(uInfos);
        setMembers(memberList);

        const me = memberList.find(m => m.uid === currentUser.uid);
        if (me) setMyRole(me.role);
      } else {
        setMembers([]);
      }
      setLoading(false);
    });

    // Fetch Expenses
    const expensesRef = ref(db, `groupExpenses/${groupId}`);
    const unsubExpenses = onValue(expensesRef, (snap) => {
      const data = snap.val();
      if (data) {
        const expList = Object.keys(data).map(k => ({ id: k, ...data[k] })).sort((a, b) => {
          const dateDiff = new Date(b.date) - new Date(a.date);
          if (dateDiff !== 0) return dateDiff;
          return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
        });
        setExpenses(expList);
      } else {
        setExpenses([]);
      }
    });

    // Fetch Settlements
    const settlementsRef = ref(db, `groupSettlements/${groupId}`);
    const unsubSettlements = onValue(settlementsRef, (snap) => {
      const data = snap.val();
      if (data) {
        setSettlements(Object.keys(data).map(k => ({ id: k, ...data[k] })));
      } else {
        setSettlements([]);
      }
    });

    const handleOpenModal = () => setIsAddExpenseOpen(true);
    window.addEventListener('openGroupExpenseModal', handleOpenModal);

    return () => { 
      unsubGroup(); unsubMembers(); unsubExpenses(); unsubSettlements(); unsubAccounts();
      window.removeEventListener('openGroupExpenseModal', handleOpenModal);
    };
  }, [currentUser, groupId, navigate]);

  const bindLongPress = useLongPress((event, { context }) => {
    setActionSheetItem(context);
  }, { threshold: 500, cancelOnMovement: true });

  const handleApprove = async (uid) => {
    try {
      await update(ref(db, `groupMembers/${groupId}/${uid}`), { status: 'approved' });
    } catch (err) {
      toast.error('Failed to approve');
    }
  };

  const handleReject = async (uid) => {
    try {
      await remove(ref(db, `groupMembers/${groupId}/${uid}`));
      await remove(ref(db, `userGroups/${uid}/${groupId}`));
    } catch (err) {
      toast.error('Failed to reject');
    }
  };

  // --- Settle Up Logic (Payer) ---
  const handleSettleUpClick = (tx) => {
    setSettleUpData(tx);
    setSelectedAccountId(accounts.length > 0 ? accounts[0].id : '');
  };

  const submitSettleUp = async () => {
    if (!selectedAccountId) return toast.error('Select an account to pay from');

    const receiverInfo = usersInfo[settleUpData.to];
    const upiId = receiverInfo?.upiId;

    try {
      const numAmount = Number(settleUpData.amount);
      const settleId = push(ref(db, `groupSettlements/${groupId}`)).key;
      const txId = push(ref(db, `transactions/${currentUser.uid}`)).key;
      
      const updates = {};
      
      updates[`groupSettlements/${groupId}/${settleId}`] = {
        id: settleId,
        paidBy: currentUser.uid,
        paidTo: settleUpData.to,
        amount: numAmount,
        status: 'pending',
        linkedTransactionId: txId, 
        createdAt: new Date().toISOString()
      };

      updates[`transactions/${currentUser.uid}/${txId}`] = {
        id: txId,
        type: 'expense',
        amount: numAmount,
        accountId: selectedAccountId,
        categoryId: null,
        note: `Sent settlement to ${receiverInfo?.name || 'User'}`,
        isGroupSettlement: true,
        groupId,
        groupSettlementId: settleId,
        date: new Date().toISOString().split('T')[0],
        time: new Date().toTimeString().slice(0, 5),
        createdAt: new Date().toISOString()
      };

      const accSnapshot = await get(ref(db, `accounts/${currentUser.uid}/${selectedAccountId}`));
      if (accSnapshot.exists()) {
        const acc = accSnapshot.val();
        updates[`accounts/${currentUser.uid}/${selectedAccountId}/balance`] = acc.type === 'Credit Card' 
          ? Number(acc.balance) + numAmount 
          : Number(acc.balance) - numAmount;
      }

      await update(ref(db), updates);
      toast.success('Payment recorded and sent for confirmation.');
      setSettleUpData(null);

      // Open UPI app after successful recording
      if (upiId) {
        const upiUrl = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(receiverInfo.name)}&am=${settleUpData.amount}`;
        setTimeout(() => {
          window.location.href = upiUrl;
        }, 500);
      }
    } catch (err) {
      toast.error('Failed to mark as paid.');
    }
  };

  // --- Confirm Settlement Logic (Receiver) ---
  const handleConfirmClick = (s, isApproved) => {
    if (isApproved) {
      setConfirmData({ ...s, isApproved });
      const validAccounts = accounts.filter(a => a.type !== 'Credit Card');
      setSelectedAccountId(validAccounts.length > 0 ? validAccounts[0].id : '');
    } else {
      if (window.confirm("Reject this payment? The money will be refunded to the payer.")) {
        submitConfirm({ ...s, isApproved: false });
      }
    }
  };

  const submitConfirm = async (data = confirmData) => {
    try {
      const updates = {};
      const numAmount = Number(data.amount);
      
      if (data.isApproved) {
        if (!selectedAccountId) return toast.error('Select an account to receive money');
        const txId = push(ref(db, `transactions/${currentUser.uid}`)).key;

        updates[`groupSettlements/${groupId}/${data.id}/status`] = 'approved';
        updates[`groupSettlements/${groupId}/${data.id}/updatedAt`] = new Date().toISOString();

        updates[`transactions/${currentUser.uid}/${txId}`] = {
          id: txId,
          type: 'income',
          amount: numAmount,
          accountId: selectedAccountId,
          categoryId: null,
          note: `Received settlement from ${usersInfo[data.paidBy]?.name || 'User'}`,
          isGroupSettlement: true,
          groupId,
          groupSettlementId: data.id,
          date: new Date().toISOString().split('T')[0],
          time: new Date().toTimeString().slice(0, 5),
          createdAt: new Date().toISOString()
        };

        const accSnapshot = await get(ref(db, `accounts/${currentUser.uid}/${selectedAccountId}`));
        if (accSnapshot.exists()) {
          const acc = accSnapshot.val();
          updates[`accounts/${currentUser.uid}/${selectedAccountId}/balance`] = acc.type === 'Credit Card' 
            ? Number(acc.balance) - numAmount 
            : Number(acc.balance) + numAmount;
        }

        await update(ref(db), updates);
        toast.success('Payment received and balance updated.');
        setConfirmData(null);
      } else {
        updates[`groupSettlements/${groupId}/${data.id}/status`] = 'rejected';
        updates[`groupSettlements/${groupId}/${data.id}/updatedAt`] = new Date().toISOString();

        if (data.linkedTransactionId) {
           const payerTxSnap = await get(ref(db, `transactions/${data.paidBy}/${data.linkedTransactionId}`));
           if (payerTxSnap.exists()) {
             const payerTx = payerTxSnap.val();
             updates[`transactions/${data.paidBy}/${data.linkedTransactionId}`] = null; 
             
             const payerAccSnap = await get(ref(db, `accounts/${data.paidBy}/${payerTx.accountId}`));
             if (payerAccSnap.exists()) {
               const pAcc = payerAccSnap.val();
               updates[`accounts/${data.paidBy}/${payerTx.accountId}/balance`] = pAcc.type === 'Credit Card'
                 ? Number(pAcc.balance) - numAmount
                 : Number(pAcc.balance) + numAmount;
             }
           }
        }
        
        await update(ref(db), updates);
        toast.success('Payment rejected and refunded.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to update status.');
    }
  };

  const handleDeleteGroupExpense = async (expense) => {
    if (!window.confirm("Delete this group expense? This will also reverse the personal transaction.")) return;
    
    try {
      const updates = {};
      updates[`groupExpenses/${groupId}/${expense.id}`] = null;
      
      if (expense.linkedTransactionId && expense.paidBy === currentUser.uid) {
         const txSnap = await get(ref(db, `transactions/${currentUser.uid}/${expense.linkedTransactionId}`));
         if (txSnap.exists()) {
           const tx = txSnap.val();
           updates[`transactions/${currentUser.uid}/${expense.linkedTransactionId}`] = null;
           
           const accSnap = await get(ref(db, `accounts/${currentUser.uid}/${tx.accountId}`));
           if (accSnap.exists()) {
             const acc = accSnap.val();
             const numAmount = Number(tx.amount);
             updates[`accounts/${currentUser.uid}/${tx.accountId}/balance`] = acc.type === 'Credit Card'
               ? Number(acc.balance) - numAmount
               : Number(acc.balance) + numAmount;
           }
         }
      }
      
      await update(ref(db), updates);
      toast.success('Expense deleted.');
      setActionSheetItem(null);
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete expense.');
    }
  };

  const getCategoryDetails = (categoryId) => {
    const allCats = [...categories.expense, ...categories.income];
    const cat = allCats.find(c => c.id === categoryId);
    return cat || { name: 'Unknown', icon: '📝' };
  };

  const renderTimeline = () => {
    const approvedSettlements = settlements.filter(s => s.status === 'approved').map(s => ({
      ...s,
      isSettlement: true,
      date: s.updatedAt ? s.updatedAt.split('T')[0] : s.createdAt.split('T')[0]
    }));

    const timelineItems = [...expenses, ...approvedSettlements].sort((a, b) => {
      const dateDiff = new Date(b.date) - new Date(a.date);
      if (dateDiff !== 0) return dateDiff;
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });

    if (timelineItems.length === 0) {
      return (
        <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-tertiary)' }}>
          <IoTimeOutline size={48} style={{ opacity: 0.5, marginBottom: '10px' }} />
          <h3 style={{ margin: '0 0 10px 0' }}>No Activity Yet</h3>
          <p>Add a group expense or settle up to get started.</p>
        </div>
      );
    }

    return (
      <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{fontSize: '0.8rem', color: 'var(--text-tertiary)', textAlign: 'center', marginBottom: '10px'}}>Long press an expense to edit or delete</div>
        {timelineItems.map(item => {
          if (item.isSettlement) {
            const payerName = item.paidBy === currentUser.uid ? 'You' : (usersInfo[item.paidBy]?.name || 'Someone');
            const receiverName = item.paidTo === currentUser.uid ? 'You' : (usersInfo[item.paidTo]?.name || 'Someone');
            
            return (
              <motion.div 
                key={item.id}
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                style={{ background: 'var(--bg-secondary)', borderRadius: '16px', padding: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                  <div style={{ width: '45px', height: '45px', borderRadius: '14px', background: 'rgba(52, 199, 89, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', color: 'var(--success)' }}>
                    💸
                  </div>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)' }}>Payment</h4>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
                      {payerName} paid {receiverName} • {new Date(item.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--success)' }}>₹{item.amount.toLocaleString('en-IN')}</span>
                </div>
              </motion.div>
            );
          }

          const cat = getCategoryDetails(item.categoryId);
          const payerName = item.paidBy === currentUser.uid ? 'You' : (usersInfo[item.paidBy]?.name || 'Someone');
          const isMine = item.paidBy === currentUser.uid;
          
          return (
            <motion.div 
              key={item.id}
              {...(isMine ? bindLongPress({ type: 'expense', data: item }) : {})}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              style={{ background: 'var(--bg-secondary)', borderRadius: '16px', padding: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: isMine ? 'pointer' : 'default', userSelect: 'none' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <div style={{ width: '45px', height: '45px', borderRadius: '14px', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem' }}>
                  {cat.icon}
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)' }}>{item.note}</h4>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
                    Paid by {payerName} • {new Date(item.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </span>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>₹{item.amount.toLocaleString('en-IN')}</span>
              </div>
            </motion.div>
          );
        })}
      </div>
    );
  };

  const renderBalances = () => {
    const simplifiedDebts = calculateSimplifiedDebts(expenses, settlements, currentUser.uid);
    const pendingSettlements = settlements.filter(s => s.status === 'pending');
    
    const iOwe = simplifiedDebts.filter(tx => tx.from === currentUser.uid);
    const owedToMe = simplifiedDebts.filter(tx => tx.to === currentUser.uid);
    
    const myPendingAsPayer = pendingSettlements.filter(s => s.paidBy === currentUser.uid);
    const myPendingAsReceiver = pendingSettlements.filter(s => s.paidTo === currentUser.uid);

    return (
      <div style={{ padding: '20px' }}>
        
        {myPendingAsReceiver.length > 0 && (
          <div style={{ marginBottom: '30px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '15px', color: '#FF9500' }}>Confirm Payments</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {myPendingAsReceiver.map(s => (
                <div key={s.id} style={{ background: 'var(--bg-secondary)', borderRadius: '16px', padding: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #FF9500' }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{usersInfo[s.paidBy]?.name} paid you</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--success)' }}>₹{s.amount.toLocaleString()}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button onClick={() => handleConfirmClick(s, true)} style={{ background: 'rgba(52, 199, 89, 0.1)', color: 'var(--success)', border: 'none', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer' }}><IoCheckmarkCircle size={24} /></button>
                    <button onClick={() => handleConfirmClick(s, false)} style={{ background: 'rgba(255, 69, 58, 0.1)', color: 'var(--danger)', border: 'none', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer' }}><IoCloseCircle size={24} /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {myPendingAsPayer.length > 0 && (
          <div style={{ marginBottom: '30px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '15px', color: 'var(--text-secondary)' }}>Awaiting Confirmation</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {myPendingAsPayer.map(s => (
                <div key={s.id} style={{ background: 'var(--bg-secondary)', borderRadius: '16px', padding: '15px', opacity: 0.7 }}>
                  <div style={{ fontSize: '0.9rem' }}>You sent ₹{s.amount} to {usersInfo[s.paidTo]?.name}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>Waiting for them to confirm.</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '15px', color: 'var(--danger)' }}>You Owe</h3>
        {iOwe.length === 0 ? (
           <p style={{ color: 'var(--text-tertiary)', fontSize: '0.9rem', marginBottom: '30px' }}>You're all settled up!</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '30px' }}>
            {iOwe.map((tx, i) => (
              <div key={i} style={{ background: 'var(--bg-secondary)', borderRadius: '16px', padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>To {usersInfo[tx.to]?.name}</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--danger)' }}>₹{tx.amount.toLocaleString()}</div>
                </div>
                <button onClick={() => handleSettleUpClick(tx)} className="btn-primary" style={{ padding: '10px 16px', borderRadius: '12px', fontWeight: 700, fontSize: '0.9rem' }}>
                  Settle Up
                </button>
              </div>
            ))}
          </div>
        )}

        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '15px', color: 'var(--success)' }}>Owed To You</h3>
        {owedToMe.length === 0 ? (
           <p style={{ color: 'var(--text-tertiary)', fontSize: '0.9rem' }}>Nobody owes you anything.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {owedToMe.map((tx, i) => (
              <div key={i} style={{ background: 'var(--bg-secondary)', borderRadius: '16px', padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>From {usersInfo[tx.from]?.name}</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--success)' }}>₹{tx.amount.toLocaleString()}</div>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    );
  };

  const renderStats = () => {
    const totalSpent = expenses.reduce((sum, exp) => sum + exp.amount, 0);
    const spentByMember = {};
    expenses.forEach(exp => {
      if (!spentByMember[exp.paidBy]) spentByMember[exp.paidBy] = 0;
      spentByMember[exp.paidBy] += exp.amount;
    });
    const sortedSpenders = Object.keys(spentByMember).sort((a,b) => spentByMember[b] - spentByMember[a]);

    return (
      <div style={{ padding: '20px' }}>
        <div style={{ background: 'var(--brand-gradient)', borderRadius: '24px', padding: '30px', color: 'white', textAlign: 'center', marginBottom: '30px', boxShadow: '0 10px 20px rgba(94, 92, 230, 0.3)' }}>
          <h3 style={{ margin: '0 0 10px 0', fontSize: '1.1rem', fontWeight: 600, opacity: 0.9 }}>Total Group Spending</h3>
          <div style={{ fontSize: '3rem', fontWeight: 900, letterSpacing: '-1px' }}>₹{totalSpent.toLocaleString('en-IN')}</div>
        </div>

        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '15px' }}>Top Spenders</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {sortedSpenders.length === 0 ? (
            <p style={{ color: 'var(--text-tertiary)', fontSize: '0.9rem' }}>No expenses yet.</p>
          ) : (
            sortedSpenders.map((uid, idx) => {
              const amount = spentByMember[uid];
              const percentage = (amount / totalSpent) * 100;
              return (
                <div key={uid} style={{ background: 'var(--bg-secondary)', borderRadius: '16px', padding: '15px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--text-primary)', color: 'var(--bg-primary)', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '0.8rem', fontWeight: 'bold' }}>
                        {idx + 1}
                      </div>
                      <span style={{ fontWeight: 600 }}>{usersInfo[uid]?.name || 'Unknown'}</span>
                    </div>
                    <span style={{ fontWeight: 700 }}>₹{amount.toLocaleString()}</span>
                  </div>
                  <div style={{ width: '100%', height: '8px', background: 'var(--border-subtle)', borderRadius: '4px', overflow: 'hidden' }}>
                    <motion.div 
                      initial={{ width: 0 }} animate={{ width: `${percentage}%` }} transition={{ duration: 1, delay: 0.2 }}
                      style={{ height: '100%', background: 'var(--brand-primary)', borderRadius: '4px' }} 
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  };

  const renderSettings = () => {
    const pendingMembers = members.filter(m => m.status === 'pending');
    const approvedMembers = members.filter(m => m.status === 'approved');

    return (
      <div style={{ padding: '20px' }}>
        <div style={{ background: 'var(--bg-secondary)', borderRadius: '20px', padding: '20px', marginBottom: '30px', textAlign: 'center' }}>
          <h3 style={{ margin: '0 0 10px 0', fontSize: '1rem', color: 'var(--text-secondary)' }}>Group Invite Code</h3>
          <div style={{ fontSize: '2.5rem', fontWeight: 800, letterSpacing: '4px', color: 'var(--brand-primary)', userSelect: 'all' }}>
            {group?.inviteCode}
          </div>
          <p style={{ margin: '10px 0 0 0', fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>Share this code with friends so they can request to join.</p>
        </div>

        {myRole === 'admin' && pendingMembers.length > 0 && (
          <div style={{ marginBottom: '30px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '15px', color: '#FF9500' }}>Pending Requests ({pendingMembers.length})</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {pendingMembers.map(m => (
                <div key={m.uid} style={{ background: 'var(--bg-secondary)', borderRadius: '16px', padding: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--brand-gradient)', color: 'white', display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: 'bold' }}>
                      {usersInfo[m.uid]?.name?.charAt(0).toUpperCase() || '?'}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600 }}>{usersInfo[m.uid]?.name || 'Unknown User'}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>Requested to join</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button onClick={() => handleApprove(m.uid)} style={{ background: 'rgba(52, 199, 89, 0.1)', color: 'var(--success)', border: 'none', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer' }}><IoCheckmarkCircle size={24} /></button>
                    <button onClick={() => handleReject(m.uid)} style={{ background: 'rgba(255, 69, 58, 0.1)', color: 'var(--danger)', border: 'none', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer' }}><IoCloseCircle size={24} /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '15px' }}>Members ({approvedMembers.length})</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {approvedMembers.map(m => (
              <div key={m.uid} style={{ background: 'var(--bg-secondary)', borderRadius: '16px', padding: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--bg-primary)', display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: 'bold' }}>
                    {usersInfo[m.uid]?.name?.charAt(0).toUpperCase() || '?'}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600 }}>{usersInfo[m.uid]?.name || 'Unknown User'} {m.uid === currentUser.uid && '(You)'}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{m.role}</div>
                  </div>
                </div>
                {myRole === 'admin' && m.uid !== currentUser.uid && m.role !== 'admin' && (
                  <button onClick={() => handleReject(m.uid)} style={{ background: 'none', border: 'none', color: 'var(--danger)', fontSize: '0.9rem', cursor: 'pointer' }}>Remove</button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  if (loading) return <div style={{ textAlign: 'center', padding: '40px' }}>Loading...</div>;
  if (!group) return null;

  return (
    <div style={{ backgroundColor: 'var(--bg-primary)', minHeight: '100vh', paddingBottom: '100px' }}>
      
      <div className="container" style={{ paddingTop: '20px', paddingBottom: '15px', position: 'sticky', top: 0, background: 'var(--bg-primary)', zIndex: 100 }}>
        <header style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <Link to="/groups" style={{ color: 'var(--text-primary)' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--bg-secondary)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <IoChevronBack size={24} />
            </div>
          </Link>
          <div>
            <h2 style={{ fontSize: '1.8rem', fontWeight: 800, margin: 0, letterSpacing: '-0.5px' }}>{group.name}</h2>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', background: 'var(--bg-secondary)', padding: '2px 8px', borderRadius: '12px', marginTop: '4px', display: 'inline-block' }}>{group.type}</span>
          </div>
        </header>
      </div>

      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)', padding: '0 20px', position: 'sticky', top: '75px', backgroundColor: 'var(--bg-primary)', zIndex: 99 }}>
        {['timeline', 'balances', 'stats', 'settings'].map(tab => (
          <button 
            key={tab} onClick={() => setActiveTab(tab)}
            style={{ 
              flex: 1, padding: '15px 0', background: 'none', border: 'none', 
              borderBottom: activeTab === tab ? '3px solid var(--brand-primary)' : '3px solid transparent',
              color: activeTab === tab ? 'var(--brand-primary)' : 'var(--text-secondary)',
              fontWeight: 700, textTransform: 'capitalize', fontSize: '0.9rem', cursor: 'pointer', transition: 'all 0.2s'
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="container" style={{ maxWidth: '600px', margin: '0 auto', paddingTop: '10px' }}>
        <AnimatePresence mode="wait">
          <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
            {activeTab === 'timeline' && renderTimeline()}
            {activeTab === 'balances' && renderBalances()}
            {activeTab === 'stats' && renderStats()}
            {activeTab === 'settings' && renderSettings()}
          </motion.div>
        </AnimatePresence>
      </div>

      <AddGroupExpenseModal 
        isOpen={isAddExpenseOpen} onClose={() => setIsAddExpenseOpen(false)}
        groupId={groupId} members={members} usersInfo={usersInfo}
      />

      {/* Settle Up Modal */}
      <AnimatePresence>
        {settleUpData && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 2000, display: 'flex', justifyContent: 'center', alignItems: 'flex-end', backdropFilter: 'blur(5px)' }}>
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 300 }} style={{ background: 'var(--bg-primary)', width: '100%', maxWidth: '600px', borderTopLeftRadius: '32px', borderTopRightRadius: '32px', padding: '30px' }}>
              <h3 style={{ margin: '0 0 5px 0', fontSize: '1.4rem', fontWeight: 800 }}>Settle Up</h3>
              <p style={{ margin: '0 0 20px 0', color: 'var(--text-secondary)' }}>Paying <strong style={{color: 'var(--text-primary)'}}>₹{settleUpData.amount}</strong> to {usersInfo[settleUpData.to]?.name}</p>
              
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '0.9rem' }}>Pay From Personal Account</label>
              <select value={selectedAccountId} onChange={e => setSelectedAccountId(e.target.value)} style={{ width: '100%', padding: '16px', borderRadius: '16px', border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '1rem', marginBottom: '20px', outline: 'none', WebkitAppearance: 'none' }}>
                {accounts.length === 0 && <option value="" disabled>No accounts found...</option>}
                {accounts.map(acc => (
                  <option key={acc.id} value={acc.id}>{acc.name} (₹{acc.type === 'Credit Card' ? Number(acc.creditLimit||0) - Number(acc.balance||0) : acc.balance})</option>
                ))}
              </select>

              <div style={{ display: 'flex', gap: '15px' }}>
                <button onClick={() => setSettleUpData(null)} style={{ flex: 1, padding: '16px', borderRadius: '16px', background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: 'none', fontWeight: 700, fontSize: '1.1rem', cursor: 'pointer' }}>Cancel</button>
                <button onClick={submitSettleUp} style={{ flex: 1, padding: '16px', borderRadius: '16px', background: 'var(--brand-primary)', color: 'white', border: 'none', fontWeight: 700, fontSize: '1.1rem', cursor: 'pointer' }}>Pay & Record</button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Confirm Settlement Modal */}
        {confirmData && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 2000, display: 'flex', justifyContent: 'center', alignItems: 'flex-end', backdropFilter: 'blur(5px)' }}>
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 300 }} style={{ background: 'var(--bg-primary)', width: '100%', maxWidth: '600px', borderTopLeftRadius: '32px', borderTopRightRadius: '32px', padding: '30px' }}>
              <h3 style={{ margin: '0 0 5px 0', fontSize: '1.4rem', fontWeight: 800 }}>Confirm Receipt</h3>
              <p style={{ margin: '0 0 20px 0', color: 'var(--text-secondary)' }}>Received <strong style={{color: 'var(--success)'}}>₹{confirmData.amount}</strong> from {usersInfo[confirmData.paidBy]?.name}</p>
              
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '0.9rem' }}>Receive Into Account</label>
              <select value={selectedAccountId} onChange={e => setSelectedAccountId(e.target.value)} style={{ width: '100%', padding: '16px', borderRadius: '16px', border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '1rem', marginBottom: '20px', outline: 'none', WebkitAppearance: 'none' }}>
                {accounts.filter(a => a.type !== 'Credit Card').length === 0 && <option value="" disabled>No bank/cash accounts found...</option>}
                {accounts.filter(a => a.type !== 'Credit Card').map(acc => (
                  <option key={acc.id} value={acc.id}>{acc.name} (₹{acc.balance})</option>
                ))}
              </select>

              <div style={{ display: 'flex', gap: '15px' }}>
                <button onClick={() => setConfirmData(null)} style={{ flex: 1, padding: '16px', borderRadius: '16px', background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: 'none', fontWeight: 700, fontSize: '1.1rem', cursor: 'pointer' }}>Cancel</button>
                <button onClick={() => submitConfirm()} style={{ flex: 1, padding: '16px', borderRadius: '16px', background: 'var(--success)', color: 'white', border: 'none', fontWeight: 700, fontSize: '1.1rem', cursor: 'pointer' }}>Confirm Receipt</button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Action Sheet (Long Press) */}
        {actionSheetItem && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 3000, display: 'flex', justifyContent: 'center', alignItems: 'flex-end', backdropFilter: 'blur(5px)' }}>
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 300 }} style={{ background: 'var(--bg-primary)', width: '100%', maxWidth: '600px', borderTopLeftRadius: '32px', borderTopRightRadius: '32px', padding: '30px' }}>
              <h3 style={{ margin: '0 0 20px 0', fontSize: '1.2rem', fontWeight: 700, textAlign: 'center' }}>Manage Expense</h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <button 
                  onClick={() => { toast('Edit coming soon!'); setActionSheetItem(null); }}
                  style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '16px', borderRadius: '16px', background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: 'none', fontSize: '1.1rem', fontWeight: 600, cursor: 'pointer' }}
                >
                  <IoPencilOutline size={22} /> Edit Expense
                </button>
                
                <button 
                  onClick={() => handleDeleteGroupExpense(actionSheetItem.data)}
                  style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '16px', borderRadius: '16px', background: 'rgba(255, 69, 58, 0.1)', color: 'var(--danger)', border: 'none', fontSize: '1.1rem', fontWeight: 600, cursor: 'pointer' }}
                >
                  <IoTrashOutline size={22} /> Delete Expense
                </button>
              </div>

              <button onClick={() => setActionSheetItem(null)} style={{ width: '100%', padding: '16px', borderRadius: '16px', background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: 'none', fontWeight: 700, fontSize: '1.1rem', marginTop: '20px', cursor: 'pointer' }}>Cancel</button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}

export default GroupDetails;
