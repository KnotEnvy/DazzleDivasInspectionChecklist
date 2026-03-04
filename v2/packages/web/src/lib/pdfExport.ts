import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { ReportData } from "./csvExport";
import { triggerDownload } from "./csvExport";

export function generatePdfBlob(report: ReportData): Blob {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 20;

  // Title
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("Inspection Report", pageWidth / 2, y, { align: "center" });
  y += 12;

  // Property name
  doc.setFontSize(14);
  doc.text(report.property_name, pageWidth / 2, y, { align: "center" });
  y += 10;

  // Info section
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  const info = [
    ["Address", report.property_address || "N/A"],
    ["Inspector", report.inspector_name],
    ["Date", report.inspection_date],
    ["Status", report.status],
  ];
  if (report.notes) {
    info.push(["Notes", report.notes]);
  }

  autoTable(doc, {
    startY: y,
    body: info,
    theme: "plain",
    styles: { fontSize: 10, cellPadding: 2 },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 30 },
    },
    margin: { left: 20, right: 20 },
  });

  y = (doc as any).lastAutoTable.finalY + 10;

  // Room sections
  for (const room of report.rooms) {
    // Check if we need a new page
    if (y > 250) {
      doc.addPage();
      y = 20;
    }

    // Room header
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(room.room_name, 20, y);

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    const statusText = `Status: ${room.status} | Photos: ${room.photo_count}`;
    doc.text(statusText, pageWidth - 20, y, { align: "right" });
    y += 6;

    // Tasks table
    if (room.tasks.length > 0) {
      autoTable(doc, {
        startY: y,
        head: [["Task", "Status"]],
        body: room.tasks.map((t) => [
          t.description,
          t.completed ? "Done" : "Pending",
        ]),
        theme: "striped",
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: [124, 58, 237] },
        columnStyles: {
          0: { cellWidth: "auto" },
          1: { cellWidth: 25, halign: "center" },
        },
        margin: { left: 20, right: 20 },
      });
      y = (doc as any).lastAutoTable.finalY + 4;
    }

    // Room notes
    if (room.notes) {
      doc.setFontSize(9);
      doc.setFont("helvetica", "italic");
      doc.text(`Notes: ${room.notes}`, 20, y);
      y += 6;
    }

    y += 6;
  }

  // Footer
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(128);
  doc.text(
    `Generated ${new Date().toLocaleString()}`,
    pageWidth / 2,
    doc.internal.pageSize.getHeight() - 10,
    { align: "center" }
  );

  return doc.output("blob");
}

export function downloadPdf(report: ReportData, filename: string) {
  const blob = generatePdfBlob(report);
  triggerDownload(blob, filename);
}
