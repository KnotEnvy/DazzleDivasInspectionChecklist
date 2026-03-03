import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { History, ChevronRight, Calendar, User } from "lucide-react";

export function HistoryPage() {
  const inspections = useQuery(api.inspections.listCompleted);

  if (inspections === undefined) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Inspection History</h1>

      {inspections.length === 0 ? (
        <EmptyState
          icon={<History className="h-10 w-10" />}
          title="No completed inspections"
          description="Completed inspections will appear here."
        />
      ) : (
        <div className="divide-y divide-border rounded-xl border border-border bg-surface">
          {inspections.map((inspection) => (
            <Link
              key={inspection._id}
              to={`/inspections/${inspection._id}`}
              className="flex items-center justify-between p-4 transition-colors hover:bg-gray-50"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">
                  {inspection.propertyName}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted">
                  <span className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {inspection.inspectorName}
                  </span>
                  {inspection.completedAt && (
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(inspection.completedAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 ml-4">
                <Badge variant="success">Completed</Badge>
                <ChevronRight className="h-4 w-4 text-muted" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
