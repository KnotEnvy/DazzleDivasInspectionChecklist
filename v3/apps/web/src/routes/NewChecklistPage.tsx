import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import type { Id } from "convex/_generated/dataModel";
import { api } from "convex/_generated/api";
import toast from "react-hot-toast";
import { Building2 } from "lucide-react";
import { CHECKLIST_TYPES } from "@dazzle/shared";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { queueCreateInspection } from "@/lib/offlineOutbox";
import { useOutboxCount } from "@/hooks/useOutboxCount";
import { EmptyState } from "@/components/EmptyState";

type PropertyOption = {
  _id: string;
  name: string;
};

export function NewChecklistPage() {
  const navigate = useNavigate();
  const isOnline = useNetworkStatus();
  const { refresh } = useOutboxCount();

  const properties = useQuery(api.properties.listForCurrentUser) as
    | PropertyOption[]
    | undefined;
  const createInspection = useMutation(api.inspections.create);

  const [propertyId, setPropertyId] = useState("");
  const [type, setType] = useState<(typeof CHECKLIST_TYPES)[number]>("CLEANING");
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!propertyId) {
      toast.error("Choose a property first");
      return;
    }

    setPending(true);

    try {
      if (!isOnline) {
        await queueCreateInspection({ propertyId, type });
        await refresh();
        toast.success("Queued for sync when connection is back");
        setPending(false);
        return;
      }

      const inspectionId = await createInspection({
        propertyId: propertyId as Id<"properties">,
        type,
      });

      toast.success("Checklist started");
      navigate(`/checklists/${inspectionId}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to start checklist");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="animate-fade-in max-w-2xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Start New Checklist</h1>
        <p className="text-sm text-slate-600">
          If you are offline, this action is queued and synced later.
        </p>
      </div>

      {properties !== undefined && properties.length === 0 ? (
        <EmptyState
          icon={<Building2 className="h-8 w-8" />}
          heading="No properties available"
          description="You need at least one assigned property before starting a checklist."
        />
      ) : (
        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="block text-sm font-semibold text-slate-700">
            Property
            <select
              autoFocus
              className="input mt-1"
              value={propertyId}
              onChange={(event) => setPropertyId(event.target.value)}
              required
            >
              <option value="">Select a property...</option>
              {properties?.map((property) => (
                <option key={property._id} value={property._id}>
                  {property.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-semibold text-slate-700">
            Checklist Type
            <select
              className="input mt-1"
              value={type}
              onChange={(event) => setType(event.target.value as (typeof CHECKLIST_TYPES)[number])}
            >
              {CHECKLIST_TYPES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <button className="field-button go px-5" disabled={pending} type="submit">
            {pending ? "Starting..." : isOnline ? "Start Checklist" : "Queue For Sync"}
          </button>
        </form>
      )}
    </div>
  );
}