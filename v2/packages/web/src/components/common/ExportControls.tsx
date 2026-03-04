import type { Id } from "convex/_generated/dataModel";
import { useExport } from "@/hooks/useExport";
import { Button } from "@/components/ui/Button";
import { FileText, FileSpreadsheet } from "lucide-react";

interface ExportControlsProps {
  inspectionId: Id<"inspections">;
  compact?: boolean;
}

export function ExportControls({
  inspectionId,
  compact = false,
}: ExportControlsProps) {
  const { downloadPdf, exportCsv, pdfLoading, csvReady } =
    useExport(inspectionId);

  if (compact) {
    return (
      <div className="flex gap-1">
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            downloadPdf();
          }}
          disabled={pdfLoading}
          className="rounded-md p-1.5 text-muted hover:bg-gray-100 hover:text-primary-600 disabled:opacity-50"
          title="Download PDF"
        >
          {pdfLoading ? (
            <svg
              className="h-4 w-4 animate-spin"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
          ) : (
            <FileText className="h-4 w-4" />
          )}
        </button>
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            exportCsv();
          }}
          disabled={!csvReady}
          className="rounded-md p-1.5 text-muted hover:bg-gray-100 hover:text-emerald-600 disabled:opacity-50"
          title="Download CSV"
        >
          <FileSpreadsheet className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={downloadPdf}
        loading={pdfLoading}
      >
        <FileText className="h-4 w-4" />
        PDF
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={exportCsv}
        disabled={!csvReady}
      >
        <FileSpreadsheet className="h-4 w-4" />
        CSV
      </Button>
    </div>
  );
}
