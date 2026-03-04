import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMutation, useQuery } from "convex/react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "convex/_generated/api";
import toast from "react-hot-toast";
export function InspectionPage() {
    const navigate = useNavigate();
    const params = useParams();
    const inspectionId = params.inspectionId;
    const inspection = useQuery(api.inspections.getById, inspectionId ? { inspectionId } : "skip");
    const completeInspection = useMutation(api.inspections.complete);
    if (!inspectionId) {
        return _jsx("p", { className: "text-slate-600", children: "Missing inspection id." });
    }
    async function handleComplete() {
        try {
            await completeInspection({ inspectionId });
            toast.success("Checklist marked as completed");
            navigate("/");
        }
        catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to complete");
        }
    }
    if (inspection === undefined) {
        return _jsx("p", { className: "text-slate-600", children: "Loading checklist..." });
    }
    if (!inspection) {
        return _jsx("p", { className: "text-slate-600", children: "Checklist not found." });
    }
    return (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "flex flex-wrap items-end justify-between gap-3", children: [_jsxs("div", { children: [_jsx("p", { className: "text-xs font-semibold uppercase tracking-[0.2em] text-brand-700", children: inspection.type }), _jsx("h1", { className: "text-2xl font-bold", children: inspection.propertyName }), _jsxs("p", { className: "text-sm text-slate-600", children: ["Status: ", inspection.status] })] }), _jsx("button", { className: "field-button primary px-5", disabled: inspection.status === "COMPLETED", onClick: () => void handleComplete(), children: "Complete Checklist" })] }), _jsx("div", { className: "grid gap-3 lg:grid-cols-2", children: inspection.roomInspections.map((room) => (_jsxs("div", { className: "rounded-2xl border border-border bg-white p-4", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("h2", { className: "font-bold", children: room.roomName }), _jsx("span", { className: "text-xs font-semibold text-slate-500", children: room.status })] }), _jsxs("p", { className: "mt-2 text-sm text-slate-600", children: ["Tasks: ", room.completedTasks, "/", room.totalTasks] }), _jsxs("p", { className: "text-sm text-slate-600", children: ["Photos: ", room.photoCount] })] }, room._id))) })] }));
}
