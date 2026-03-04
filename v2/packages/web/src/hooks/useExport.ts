import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { generateCsv, downloadCsv } from "@/lib/csvExport";
import { downloadPdf } from "@/lib/pdfExport";
import type { ReportData } from "@/lib/csvExport";
import toast from "react-hot-toast";

export function useExport(inspectionId: Id<"inspections">) {
  const report = useQuery(api.inspections.getFullReport, { inspectionId });

  const [pdfLoading, setPdfLoading] = useState(false);

  const handleDownloadPdf = async () => {
    if (!report) return;
    setPdfLoading(true);
    try {
      const name = report.property_name.replace(/\s+/g, "-");
      downloadPdf(report, `${name}-report.pdf`);
      toast.success("PDF downloaded!");
    } catch {
      toast.error("Failed to generate PDF");
    } finally {
      setPdfLoading(false);
    }
  };

  const exportCsv = () => {
    if (!report) return;
    const name = report.property_name.replace(/\s+/g, "-");
    const csv = generateCsv(report);
    downloadCsv(csv, `${name}-report.csv`);
    toast.success("CSV downloaded!");
  };

  return {
    downloadPdf: handleDownloadPdf,
    exportCsv,
    pdfLoading,
    csvReady: !!report,
  };
}
