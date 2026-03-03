import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { PropertyForm } from "@/components/properties/PropertyForm";
import { PropertyAssignments } from "@/components/properties/PropertyAssignments";
import { Card, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { ArrowLeft, Pencil, MapPin } from "lucide-react";
import toast from "react-hot-toast";

export function PropertyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const propertyId = id as Id<"properties">;
  const property = useQuery(api.properties.getById, { propertyId });
  const updateProperty = useMutation(api.properties.update);

  const [editing, setEditing] = useState(false);

  if (property === undefined) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  if (property === null) {
    return (
      <div className="py-12 text-center">
        <p className="text-muted">Property not found.</p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => navigate("/admin/properties")}
        >
          Back to Properties
        </Button>
      </div>
    );
  }

  if (editing) {
    return (
      <div className="mx-auto max-w-lg space-y-6">
        <button
          onClick={() => setEditing(false)}
          className="flex items-center gap-1 text-sm text-muted hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <h1 className="text-2xl font-bold">Edit Property</h1>
        <Card>
          <PropertyForm
            property={property}
            onSaved={() => setEditing(false)}
            onCancel={() => setEditing(false)}
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate("/admin/properties")}
          className="rounded-md p-1.5 text-muted hover:bg-gray-100"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">{property.name}</h1>
            {!property.isActive && <Badge variant="danger">Inactive</Badge>}
          </div>
          <div className="mt-1 flex items-center gap-1 text-sm text-muted">
            <MapPin className="h-3.5 w-3.5" />
            {property.address}
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
          <Pencil className="h-4 w-4" />
          Edit
        </Button>
      </div>

      {/* Details */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardTitle>Details</CardTitle>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted">Type</dt>
              <dd>
                <Badge variant={property.propertyType === "RESIDENTIAL" ? "info" : "default"}>
                  {property.propertyType}
                </Badge>
              </dd>
            </div>
            {property.bedrooms != null && (
              <div className="flex justify-between">
                <dt className="text-muted">Bedrooms</dt>
                <dd>{property.bedrooms}</dd>
              </div>
            )}
            {property.bathrooms != null && (
              <div className="flex justify-between">
                <dt className="text-muted">Bathrooms</dt>
                <dd>{property.bathrooms}</dd>
              </div>
            )}
            {property.description && (
              <div className="flex justify-between">
                <dt className="text-muted">Description</dt>
                <dd className="text-right max-w-[60%]">{property.description}</dd>
              </div>
            )}
            {property.notes && (
              <div className="flex justify-between">
                <dt className="text-muted">Notes</dt>
                <dd className="text-right max-w-[60%]">{property.notes}</dd>
              </div>
            )}
          </dl>
        </Card>

        <Card>
          <PropertyAssignments propertyId={property._id} />
        </Card>
      </div>

      {/* Toggle active */}
      <Card className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Property Status</p>
          <p className="text-xs text-muted">
            {property.isActive
              ? "This property is active and available for inspections."
              : "This property is inactive and hidden from inspectors."}
          </p>
        </div>
        <Button
          variant={property.isActive ? "danger" : "primary"}
          size="sm"
          onClick={async () => {
            await updateProperty({
              propertyId: property._id,
              isActive: !property.isActive,
            });
            toast.success(
              property.isActive ? "Property deactivated" : "Property activated"
            );
          }}
        >
          {property.isActive ? "Deactivate" : "Activate"}
        </Button>
      </Card>
    </div>
  );
}
