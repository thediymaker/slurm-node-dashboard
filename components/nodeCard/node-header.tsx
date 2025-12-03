"use client";

import React, { useEffect, useState } from "react";
import JobSearch from "../job-search";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
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
import { ThemeToggle } from "../theme-toggle";
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

  const form = useForm({
    defaultValues: {
      nodeType: "allNodes",
      partition: "allPartitions",
      state: "allState",
      colorSchema: colorSchema,
    },
  });

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    form.setValue("colorSchema", colorSchema);
  }, [colorSchema, form]);

  return (
    <div className="mt-3 justify-between flex">
      <div className="flex items-start space-x-4">
        <JobSearch />

        {isMounted && (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={
                isGroupedView ? undefined : "bg-primary text-primary-foreground"
              }
              onClick={() => handleViewModeChange(false)}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={
                !isGroupedView
                  ? undefined
                  : "bg-primary text-primary-foreground"
              }
              onClick={() => handleViewModeChange(true)}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
      <Form {...form}>
        <form className="mx-1 mb-4 flex items-center justify-end">
          <FormField
            control={form.control}
            name="nodeType"
            render={({ field }) => (
              <FormItem>
                <div className="flex pr-2">
                  <Select
                    onValueChange={(value) => {
                      field.onChange(value);
                      handleNodeTypeChange(value);
                    }}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger className="w-[160px]">
                        <SelectValue placeholder="All Nodes" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="max-h-[300px] w-[200px] overflow-y-auto scrollbar-none">
                      <SelectItem value="allNodes">All Nodes</SelectItem>
                      <SelectItem value="gpuNodes">GPU Nodes</SelectItem>
                      <SelectItem value="cpuNodes">CPU Nodes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="partition"
            render={({ field }) => (
              <FormItem>
                <div className="flex pr-2">
                  <Select
                    onValueChange={(value) => {
                      field.onChange(value);
                      handleNodePartitionsChange(value);
                    }}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger className="w-[160px]">
                        <SelectValue placeholder="All Partitions" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="max-h-[300px] w-[200px] overflow-y-auto scrollbar-none">
                      <SelectItem value="allPartitions">
                        All Partitions
                      </SelectItem>
                      {partitions &&
                        partitions.map((partition: string) => (
                          <SelectItem key={partition} value={partition}>
                            {partition}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="state"
            render={({ field }) => (
              <FormItem>
                <div className="flex pr-2">
                  <Select
                    onValueChange={(value) => {
                      field.onChange(value);
                      handleNodeStateChange(value);
                    }}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger className="w-[160px]">
                        <SelectValue placeholder="All States" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="max-h-[300px] w-[200px] overflow-y-auto scrollbar-none">
                      <SelectItem value="allState">All States</SelectItem>
                      <SelectItem value="idleState">Idle Nodes</SelectItem>
                      <SelectItem value="mixedState">Mixed Nodes</SelectItem>
                      <SelectItem value="allocState">
                        Allocated Nodes
                      </SelectItem>
                      <SelectItem value="downState">Down Nodes</SelectItem>
                      <SelectItem value="drainState">Draining Nodes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormItem className="pr-2">
            <FeatureSelector
              features={features}
              selectedFeatures={selectedFeatures}
              onFeaturesChange={handleNodeFeatureChange}
              logicType={featureLogicType}
            />
            <FormMessage />
          </FormItem>
        </form>
      </Form>
      <div className="flex items-center h-full mr-4">
        <ColorSchemaSelector
          value={colorSchema}
          onChange={handleColorSchemaChange}
        />
        <HeaderMenu username={username} />
      </div>
    </div>
  );
};

export default NodeHeader;
