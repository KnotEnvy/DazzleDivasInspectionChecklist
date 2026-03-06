import { FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import type { Id } from "convex/_generated/dataModel";
import { api } from "convex/_generated/api";
import toast from "react-hot-toast";

type ChecklistType = "CLEANING" | "INSPECTION";
type RoomGenerationMode = "SINGLE" | "PER_BEDROOM" | "PER_BATHROOM";

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

function generationModeLabel(mode: RoomGenerationMode) {
  return roomGenerationModeOptions.find((option) => option.value === mode)?.label ?? mode;
}

export function AdminTemplatesPage() {
  const rooms = useQuery(api.templates.listWithTasks, {
    includeInactive: true,
  }) as TemplateRoom[] | undefined;
  const createRoom = useMutation(api.templates.createRoom);
  const updateRoom = useMutation(api.templates.updateRoom);
  const removeRoom = useMutation(api.templates.removeRoom);
  const bootstrapStarterTemplates = useMutation(api.templates.bootstrapStarterTemplates);
  const createTask = useMutation(api.templates.createTask);
  const updateTask = useMutation(api.templates.updateTask);
  const removeTask = useMutation(api.templates.removeTask);

  const [selectedRoomId, setSelectedRoomId] = useState<Id<"rooms"> | null>(null);
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [savingRoom, setSavingRoom] = useState(false);
  const [savingTaskId, setSavingTaskId] = useState<Id<"tasks"> | null>(null);
  const [creatingTaskType, setCreatingTaskType] = useState<ChecklistType | null>(null);
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

  const selectedRoom = useMemo(() => {
    return (rooms ?? []).find((room) => room._id === selectedRoomId) ?? null;
  }, [rooms, selectedRoomId]);

  useEffect(() => {
    if (!rooms || rooms.length === 0) {
      setSelectedRoomId(null);
      return;
    }

    if (!selectedRoomId || !rooms.some((room) => room._id === selectedRoomId)) {
      setSelectedRoomId(rooms[0]._id);
    }
  }, [rooms, selectedRoomId]);

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
          task._id,
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
    const room = selectedRoom;
    if (!room) {
      return {
        CLEANING: [] as TemplateTask[],
        INSPECTION: [] as TemplateTask[],
      };
    }

    return {
      CLEANING: room.tasks.filter((task) => task.checklistType === "CLEANING"),
      INSPECTION: room.tasks.filter((task) => task.checklistType === "INSPECTION"),
    };
  }, [selectedRoom]);

  async function handleCreateRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const sortOrder = Number(newRoomForm.sortOrder);
    if (!Number.isFinite(sortOrder)) {
      toast.error("Room sort order must be a number");
      return;
    }

    setCreatingRoom(true);
    try {
      const roomId = await createRoom({
        name: newRoomForm.name.trim(),
        description: newRoomForm.description.trim() || undefined,
        sortOrder,
        generationMode: newRoomForm.generationMode,
      });
      setNewRoomForm({
        ...defaultRoomForm,
        sortOrder: String(sortOrder + 10),
      });
      setSelectedRoomId(roomId);
      toast.success("Room template created");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create room");
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
      await updateRoom({
        roomId: selectedRoom._id,
        name: roomForm.name.trim(),
        description: roomForm.description.trim() || undefined,
        sortOrder,
        generationMode: roomForm.generationMode,
        isActive: roomForm.isActive,
      });
      toast.success("Room template updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save room");
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
      await removeRoom({ roomId: selectedRoom._id });
      toast.success("Room template removed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to remove room");
    } finally {
      setSavingRoom(false);
    }
  }

  async function handleSaveTask(taskId: Id<"tasks">) {
    const draft = taskDrafts[taskId];
    if (!draft) {
      return;
    }

    const sortOrder = Number(draft.sortOrder);
    const requiredPhotoMin = Number(draft.requiredPhotoMin);
    if (!Number.isFinite(sortOrder) || !Number.isFinite(requiredPhotoMin)) {
      toast.error("Task sort order and photo minimum must be numbers");
      return;
    }

    setSavingTaskId(taskId);
    try {
      await updateTask({
        taskId,
        description: draft.description.trim(),
        sortOrder,
        requiredPhotoMin,
      });
      toast.success("Task updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update task");
    } finally {
      setSavingTaskId(null);
    }
  }

  async function handleRemoveTask(taskId: Id<"tasks">) {
    setSavingTaskId(taskId);
    try {
      await removeTask({ taskId });
      toast.success("Task removed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to remove task");
    } finally {
      setSavingTaskId(null);
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
      await createTask({
        roomId: selectedRoom._id,
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
      toast.success("Task added");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add task");
    } finally {
      setCreatingTaskType(null);
    }
  }

  async function handleBootstrapTemplates() {
    setCreatingRoom(true);
    try {
      const result = await bootstrapStarterTemplates({});
      toast.success(`Created ${result.roomsCreated} starter room templates`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create starter templates"
      );
    } finally {
      setCreatingRoom(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Checklist Templates</h1>
        <p className="text-sm text-slate-600">
          Manage the base room and task library. Bedroom and bathroom templates can expand per
          property based on that property's room counts.
        </p>
      </div>

      <section className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="space-y-4 rounded-2xl border border-border bg-white p-4">
          <div>
            <h2 className="text-lg font-bold">Rooms</h2>
            <p className="text-sm text-slate-600">
              These room templates drive what workers see inside each checklist.
            </p>
          </div>

          <form className="space-y-3 rounded-2xl border border-border bg-slate-50 p-3" onSubmit={handleCreateRoom}>
            <h3 className="font-semibold">Add Room Template</h3>
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
                  setNewRoomForm((current) => ({ ...current, description: event.target.value }))
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
            <button className="field-button primary w-full px-4" disabled={creatingRoom} type="submit">
              {creatingRoom ? "Creating..." : "Create Room"}
            </button>
          </form>

          {rooms === undefined ? (
            <p className="text-sm text-slate-500">Loading room templates...</p>
          ) : rooms.length === 0 ? (
            <div className="space-y-3 rounded-2xl border border-dashed border-border bg-slate-50 p-3">
              <p className="text-sm text-slate-500">No room templates exist yet.</p>
              <button
                className="field-button primary w-full px-4"
                disabled={creatingRoom}
                onClick={() => void handleBootstrapTemplates()}
                type="button"
              >
                {creatingRoom ? "Creating..." : "Create Starter Templates"}
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {rooms.map((room) => (
                <button
                  key={room._id}
                  className={`w-full rounded-2xl border p-3 text-left transition ${
                    selectedRoomId === room._id
                      ? "border-brand-500 bg-brand-50"
                      : "border-border bg-slate-50 hover:border-brand-300"
                  }`}
                  onClick={() => setSelectedRoomId(room._id)}
                  type="button"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{room.name}</p>
                      <p className="text-xs text-slate-500">
                        Sort {room.sortOrder} | {generationModeLabel(room.generationMode ?? "SINGLE")} |{" "}
                        {room.tasks.length} total tasks
                      </p>
                    </div>
                    <span className="rounded-full border border-border px-2 py-1 text-[11px] font-semibold text-slate-600">
                      {room.isActive ? "ACTIVE" : "INACTIVE"}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </aside>

        <section className="space-y-4">
          {!selectedRoom ? (
            <div className="rounded-2xl border border-border bg-white p-6 text-sm text-slate-500">
              Select a room template to review and edit the actual task content used in checklists.
            </div>
          ) : (
            <>
              <section className="rounded-2xl border border-border bg-white p-4">
                <div className="mb-3">
                  <h2 className="text-lg font-bold">Room Template Detail</h2>
                  <p className="text-sm text-slate-600">
                    Update room metadata and activation state here.
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
                        setRoomForm((current) => ({ ...current, sortOrder: event.target.value }))
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
                      setRoomForm((current) => ({ ...current, description: event.target.value }))
                    }
                    value={roomForm.description}
                  />
                </label>
                <label className="mt-3 flex items-center gap-2 text-sm font-medium text-slate-700">
                  <input
                    checked={roomForm.isActive}
                    onChange={(event) =>
                      setRoomForm((current) => ({ ...current, isActive: event.target.checked }))
                    }
                    type="checkbox"
                  />
                  Room active in future checklists
                </label>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    className="field-button primary px-4"
                    disabled={savingRoom}
                    onClick={() => void handleSaveRoom()}
                    type="button"
                  >
                    {savingRoom ? "Saving..." : "Save Room"}
                  </button>
                  <button
                    className="field-button secondary px-4"
                    disabled={savingRoom}
                    onClick={() => void handleRemoveRoom()}
                    type="button"
                  >
                    Remove Room
                  </button>
                </div>
              </section>

              <section className="rounded-2xl border border-border bg-white p-4">
                <div className="mb-3">
                  <h2 className="text-lg font-bold">Add Task</h2>
                  <p className="text-sm text-slate-600">
                    Add cleaning or inspection tasks that workers must complete inside this room.
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
                      disabled={creatingTaskType !== null}
                      type="submit"
                    >
                      {creatingTaskType ? `Adding ${creatingTaskType} Task...` : "Add Task"}
                    </button>
                  </div>
                </form>
              </section>

              <div className="grid gap-4 xl:grid-cols-2">
                {(["CLEANING", "INSPECTION"] as ChecklistType[]).map((type) => (
                  <section key={type} className="rounded-2xl border border-border bg-white p-4">
                    <div className="mb-3">
                      <h2 className="text-lg font-bold">{type} Tasks</h2>
                      <p className="text-sm text-slate-600">
                        These tasks appear for {type.toLowerCase()} checklists in this room.
                      </p>
                    </div>

                    {groupedTasks[type].length === 0 ? (
                      <p className="text-sm text-slate-500">No {type.toLowerCase()} tasks yet.</p>
                    ) : (
                      <div className="space-y-3">
                        {groupedTasks[type].map((task) => {
                          const draft = taskDrafts[task._id];
                          return (
                            <div key={task._id} className="rounded-2xl border border-border bg-slate-50 p-3">
                              <label className="block text-sm font-medium text-slate-700">
                                Description
                                <input
                                  className="input mt-1"
                                  onChange={(event) =>
                                    setTaskDrafts((current) => ({
                                      ...current,
                                      [task._id]: {
                                        ...current[task._id],
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
                                        [task._id]: {
                                          ...current[task._id],
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
                                        [task._id]: {
                                          ...current[task._id],
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
                                  disabled={savingTaskId === task._id}
                                  onClick={() => void handleSaveTask(task._id)}
                                  type="button"
                                >
                                  {savingTaskId === task._id ? "Saving..." : "Save Task"}
                                </button>
                                <button
                                  className="field-button secondary px-4"
                                  disabled={savingTaskId === task._id}
                                  onClick={() => void handleRemoveTask(task._id)}
                                  type="button"
                                >
                                  Remove Task
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
      </section>
    </div>
  );
}
