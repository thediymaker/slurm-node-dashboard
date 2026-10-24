import React, { useState, memo, useMemo } from "react";
import { useInView } from "react-intersection-observer";
import { CircleAlert, Lock, Pause, RotateCw, Wrench, type LucideIcon } from "lucide-react";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import NodeCardModal from "@/components/modals/card-job-modal";
import { getStatusDef } from "@/utils/nodes";
import CardHover from "./card-hover";
import { parseGPUResources } from "@/utils/gpu-parse";
import { NodeCardProps } from "@/types/types";
import { getColorSchema, getStatusColor } from "@/lib/color-schemas";
import { ShineBorder } from "@/components/ui/shine-border";
import { cn } from "@/lib/utils";
import type { NodeExtras } from "@/app/api/nodes/extras/route";
import type { NodeState } from "@/lib/node-history";
import { STATE_LABELS, formatPower, loadRatio, OVERLOAD_RATIO, stateOf, usedGpuIndexes } from "./node-view";

// Corner icons for states the color alone doesn't tell apart
const STATE_ICONS: Partial<Record<NodeState, LucideIcon>> = {
  drained: Pause,
  down: CircleAlert,
  maintenance: Wrench,
  reserved: Lock,
};

interface CardModel {
  name: string;
  state: NodeState;
  reboot: boolean;
  cpuPct: number;
  memPct: number;
  loadPct: number;
  overloaded: boolean;
  gpuTotal: number;
  gpuUsed: number;
  gpuInUse: boolean[];
  // Dark text on the light drain/down colors
  light: boolean;
}

const pct = (used: number, total: number) => (total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0);

function Bar({ value, height, light }: { value: number; height: number; light: boolean }) {
  return (
    <div
      className={cn("relative flex-1 rounded-[3px]", light ? "bg-slate-900/20" : "bg-black/30")}
      style={{ height }}
    >
      <div className="h-full rounded-[3px] bg-current transition-[width] duration-300" style={{ width: `${value}%` }} />
    </div>
  );
}

// Allocated GPUs as one segmented bar
function GpuSegments({ model, height }: { model: CardModel; height: number }) {
  return (
    <div className="flex flex-1 gap-0.5">
      {model.gpuInUse.map((used, i) => (
        <div
          key={i}
          className={cn("flex-1 rounded-[2px]", used ? "bg-current" : model.light ? "bg-slate-900/20" : "bg-white/20")}
          style={{ height }}
        />
      ))}
    </div>
  );
}

const SmallCardContent = memo(({ model }: { model: CardModel }) => (
  <div className="flex h-full flex-col justify-between p-[5px]">
    <div className="truncate text-[9px] font-bold uppercase leading-none" title={model.name}>
      {model.name}
    </div>
    <div className="flex flex-col gap-0.5">
      <Bar value={model.cpuPct} height={3} light={model.light} />
      {model.gpuTotal > 0 && <GpuSegments model={model} height={2} />}
    </div>
  </div>
));
SmallCardContent.displayName = "SmallCardContent";

function CornerIcon({ model, size }: { model: CardModel; size: number }) {
  const Icon = model.reboot ? RotateCw : STATE_ICONS[model.state];
  return Icon ? <Icon aria-hidden className="flex-none" style={{ width: size, height: size }} strokeWidth={2.4} /> : null;
}

// Label and value over a full-width bar, top-down from the name, like the
// pre-3.0 cards. CPU nodes show load where GPU nodes show their GPUs.
const MediumCardContent = memo(({ model }: { model: CardModel }) => {
  const sub = model.light ? "text-slate-900/75" : "text-white/85";
  const stacked = (label: string, text: string, bar: React.ReactNode) => (
    <div className="flex flex-col gap-[3px]">
      <div className={cn("flex justify-between text-[10px] leading-none tabular-nums", sub)}>
        <span>{label}</span>
        <span>{text}</span>
      </div>
      <div className="flex">{bar}</div>
    </div>
  );
  return (
    <div className="flex h-full flex-col gap-1.5 p-2">
      <div className="flex min-w-0 items-start justify-between gap-1">
        <span className="truncate text-[13px] font-bold uppercase leading-tight" title={model.name}>
          {model.name}
        </span>
        <CornerIcon model={model} size={12} />
      </div>
      <div className="flex flex-col gap-1">
        {stacked("CPU", `${model.cpuPct}%`, <Bar value={model.cpuPct} height={4} light={model.light} />)}
        {stacked("MEM", `${model.memPct}%`, <Bar value={model.memPct} height={4} light={model.light} />)}
        {model.gpuTotal > 0
          ? stacked("GPU", `${model.gpuUsed}/${model.gpuTotal}`, <GpuSegments model={model} height={4} />)
          : stacked("LOAD", `${model.loadPct}%`, <Bar value={Math.min(100, model.loadPct)} height={4} light={model.light} />)}
      </div>
    </div>
  );
});
MediumCardContent.displayName = "MediumCardContent";

const LargeCardContent = memo(
  ({ model, extras, watts, tempWarn, cores }: { model: CardModel; extras?: NodeExtras; watts?: number; tempWarn: number; cores: number }) => {
    const sub = model.light ? "text-slate-900/85" : "text-white/85";
    const power = watts ?? extras?.power;
    const temp = extras?.temp;
    const hot = temp !== undefined && temp >= tempWarn;

    // Last hour of load as a faint area behind the card, scaled to the core count
    const trend = useMemo(() => {
      const load = extras?.load;
      if (!load || load.length < 2 || !cores) return null;
      const pts = load.map((v, i) => [(i * 120) / (load.length - 1), 40 - Math.min(1, v / cores) * 36]);
      const line = "M" + pts.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join("L");
      return { line, area: `${line}L120 40L0 40Z` };
    }, [extras?.load, cores]);

    const many = model.gpuTotal > 4;
    const util = extras?.gpuUtil;

    const row = (label: string, value: number, text: string) => (
      <div className="flex items-center gap-1.5">
        <span className={cn("w-[30px] flex-none text-[11px] font-medium", sub)}>{label}</span>
        <Bar value={value} height={6} light={model.light} />
        <span className={cn("w-[34px] flex-none text-right text-[11px] tabular-nums", sub)}>
          {text}
        </span>
      </div>
    );

    return (
      <div className="relative flex h-full flex-col justify-between p-[11px]">
        {trend && (
          <svg
            viewBox="0 0 120 40"
            preserveAspectRatio="none"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-14 w-full"
            aria-hidden
          >
            <path d={trend.area} fill="currentColor" fillOpacity={0.13} />
            <path d={trend.line} fill="none" stroke="currentColor" strokeOpacity={0.45} strokeWidth={1} vectorEffect="non-scaling-stroke" />
          </svg>
        )}
        <div className="relative flex items-baseline justify-between gap-1">
          <span className="inline-flex min-w-0 items-center gap-[5px]">
            <span className="truncate text-[16px] font-bold uppercase leading-tight" title={model.name}>
              {model.name}
            </span>
            <CornerIcon model={model} size={14} />
          </span>
          {(power !== undefined || temp !== undefined) && (
            <span className={cn("whitespace-nowrap text-[11px] tabular-nums", sub)}>
              {power !== undefined && formatPower(power)}
              {power !== undefined && temp !== undefined && " · "}
              {temp !== undefined && <span className={hot ? "font-semibold text-yellow-300" : undefined}>{temp}°</span>}
            </span>
          )}
        </div>
        <div className="relative flex flex-col gap-2">
          {row("CPU", model.cpuPct, `${model.cpuPct}%`)}
          {row("MEM", model.memPct, `${model.memPct}%`)}
          {model.gpuTotal === 0 && row("LOAD", Math.min(100, model.loadPct), `${model.loadPct}%`)}
          {model.gpuTotal > 0 && (
            <div
              className="grid gap-[3px]"
              style={{
                gridTemplateColumns: `repeat(${Math.min(4, model.gpuTotal)}, minmax(0, 1fr))`,
                gridAutoRows: many ? (model.gpuTotal > 8 ? 8 : 15) : 26,
              }}
            >
              {model.gpuInUse.map((used, i) => {
                // Fill shows utilization; an allocated GPU without DCGM data shows full
                const fill = used ? (util?.[i] ?? 100) : 0;
                return (
                  <div
                    key={i}
                    className={cn(
                      "relative overflow-hidden rounded",
                      used ? (model.light ? "bg-slate-900/25" : "bg-black/30") : model.light ? "ring-1 ring-inset ring-slate-900/30" : "ring-1 ring-inset ring-white/30"
                    )}
                    title={used ? `GPU ${i}: ${util?.[i] !== undefined ? `${util[i]}% busy` : "allocated"}` : `GPU ${i}: free`}
                  >
                    <div className="absolute inset-x-0 bottom-0 bg-current opacity-85" style={{ height: `${fill}%` }} />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }
);
LargeCardContent.displayName = "LargeCardContent";

export const NodeCard = memo(({
  colorSchema = "default",
  extras,
  changed = false,
  highlight,
  tempWarn = 80,
  ...props
}: NodeCardProps & {
  colorSchema?: string;
  extras?: NodeExtras;
  changed?: boolean;
  // While a user's or job's nodes are highlighted: true rings this card, false dims it
  highlight?: boolean;
  tempWarn?: number;
}) => {
  const [open, setOpen] = useState(false);
  const { ref, inView } = useInView({
    rootMargin: "200px", // pre-render 200px before entering viewport
  });

  const { bgColor, textColor } = useMemo(
    () => getStatusColor(props.status, colorSchema),
    [props.status, colorSchema]
  );
  const statusDef = useMemo(() => getStatusDef(props.status), [props.status]);
  const size = props.size === 50 || props.size === 150 ? props.size : 100;

  const model = useMemo<CardModel>(() => {
    const node = props.nodeData;
    const state = stateOf({ ...node, state: props.status });
    const flags = (Array.isArray(props.status) ? props.status : String(props.status).split(/[+\s]+/)).map((s) => s.toUpperCase());
    const { gpuUsed = 0, gpuTotal = 0 } = parseGPUResources(node.gres, node.gres_used) ?? {};
    const indexes = usedGpuIndexes(node.gres_used);
    const gpuInUse = Array.from({ length: gpuTotal }, (_, i) => (indexes ? indexes.has(i) : i < gpuUsed));
    const ratio = loadRatio({ ...node, cpus: props.coresTotal });
    return {
      name: props.name,
      state,
      reboot: flags.some((f) => f.includes("REBOOT")),
      cpuPct: pct(props.coresUsed, props.coresTotal),
      memPct: pct(props.memoryUsed, props.memoryTotal),
      loadPct: Math.round(ratio * 100),
      overloaded: ratio > OVERLOAD_RATIO,
      gpuTotal,
      gpuUsed,
      gpuInUse,
      light: /text-(black|slate-9)/.test(textColor),
    };
  }, [props.nodeData, props.status, props.name, props.coresUsed, props.coresTotal, props.memoryUsed, props.memoryTotal, textColor]);

  // Draining runs jobs on its way to drained: stripes of the partial color.
  // Down gets a hatch so it reads differently from drained at a glance.
  const pattern = useMemo(() => {
    if (model.state === "draining") {
      return `repeating-linear-gradient(135deg, ${getColorSchema(colorSchema).progressColors.mixed}bf 0 5px, transparent 5px 11px)`;
    }
    if (model.state === "down") return "repeating-linear-gradient(135deg, rgba(15,23,42,.35) 0 2px, transparent 2px 7px)";
    return "linear-gradient(135deg, rgba(255,255,255,.10), rgba(255,255,255,0) 45%, rgba(0,0,0,.12))";
  }, [model.state, colorSchema]);

  const background = model.state === "maintenance" ? "bg-stone-500" : bgColor;
  const shape = cn("aspect-square w-full", size === 50 ? "rounded-[5px]" : "rounded-[9px]");
  const label = `${props.name}, ${STATE_LABELS[model.state]}, CPU ${model.cpuPct}% allocated${model.gpuTotal ? `, ${model.gpuUsed} of ${model.gpuTotal} GPUs` : ""}${model.overloaded ? ", overloaded" : ""}`;

  // Off-screen: render lightweight placeholder with same dimensions and color
  // Avoids mounting HoverCard, Modal, gradients, shadows for invisible cards
  if (!inView) {
    return <div ref={ref} className={cn(shape, background, "border border-white/10", highlight === false && "opacity-25")} />;
  }

  const watts = props.nodeData.energy?.current_watts?.set !== false && props.nodeData.energy?.current_watts?.number > 0
    ? props.nodeData.energy.current_watts.number
    : undefined;

  return (
    <HoverCard openDelay={300}>
      <HoverCardTrigger asChild>
        <div
          ref={ref}
          role={props.historical ? undefined : "button"}
          tabIndex={props.historical ? undefined : 0}
          aria-label={label}
          data-node-id={props.nodeData.hostname || props.name}
          className={cn(
            shape,
            background,
            model.light ? "text-slate-900" : "text-white",
            "relative cursor-pointer overflow-hidden border border-white/10 shadow-sm",
            "transition-[transform,filter] duration-150 ease-out hover:-translate-y-px hover:brightness-110",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            changed && "ring-2 ring-foreground ring-offset-2 ring-offset-background",
            highlight === true && "ring-2 ring-yellow-300 ring-offset-2 ring-offset-background",
            highlight === false && "opacity-25 hover:opacity-60"
          )}
          style={{ contain: "layout style", backgroundImage: pattern }}
          onClick={props.historical ? undefined : () => setOpen(true)}
          onKeyDown={
            props.historical
              ? undefined
              : (e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setOpen(true);
                  }
                }
          }
        >
          {size === 50 ? (
            <SmallCardContent model={model} />
          ) : size === 100 ? (
            <MediumCardContent model={model} />
          ) : (
            <LargeCardContent model={model} extras={extras} watts={watts} tempWarn={tempWarn} cores={props.coresTotal} />
          )}

          {model.overloaded && (
            <ShineBorder
              duration={4}
              shineColor={["#ffffff", "#ffffffcc", "#ffffff80"]}
            />
          )}
        </div>
      </HoverCardTrigger>
      <HoverCardContent className="w-96 m-5 font-extralight text-sm">
        <CardHover
          nodeData={props.nodeData}
          cpuLoad={parseFloat((model.loadPct / 100).toFixed(2))}
          statusDef={statusDef}
        />
      </HoverCardContent>
      {open && <NodeCardModal open={open} setOpen={setOpen} nodename={props.name} />}
    </HoverCard>
  );
});
NodeCard.displayName = "NodeCard";

export default NodeCard;
