import { useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { cn } from "@/components/ui/utils";
import { CheckCircle, Circle } from "lucide-react";

interface TaskItem {
  _id: Id<"taskResults">;
  taskDescription: string;
  completed: boolean;
}

interface TaskChecklistProps {
  tasks: TaskItem[];
  disabled?: boolean;
}

export function TaskChecklist({ tasks, disabled }: TaskChecklistProps) {
  const toggleTask = useMutation(api.taskResults.toggle);

  async function handleToggle(taskResultId: Id<"taskResults">) {
    if (disabled) return;
    await toggleTask({ taskResultId });
  }

  const completed = tasks.filter((t) => t.completed).length;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">Tasks</h3>
        <span className="text-xs text-muted">
          {completed}/{tasks.length} completed
        </span>
      </div>
      {tasks.map((task) => (
        <button
          key={task._id}
          onClick={() => handleToggle(task._id)}
          disabled={disabled}
          className={cn(
            "flex w-full items-start gap-3 rounded-lg p-3 text-left transition-colors",
            task.completed
              ? "bg-emerald-50/70"
              : "bg-white hover:bg-gray-50",
            disabled && "cursor-default opacity-70"
          )}
        >
          {task.completed ? (
            <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
          ) : (
            <Circle className="mt-0.5 h-5 w-5 shrink-0 text-gray-300" />
          )}
          <span
            className={cn(
              "text-sm",
              task.completed && "text-muted line-through"
            )}
          >
            {task.taskDescription}
          </span>
        </button>
      ))}
    </div>
  );
}
