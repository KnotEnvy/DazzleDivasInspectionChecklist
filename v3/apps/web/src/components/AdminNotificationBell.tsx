import { useCallback, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { Bell, CheckCheck } from "lucide-react";
import { useClickOutside } from "@/hooks/useClickOutside";

type AdminNotification = {
  _id: Id<"adminNotifications">;
  jobId: Id<"jobs">;
  eventType: "JOB_STARTED" | "JOB_COMPLETED";
  title: string;
  message: string;
  createdAt: number;
  readAt?: number;
};

type NotificationResult = {
  notifications: AdminNotification[];
  unreadCount: number;
};

export function AdminNotificationBell() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useClickOutside(containerRef, close);

  const result = useQuery(api.notifications.listMine, {}) as NotificationResult | undefined;
  const markRead = useMutation(api.notifications.markRead);
  const markAllRead = useMutation(api.notifications.markAllRead);
  const unreadCount = result?.unreadCount ?? 0;

  return (
    <div className="relative" ref={containerRef}>
      <button
        aria-expanded={open}
        aria-label={`${unreadCount} unread admin notifications`}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-white text-slate-600 transition hover:border-brand-300 hover:text-brand-700"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-rose-600 px-1 text-[10px] font-bold leading-4 text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 top-11 z-50 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-border bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <p className="font-bold text-slate-900">Admin Notifications</p>
              <p className="text-xs text-slate-500">Job starts and completions</p>
            </div>
            {unreadCount > 0 ? (
              <button
                className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700"
                onClick={() => void markAllRead({})}
                type="button"
              >
                <CheckCheck className="h-3.5 w-3.5" /> Mark all read
              </button>
            ) : null}
          </div>
          <div className="max-h-96 overflow-y-auto p-2">
            {result === undefined ? (
              <div className="space-y-2 p-2">
                <div className="skeleton h-16 rounded-xl" />
                <div className="skeleton h-16 rounded-xl" />
              </div>
            ) : result.notifications.length === 0 ? (
              <p className="p-5 text-center text-sm text-slate-500">No job notifications yet.</p>
            ) : (
              result.notifications.map((notification) => (
                <Link
                  key={notification._id}
                  className={`mb-1 block rounded-xl border p-3 transition hover:border-brand-300 ${
                    notification.readAt
                      ? "border-transparent bg-white"
                      : "border-brand-100 bg-brand-50/70"
                  }`}
                  onClick={() => {
                    void markRead({ notificationId: notification._id });
                    setOpen(false);
                  }}
                  to={`/schedule?jobId=${notification.jobId}#dispatch-drawer`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900">{notification.title}</p>
                    <span className="shrink-0 text-[10px] text-slate-400">
                      {new Date(notification.createdAt).toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-600">{notification.message}</p>
                </Link>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
