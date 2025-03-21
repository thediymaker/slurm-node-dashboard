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
      PLANNED: { bgColor: "bg-indigo-500", textColor: "text-white" },
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
    value: "neon",
    label: "Neon",
    colors: ["#d946ef", "#22d3ee", "#eab308", "#9333ea", "#ec4899", "#2dd4bf"],
    stateColors: {
      IDLE: { bgColor: "bg-cyan-400", textColor: "text-black" },
      MIXED: { bgColor: "bg-yellow-400", textColor: "text-black" },
      ALLOCATED: { bgColor: "bg-rose-500", textColor: "text-white" },
      DOWN: { bgColor: "bg-fuchsia-500", textColor: "text-black" },
      DRAIN: { bgColor: "bg-fuchsia-500", textColor: "text-black" },
      NOT_RESPONDING: { bgColor: "bg-fuchsia-500", textColor: "text-black" },
      PLANNED: { bgColor: "bg-purple-600", textColor: "text-white" },
      COMPLETING: { bgColor: "bg-lime-400", textColor: "text-black" },
      RESERVED: { bgColor: "bg-violet-600", textColor: "text-white" },
      FUTURE: { bgColor: "bg-teal-400", textColor: "text-black" },
      REBOOT_REQUESTED: { bgColor: "bg-zinc-800", textColor: "text-white" },
    },
    progressColors: {
      idle: "#22d3ee", // cyan-400
      mixed: "#facc15", // yellow-400
      allocated: "#f43f5e", // rose-500
      down: "#d946ef", // fuchsia-500
      drain: "#d946ef", // fuchsia-500
      unknown: "#d946ef", // fuchsia-500
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
    value: "candy",
    label: "Candy",
    colors: ["#ec4899", "#4ade80", "#a855f7", "#eab308", "#dc2626", "#3b82f6"],
    stateColors: {
      IDLE: { bgColor: "bg-green-400", textColor: "text-black" },
      MIXED: { bgColor: "bg-purple-500", textColor: "text-white" },
      ALLOCATED: { bgColor: "bg-red-600", textColor: "text-white" },
      DOWN: { bgColor: "bg-pink-500", textColor: "text-white" },
      DRAIN: { bgColor: "bg-pink-500", textColor: "text-white" },
      NOT_RESPONDING: { bgColor: "bg-pink-500", textColor: "text-white" },
      PLANNED: { bgColor: "bg-yellow-400", textColor: "text-black" },
      COMPLETING: { bgColor: "bg-blue-400", textColor: "text-black" },
      RESERVED: { bgColor: "bg-violet-500", textColor: "text-white" },
      FUTURE: { bgColor: "bg-lime-400", textColor: "text-black" },
      REBOOT_REQUESTED: { bgColor: "bg-neutral-600", textColor: "text-white" },
    },
    progressColors: {
      idle: "#4ade80", // green-400
      mixed: "#a855f7", // purple-500
      allocated: "#dc2626", // red-600
      down: "#ec4899", // pink-500
      drain: "#ec4899", // pink-500
      unknown: "#ec4899", // pink-500
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
  status: string,
  colorSchema: string = "default"
) {
  const schema = getColorSchema(colorSchema);
  const statusLevel = Array.isArray(status) ? status[1] || status[0] : status;

  return (
    schema.stateColors[statusLevel as keyof typeof schema.stateColors] ||
    schema.stateColors.IDLE // Fallback to IDLE if status not found
  );
}
