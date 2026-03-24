import { NavLink, Outlet } from "react-router-dom";
import { useAuthActions } from "@convex-dev/auth/react";
import {
  Building2,
  CalendarDays,
  ClipboardList,
  ClipboardPenLine,
  Clock3,
  House,
  MoreHorizontal,
  Shield,
  SlidersHorizontal,
} from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useClickOutside } from "@/hooks/useClickOutside";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { useOutboxCount } from "@/hooks/useOutboxCount";
import { useOutboxItems } from "@/hooks/useOutboxItems";
import { useOfflineSync } from "@/app/OfflineSyncProvider";

const baseLink = "rounded-xl px-3 py-2 text-sm font-semibold transition";

function statusPillClasses(isOnline: boolean, syncing: boolean) {
  if (!isOnline) return "bg-slate-200 text-slate-700";
  if (syncing) return "bg-brand-50 text-brand-700";
  return "bg-emerald-50 text-emerald-700";
}

export function AppShell() {
  const { signOut } = useAuthActions();
  const { user, isAdmin } = useCurrentUser();
  const isOnline = useNetworkStatus();
  const { count } = useOutboxCount();
  const { items } = useOutboxItems();
  const { syncing } = useOfflineSync();
  const conflictCount = items.filter((item) => item.status === "CONFLICT").length;
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const closeMore = useCallback(() => setMoreOpen(false), []);
  useClickOutside(moreRef, closeMore);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 pb-24 pt-4 lg:px-8 lg:pb-8">
      <header className="glass-panel mb-4 flex items-center justify-between gap-3 p-3 lg:p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white lg:h-10 lg:w-10">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 lg:h-6 lg:w-6">
              <path d="M12 3c-1.2 0-2.4.6-3 1.7A3.6 3.6 0 0 0 4.6 9c-1 1.6-.6 3.5.7 4.7L12 21l6.7-7.3c1.3-1.2 1.7-3.1.7-4.7A3.6 3.6 0 0 0 15 4.7C14.4 3.6 13.2 3 12 3z"/>
            </svg>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-700">
              Dazzle Divas
            </p>
            <h1 className="text-lg font-bold lg:text-xl">Field Checklist v3</h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            aria-label={`Connection: ${isOnline ? (syncing ? "syncing" : "online") : "offline"}`}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${statusPillClasses(isOnline, syncing)}`}
          >
            {isOnline ? (syncing ? "Syncing" : "Online") : "Offline"}
          </span>
          <span
            aria-label={`Offline queue: ${count} items`}
            className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700"
          >
            Queue: {count}
          </span>
          {conflictCount > 0 ? (
            <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700">
              Conflicts: {conflictCount}
            </span>
          ) : null}
          <button className="field-button secondary px-3 hidden lg:inline-flex" onClick={() => void signOut()}>
            Sign Out
          </button>
        </div>
      </header>

      {/* Desktop top nav */}
      <nav className="glass-panel mb-4 hidden items-center gap-2 p-2 lg:flex">
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
          to="/my-schedule"
          className={({ isActive }) =>
            `${baseLink} ${isActive ? "bg-brand-700 text-white" : "text-slate-700 hover:bg-brand-50"}`
          }
        >
          <CalendarDays className="mr-1 inline-block h-4 w-4" /> My Schedule
        </NavLink>
        <NavLink
          to={isAdmin ? "/checklists/new" : "/checklists/active"}
          className={({ isActive }) =>
            `${baseLink} ${isActive ? "bg-brand-700 text-white" : "text-slate-700 hover:bg-brand-50"}`
          }
        >
          <ClipboardList className="mr-1 inline-block h-4 w-4" /> {isAdmin ? "New Checklist" : "Active Inspections"}
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

      <footer className="mt-3 hidden text-center text-xs text-slate-500 lg:block">
        Signed in as {user?.name ?? "..."} ({user?.role ?? "..."})
      </footer>

      {/* Mobile bottom nav */}
      <nav className="bottom-nav flex items-center justify-around px-2 py-2 lg:hidden">
        {isAdmin ? (
          <>
            <MobileNavItem to="/" icon={<House className="h-5 w-5" />} label="Dashboard" end />
            <MobileNavItem to="/my-schedule" icon={<CalendarDays className="h-5 w-5" />} label="Schedule" />
            <MobileNavItem to="/schedule" icon={<SlidersHorizontal className="h-5 w-5" />} label="Dispatch" />
            <MobileNavItem to="/admin/properties" icon={<Building2 className="h-5 w-5" />} label="Properties" />
            <div className="relative" ref={moreRef}>
              <button
                aria-expanded={moreOpen}
                aria-haspopup="true"
                className="flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-0.5 rounded-xl px-2 py-1 text-[11px] font-semibold text-slate-500 transition hover:bg-brand-50"
                onClick={() => setMoreOpen(!moreOpen)}
                onKeyDown={(e) => { if (e.key === "Escape") setMoreOpen(false); }}
                type="button"
              >
                <MoreHorizontal className="h-5 w-5" />
                More
              </button>
              {moreOpen && (
                <div className="absolute bottom-full right-0 mb-2 w-48 rounded-2xl border border-border bg-white p-2 shadow-lg" role="menu">
                  <NavLink
                    to="/checklists/new"
                    className="block rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-brand-50"
                    onClick={() => setMoreOpen(false)}
                    role="menuitem"
                  >
                    <ClipboardList className="mr-2 inline-block h-4 w-4" /> New Checklist
                  </NavLink>
                  <NavLink
                    to="/history"
                    className="block rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-brand-50"
                    onClick={() => setMoreOpen(false)}
                    role="menuitem"
                  >
                    <Clock3 className="mr-2 inline-block h-4 w-4" /> History
                  </NavLink>
                  <NavLink
                    to="/admin"
                    className="block rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-brand-50"
                    onClick={() => setMoreOpen(false)}
                    role="menuitem"
                  >
                    <Shield className="mr-2 inline-block h-4 w-4" /> Admin
                  </NavLink>
                  <NavLink
                    to="/admin/templates"
                    className="block rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-brand-50"
                    onClick={() => setMoreOpen(false)}
                    role="menuitem"
                  >
                    <ClipboardPenLine className="mr-2 inline-block h-4 w-4" /> Templates
                  </NavLink>
                  <button
                    className="mt-1 w-full rounded-xl px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-brand-50"
                    onClick={() => { setMoreOpen(false); void signOut(); }}
                    role="menuitem"
                    type="button"
                  >
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <MobileNavItem to="/" icon={<House className="h-5 w-5" />} label="Dashboard" end />
            <MobileNavItem to="/my-schedule" icon={<CalendarDays className="h-5 w-5" />} label="Schedule" />
            <MobileNavItem
              to="/checklists/active"
              icon={<ClipboardList className="h-5 w-5" />}
              label="Active"
            />
            <MobileNavItem to="/history" icon={<Clock3 className="h-5 w-5" />} label="History" />
            <button
              className="flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-0.5 rounded-xl px-2 py-1 text-[11px] font-semibold text-slate-500 transition hover:bg-brand-50"
              onClick={() => void signOut()}
              type="button"
            >
              <Shield className="h-5 w-5" />
              Sign Out
            </button>
          </>
        )}
      </nav>
    </div>
  );
}

function MobileNavItem({
  to,
  icon,
  label,
  end,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
  end?: boolean;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-0.5 rounded-xl px-2 py-1 text-[11px] font-semibold transition ${
          isActive ? "bg-brand-50 text-brand-700" : "text-slate-500 hover:bg-brand-50"
        }`
      }
    >
      {icon}
      {label}
    </NavLink>
  );
}
