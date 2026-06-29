import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase';
import { ref, onValue, push, set, query, orderByChild, equalTo, get, update } from 'firebase/database';
import { IoAdd, IoEnterOutline, IoPeopleOutline, IoChevronForward } from 'react-icons/io5';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

function Groups() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  
  // Create Form State
  const [groupName, setGroupName] = useState('');
  const [groupType, setGroupType] = useState('Flat');
  const [isSaving, setIsSaving] = useState(false);

  // Join Form State
  const [inviteCode, setInviteCode] = useState('');
  const [joinError, setJoinError] = useState('');

  useEffect(() => {
    if (!currentUser) return;
    
    const userGroupsRef = ref(db, `userGroups/${currentUser.uid}`);
    const unsub = onValue(userGroupsRef, async (snapshot) => {
      const data = snapshot.val();
      if (data) {
        // Fetch details for each group ID
        const groupIds = Object.keys(data);
        const groupPromises = groupIds.map(async (gId) => {
          const gSnap = await get(ref(db, `groups/${gId}`));
          const mSnap = await get(ref(db, `groupMembers/${gId}/${currentUser.uid}`));
          return { id: gId, ...gSnap.val(), myStatus: mSnap.val()?.status, myRole: mSnap.val()?.role };
        });
        
        const resolvedGroups = await Promise.all(groupPromises);
        setGroups(resolvedGroups);
      } else {
        setGroups([]);
      }
      setLoading(false);
    });
    return () => unsub();
  }, [currentUser]);

  const generateInviteCode = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  };

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const groupId = push(ref(db, 'groups')).key;
      const code = generateInviteCode();
      
      const updates = {};
      // 1. Group info
      updates[`groups/${groupId}`] = {
        name: groupName,
        type: groupType,
        inviteCode: code,
        createdBy: currentUser.uid,
        createdAt: new Date().toISOString()
      };
      
      // 2. Member info (Admin)
      updates[`groupMembers/${groupId}/${currentUser.uid}`] = {
        role: 'admin',
        status: 'approved',
        joinedAt: new Date().toISOString()
      };
      
      // 3. User's groups index
      updates[`userGroups/${currentUser.uid}/${groupId}`] = true;

      // 4. Global Invite Code Index for fast joining
      updates[`inviteCodes/${code}`] = groupId;

      await update(ref(db), updates);
      
      setIsCreateModalOpen(false);
      setGroupName('');
    } catch (err) {
      console.error(err);
      toast.error('Failed to create group');
    }
    setIsSaving(false);
  };

  const handleJoinGroup = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setJoinError('');
    try {
      const code = inviteCode.toUpperCase();
      let groupId = null;
      let groupName = '';

      // Check fast index first
      const inviteSnap = await get(ref(db, `inviteCodes/${code}`));
      if (inviteSnap.exists()) {
        groupId = inviteSnap.val();
        const groupSnap = await get(ref(db, `groups/${groupId}`));
        groupName = groupSnap.val()?.name || 'the group';
      } else {
        // Fallback for groups created before the index was added
        const groupsSnap = await get(ref(db, 'groups'));
        if (groupsSnap.exists()) {
          const allGroups = groupsSnap.val();
          for (const key in allGroups) {
            if (allGroups[key].inviteCode === code) {
              groupId = key;
              groupName = allGroups[key].name;
              // Backfill the index
              await set(ref(db, `inviteCodes/${code}`), groupId);
              break;
            }
          }
        }
      }

      if (groupId) {
        // Check if already requested or joined
        const memberSnap = await get(ref(db, `groupMembers/${groupId}/${currentUser.uid}`));
        if (memberSnap.exists()) {
          setJoinError('You have already joined or requested to join this group.');
          setIsSaving(false);
          return;
        }

        const updates = {};
        // Add as pending member
        updates[`groupMembers/${groupId}/${currentUser.uid}`] = {
          role: 'member',
          status: 'pending',
          joinedAt: new Date().toISOString()
        };
        // Add to user's list (so they can see it in pending state)
        updates[`userGroups/${currentUser.uid}/${groupId}`] = true;

        await update(ref(db), updates);
        
        setIsJoinModalOpen(false);
        setInviteCode('');
        toast.success(`Request sent to join ${groupName}. An admin must approve you.`);
      } else {
        setJoinError('Invalid invite code');
      }
    } catch (err) {
      console.error(err);
      setJoinError('Failed to join group. Error: ' + err.message);
    }
    setIsSaving(false);
  };

  if (loading) return <div style={{ textAlign: 'center', padding: '40px' }}>Loading Groups...</div>;

  return (
    <div className="container" style={{ paddingTop: '20px', paddingBottom: '100px', maxWidth: '600px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <h2 style={{ fontSize: '2rem', fontWeight: 800, margin: 0, letterSpacing: '-0.5px' }}>Groups</h2>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => setIsJoinModalOpen(true)} style={{ padding: '10px 14px', borderRadius: '16px', border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
            <IoEnterOutline size={20} /> Join
          </button>
          <button onClick={() => setIsCreateModalOpen(true)} className="btn-primary" style={{ padding: '10px 14px', borderRadius: '16px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
            <IoAdd size={20} /> Create
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        {groups.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', background: 'var(--bg-secondary)', borderRadius: '24px' }}>
            <IoPeopleOutline size={48} style={{ color: 'var(--text-tertiary)', marginBottom: '10px' }} />
            <h3 style={{ margin: '0 0 10px 0' }}>No Groups Yet</h3>
            <p style={{ color: 'var(--text-secondary)', margin: 0 }}>Create a group or join one using an invite code to start sharing expenses.</p>
          </div>
        ) : (
          groups.map(group => (
            <motion.div 
              key={group.id}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                if (group.myStatus === 'approved') navigate(`/groups/${group.id}`);
              }}
              style={{ 
                background: 'var(--bg-secondary)', borderRadius: '20px', padding: '20px', 
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                cursor: group.myStatus === 'approved' ? 'pointer' : 'default',
                opacity: group.myStatus === 'pending' ? 0.6 : 1
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <div style={{ width: '50px', height: '50px', borderRadius: '16px', background: 'var(--brand-gradient)', color: 'white', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '1.2rem', fontWeight: 800 }}>
                  {group.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 style={{ margin: '0 0 4px 0', fontSize: '1.1rem', fontWeight: 700 }}>{group.name}</h3>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', background: 'var(--bg-primary)', padding: '2px 8px', borderRadius: '8px' }}>
                    {group.type}
                  </span>
                  {group.myStatus === 'pending' && (
                    <span style={{ marginLeft: '10px', fontSize: '0.8rem', color: '#FF9500', fontWeight: 600 }}>Pending Approval</span>
                  )}
                </div>
              </div>
              {group.myStatus === 'approved' && (
                <IoChevronForward size={24} color="var(--text-tertiary)" />
              )}
            </motion.div>
          ))
        )}
      </div>

      {/* Create Modal */}
      <AnimatePresence>
        {isCreateModalOpen && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 2000, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} style={{ background: 'var(--bg-primary)', padding: '30px', borderRadius: '24px', width: '90%', maxWidth: '400px' }}>
              <h3 style={{ margin: '0 0 20px 0' }}>Create Group</h3>
              <form onSubmit={handleCreateGroup} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <input 
                  type="text" value={groupName} onChange={e => setGroupName(e.target.value)} 
                  placeholder="Group Name (e.g. Goa Trip)" required
                  style={{ padding: '15px', borderRadius: '12px', border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }} 
                />
                <select 
                  value={groupType} onChange={e => setGroupType(e.target.value)} 
                  style={{ padding: '15px', borderRadius: '12px', border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', WebkitAppearance: 'none' }}
                >
                  <option>Flat</option>
                  <option>Trip</option>
                  <option>Event</option>
                  <option>Office</option>
                  <option>Custom</option>
                </select>
                <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                  <button type="button" onClick={() => setIsCreateModalOpen(false)} style={{ flex: 1, padding: '15px', borderRadius: '12px', background: 'var(--bg-secondary)', border: 'none', color: 'var(--text-primary)', fontWeight: 600 }}>Cancel</button>
                  <button type="submit" disabled={isSaving} className="btn-primary" style={{ flex: 1, padding: '15px', borderRadius: '12px', fontWeight: 600 }}>Create</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Join Modal */}
      <AnimatePresence>
        {isJoinModalOpen && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 2000, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} style={{ background: 'var(--bg-primary)', padding: '30px', borderRadius: '24px', width: '90%', maxWidth: '400px' }}>
              <h3 style={{ margin: '0 0 10px 0' }}>Join Group</h3>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '20px' }}>Enter the 6-character invite code.</p>
              
              <form onSubmit={handleJoinGroup} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <input 
                  type="text" value={inviteCode} onChange={e => setInviteCode(e.target.value)} 
                  placeholder="Invite Code" required maxLength={6}
                  style={{ padding: '15px', borderRadius: '12px', border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '2px', textAlign: 'center', fontSize: '1.2rem', fontWeight: 700 }} 
                />
                
                {joinError && <div style={{ color: 'var(--danger)', fontSize: '0.9rem', textAlign: 'center' }}>{joinError}</div>}
                
                <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                  <button type="button" onClick={() => setIsJoinModalOpen(false)} style={{ flex: 1, padding: '15px', borderRadius: '12px', background: 'var(--bg-secondary)', border: 'none', color: 'var(--text-primary)', fontWeight: 600 }}>Cancel</button>
                  <button type="submit" disabled={isSaving} className="btn-primary" style={{ flex: 1, padding: '15px', borderRadius: '12px', fontWeight: 600 }}>Join</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default Groups;
