import { useState } from "react";
import { Link } from "react-router-dom";
import { PropertyList } from "@/components/properties/PropertyList";
import { PropertyForm } from "@/components/properties/PropertyForm";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Plus } from "lucide-react";

export function PropertiesPage() {
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Properties</h1>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4" />
          Add Property
        </Button>
      </div>

      <PropertyList />

      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="New Property"
      >
        <PropertyForm
          onSaved={() => setShowCreate(false)}
          onCancel={() => setShowCreate(false)}
        />
      </Modal>
    </div>
  );
}
