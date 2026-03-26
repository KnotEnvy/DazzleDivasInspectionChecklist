import { FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import type { Id } from "convex/_generated/dataModel";
import { api } from "convex/_generated/api";
import toast from "react-hot-toast";
import { Building2 } from "lucide-react";
import { PROPERTY_TYPES } from "@dazzle/shared";
import { PropertyChecklistOverridesSection } from "@/components/PropertyChecklistOverridesSection";
import { EmptyState } from "@/components/EmptyState";

const DAY_MS = 24 * 60 * 60 * 1000;
type ChecklistType = "CLEANING" | "INSPECTION";
type RoomGenerationMode = "SINGLE" | "PER_BEDROOM" | "PER_BATHROOM";

type AssignmentSummary = {
  cleaners: number;
  inspectors: number;
};

type ScheduleSummary = {
  activePlans: number;
};

type AdminProperty = {
  _id: Id<"properties">;
  name: string;
  address: string;
  clientLabel?: string;
  propertyType: "RESIDENTIAL" | "COMMERCIAL";
  bedrooms?: number;
  bathrooms?: number;
  timezone?: string;
  accessInstructions?: string;
  entryMethod?: string;
  serviceNotes?: string;
  isArchived?: boolean;
  assignmentSummary: AssignmentSummary;
  scheduleSummary: ScheduleSummary;
};

type ServicePlan = {
  _id: Id<"servicePlans">;
  planType: "CLEANING" | "INSPECTION" | "DEEP_CLEAN" | "MAINTENANCE";
  frequency: "DAILY" | "WEEKLY" | "BIWEEKLY" | "MONTHLY" | "CUSTOM_RRULE";
  daysOfWeek?: number[];
  timeWindowStart: string;
  timeWindowEnd: string;
  defaultDurationMinutes: number;
  defaultAssigneeRole: "CLEANER" | "INSPECTOR";
  defaultAssigneeId?: Id<"users">;
  priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  notes?: string;
  isActive: boolean;
};

type PropertyJob = {
  _id: Id<"jobs">;
  scheduledStart: number;
  status: "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | "BLOCKED";
  jobType: "CLEANING" | "INSPECTION" | "DEEP_CLEAN" | "MAINTENANCE";
  assigneeName?: string | null;
};

type PropertyFormState = {
  name: string;
  address: string;
  clientLabel: string;
  propertyType: "RESIDENTIAL" | "COMMERCIAL";
  bedrooms: string;
  bathrooms: string;
  timezone: string;
  accessInstructions: string;
  entryMethod: string;
  serviceNotes: string;
};

type TemplateTask = {
  _id: Id<"tasks">;
  checklistType: ChecklistType;
  description: string;
  sortOrder: number;
  requiredPhotoMin?: number;
};

type TemplateRoom = {
  _id: Id<"rooms">;
  name: string;
  description?: string;
  sortOrder: number;
  generationMode?: RoomGenerationMode;
  isActive: boolean;
  tasks: TemplateTask[];
};

type AssignmentUser = {
  _id: Id<"users">;
  name: string;
  email: string;
  role: "CLEANER" | "INSPECTOR";
  isActive: boolean;
};

type PropertyAssignment = {
  _id: Id<"propertyAssignments">;
  propertyId: Id<"properties">;
  userId: Id<"users">;
  assignmentRole: "CLEANER" | "INSPECTOR";
  startDate: number;
  endDate?: number;
  isActive: boolean;
  user?: AssignmentUser | null;
};

const weekdayLabels: Array<{ value: number; label: string }> = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
];

function parseOptionalCount(value: string) {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return undefined;
  }

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return Math.floor(parsed);
}

function inferRoomGenerationMode(room: {
  name: string;
  generationMode?: RoomGenerationMode;
}) {
  if (room.generationMode) {
    return room.generationMode;
  }

  const normalizedName = room.name.trim().toLowerCase();
  if (normalizedName === "bedroom" || normalizedName.startsWith("bedroom ")) {
    return "PER_BEDROOM" as const;
  }

  if (normalizedName === "bathroom" || normalizedName.startsWith("bathroom ")) {
    return "PER_BATHROOM" as const;
  }

  return "SINGLE" as const;
}

function deriveRoomNames(params: {
  room: { name: string; generationMode?: RoomGenerationMode };
  bedrooms?: number;
  bathrooms?: number;
}) {
  const generationMode = inferRoomGenerationMode(params.room);

  if (generationMode === "PER_BEDROOM") {
    const count = Math.max(1, params.bedrooms ?? 1);
    return Array.from({ length: count }, (_, index) => `Bedroom ${index + 1}`);
  }

  if (generationMode === "PER_BATHROOM") {
    const count = Math.max(1, params.bathrooms ?? 1);
    return Array.from({ length: count }, (_, index) => `Bathroom ${index + 1}`);
  }

  return [params.room.name];
}

function sortPropertiesByName<T extends { name: string }>(properties: T[]) {
  return properties.slice().sort((left, right) =>
    left.name.localeCompare(right.name, undefined, {
      numeric: true,
      sensitivity: "base",
    })
  );
}

export function AdminPropertiesPage() {
  const [confirmAction, setConfirmAction] = useState<string | null>(null);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPropertyId, setSelectedPropertyId] = useState<Id<"properties"> | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const properties = useQuery(api.properties.listAdmin, { includeArchived }) as
    | AdminProperty[]
    | undefined;
  const searchedProperties = useQuery(
    api.properties.search,
    searchTerm.trim().length > 0 ? { term: searchTerm, includeArchived } : "skip"
  ) as AdminProperty[] | undefined;

  const activeList = useMemo(
    () =>
      sortPropertiesByName(
        searchTerm.trim().length > 0 ? searchedProperties ?? [] : properties ?? []
      ),
    [properties, searchTerm, searchedProperties]
  );

  const createProperty = useMutation(api.properties.create);
  const updateProperty = useMutation(api.properties.update);
  const archiveProperty = useMutation(api.properties.archive);
  const createPlan = useMutation(api.servicePlans.create);
  const setPlanActive = useMutation(api.servicePlans.setActive);
  const setPlanDefaultAssignee = useMutation(api.servicePlans.setDefaultAssignee);
  const bootstrapStarterTemplates = useMutation(api.templates.bootstrapStarterTemplates);
  const generateJobs = useMutation(api.scheduling.generateJobs);
  const assignProperty = useMutation(api.propertyAssignments.assign);
  const unassignProperty = useMutation(api.propertyAssignments.unassign);

  const [createForm, setCreateForm] = useState({
    name: "",
    address: "",
    clientLabel: "",
    propertyType: "RESIDENTIAL" as "RESIDENTIAL" | "COMMERCIAL",
    bedrooms: "",
    bathrooms: "",
    timezone: "America/New_York",
    accessInstructions: "",
    entryMethod: "",
    serviceNotes: "",
  });

  const selectedProperty = useMemo(() => {
    return (activeList ?? []).find((property) => property._id === selectedPropertyId) ?? null;
  }, [activeList, selectedPropertyId]);

  const [editForm, setEditForm] = useState<PropertyFormState>({
    name: "",
    address: "",
    clientLabel: "",
    propertyType: "RESIDENTIAL" as "RESIDENTIAL" | "COMMERCIAL",
    bedrooms: "",
    bathrooms: "",
    timezone: "America/New_York",
    accessInstructions: "",
    entryMethod: "",
    serviceNotes: "",
  });

  const selectedPropertyFormDefaults = useMemo<PropertyFormState | null>(() => {
    if (!selectedProperty) {
      return null;
    }

    return {
      name: selectedProperty.name,
      address: selectedProperty.address,
      clientLabel: selectedProperty.clientLabel ?? "",
      propertyType: selectedProperty.propertyType,
      bedrooms: selectedProperty.bedrooms ? String(selectedProperty.bedrooms) : "",
      bathrooms: selectedProperty.bathrooms ? String(selectedProperty.bathrooms) : "",
      timezone: selectedProperty.timezone ?? "America/New_York",
      accessInstructions: selectedProperty.accessInstructions ?? "",
      entryMethod: selectedProperty.entryMethod ?? "",
      serviceNotes: selectedProperty.serviceNotes ?? "",
    };
  }, [
    selectedPropertyId,
    selectedProperty?.name,
    selectedProperty?.address,
    selectedProperty?.clientLabel,
    selectedProperty?.propertyType,
    selectedProperty?.bedrooms,
    selectedProperty?.bathrooms,
    selectedProperty?.timezone,
    selectedProperty?.accessInstructions,
    selectedProperty?.entryMethod,
    selectedProperty?.serviceNotes,
  ]);

  useEffect(() => {
    if (!activeList || activeList.length === 0) {
      setSelectedPropertyId(null);
      return;
    }

    if (!selectedPropertyId || !activeList.some((property) => property._id === selectedPropertyId)) {
      setSelectedPropertyId(activeList[0]._id);
    }
  }, [activeList, selectedPropertyId]);

  useEffect(() => {
    if (!selectedPropertyFormDefaults) {
      return;
    }

    setEditForm((current) => {
      if (
        current.name === selectedPropertyFormDefaults.name &&
        current.address === selectedPropertyFormDefaults.address &&
        current.clientLabel === selectedPropertyFormDefaults.clientLabel &&
        current.propertyType === selectedPropertyFormDefaults.propertyType &&
        current.bedrooms === selectedPropertyFormDefaults.bedrooms &&
        current.bathrooms === selectedPropertyFormDefaults.bathrooms &&
        current.timezone === selectedPropertyFormDefaults.timezone &&
        current.accessInstructions === selectedPropertyFormDefaults.accessInstructions &&
        current.entryMethod === selectedPropertyFormDefaults.entryMethod &&
        current.serviceNotes === selectedPropertyFormDefaults.serviceNotes
      ) {
        return current;
      }

      return selectedPropertyFormDefaults;
    });
  }, [selectedPropertyFormDefaults]);

  const jobsWindow = useMemo(() => {
    const now = Date.now();
    return {
      from: now - DAY_MS,
      to: now + 14 * DAY_MS,
    };
  }, [selectedPropertyId]);

  const plans = useQuery(
    api.servicePlans.listByProperty,
    selectedPropertyId ? { propertyId: selectedPropertyId, includeInactive: true } : "skip"
  ) as ServicePlan[] | undefined;

  const jobs = useQuery(
    api.jobs.listByProperty,
    selectedPropertyId
      ? {
          propertyId: selectedPropertyId,
          from: jobsWindow.from,
          to: jobsWindow.to,
        }
      : "skip"
  ) as PropertyJob[] | undefined;

  const assignments = useQuery(
    api.propertyAssignments.listByProperty,
    selectedPropertyId ? { propertyId: selectedPropertyId } : "skip"
  ) as PropertyAssignment[] | undefined;

  const cleanerUsers = useQuery(api.users.listByRole, { role: "CLEANER" }) as
    | AssignmentUser[]
    | undefined;
  const inspectorUsers = useQuery(api.users.listByRole, { role: "INSPECTOR" }) as
    | AssignmentUser[]
    | undefined;

  const [planForm, setPlanForm] = useState({
    planType: "CLEANING" as "CLEANING" | "INSPECTION" | "DEEP_CLEAN" | "MAINTENANCE",
    frequency: "WEEKLY" as "DAILY" | "WEEKLY" | "BIWEEKLY" | "MONTHLY" | "CUSTOM_RRULE",
    daysOfWeek: [1, 3, 5] as number[],
    timeWindowStart: "09:00",
    timeWindowEnd: "11:00",
    defaultDurationMinutes: "120",
    defaultAssigneeRole: "CLEANER" as "CLEANER" | "INSPECTOR",
    defaultAssigneeId: "",
    priority: "MEDIUM" as "LOW" | "MEDIUM" | "HIGH" | "URGENT",
    notes: "",
  });
  const [selectedCleanerId, setSelectedCleanerId] = useState("");
  const [selectedInspectorId, setSelectedInspectorId] = useState("");

  const activeAssignments = useMemo(() => {
    return (assignments ?? [])
      .filter((assignment) => assignment.isActive)
      .sort((left, right) => (left.user?.name ?? "").localeCompare(right.user?.name ?? ""));
  }, [assignments]);
  const assignmentUserById = useMemo(() => {
    return new Map(
      activeAssignments
        .filter((assignment) => assignment.user)
        .map((assignment) => [assignment.userId, assignment.user as AssignmentUser])
    );
  }, [activeAssignments]);

  const cleanerAssignments = useMemo(() => {
    return activeAssignments.filter((assignment) => assignment.assignmentRole === "CLEANER");
  }, [activeAssignments]);

  const inspectorAssignments = useMemo(() => {
    return activeAssignments.filter((assignment) => assignment.assignmentRole === "INSPECTOR");
  }, [activeAssignments]);

  const availableCleaners = useMemo(() => {
    const assignedIds = new Set(cleanerAssignments.map((assignment) => assignment.userId));
    return (cleanerUsers ?? [])
      .filter((user) => user.isActive && !assignedIds.has(user._id))
      .sort((left, right) => left.name.localeCompare(right.name));
  }, [cleanerAssignments, cleanerUsers]);

  const availableInspectors = useMemo(() => {
    const assignedIds = new Set(inspectorAssignments.map((assignment) => assignment.userId));
    return (inspectorUsers ?? [])
      .filter((user) => user.isActive && !assignedIds.has(user._id))
      .sort((left, right) => left.name.localeCompare(right.name));
  }, [inspectorAssignments, inspectorUsers]);
  const eligiblePlanAssignees = useMemo(() => {
    return activeAssignments.filter(
      (assignment) =>
        assignment.assignmentRole === planForm.defaultAssigneeRole && assignment.user?.isActive
    );
  }, [activeAssignments, planForm.defaultAssigneeRole]);

  const previewBedrooms = useMemo(() => {
    const parsed = parseOptionalCount(editForm.bedrooms);
    return parsed === null ? selectedProperty?.bedrooms : parsed;
  }, [editForm.bedrooms, selectedProperty?.bedrooms]);

  const previewBathrooms = useMemo(() => {
    const parsed = parseOptionalCount(editForm.bathrooms);
    return parsed === null ? selectedProperty?.bathrooms : parsed;
  }, [editForm.bathrooms, selectedProperty?.bathrooms]);

  useEffect(() => {
    setSelectedCleanerId("");
    setSelectedInspectorId("");
  }, [selectedPropertyId]);

  useEffect(() => {
    if (
      planForm.defaultAssigneeId.length > 0 &&
      !eligiblePlanAssignees.some((assignment) => assignment.userId === planForm.defaultAssigneeId)
    ) {
      setPlanForm((current) => ({ ...current, defaultAssigneeId: "" }));
    }
  }, [eligiblePlanAssignees, planForm.defaultAssigneeId]);

  async function handleCreateProperty(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const bedrooms = parseOptionalCount(createForm.bedrooms);
    const bathrooms = parseOptionalCount(createForm.bathrooms);
    if (bedrooms === null || bathrooms === null) {
      toast.error("Bedrooms and bathrooms must be positive numbers when provided");
      return;
    }

    setIsSaving(true);

    try {
      const propertyId = await createProperty({
        name: createForm.name.trim(),
        address: createForm.address.trim(),
        clientLabel: createForm.clientLabel.trim() || undefined,
        propertyType: createForm.propertyType,
        bedrooms,
        bathrooms,
        timezone: createForm.timezone.trim(),
        accessInstructions: createForm.accessInstructions.trim() || undefined,
        entryMethod: createForm.entryMethod.trim() || undefined,
        serviceNotes: createForm.serviceNotes.trim() || undefined,
      });

      toast.success("Property created");
      setCreateForm({
        name: "",
        address: "",
        clientLabel: "",
        propertyType: "RESIDENTIAL",
        bedrooms: "",
        bathrooms: "",
        timezone: "America/New_York",
        accessInstructions: "",
        entryMethod: "",
        serviceNotes: "",
      });
      setSelectedPropertyId(propertyId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create property");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSaveProperty() {
    if (!selectedPropertyId) {
      return;
    }

    const bedrooms = parseOptionalCount(editForm.bedrooms);
    const bathrooms = parseOptionalCount(editForm.bathrooms);
    if (bedrooms === null || bathrooms === null) {
      toast.error("Bedrooms and bathrooms must be positive numbers when provided");
      return;
    }

    setIsSaving(true);
    try {
      await updateProperty({
        propertyId: selectedPropertyId,
        name: editForm.name.trim(),
        address: editForm.address.trim(),
        clientLabel: editForm.clientLabel.trim() || undefined,
        propertyType: editForm.propertyType,
        bedrooms,
        bathrooms,
        timezone: editForm.timezone.trim(),
        accessInstructions: editForm.accessInstructions.trim() || undefined,
        entryMethod: editForm.entryMethod.trim() || undefined,
        serviceNotes: editForm.serviceNotes.trim() || undefined,
      });

      toast.success("Property updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update property");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleArchiveToggle(property: AdminProperty) {
    setIsSaving(true);
    try {
      await archiveProperty({
        propertyId: property._id,
        isArchived: property.isArchived !== true,
      });
      toast.success(property.isArchived ? "Property restored" : "Property archived");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update archive state");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleAssignUser(
    assignmentRole: "CLEANER" | "INSPECTOR",
    userId: string
  ) {
    if (!selectedPropertyId || userId.length === 0) {
      toast.error("Choose a user to assign");
      return;
    }

    setIsSaving(true);
    try {
      await assignProperty({
        propertyId: selectedPropertyId,
        userId: userId as Id<"users">,
        assignmentRole,
      });

      if (assignmentRole === "CLEANER") {
        setSelectedCleanerId("");
      } else {
        setSelectedInspectorId("");
      }

      toast.success(`${assignmentRole === "CLEANER" ? "Cleaner" : "Inspector"} assigned`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to assign user");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleUnassignUser(assignmentId: Id<"propertyAssignments">) {
    setIsSaving(true);
    try {
      await unassignProperty({ assignmentId });
      toast.success("Assignment removed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to remove assignment");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleCreatePlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedPropertyId) {
      return;
    }

    const duration = Number(planForm.defaultDurationMinutes);
    if (!Number.isFinite(duration) || duration <= 0) {
      toast.error("Duration must be a positive number");
      return;
    }

    setIsSaving(true);
    try {
      await createPlan({
        propertyId: selectedPropertyId,
        planType: planForm.planType,
        frequency: planForm.frequency,
        daysOfWeek:
          planForm.frequency === "WEEKLY" || planForm.frequency === "BIWEEKLY"
            ? planForm.daysOfWeek
            : undefined,
        timeWindowStart: planForm.timeWindowStart,
        timeWindowEnd: planForm.timeWindowEnd,
        defaultDurationMinutes: duration,
        defaultAssigneeRole: planForm.defaultAssigneeRole,
        defaultAssigneeId:
          planForm.defaultAssigneeId.length > 0
            ? (planForm.defaultAssigneeId as Id<"users">)
            : undefined,
        priority: planForm.priority,
        notes: planForm.notes.trim() || undefined,
      });

      toast.success("Service plan created");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create service plan");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleTogglePlan(plan: ServicePlan) {
    setIsSaving(true);
    try {
      await setPlanActive({
        servicePlanId: plan._id,
        isActive: !plan.isActive,
      });
      toast.success(plan.isActive ? "Plan paused" : "Plan activated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update plan");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleGenerate14Days() {
    setIsGenerating(true);
    try {
      const now = Date.now();
      const result = await generateJobs({
        from: now,
        to: now + 14 * DAY_MS,
      });
      toast.success(`Generated ${result.created} job(s) for the next 14 days`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to generate jobs");
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleBootstrapTemplates() {
    setIsSaving(true);
    try {
      const result = await bootstrapStarterTemplates({});
      toast.success(`Created ${result.roomsCreated} starter room templates`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create starter templates"
      );
    } finally {
      setIsSaving(false);
    }
  }

  function toggleDayOfWeek(day: number) {
    setPlanForm((current) => {
      const exists = current.daysOfWeek.includes(day);
      return {
        ...current,
        daysOfWeek: exists
          ? current.daysOfWeek.filter((value) => value !== day)
          : [...current.daysOfWeek, day].sort((a, b) => a - b),
      };
    });
  }

  function getEligibleAssignmentsForRole(role: "CLEANER" | "INSPECTOR") {
    return activeAssignments.filter(
      (assignment) => assignment.assignmentRole === role && assignment.user?.isActive
    );
  }

  async function handleSetPlanDefaultAssignee(
    servicePlanId: Id<"servicePlans">,
    defaultAssigneeId: string
  ) {
    setIsSaving(true);
    try {
      await setPlanDefaultAssignee({
        servicePlanId,
        defaultAssigneeId:
          defaultAssigneeId.length > 0 ? (defaultAssigneeId as Id<"users">) : null,
      });
      toast.success("Plan assignment updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update plan assignment");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="animate-fade-in space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Property Management</h1>
          <p className="text-sm text-slate-600">
            Create, update, archive, and schedule recurring service plans by property.
          </p>
        </div>
        <button
          className="field-button primary px-4"
          disabled={isGenerating}
          onClick={() => void handleGenerate14Days()}
          type="button"
        >
          {isGenerating ? "Generating..." : "Generate 14-Day Jobs"}
        </button>
      </div>

      <section className="grid gap-4 lg:grid-cols-2">
        <form className="rounded-2xl border border-border bg-white p-4" onSubmit={handleCreateProperty}>
          <h2 className="mb-3 text-lg font-bold">Create Property</h2>
          <div className="space-y-3">
            <label className="block text-sm font-semibold text-slate-700">
              Name
              <input
                className="input mt-1"
                value={createForm.name}
                onChange={(event) =>
                  setCreateForm((current) => ({ ...current, name: event.target.value }))
                }
                required
              />
            </label>
            <label className="block text-sm font-semibold text-slate-700">
              Address
              <input
                className="input mt-1"
                value={createForm.address}
                onChange={(event) =>
                  setCreateForm((current) => ({ ...current, address: event.target.value }))
                }
                required
              />
            </label>
            <label className="block text-sm font-semibold text-slate-700">
              Client / Account
              <input
                className="input mt-1"
                onChange={(event) =>
                  setCreateForm((current) => ({ ...current, clientLabel: event.target.value }))
                }
                placeholder="Optional"
                value={createForm.clientLabel}
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm font-semibold text-slate-700">
                Property Type
                <select
                  className="input mt-1"
                  value={createForm.propertyType}
                  onChange={(event) =>
                    setCreateForm((current) => ({
                      ...current,
                      propertyType: event.target.value as "RESIDENTIAL" | "COMMERCIAL",
                    }))
                  }
                >
                  {PROPERTY_TYPES.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-semibold text-slate-700">
                Timezone
                <input
                  className="input mt-1"
                  value={createForm.timezone}
                  onChange={(event) =>
                    setCreateForm((current) => ({ ...current, timezone: event.target.value }))
                  }
                  required
                />
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm font-semibold text-slate-700">
                Bedrooms
                <input
                  className="input mt-1"
                  min="1"
                  onChange={(event) =>
                    setCreateForm((current) => ({ ...current, bedrooms: event.target.value }))
                  }
                  placeholder="Optional"
                  type="number"
                  value={createForm.bedrooms}
                />
              </label>
              <label className="block text-sm font-semibold text-slate-700">
                Bathrooms
                <input
                  className="input mt-1"
                  min="1"
                  onChange={(event) =>
                    setCreateForm((current) => ({ ...current, bathrooms: event.target.value }))
                  }
                  placeholder="Optional"
                  type="number"
                  value={createForm.bathrooms}
                />
              </label>
            </div>
            <label className="block text-sm font-semibold text-slate-700">
              Entry Method
              <input
                className="input mt-1"
                value={createForm.entryMethod}
                onChange={(event) =>
                  setCreateForm((current) => ({ ...current, entryMethod: event.target.value }))
                }
              />
            </label>
            <label className="block text-sm font-semibold text-slate-700">
              Access Instructions
              <textarea
                className="input mt-1 min-h-24"
                value={createForm.accessInstructions}
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    accessInstructions: event.target.value,
                  }))
                }
              />
            </label>
            <label className="block text-sm font-semibold text-slate-700">
              Service Notes
              <textarea
                className="input mt-1 min-h-24"
                value={createForm.serviceNotes}
                onChange={(event) =>
                  setCreateForm((current) => ({ ...current, serviceNotes: event.target.value }))
                }
              />
            </label>
            <button className="field-button primary px-4" disabled={isSaving} type="submit">
              Create Property
            </button>
          </div>
        </form>

        <div className="rounded-2xl border border-border bg-white p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold">Properties</h2>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-600">
              <input
                checked={includeArchived}
                onChange={(event) => setIncludeArchived(event.target.checked)}
                type="checkbox"
              />
              Show archived
            </label>
          </div>
          <input
            className="input mb-3"
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search by name or address"
            value={searchTerm}
          />

          {activeList === undefined ? (
            <div className="space-y-3">
              <div className="skeleton h-16 rounded-xl" />
              <div className="skeleton h-16 rounded-xl" />
              <div className="skeleton h-16 rounded-xl" />
            </div>
          ) : activeList.length === 0 ? (
            <EmptyState
              icon={<Building2 className="h-8 w-8" />}
              heading="No properties found"
              description="Create your first property using the form above."
            />
          ) : (
            <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
              {activeList.map((property) => (
                <button
                  key={property._id}
                  aria-label={`Select property: ${property.name}`}
                  className={`w-full rounded-xl border p-3 text-left transition ${
                    property._id === selectedPropertyId
                      ? "border-brand-500 bg-brand-50"
                      : "border-border bg-white hover:border-brand-300"
                  }`}
                  onClick={() => setSelectedPropertyId(property._id)}
                  type="button"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{property.name}</p>
                      <p className="text-sm text-slate-600">{property.address}</p>
                      {property.clientLabel ? (
                        <p className="text-xs font-semibold text-brand-700">
                          Client: {property.clientLabel}
                        </p>
                      ) : null}
                      <p className="text-xs font-semibold text-slate-500">
                        {property.propertyType} | {property.bedrooms ?? 1} bed |{" "}
                        {property.bathrooms ?? 1} bath | {property.timezone ?? "America/New_York"}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-semibold ${
                        property.isArchived
                          ? "bg-slate-100 text-slate-600"
                          : "bg-emerald-100 text-emerald-700"
                      }`}
                    >
                      {property.isArchived ? "Archived" : "Active"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    Cleaners: {property.assignmentSummary.cleaners} | Inspectors:{" "}
                    {property.assignmentSummary.inspectors} | Active plans:{" "}
                    {property.scheduleSummary.activePlans}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {!selectedProperty ? null : (
        <>
          <PropertyChecklistOverridesSection
            bathrooms={previewBathrooms}
            bedrooms={previewBedrooms}
            bootstrapDisabled={isSaving}
            isArchived={selectedProperty.isArchived === true}
            onBootstrapTemplates={handleBootstrapTemplates}
            propertyId={selectedProperty._id}
            propertyName={selectedProperty.name}
          />

          <section className="grid gap-4 xl:grid-cols-2">
          <div className="space-y-4 rounded-2xl border border-border bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-lg font-bold">Property Detail</h2>
              {!selectedProperty.isArchived && confirmAction === "archiveProperty" ? (
                <div className="animate-slide-up flex gap-2">
                  <button
                    className="field-button danger px-3"
                    disabled={isSaving}
                    onClick={() => { setConfirmAction(null); void handleArchiveToggle(selectedProperty); }}
                    type="button"
                  >
                    Archive Property
                  </button>
                  <button
                    className="field-button ghost px-3"
                    onClick={() => setConfirmAction(null)}
                    type="button"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  className="field-button secondary px-3"
                  disabled={isSaving}
                  onClick={() => selectedProperty.isArchived
                    ? void handleArchiveToggle(selectedProperty)
                    : setConfirmAction("archiveProperty")}
                  type="button"
                >
                  {selectedProperty.isArchived ? "Unarchive" : "Archive"}
                </button>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm font-semibold text-slate-700">
                Name
                <input
                  className="input mt-1"
                  onChange={(event) =>
                    setEditForm((current) => ({ ...current, name: event.target.value }))
                  }
                  value={editForm.name}
                />
              </label>
              <label className="block text-sm font-semibold text-slate-700">
                Property Type
                <select
                  className="input mt-1"
                  onChange={(event) =>
                    setEditForm((current) => ({
                      ...current,
                      propertyType: event.target.value as "RESIDENTIAL" | "COMMERCIAL",
                    }))
                  }
                  value={editForm.propertyType}
                >
                  {PROPERTY_TYPES.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm font-semibold text-slate-700">
                Bedrooms
                <input
                  className="input mt-1"
                  min="1"
                  onChange={(event) =>
                    setEditForm((current) => ({ ...current, bedrooms: event.target.value }))
                  }
                  placeholder="Optional"
                  type="number"
                  value={editForm.bedrooms}
                />
              </label>
              <label className="block text-sm font-semibold text-slate-700">
                Bathrooms
                <input
                  className="input mt-1"
                  min="1"
                  onChange={(event) =>
                    setEditForm((current) => ({ ...current, bathrooms: event.target.value }))
                  }
                  placeholder="Optional"
                  type="number"
                  value={editForm.bathrooms}
                />
              </label>
            </div>
            <label className="block text-sm font-semibold text-slate-700">
              Address
              <input
                className="input mt-1"
                onChange={(event) =>
                  setEditForm((current) => ({ ...current, address: event.target.value }))
                }
                value={editForm.address}
              />
            </label>
            <label className="block text-sm font-semibold text-slate-700">
              Client / Account
              <input
                className="input mt-1"
                onChange={(event) =>
                  setEditForm((current) => ({ ...current, clientLabel: event.target.value }))
                }
                placeholder="Optional"
                value={editForm.clientLabel}
              />
            </label>
            <label className="block text-sm font-semibold text-slate-700">
              Timezone
              <input
                className="input mt-1"
                onChange={(event) =>
                  setEditForm((current) => ({ ...current, timezone: event.target.value }))
                }
                value={editForm.timezone}
              />
            </label>
            <label className="block text-sm font-semibold text-slate-700">
              Entry Method
              <input
                className="input mt-1"
                onChange={(event) =>
                  setEditForm((current) => ({ ...current, entryMethod: event.target.value }))
                }
                value={editForm.entryMethod}
              />
            </label>
            <label className="block text-sm font-semibold text-slate-700">
              Access Instructions
              <textarea
                className="input mt-1 min-h-24"
                onChange={(event) =>
                  setEditForm((current) => ({
                    ...current,
                    accessInstructions: event.target.value,
                  }))
                }
                value={editForm.accessInstructions}
              />
            </label>
            <label className="block text-sm font-semibold text-slate-700">
              Service Notes
              <textarea
                className="input mt-1 min-h-24"
                onChange={(event) =>
                  setEditForm((current) => ({ ...current, serviceNotes: event.target.value }))
                }
                value={editForm.serviceNotes}
              />
            </label>
            <button
              className="field-button primary px-4"
              disabled={isSaving}
              onClick={() => void handleSaveProperty()}
              type="button"
            >
              Save Property Changes
            </button>

            <div className="border-t border-border pt-4">
              <div className="mb-3">
                <h3 className="text-base font-bold">Assignments</h3>
                <p className="text-sm text-slate-600">
                  Active assignments control who is available for this property in dispatch.
                </p>
              </div>

              <div className="space-y-3">
                <AssignmentRoleSection
                  availableUsers={availableCleaners}
                  assignments={cleanerAssignments}
                  buttonLabel="Assign Cleaner"
                  disabled={isSaving || selectedProperty.isArchived === true}
                  emptyLabel="No active cleaners assigned."
                  loading={assignments === undefined || cleanerUsers === undefined}
                  roleLabel="Cleaners"
                  selectedUserId={selectedCleanerId}
                  setSelectedUserId={setSelectedCleanerId}
                  onAssign={() => void handleAssignUser("CLEANER", selectedCleanerId)}
                  onUnassign={(assignmentId) => void handleUnassignUser(assignmentId)}
                />

                <AssignmentRoleSection
                  availableUsers={availableInspectors}
                  assignments={inspectorAssignments}
                  buttonLabel="Assign Inspector"
                  disabled={isSaving || selectedProperty.isArchived === true}
                  emptyLabel="No active inspectors assigned."
                  loading={assignments === undefined || inspectorUsers === undefined}
                  roleLabel="Inspectors"
                  selectedUserId={selectedInspectorId}
                  setSelectedUserId={setSelectedInspectorId}
                  onAssign={() => void handleAssignUser("INSPECTOR", selectedInspectorId)}
                  onUnassign={(assignmentId) => void handleUnassignUser(assignmentId)}
                />
              </div>
            </div>
          </div>

          <div className="space-y-4 rounded-2xl border border-border bg-white p-4">
            <h2 className="text-lg font-bold">Service Plans</h2>

            <form className="space-y-3 rounded-xl border border-border bg-slate-50 p-3" onSubmit={handleCreatePlan}>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm font-semibold text-slate-700">
                  Plan Type
                  <select
                    className="input mt-1"
                    onChange={(event) =>
                      setPlanForm((current) => ({
                        ...current,
                        planType: event.target.value as
                          | "CLEANING"
                          | "INSPECTION"
                          | "DEEP_CLEAN"
                          | "MAINTENANCE",
                      }))
                    }
                    value={planForm.planType}
                  >
                    <option value="CLEANING">CLEANING</option>
                    <option value="INSPECTION">INSPECTION</option>
                    <option value="DEEP_CLEAN">DEEP_CLEAN</option>
                    <option value="MAINTENANCE">MAINTENANCE</option>
                  </select>
                </label>
                <label className="block text-sm font-semibold text-slate-700">
                  Frequency
                  <select
                    className="input mt-1"
                    onChange={(event) =>
                      setPlanForm((current) => ({
                        ...current,
                        frequency: event.target.value as
                          | "DAILY"
                          | "WEEKLY"
                          | "BIWEEKLY"
                          | "MONTHLY"
                          | "CUSTOM_RRULE",
                      }))
                    }
                    value={planForm.frequency}
                  >
                    <option value="DAILY">DAILY</option>
                    <option value="WEEKLY">WEEKLY</option>
                    <option value="BIWEEKLY">BIWEEKLY</option>
                    <option value="MONTHLY">MONTHLY</option>
                    <option value="CUSTOM_RRULE">CUSTOM_RRULE</option>
                  </select>
                </label>
              </div>

              {(planForm.frequency === "WEEKLY" || planForm.frequency === "BIWEEKLY") && (
                <div>
                  <p className="text-sm font-semibold text-slate-700">Days of week</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {weekdayLabels.map((day) => (
                      <button
                        key={day.value}
                        className={`rounded-lg border px-3 py-1 text-sm font-semibold ${
                          planForm.daysOfWeek.includes(day.value)
                            ? "border-brand-600 bg-brand-600 text-white"
                            : "border-border bg-white text-slate-700"
                        }`}
                        onClick={() => toggleDayOfWeek(day.value)}
                        type="button"
                      >
                        {day.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm font-semibold text-slate-700">
                  Window Start
                  <input
                    className="input mt-1"
                    onChange={(event) =>
                      setPlanForm((current) => ({
                        ...current,
                        timeWindowStart: event.target.value,
                      }))
                    }
                    value={planForm.timeWindowStart}
                  />
                </label>
                <label className="block text-sm font-semibold text-slate-700">
                  Window End
                  <input
                    className="input mt-1"
                    onChange={(event) =>
                      setPlanForm((current) => ({
                        ...current,
                        timeWindowEnd: event.target.value,
                      }))
                    }
                    value={planForm.timeWindowEnd}
                  />
                </label>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <label className="block text-sm font-semibold text-slate-700">
                  Duration (min)
                  <input
                    className="input mt-1"
                    onChange={(event) =>
                      setPlanForm((current) => ({
                        ...current,
                        defaultDurationMinutes: event.target.value,
                      }))
                    }
                    type="number"
                    value={planForm.defaultDurationMinutes}
                  />
                </label>
                <label className="block text-sm font-semibold text-slate-700">
                  Assignee Role
                  <select
                    className="input mt-1"
                    onChange={(event) =>
                      setPlanForm((current) => ({
                        ...current,
                        defaultAssigneeRole: event.target.value as "CLEANER" | "INSPECTOR",
                        defaultAssigneeId: "",
                      }))
                    }
                    value={planForm.defaultAssigneeRole}
                  >
                    <option value="CLEANER">CLEANER</option>
                    <option value="INSPECTOR">INSPECTOR</option>
                  </select>
                </label>
                <label className="block text-sm font-semibold text-slate-700">
                  Default Worker
                  <select
                    className="input mt-1"
                    onChange={(event) =>
                      setPlanForm((current) => ({
                        ...current,
                        defaultAssigneeId: event.target.value,
                      }))
                    }
                    value={planForm.defaultAssigneeId}
                  >
                    <option value="">Auto-assign from property roster</option>
                    {eligiblePlanAssignees.map((assignment) => (
                      <option key={assignment._id} value={assignment.userId}>
                        {assignment.user?.name ?? "Unknown user"}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm font-semibold text-slate-700">
                  Priority
                  <select
                    className="input mt-1"
                    onChange={(event) =>
                      setPlanForm((current) => ({
                        ...current,
                        priority: event.target.value as "LOW" | "MEDIUM" | "HIGH" | "URGENT",
                      }))
                    }
                    value={planForm.priority}
                  >
                    <option value="LOW">LOW</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="HIGH">HIGH</option>
                    <option value="URGENT">URGENT</option>
                  </select>
                </label>
              </div>
              <label className="block text-sm font-semibold text-slate-700">
                Plan Notes
                <textarea
                  className="input mt-1 min-h-20"
                  onChange={(event) =>
                    setPlanForm((current) => ({ ...current, notes: event.target.value }))
                  }
                  value={planForm.notes}
                />
              </label>
              <button className="field-button primary px-4" disabled={isSaving} type="submit">
                Add Service Plan
              </button>
            </form>

            {plans === undefined ? (
              <p className="text-sm text-slate-500">Loading plans...</p>
            ) : plans.length === 0 ? (
              <p className="text-sm text-slate-500">No plans configured yet.</p>
            ) : (
              <div className="space-y-2">
                {plans.map((plan) => (
                  <div key={plan._id} className={`rounded-xl border p-3 ${plan.isActive ? "border-emerald-200 bg-white" : "border-slate-200 bg-slate-50 opacity-75"}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold">
                            {plan.planType} | {plan.frequency}
                          </p>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${plan.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-500"}`}>
                            {plan.isActive ? "ACTIVE" : "PAUSED"}
                          </span>
                        </div>
                        <p className="text-sm text-slate-600">
                          {plan.timeWindowStart} - {plan.timeWindowEnd} ({plan.defaultDurationMinutes}m)
                        </p>
                        <p className="text-xs text-slate-500">
                          Role: {plan.defaultAssigneeRole} | Priority: {plan.priority ?? "MEDIUM"}
                        </p>
                        <p className="text-xs text-slate-500">
                          Default worker:{" "}
                          {plan.defaultAssigneeId
                            ? assignmentUserById.get(plan.defaultAssigneeId)?.name ?? "Unavailable"
                            : "Auto-assign from property roster"}
                        </p>
                        {plan.daysOfWeek && plan.daysOfWeek.length > 0 && (
                          <p className="text-xs text-slate-500">
                            Days: {plan.daysOfWeek.join(", ")}
                          </p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <label className="block text-xs font-semibold text-slate-700">
                          Default worker
                          <select
                            className="input mt-1 min-w-56"
                            disabled={isSaving}
                            onChange={(event) =>
                              void handleSetPlanDefaultAssignee(plan._id, event.target.value)
                            }
                            value={plan.defaultAssigneeId ?? ""}
                          >
                            <option value="">Auto-assign from property roster</option>
                            {getEligibleAssignmentsForRole(plan.defaultAssigneeRole).map((assignment) => (
                              <option key={assignment._id} value={assignment.userId}>
                                {assignment.user?.name ?? "Unknown user"}
                              </option>
                            ))}
                          </select>
                        </label>
                        <button
                          className="field-button secondary w-full px-3"
                          onClick={() => void handleTogglePlan(plan)}
                          type="button"
                        >
                          {plan.isActive ? "Pause" : "Activate"}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="rounded-xl border border-border bg-slate-50 p-3">
              <h3 className="font-semibold">Upcoming Jobs (14 days)</h3>
              {jobs === undefined ? (
                <p className="text-sm text-slate-500">Loading jobs...</p>
              ) : jobs.length === 0 ? (
                <p className="text-sm text-slate-500">No upcoming jobs yet.</p>
              ) : (
                <div className="mt-2 space-y-2">
                  {jobs.slice(0, 8).map((job) => (
                    <div key={job._id} className="rounded-lg border border-border bg-white p-2">
                      <p className="text-sm font-semibold">
                        {job.jobType} | {new Date(job.scheduledStart).toLocaleString()}
                      </p>
                      <p className="text-xs text-slate-600">
                        {job.status} {job.assigneeName ? `| ${job.assigneeName}` : "| Unassigned"}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          </section>
        </>
      )}
    </div>
  );
}

function AssignmentRoleSection(props: {
  roleLabel: string;
  assignments: PropertyAssignment[];
  availableUsers: AssignmentUser[];
  selectedUserId: string;
  setSelectedUserId: (value: string) => void;
  onAssign: () => void;
  onUnassign: (assignmentId: Id<"propertyAssignments">) => void;
  buttonLabel: string;
  emptyLabel: string;
  loading: boolean;
  disabled: boolean;
}) {
  const {
    roleLabel,
    assignments,
    availableUsers,
    selectedUserId,
    setSelectedUserId,
    onAssign,
    onUnassign,
    buttonLabel,
    emptyLabel,
    loading,
    disabled,
  } = props;

  return (
    <div className="rounded-xl border border-border bg-slate-50 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h4 className="font-semibold">{roleLabel}</h4>
        <span className="text-xs font-semibold text-slate-500">{assignments.length} active</span>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Loading assignments...</p>
      ) : assignments.length === 0 ? (
        <p className="text-sm text-slate-500">{emptyLabel}</p>
      ) : (
        <div className="space-y-2">
          {assignments.map((assignment) => (
            <div
              key={assignment._id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-white p-2"
            >
              <div>
                <p className="text-sm font-semibold">{assignment.user?.name ?? "Unknown user"}</p>
                <p className="text-xs text-slate-500">{assignment.user?.email ?? "No email"}</p>
              </div>
              <button
                className="field-button secondary px-3"
                disabled={disabled}
                onClick={() => onUnassign(assignment._id)}
                type="button"
              >
                Unassign
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
        <select
          className="input"
          disabled={disabled || loading || availableUsers.length === 0}
          onChange={(event) => setSelectedUserId(event.target.value)}
          value={selectedUserId}
        >
          <option value="">
            {availableUsers.length === 0 ? "No available users" : "Select a user..."}
          </option>
          {availableUsers.map((user) => (
            <option key={user._id} value={user._id}>
              {user.name} | {user.email}
            </option>
          ))}
        </select>
        <button
          className="field-button secondary px-4"
          disabled={disabled || loading || selectedUserId.length === 0}
          onClick={onAssign}
          type="button"
        >
          {buttonLabel}
        </button>
      </div>
    </div>
  );
}
