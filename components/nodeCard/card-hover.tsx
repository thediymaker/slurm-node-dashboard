export default function CardHover({
  nodeData,
  cpuLoad,
  gpuAllocations,
  usedGpuAllocations,
  statusDef,
}: any) {
  return (
    <div>
      <div>Hostname: {nodeData.hostname}</div>
      <div>CPU Load: {cpuLoad} %</div>
      <div className="flex flex-wrap items-center">
        Features:
        {nodeData.features.map((feature: any, index: any) => (
          <div
            className="p-1 border-2 rounded-lg m-1 text-sm font-extralight"
            key={index}
          >
            {feature}
          </div>
        ))}
      </div>
      <div className="flex w-full items-center">
        Partitions:
        {nodeData.partitions.map((partition: any, index: any) => (
          <div
            className="p-1 border-2 rounded-lg m-1 text-sm font-extralight w-fit"
            key={index}
          >
            {partition}
          </div>
        ))}
      </div>
      {nodeData.gres === "" ? null : (
        <>
          <div className="flex w-full items-center">
            GPUs (Total):
            {gpuAllocations.map((gpu: any, index: any) => (
              <div
                className="p-1 border-2 rounded-lg m-1 text-sm font-extralight w-fit"
                key={index}
              >
                {gpu.type} (
                <span className="text-red-500 font-bold">{gpu.count}</span>)
              </div>
            ))}
          </div>
          <div className="flex w-full items-center">
            GPUs (Used):
            {usedGpuAllocations
              .filter((gpu: any) => gpu.indexRange !== undefined)
              .map((gpu: any, index: any) => (
                <div
                  className="p-1 border-2 rounded-lg m-1 text-sm font-extralight"
                  key={index}
                >
                  {gpu.type} (
                  <span className="text-red-500 font-bold">{gpu.count}</span>)
                </div>
              ))}
          </div>
        </>
      )}
      <div>
        Note:
        <div className="p-1 border-2 rounded-lg m-1 text-sm font-extralight">
          {statusDef}
        </div>
        {nodeData.reason === "" ? null : (
          <>
            Reason:
            <div className="p-1 border-2 rounded-lg m-1 text-sm font-extralight">
              {nodeData.reason}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
