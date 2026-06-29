import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { db } from '../firebase';
import { ref, onValue, set, push, remove, update } from 'firebase/database';

const CategoryContext = createContext();

export function useCategories() {
  return useContext(CategoryContext);
}

const defaultCategories = {
  expense: [
    { id: 'exp_1', name: 'Food & Dining', icon: '🍔', type: 'expense', order: 0 },
    { id: 'exp_2', name: 'Transport', icon: '🚕', type: 'expense', order: 1 },
    { id: 'exp_3', name: 'Shopping', icon: '🛍️', type: 'expense', order: 2 },
    { id: 'exp_4', name: 'Bills & Utilities', icon: '⚡', type: 'expense', order: 3 },
  ],
  income: [
    { id: 'inc_1', name: 'Salary', icon: '💰', type: 'income', order: 0 },
    { id: 'inc_2', name: 'Freelance', icon: '💻', type: 'income', order: 1 },
    { id: 'inc_3', name: 'Investments', icon: '📈', type: 'income', order: 2 },
  ]
};

export function CategoryProvider({ children }) {
  const { currentUser } = useAuth();
  const [categories, setCategories] = useState({ expense: [], income: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) {
      setCategories({ expense: [], income: [] });
      setLoading(false);
      return;
    }

    const catRef = ref(db, `categories/${currentUser.uid}`);
    
    const unsubscribe = onValue(catRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        // Parse and sort by order
        const parsed = Object.keys(data).map(key => ({ id: key, ...data[key] }));
        const expense = parsed.filter(c => c.type === 'expense').sort((a, b) => (a.order || 0) - (b.order || 0));
        const income = parsed.filter(c => c.type === 'income').sort((a, b) => (a.order || 0) - (b.order || 0));
        
        // If they have data but it's missing a type completely, maybe they deleted all? We'll just set what they have.
        setCategories({ expense, income });
      } else {
        // Initialize defaults if totally empty
        initializeDefaultCategories(currentUser.uid);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser]);

  const initializeDefaultCategories = async (uid) => {
    try {
      const updates = {};
      defaultCategories.expense.forEach(c => {
        const newRef = push(ref(db, `categories/${uid}`));
        updates[newRef.key] = { ...c, id: newRef.key }; // store generated key
      });
      defaultCategories.income.forEach(c => {
        const newRef = push(ref(db, `categories/${uid}`));
        updates[newRef.key] = { ...c, id: newRef.key };
      });
      await update(ref(db, `categories/${uid}`), updates);
    } catch (error) {
      console.error("Error initializing categories", error);
    }
  };

  const addCategory = async (category) => {
    if (!currentUser) return;
    const catListRef = ref(db, `categories/${currentUser.uid}`);
    const newCatRef = push(catListRef);
    
    // Determine order (put at end)
    const typeList = categories[category.type];
    const maxOrder = typeList.length > 0 ? Math.max(...typeList.map(c => c.order || 0)) : -1;
    
    await set(newCatRef, {
      ...category,
      order: maxOrder + 1,
      createdAt: new Date().toISOString()
    });
  };

  const editCategory = async (id, updatedData) => {
    if (!currentUser) return;
    await update(ref(db, `categories/${currentUser.uid}/${id}`), updatedData);
  };

  const deleteCategory = async (id) => {
    if (!currentUser) return;
    await remove(ref(db, `categories/${currentUser.uid}/${id}`));
  };

  const reorderCategories = async (type, newOrderedArray) => {
    if (!currentUser) return;
    // Optimistic UI update could happen here if we passed it in, but we'll let Firebase handle it
    const updates = {};
    newOrderedArray.forEach((cat, index) => {
      updates[`${cat.id}/order`] = index;
    });
    
    await update(ref(db, `categories/${currentUser.uid}`), updates);
  };

  const value = {
    categories,
    loading,
    addCategory,
    editCategory,
    deleteCategory,
    reorderCategories
  };

  return (
    <CategoryContext.Provider value={value}>
      {children}
    </CategoryContext.Provider>
  );
}
