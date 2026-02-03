"use client";

import React, { useEffect, useState, useCallback, useMemo, memo } from "react";
import JobSearch from "../job-search";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
} from "../ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { LayoutGrid, List } from "lucide-react";
import { useForm } from "react-hook-form";
import HeaderMenu from "@/components/header/header-menu";
import ColorSchemaSelector from "../color-schema-selector";
import { Button } from "@/components/ui/button";
import FeatureSelector, { LogicType } from "@/components/feature-selector";

interface NodeHeaderProps {
  handleNodeStateChange: (value: string) => void;
  handleNodeTypeChange: (value: string) => void;
  handleNodePartitionsChange: (value: string) => void;
  handleNodeFeatureChange: (features: string[], logicType: LogicType) => void;
  handleColorSchemaChange: (value: string) => void;
  handleViewModeChange: (value: boolean) => void;
  isGroupedView: boolean;
  partitions: string[];
  features: string[];
  colorSchema: string;
  selectedFeatures?: string[];
  featureLogicType?: LogicType;
  username?: string;
}

const NodeHeader: React.FC<NodeHeaderProps> = ({
  handleNodeStateChange,
  handleNodeTypeChange,
  handleNodePartitionsChange,
  handleNodeFeatureChange,
  handleColorSchemaChange,
  handleViewModeChange,
  isGroupedView,
  partitions = [],
  features = [],
  colorSchema,
  selectedFeatures = [],
  featureLogicType = "OR",
  username,
}) => {
  const [isMounted, setIsMounted] = useState(false);

  // Memoize default values to prevent form recreation on every render
  const defaultValues = useMemo(
    () => ({
      nodeType: "allNodes",
      partition: "allPartitions",
      state: "allState",
      colorSchema: colorSchema,
    }),
    // Only use initial colorSchema - form.setValue handles updates
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const form = useForm({ defaultValues });

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    form.setValue("colorSchema", colorSchema);
  }, [colorSchema, form]);

  return (
    <div className="sticky top-4 z-30 flex flex-wrap items-center justify-between gap-4 bg-background/95 p-4 backdrop-blur supports-[backdrop-filter]:bg-background/60 rounded-xl border shadow-sm my-4">
      <div className="flex items-center gap-3">
        <JobSearch />
        
        {isMounted && (
          <div className="flex items-center rounded-lg bg-muted p-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={`h-8 w-8 p-1 ${!isGroupedView && "bg-background shadow-sm hover:bg-background"}`}
              onClick={() => handleViewModeChange(false)}
              title="Grid View"
            >
              <LayoutGrid className="h-4 w-4 text-muted-foreground" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={`h-8 w-8 p-1 ${isGroupedView && "bg-background shadow-sm hover:bg-background"}`}
              onClick={() => handleViewModeChange(true)}
              title="List View"
            >
              <List className="h-4 w-4 text-muted-foreground" />
            </Button>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
      <Form {...form}>
        <form className="flex items-center gap-2">
          <FormField
            control={form.control}
            name="nodeType"
            render={({ field }) => (
              <FormItem className="space-y-0">
                <Select
                  onValueChange={(value) => {
                    field.onChange(value);
                    handleNodeTypeChange(value);
                  }}
                  value={field.value}
                >
                  <FormControl>
                    <SelectTrigger className="w-[140px] h-9 text-xs bg-muted/50 border-input">
                      <SelectValue placeholder="All Nodes" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent className="max-h-[300px] w-[200px]">
                    <SelectItem value="allNodes" className="text-xs">All Nodes</SelectItem>
                    <SelectItem value="gpuNodes" className="text-xs">GPU Nodes</SelectItem>
                    <SelectItem value="cpuNodes" className="text-xs">CPU Nodes</SelectItem>
                  </SelectContent>
                </Select>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="partition"
            render={({ field }) => (
              <FormItem className="space-y-0">
                <Select
                  onValueChange={(value) => {
                    field.onChange(value);
                    handleNodePartitionsChange(value);
                  }}
                  value={field.value}
                >
                  <FormControl>
                    <SelectTrigger className="w-[140px] h-9 text-xs bg-muted/50 border-input">
                      <SelectValue placeholder="All Partitions" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent className="max-h-[300px] w-[200px]">
                    <SelectItem value="allPartitions" className="text-xs">
                      All Partitions
                    </SelectItem>
                    {partitions &&
                      partitions.map((partition: string) => (
                        <SelectItem key={partition} value={partition} className="text-xs">
                          {partition}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="state"
            render={({ field }) => (
              <FormItem className="space-y-0">
                <Select
                  onValueChange={(value) => {
                    field.onChange(value);
                    handleNodeStateChange(value);
                  }}
                  value={field.value}
                >
                  <FormControl>
                    <SelectTrigger className="w-[140px] h-9 text-xs bg-muted/50 border-input">
                      <SelectValue placeholder="All States" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent className="max-h-[300px] w-[200px]">
                    <SelectItem value="allState" className="text-xs">All States</SelectItem>
                    <SelectItem value="idleState" className="text-xs">Idle Nodes</SelectItem>
                    <SelectItem value="mixedState" className="text-xs">Mixed Nodes</SelectItem>
                    <SelectItem value="allocState" className="text-xs">Allocated Nodes</SelectItem>
                    <SelectItem value="downState" className="text-xs">Down Nodes</SelectItem>
                    <SelectItem value="drainState" className="text-xs">Draining Nodes</SelectItem>
                  </SelectContent>
                </Select>
              </FormItem>
            )}
          />

          <FormItem className="space-y-0">
            <FeatureSelector
              features={features}
              selectedFeatures={selectedFeatures}
              onFeaturesChange={handleNodeFeatureChange}
              logicType={featureLogicType}
            />
          </FormItem>
        </form>
      </Form>
      
        <div className="h-4 w-px bg-border mx-2" />
        
        <ColorSchemaSelector
          value={colorSchema}
          onChange={handleColorSchemaChange}
        />
        <HeaderMenu username={username} />
      </div>
    </div>
  );
};

export default memo(NodeHeader);
