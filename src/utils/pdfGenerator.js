import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export const generatePDFReport = (transactions, summary, dateRangeStr, profile, logoBase64) => {
  const doc = new jsPDF('p', 'pt', 'a4');

  // Modern corporate colors
  const primaryColor = [0, 113, 227]; // Apple blue
  const darkText = [29, 29, 31];
  const lightText = [134, 134, 139];
  const borderGray = [220, 220, 225];

  // Draw header line
  doc.setDrawColor(...primaryColor);
  doc.setLineWidth(4);
  doc.line(40, 40, 555, 40);

  // Logo (if available)
  if (logoBase64) {
    doc.addImage(logoBase64, 'PNG', 40, 55, 24, 24);
    doc.setTextColor(...darkText);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('AVORA', 75, 76);
  } else {
    doc.setTextColor(...primaryColor);
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text('AVORA', 40, 76);
  }

  // Header Text Right Side
  doc.setTextColor(...darkText);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('FINANCIAL REPORT', 555, 65, { align: 'right' });
  
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...lightText);
  doc.text(`Generated for: ${profile?.name || 'Avora User'}`, 555, 80, { align: 'right' });
  doc.text(`Date Range: ${dateRangeStr}`, 555, 95, { align: 'right' });

  // Draw subtle separator
  doc.setDrawColor(...borderGray);
  doc.setLineWidth(1);
  doc.line(40, 115, 555, 115);

  // --- SUMMARY CARDS ---
  doc.setTextColor(...darkText);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Account Summary', 40, 145);

  const drawCard = (x, y, title, amount, color) => {
    doc.setFillColor(250, 250, 252);
    doc.setDrawColor(...borderGray);
    doc.roundedRect(x, y, 160, 60, 4, 4, 'FD');
    
    doc.setFontSize(10);
    doc.setTextColor(...lightText);
    doc.setFont('helvetica', 'normal');
    doc.text(title, x + 15, y + 25);
    
    doc.setFontSize(14);
    doc.setTextColor(...color);
    doc.setFont('helvetica', 'bold');
    doc.text(amount, x + 15, y + 45);
  };

  // Row 1: Opening & Closing Balances
  drawCard(40, 160, 'Opening Balance', `Rs. ${summary.openingBalance.toLocaleString()}`, darkText);
  drawCard(210, 160, 'Closing Balance', `Rs. ${summary.closingBalance.toLocaleString()}`, darkText);
  drawCard(380, 160, 'Net Change', `${summary.net >= 0 ? '+' : ''}Rs. ${summary.net.toLocaleString()}`, summary.net >= 0 ? [52, 199, 89] : [255, 69, 58]);

  // Row 2: Income & Expense
  drawCard(40, 230, 'Total Income', `+ Rs. ${summary.income.toLocaleString()}`, [52, 199, 89]);
  drawCard(210, 230, 'Total Expense', `- Rs. ${summary.expense.toLocaleString()}`, [255, 69, 58]);

  // --- TRANSACTIONS TABLE ---
  doc.setTextColor(...darkText);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Transaction Ledger', 40, 335);

  const tableData = transactions.map(tx => [
    new Date(tx.date).toLocaleDateString('en-GB'),
    tx.categoryName || 'General',
    tx.note || '-',
    `${tx.type === 'expense' ? '-' : '+'} ${Number(tx.amount).toLocaleString()}`
  ]);

  autoTable(doc, {
    startY: 350,
    head: [['Date', 'Category', 'Description', 'Amount (Rs.)']],
    body: tableData,
    theme: 'plain',
    headStyles: { fillColor: [245, 245, 247], textColor: lightText, fontStyle: 'bold', fontSize: 9 },
    bodyStyles: { textColor: darkText, fontSize: 9 },
    alternateRowStyles: { fillColor: [252, 252, 254] },
    columnStyles: {
      3: { halign: 'right', fontStyle: 'bold' }
    },
    didParseCell: function (data) {
      if (data.section === 'body' && data.column.index === 3) {
        if (data.cell.raw.includes('-')) {
          data.cell.styles.textColor = [255, 69, 58];
        } else if (data.cell.raw.includes('+')) {
          data.cell.styles.textColor = [52, 199, 89];
        }
      }
    },
    margin: { top: 50, bottom: 50 },
    didDrawPage: function (data) {
      // Footer
      const str = 'Page ' + doc.internal.getNumberOfPages();
      doc.setFontSize(9);
      doc.setTextColor(...lightText);
      doc.text(str, 40, doc.internal.pageSize.height - 30);
      doc.text('Avora Financial - Private & Confidential', 555, doc.internal.pageSize.height - 30, { align: 'right' });
    }
  });

  doc.save(`Avora_Report_${new Date().getTime()}.pdf`);
};
