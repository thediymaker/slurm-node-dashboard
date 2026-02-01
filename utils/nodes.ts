export function getStatusDef(status: string | string[]): string {
  // Normalize status to find the primary state
  let statusArray: string[];
  if (Array.isArray(status)) {
    statusArray = status;
  } else if (typeof status === "string") {
    statusArray = status.split(/[+\s]+/).filter(Boolean).map(s => s.toUpperCase());
  } else {
    return "System status unknown, this is likely due to the system being offline.";
  }
  
  // Priority order for status definitions
  const priorityOrder = [
    "DOWN", "NOT_RESPONDING", "DRAIN", "REBOOT_REQUESTED",
    "RESERVED", "COMPLETING", "MIXED", "ALLOCATED", "PLANNED", "FUTURE", "IDLE"
  ];
  
  let statusLevel = "UNKNOWN";
  for (const priorityStatus of priorityOrder) {
    if (statusArray.some(s => s.includes(priorityStatus))) {
      statusLevel = priorityStatus;
      break;
    }
  }
  
  switch (statusLevel) {
    case "DRAIN":
    case "NOT_RESPONDING":
    case "DOWN":
      return "This System is currently unavailable. This could be due to maintenance, or hardware issues.";
    case "IDLE":
      return "System is idle ready for use.";
    case "MIXED":
      return "System is currently in use, but not fully allocated.";
    case "ALLOCATED":
      return "System is fully allocated.";
    case "COMPLETING":
      return "System is currently in the process of completing a task.";
    case "PLANNED":
      return "System is being prepared for use.";
    case "RESERVED":
      return "System is reserved for maintenance.";
    case "FUTURE":
      return "System is reserved for future use.";
    case "REBOOT_REQUESTED":
      return "System currently has a reboot request pending.";
    default:
      return "System status unknown, this is likely due to the system being offline.";
  }
}

export function convertUnixToHumanReadable(unixTimestamp: any) {
  const date = new Date(unixTimestamp * 1000);
  const formattedDate = date.toLocaleString();
  return formattedDate;
}

export const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));
