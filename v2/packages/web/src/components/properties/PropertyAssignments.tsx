import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { UserPlus, X } from "lucide-react";
import toast from "react-hot-toast";

interface PropertyAssignmentsProps {
  propertyId: Id<"properties">;
}

export function PropertyAssignments({ propertyId }: PropertyAssignmentsProps) {
  const assignments = useQuery(api.propertyAssignments.listByProperty, {
    propertyId,
  });
  const inspectors = useQuery(api.users.listInspectors);
  const assign = useMutation(api.propertyAssignments.assign);
  const unassign = useMutation(api.propertyAssignments.unassign);

  const [selectedInspector, setSelectedInspector] = useState("");
  const [assigning, setAssigning] = useState(false);

  if (!assignments || !inspectors) {
    return (
      <div className="flex justify-center py-4">
        <Spinner size="sm" />
      </div>
    );
  }

  const activeAssignments = assignments.filter((a) => a.isActive);
  const assignedIds = new Set(activeAssignments.map((a) => a.inspectorId));
  const availableInspectors = inspectors.filter((i) => !assignedIds.has(i._id));

  async function handleAssign() {
    if (!selectedInspector) return;
    setAssigning(true);
    try {
      await assign({
        propertyId,
        inspectorId: selectedInspector as Id<"users">,
      });
      setSelectedInspector("");
      toast.success("Inspector assigned");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to assign");
    } finally {
      setAssigning(false);
    }
  }

  async function handleUnassign(assignmentId: Id<"propertyAssignments">) {
    try {
      await unassign({ assignmentId });
      toast.success("Inspector removed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove");
    }
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-foreground">
        Assigned Inspectors
      </h3>

      {activeAssignments.length === 0 ? (
        <p className="text-sm text-muted">No inspectors assigned yet.</p>
      ) : (
        <div className="space-y-2">
          {activeAssignments.map((assignment) => (
            <div
              key={assignment._id}
              className="flex items-center justify-between rounded-lg border border-border p-3"
            >
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-xs font-medium text-emerald-700">
                  {assignment.inspector?.name
                    ?.split(" ")
                    .map((p) => p[0])
                    .join("")
                    .slice(0, 2)}
                </div>
                <div>
                  <p className="text-sm font-medium">
                    {assignment.inspector?.name}
                  </p>
                  <p className="text-xs text-muted">
                    {assignment.inspector?.email}
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleUnassign(assignment._id)}
                className="rounded-md p-1 text-muted hover:bg-red-50 hover:text-danger"
                title="Remove assignment"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Assign new inspector */}
      {availableInspectors.length > 0 && (
        <div className="flex items-end gap-2 pt-2">
          <div className="flex-1">
            <Select
              label="Add Inspector"
              value={selectedInspector}
              onChange={(e) => setSelectedInspector(e.target.value)}
              options={[
                { value: "", label: "Select inspector..." },
                ...availableInspectors.map((i) => ({
                  value: i._id,
                  label: i.name,
                })),
              ]}
            />
          </div>
          <Button
            onClick={handleAssign}
            disabled={!selectedInspector}
            loading={assigning}
            size="md"
          >
            <UserPlus className="h-4 w-4" />
            Assign
          </Button>
        </div>
      )}
    </div>
  );
}
