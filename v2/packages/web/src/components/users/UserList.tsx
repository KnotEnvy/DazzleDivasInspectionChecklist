import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { Users, ChevronRight } from "lucide-react";
import type { Id } from "convex/_generated/dataModel";

interface UserListProps {
  onSelect: (userId: Id<"users">) => void;
}

export function UserList({ onSelect }: UserListProps) {
  const users = useQuery(api.users.list);

  if (!users) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <EmptyState
        icon={<Users className="h-10 w-10" />}
        title="No users found"
      />
    );
  }

  return (
    <div className="divide-y divide-border rounded-xl border border-border bg-surface">
      {users.map((user) => (
        <button
          key={user._id}
          onClick={() => onSelect(user._id)}
          className="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-gray-50"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-100 text-sm font-medium text-primary-700">
              {user.name
                .split(" ")
                .map((p) => p[0])
                .join("")
                .slice(0, 2)}
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">{user.name}</p>
              <p className="text-xs text-muted">{user.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!user.isActive && (
              <Badge variant="danger">Inactive</Badge>
            )}
            <Badge variant={user.role === "ADMIN" ? "info" : "success"}>
              {user.role}
            </Badge>
            <ChevronRight className="h-4 w-4 text-muted" />
          </div>
        </button>
      ))}
    </div>
  );
}
