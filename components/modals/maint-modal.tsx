import { Dialog, DialogContent, DialogTitle } from "../ui/dialog";
import { useState, useEffect } from "react";

const MaintModal = ({ open, setOpen, maintenanceData }: any) => {
  const [countdown, setCountdown] = useState("");
  const reservations = maintenanceData?.reservations ?? [];

  function convertUnixToHumanReadable(unixTimestamp: any) {
    const date = new Date(unixTimestamp * 1000);
    const formattedDate = date.toLocaleString();
    return formattedDate;
  }

  function formatDuration(ms: number) {
    if (ms <= 0 || Number.isNaN(ms)) return "0s";
    const days = Math.floor(ms / (1000 * 60 * 60 * 24));
    const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((ms % (1000 * 60)) / 1000);
    const parts = [] as string[];
    if (days) parts.push(`${days}d`);
    if (hours) parts.push(`${hours}h`);
    if (minutes) parts.push(`${minutes}m`);
    if (!days && !hours && !minutes) parts.push(`${seconds}s`);
    return parts.join(" ");
  }

  function resolveReservationTitle(r: any, idx: number) {
    const candidate =
      r?.name ||
      r?.reservation_name ||
      r?.title ||
      r?.description ||
      r?.reason ||
      r?.comment;
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate.trim();
    }
    return `Maintenance Window`;
  }

  function getRelativeText(
    isActive: boolean,
    isUpcoming: boolean,
    startMs: number,
    endMs: number
  ) {
    const nowMs = Date.now();
    if (isActive) return `Ends in ${formatDuration(endMs - nowMs)}`;
    if (isUpcoming) return `Starts in ${formatDuration(startMs - nowMs)}`;
    return `Ended ${formatDuration(nowMs - endMs)} ago`;
  }

  function getFirstAvailableValue(obj: any, keys: string[]) {
    for (const key of keys) {
      const value = obj?.[key];
      if (value === undefined || value === null) continue;
      const str = typeof value === "string" ? value : String(value);
      if (str.trim().length > 0) return str.trim();
    }
    return undefined;
  }

  useEffect(() => {
    if (!maintenanceData || !reservations || reservations.length === 0) {
      setCountdown("No maintenance data available.");
      return;
    }

    const sorted = [...reservations].sort(
      (a: any, b: any) => a.start_time.number - b.start_time.number
    );
    const now = new Date().getTime();
    const nextUpcoming = sorted.find(
      (r: any) => r?.start_time?.number * 1000 > now
    );
    const startTime = (nextUpcoming ?? sorted[0])?.start_time?.number * 1000;
    if (isNaN(startTime)) {
      setCountdown("Invalid start time.");
      return;
    }

    const interval = setInterval(() => {
      const now = new Date().getTime();
      const distance = startTime - now;

      if (distance < 0) {
        clearInterval(interval);
        setCountdown("Maintenance has started.");
      } else {
        const days = Math.floor(distance / (1000 * 60 * 60 * 24));
        const hours = Math.floor(
          (distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
        );
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);
        setCountdown(`${days}d ${hours}h ${minutes}m ${seconds}s`);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [maintenanceData]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        aria-describedby={undefined}
        className="border shadow-xl w-[1200px] max-w-[90%] max-h-[90%] overflow-y-auto scrollbar-none"
      >
        {maintenanceData && (
          <div className="m-auto">
            <DialogTitle className="text-2xl font-bold mb-2">
              NOTICE
            </DialogTitle>
            {reservations.length <= 1 ? (
              <>
                <h1 className="text-xl mb-2 font-extralight">
                  A regular maintenance of{" "}
                  <span className="font-bold">
                    {maintenanceData.meta.slurm.cluster}
                  </span>{" "}
                  will begin on{" "}
                  <span className="font-bold">
                    {convertUnixToHumanReadable(
                      reservations[0]?.start_time?.number
                    )}
                  </span>{" "}
                  and will last until{" "}
                  <span className="font-bold">
                    {convertUnixToHumanReadable(
                      reservations[0]?.end_time?.number
                    )}
                  </span>
                  . Submitted jobs that overlap with this scheduled maintenance
                  period will not start until after the maintenance is completed.
                  Please be mindful of the wall time of submitted jobs.{" "}
                  <span className="text-red-500">
                    This notice will be silenced for the next 24 hours
                  </span>
                </h1>
                <div className="text-lg font-light mt-4">
                  Time remaining until maintenance:{" "}
                  <span className="text-red-500 font-bold">{countdown}</span>
                </div>
              </>
            ) : (
              <>
                <h1 className="text-xl mb-4 font-extralight">
                  There are multiple scheduled maintenance windows for{" "}
                  <span className="font-bold">
                    {maintenanceData.meta.slurm.cluster}
                  </span>
                  . Review the details below.
                  {" "}
                  <span className="text-red-500">
                    This notice will be silenced for the next 24 hours
                  </span>
                </h1>
                <p className="text-sm mb-4 font-extralight">
                  Submitted jobs that overlap with a scheduled maintenance period will not
                  start until after the maintenance is completed. Please be mindful of the
                  wall time of submitted jobs.
                </p>
                <div className="text-sm text-muted-foreground mb-2">
                  Next maintenance in: {" "}
                  <span className="text-red-500 font-semibold">{countdown}</span>
                </div>
                <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
                  {[...reservations]
                    .sort(
                      (a: any, b: any) =>
                        a.start_time.number - b.start_time.number
                    )
                    .map((r: any, idx: number) => {
                      const nowMs = Date.now();
                      const startMs = r?.start_time?.number * 1000;
                      const endMs = r?.end_time?.number * 1000;
                      const isUpcoming = startMs > nowMs;
                      const isActive = startMs <= nowMs && endMs > nowMs;
                      const status = isActive
                        ? "In progress"
                        : isUpcoming
                          ? "Upcoming"
                          : "Completed";
                      const statusClass = isActive
                        ? "bg-amber-500/10 text-amber-300 ring-1 ring-inset ring-amber-400/30"
                        : isUpcoming
                          ? "bg-emerald-500/10 text-emerald-400 ring-1 ring-inset ring-emerald-600/30"
                          : "bg-zinc-600/10 text-zinc-400 ring-1 ring-inset ring-zinc-500/30";
                      const duration = formatDuration(endMs - startMs);
                      return (
                        <div
                          key={`${r?.id ?? idx}`}
                          className="rounded-md border p-4 hover:bg-muted/40 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <div className="text-base font-semibold">
                              {resolveReservationTitle(r, idx).toUpperCase()}
                            </div>
                            <span className={`inline-flex items-center rounded-sm px-2.5 py-1 text-xs font-medium ${statusClass}`}>
                              {status}
                            </span>
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {getRelativeText(isActive, isUpcoming, startMs, endMs)}
                          </div>
                          <div className="mt-2 grid gap-1 text-sm">
                            <div>
                              <span className="font-medium">Start:</span>{" "}
                              {convertUnixToHumanReadable(r.start_time.number)}
                            </div>
                            <div>
                              <span className="font-medium">End:</span>{" "}
                              {convertUnixToHumanReadable(r.end_time.number)}
                            </div>
                            <div>
                              <span className="font-medium">Duration:</span>{" "}
                              {duration}
                            </div>
                            {(() => {
                              const nodes = getFirstAvailableValue(r, [
                                "node_list",
                                "nodelist",
                                "nodes",
                              ]);
                              return nodes ? (
                                <div>
                                  <span className="font-medium">Nodes:</span>{" "}
                                  {nodes}
                                </div>
                              ) : null;
                            })()}
                            {(() => {
                              const partitions = getFirstAvailableValue(r, [
                                "partition",
                                "partitions",
                              ]);
                              return partitions ? (
                                <div>
                                  <span className="font-medium">Partitions:</span>{" "}
                                  {partitions}
                                </div>
                              ) : null;
                            })()}
                            {(() => {
                              const account = getFirstAvailableValue(r, [
                                "account",
                                "accounts",
                              ]);
                              return account ? (
                                <div>
                                  <span className="font-medium">Account:</span>{" "}
                                  {account}
                                </div>
                              ) : null;
                            })()}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default MaintModal;
