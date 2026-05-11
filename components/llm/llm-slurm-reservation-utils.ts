export interface ReservationTimestamp {
  number?: number;
}

type ReservationCount = number | { number?: number };

export interface ReservationRecord {
  name?: string;
  accounts?: string;
  users?: string;
  start_time?: ReservationTimestamp;
  end_time?: ReservationTimestamp;
  duration?: ReservationTimestamp;
  nodes?: string;
  node_list?: string;
  node_cnt?: ReservationCount;
  node_count?: ReservationCount;
  core_cnt?: ReservationCount;
  core_count?: ReservationCount;
  features?: string;
  partition?: string;
  flags?: string[];
}

export interface ReservationStatus {
  label: "Upcoming" | "Active" | "Expired";
  color: string;
}

export interface NormalizedReservation {
  name: string;
  accounts: string;
  users: string;
  startTime: number;
  endTime: number;
  durationSeconds: number;
  nodeCount: number;
  coreCount: number;
  nodeList: string;
  features: string;
  partition: string;
  flags: string[];
  status: ReservationStatus;
}

const RESERVATION_TIME_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "UTC",
  timeZoneName: "short",
});

const getCount = (value: ReservationCount | undefined): number => {
  if (typeof value === "number") return value;
  if (typeof value === "object" && value !== null) return value.number ?? 0;
  return 0;
};

export const getReservationStatus = (
  startTime: number,
  endTime: number
): ReservationStatus => {
  const now = Date.now() / 1000;

  if (startTime > 0 && now < startTime) {
    return {
      label: "Upcoming",
      color: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    };
  }

  if (startTime > 0 && endTime > 0 && now >= startTime && now < endTime) {
    return {
      label: "Active",
      color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    };
  }

  return {
    label: "Expired",
    color: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  };
};

export const normalizeReservation = (
  reservation: ReservationRecord
): NormalizedReservation => {
  const startTime = reservation.start_time?.number ?? 0;
  const endTime = reservation.end_time?.number ?? 0;
  const explicitDurationSeconds = reservation.duration?.number ?? 0;
  const derivedDurationSeconds =
    startTime > 0 && endTime > startTime ? endTime - startTime : 0;
  const nodeCount = getCount(reservation.node_count) || getCount(reservation.node_cnt);
  const coreCount = getCount(reservation.core_count) || getCount(reservation.core_cnt);

  return {
    name: reservation.name || "unknown",
    accounts: reservation.accounts || "",
    users: reservation.users || "",
    startTime,
    endTime,
    durationSeconds: explicitDurationSeconds || derivedDurationSeconds,
    nodeCount,
    coreCount,
    nodeList: reservation.node_list || reservation.nodes || "",
    features: reservation.features || "",
    partition: reservation.partition || "",
    flags: Array.isArray(reservation.flags) ? reservation.flags : [],
    status: getReservationStatus(startTime, endTime),
  };
};

export const formatReservationTime = (unixTimestamp: number): string => {
  if (!unixTimestamp) return "N/A";
  return RESERVATION_TIME_FORMATTER.format(new Date(unixTimestamp * 1000));
};

export const formatReservationWindow = (
  startTime: number,
  endTime: number
): string => {
  if (!startTime && !endTime) return "N/A";
  if (!endTime) return formatReservationTime(startTime);
  if (!startTime) return formatReservationTime(endTime);
  return `${formatReservationTime(startTime)} -> ${formatReservationTime(endTime)}`;
};

export const formatReservationRelativeTime = (
  unixTimestamp: number
): string => {
  if (!unixTimestamp) return "N/A";

  const diffSeconds = Math.round(unixTimestamp - Date.now() / 1000);
  const absDiff = Math.abs(diffSeconds);
  const days = Math.floor(absDiff / 86400);
  const hours = Math.floor((absDiff % 86400) / 3600);
  const minutes = Math.floor((absDiff % 3600) / 60);
  const seconds = absDiff % 60;
  const parts: string[] = [];

  if (days > 0) parts.push(`${days}d`);
  if (hours > 0 && parts.length < 2) parts.push(`${hours}h`);
  if (minutes > 0 && parts.length < 2) parts.push(`${minutes}m`);
  if (parts.length === 0) parts.push(`${seconds}s`);

  return diffSeconds >= 0 ? `in ${parts.join(" ")}` : `${parts.join(" ")} ago`;
};