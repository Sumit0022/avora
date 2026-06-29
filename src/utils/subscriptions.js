import { db } from '../firebase';
import { ref, get, update, push } from 'firebase/database';

export const processRecurringSubscriptions = async (userId) => {
  if (!userId) return;

  try {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    
    const subRef = ref(db, `subscriptions/${userId}`);
    const subSnapshot = await get(subRef);
    if (!subSnapshot.exists()) return;

    const subscriptions = subSnapshot.val();
    const updates = {};
    let hasUpdates = false;

    // Fetch accounts to update balances
    const accRef = ref(db, `accounts/${userId}`);
    const accSnapshot = await get(accRef);
    const accounts = accSnapshot.val() || {};

    for (const subId in subscriptions) {
      const sub = subscriptions[subId];
      
      if (sub.isActive && sub.nextDate <= today) {
        hasUpdates = true;
        let currentDateStr = sub.nextDate;
        
        // Loop in case it missed multiple cycles (e.g. user hasn't opened app in months)
        while (currentDateStr <= today) {
          const currentAmount = Number(sub.amount);
          
          // 1. Create Transaction for this exact date
          const txId = push(ref(db, `transactions/${userId}`)).key;
          updates[`transactions/${userId}/${txId}`] = {
            id: txId,
            type: 'expense',
            amount: currentAmount,
            accountId: sub.accountId,
            categoryId: sub.categoryId || null, // Optional, since we didn't force category
            note: `Auto-pay: ${sub.name}`,
            date: currentDateStr,
            time: '00:00',
            createdAt: new Date().toISOString(),
            isSubscription: true
          };

          // 2. Deduct from Account
          if (accounts[sub.accountId]) {
            accounts[sub.accountId].balance = Number(accounts[sub.accountId].balance) - currentAmount;
            updates[`accounts/${userId}/${sub.accountId}/balance`] = accounts[sub.accountId].balance;
          }

          // 3. Advance Date
          const nextDateObj = new Date(currentDateStr);
          if (sub.cycle === 'yearly') {
            nextDateObj.setFullYear(nextDateObj.getFullYear() + 1);
          } else {
            nextDateObj.setMonth(nextDateObj.getMonth() + 1);
          }
          currentDateStr = nextDateObj.toISOString().split('T')[0];
        }

        // 4. Update Subscription's nextDate
        updates[`subscriptions/${userId}/${subId}/nextDate`] = currentDateStr;
      }
    }

    if (hasUpdates) {
      await update(ref(db), updates);
      console.log("Processed lazy evaluation for subscriptions.");
    }

  } catch (error) {
    console.error("Error processing subscriptions:", error);
  }
};
