import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { Building2, ChevronRight, MapPin } from "lucide-react";

export function PropertyList() {
  const properties = useQuery(api.properties.listAll);

  if (!properties) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  if (properties.length === 0) {
    return (
      <EmptyState
        icon={<Building2 className="h-10 w-10" />}
        title="No properties yet"
        description="Create your first property to get started."
      />
    );
  }

  return (
    <div className="divide-y divide-border rounded-xl border border-border bg-surface">
      {properties.map((property) => (
        <Link
          key={property._id}
          to={`/admin/properties/${property._id}`}
          className="flex items-center justify-between p-4 transition-colors hover:bg-gray-50"
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-foreground truncate">
                {property.name}
              </p>
              {!property.isActive && (
                <Badge variant="danger">Inactive</Badge>
              )}
            </div>
            <div className="mt-1 flex items-center gap-1 text-xs text-muted">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{property.address}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 ml-4">
            <Badge variant={property.propertyType === "RESIDENTIAL" ? "info" : "default"}>
              {property.propertyType}
            </Badge>
            {property.bedrooms != null && (
              <span className="hidden text-xs text-muted sm:inline">
                {property.bedrooms}BR / {property.bathrooms}BA
              </span>
            )}
            <ChevronRight className="h-4 w-4 text-muted" />
          </div>
        </Link>
      ))}
    </div>
  );
}
