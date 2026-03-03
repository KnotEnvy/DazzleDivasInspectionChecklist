import { useState } from "react";
import type { Id } from "convex/_generated/dataModel";
import { UserList } from "@/components/users/UserList";
import { UserEditModal } from "@/components/users/UserEditModal";

export function UsersPage() {
  const [editUserId, setEditUserId] = useState<Id<"users"> | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Users</h1>
      </div>

      <UserList onSelect={setEditUserId} />

      <UserEditModal
        userId={editUserId}
        onClose={() => setEditUserId(null)}
      />
    </div>
  );
}
