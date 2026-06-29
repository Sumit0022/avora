export const calculateSimplifiedDebts = (expenses, settlements, currentUserId) => {
  const balances = {};

  // Helper to init balance
  const init = (uid) => {
    if (!balances[uid]) balances[uid] = 0;
  };

  // 1. Process Expenses
  expenses.forEach(exp => {
    const payer = exp.paidBy;
    init(payer);
    
    let totalAbsorbedByPayer = exp.amount;

    // For every split owed by someone else, subtract from their balance, and decrease the amount the payer absorbed
    if (exp.splits) {
      Object.keys(exp.splits).forEach(uid => {
        if (uid === 'guest') return; // Guest share is absorbed by payer, doesn't affect graph
        
        init(uid);
        balances[uid] -= exp.splits[uid];
        totalAbsorbedByPayer -= exp.splits[uid];
      });
    }

    // Payer's balance increases by the amount they paid for OTHERS (which is total - their own split)
    // Actually, mathematically simpler: payer gets +TotalAmount, and then payer's split is subtracted like everyone else.
    // Let's rewrite this logic to be foolproof:
    // balances[payer] += exp.amount;
    // Object.keys(exp.splits).forEach(uid => {
    //   if (uid !== 'guest') balances[uid] -= exp.splits[uid];
    // });
  });

  // Let's redo step 1 mathematically robustly:
  const robustBalances = {};
  const addBalance = (uid, amount) => {
    if (uid === 'guest') return;
    if (!robustBalances[uid]) robustBalances[uid] = 0;
    robustBalances[uid] += amount;
  };

  expenses.forEach(exp => {
    // Payer gets credit for the full amount
    addBalance(exp.paidBy, exp.amount);
    
    // Everyone in the split gets debited their share
    if (exp.splits) {
      Object.keys(exp.splits).forEach(uid => {
        addBalance(uid, -exp.splits[uid]);
      });
    }
  });

  // 2. Process Settlements
  settlements.forEach(settle => {
    if (settle.status === 'approved') {
      // Payer of settlement gave money, so their balance goes UP
      addBalance(settle.paidBy, settle.amount);
      // Receiver of settlement got money, so their balance goes DOWN
      addBalance(settle.paidTo, -settle.amount);
    }
  });

  // 3. Separate into Debtors and Creditors
  let debtors = [];
  let creditors = [];

  Object.keys(robustBalances).forEach(uid => {
    // Round to avoid float issues
    const bal = Math.round(robustBalances[uid] * 100) / 100;
    if (bal < -0.01) {
      debtors.push({ uid, amount: -bal }); // positive amount they owe
    } else if (bal > 0.01) {
      creditors.push({ uid, amount: bal }); // positive amount owed to them
    }
  });

  // Sort descending by amount
  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  // 4. Greedy Settlement
  const simplifiedTransactions = [];
  let i = 0; // debtors index
  let j = 0; // creditors index

  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i];
    const creditor = creditors[j];

    const settledAmount = Math.min(debtor.amount, creditor.amount);

    simplifiedTransactions.push({
      from: debtor.uid,
      to: creditor.uid,
      amount: settledAmount
    });

    debtor.amount -= settledAmount;
    creditor.amount -= settledAmount;

    // Rounding to handle JS float precision
    debtor.amount = Math.round(debtor.amount * 100) / 100;
    creditor.amount = Math.round(creditor.amount * 100) / 100;

    if (debtor.amount === 0) i++;
    if (creditor.amount === 0) j++;
  }

  return simplifiedTransactions;
};
