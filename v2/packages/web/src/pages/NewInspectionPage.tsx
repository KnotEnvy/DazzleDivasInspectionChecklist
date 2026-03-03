import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { Building2, MapPin, ChevronRight, ClipboardCheck } from "lucide-react";
import toast from "react-hot-toast";

export function NewInspectionPage() {
  const navigate = useNavigate();
  const { isAdmin } = useCurrentUser();
  const createInspection = useMutation(api.inspections.create);

  // Admin sees all properties; inspector sees assigned ones
  const allProperties = useQuery(api.properties.list);
  const assignments = useQuery(api.propertyAssignments.listMyAssignments);

  const [starting, setStarting] = useState<Id<"properties"> | null>(null);

  const properties = isAdmin
    ? allProperties
    : assignments?.map((a) => a.property).filter(Boolean);

  if (properties === undefined) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  async function handleStart(propertyId: Id<"properties">) {
    setStarting(propertyId);
    try {
      const inspectionId = await createInspection({ propertyId });
      toast.success("Inspection started!");
      navigate(`/inspections/${inspectionId}`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to start inspection"
      );
      setStarting(null);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">New Inspection</h1>
      <p className="text-sm text-muted">
        Select a property to begin inspecting.
      </p>

      {properties.length === 0 ? (
        <EmptyState
          icon={<Building2 className="h-10 w-10" />}
          title="No properties available"
          description={
            isAdmin
              ? "Create a property first in the admin panel."
              : "No properties have been assigned to you yet."
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {properties.map((property) => {
            if (!property) return null;
            const isStarting = starting === property._id;
            return (
              <Card
                key={property._id}
                className="flex cursor-pointer items-center justify-between p-4 transition-all hover:border-primary-300 hover:shadow-md"
                onClick={() => !starting && handleStart(property._id)}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate">
                    {property.name}
                  </p>
                  <div className="mt-1 flex items-center gap-1 text-xs text-muted">
                    <MapPin className="h-3 w-3 shrink-0" />
                    <span className="truncate">{property.address}</span>
                  </div>
                  {property.bedrooms != null && (
                    <p className="mt-1 text-xs text-muted">
                      {property.bedrooms}BR / {property.bathrooms}BA
                    </p>
                  )}
                </div>
                <div className="ml-3">
                  {isStarting ? (
                    <Spinner size="sm" />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-50 text-primary-500">
                      <ClipboardCheck className="h-4 w-4" />
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
