const fs = require('fs');

const files = [
  "src/components/AddGroupExpenseModal.jsx",
  "src/components/AddTransactionModal.jsx",
  "src/pages/Accounts.jsx",
  "src/pages/CreditCardBill.jsx",
  "src/pages/Dashboard.jsx",
  "src/pages/GroupDetails.jsx",
  "src/pages/Groups.jsx",
  "src/pages/Savings.jsx",
  "src/pages/Subscriptions.jsx"
];

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  
  if (!content.includes("import toast")) {
    content = content.replace(/(import React.*?;\n)/, "$1import toast from 'react-hot-toast';\n");
  }
  
  // Success / Info notifications
  content = content.replace("alert('Payment Successful! 🎉');", "toast.success('Payment Successful! 🎉');");
  content = content.replace("alert(`Request sent to join ${groupName}. An admin must approve you.`);", "toast.success(`Request sent to join ${groupName}. An admin must approve you.`);");
  
  content = content.replace("alert(`🚨 URGENT: Your ${bill.accountName} bill of ₹${bill.remainingBill.toLocaleString()} is OVERDUE! Please settle it immediately to avoid penalties.`);", "toast(`🚨 URGENT: Your ${bill.accountName} bill of ₹${bill.remainingBill.toLocaleString()} is OVERDUE! Please settle it immediately to avoid penalties.`, { icon: '🚨', duration: 8000 });");
  
  content = content.replace("alert(`${receiverInfo?.name || 'Receiver'} hasn't set up a UPI ID yet. You can still mark it as paid manually.`);", "toast.error(`${receiverInfo?.name || 'Receiver'} hasn't set up a UPI ID yet. You can still mark it as paid manually.`);");
  
  // Replace all other alerts with toast.error
  content = content.replace(/alert\(/g, "toast.error(");
  
  fs.writeFileSync(file, content);
}
console.log('Replaced all alerts!');
