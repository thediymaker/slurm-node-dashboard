"use client";

import React, { useState, useEffect } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { TimeSeriesChart } from "@/components/metrics/time-series-chart";
import { UsagePieChart } from "@/components/metrics/usage-pie-chart";
import { JobStateChart } from "@/components/metrics/job-state-chart";
import { TopUsersChart } from "@/components/metrics/top-users-chart";
import { WaitTimeChart } from "@/components/metrics/wait-time-chart";
import { PartitionChart } from "@/components/metrics/partition-chart";
import { JobDurationChart } from "@/components/metrics/job-duration-chart";
import { HierarchyChart } from "@/components/metrics/hierarchy-chart";
import { HierarchyDistributionChart } from "@/components/metrics/hierarchy-distribution-chart";
import { HierarchyTrendChart } from "@/components/metrics/hierarchy-trend-chart";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Settings2 } from "lucide-react";

interface MetricsDashboardProps {
  timeSeriesData: any;
  groupData: any;
  collegeData: any;
  deptData: any;
  collegeTrendData: any;
  jobStateData: any;
  waitTimeData: any;
  topUsersData: any;
  partitionData: any;
  durationData: any;
  metric: "coreHours" | "jobCount";
}

type WidgetId =
  | "timeSeries"
  | "usageGroup"
  | "usageCollege"
  | "usageDept"
  | "trendCollege"
  | "jobState"
  | "waitTime"
  | "topUsers"
  | "partition"
  | "duration";

interface WidgetConfig {
  id: WidgetId;
  title: string;
  component: React.ReactNode;
  defaultSpan: string; // Tailwind class for span
}

function SortableItem({
  id,
  widget,
}: {
  id: WidgetId;
  widget: WidgetConfig;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : "auto",
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${widget.defaultSpan} h-[400px] cursor-move`}
      {...attributes}
      {...listeners}
    >
      {widget.component}
    </div>
  );
}

export function MetricsDashboard({
  timeSeriesData,
  groupData,
  collegeData,
  deptData,
  collegeTrendData,
  jobStateData,
  waitTimeData,
  topUsersData,
  partitionData,
  durationData,
  metric,
}: MetricsDashboardProps) {
  const [mounted, setMounted] = useState(false);
  const [visibleWidgets, setVisibleWidgets] = useState<WidgetId[]>([
    "timeSeries",
    "usageGroup",
    "usageCollege",
    "usageDept",
    "trendCollege",
    "jobState",
    "waitTime",
    "topUsers",
    "partition",
    "duration",
  ]);

  // Initial order
  const [order, setOrder] = useState<WidgetId[]>([
    "timeSeries",
    "usageGroup",
    "usageCollege",
    "usageDept",
    "trendCollege",
    "jobState",
    "waitTime",
    "topUsers",
    "partition",
    "duration",
  ]);

  const [activeId, setActiveId] = useState<WidgetId | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    setMounted(true);
    const savedOrder = localStorage.getItem("metrics-dashboard-order");
    const savedVisibility = localStorage.getItem(
      "metrics-dashboard-visibility"
    );

    if (savedOrder) {
      try {
        setOrder(JSON.parse(savedOrder));
      } catch (e) {
        console.error("Failed to parse saved order", e);
      }
    }

    if (savedVisibility) {
      try {
        setVisibleWidgets(JSON.parse(savedVisibility));
      } catch (e) {
        console.error("Failed to parse saved visibility", e);
      }
    }
  }, []);

  useEffect(() => {
    if (mounted) {
      localStorage.setItem("metrics-dashboard-order", JSON.stringify(order));
    }
  }, [order, mounted]);

  useEffect(() => {
    if (mounted) {
      localStorage.setItem(
        "metrics-dashboard-visibility",
        JSON.stringify(visibleWidgets)
      );
    }
  }, [visibleWidgets, mounted]);

  const widgets: Record<WidgetId, WidgetConfig> = {
    timeSeries: {
      id: "timeSeries",
      title: "Core Hours Over Time",
      component: <TimeSeriesChart data={timeSeriesData} metric={metric} />,
      defaultSpan: "col-span-1",
    },
    usageGroup: {
      id: "usageGroup",
      title: "Top Usage by Group",
      component: <UsagePieChart data={groupData} metric={metric} />,
      defaultSpan: "col-span-1",
    },
    usageCollege: {
      id: "usageCollege",
      title: "Usage by College",
      component: (
        <HierarchyDistributionChart
          data={collegeData}
          metric={metric}
          level="college"
        />
      ),
      defaultSpan: "col-span-1",
    },
    usageDept: {
      id: "usageDept",
      title: "Usage by Department",
      component: (
        <HierarchyChart data={deptData} metric={metric} level="department" />
      ),
      defaultSpan: "col-span-1",
    },
    trendCollege: {
      id: "trendCollege",
      title: "College Trends",
      component: (
        <HierarchyTrendChart
          data={collegeTrendData.data}
          entities={collegeTrendData.entities}
          metric={metric}
          level="college"
        />
      ),
      defaultSpan: "col-span-2",
    },
    jobState: {
      id: "jobState",
      title: "Job State Distribution",
      component: <JobStateChart data={jobStateData} />,
      defaultSpan: "col-span-1",
    },
    waitTime: {
      id: "waitTime",
      title: "Wait Time Analysis",
      component: <WaitTimeChart data={waitTimeData} />,
      defaultSpan: "col-span-1",
    },
    topUsers: {
      id: "topUsers",
      title: "Top Users",
      component: <TopUsersChart data={topUsersData} metric={metric} />,
      defaultSpan: "col-span-1",
    },
    partition: {
      id: "partition",
      title: "Partition Usage",
      component: <PartitionChart data={partitionData} metric={metric} />,
      defaultSpan: "col-span-1",
    },
    duration: {
      id: "duration",
      title: "Job Duration",
      component: <JobDurationChart data={durationData} />,
      defaultSpan: "col-span-2",
    },
  };

  const toggleWidget = (id: WidgetId) => {
    setVisibleWidgets((prev) =>
      prev.includes(id) ? prev.filter((w) => w !== id) : [...prev, id]
    );
  };

  const handleDragStart = (event: any) => {
    setActiveId(event.active.id);
  };

  const handleDragEnd = (event: any) => {
    const { active, over } = event;

    if (active.id !== over.id) {
      setOrder((items) => {
        const oldIndex = items.indexOf(active.id);
        const newIndex = items.indexOf(over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }

    setActiveId(null);
  };

  if (!mounted) {
    return <div className="p-8">Loading dashboard...</div>;
  }

  const activeWidgets = order.filter((id) => visibleWidgets.includes(id));

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="ml-auto h-8 flex">
              <Settings2 className="mr-2 h-4 w-4" />
              Customize View
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[200px]">
            <DropdownMenuLabel>Toggle Widgets</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {Object.values(widgets).map((widget) => (
              <DropdownMenuCheckboxItem
                key={widget.id}
                checked={visibleWidgets.includes(widget.id)}
                onCheckedChange={() => toggleWidget(widget.id)}
              >
                {widget.title}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={activeWidgets} strategy={rectSortingStrategy}>
          <div className="grid gap-4 md:grid-cols-2">
            {activeWidgets.map((id) => (
              <SortableItem key={id} id={id} widget={widgets[id]} />
            ))}
          </div>
        </SortableContext>
        <DragOverlay>
          {activeId ? (
            <div className={`${widgets[activeId].defaultSpan} h-[400px]`}>
              {widgets[activeId].component}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}