import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { Card, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { Building2, Users, ClipboardCheck, CheckCircle } from "lucide-react";

export function AdminDashboard() {
  const stats = useQuery(api.admin.stats);

  if (!stats) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner />
      </div>
    );
  }

  const statCards = [
    {
      label: "Properties",
      value: stats.totalProperties,
      icon: <Building2 className="h-5 w-5 text-primary-500" />,
      color: "bg-primary-50",
    },
    {
      label: "Inspectors",
      value: stats.totalInspectors,
      icon: <Users className="h-5 w-5 text-blue-500" />,
      color: "bg-blue-50",
    },
    {
      label: "Active Inspections",
      value: stats.activeInspections,
      icon: <ClipboardCheck className="h-5 w-5 text-amber-500" />,
      color: "bg-amber-50",
    },
    {
      label: "Completed",
      value: stats.completedInspections,
      icon: <CheckCircle className="h-5 w-5 text-emerald-500" />,
      color: "bg-emerald-50",
    },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.label} className="flex items-center gap-4 p-4">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-lg ${stat.color}`}
            >
              {stat.icon}
            </div>
            <div>
              <p className="text-2xl font-bold">{stat.value}</p>
              <p className="text-xs text-muted">{stat.label}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* Recent inspections */}
      <Card>
        <CardTitle>Recent Inspections</CardTitle>
        {stats.recentInspections.length === 0 ? (
          <p className="mt-4 text-sm text-muted">No inspections yet.</p>
        ) : (
          <div className="mt-4 divide-y divide-border">
            {stats.recentInspections.map((inspection) => (
              <div
                key={inspection._id}
                className="flex items-center justify-between py-3"
              >
                <div>
                  <p className="text-sm font-medium">
                    {inspection.propertyName}
                  </p>
                  <p className="text-xs text-muted">
                    by {inspection.inspectorName}
                  </p>
                </div>
                <Badge
                  variant={
                    inspection.status === "COMPLETED" ? "success" : "warning"
                  }
                >
                  {inspection.status === "COMPLETED"
                    ? "Completed"
                    : "In Progress"}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
