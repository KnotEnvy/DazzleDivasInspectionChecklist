import { NavLink } from "react-router-dom";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { cn } from "@/components/ui/utils";
import {
  LayoutDashboard,
  ClipboardCheck,
  History,
  Users,
  Building2,
  DoorOpen,
  Settings,
  X,
} from "lucide-react";

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
  adminOnly?: boolean;
}

const navItems: NavItem[] = [
  {
    to: "/",
    label: "Dashboard",
    icon: <LayoutDashboard className="h-5 w-5" />,
  },
  {
    to: "/inspections/new",
    label: "New Inspection",
    icon: <ClipboardCheck className="h-5 w-5" />,
  },
  {
    to: "/history",
    label: "History",
    icon: <History className="h-5 w-5" />,
  },
  {
    to: "/admin/users",
    label: "Users",
    icon: <Users className="h-5 w-5" />,
    adminOnly: true,
  },
  {
    to: "/admin/properties",
    label: "Properties",
    icon: <Building2 className="h-5 w-5" />,
    adminOnly: true,
  },
  {
    to: "/admin/rooms",
    label: "Room Templates",
    icon: <DoorOpen className="h-5 w-5" />,
    adminOnly: true,
  },
];

export function Sidebar({ open, onClose }: SidebarProps) {
  const { isAdmin } = useCurrentUser();

  const filteredItems = navItems.filter(
    (item) => !item.adminOnly || isAdmin
  );

  const linkClasses = ({ isActive }: { isActive: boolean }) =>
    cn(
      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
      isActive
        ? "bg-primary-50 text-primary-700"
        : "text-muted hover:bg-gray-100 hover:text-foreground"
    );

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 border-r border-border bg-surface transition-transform duration-200 lg:static lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Mobile close button */}
        <div className="flex h-14 items-center justify-between border-b border-border px-4 lg:hidden">
          <span className="font-semibold">Menu</span>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-muted hover:bg-gray-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex flex-col gap-1 p-4">
          {filteredItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={linkClasses}
              onClick={onClose}
            >
              {item.icon}
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
    </>
  );
}
