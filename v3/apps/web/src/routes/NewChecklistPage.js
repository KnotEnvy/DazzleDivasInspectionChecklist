import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import toast from "react-hot-toast";
import { CHECKLIST_TYPES } from "@dazzle/shared";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { queueCreateInspection } from "@/lib/offlineOutbox";
import { useOutboxCount } from "@/hooks/useOutboxCount";
export function NewChecklistPage() {
    const navigate = useNavigate();
    const isOnline = useNetworkStatus();
    const { refresh } = useOutboxCount();
    const properties = useQuery(api.properties.listForCurrentUser);
    const createInspection = useMutation(api.inspections.create);
    const [propertyId, setPropertyId] = useState("");
    const [type, setType] = useState("CLEANING");
    const [pending, setPending] = useState(false);
    async function handleSubmit(event) {
        event.preventDefault();
        if (!propertyId) {
            toast.error("Choose a property first");
            return;
        }
        setPending(true);
        try {
            if (!isOnline) {
                await queueCreateInspection({ propertyId, type });
                await refresh();
                toast.success("Queued for sync when connection is back");
                setPending(false);
                return;
            }
            const inspectionId = await createInspection({
                propertyId: propertyId,
                type,
            });
            toast.success("Checklist started");
            navigate(`/checklists/${inspectionId}`);
        }
        catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to start checklist");
        }
        finally {
            setPending(false);
        }
    }
    return (_jsxs("div", { className: "max-w-2xl space-y-4", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-2xl font-bold", children: "Start New Checklist" }), _jsx("p", { className: "text-sm text-slate-600", children: "If you are offline, this action is queued and synced later." })] }), _jsxs("form", { className: "space-y-4", onSubmit: handleSubmit, children: [_jsxs("label", { className: "block text-sm font-semibold text-slate-700", children: ["Property", _jsxs("select", { className: "input mt-1", value: propertyId, onChange: (event) => setPropertyId(event.target.value), required: true, children: [_jsx("option", { value: "", children: "Select a property..." }), properties?.map((property) => (_jsx("option", { value: property._id, children: property.name }, property._id)))] })] }), _jsxs("label", { className: "block text-sm font-semibold text-slate-700", children: ["Checklist Type", _jsx("select", { className: "input mt-1", value: type, onChange: (event) => setType(event.target.value), children: CHECKLIST_TYPES.map((item) => (_jsx("option", { value: item, children: item }, item))) })] }), _jsx("button", { className: "field-button primary px-5", disabled: pending, type: "submit", children: pending ? "Starting..." : isOnline ? "Start Checklist" : "Queue For Sync" })] })] }));
}
