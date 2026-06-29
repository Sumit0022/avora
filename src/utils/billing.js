/**
 * Smart Billing Logic for Credit Cards
 * Calculates bill dynamically without needing a backend table.
 */

export function calculateCreditCardBill(account, transactions) {
  if (account.type !== 'Credit Card' || !account.billingDate) return null;

  const today = new Date();
  let billDate = new Date(today.getFullYear(), today.getMonth(), account.billingDate);
  
  // Handle edge cases like Feb 30th -> Feb 28th
  if (billDate.getDate() !== Number(account.billingDate)) {
    billDate = new Date(today.getFullYear(), today.getMonth() + 1, 0); // Last day of month
  }

  // If this month's billing date hasn't happened yet, the most recent bill is from last month
  if (today < billDate) {
    billDate = new Date(today.getFullYear(), today.getMonth() - 1, account.billingDate);
    if (billDate.getDate() !== Number(account.billingDate)) {
      billDate = new Date(today.getFullYear(), today.getMonth(), 0);
    }
  }

  // Bill is generated on `billDate`.
  // The billing period ended on `billDate - 1 day` at 23:59:59
  const periodEnd = new Date(billDate);
  periodEnd.setDate(periodEnd.getDate() - 1);
  periodEnd.setHours(23, 59, 59, 999);

  let billedAmount = 0;
  let paymentsSinceBill = 0;

  // Calculate Debt exactly at periodEnd, and payments made since periodEnd
  transactions.forEach(tx => {
    // Only care about transactions related to this CC
    if (tx.accountId !== account.id && tx.toAccountId !== account.id) return;

    // Use tx.createdAt for absolute sorting, or date+time. Let's use date+time to be consistent with UI
    const txDate = new Date(`${tx.date}T${tx.time || '00:00'}:00`);

    if (txDate <= periodEnd) {
      // Impact on Debt BEFORE the bill generated
      if (tx.accountId === account.id && tx.type === 'expense') {
        billedAmount += Number(tx.amount);
      }
      if (tx.accountId === account.id && tx.type === 'income') {
        billedAmount -= Number(tx.amount);
      }
      if (tx.accountId === account.id && tx.type === 'transfer') {
        // Transfer FROM CC -> increases debt
        billedAmount += Number(tx.amount);
      }
      if (tx.toAccountId === account.id && tx.type === 'transfer') {
        // Transfer TO CC (payment) -> decreases debt
        billedAmount -= Number(tx.amount);
      }
    } else {
      // Transactions AFTER the bill generated (payments)
      if (tx.toAccountId === account.id && tx.type === 'transfer') {
        paymentsSinceBill += Number(tx.amount);
      }
      if (tx.accountId === account.id && tx.type === 'income') {
        paymentsSinceBill += Number(tx.amount);
      }
    }
  });

  // Floor at 0 in case of prepayments
  billedAmount = Math.max(0, billedAmount);
  const remainingBill = Math.max(0, billedAmount - paymentsSinceBill);

  const dueDate = new Date(billDate);
  dueDate.setDate(dueDate.getDate() + 18);
  
  // Strip time for overdue check
  const todayStr = today.toISOString().split('T')[0];
  const dueDateStr = dueDate.toISOString().split('T')[0];
  const isOverdue = remainingBill > 0 && todayStr > dueDateStr;

  // Also calculate the start of the billing period
  const periodStart = new Date(billDate);
  periodStart.setMonth(periodStart.getMonth() - 1);
  if (periodStart.getDate() !== Number(account.billingDate)) {
    periodStart.setDate(0); // Adjust for shorter months
  }

  return {
    accountId: account.id,
    accountName: account.name,
    billDate: billDate,
    dueDate: dueDate,
    periodStart: periodStart,
    periodEnd: periodEnd,
    billedAmount,
    remainingBill,
    isOverdue
  };
}
