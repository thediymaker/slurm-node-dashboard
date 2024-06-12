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

const NodeHeader = ({ handleNodeStateChange, handleNodeTypeChange }: any) => {
  const form = useForm();
  const pathname = usePathname();

  return (
    <div className="mt-3 justify-between flex ">
      <div className="mr-2">
        <JobSearch />
      </div>
      <Form {...form}>
        <form className="mx-1 mb-4 flex items-center justify-end">
          <div className="mr-2">
            <Button className="px-5" variant={"outline"} asChild>
              {pathname === "/" ? (
                <Link href={"/basic"}>Basic Status</Link>
              ) : (
                <Link href={"/"}>Detailed Status</Link>
              )}
            </Button>
          </div>
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
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="All Nodes" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
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
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="All States" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
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
        </form>
      </Form>
    </div>
  );
};

export default NodeHeader;
