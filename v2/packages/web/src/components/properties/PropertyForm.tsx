import { useState, type FormEvent } from "react";
import { useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import type { Doc } from "convex/_generated/dataModel";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import toast from "react-hot-toast";

interface PropertyFormProps {
  property?: Doc<"properties">;
  onSaved: () => void;
  onCancel: () => void;
}

export function PropertyForm({ property, onSaved, onCancel }: PropertyFormProps) {
  const createProperty = useMutation(api.properties.create);
  const updateProperty = useMutation(api.properties.update);

  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(property?.name ?? "");
  const [address, setAddress] = useState(property?.address ?? "");
  const [description, setDescription] = useState(property?.description ?? "");
  const [propertyType, setPropertyType] = useState(
    property?.propertyType ?? "RESIDENTIAL"
  );
  const [bedrooms, setBedrooms] = useState(property?.bedrooms?.toString() ?? "");
  const [bathrooms, setBathrooms] = useState(property?.bathrooms?.toString() ?? "");
  const [notes, setNotes] = useState(property?.notes ?? "");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);

    const data = {
      name,
      address,
      description: description || undefined,
      propertyType: propertyType as "RESIDENTIAL" | "COMMERCIAL",
      bedrooms: bedrooms ? parseInt(bedrooms) : undefined,
      bathrooms: bathrooms ? parseInt(bathrooms) : undefined,
      notes: notes || undefined,
    };

    try {
      if (property) {
        await updateProperty({ propertyId: property._id, ...data });
        toast.success("Property updated");
      } else {
        await createProperty(data);
        toast.success("Property created");
      }
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save property");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="Property Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        placeholder="e.g. Oceanview Villa"
      />

      <Input
        label="Address"
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        required
        placeholder="123 Main St, City, State ZIP"
      />

      <Input
        label="Description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Brief property description"
      />

      <Select
        label="Property Type"
        value={propertyType}
        onChange={(e) => setPropertyType(e.target.value)}
        options={[
          { value: "RESIDENTIAL", label: "Residential" },
          { value: "COMMERCIAL", label: "Commercial" },
        ]}
      />

      {propertyType === "RESIDENTIAL" && (
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Bedrooms"
            type="number"
            min="0"
            value={bedrooms}
            onChange={(e) => setBedrooms(e.target.value)}
            placeholder="0"
          />
          <Input
            label="Bathrooms"
            type="number"
            min="0"
            value={bathrooms}
            onChange={(e) => setBathrooms(e.target.value)}
            placeholder="0"
          />
        </div>
      )}

      <Input
        label="Notes"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Any additional notes..."
      />

      <div className="flex justify-end gap-3 pt-4 border-t border-border">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={saving}>
          {property ? "Save Changes" : "Create Property"}
        </Button>
      </div>
    </form>
  );
}
