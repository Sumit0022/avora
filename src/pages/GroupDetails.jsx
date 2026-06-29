import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase';
import { ref, onValue, get, update, remove, push } from 'firebase/database';
import { IoChevronBack, IoSettingsOutline, IoTimeOutline, IoWalletOutline, IoPieChartOutline, IoCheckmarkCircle, IoCloseCircle, IoAdd } from 'react-icons/io5';
import { motion, AnimatePresence } from 'framer-motion';
import { useCategories } from '../context/CategoryContext';
import { calculateSimplifiedDebts } from '../utils/debtSimplifier';
import AddGroupExpenseModal from '../components/AddGroupExpenseModal';

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
  const [myRole, setMyRole] = useState('member');
  const [activeTab, setActiveTab] = useState('timeline');
  const [loading, setLoading] = useState(true);
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);

  useEffect(() => {
    if (!currentUser) return;

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
        setMembers(memberList);

        const uInfos = {};
        await Promise.all(memberList.map(async (m) => {
          const uSnap = await get(ref(db, `users/${m.uid}`));
          if (uSnap.exists()) {
            uInfos[m.uid] = uSnap.val();
          }
        }));
        setUsersInfo(uInfos);

        const me = memberList.find(m => m.uid === currentUser.uid);
        if (me) setMyRole(me.role);
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

    // Listen for Universal Add Button
    const handleOpenModal = () => setIsAddExpenseOpen(true);
    window.addEventListener('openGroupExpenseModal', handleOpenModal);

    return () => { 
      unsubGroup(); 
      unsubMembers(); 
      unsubExpenses(); 
      unsubSettlements(); 
      window.removeEventListener('openGroupExpenseModal', handleOpenModal);
    };
  }, [currentUser, groupId, navigate]);

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

  const handleSettleUp = async (tx) => {
    const receiverInfo = usersInfo[tx.to];
    const upiId = receiverInfo?.upiId;
    
    if (upiId) {
      // Trigger deep link
      const upiUrl = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(receiverInfo.name)}&am=${tx.amount}`;
      window.location.href = upiUrl;
    } else {
      toast.error(`${receiverInfo?.name || 'Receiver'} hasn't set up a UPI ID yet. You can still mark it as paid manually.`);
    }

    if (window.confirm(`Mark ₹${tx.amount} as paid to ${receiverInfo?.name}?`)) {
      try {
        const settleId = push(ref(db, `groupSettlements/${groupId}`)).key;
        await update(ref(db, `groupSettlements/${groupId}/${settleId}`), {
          id: settleId,
          paidBy: currentUser.uid,
          paidTo: tx.to,
          amount: tx.amount,
          status: 'pending',
          createdAt: new Date().toISOString()
        });
      } catch (err) {
        toast.error('Failed to mark as paid.');
      }
    }
  };

  const handleConfirmSettlement = async (settleId, isApproved) => {
    try {
      await update(ref(db, `groupSettlements/${groupId}/${settleId}`), {
        status: isApproved ? 'approved' : 'rejected',
        updatedAt: new Date().toISOString()
      });
    } catch (err) {
      toast.error('Failed to update settlement status.');
    }
  };

  const getCategoryDetails = (categoryId) => {
    const allCats = [...categories.expense, ...categories.income];
    const cat = allCats.find(c => c.id === categoryId);
    return cat || { name: 'Unknown', icon: '📝' };
  };

  const renderTimeline = () => {
    if (expenses.length === 0) {
      return (
        <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-tertiary)' }}>
          <IoTimeOutline size={48} style={{ opacity: 0.5, marginBottom: '10px' }} />
          <h3 style={{ margin: '0 0 10px 0' }}>No Expenses Yet</h3>
          <p>Add a group expense to get started.</p>
        </div>
      );
    }

    return (
      <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {expenses.map(exp => {
          const cat = getCategoryDetails(exp.categoryId);
          const payerName = exp.paidBy === currentUser.uid ? 'You' : (usersInfo[exp.paidBy]?.name || 'Someone');
          
          return (
            <motion.div 
              key={exp.id}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              style={{ background: 'var(--bg-secondary)', borderRadius: '16px', padding: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <div style={{ width: '45px', height: '45px', borderRadius: '14px', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem' }}>
                  {cat.icon}
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)' }}>{exp.note}</h4>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
                    Paid by {payerName} • {new Date(exp.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </span>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>₹{exp.amount.toLocaleString('en-IN')}</span>
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
        
        {/* Action Required: Incoming Settlements */}
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
                    <button onClick={() => handleConfirmSettlement(s.id, true)} style={{ background: 'rgba(52, 199, 89, 0.1)', color: 'var(--success)', border: 'none', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer' }}><IoCheckmarkCircle size={24} /></button>
                    <button onClick={() => handleConfirmSettlement(s.id, false)} style={{ background: 'rgba(255, 69, 58, 0.1)', color: 'var(--danger)', border: 'none', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer' }}><IoCloseCircle size={24} /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pending outgoing (Waiting for receiver to confirm) */}
        {myPendingAsPayer.length > 0 && (
          <div style={{ marginBottom: '30px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '15px', color: 'var(--text-secondary)' }}>Awaiting Confirmation</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {myPendingAsPayer.map(s => (
                <div key={s.id} style={{ background: 'var(--bg-secondary)', borderRadius: '16px', padding: '15px', opacity: 0.7 }}>
                  <div style={{ fontSize: '0.9rem' }}>You marked ₹{s.amount} as paid to {usersInfo[s.paidTo]?.name}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>Waiting for them to confirm.</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* You Owe */}
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
                <button onClick={() => handleSettleUp(tx)} className="btn-primary" style={{ padding: '10px 16px', borderRadius: '12px', fontWeight: 700, fontSize: '0.9rem' }}>
                  Settle Up
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Owed To You */}
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
    
    // Who paid what
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
      
      {/* Header */}
      <div style={{ padding: '20px', position: 'sticky', top: 0, background: 'var(--bg-glass)', backdropFilter: 'blur(20px)', zIndex: 100 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <button onClick={() => navigate('/groups')} style={{ background: 'none', border: 'none', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '1rem', fontWeight: 600, color: 'var(--brand-primary)', cursor: 'pointer' }}>
            <IoChevronBack size={20} /> Groups
          </button>
        </div>
        <h2 style={{ fontSize: '2rem', fontWeight: 800, margin: 0, letterSpacing: '-0.5px' }}>{group.name}</h2>
        <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', background: 'var(--bg-secondary)', padding: '4px 10px', borderRadius: '12px', marginTop: '5px', display: 'inline-block' }}>{group.type}</span>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)', padding: '0 20px', position: 'sticky', top: '120px', backgroundColor: 'var(--bg-primary)', zIndex: 99 }}>
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

      {/* Content */}
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

      {/* Add Expense Modal */}
      <AddGroupExpenseModal 
        isOpen={isAddExpenseOpen}
        onClose={() => setIsAddExpenseOpen(false)}
        groupId={groupId}
        members={members}
        usersInfo={usersInfo}
      />

    </div>
  );
}

export default GroupDetails;
