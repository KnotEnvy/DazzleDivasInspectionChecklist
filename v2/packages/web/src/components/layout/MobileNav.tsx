import { NavLink } from "react-router-dom";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { cn } from "@/components/ui/utils";
import {
  LayoutDashboard,
  ClipboardCheck,
  History,
  Settings,
} from "lucide-react";

export function MobileNav() {
  const { isAdmin } = useCurrentUser();

  const linkClasses = ({ isActive }: { isActive: boolean }) =>
    cn(
      "flex flex-col items-center gap-1 py-1 text-[10px] font-medium transition-colors",
      isActive ? "text-primary-600" : "text-muted"
    );

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 flex items-center justify-around border-t border-border bg-surface px-2 py-1 lg:hidden">
      <NavLink to="/" end className={linkClasses}>
        <LayoutDashboard className="h-5 w-5" />
        Dashboard
      </NavLink>

      <NavLink to="/inspections/new" className={linkClasses}>
        <ClipboardCheck className="h-5 w-5" />
        Inspect
      </NavLink>

      <NavLink to="/history" className={linkClasses}>
        <History className="h-5 w-5" />
        History
      </NavLink>

      {isAdmin && (
        <NavLink to="/admin/users" className={linkClasses}>
          <Settings className="h-5 w-5" />
          Admin
        </NavLink>
      )}
    </nav>
  );
}
