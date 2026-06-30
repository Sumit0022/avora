import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { IoChevronBack, IoWalletOutline, IoCalendarOutline, IoCashOutline, IoPieChartOutline } from 'react-icons/io5';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase';
import { ref, get, update, push, onValue } from 'firebase/database';
import { motion } from 'framer-motion';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

function LoanDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  
  const [loan, setLoan] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [accounts, setAccounts] = useState([]);
  const [accountId, setAccountId] = useState('');
  
  const [repaymentAmount, setRepaymentAmount] = useState('');
  const [isPaying, setIsPaying] = useState(false);
  const [pendingSettlements, setPendingSettlements] = useState([]);
  const [processingId, setProcessingId] = useState(null);

  const [showEmiModal, setShowEmiModal] = useState(false);
  const [showEarlyClosureModal, setShowEarlyClosureModal] = useState(false);
  const [closurePenalty, setClosurePenalty] = useState('');

  useEffect(() => {
    if (!currentUser) return;

    const loanRef = ref(db, `loans/${currentUser.uid}/${id}`);
    const unsub = onValue(loanRef, (snapshot) => {
      if (snapshot.exists()) {
        setLoan(snapshot.val());
        if (!repaymentAmount) setRepaymentAmount(snapshot.val().emiAmount || '');
      } else {
        toast.error("Loan not found");
        navigate('/loans');
      }
      setLoading(false);
    });

    const accountsRef = ref(db, `accounts/${currentUser.uid}`);
    const unsubAccounts = onValue(accountsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const accList = Object.keys(data).map(k => ({ id: k, ...data[k] }));
        setAccounts(accList);
        if (accList.length > 0 && !accountId) setAccountId(accList[0].id);
      }
    });

    const settlementsRef = ref(db, `loanSettlements/${currentUser.uid}`);
    const unsubSettlements = onValue(settlementsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setPendingSettlements(
          Object.keys(data)
            .map(k => ({ ...data[k] }))
            .filter(s => s.loanId === id && s.status === 'pending')
        );
      } else {
        setPendingSettlements([]);
      }
    });

    return () => { unsub(); unsubAccounts(); unsubSettlements(); };
  }, [currentUser, id, navigate]);

  const handleRepayment = async (e) => {
    e.preventDefault();
    if (!accountId) return toast.error("Select an account to pay from/to.");
    
    setIsPaying(true);
    try {
      // EMI Amount comes directly from loan.emiAmount for standard EMIs
      const amount = Number(loan.emiAmount);
      
      let interestComponent = 0;
      let principalComponent = amount;

      if (loan.interestType === 'reducing' && loan.interestRate > 0) {
        const r_monthly = (loan.interestRate / 100) / 12;
        interestComponent = loan.outstandingPrincipal * r_monthly;
        principalComponent = amount - interestComponent;
      } else if (loan.interestType === 'flat' && loan.interestRate > 0) {
        const r_annual = loan.interestRate / 100;
        const totalInterest = loan.principalAmount * r_annual * (loan.durationMonths / 12);
        interestComponent = totalInterest / loan.durationMonths;
        principalComponent = amount - interestComponent;
      }

      // Safeguard against last EMI overpaying principal
      if (principalComponent > loan.outstandingPrincipal) {
        principalComponent = loan.outstandingPrincipal;
      }

      const newOutstanding = loan.outstandingPrincipal - principalComponent;
      const txId = push(ref(db, `transactions/${currentUser.uid}`)).key;
      const updates = {};

      if (loan.linkedUserId) {
        const settlementId = push(ref(db, `loanSettlements/${loan.linkedUserId}`)).key;
        updates[`loanSettlements/${loan.linkedUserId}/${settlementId}`] = {
          id: settlementId,
          senderId: currentUser.uid,
          loanId: loan.linkedLoanId,
          senderLoanId: id,
          amount,
          principalComponent,
          interestComponent,
          accountId,
          status: 'pending',
          createdAt: new Date().toISOString()
        };

        const accSnapshot = await get(ref(db, `accounts/${currentUser.uid}/${accountId}`));
        if (accSnapshot.exists()) {
          const acc = accSnapshot.val();
          if (loan.type === 'given') {
            updates[`accounts/${currentUser.uid}/${accountId}/balance`] = acc.type === 'Credit Card' ? Number(acc.balance) - amount : Number(acc.balance) + amount;
          } else {
            updates[`accounts/${currentUser.uid}/${accountId}/balance`] = acc.type === 'Credit Card' ? Number(acc.balance) + amount : Number(acc.balance) - amount;
          }
          updates[`transactions/${currentUser.uid}/${txId}`] = {
            id: txId, type: loan.type === 'given' ? 'income' : 'expense', amount, accountId, categoryId: 'loan_repayment', note: `Sent EMI to ${loan.personName} (Pending)`, date: new Date().toISOString().split('T')[0], time: new Date().toTimeString().slice(0, 5), isLoanTransaction: true, loanId: id, createdAt: new Date().toISOString()
          };
        }

        await update(ref(db), updates);
        toast.success("EMI payment sent for approval!");
        setIsPaying(false);
        setShowEmiModal(false);
        return;
      }

      // Offline Loan direct execution
      const repaymentId = push(ref(db, `loans/${currentUser.uid}/${id}/repayments`)).key;
      updates[`loans/${currentUser.uid}/${id}/outstandingPrincipal`] = Math.max(0, newOutstanding);
      if (newOutstanding <= 0.01) {
        updates[`loans/${currentUser.uid}/${id}/status`] = 'closed';
      }

      updates[`loans/${currentUser.uid}/${id}/repayments/${repaymentId}`] = {
        amount, principalComponent, interestComponent, date: new Date().toISOString(), accountId
      };

      const accSnapshot = await get(ref(db, `accounts/${currentUser.uid}/${accountId}`));
      if (accSnapshot.exists()) {
        const acc = accSnapshot.val();
        if (loan.type === 'given') {
          updates[`accounts/${currentUser.uid}/${accountId}/balance`] = acc.type === 'Credit Card' ? Number(acc.balance) - amount : Number(acc.balance) + amount;
        } else {
          updates[`accounts/${currentUser.uid}/${accountId}/balance`] = acc.type === 'Credit Card' ? Number(acc.balance) + amount : Number(acc.balance) - amount;
        }

        updates[`transactions/${currentUser.uid}/${txId}`] = {
          id: txId, type: loan.type === 'given' ? 'income' : 'expense', amount, accountId, categoryId: 'loan_repayment', note: `EMI Repayment: ${loan.personName}`, date: new Date().toISOString().split('T')[0], time: new Date().toTimeString().slice(0, 5), isLoanTransaction: true, loanId: id, createdAt: new Date().toISOString()
        };
      }

      await update(ref(db), updates);
      toast.success('Repayment recorded successfully!');
      setShowEmiModal(false);
    } catch (err) {
      console.error(err);
      toast.error('Failed to log repayment.');
    }
    setIsPaying(false);
  };

  const handleEarlyClosure = async (e) => {
    e.preventDefault();
    if (!accountId) return toast.error("Select an account.");
    
    setIsPaying(true);
    try {
      const penalty = Number(closurePenalty) || 0;
      const principalToPay = loan.outstandingPrincipal;
      const totalAmount = principalToPay + penalty;

      const txId = push(ref(db, `transactions/${currentUser.uid}`)).key;
      const repaymentId = push(ref(db, `loans/${currentUser.uid}/${id}/repayments`)).key;
      const updates = {};

      // Close Loan
      updates[`loans/${currentUser.uid}/${id}/outstandingPrincipal`] = 0;
      updates[`loans/${currentUser.uid}/${id}/status`] = 'closed';

      updates[`loans/${currentUser.uid}/${id}/repayments/${repaymentId}`] = {
        amount: totalAmount,
        principalComponent: principalToPay,
        interestComponent: penalty, // Treat penalty as interest
        date: new Date().toISOString(),
        accountId,
        note: 'Early Closure'
      };

      // Wallet / CC limit logic
      const accSnapshot = await get(ref(db, `accounts/${currentUser.uid}/${accountId}`));
      if (accSnapshot.exists()) {
        const acc = accSnapshot.val();
        if (loan.type === 'given') {
          updates[`accounts/${currentUser.uid}/${accountId}/balance`] = acc.type === 'Credit Card' ? Number(acc.balance) - totalAmount : Number(acc.balance) + totalAmount;
        } else {
          updates[`accounts/${currentUser.uid}/${accountId}/balance`] = acc.type === 'Credit Card' ? Number(acc.balance) + totalAmount : Number(acc.balance) - totalAmount;
        }

        updates[`transactions/${currentUser.uid}/${txId}`] = {
          id: txId, type: loan.type === 'given' ? 'income' : 'expense', amount: totalAmount, accountId, categoryId: 'loan_repayment', note: `Early Closure: ${loan.personName}`, date: new Date().toISOString().split('T')[0], time: new Date().toTimeString().slice(0, 5), isLoanTransaction: true, loanId: id, createdAt: new Date().toISOString()
        };
      }

      // If it's a Linked Loan, we technically should send a request to receiver, but for simplicity we will just execute local closure and let them know. 
      // Ideally, early closure on linked loans requires mutual agreement, but we will forcefully close for now if it's CC.
      // Wait, if it's CC, it's not a P2P linked loan. CC loans are offline.

      await update(ref(db), updates);
      toast.success('Loan closed successfully!');
      setShowEarlyClosureModal(false);
    } catch (err) {
      console.error(err);
      toast.error('Failed to close loan.');
    }
    setIsPaying(false);
  };

  const handleApproveSettlement = async (settlement) => {
    if (!accountId) return toast.error("Select an account to receive this EMI.");
    setProcessingId(settlement.id);
    try {
      const updates = {};
      const { senderId, senderLoanId, amount, principalComponent, interestComponent } = settlement;
      const newOutstanding = Math.max(0, loan.outstandingPrincipal - principalComponent);

      // 1. Update Receiver's (My) Loan
      updates[`loans/${currentUser.uid}/${id}/outstandingPrincipal`] = newOutstanding;
      if (newOutstanding <= 0.01) updates[`loans/${currentUser.uid}/${id}/status`] = 'closed';
      
      const myRepaymentId = push(ref(db, `loans/${currentUser.uid}/${id}/repayments`)).key;
      updates[`loans/${currentUser.uid}/${id}/repayments/${myRepaymentId}`] = { amount, principalComponent, interestComponent, date: new Date().toISOString(), accountId };

      // 2. Update Sender's (Their) Loan
      const senderLoanSnap = await get(ref(db, `loans/${senderId}/${senderLoanId}`));
      if (senderLoanSnap.exists()) {
        const senderLoan = senderLoanSnap.val();
        const theirNewOutstanding = Math.max(0, senderLoan.outstandingPrincipal - principalComponent);
        updates[`loans/${senderId}/${senderLoanId}/outstandingPrincipal`] = theirNewOutstanding;
        if (theirNewOutstanding <= 0.01) updates[`loans/${senderId}/${senderLoanId}/status`] = 'closed';
        
        const theirRepaymentId = push(ref(db, `loans/${senderId}/${senderLoanId}/repayments`)).key;
        updates[`loans/${senderId}/${senderLoanId}/repayments/${theirRepaymentId}`] = { amount, principalComponent, interestComponent, date: new Date().toISOString(), accountId: settlement.accountId };
      }

      // 3. Update My Wallet
      const accSnap = await get(ref(db, `accounts/${currentUser.uid}/${accountId}`));
      if (accSnap.exists()) {
        const acc = accSnap.val();
        if (loan.type === 'given') {
          updates[`accounts/${currentUser.uid}/${accountId}/balance`] = acc.type === 'Credit Card' ? Number(acc.balance) - amount : Number(acc.balance) + amount;
        } else {
          updates[`accounts/${currentUser.uid}/${accountId}/balance`] = acc.type === 'Credit Card' ? Number(acc.balance) + amount : Number(acc.balance) - amount;
        }
        const txId = push(ref(db, `transactions/${currentUser.uid}`)).key;
        updates[`transactions/${currentUser.uid}/${txId}`] = {
          id: txId, type: loan.type === 'given' ? 'income' : 'expense', amount, accountId, categoryId: 'loan_repayment', note: `Received EMI from ${loan.personName}`, date: new Date().toISOString().split('T')[0], time: new Date().toTimeString().slice(0, 5), isLoanTransaction: true, loanId: id, createdAt: new Date().toISOString()
        };
      }

      // Remove Settlement
      updates[`loanSettlements/${currentUser.uid}/${settlement.id}`] = null;
      await update(ref(db), updates);
      toast.success("EMI Approved!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to approve EMI");
    }
    setProcessingId(null);
  };

  const handleRejectSettlement = async (settlement) => {
    setProcessingId(settlement.id);
    try {
      const updates = {};
      const { senderId, amount, accountId: senderAccountId } = settlement;
      
      // Refund Sender
      const senderAccSnap = await get(ref(db, `accounts/${senderId}/${senderAccountId}`));
      if (senderAccSnap.exists()) {
        const acc = senderAccSnap.val();
        // Since they were paying us, they were deducting. To refund, we add back.
        // Wait, if loan was 'taken' by us, they were 'giving' us money. 
        // If loan was 'given' by us, they (borrower) were paying us back.
        // In handleRepayment, if loan is 'given' by sender, they receive money? No, if sender is paying EMI, they are the borrower.
        // Regardless, we reverse what they did in handleRepayment.
        // Sender paid amount, so they deducted their wallet. Refund = Add amount back.
        // Wait, Credit Card logic: if they used CC, balance was increased (debt went up). So we decrease.
        updates[`accounts/${senderId}/${senderAccountId}/balance`] = acc.type === 'Credit Card' ? Number(acc.balance) - amount : Number(acc.balance) + amount;
        
        const txId = push(ref(db, `transactions/${senderId}`)).key;
        updates[`transactions/${senderId}/${txId}`] = {
          id: txId, type: 'income', amount, accountId: senderAccountId, categoryId: 'refund', note: `Refund: EMI rejected by ${currentUser.displayName || 'User'}`, date: new Date().toISOString().split('T')[0], time: new Date().toTimeString().slice(0, 5), createdAt: new Date().toISOString()
        };
      }

      updates[`loanSettlements/${currentUser.uid}/${settlement.id}`] = null;
      await update(ref(db), updates);
      toast.success("EMI Rejected & Refunded to user.");
    } catch (err) {
      console.error(err);
      toast.error("Failed to reject EMI");
    }
    setProcessingId(null);
  };

  const generateNOC = async () => {
    if (!loan) return;
    try {
      const doc = new jsPDF();
      
      // Load Logo
      const img = new Image();
      img.src = '/logo.png';
      await new Promise((resolve) => {
        img.onload = resolve;
        img.onerror = resolve; // Continue even if logo fails
      });

      // Colors
      const brandBlue = [0, 113, 227];
      const textDark = [30, 30, 30];
      const textGrey = [100, 100, 100];
      const borderGrey = [220, 220, 220];

      // 1. Top Accent Line
      doc.setFillColor(...brandBlue);
      doc.rect(0, 0, 210, 6, 'F');

      // 2. Header (Logo & Brand)
      if (img.width > 0) {
        doc.addImage(img, 'PNG', 14, 14, 18, 18);
      } else {
        // Fallback shape if logo fails
        doc.setFillColor(...brandBlue);
        doc.circle(23, 23, 9, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(12);
        doc.text("A", 23, 27, { align: 'center' });
      }

      doc.setTextColor(...brandBlue);
      doc.setFontSize(24);
      doc.setFont("helvetica", "bold");
      doc.text("AVORA", 36, 26);
      
      doc.setTextColor(...textGrey);
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text("Financial Settlement Services", 36, 31);

      // Issue Date (Right aligned)
      doc.setFontSize(10);
      doc.setTextColor(...textDark);
      doc.text(`Issue Date: ${new Date().toLocaleDateString('en-GB')}`, 196, 26, { align: 'right' });
      doc.setTextColor(...textGrey);
      doc.text(`Ref: ${id.substring(0, 8).toUpperCase()}`, 196, 31, { align: 'right' });

      // Divider
      doc.setDrawColor(...borderGrey);
      doc.line(14, 40, 196, 40);

      // 3. Document Title
      doc.setTextColor(...textDark);
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text("NO OBJECTION CERTIFICATE", 105, 52, { align: 'center' });
      
      doc.setFontSize(10);
      doc.setTextColor(...textGrey);
      doc.setFont("helvetica", "normal");
      doc.text("OFFICIAL RECORD OF LOAN CLOSURE", 105, 58, { align: 'center' });

      // 4. Party Details Box (Lender & Borrower)
      const lenderName = loan.type === 'given' ? (currentUser.displayName || 'User') : loan.personName;
      const borrowerName = loan.type === 'given' ? loan.personName : (currentUser.displayName || 'User');

      doc.setFillColor(248, 249, 250);
      doc.setDrawColor(...borderGrey);
      doc.roundedRect(14, 68, 182, 28, 3, 3, 'FD');
      
      // Vertical separator in the box
      doc.line(105, 68, 105, 96);

      // Lender details
      doc.setFontSize(9);
      doc.setTextColor(...textGrey);
      doc.text("LENDER", 18, 76);
      doc.setFontSize(12);
      doc.setTextColor(...textDark);
      doc.setFont("helvetica", "bold");
      doc.text(lenderName, 18, 84);

      // Borrower details
      doc.setFontSize(9);
      doc.setTextColor(...textGrey);
      doc.setFont("helvetica", "normal");
      doc.text("BORROWER", 109, 76);
      doc.setFontSize(12);
      doc.setTextColor(...textDark);
      doc.setFont("helvetica", "bold");
      doc.text(borrowerName, 109, 84);

      // 5. Loan Particulars
      doc.setFontSize(11);
      doc.setTextColor(...textDark);
      doc.text("Loan Particulars", 14, 106);
      doc.setDrawColor(...brandBlue);
      doc.line(14, 108, 42, 108); // Accent underline

      doc.setDrawColor(...borderGrey);
      doc.roundedRect(14, 114, 182, 22, 2, 2, 'S');
      
      // Row 1
      doc.setFontSize(9);
      doc.setTextColor(...textGrey);
      doc.setFont("helvetica", "normal");
      doc.text("Principal Amount:", 18, 122);
      doc.text("Interest Rate:", 80, 122);
      doc.text("Duration:", 145, 122);

      doc.setTextColor(...textDark);
      doc.setFont("helvetica", "bold");
      doc.text(`Rs. ${loan.principalAmount.toLocaleString('en-IN')}`, 45, 122);
      doc.text(`${loan.interestRate}% (${loan.interestType})`, 102, 122);
      doc.text(`${loan.durationMonths} Months`, 160, 122);

      // Row 2
      doc.setTextColor(...textGrey);
      doc.setFont("helvetica", "normal");
      doc.text("Loan Category:", 18, 130);
      doc.text("Settlement Status:", 80, 130);
      
      doc.setTextColor(...textDark);
      doc.setFont("helvetica", "bold");
      doc.text(`${loan.category}`, 42, 130);
      doc.setTextColor(30, 130, 76); // Green
      doc.text("CLEARED", 108, 130);

      // 6. Declaration
      doc.setTextColor(...textDark);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      const statement = `This document certifies that the loan facility extended by ${lenderName} to ${borrowerName} for the principal amount of Rs. ${loan.principalAmount.toLocaleString('en-IN')} has been fully repaid. As of ${new Date().toLocaleDateString('en-GB')}, there are no outstanding dues, principal, or interest remaining against this specific loan account on the Avora platform.`;
      const splitStatement = doc.splitTextToSize(statement, 182);
      doc.text(splitStatement, 14, 145);
      
      // 7. Transaction History
      doc.setFontSize(11);
      doc.setTextColor(...textDark);
      doc.setFont("helvetica", "bold");
      doc.text("Repayment History", 14, 168);
      doc.setDrawColor(...brandBlue);
      doc.line(14, 170, 48, 170); // Accent underline

      const tableData = [];
      if (loan.repayments) {
        const reps = Object.keys(loan.repayments).map(k => loan.repayments[k]).sort((a,b) => new Date(a.date) - new Date(b.date));
        reps.forEach((r, idx) => {
          tableData.push([
            idx + 1,
            new Date(r.date).toLocaleDateString('en-GB'),
            `Rs. ${Number(r.principalComponent).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`,
            `Rs. ${Number(r.interestComponent).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`,
            `Rs. ${Number(r.amount).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
          ]);
        });
      }

      autoTable(doc, {
        startY: 175,
        head: [['#', 'Date', 'Principal Paid', 'Interest Paid', 'Total EMI']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [245, 245, 245], textColor: [40, 40, 40], fontStyle: 'bold', lineColor: [220, 220, 220] },
        styles: { fontSize: 8.5, cellPadding: 5, textColor: [60, 60, 60], lineColor: [220, 220, 220] },
        margin: { left: 14, right: 14 }
      });

      // 8. Footer (System Generated Stamp)
      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        
        // Add stamp only on last page
        if (i === pageCount) {
          const finalY = doc.lastAutoTable.finalY + 25;
          if (finalY < doc.internal.pageSize.height - 40) {
            // Authorized stamp box
            doc.setDrawColor(30, 130, 76);
            doc.setLineWidth(0.5);
            doc.roundedRect(140, finalY - 10, 56, 18, 2, 2);
            doc.setTextColor(30, 130, 76);
            doc.setFontSize(10);
            doc.setFont("helvetica", "bold");
            doc.text("AVORA VERIFIED", 168, finalY, { align: 'center' });
            doc.setFontSize(7);
            doc.setFont("helvetica", "normal");
            doc.text("SYSTEM GENERATED NOC", 168, finalY + 5, { align: 'center' });
          }
        }

        // Global Page Footer
        doc.setFontSize(8);
        doc.setTextColor(...textGrey);
        const footerY = doc.internal.pageSize.height - 15;
        doc.setDrawColor(...borderGrey);
        doc.setLineWidth(0.2);
        doc.line(14, footerY - 5, 196, footerY - 5);
        
        doc.text("This is a system-generated document and does not require a physical signature.", 14, footerY);
        doc.text(`Page ${i} of ${pageCount}`, 196, footerY, { align: 'right' });
      }

      doc.save(`Avora_NOC_${loan.personName}.pdf`);
    } catch (error) {
      console.error("PDF Generation Error:", error);
      toast.error("Failed to generate PDF. Check console.");
    }
  };

  if (loading || !loan) return <div style={{ padding: '20px', textAlign: 'center' }}>Loading Loan Details...</div>;

  const totalPaidPrincipal = loan.principalAmount - loan.outstandingPrincipal;
  const progressPercent = Math.min(100, Math.max(0, (totalPaidPrincipal / loan.principalAmount) * 100));

  const repaymentsList = loan.repayments ? Object.keys(loan.repayments).map(k => ({ id: k, ...loan.repayments[k] })).sort((a,b) => new Date(b.date) - new Date(a.date)) : [];

  let nextMonthName = "";
  if (repaymentsList.length > 0) {
    const lastDate = new Date(repaymentsList[0].date);
    lastDate.setMonth(lastDate.getMonth() + 1);
    nextMonthName = lastDate.toLocaleString('default', { month: 'long', year: 'numeric' });
  } else {
    const startD = new Date(loan.startDate);
    startD.setMonth(startD.getMonth() + 1);
    nextMonthName = startD.toLocaleString('default', { month: 'long', year: 'numeric' });
  }

  return (
    <div className="container" style={{ paddingBottom: '100px', paddingTop: '20px' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '30px' }}>
        <button onClick={() => navigate('/loans')} style={{ width: '45px', height: '45px', borderRadius: '50%', background: 'var(--bg-secondary)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-primary)' }}>
          <IoChevronBack size={22} />
        </button>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700 }}>{loan.personName}</h2>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{loan.category} • {loan.type === 'given' ? 'Lent' : 'Borrowed'}</p>
        </div>
      </header>

      {/* Progress Card */}
      <div style={{ background: 'var(--brand-gradient)', padding: '25px', borderRadius: '24px', color: 'white', marginBottom: '25px', boxShadow: '0 10px 30px rgba(0,113,227,0.3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '20px' }}>
          <div>
            <p style={{ margin: 0, fontSize: '0.9rem', opacity: 0.9 }}>Outstanding Principal</p>
            <h1 style={{ margin: '5px 0 0', fontSize: '2.5rem', fontWeight: 800 }}>₹{loan.outstandingPrincipal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</h1>
          </div>
          {loan.status === 'closed' && (
            <div style={{ background: 'rgba(255,255,255,0.2)', padding: '5px 12px', borderRadius: '12px', fontWeight: 700 }}>SETTLED</div>
          )}
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '8px', opacity: 0.9 }}>
            <span>₹{totalPaidPrincipal.toLocaleString('en-IN', { maximumFractionDigits: 0 })} Repaid</span>
            <span>₹{loan.principalAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })} Total</span>
          </div>
          <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.2)', borderRadius: '4px', overflow: 'hidden' }}>
            <motion.div initial={{ width: 0 }} animate={{ width: `${progressPercent}%` }} style={{ height: '100%', background: 'white', borderRadius: '4px' }} />
          </div>
        </div>
        
        {loan.status === 'closed' && (
          <button onClick={generateNOC} style={{ marginTop: '20px', width: '100%', padding: '12px', borderRadius: '12px', background: 'white', color: 'var(--brand-primary)', border: 'none', fontWeight: 700, fontSize: '1rem', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
            Download NOC Certificate
          </button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '30px' }}>
        <div style={{ background: 'var(--bg-secondary)', padding: '15px', borderRadius: '16px' }}>
          <IoPieChartOutline size={20} color="var(--brand-primary)" style={{ marginBottom: '10px' }} />
          <h4 style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Interest Rate</h4>
          <p style={{ margin: '2px 0 0', fontSize: '1.1rem', fontWeight: 700 }}>{loan.interestRate}% {loan.interestType}</p>
        </div>
        <div style={{ background: 'var(--bg-secondary)', padding: '15px', borderRadius: '16px' }}>
          <IoCalendarOutline size={20} color="var(--brand-primary)" style={{ marginBottom: '10px' }} />
          <h4 style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Duration</h4>
          <p style={{ margin: '2px 0 0', fontSize: '1.1rem', fontWeight: 700 }}>{loan.durationMonths} Months</p>
        </div>
      </div>

      {pendingSettlements.length > 0 && (
        <div style={{ marginBottom: '30px' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '15px', color: '#FF9500' }}>Pending EMI Approvals ({pendingSettlements.length})</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {pendingSettlements.map(settlement => (
              <div key={settlement.id} style={{ background: 'rgba(255, 149, 0, 0.05)', border: '1px solid rgba(255, 149, 0, 0.3)', padding: '20px', borderRadius: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>{loan.personName}</h4>
                    <p style={{ margin: '2px 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Paid an EMI</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: 'var(--brand-primary)' }}>₹{settlement.amount.toLocaleString('en-IN')}</p>
                    <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>{new Date(settlement.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>

                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '5px' }}>Receive to account</label>
                  <select value={accountId} onChange={e => setAccountId(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '12px', border: '1px solid var(--border-subtle)', background: 'var(--bg-primary)', color: 'var(--text-primary)', outline: 'none' }}>
                    <option value="" disabled>Select account...</option>
                    {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name} (₹{acc.type === 'Credit Card' ? Number(acc.creditLimit||0)-Number(acc.balance||0) : acc.balance})</option>)}
                  </select>
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={() => handleApproveSettlement(settlement)} disabled={processingId === settlement.id} style={{ flex: 1, padding: '12px', borderRadius: '12px', background: 'var(--brand-primary)', color: 'white', border: 'none', fontWeight: 600, cursor: 'pointer', opacity: processingId === settlement.id ? 0.5 : 1 }}>
                    Approve
                  </button>
                  <button onClick={() => handleRejectSettlement(settlement)} disabled={processingId === settlement.id} style={{ padding: '12px 20px', borderRadius: '12px', background: 'rgba(255, 59, 48, 0.1)', color: 'var(--danger)', border: 'none', fontWeight: 600, cursor: 'pointer', opacity: processingId === settlement.id ? 0.5 : 1 }}>
                    Reject (Refund)
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {loan.status === 'active' && (
        <div style={{ background: 'var(--bg-secondary)', padding: '20px', borderRadius: '24px', marginBottom: '30px' }}>
          
          {loan.category === 'Credit Card' ? (
            <div style={{ textAlign: 'center' }}>
              <h3 style={{ margin: '0 0 10px', fontSize: '1.1rem', fontWeight: 700, color: 'var(--brand-primary)' }}>Credit Card EMI</h3>
              <p style={{ margin: '0 0 20px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                Your EMIs are automatically added to your monthly Credit Card Bill. Please clear your dues directly from the Credit Card Bill section.
              </p>
              <button onClick={() => setShowEarlyClosureModal(true)} style={{ background: 'var(--bg-primary)', color: 'var(--brand-primary)', border: '1px solid var(--brand-primary)', padding: '12px 20px', borderRadius: '12px', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer', width: '100%' }}>
                Request Early Closure
              </button>
            </div>
          ) : (
            <div>
              <h3 style={{ margin: '0 0 15px', fontSize: '1.1rem', fontWeight: 700 }}>Log Repayment</h3>
              <button 
                onClick={() => setShowEmiModal(true)}
                style={{ width: '100%', padding: '16px', borderRadius: '16px', background: loan.type === 'given' ? 'var(--success)' : 'var(--danger)', color: 'white', border: 'none', fontWeight: 800, fontSize: '1.1rem', cursor: 'pointer', boxShadow: '0 8px 20px rgba(0,0,0,0.1)' }}
              >
                Pay {nextMonthName} EMI (₹{loan.emiAmount.toLocaleString('en-IN')})
              </button>
            </div>
          )}
        </div>
      )}

      <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '15px' }}>Repayment History</h3>
      {repaymentsList.length === 0 ? (
        <p style={{ color: 'var(--text-tertiary)', textAlign: 'center', padding: '20px' }}>No repayments logged yet.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {repaymentsList.map((rep) => (
            <div key={rep.id} style={{ background: 'var(--bg-secondary)', padding: '15px', borderRadius: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ margin: 0, fontWeight: 700, fontSize: '1rem' }}>₹{rep.amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p>
                <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{new Date(rep.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--success)' }}>-₹{rep.principalComponent.toLocaleString('en-IN', { maximumFractionDigits: 0 })} Principal</p>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--danger)' }}>-₹{rep.interestComponent.toLocaleString('en-IN', { maximumFractionDigits: 0 })} Interest</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* EMI Confirmation Modal */}
      {showEmiModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 3000, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(5px)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ background: 'var(--bg-primary)', padding: '30px', borderRadius: '24px', width: '90%', maxWidth: '400px' }}>
            <h3 style={{ margin: '0 0 20px', fontSize: '1.3rem', fontWeight: 800 }}>Confirm EMI Payment</h3>
            <div style={{ background: 'var(--bg-secondary)', padding: '20px', borderRadius: '16px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Total EMI:</span>
                <span style={{ fontWeight: 800, fontSize: '1.1rem' }}>₹{loan.emiAmount.toLocaleString('en-IN')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Towards Principal:</span>
                <span style={{ color: 'var(--success)', fontWeight: 600 }}>Calculated automatically</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Towards Interest:</span>
                <span style={{ color: 'var(--danger)', fontWeight: 600 }}>Calculated automatically</span>
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>Pay using Account</label>
              <select value={accountId} onChange={e => setAccountId(e.target.value)} required style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', outline: 'none' }}>
                <option value="" disabled>Select wallet account...</option>
                {accounts.map(acc => (
                  <option key={acc.id} value={acc.id}>{acc.name}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setShowEmiModal(false)} style={{ flex: 1, padding: '14px', borderRadius: '12px', background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: 'none', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleRepayment} disabled={isPaying} style={{ flex: 1, padding: '14px', borderRadius: '12px', background: 'var(--brand-primary)', color: 'white', border: 'none', fontWeight: 700, cursor: 'pointer' }}>
                {isPaying ? 'Processing...' : 'Confirm Pay'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Early Closure Modal */}
      {showEarlyClosureModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 3000, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(5px)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ background: 'var(--bg-primary)', padding: '30px', borderRadius: '24px', width: '90%', maxWidth: '400px' }}>
            <h3 style={{ margin: '0 0 20px', fontSize: '1.3rem', fontWeight: 800 }}>Early Closure</h3>
            
            <div style={{ background: 'var(--bg-secondary)', padding: '20px', borderRadius: '16px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Remaining Principal:</span>
                <span style={{ fontWeight: 800, fontSize: '1.1rem' }}>₹{loan.outstandingPrincipal.toLocaleString('en-IN')}</span>
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>Pre-closure Penalty / Extra Fees (if any)</label>
              <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border-subtle)', padding: '0 15px' }}>
                <span style={{ fontWeight: 700, color: 'var(--text-secondary)' }}>₹</span>
                <input type="number" value={closurePenalty} onChange={e => setClosurePenalty(e.target.value)} placeholder="0.00" style={{ width: '100%', padding: '14px 10px', border: 'none', background: 'transparent', color: 'var(--text-primary)', outline: 'none', fontWeight: 600 }} />
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>Pay using Account</label>
              <select value={accountId} onChange={e => setAccountId(e.target.value)} required style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', outline: 'none' }}>
                <option value="" disabled>Select wallet account...</option>
                {accounts.map(acc => (
                  <option key={acc.id} value={acc.id}>{acc.name}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setShowEarlyClosureModal(false)} style={{ flex: 1, padding: '14px', borderRadius: '12px', background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: 'none', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleEarlyClosure} disabled={isPaying} style={{ flex: 1, padding: '14px', borderRadius: '12px', background: 'var(--brand-primary)', color: 'white', border: 'none', fontWeight: 700, cursor: 'pointer' }}>
                {isPaying ? 'Processing...' : `Pay ₹${(loan.outstandingPrincipal + (Number(closurePenalty) || 0)).toLocaleString('en-IN')}`}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default LoanDetails;
