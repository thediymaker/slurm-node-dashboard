import React, { useEffect } from "react";
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
import { useForm } from "react-hook-form";
import HeaderMenu from "@/components/header/header-menu";
import { ThemeToggle } from "../theme-toggle";
import ColorSchemaSelector from "../color-schema-selector";

interface NodeHeaderProps {
  handleNodeStateChange: (value: string) => void;
  handleNodeTypeChange: (value: string) => void;
  handleNodePartitionsChange: (value: string) => void;
  handleNodeFeatureChange: (value: string) => void;
  handleColorSchemaChange: (value: string) => void;
  partitions: string[];
  features: string[];
  colorSchema: string;
}

const NodeHeader: React.FC<NodeHeaderProps> = ({
  handleNodeStateChange,
  handleNodeTypeChange,
  handleNodePartitionsChange,
  handleNodeFeatureChange,
  handleColorSchemaChange,
  partitions,
  features,
  colorSchema,
}) => {
  const form = useForm({
    defaultValues: {
      nodeType: "allNodes",
      partition: "allPartitions",
      state: "allState",
      feature: "allFeatures",
      colorSchema: colorSchema,
    },
  });

  useEffect(() => {
    form.setValue("colorSchema", colorSchema);
  }, [colorSchema]);

  return (
    <div className="mt-3 justify-between flex">
      <div className="mr-2">
        <JobSearch />
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
                      {partitions.map((partition: string) => (
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
            name="feature"
            render={({ field }) => (
              <FormItem>
                <div className="flex pr-2">
                  <Select
                    onValueChange={(value) => {
                      field.onChange(value);
                      handleNodeFeatureChange(value);
                    }}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger className="w-[160px]">
                        <SelectValue placeholder="All Features" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="max-h-[300px] w-[240px] overflow-y-auto scrollbar-none">
                      <SelectItem value="allFeatures">All Features</SelectItem>
                      {features.map((feature: string) => (
                        <SelectItem
                          className="uppercase"
                          key={feature}
                          value={feature}
                        >
                          {feature.toUpperCase()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
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
