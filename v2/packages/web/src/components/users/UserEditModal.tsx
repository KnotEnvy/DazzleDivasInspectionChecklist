import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import toast from "react-hot-toast";

interface UserEditModalProps {
  userId: Id<"users"> | null;
  onClose: () => void;
}

export function UserEditModal({ userId, onClose }: UserEditModalProps) {
  const user = useQuery(
    api.users.getById,
    userId ? { userId } : "skip"
  );
  const updateUser = useMutation(api.users.update);

  const [name, setName] = useState("");
  const [role, setRole] = useState("INSPECTOR");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name);
      setRole(user.role);
      setIsActive(user.isActive);
    }
  }, [user]);

  async function handleSave() {
    if (!userId) return;
    setSaving(true);
    try {
      await updateUser({
        userId,
        name: name !== user?.name ? name : undefined,
        role: role as "ADMIN" | "INSPECTOR",
        isActive,
      });
      toast.success("User updated");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update user");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={!!userId} onClose={onClose} title="Edit User">
      {!user ? (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      ) : (
        <div className="space-y-4">
          <Input
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <div className="text-sm">
            <span className="font-medium text-muted">Email:</span>{" "}
            <span className="text-foreground">{user.email}</span>
          </div>

          <Select
            label="Role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            options={[
              { value: "INSPECTOR", label: "Inspector" },
              { value: "ADMIN", label: "Admin" },
            ]}
          />

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isActive"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 rounded border-border text-primary-500 focus:ring-primary-500"
            />
            <label htmlFor="isActive" className="text-sm font-medium">
              Active
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSave} loading={saving}>
              Save Changes
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
