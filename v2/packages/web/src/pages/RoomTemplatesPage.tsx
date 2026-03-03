import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { Card, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Spinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  DoorOpen,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  GripVertical,
} from "lucide-react";
import toast from "react-hot-toast";

export function RoomTemplatesPage() {
  const roomsWithTasks = useQuery(api.rooms.listWithTasks);
  const createRoom = useMutation(api.rooms.create);
  const removeRoom = useMutation(api.rooms.remove);
  const createTask = useMutation(api.rooms.createTask);
  const removeTask = useMutation(api.rooms.removeTask);

  const [expandedRoom, setExpandedRoom] = useState<Id<"rooms"> | null>(null);
  const [showAddRoom, setShowAddRoom] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [addingTaskRoom, setAddingTaskRoom] = useState<Id<"rooms"> | null>(null);
  const [newTaskDesc, setNewTaskDesc] = useState("");
  const [saving, setSaving] = useState(false);

  if (!roomsWithTasks) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  async function handleAddRoom() {
    if (!newRoomName.trim()) return;
    setSaving(true);
    try {
      await createRoom({
        name: newRoomName.trim(),
        sortOrder: roomsWithTasks!.length + 1,
      });
      setNewRoomName("");
      setShowAddRoom(false);
      toast.success("Room template created");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create room");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteRoom(roomId: Id<"rooms">) {
    if (!confirm("Delete this room and all its tasks?")) return;
    try {
      await removeRoom({ roomId });
      toast.success("Room deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete room");
    }
  }

  async function handleAddTask(roomId: Id<"rooms">, taskCount: number) {
    if (!newTaskDesc.trim()) return;
    setSaving(true);
    try {
      await createTask({
        roomId,
        description: newTaskDesc.trim(),
        sortOrder: taskCount + 1,
      });
      setNewTaskDesc("");
      setAddingTaskRoom(null);
      toast.success("Task added");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add task");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteTask(taskId: Id<"tasks">) {
    try {
      await removeTask({ taskId });
      toast.success("Task deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete task");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Room Templates</h1>
        <Button size="sm" onClick={() => setShowAddRoom(true)}>
          <Plus className="h-4 w-4" />
          Add Room
        </Button>
      </div>

      {roomsWithTasks.length === 0 ? (
        <EmptyState
          icon={<DoorOpen className="h-10 w-10" />}
          title="No room templates"
          description="Create room templates to define the inspection checklist."
        />
      ) : (
        <div className="space-y-3">
          {roomsWithTasks.map((room) => {
            const isExpanded = expandedRoom === room._id;
            return (
              <Card key={room._id} className="p-0 overflow-hidden">
                {/* Room header */}
                <button
                  onClick={() =>
                    setExpandedRoom(isExpanded ? null : room._id)
                  }
                  className="flex w-full items-center justify-between p-4 text-left hover:bg-gray-50"
                >
                  <div className="flex items-center gap-3">
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-muted" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted" />
                    )}
                    <div>
                      <p className="text-sm font-semibold">{room.name}</p>
                      <p className="text-xs text-muted">
                        {room.tasks.length} task{room.tasks.length !== 1 && "s"}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteRoom(room._id);
                    }}
                    className="rounded-md p-1.5 text-muted hover:bg-red-50 hover:text-danger"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </button>

                {/* Tasks */}
                {isExpanded && (
                  <div className="border-t border-border bg-gray-50/50 px-4 pb-4">
                    <div className="divide-y divide-border">
                      {room.tasks.map((task) => (
                        <div
                          key={task._id}
                          className="flex items-center justify-between py-2.5"
                        >
                          <p className="text-sm text-foreground pl-7">
                            {task.description}
                          </p>
                          <button
                            onClick={() => handleDeleteTask(task._id)}
                            className="rounded p-1 text-muted hover:text-danger"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* Add task */}
                    {addingTaskRoom === room._id ? (
                      <div className="mt-3 flex items-end gap-2 pl-7">
                        <div className="flex-1">
                          <Input
                            value={newTaskDesc}
                            onChange={(e) => setNewTaskDesc(e.target.value)}
                            placeholder="Task description..."
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleAddTask(room._id, room.tasks.length);
                              }
                            }}
                          />
                        </div>
                        <Button
                          size="sm"
                          onClick={() =>
                            handleAddTask(room._id, room.tasks.length)
                          }
                          loading={saving}
                        >
                          Add
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setAddingTaskRoom(null);
                            setNewTaskDesc("");
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setAddingTaskRoom(room._id)}
                        className="mt-3 flex items-center gap-1 pl-7 text-sm text-primary-500 hover:text-primary-600"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add task
                      </button>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Add room modal */}
      <Modal
        open={showAddRoom}
        onClose={() => {
          setShowAddRoom(false);
          setNewRoomName("");
        }}
        title="New Room Template"
      >
        <div className="space-y-4">
          <Input
            label="Room Name"
            value={newRoomName}
            onChange={(e) => setNewRoomName(e.target.value)}
            placeholder="e.g. Bathroom 2"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddRoom();
              }
            }}
          />
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setShowAddRoom(false);
                setNewRoomName("");
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleAddRoom} loading={saving}>
              Create Room
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
