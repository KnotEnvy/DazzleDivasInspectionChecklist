import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { Link } from "react-router-dom";
import { Card, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { ClipboardCheck, ChevronRight, Plus } from "lucide-react";

export function InspectorDashboard() {
  const activeInspections = useQuery(api.inspections.listActive);
  const assignments = useQuery(api.propertyAssignments.listMyAssignments);

  if (activeInspections === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">My Dashboard</h1>
        <Link to="/inspections/new">
          <Button size="sm">
            <Plus className="h-4 w-4" />
            New Inspection
          </Button>
        </Link>
      </div>

      {/* Active inspections */}
      <Card>
        <CardTitle>Active Inspections</CardTitle>
        {activeInspections.length === 0 ? (
          <div className="mt-4 flex flex-col items-center gap-2 py-8 text-center">
            <ClipboardCheck className="h-10 w-10 text-muted/50" />
            <p className="text-sm text-muted">No active inspections</p>
            <Link to="/inspections/new">
              <Button variant="outline" size="sm">
                Start an Inspection
              </Button>
            </Link>
          </div>
        ) : (
          <div className="mt-4 divide-y divide-border">
            {activeInspections.map((inspection) => (
              <Link
                key={inspection._id}
                to={`/inspections/${inspection._id}`}
                className="flex items-center justify-between py-3 hover:bg-gray-50 -mx-2 px-2 rounded-lg transition-colors"
              >
                <div>
                  <p className="text-sm font-medium">
                    {inspection.propertyName}
                  </p>
                  <p className="text-xs text-muted">
                    Started{" "}
                    {new Date(inspection._creationTime).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="warning">In Progress</Badge>
                  <ChevronRight className="h-4 w-4 text-muted" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </Card>

      {/* Assigned properties */}
      {assignments && assignments.length > 0 && (
        <Card>
          <CardTitle>My Properties</CardTitle>
          <div className="mt-4 divide-y divide-border">
            {assignments.map((assignment) => (
              <div
                key={assignment._id}
                className="flex items-center justify-between py-3"
              >
                <div>
                  <p className="text-sm font-medium">
                    {assignment.property?.name}
                  </p>
                  <p className="text-xs text-muted">
                    {assignment.property?.address}
                  </p>
                </div>
                <Badge variant="info">
                  {assignment.property?.propertyType}
                </Badge>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
