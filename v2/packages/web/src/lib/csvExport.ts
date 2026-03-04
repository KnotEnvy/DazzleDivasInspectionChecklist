interface TaskData {
  description: string;
  completed: boolean;
}

interface RoomData {
  room_name: string;
  status: string;
  notes: string | null;
  tasks: TaskData[];
  photo_count: number;
}

export interface ReportData {
  property_name: string;
  property_address: string;
  inspector_name: string;
  inspection_date: string;
  status: string;
  notes: string | null;
  rooms: RoomData[];
}

function escapeCsv(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function generateCsv(report: ReportData): string {
  const rows: string[][] = [];

  // Header info
  rows.push(["Inspection Report"]);
  rows.push(["Property", report.property_name]);
  rows.push(["Address", report.property_address]);
  rows.push(["Inspector", report.inspector_name]);
  rows.push(["Date", report.inspection_date]);
  rows.push(["Status", report.status]);
  if (report.notes) {
    rows.push(["Notes", report.notes]);
  }
  rows.push([]);

  // Task detail table
  rows.push(["Room", "Task", "Completed", "Room Status", "Room Notes", "Photos"]);

  for (const room of report.rooms) {
    if (room.tasks.length === 0) {
      rows.push([
        room.room_name,
        "",
        "",
        room.status,
        room.notes ?? "",
        String(room.photo_count),
      ]);
    } else {
      for (let i = 0; i < room.tasks.length; i++) {
        const task = room.tasks[i];
        rows.push([
          i === 0 ? room.room_name : "",
          task.description,
          task.completed ? "Yes" : "No",
          i === 0 ? room.status : "",
          i === 0 ? (room.notes ?? "") : "",
          i === 0 ? String(room.photo_count) : "",
        ]);
      }
    }
  }

  return rows.map((row) => row.map(escapeCsv).join(",")).join("\n");
}

export function downloadCsv(csv: string, filename: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  triggerDownload(blob, filename);
}

export function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
