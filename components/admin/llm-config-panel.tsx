"use client";

import { useEffect, useState, useCallback, Fragment, useMemo } from "react";
import ChatModal from "@/components/modals/chat-modal";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

import {
  Save,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Plus,
  Trash2,
  Wrench,
  Globe,
  Settings2,
  Workflow,
  HardDrive,
  Zap,
  MessageSquare,
  Server,
  Search,
  Download,
  Terminal,
  Grid,
  List as ListIcon,
  MoreVertical,
  Pencil,
  Eye,
  FileJson,
} from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────────────

interface ToolParameter {
  name: string;
  type: "string" | "number";
  description: string;
  required: boolean;
}

interface ToolExecution {
  type: "slurm" | "slurmdb" | "http";
  endpoint: string;
  method?: string;
  headers?: Record<string, string>;
  error_message?: string;
}

interface ToolConfig {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  builtin: boolean;
  category: string;
  parameters: ToolParameter[];
  prompt_guidance?: string;
  execution?: ToolExecution;
}

interface LLMConfig {
  cluster: {
    name: string;
    description: string;
    organization: string;
    documentation_url: string;
    support_email: string;
    notes: string;
  };
  system_prompt: string;
  defaults: {
    partition: string;
    qos: string;
    walltime: string;
    nodes: number;
    ntasks_per_node: number;
    mail_type: string;
    output_pattern: string;
    error_pattern: string;
  };
  custom_instructions: string;
  restricted_topics: { topic: string; redirect: string }[];
  tools: ToolConfig[];
}

// ─── Constants ─────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  workflows: "Workflows",
  jobs: "Jobs",
  nodes: "Nodes",
  partitions: "Partitions",
  reservations: "Reservations",
  qos: "QoS",
  cluster: "Cluster",
  custom: "Custom",
};

const EMPTY_CUSTOM_TOOL: ToolConfig = {
  id: "",
  name: "",
  description: "",
  enabled: true,
  builtin: false,
  category: "custom",
  parameters: [],
  prompt_guidance: "",
  execution: { type: "slurm", endpoint: "", method: "GET" },
};

// ═══════════════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════════════

export function LLMConfigPanel() {
  const [config, setConfig] = useState<LLMConfig | null>(null);
  const [raw, setRaw] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  
  // Navigation State
  const [viewMode, setViewMode] = useState<"visual" | "yaml">("visual");
  const [activeTab, setActiveTab] = useState<"tools" | "settings" | "preview">("tools");
  
  // Tool State
  const [toolQuery, setToolQuery] = useState("");
  const [toolFilter, setToolFilter] = useState<"all" | "enabled" | "disabled">("all");
  const [editingTool, setEditingTool] = useState<ToolConfig | null>(null);
  const [isNewTool, setIsNewTool] = useState(false);

  // ── Load ──

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/llm-config");
      if (!res.ok) throw new Error("Failed to load configuration");
      const data = await res.json();
      setConfig(data.config || null);
      setRaw(data.raw || "");
      setDirty(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  // ── Save ──

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const body = viewMode === "yaml" ? { raw } : { config };
      const res = await fetch("/api/llm-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setConfig(data.config);
      setDirty(false);
      setSuccess("Configuration saved successfully.");
      setTimeout(() => setSuccess(null), 4000);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  // ── Actions ──

  const handleExport = () => {
    if (!config) return;
    const blob = new Blob([JSON.stringify(config, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `llm-config-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // ── Mutations ──

  function updateConfig(updater: (c: LLMConfig) => LLMConfig) {
    if (!config) return;
    setConfig(updater(config));
    setDirty(true);
    setSuccess(null);
  }

  function handleToolSave(tool: ToolConfig) {
    if (!config) return;
    
    setEditingTool(null);
    updateConfig((c) => {
      if (isNewTool) {
        return { ...c, tools: [...c.tools, tool] };
      }
      return {
        ...c,
        tools: c.tools.map((t) => (t.id === tool.id ? tool : t)),
      };
    });
  }

  function deleteTool(id: string) {
    updateConfig((c) => ({ ...c, tools: c.tools.filter((t) => t.id !== id) }));
  }

  // ── Derived State ──

  const filteredTools = useMemo(() => {
    if (!config) return [];
    const lowerQuery = toolQuery.toLowerCase();
    return config.tools.filter((t) => {
      const matchesQuery = 
        t.name.toLowerCase().includes(lowerQuery) || 
        t.id.toLowerCase().includes(lowerQuery) ||
        t.description.toLowerCase().includes(lowerQuery);
      
      const matchesFilter = 
        toolFilter === "all" || 
        (toolFilter === "enabled" && t.enabled) || 
        (toolFilter === "disabled" && !t.enabled);

      return matchesQuery && matchesFilter;
    });
  }, [config, toolQuery, toolFilter]);

  // ── Loading ──

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between">
          <div className="h-8 w-48 bg-muted animate-pulse rounded" />
          <div className="h-8 w-24 bg-muted animate-pulse rounded" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="h-40 bg-muted animate-pulse rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!config) return <div>Failed to load config.</div>;

  return (
    <div className="space-y-4">
      {/* ── Top Bar ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">LLM Configuration</h2>
          <p className="text-sm text-muted-foreground">
            Manage tools, prompts, and cluster context.
          </p>
        </div>
        <div className="flex items-center gap-2">
           {dirty && (
            <Badge variant="outline" className="border-amber-500 text-amber-600">
              Unsaved Changes
            </Badge>
          )}
          
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="mr-2 h-3.5 w-3.5" />
            Export
          </Button>
          
          <Button onClick={handleSave} disabled={saving || !dirty} size="sm">
            <Save className={`mr-2 h-3.5 w-3.5 ${saving ? "animate-spin" : ""}`} />
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>

       {/* ── Feedback ── */}
       {success && (
        <div className="rounded-md bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-3 flex items-center gap-2 text-sm text-green-700 dark:text-green-300">
          <CheckCircle2 className="h-4 w-4" />
          {success}
        </div>
      )}
      {error && (
        <div className="rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 flex items-center gap-2 text-sm text-red-700 dark:text-red-300">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {/* ── Main Content ── */}
      <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)}>
        <div className="flex items-center justify-between mb-2">
          <TabsList className="h-9">
            <TabsTrigger value="visual" className="text-xs">Visual Editor</TabsTrigger>
            <TabsTrigger value="yaml" className="text-xs">YAML Source</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="visual" className="m-0 space-y-4">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
             <TabsList className="h-auto p-1 bg-muted/40">
              <TabsTrigger value="tools" className="gap-2 px-4 py-2">
                <Wrench className="h-4 w-4" />
                Tools & Capabilities
                <Badge variant="secondary" className="ml-1 text-[10px] h-5 px-1.5">
                  {config.tools.filter(t => t.enabled).length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="settings" className="gap-2 px-4 py-2">
                <Settings2 className="h-4 w-4" />
                Prompt & Defaults
              </TabsTrigger>
              <TabsTrigger value="preview" className="gap-2 px-4 py-2">
                <Eye className="h-4 w-4" />
                Context Preview
              </TabsTrigger>
            </TabsList>

            {/* ── TOOLS TAB ── */}
            <TabsContent value="tools" className="space-y-4 mt-4">
              <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-muted/20 p-3 rounded-lg border">
                <div className="relative w-full sm:w-72">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Filter tools..." 
                    className="pl-9 h-9"
                    value={toolQuery}
                    onChange={e => setToolQuery(e.target.value)} 
                  />
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                   <div className="flex bg-muted rounded-md p-1">
                    <button 
                      onClick={() => setToolFilter("all")}
                      className={`px-3 py-1 text-xs rounded-sm transition-all ${toolFilter === "all" ? "bg-background shadow-sm font-medium" : "text-muted-foreground"}`}
                    >
                      All
                    </button>
                    <button 
                      onClick={() => setToolFilter("enabled")}
                      className={`px-3 py-1 text-xs rounded-sm transition-all ${toolFilter === "enabled" ? "bg-background shadow-sm font-medium" : "text-muted-foreground"}`}
                    >
                      Enabled
                    </button>
                    <button 
                      onClick={() => setToolFilter("disabled")}
                      className={`px-3 py-1 text-xs rounded-sm transition-all ${toolFilter === "disabled" ? "bg-background shadow-sm font-medium" : "text-muted-foreground"}`}
                    >
                      Disabled
                    </button>
                  </div>
                  <Button size="sm" onClick={() => {
                    setEditingTool({ ...EMPTY_CUSTOM_TOOL });
                    setIsNewTool(true);
                  }}>
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    New Tool
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {filteredTools.length === 0 ? (
                  <div className="col-span-full py-12 text-center text-muted-foreground">
                    No tools found matching your filters.
                  </div>
                ) : filteredTools.map(tool => (
                  <ToolCard 
                    key={tool.id} 
                    tool={tool} 
                    onEdit={() => {
                      setEditingTool(tool);
                      setIsNewTool(false);
                    }}
                    onToggle={() => updateConfig(c => ({
                      ...c,
                      tools: c.tools.map(t => t.id === tool.id ? { ...t, enabled: !t.enabled } : t)
                    }))}
                  />
                ))}
              </div>
            </TabsContent>

            {/* ── SETTINGS TAB ── */}
            <TabsContent value="settings" className="space-y-6 mt-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                <Card className="lg:col-span-1 h-full">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-md bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
                         <MessageSquare className="h-4 w-4" />
                      </div>
                      <div>
                        <CardTitle className="text-base">System Directives</CardTitle>
                        <CardDescription className="text-xs">Instructions and personality</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                     <div className="space-y-2">
                      <Label className="text-xs font-semibold">System Prompt</Label>
                      <textarea
                        className="w-full h-40 p-3 text-xs rounded-md border bg-muted/30 font-mono resize-y focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
                        value={config.system_prompt}
                        onChange={(e) => updateConfig(c => ({...c, system_prompt: e.target.value}))}
                        placeholder="The core personality and constraints of the assistant."
                      />
                      <p className="text-[10px] text-muted-foreground">This is the hidden instructional state sent at the start of every conversation.</p>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold">Custom Instructions</Label>
                      <textarea
                         className="w-full h-24 p-3 text-xs rounded-md border bg-muted/30 font-mono resize-y focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
                         value={config.custom_instructions}
                         onChange={(e) => updateConfig(c => ({...c, custom_instructions: e.target.value}))}
                         placeholder="Additional context or rules to append to every request."
                      />
                      <p className="text-[10px] text-muted-foreground">Appended to the system prompt, useful for temporary overrides or specific rules.</p>
                    </div>
                  </CardContent>
                </Card>

                <div className="space-y-6">
                  <Card>
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-2">
                         <div className="p-1.5 rounded-md bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
                           <Server className="h-4 w-4" />
                         </div>
                         <div>
                           <CardTitle className="text-base">Cluster Identity</CardTitle>
                           <CardDescription className="text-xs">Environment context for the LLM</CardDescription>
                         </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                       <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold">Name</Label>
                          <Input 
                            className="h-8 text-xs"
                            value={config.cluster.name}
                            onChange={(e) => updateConfig(c => ({...c, cluster: {...c.cluster, name: e.target.value}}))}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold">Organization</Label>
                          <Input 
                            className="h-8 text-xs"
                            value={config.cluster.organization}
                            onChange={(e) => updateConfig(c => ({...c, cluster: {...c.cluster, organization: e.target.value}}))}
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">Support & Docs</Label>
                        <div className="grid grid-cols-2 gap-4">
                          <Input 
                            className="h-8 text-xs"
                            placeholder="Docs URL" 
                            value={config.cluster.documentation_url}
                            onChange={(e) => updateConfig(c => ({...c, cluster: {...c.cluster, documentation_url: e.target.value}}))}
                          />
                           <Input 
                            className="h-8 text-xs"
                            placeholder="Support Email" 
                            value={config.cluster.support_email}
                            onChange={(e) => updateConfig(c => ({...c, cluster: {...c.cluster, support_email: e.target.value}}))}
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">Cluster Notes</Label>
                        <textarea 
                          className="w-full h-16 p-2 text-xs rounded-md border bg-muted/30 resize-y focus:outline-none focus:ring-1 focus:ring-ring"
                          value={config.cluster.notes}
                          onChange={(e) => updateConfig(c => ({...c, cluster: {...c.cluster, notes: e.target.value}}))}
                          placeholder="e.g. 'Use partitions: standard, gpu. Avoid short jobs on long partition.'"
                        />
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                       <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-md bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
                          <Settings2 className="h-4 w-4" />
                        </div>
                        <div>
                          <CardTitle className="text-base">Job Defaults</CardTitle>
                          <CardDescription className="text-xs">Fallback values for job generation</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <div className="space-y-1.5">
                          <Label className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Partition</Label>
                          <Input 
                            className="h-8 text-xs font-mono" 
                            value={config.defaults.partition}
                            onChange={(e) => updateConfig(c => ({...c, defaults: {...c.defaults, partition: e.target.value}}))}
                          />
                        </div>
                         <div className="space-y-1.5">
                          <Label className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">QoS</Label>
                          <Input 
                            className="h-8 text-xs font-mono" 
                            value={config.defaults.qos}
                            onChange={(e) => updateConfig(c => ({...c, defaults: {...c.defaults, qos: e.target.value}}))}
                          />
                        </div>
                         <div className="space-y-1.5">
                          <Label className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Walltime</Label>
                          <Input 
                            className="h-8 text-xs font-mono" 
                            value={config.defaults.walltime}
                            onChange={(e) => updateConfig(c => ({...c, defaults: {...c.defaults, walltime: e.target.value}}))}
                          />
                        </div>
                         <div className="space-y-1.5">
                          <Label className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Mail Type</Label>
                          <Input 
                            className="h-8 text-xs font-mono"
                            value={config.defaults.mail_type}
                            onChange={(e) => updateConfig(c => ({...c, defaults: {...c.defaults, mail_type: e.target.value}}))}
                           />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>

             {/* ── PREVIEW TAB ── */}
            <TabsContent value="preview" className="mt-4">
              <PreviewPanel config={config} />
            </TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="yaml" className="mt-4">
          <textarea
            value={raw}
            onChange={(e) => {
              setRaw(e.target.value);
              setDirty(true);
              setSuccess(null);
            }}
            spellCheck={false}
            className="w-full h-[600px] font-mono text-sm bg-muted/30 border rounded-md p-4 focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </TabsContent>
      </Tabs>

      {/* Editor Modal */}
      {editingTool && (
        <ToolEditor 
          tool={editingTool} 
          existingIds={isNewTool ? config.tools.map(t => t.id) : []}
          open={!!editingTool} 
          onOpenChange={(open) => !open && setEditingTool(null)}
          onSave={handleToolSave}
          onDelete={!editingTool.builtin && !isNewTool ? () => {
            deleteTool(editingTool.id);
            setEditingTool(null);
          } : undefined}
          isNew={isNewTool}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Sub-components
// ═══════════════════════════════════════════════════════════════════════

function ToolCard({ tool, onEdit, onToggle }: { tool: ToolConfig, onEdit: () => void, onToggle: () => void }) {
  const Icon = tool.category === 'workflows' ? Workflow : tool.builtin ? HardDrive : Globe;
  return (
    <Card className={`flex flex-col h-full transition-all ${tool.enabled ? 'border-border' : 'border-dashed opacity-70'}`}>
      <CardHeader className="p-4 pb-2">
        <div className="flex justify-between items-start gap-2">
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-md ${tool.category === 'workflows' ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30' : 'bg-muted text-muted-foreground'}`}>
               <Icon className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-sm font-semibold leading-none">{tool.name}</CardTitle>
              <CardDescription className="text-[10px] font-mono mt-1 text-muted-foreground/80">{tool.id}</CardDescription>
            </div>
          </div>
          <Switch checked={tool.enabled} onCheckedChange={onToggle} className="scale-75 origin-top-right" />
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-2 flex-grow">
        <p className="text-xs text-muted-foreground line-clamp-3 min-h-[3em]">
          {tool.description}
        </p>
        <div className="flex flex-wrap gap-1 mt-3">
          <Badge variant="secondary" className="text-[10px] h-5 px-1 font-normal text-muted-foreground">
             {CATEGORY_LABELS[tool.category] || tool.category}
          </Badge>
          {tool.parameters.length > 0 && (
             <Badge variant="outline" className="text-[10px] h-5 px-1 font-normal text-muted-foreground border-border/60">
               {tool.parameters.length} params
             </Badge>
          )}
        </div>
      </CardContent>
      <CardFooter className="p-3 bg-muted/10 border-t flex justify-end">
        <Button variant="ghost" size="sm" className="h-7 text-xs w-full" onClick={onEdit}>
          <Pencil className="h-3 w-3 mr-1.5" />
          Edit Properties
        </Button>
      </CardFooter>
    </Card>
  )
}

function PreviewPanel({ config }: { config: LLMConfig }) {
  const [showChat, setShowChat] = useState(false);

  return (
    <>
    <ChatModal showChat={showChat} setShowChat={setShowChat} />
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[600px]">
      <div className="lg:col-span-2 flex flex-col gap-4">
        <Card className="flex-grow flex flex-col overflow-hidden border-border/60">
          <CardHeader className="py-3 px-4 bg-muted/30 border-b">
             <div className="flex items-center gap-2">
               <Terminal className="h-4 w-4 text-primary" />
               <h4 className="text-sm font-semibold tracking-tight">System Context Preview</h4>
             </div>
          </CardHeader>
          <div className="flex-grow bg-[#0c0c0c] dark:bg-[#09090b] text-zinc-300 p-4 font-mono text-xs overflow-auto leading-relaxed">
            <div className="text-zinc-500 mb-2 select-none"># The system prompt that will be sent to the model:</div>
            <div className="text-green-600 dark:text-green-400 mb-6">{config.system_prompt}</div>
            
            <div className="text-zinc-500 mb-2 select-none"># Context injected from cluster settings:</div>
            <div className="space-y-1 text-blue-600 dark:text-blue-400">
              <div><span className="text-purple-600 dark:text-purple-400">CLUSTER_NAME:</span> "{config.cluster.name}"</div>
              <div><span className="text-purple-600 dark:text-purple-400">ORG:</span> "{config.cluster.organization}"</div>
              <div><span className="text-purple-600 dark:text-purple-400">DOCS:</span> "{config.cluster.documentation_url}"</div>
            </div>

             <div className="text-zinc-500 mt-6 mb-2 select-none"># Available Tools Definition (Filtered):</div>
             <div className="text-amber-600 dark:text-amber-400 whitespace-pre-wrap">
               {JSON.stringify(config.tools.filter(t => t.enabled).map(t => ({
                 type: "function",
                 function: {
                   name: t.id,
                   description: t.description,
                   parameters: {
                      type: "object",
                      properties: t.parameters.reduce((acc, p) => ({...acc, [p.name]: {type: p.type, description: p.description}}), {})
                   }
                 }
               })), null, 2)}
             </div>

             <div className="text-zinc-500 mt-6 mb-2 select-none"># Appended custom instructions:</div>
             <div className="text-yellow-600 dark:text-yellow-400 border-l-2 border-yellow-500/30 pl-3">{config.custom_instructions}</div>
          </div>
        </Card>
      </div>

       <div className="space-y-4">
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm">Quick Check</CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-4 text-xs text-muted-foreground">
             <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Enabled Tools</span>
                  <span className="font-medium">{config.tools.filter(t => t.enabled).length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Custom Tools</span>
                  <span className="font-medium">{config.tools.filter(t => !t.builtin).length}</span>
                </div>
                 <div className="flex justify-between">
                  <span>API Calls</span>
                  <span className="font-medium">{config.tools.filter(t => t.enabled && t.execution?.type === 'slurm').length}</span>
                </div>
             </div>
             
             <Separator />
             
             <div className="space-y-2">
               <span className="block font-medium text-foreground">Completeness Check</span>
               <div className="flex items-center gap-2">
                 {config.cluster.documentation_url ? <CheckCircle2 className="h-3 w-3 text-green-500"/> : <AlertCircle className="h-3 w-3 text-amber-500"/>}
                 <span>Documentation URL</span>
               </div>
                <div className="flex items-center gap-2">
                 {config.system_prompt.length > 50 ? <CheckCircle2 className="h-3 w-3 text-green-500"/> : <AlertCircle className="h-3 w-3 text-amber-500"/>}
                 <span>Robust System Prompt</span>
               </div>
             </div>
          </CardContent>
        </Card>

        <Card className="bg-muted/20 border-dashed">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground mb-3">
              This preview shows how configuration constructs the prompt. Use the full Chat Interface to test actual responses.
            </p>
            <Button size="sm" variant="secondary" className="w-full h-8 text-xs" onClick={() => setShowChat(true)}>
              Go to Chat &rarr;
            </Button>
          </CardContent>
        </Card>
       </div>
    </div>
    </>
  )
}

function ToolEditor({ 
  tool, 
  open, 
  onOpenChange, 
  onSave, 
  onDelete, 
  existingIds,
  isNew 
}: { 
  tool: ToolConfig; 
  open: boolean; 
  onOpenChange: (v: boolean) => void;
  onSave: (t: ToolConfig) => void;
  onDelete?: () => void;
  existingIds: string[];
  isNew: boolean;
}) {
  const [data, setData] = useState<ToolConfig>(tool);
  const [idError, setIdError] = useState("");

  const handleSave = () => {
    if (isNew) {
      if (!data.id) { setIdError("Required"); return; }
      if (existingIds.includes(data.id)) { setIdError("ID exists"); return; }
    }
    onSave(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isNew ? "Create Custom Tool" : `Edit ${data.name}`}</DialogTitle>
          <DialogDescription>Configure tool definitions and execution logic.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
             <div className="space-y-1">
               <Label className="text-xs">Tool ID</Label>
               <Input 
                 disabled={!isNew}
                 value={data.id} 
                 onChange={e => {
                   setData({...data, id: e.target.value.toLowerCase().replace(/\s+/g, '_')});
                   setIdError("");
                 }} 
                 className="font-mono text-xs"
               />
               {idError && <span className="text-[10px] text-destructive">{idError}</span>}
             </div>
             <div className="space-y-1">
                <Label className="text-xs">Category</Label>
                 <select
                  value={data.category}
                  onChange={(e) => setData({ ...data, category: e.target.value })}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors"
                >
                  {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
             </div>
          </div>

          <div className="space-y-1">
             <Label className="text-xs">Display Name</Label>
             <Input value={data.name} onChange={e => setData({...data, name: e.target.value})}/>
          </div>
          
          <div className="space-y-1">
             <Label className="text-xs">Description (seen by LLM)</Label>
             <textarea 
                className="w-full h-20 p-2 text-xs rounded-md border bg-background resize-y"
                value={data.description} 
                onChange={e => setData({...data, description: e.target.value})}
              />
          </div>

          <Separator className="my-2" />
          
          <div className="space-y-3">
             <div className="flex items-center justify-between">
               <Label className="font-semibold">Parameters</Label>
               <Button variant="outline" size="sm" className="h-6 text-xs" onClick={() => setData({
                 ...data, parameters: [...data.parameters, { name: `param_${data.parameters.length+1}`, type: "string", description: "", required: false }]
               })}>Add Parameter</Button>
             </div>
             
             <div className="space-y-2">
               {data.parameters.length === 0 && <span className="text-xs text-muted-foreground italic">No parameters defined.</span>}
               {data.parameters.map((param, i) => (
                 <div key={i} className="grid grid-cols-12 gap-2 items-start bg-muted/20 p-2 rounded">
                    <div className="col-span-3">
                       <Input className="h-7 text-xs font-mono" placeholder="name" value={param.name} onChange={(e) => {
                          const newParams = [...data.parameters];
                          newParams[i].name = e.target.value;
                          setData({...data, parameters: newParams});
                       }} />
                    </div>
                    <div className="col-span-2">
                       <select className="h-7 w-full text-xs border rounded bg-background" value={param.type} onChange={(e) => {
                          const newParams = [...data.parameters];
                          newParams[i].type = e.target.value as "string" | "number";
                          setData({...data, parameters: newParams});
                       }}>
                         <option value="string">string</option>
                         <option value="number">number</option>
                       </select>
                    </div>
                    <div className="col-span-6">
                        <Input className="h-7 text-xs" placeholder="description" value={param.description} onChange={(e) => {
                          const newParams = [...data.parameters];
                          newParams[i].description = e.target.value;
                          setData({...data, parameters: newParams});
                       }} />
                    </div>
                    <div className="col-span-1 flex justify-center">
                       <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => {
                          setData({...data, parameters: data.parameters.filter((_, idx) => idx !== i)});
                       }}>
                         <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                       </Button>
                    </div>
                 </div>
               ))}
             </div>
          </div>

           <Separator className="my-2" />
          
           {!data.builtin && (
             <div className="bg-muted/30 p-3 rounded-lg space-y-3 border">
               <Label className="font-semibold flex items-center gap-2">
                 <HardDrive className="h-3.5 w-3.5" /> 
                 Execution Config
               </Label>
               <div className="grid grid-cols-3 gap-3">
                  <select 
                    className="h-8 text-xs border rounded w-full px-2"
                    value={data.execution?.type || 'slurm'}
                    onChange={(e) => setData({
                      ...data, 
                      execution: { ...data.execution!, type: e.target.value as any }
                    })}
                  >
                    <option value="slurm">Slurm API</option>
                    <option value="slurmdb">SlurmDB API</option>
                    <option value="http">HTTP Request</option>
                  </select>
                  <Input 
                    className="col-span-2 h-8 text-xs font-mono" 
                    placeholder={data.execution?.type === 'http' ? 'https://api.example.com/data/{param}' : '/nodes/{node}'}
                    value={data.execution?.endpoint || ''}
                    onChange={(e) => setData({
                      ...data, 
                      execution: {...data.execution!, endpoint: e.target.value}
                    })}
                  />
               </div>
               {data.execution?.type === 'http' && (
                 <div className="grid grid-cols-3 gap-3">
                   <select
                     className="h-8 text-xs border rounded w-full px-2"
                     value={data.execution?.method || 'GET'}
                     onChange={(e) => setData({
                       ...data,
                       execution: { ...data.execution!, method: e.target.value }
                     })}
                   >
                     <option value="GET">GET</option>
                     <option value="POST">POST</option>
                     <option value="PUT">PUT</option>
                     <option value="DELETE">DELETE</option>
                   </select>
                   <div className="col-span-2 text-[10px] text-muted-foreground flex items-center">HTTP method for the request</div>
                 </div>
               )}
               <p className="text-[10px] text-muted-foreground">
                 Use <code className="bg-muted px-1 rounded">{'{param_name}'}</code> in the endpoint to interpolate parameter values at runtime.
                 {data.execution?.type !== 'http' && ' The path is relative to your Slurm REST API base URL.'}
               </p>
             </div>
           )}

           <div className="space-y-1">
             <Label className="text-xs">Prompt Guidance</Label>
              <textarea 
                className="w-full h-16 p-2 text-xs rounded-md border bg-background resize-y"
                value={data.prompt_guidance} 
                onChange={e => setData({...data, prompt_guidance: e.target.value})}
                placeholder="Specific instructions for the model on how/when to use this tool."
              />
           </div>

        </div>

        <DialogFooter className="flex justify-between sm:justify-between items-center w-full">
           <div>
             {onDelete && (
                <Button variant="destructive" size="sm" onClick={onDelete}>Delete Tool</Button>
             )}
           </div>
           <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSave}>Save Changes</Button>
           </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
