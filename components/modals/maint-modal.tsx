import { Dialog, DialogContent, DialogTitle } from "../ui/dialog";
import { useState, useEffect } from "react";

const MaintModal = ({ open, setOpen, maintenanceData }: any) => {
  const [countdown, setCountdown] = useState("");

  function convertUnixToHumanReadable(unixTimestamp: any) {
    const date = new Date(unixTimestamp * 1000);
    const formattedDate = date.toLocaleString();
    return formattedDate;
  }

  useEffect(() => {
    if (
      !maintenanceData ||
      !maintenanceData.reservations ||
      maintenanceData.reservations.length === 0
    ) {
      setCountdown("No maintenance data available.");
      return;
    }

    const startTime = maintenanceData.reservations[0].start_time.number * 1000;
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
      <DialogContent className="border shadow-xl w-[1200px] max-w-[90%] max-h-[90%] overflow-y-auto scrollbar-none">
        {maintenanceData && (
          <div className="m-auto">
            <DialogTitle className="text-2xl font-bold mb-2">
              NOTICE
            </DialogTitle>
            <h1 className="text-xl mb-2 font-extralight">
              A regular maintenance of{" "}
              <span className="font-bold">
                {maintenanceData.meta.slurm.cluster}
              </span>{" "}
              will begin on{" "}
              <span className="font-bold">
                {convertUnixToHumanReadable(
                  maintenanceData.reservations[0].start_time.number
                )}
              </span>{" "}
              and will last until{" "}
              <span className="font-bold">
                {convertUnixToHumanReadable(
                  maintenanceData.reservations[0].end_time.number
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
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default MaintModal;
