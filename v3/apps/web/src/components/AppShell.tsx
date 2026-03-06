import { NavLink, Outlet } from "react-router-dom";
import { useAuthActions } from "@convex-dev/auth/react";
import {
  Building2,
  CalendarDays,
  ClipboardList,
  ClipboardPenLine,
  Clock3,
  House,
  Shield,
  SlidersHorizontal,
} from "lucide-react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { useOutboxCount } from "@/hooks/useOutboxCount";

const baseLink = "rounded-xl px-3 py-2 text-sm font-semibold transition";

export function AppShell() {
  const { signOut } = useAuthActions();
  const { user, isAdmin } = useCurrentUser();
  const isOnline = useNetworkStatus();
  const { count } = useOutboxCount();

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 pb-24 pt-4 lg:px-8 lg:pb-8">
      <header className="glass-panel mb-4 flex items-center justify-between gap-3 p-3 lg:p-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-700">
            Dazzle Divas
          </p>
          <h1 className="text-lg font-bold lg:text-xl">Field Checklist v3</h1>
        </div>

        <div className="flex items-center gap-2">
          <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
            {isOnline ? "Online" : "Offline"}
          </span>
          <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
            Queue: {count}
          </span>
          <button className="field-button secondary px-3" onClick={() => void signOut()}>
            Sign Out
          </button>
        </div>
      </header>

      <nav className="glass-panel mb-4 flex items-center gap-2 p-2">
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            `${baseLink} ${isActive ? "bg-brand-700 text-white" : "text-slate-700 hover:bg-brand-50"}`
          }
        >
          <House className="mr-1 inline-block h-4 w-4" /> Dashboard
        </NavLink>
        <NavLink
          to="/checklists/new"
          className={({ isActive }) =>
            `${baseLink} ${isActive ? "bg-brand-700 text-white" : "text-slate-700 hover:bg-brand-50"}`
          }
        >
          <ClipboardList className="mr-1 inline-block h-4 w-4" /> New Checklist
        </NavLink>
        <NavLink
          to="/my-schedule"
          className={({ isActive }) =>
            `${baseLink} ${isActive ? "bg-brand-700 text-white" : "text-slate-700 hover:bg-brand-50"}`
          }
        >
          <CalendarDays className="mr-1 inline-block h-4 w-4" /> My Schedule
        </NavLink>
        <NavLink
          to="/history"
          className={({ isActive }) =>
            `${baseLink} ${isActive ? "bg-brand-700 text-white" : "text-slate-700 hover:bg-brand-50"}`
          }
        >
          <Clock3 className="mr-1 inline-block h-4 w-4" /> History
        </NavLink>
        {isAdmin && (
          <NavLink
            to="/schedule"
            className={({ isActive }) =>
              `${baseLink} ${isActive ? "bg-brand-700 text-white" : "text-slate-700 hover:bg-brand-50"}`
            }
          >
            <SlidersHorizontal className="mr-1 inline-block h-4 w-4" /> Dispatch
          </NavLink>
        )}
        {isAdmin && (
          <NavLink
            to="/admin"
            className={({ isActive }) =>
              `${baseLink} ${isActive ? "bg-brand-700 text-white" : "text-slate-700 hover:bg-brand-50"}`
            }
          >
            <Shield className="mr-1 inline-block h-4 w-4" /> Admin
          </NavLink>
        )}
        {isAdmin && (
          <NavLink
            to="/admin/properties"
            className={({ isActive }) =>
              `${baseLink} ${isActive ? "bg-brand-700 text-white" : "text-slate-700 hover:bg-brand-50"}`
            }
          >
            <Building2 className="mr-1 inline-block h-4 w-4" /> Properties
          </NavLink>
        )}
        {isAdmin && (
          <NavLink
            to="/admin/templates"
            className={({ isActive }) =>
              `${baseLink} ${isActive ? "bg-brand-700 text-white" : "text-slate-700 hover:bg-brand-50"}`
            }
          >
            <ClipboardPenLine className="mr-1 inline-block h-4 w-4" /> Templates
          </NavLink>
        )}
      </nav>

      <main className="glass-panel flex-1 p-4 lg:p-6">
        <Outlet />
      </main>

      <footer className="mt-3 text-center text-xs text-slate-500">
        Signed in as {user?.name ?? "..."} ({user?.role ?? "..."})
      </footer>
    </div>
  );
}

