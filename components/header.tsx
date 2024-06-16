import Link from "next/link";
import JobSearch from "./job-search";
import { Button } from "./ui/button";
import { usePathname } from "next/navigation";
import { Form, FormControl, FormField, FormItem, FormMessage } from "./ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { useForm } from "react-hook-form";
import { Menu } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

const NodeHeader = ({
  handleNodeStateChange,
  handleNodeTypeChange,
  handleNodePartitionsChange,
  handleNodeFeatureChange,
  partitions,
  features,
}: any) => {
  const form = useForm();
  const pathname = usePathname();

  return (
    <div className="mt-3 justify-between flex ">
      <div className="mr-2">
        <JobSearch />
      </div>
      <Form {...form}>
        <form className="mx-1 mb-4 flex items-center justify-end">
          <FormField
            control={form.control}
            name="nodes"
            render={({ field }) => (
              <FormItem>
                <div className="flex pr-2">
                  <Select
                    onValueChange={(value) => {
                      field.onChange(value);
                      handleNodeTypeChange(value);
                    }}
                    defaultValue={field.value}
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
            name="partitions"
            render={({ field }) => (
              <FormItem>
                <div className="flex pr-2">
                  <Select
                    onValueChange={(value) => {
                      field.onChange(value);
                      handleNodePartitionsChange(value);
                    }}
                    defaultValue={field.value}
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
            name="states"
            render={({ field }) => (
              <FormItem>
                <div className="flex pr-2">
                  <Select
                    onValueChange={(value) => {
                      field.onChange(value);
                      handleNodeStateChange(value);
                    }}
                    defaultValue={field.value}
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
            render={({ field }) => (
              <FormItem>
                <div className="flex pr-2">
                  <Select
                    onValueChange={(value) => {
                      field.onChange(value);
                      handleNodeFeatureChange(value);
                    }}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger className="w-[160px]">
                        <SelectValue placeholder="All Features" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="max-h-[300px] w-[200px] overflow-y-auto scrollbar-none">
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
        <DropdownMenu>
          <DropdownMenuTrigger className="">
            <Menu className="m-1 w-[30px] h-[30px]" />
          </DropdownMenuTrigger>
          <DropdownMenuContent className="mr-4">
            <DropdownMenuLabel className="text-blue-400">
              Menu
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="font-light ">
              {pathname === "/" ? (
                <Link href={"/basic"}>Basic Status</Link>
              ) : (
                <Link href={"/"}>Detailed Status</Link>
              )}
            </DropdownMenuItem>
            <DropdownMenuItem className="font-light ">
              <Link
                href={"https://github.com/thediymaker/slurm-node-dashboard"}
              >
                Github
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};

export default NodeHeader;
