import { useAuthActions } from "@convex-dev/auth/react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Badge } from "@/components/ui/Badge";
import { LogOut, Menu } from "lucide-react";

interface TopBarProps {
  onMenuToggle?: () => void;
}

export function TopBar({ onMenuToggle }: TopBarProps) {
  const { user } = useCurrentUser();
  const { signOut } = useAuthActions();

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b border-border bg-surface px-4 lg:px-6">
      {/* Mobile menu button */}
      <button
        onClick={onMenuToggle}
        className="lg:hidden rounded-md p-1.5 text-muted hover:bg-gray-100"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Brand */}
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary-500">
          <svg
            className="h-4 w-4 text-white"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <span className="hidden font-semibold text-foreground sm:inline">
          Dazzle Divas
        </span>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* User info */}
      {user && (
        <div className="flex items-center gap-3">
          <Badge variant={user.role === "ADMIN" ? "info" : "success"}>
            {user.role}
          </Badge>
          <span className="hidden text-sm font-medium text-foreground sm:inline">
            {user.name}
          </span>
          <button
            onClick={() => void signOut()}
            className="rounded-md p-1.5 text-muted hover:bg-gray-100 hover:text-foreground"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      )}
    </header>
  );
}
