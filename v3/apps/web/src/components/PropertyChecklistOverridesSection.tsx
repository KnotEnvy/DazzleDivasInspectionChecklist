import { FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import type { Id } from "convex/_generated/dataModel";
import { api } from "convex/_generated/api";
import toast from "react-hot-toast";

type ChecklistType = "CLEANING" | "INSPECTION";
type RoomGenerationMode = "SINGLE" | "PER_BEDROOM" | "PER_BATHROOM";

type EffectiveTask = {
  key: string;
  checklistType: ChecklistType;
  description: string;
  sortOrder: number;
  requiredPhotoMin?: number;
};

type EffectiveRoom = {
  key: string;
  name: string;
  description?: string;
  sortOrder: number;
  generationMode?: RoomGenerationMode;
  isActive: boolean;
  tasks: EffectiveTask[];
};

type EffectiveTemplateLibrary = {
  source: "BASE_TEMPLATE" | "PROPERTY_OVERRIDE";
  hasOverrides: boolean;
  rooms: EffectiveRoom[];
};

type RoomFormState = {
  name: string;
  description: string;
  sortOrder: string;
  generationMode: RoomGenerationMode;
  isActive: boolean;
};

type TaskDrafts = Record<
  string,
  {
    description: string;
    sortOrder: string;
    requiredPhotoMin: string;
  }
>;

const defaultRoomForm: RoomFormState = {
  name: "",
  description: "",
  sortOrder: "1",
  generationMode: "SINGLE",
  isActive: true,
};

const roomGenerationModeOptions: Array<{
  value: RoomGenerationMode;
  label: string;
  hint: string;
}> = [
  {
    value: "SINGLE",
    label: "One room per checklist",
    hint: "Use one shared room like Kitchen, Living Room, or Entrance.",
  },
  {
    value: "PER_BEDROOM",
    label: "Repeat for each bedroom",
    hint: "Generates Bedroom 1, Bedroom 2, and so on from the property bedroom count.",
  },
  {
    value: "PER_BATHROOM",
    label: "Repeat for each bathroom",
    hint: "Generates Bathroom 1, Bathroom 2, and so on from the property bathroom count.",
  },
];

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

function generationModeLabel(mode: RoomGenerationMode) {
  return roomGenerationModeOptions.find((option) => option.value === mode)?.label ?? mode;
}

export function PropertyChecklistOverridesSection(props: {
  propertyId: Id<"properties">;
  propertyName: string;
  bedrooms?: number;
  bathrooms?: number;
  isArchived: boolean;
  bootstrapDisabled: boolean;
  onBootstrapTemplates: () => Promise<void>;
}) {
  const {
    propertyId,
    propertyName,
    bedrooms,
    bathrooms,
    isArchived,
    bootstrapDisabled,
    onBootstrapTemplates,
  } = props;

  const library = useQuery(api.templates.listEffectiveForProperty, {
    propertyId,
    includeInactive: true,
  }) as EffectiveTemplateLibrary | undefined;

  const createPropertyOverrides = useMutation(api.templates.createPropertyOverrides);
  const resetPropertyOverrides = useMutation(api.templates.resetPropertyOverrides);
  const createPropertyRoom = useMutation(api.templates.createPropertyOverrideRoom);
  const updatePropertyRoom = useMutation(api.templates.updatePropertyOverrideRoom);
  const removePropertyRoom = useMutation(api.templates.removePropertyOverrideRoom);
  const createPropertyTask = useMutation(api.templates.createPropertyOverrideTask);
  const updatePropertyTask = useMutation(api.templates.updatePropertyOverrideTask);
  const removePropertyTask = useMutation(api.templates.removePropertyOverrideTask);

  const [selectedRoomKey, setSelectedRoomKey] = useState<string | null>(null);
  const [creatingOverrideCopy, setCreatingOverrideCopy] = useState(false);
  const [resettingOverrides, setResettingOverrides] = useState(false);
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [savingRoom, setSavingRoom] = useState(false);
  const [creatingTaskType, setCreatingTaskType] = useState<ChecklistType | null>(null);
  const [savingTaskKey, setSavingTaskKey] = useState<string | null>(null);
  const [roomForm, setRoomForm] = useState<RoomFormState>(defaultRoomForm);
  const [newRoomForm, setNewRoomForm] = useState<RoomFormState>({
    ...defaultRoomForm,
    sortOrder: "10",
  });
  const [taskDrafts, setTaskDrafts] = useState<TaskDrafts>({});
  const [newTaskForm, setNewTaskForm] = useState({
    checklistType: "CLEANING" as ChecklistType,
    description: "",
    sortOrder: "1",
    requiredPhotoMin: "2",
  });

  const selectedRoom = useMemo(
    () => library?.rooms.find((room) => room.key === selectedRoomKey) ?? null,
    [library?.rooms, selectedRoomKey]
  );

  useEffect(() => {
    if (!library?.hasOverrides || library.rooms.length === 0) {
      setSelectedRoomKey(null);
      return;
    }

    if (!selectedRoomKey || !library.rooms.some((room) => room.key === selectedRoomKey)) {
      setSelectedRoomKey(library.rooms[0].key);
    }
  }, [library?.hasOverrides, library?.rooms, selectedRoomKey]);

  useEffect(() => {
    if (!selectedRoom) {
      setRoomForm(defaultRoomForm);
      setTaskDrafts({});
      return;
    }

    setRoomForm({
      name: selectedRoom.name,
      description: selectedRoom.description ?? "",
      sortOrder: String(selectedRoom.sortOrder),
      generationMode: selectedRoom.generationMode ?? "SINGLE",
      isActive: selectedRoom.isActive,
    });
    setTaskDrafts(
      Object.fromEntries(
        selectedRoom.tasks.map((task) => [
          task.key,
          {
            description: task.description,
            sortOrder: String(task.sortOrder),
            requiredPhotoMin: String(task.requiredPhotoMin ?? 2),
          },
        ])
      )
    );
    setNewTaskForm({
      checklistType: "CLEANING",
      description: "",
      sortOrder: String(
        Math.max(
          1,
          ...selectedRoom.tasks
            .filter((task) => task.checklistType === "CLEANING")
            .map((task) => task.sortOrder + 1)
        )
      ),
      requiredPhotoMin: "2",
    });
  }, [selectedRoom]);

  const groupedTasks = useMemo(() => {
    if (!selectedRoom) {
      return {
        CLEANING: [] as EffectiveTask[],
        INSPECTION: [] as EffectiveTask[],
      };
    }

    return {
      CLEANING: selectedRoom.tasks.filter((task) => task.checklistType === "CLEANING"),
      INSPECTION: selectedRoom.tasks.filter((task) => task.checklistType === "INSPECTION"),
    };
  }, [selectedRoom]);

  const preview = useMemo(() => {
    if (!library) {
      return null;
    }

    const activeRooms = library.rooms.filter((room) => room.isActive);
    const previewRooms = activeRooms.flatMap((room) =>
      deriveRoomNames({
        room,
        bedrooms,
        bathrooms,
      }).map((roomName) => ({
        key: room.key,
        roomName,
        cleaningTasks: room.tasks.filter((task) => task.checklistType === "CLEANING"),
        inspectionTasks: room.tasks.filter((task) => task.checklistType === "INSPECTION"),
      }))
    );

    return {
      CLEANING: previewRooms.filter((room) => room.cleaningTasks.length > 0),
      INSPECTION: previewRooms.filter((room) => room.inspectionTasks.length > 0),
    };
  }, [bathrooms, bedrooms, library]);

  async function handleCreateOverrideCopy() {
    setCreatingOverrideCopy(true);
    try {
      const result = await createPropertyOverrides({ propertyId });
      toast.success(`Created ${result.roomsCopied} property override room(s)`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create property overrides"
      );
    } finally {
      setCreatingOverrideCopy(false);
    }
  }

  async function handleResetOverrides() {
    setResettingOverrides(true);
    try {
      await resetPropertyOverrides({ propertyId });
      toast.success("Property checklist reset to the base template");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to reset property overrides"
      );
    } finally {
      setResettingOverrides(false);
    }
  }

  async function handleCreateRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const sortOrder = Number(newRoomForm.sortOrder);
    if (!Number.isFinite(sortOrder)) {
      toast.error("Room sort order must be a number");
      return;
    }

    setCreatingRoom(true);
    try {
      const roomKey = await createPropertyRoom({
        propertyId,
        name: newRoomForm.name.trim(),
        description: newRoomForm.description.trim() || undefined,
        sortOrder,
        generationMode: newRoomForm.generationMode,
      });
      setSelectedRoomKey(roomKey);
      setNewRoomForm({
        ...defaultRoomForm,
        sortOrder: String(sortOrder + 10),
      });
      toast.success("Property room created");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create property room");
    } finally {
      setCreatingRoom(false);
    }
  }

  async function handleSaveRoom() {
    if (!selectedRoom) {
      return;
    }

    const sortOrder = Number(roomForm.sortOrder);
    if (!Number.isFinite(sortOrder)) {
      toast.error("Room sort order must be a number");
      return;
    }

    setSavingRoom(true);
    try {
      await updatePropertyRoom({
        propertyId,
        roomKey: selectedRoom.key,
        name: roomForm.name.trim(),
        description: roomForm.description.trim() || undefined,
        sortOrder,
        generationMode: roomForm.generationMode,
        isActive: roomForm.isActive,
      });
      toast.success("Property room updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save property room");
    } finally {
      setSavingRoom(false);
    }
  }

  async function handleRemoveRoom() {
    if (!selectedRoom) {
      return;
    }

    setSavingRoom(true);
    try {
      await removePropertyRoom({
        propertyId,
        roomKey: selectedRoom.key,
      });
      toast.success("Property room removed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to remove property room");
    } finally {
      setSavingRoom(false);
    }
  }

  async function handleCreateTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedRoom) {
      return;
    }

    const sortOrder = Number(newTaskForm.sortOrder);
    const requiredPhotoMin = Number(newTaskForm.requiredPhotoMin);
    if (!Number.isFinite(sortOrder) || !Number.isFinite(requiredPhotoMin)) {
      toast.error("Task sort order and photo minimum must be numbers");
      return;
    }

    setCreatingTaskType(newTaskForm.checklistType);
    try {
      await createPropertyTask({
        propertyId,
        roomKey: selectedRoom.key,
        checklistType: newTaskForm.checklistType,
        description: newTaskForm.description.trim(),
        sortOrder,
        requiredPhotoMin,
      });
      setNewTaskForm((current) => ({
        ...current,
        description: "",
        sortOrder: String(sortOrder + 1),
      }));
      toast.success("Property task created");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create property task");
    } finally {
      setCreatingTaskType(null);
    }
  }

  async function handleSaveTask(taskKey: string) {
    if (!selectedRoom) {
      return;
    }

    const draft = taskDrafts[taskKey];
    if (!draft) {
      return;
    }

    const sortOrder = Number(draft.sortOrder);
    const requiredPhotoMin = Number(draft.requiredPhotoMin);
    if (!Number.isFinite(sortOrder) || !Number.isFinite(requiredPhotoMin)) {
      toast.error("Task sort order and photo minimum must be numbers");
      return;
    }

    setSavingTaskKey(taskKey);
    try {
      await updatePropertyTask({
        propertyId,
        roomKey: selectedRoom.key,
        taskKey,
        description: draft.description.trim(),
        sortOrder,
        requiredPhotoMin,
      });
      toast.success("Property task updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save property task");
    } finally {
      setSavingTaskKey(null);
    }
  }

  async function handleRemoveTask(taskKey: string) {
    if (!selectedRoom) {
      return;
    }

    setSavingTaskKey(taskKey);
    try {
      await removePropertyTask({
        propertyId,
        roomKey: selectedRoom.key,
        taskKey,
      });
      toast.success("Property task removed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to remove property task");
    } finally {
      setSavingTaskKey(null);
    }
  }

  const previewSourceLabel =
    library?.source === "PROPERTY_OVERRIDE" ? "Property-specific override" : "Base template";
  const editingLocked =
    isArchived ||
    creatingOverrideCopy ||
    resettingOverrides ||
    creatingRoom ||
    savingRoom ||
    creatingTaskType !== null ||
    savingTaskKey !== null;

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-border bg-white p-4">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">Checklist Preview</h2>
            <p className="text-sm text-slate-600">
              This property now previews its effective checklist library, using property overrides
              when they exist and the shared base template otherwise.
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">
              {previewSourceLabel}
            </p>
            <p className="text-xs font-semibold text-slate-500">
              Using {bedrooms ?? 1} bedroom(s) and {bathrooms ?? 1} bathroom(s)
            </p>
          </div>
        </div>

        {library === undefined || preview === null ? (
          <p className="text-sm text-slate-500">Loading checklist preview...</p>
        ) : library.rooms.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-700">
              No checklist template rooms exist yet.
            </p>
            <p className="mt-1 text-sm text-slate-600">
              Create the starter room library first, then this property can branch into its own
              private override copy.
            </p>
            <button
              className="field-button primary mt-3 px-4"
              disabled={bootstrapDisabled}
              onClick={() => void onBootstrapTemplates()}
              type="button"
            >
              Create Starter Templates
            </button>
          </div>
        ) : library.rooms.every((room) => room.isActive !== true) ? (
          <div className="rounded-xl border border-dashed border-border bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-700">
              All effective rooms are inactive for this property.
            </p>
            <p className="mt-1 text-sm text-slate-600">
              Reactivate at least one room before workers start new checklists here.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {(["CLEANING", "INSPECTION"] as ChecklistType[]).map((checklistType) => (
              <div
                key={checklistType}
                className="rounded-xl border border-border bg-slate-50 p-3"
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h3 className="font-semibold">{checklistType} Checklist</h3>
                  <span className="text-xs font-semibold text-slate-500">
                    {preview[checklistType].length} rooms
                  </span>
                </div>

                {preview[checklistType].length === 0 ? (
                  <p className="text-sm text-slate-500">
                    No {checklistType.toLowerCase()} rooms are active for this property.
                  </p>
                ) : (
                  <div className="grid gap-2 xl:grid-cols-2">
                    {preview[checklistType].map((room) => {
                      const tasks =
                        checklistType === "CLEANING" ? room.cleaningTasks : room.inspectionTasks;

                      return (
                        <div
                          key={`${checklistType}-${room.key}-${room.roomName}`}
                          className="rounded-lg border border-border bg-white p-2"
                        >
                          <p className="text-sm font-semibold">{room.roomName}</p>
                          <p className="text-xs text-slate-500">
                            {tasks.length} tasks | Photos required:{" "}
                            {Math.max(2, ...tasks.map((task) => task.requiredPhotoMin ?? 0))}
                          </p>
                          <ul className="mt-2 space-y-1 text-xs text-slate-600">
                            {tasks.map((task) => (
                              <li key={task.key}>- {task.description}</li>
                            ))}
                          </ul>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-white p-4">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">Property Checklist Overrides</h2>
            <p className="text-sm text-slate-600">
              Clone the shared template into a private copy for this property, then customize room
              order, room generation, activation, and task content without affecting other homes.
            </p>
          </div>
          {library?.hasOverrides ? (
            <button
              className="field-button secondary px-4"
              disabled={editingLocked}
              onClick={() => void handleResetOverrides()}
              type="button"
            >
              {resettingOverrides ? "Resetting..." : "Reset To Base Template"}
            </button>
          ) : null}
        </div>

        {isArchived && (
          <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            This property is archived. Override edits are disabled until it is restored.
          </div>
        )}

        {library === undefined ? (
          <p className="text-sm text-slate-500">Loading property override editor...</p>
        ) : !library.hasOverrides ? (
          <div className="rounded-2xl border border-dashed border-border bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-700">
              {library.rooms.length === 0
                ? "No base checklist library exists yet."
                : "This property is still following the shared base template."}
            </p>
            <p className="mt-1 text-sm text-slate-600">
              {library.rooms.length === 0
                ? "Create the starter room library first, then branch into property-specific standards."
                : "Create a property override copy to customize one property without changing the global checklist manager."}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {library.rooms.length === 0 ? (
                <button
                  className="field-button primary px-4"
                  disabled={bootstrapDisabled}
                  onClick={() => void onBootstrapTemplates()}
                  type="button"
                >
                  Create Starter Templates
                </button>
              ) : (
                <button
                  className="field-button primary px-4"
                  disabled={editingLocked}
                  onClick={() => void handleCreateOverrideCopy()}
                  type="button"
                >
                  {creatingOverrideCopy ? "Creating..." : "Create Property Override Copy"}
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
            <aside className="space-y-4 rounded-2xl border border-border bg-slate-50 p-4">
              <div>
                <h3 className="text-lg font-bold">Override Rooms</h3>
                <p className="text-sm text-slate-600">
                  These rooms only affect {propertyName}.
                </p>
              </div>

              <form
                className="space-y-3 rounded-2xl border border-border bg-white p-3"
                onSubmit={handleCreateRoom}
              >
                <h4 className="font-semibold">Add Property Room</h4>
                <label className="block text-sm font-medium text-slate-700">
                  Room name
                  <input
                    className="input mt-1"
                    onChange={(event) =>
                      setNewRoomForm((current) => ({ ...current, name: event.target.value }))
                    }
                    required
                    value={newRoomForm.name}
                  />
                </label>
                <label className="block text-sm font-medium text-slate-700">
                  Description
                  <textarea
                    className="input mt-1 min-h-20"
                    onChange={(event) =>
                      setNewRoomForm((current) => ({
                        ...current,
                        description: event.target.value,
                      }))
                    }
                    value={newRoomForm.description}
                  />
                </label>
                <label className="block text-sm font-medium text-slate-700">
                  Sort order
                  <input
                    className="input mt-1"
                    onChange={(event) =>
                      setNewRoomForm((current) => ({ ...current, sortOrder: event.target.value }))
                    }
                    type="number"
                    value={newRoomForm.sortOrder}
                  />
                </label>
                <label className="block text-sm font-medium text-slate-700">
                  Generation mode
                  <select
                    className="input mt-1"
                    onChange={(event) =>
                      setNewRoomForm((current) => ({
                        ...current,
                        generationMode: event.target.value as RoomGenerationMode,
                      }))
                    }
                    value={newRoomForm.generationMode}
                  >
                    {roomGenerationModeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <span className="mt-1 block text-xs text-slate-500">
                    {
                      roomGenerationModeOptions.find(
                        (option) => option.value === newRoomForm.generationMode
                      )?.hint
                    }
                  </span>
                </label>
                <button
                  className="field-button primary w-full px-4"
                  disabled={editingLocked}
                  type="submit"
                >
                  {creatingRoom ? "Creating..." : "Create Property Room"}
                </button>
              </form>

              <div className="space-y-2">
                {library.rooms.map((room) => (
                  <button
                    key={room.key}
                    className={`w-full rounded-2xl border p-3 text-left transition ${
                      selectedRoomKey === room.key
                        ? "border-brand-500 bg-brand-50"
                        : "border-border bg-white hover:border-brand-300"
                    }`}
                    onClick={() => setSelectedRoomKey(room.key)}
                    type="button"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold">{room.name}</p>
                        <p className="text-xs text-slate-500">
                          Sort {room.sortOrder} | {generationModeLabel(room.generationMode ?? "SINGLE")} |{" "}
                          {room.tasks.length} tasks
                        </p>
                      </div>
                      <span className="rounded-full border border-border px-2 py-1 text-[11px] font-semibold text-slate-600">
                        {room.isActive ? "ACTIVE" : "INACTIVE"}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </aside>

            <section className="space-y-4">
              {!selectedRoom ? (
                <div className="rounded-2xl border border-border bg-slate-50 p-6 text-sm text-slate-500">
                  Select a property room to edit its room rules and tasks.
                </div>
              ) : (
                <>
                  <section className="rounded-2xl border border-border bg-slate-50 p-4">
                    <div className="mb-3">
                      <h3 className="text-lg font-bold">Room Override Detail</h3>
                      <p className="text-sm text-slate-600">
                        Update room metadata and activation for this property only.
                      </p>
                    </div>

                    <div className="grid gap-3 lg:grid-cols-2">
                      <label className="block text-sm font-medium text-slate-700">
                        Room name
                        <input
                          className="input mt-1"
                          onChange={(event) =>
                            setRoomForm((current) => ({ ...current, name: event.target.value }))
                          }
                          value={roomForm.name}
                        />
                      </label>
                      <label className="block text-sm font-medium text-slate-700">
                        Sort order
                        <input
                          className="input mt-1"
                          onChange={(event) =>
                            setRoomForm((current) => ({
                              ...current,
                              sortOrder: event.target.value,
                            }))
                          }
                          type="number"
                          value={roomForm.sortOrder}
                        />
                      </label>
                      <label className="block text-sm font-medium text-slate-700 lg:col-span-2">
                        Generation mode
                        <select
                          className="input mt-1"
                          onChange={(event) =>
                            setRoomForm((current) => ({
                              ...current,
                              generationMode: event.target.value as RoomGenerationMode,
                            }))
                          }
                          value={roomForm.generationMode}
                        >
                          {roomGenerationModeOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        <span className="mt-1 block text-xs text-slate-500">
                          {
                            roomGenerationModeOptions.find(
                              (option) => option.value === roomForm.generationMode
                            )?.hint
                          }
                        </span>
                      </label>
                    </div>
                    <label className="mt-3 block text-sm font-medium text-slate-700">
                      Description
                      <textarea
                        className="input mt-1 min-h-24"
                        onChange={(event) =>
                          setRoomForm((current) => ({
                            ...current,
                            description: event.target.value,
                          }))
                        }
                        value={roomForm.description}
                      />
                    </label>
                    <label className="mt-3 flex items-center gap-2 text-sm font-medium text-slate-700">
                      <input
                        checked={roomForm.isActive}
                        onChange={(event) =>
                          setRoomForm((current) => ({
                            ...current,
                            isActive: event.target.checked,
                          }))
                        }
                        type="checkbox"
                      />
                      Room active in future checklists
                    </label>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        className="field-button primary px-4"
                        disabled={editingLocked}
                        onClick={() => void handleSaveRoom()}
                        type="button"
                      >
                        {savingRoom ? "Saving..." : "Save Room"}
                      </button>
                      <button
                        className="field-button secondary px-4"
                        disabled={editingLocked}
                        onClick={() => void handleRemoveRoom()}
                        type="button"
                      >
                        {savingRoom ? "Removing..." : "Remove Room"}
                      </button>
                    </div>
                  </section>

                  <section className="rounded-2xl border border-border bg-slate-50 p-4">
                    <div className="mb-3">
                      <h3 className="text-lg font-bold">Add Property Task</h3>
                      <p className="text-sm text-slate-600">
                        Add tasks that only belong to this property's checklist standard.
                      </p>
                    </div>

                    <form className="grid gap-3 lg:grid-cols-4" onSubmit={handleCreateTask}>
                      <label className="block text-sm font-medium text-slate-700">
                        Checklist type
                        <select
                          className="input mt-1"
                          onChange={(event) =>
                            setNewTaskForm((current) => ({
                              ...current,
                              checklistType: event.target.value as ChecklistType,
                            }))
                          }
                          value={newTaskForm.checklistType}
                        >
                          <option value="CLEANING">CLEANING</option>
                          <option value="INSPECTION">INSPECTION</option>
                        </select>
                      </label>
                      <label className="block text-sm font-medium text-slate-700 lg:col-span-2">
                        Task description
                        <input
                          className="input mt-1"
                          onChange={(event) =>
                            setNewTaskForm((current) => ({
                              ...current,
                              description: event.target.value,
                            }))
                          }
                          required
                          value={newTaskForm.description}
                        />
                      </label>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="block text-sm font-medium text-slate-700">
                          Sort
                          <input
                            className="input mt-1"
                            onChange={(event) =>
                              setNewTaskForm((current) => ({
                                ...current,
                                sortOrder: event.target.value,
                              }))
                            }
                            type="number"
                            value={newTaskForm.sortOrder}
                          />
                        </label>
                        <label className="block text-sm font-medium text-slate-700">
                          Photos
                          <input
                            className="input mt-1"
                            onChange={(event) =>
                              setNewTaskForm((current) => ({
                                ...current,
                                requiredPhotoMin: event.target.value,
                              }))
                            }
                            type="number"
                            value={newTaskForm.requiredPhotoMin}
                          />
                        </label>
                      </div>
                      <div className="lg:col-span-4">
                        <button
                          className="field-button primary px-4"
                          disabled={editingLocked}
                          type="submit"
                        >
                          {creatingTaskType
                            ? `Adding ${creatingTaskType} Task...`
                            : "Add Property Task"}
                        </button>
                      </div>
                    </form>
                  </section>

                  <div className="grid gap-4 xl:grid-cols-2">
                    {(["CLEANING", "INSPECTION"] as ChecklistType[]).map((type) => (
                      <section
                        key={type}
                        className="rounded-2xl border border-border bg-slate-50 p-4"
                      >
                        <div className="mb-3">
                          <h3 className="text-lg font-bold">{type} Tasks</h3>
                          <p className="text-sm text-slate-600">
                            These tasks appear only for this property's {type.toLowerCase()}{" "}
                            checklists in the selected room.
                          </p>
                        </div>

                        {groupedTasks[type].length === 0 ? (
                          <p className="text-sm text-slate-500">
                            No {type.toLowerCase()} tasks yet.
                          </p>
                        ) : (
                          <div className="space-y-3">
                            {groupedTasks[type].map((task) => {
                              const draft = taskDrafts[task.key];
                              return (
                                <div
                                  key={task.key}
                                  className="rounded-2xl border border-border bg-white p-3"
                                >
                                  <label className="block text-sm font-medium text-slate-700">
                                    Description
                                    <input
                                      className="input mt-1"
                                      onChange={(event) =>
                                        setTaskDrafts((current) => ({
                                          ...current,
                                          [task.key]: {
                                            ...current[task.key],
                                            description: event.target.value,
                                          },
                                        }))
                                      }
                                      value={draft?.description ?? ""}
                                    />
                                  </label>
                                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                    <label className="block text-sm font-medium text-slate-700">
                                      Sort order
                                      <input
                                        className="input mt-1"
                                        onChange={(event) =>
                                          setTaskDrafts((current) => ({
                                            ...current,
                                            [task.key]: {
                                              ...current[task.key],
                                              sortOrder: event.target.value,
                                            },
                                          }))
                                        }
                                        type="number"
                                        value={draft?.sortOrder ?? ""}
                                      />
                                    </label>
                                    <label className="block text-sm font-medium text-slate-700">
                                      Required photos
                                      <input
                                        className="input mt-1"
                                        onChange={(event) =>
                                          setTaskDrafts((current) => ({
                                            ...current,
                                            [task.key]: {
                                              ...current[task.key],
                                              requiredPhotoMin: event.target.value,
                                            },
                                          }))
                                        }
                                        type="number"
                                        value={draft?.requiredPhotoMin ?? ""}
                                      />
                                    </label>
                                  </div>
                                  <div className="mt-3 flex flex-wrap gap-2">
                                    <button
                                      className="field-button primary px-4"
                                      disabled={editingLocked}
                                      onClick={() => void handleSaveTask(task.key)}
                                      type="button"
                                    >
                                      {savingTaskKey === task.key ? "Saving..." : "Save Task"}
                                    </button>
                                    <button
                                      className="field-button secondary px-4"
                                      disabled={editingLocked}
                                      onClick={() => void handleRemoveTask(task.key)}
                                      type="button"
                                    >
                                      {savingTaskKey === task.key ? "Removing..." : "Remove Task"}
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </section>
                    ))}
                  </div>
                </>
              )}
            </section>
          </div>
        )}
      </section>
    </div>
  );
}
