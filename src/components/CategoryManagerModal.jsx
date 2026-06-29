import React, { useState } from 'react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { IoClose, IoAdd, IoTrashOutline, IoReorderTwoOutline } from 'react-icons/io5';
import { useCategories } from '../context/CategoryContext';

function CategoryManagerModal({ isOpen, onClose }) {
  const { categories, addCategory, deleteCategory, reorderCategories } = useCategories();
  const [activeTab, setActiveTab] = useState('expense');
  const [isAdding, setIsAdding] = useState(false);
  const [newCat, setNewCat] = useState({ name: '', icon: '🌟' });

  // Local state for drag & drop
  const [items, setItems] = useState([]);

  // Sync local state when tab changes or categories update
  React.useEffect(() => {
    if (categories[activeTab]) {
      setItems(categories[activeTab]);
    }
  }, [categories, activeTab]);

  const handleReorder = (newOrder) => {
    setItems(newOrder);
    reorderCategories(activeTab, newOrder);
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newCat.name) return;
    await addCategory({ ...newCat, type: activeTab });
    setIsAdding(false);
    setNewCat({ name: '', icon: '🌟' });
  };

  const handleDelete = (id) => {
    if (window.confirm("Delete this category?")) {
      deleteCategory(id);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(5px)',
              zIndex: 3001
            }}
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            style={{
              position: 'fixed', bottom: 0, left: 0, right: 0,
              backgroundColor: 'var(--bg-primary)',
              borderTopLeftRadius: '32px', borderTopRightRadius: '32px',
              padding: '30px', zIndex: 3002,
              maxHeight: '90vh', display: 'flex', flexDirection: 'column',
              maxWidth: '600px', margin: '0 auto'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '1.4rem', fontWeight: 700 }}>Manage Categories</h3>
              <button onClick={onClose} style={{ background: 'var(--bg-secondary)', borderRadius: '50%', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '8px', display: 'flex' }}>
                <IoClose size={24} />
              </button>
            </div>

            <div style={{ display: 'flex', background: 'var(--bg-secondary)', borderRadius: '16px', padding: '5px', marginBottom: '20px' }}>
              <button 
                onClick={() => setActiveTab('expense')}
                style={{ flex: 1, padding: '12px', borderRadius: '12px', border: 'none', background: activeTab === 'expense' ? 'var(--bg-primary)' : 'transparent', color: activeTab === 'expense' ? 'var(--danger)' : 'var(--text-secondary)', fontWeight: 600, transition: 'all 0.2s', cursor: 'pointer', boxShadow: activeTab === 'expense' ? '0 4px 10px rgba(0,0,0,0.1)' : 'none' }}
              >
                Expense
              </button>
              <button 
                onClick={() => setActiveTab('income')}
                style={{ flex: 1, padding: '12px', borderRadius: '12px', border: 'none', background: activeTab === 'income' ? 'var(--bg-primary)' : 'transparent', color: activeTab === 'income' ? 'var(--success)' : 'var(--text-secondary)', fontWeight: 600, transition: 'all 0.2s', cursor: 'pointer', boxShadow: activeTab === 'income' ? '0 4px 10px rgba(0,0,0,0.1)' : 'none' }}
              >
                Income
              </button>
            </div>

            <div style={{ overflowY: 'auto', flex: 1, marginBottom: '20px', paddingRight: '5px' }}>
              <Reorder.Group axis="y" values={items} onReorder={handleReorder} style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {items.map((cat) => (
                  <Reorder.Item 
                    key={cat.id} 
                    value={cat}
                    style={{ 
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
                      background: 'var(--bg-secondary)', padding: '16px', borderRadius: '16px',
                      cursor: 'grab' 
                    }}
                    whileDrag={{ scale: 1.02, boxShadow: '0 10px 20px rgba(0,0,0,0.1)', cursor: 'grabbing' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                      <IoReorderTwoOutline size={24} color="var(--text-tertiary)" />
                      <div style={{ fontSize: '1.5rem' }}>{cat.icon}</div>
                      <span style={{ fontWeight: 600, fontSize: '1.1rem' }}>{cat.name}</span>
                    </div>
                    <button onClick={() => handleDelete(cat.id)} style={{ background: 'transparent', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: '5px' }}>
                      <IoTrashOutline size={20} />
                    </button>
                  </Reorder.Item>
                ))}
              </Reorder.Group>
              
              {items.length === 0 && (
                <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-tertiary)' }}>No categories yet.</div>
              )}
            </div>

            {isAdding ? (
              <form onSubmit={handleAdd} style={{ display: 'flex', gap: '10px', background: 'var(--bg-secondary)', padding: '15px', borderRadius: '16px' }}>
                <input 
                  type="text" value={newCat.icon} onChange={e => setNewCat({...newCat, icon: e.target.value})}
                  style={{ width: '50px', padding: '12px', borderRadius: '12px', border: '1px solid var(--border-subtle)', background: 'var(--bg-primary)', textAlign: 'center', fontSize: '1.2rem', outline: 'none' }}
                  placeholder="Icon" required
                />
                <input 
                  type="text" value={newCat.name} onChange={e => setNewCat({...newCat, name: e.target.value})}
                  style={{ flex: 1, padding: '12px', borderRadius: '12px', border: '1px solid var(--border-subtle)', background: 'var(--bg-primary)', color: 'var(--text-primary)', outline: 'none', fontSize: '1rem' }}
                  placeholder="Category Name" required autoFocus
                />
                <button type="submit" className="btn-primary" style={{ padding: '0 20px', borderRadius: '12px', fontWeight: 600 }}>Save</button>
                <button type="button" onClick={() => setIsAdding(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '0 10px' }}>Cancel</button>
              </form>
            ) : (
              <button 
                onClick={() => setIsAdding(true)}
                style={{ width: '100%', padding: '16px', background: 'var(--bg-secondary)', border: '2px dashed var(--border-subtle)', borderRadius: '16px', color: 'var(--text-primary)', fontSize: '1.1rem', fontWeight: 600, cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}
              >
                <IoAdd size={24} /> Add New Category
              </button>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default CategoryManagerModal;
