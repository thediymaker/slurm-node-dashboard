export interface ColorSchema {
  value: string;
  label: string;
  colors: string[]; // For color selector preview
  stateColors: {
    // For node cards
    IDLE: { bgColor: string; textColor: string };
    MIXED: { bgColor: string; textColor: string };
    ALLOCATED: { bgColor: string; textColor: string };
    DOWN: { bgColor: string; textColor: string };
    DRAIN: { bgColor: string; textColor: string };
    NOT_RESPONDING: { bgColor: string; textColor: string };
    PLANNED: { bgColor: string; textColor: string };
    COMPLETING: { bgColor: string; textColor: string };
    RESERVED: { bgColor: string; textColor: string };
    FUTURE: { bgColor: string; textColor: string };
    REBOOT_REQUESTED: { bgColor: string; textColor: string };
  };
  progressColors: {
    // For activity banner
    idle: string;
    mixed: string;
    allocated: string;
    down: string;
    drain: string;
    unknown: string;
  };
}

// Define all color schemas
export const COLOR_SCHEMAS: ColorSchema[] = [
  {
    value: "default",
    label: "Default",
    colors: ["#60a5fa", "#15803d", "#ea580c", "#6366f1", "#7c2d12", "#10b981"],
    stateColors: {
      IDLE: { bgColor: "bg-green-700", textColor: "text-white" },
      MIXED: { bgColor: "bg-orange-800", textColor: "text-white" },
      ALLOCATED: { bgColor: "bg-red-900", textColor: "text-white" },
      DOWN: { bgColor: "bg-blue-400", textColor: "text-white" },
      DRAIN: { bgColor: "bg-blue-400", textColor: "text-white" },
      NOT_RESPONDING: { bgColor: "bg-blue-400", textColor: "text-white" },
      PLANNED: { bgColor: "bg-cyan-600", textColor: "text-white" },
      COMPLETING: { bgColor: "bg-yellow-500", textColor: "text-white" },
      RESERVED: { bgColor: "bg-indigo-800", textColor: "text-white" },
      FUTURE: { bgColor: "bg-emerald-500", textColor: "text-white" },
      REBOOT_REQUESTED: { bgColor: "bg-stone-500", textColor: "text-white" },
    },
    progressColors: {
      idle: "#15803d", // green-700
      mixed: "#9a3412", // orange-800
      allocated: "#7f1d1d", // red-900
      down: "#60a5fa", // blue-400
      drain: "#60a5fa", // blue-400
      unknown: "#60a5fa", // blue-400
    },
  },
  {
    value: "midnight",
    label: "Midnight",
    colors: ["#6366f1", "#a78bfa", "#f472b6", "#38bdf8", "#818cf8", "#c084fc"],
    stateColors: {
      IDLE: { bgColor: "bg-violet-400", textColor: "text-black" },
      MIXED: { bgColor: "bg-indigo-500", textColor: "text-white" },
      ALLOCATED: { bgColor: "bg-fuchsia-700", textColor: "text-white" },
      DOWN: { bgColor: "bg-slate-500", textColor: "text-white" },
      DRAIN: { bgColor: "bg-slate-500", textColor: "text-white" },
      NOT_RESPONDING: { bgColor: "bg-slate-500", textColor: "text-white" },
      PLANNED: { bgColor: "bg-sky-500", textColor: "text-white" },
      COMPLETING: { bgColor: "bg-pink-400", textColor: "text-black" },
      RESERVED: { bgColor: "bg-purple-800", textColor: "text-white" },
      FUTURE: { bgColor: "bg-blue-400", textColor: "text-black" },
      REBOOT_REQUESTED: { bgColor: "bg-gray-700", textColor: "text-white" },
    },
    progressColors: {
      idle: "#a78bfa", // violet-400
      mixed: "#6366f1", // indigo-500
      allocated: "#a21caf", // fuchsia-700
      down: "#64748b", // slate-500
      drain: "#64748b", // slate-500
      unknown: "#64748b", // slate-500
    },
  },
  {
    value: "nordic",
    label: "Nordic",
    colors: ["#0d9488", "#34d399", "#4f46e5", "#0ea5e9", "#1e40af", "#22d3ee"],
    stateColors: {
      IDLE: { bgColor: "bg-emerald-400", textColor: "text-black" },
      MIXED: { bgColor: "bg-indigo-600", textColor: "text-white" },
      ALLOCATED: { bgColor: "bg-blue-800", textColor: "text-white" },
      DOWN: { bgColor: "bg-teal-600", textColor: "text-white" },
      DRAIN: { bgColor: "bg-teal-600", textColor: "text-white" },
      NOT_RESPONDING: { bgColor: "bg-teal-600", textColor: "text-white" },
      PLANNED: { bgColor: "bg-cyan-500", textColor: "text-black" },
      COMPLETING: { bgColor: "bg-green-400", textColor: "text-black" },
      RESERVED: { bgColor: "bg-violet-800", textColor: "text-white" },
      FUTURE: { bgColor: "bg-sky-400", textColor: "text-black" },
      REBOOT_REQUESTED: { bgColor: "bg-slate-700", textColor: "text-white" },
    },
    progressColors: {
      idle: "#34d399", // emerald-400
      mixed: "#4f46e5", // indigo-600
      allocated: "#1e40af", // blue-800
      down: "#0d9488", // teal-600
      drain: "#0d9488", // teal-600
      unknown: "#0d9488", // teal-600
    },
  },
  {
    value: "autumn",
    label: "Autumn",
    colors: ["#f59e0b", "#ef4444", "#84cc16", "#d97706", "#b45309", "#eab308"],
    stateColors: {
      IDLE: { bgColor: "bg-lime-500", textColor: "text-black" },
      MIXED: { bgColor: "bg-amber-500", textColor: "text-black" },
      ALLOCATED: { bgColor: "bg-red-700", textColor: "text-white" },
      DOWN: { bgColor: "bg-stone-500", textColor: "text-white" },
      DRAIN: { bgColor: "bg-stone-500", textColor: "text-white" },
      NOT_RESPONDING: { bgColor: "bg-stone-500", textColor: "text-white" },
      PLANNED: { bgColor: "bg-yellow-500", textColor: "text-black" },
      COMPLETING: { bgColor: "bg-orange-400", textColor: "text-black" },
      RESERVED: { bgColor: "bg-amber-800", textColor: "text-white" },
      FUTURE: { bgColor: "bg-emerald-500", textColor: "text-white" },
      REBOOT_REQUESTED: { bgColor: "bg-zinc-600", textColor: "text-white" },
    },
    progressColors: {
      idle: "#84cc16", // lime-500
      mixed: "#f59e0b", // amber-500
      allocated: "#b91c1c", // red-700
      down: "#78716c", // stone-500
      drain: "#78716c", // stone-500
      unknown: "#78716c", // stone-500
    },
  },
  {
    value: "desert",
    label: "Desert",
    colors: ["#ea580c", "#fcd34d", "#be185d", "#b91c1c", "#7e22ce", "#f59e0b"],
    stateColors: {
      IDLE: { bgColor: "bg-amber-300", textColor: "text-black" },
      MIXED: { bgColor: "bg-rose-800", textColor: "text-white" },
      ALLOCATED: { bgColor: "bg-purple-800", textColor: "text-white" },
      DOWN: { bgColor: "bg-orange-600", textColor: "text-white" },
      DRAIN: { bgColor: "bg-orange-600", textColor: "text-white" },
      NOT_RESPONDING: { bgColor: "bg-orange-600", textColor: "text-white" },
      PLANNED: { bgColor: "bg-red-500", textColor: "text-white" },
      COMPLETING: { bgColor: "bg-yellow-600", textColor: "text-black" },
      RESERVED: { bgColor: "bg-red-900", textColor: "text-white" },
      FUTURE: { bgColor: "bg-amber-500", textColor: "text-black" },
      REBOOT_REQUESTED: { bgColor: "bg-stone-800", textColor: "text-white" },
    },
    progressColors: {
      idle: "#fcd34d", // amber-300
      mixed: "#be185d", // rose-800
      allocated: "#6b21a8", // purple-800
      down: "#ea580c", // orange-600
      drain: "#ea580c", // orange-600
      unknown: "#ea580c", // orange-600
    },
  },
  {
    value: "ocean",
    label: "Ocean",
    colors: ["#0284c7", "#22d3ee", "#1e40af", "#0d9488", "#1e3a8a", "#06b6d4"],
    stateColors: {
      IDLE: { bgColor: "bg-cyan-400", textColor: "text-black" },
      MIXED: { bgColor: "bg-blue-700", textColor: "text-white" },
      ALLOCATED: { bgColor: "bg-indigo-800", textColor: "text-white" },
      DOWN: { bgColor: "bg-sky-600", textColor: "text-white" },
      DRAIN: { bgColor: "bg-sky-600", textColor: "text-white" },
      NOT_RESPONDING: { bgColor: "bg-sky-600", textColor: "text-white" },
      PLANNED: { bgColor: "bg-teal-500", textColor: "text-white" },
      COMPLETING: { bgColor: "bg-emerald-400", textColor: "text-black" },
      RESERVED: { bgColor: "bg-blue-900", textColor: "text-white" },
      FUTURE: { bgColor: "bg-cyan-500", textColor: "text-black" },
      REBOOT_REQUESTED: { bgColor: "bg-slate-800", textColor: "text-white" },
    },
    progressColors: {
      idle: "#22d3ee", // cyan-400
      mixed: "#1d4ed8", // blue-700
      allocated: "#3730a3", // indigo-800
      down: "#0284c7", // sky-600
      drain: "#0284c7", // sky-600
      unknown: "#0284c7", // sky-600
    },
  },
];

// Helper function to get a color schema by value
export function getColorSchema(value: string): ColorSchema {
  return (
    COLOR_SCHEMAS.find((schema) => schema.value === value) || COLOR_SCHEMAS[0]
  );
}

// Helper function to get status colors for node cards
export function getStatusColor(
  status: string | string[],
  colorSchema: string = "default"
) {
  const schema = getColorSchema(colorSchema);
  
  // Normalize status to an array
  let statusArray: string[];
  if (Array.isArray(status)) {
    statusArray = status;
  } else if (typeof status === "string") {
    // Handle both "+" joined and space-separated formats
    statusArray = status.split(/[+\s]+/).filter(Boolean).map(s => s.toUpperCase());
  } else {
    statusArray = ["IDLE"];
  }
  
  // Priority order for status colors (check in order of visual importance)
  const priorityOrder = [
    "DOWN", "NOT_RESPONDING", "DRAIN", "REBOOT_REQUESTED",
    "RESERVED", "COMPLETING", "MIXED", "ALLOCATED", "PLANNED", "FUTURE", "IDLE"
  ];
  
  for (const priorityStatus of priorityOrder) {
    if (statusArray.some(s => s.includes(priorityStatus))) {
      return schema.stateColors[priorityStatus as keyof typeof schema.stateColors];
    }
  }

  return schema.stateColors.IDLE; // Fallback to IDLE if status not found
}
