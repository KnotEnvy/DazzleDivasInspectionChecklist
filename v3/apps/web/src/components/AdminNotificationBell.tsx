import { useCallback, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { Bell, CheckCheck, X } from "lucide-react";
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
        aria-controls="admin-notification-panel"
        aria-label={`${unreadCount} unread admin notifications`}
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-white text-slate-600 transition hover:border-brand-300 hover:text-brand-700 sm:h-9 sm:w-9"
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
        <div
          aria-label="Admin notifications"
          className="fixed inset-x-3 top-[4.75rem] z-50 flex max-h-[calc(100dvh-5.5rem)] flex-col overflow-hidden rounded-2xl border border-border bg-white shadow-2xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-11 sm:w-[22rem]"
          id="admin-notification-panel"
          role="dialog"
        >
          <div className="flex items-start justify-between gap-3 border-b border-border px-3 py-3 sm:px-4">
            <div className="min-w-0">
              <p className="font-bold text-slate-900">Admin Notifications</p>
              <p className="text-xs text-slate-500">Job starts and completions</p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {unreadCount > 0 ? (
                <button
                  className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-brand-700 transition hover:bg-brand-50"
                  onClick={() => void markAllRead({})}
                  type="button"
                >
                  <CheckCheck className="h-3.5 w-3.5" /> Read all
                </button>
              ) : null}
              <button
                aria-label="Close admin notifications"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                onClick={close}
                type="button"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
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
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-2">
                    <p className="min-w-0 break-words text-sm font-semibold text-slate-900">
                      {notification.title}
                    </p>
                    <span className="text-[10px] text-slate-400 sm:shrink-0">
                      {new Date(notification.createdAt).toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <p className="mt-1 break-words text-xs text-slate-600">
                    {notification.message}
                  </p>
                </Link>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
