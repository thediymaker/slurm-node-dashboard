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
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Badge } from "../ui/badge";
import { ChevronsUpDown, LayoutGrid, List, X } from "lucide-react";
import { useForm } from "react-hook-form";
import HeaderMenu from "@/components/header/header-menu";
import { ThemeToggle } from "../theme-toggle";
import ColorSchemaSelector from "../color-schema-selector";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "../ui/scroll-area";
import { Checkbox } from "../ui/checkbox";
import { Input } from "../ui/input";

interface NodeHeaderProps {
  handleNodeStateChange: (value: string) => void;
  handleNodeTypeChange: (value: string) => void;
  handleNodePartitionsChange: (value: string) => void;
  handleNodeFeatureChange: (features: string[]) => void;
  handleColorSchemaChange: (value: string) => void;
  handleViewModeChange: (value: boolean) => void;
  isGroupedView: boolean;
  partitions: string[];
  features: string[];
  colorSchema: string;
  selectedFeatures?: string[];
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
}) => {
  const [isMounted, setIsMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [selectedFeatureValues, setSelectedFeatureValues] = useState<string[]>(
    selectedFeatures || []
  );
  const [searchQuery, setSearchQuery] = useState("");

  const form = useForm({
    defaultValues: {
      nodeType: "allNodes",
      partition: "allPartitions",
      state: "allState",
      features: selectedFeatureValues,
      colorSchema: colorSchema,
    },
  });

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    form.setValue("colorSchema", colorSchema);
  }, [colorSchema, form]);

  useEffect(() => {
    // Notify parent component when selected features change
    handleNodeFeatureChange(selectedFeatureValues);
  }, [selectedFeatureValues, handleNodeFeatureChange]);

  const toggleFeature = (feature: string) => {
    setSelectedFeatureValues((current) => {
      if (current.includes(feature)) {
        return current.filter((item) => item !== feature);
      } else {
        return [...current, feature];
      }
    });
  };

  const clearFeatures = () => {
    setSelectedFeatureValues([]);
  };

  const getFeatureDisplayValue = () => {
    if (!selectedFeatureValues || selectedFeatureValues.length === 0) {
      return "All Features";
    }

    if (selectedFeatureValues.length === 1) {
      return selectedFeatureValues[0].toUpperCase();
    }

    return `${selectedFeatureValues.length} features selected`;
  };

  // Filter features based on search query
  const filteredFeatures =
    features?.filter((feature) =>
      feature?.toLowerCase().includes(searchQuery.toLowerCase())
    ) || [];

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
          <FormField
            control={form.control}
            name="features"
            render={() => (
              <FormItem className="feature-selector">
                <div className="flex pr-2">
                  <Popover open={open} onOpenChange={setOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        className="w-[200px] justify-between whitespace-nowrap overflow-hidden"
                      >
                        <span className="truncate">
                          {getFeatureDisplayValue()}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[200px] p-0" align="end">
                      <div className="p-2">
                        <Input
                          placeholder="Search features..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="mb-2"
                        />
                        <ScrollArea className="h-[200px]">
                          <div className="p-2">
                            {filteredFeatures.length > 0 ? (
                              filteredFeatures.map((feature) => (
                                <div
                                  key={feature}
                                  className="flex items-center space-x-2 py-1"
                                >
                                  <Checkbox
                                    id={`feature-${feature}`}
                                    checked={selectedFeatureValues.includes(
                                      feature
                                    )}
                                    onCheckedChange={() =>
                                      toggleFeature(feature)
                                    }
                                  />
                                  <label
                                    htmlFor={`feature-${feature}`}
                                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer uppercase"
                                  >
                                    {feature}
                                  </label>
                                </div>
                              ))
                            ) : (
                              <div className="py-6 text-center text-sm">
                                No features found
                              </div>
                            )}
                          </div>
                        </ScrollArea>
                        {selectedFeatureValues.length > 0 && (
                          <div className="border-t p-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={clearFeatures}
                              className="w-full"
                            >
                              Clear selection ({selectedFeatureValues.length})
                            </Button>
                          </div>
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
                {selectedFeatureValues && selectedFeatureValues.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5 max-w-[240px]">
                    {selectedFeatureValues.map((feature) => (
                      <Badge
                        key={feature}
                        variant="secondary"
                        className="uppercase gap-1 text-xs"
                      >
                        {feature}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFeature(feature);
                          }}
                          className="rounded-full outline-none focus:ring-2 focus:ring-offset-1"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
                <FormMessage />
              </FormItem>
            )}
          />
        </form>
      </Form>
      <div className="flex items-center h-full mr-4">
        <ColorSchemaSelector
          value={colorSchema}
          onChange={handleColorSchemaChange}
        />
        <ThemeToggle />
        <HeaderMenu />
      </div>
    </div>
  );
};

export default NodeHeader;
