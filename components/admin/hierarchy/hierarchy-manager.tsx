"use client"

import { useState, useCallback } from "react";
import { HierarchyFlow } from "./hierarchy-flow";
import { Organization, Account, createOrganization, updateOrganization, deleteOrganization, addAccountMapping, removeAccountMapping, getAccountMappings, deleteAllHierarchy, getHierarchy } from "@/actions/hierarchy";
import { importHierarchyCSV, importMappingCSV, exportHierarchyCSV, exportMappingCSV } from "@/actions/hierarchy-import";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Trash2, Plus, Save, Upload, Download, RefreshCw } from "lucide-react";
import { getHierarchyLabels } from "@/lib/utils";

interface HierarchyManagerProps {
  initialOrgs: Organization[];
  accounts: Account[];
}

const DEFAULT_FORM = { name: "", type: "group", parent_id: "null", info: "" };

export function HierarchyManager({ initialOrgs, accounts }: HierarchyManagerProps) {
  const [orgs, setOrgs] = useState<Organization[]>(initialOrgs);
  const [selectedNode, setSelectedNode] = useState<Organization | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState(DEFAULT_FORM);
  const [mappedAccounts, setMappedAccounts] = useState<{account_id: number, account_name: string}[]>([]);
  const [importOpen, setImportOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const labels = getHierarchyLabels();

  const refreshData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const data = await getHierarchy();
      setOrgs(data);
    } catch (e) {
      console.error("Failed to refresh hierarchy:", e);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  const handleNodeClick = useCallback(async (node: Organization) => {
    setSelectedNode(node);
    setIsCreating(false);
    setFormData({
      name: node.name,
      type: node.type,
      parent_id: node.parent_id?.toString() || "null",
      info: node.info || ""
    });
    
    try {
      const mappings = await getAccountMappings(node.id);
      setMappedAccounts(mappings);
    } catch (e) {
      console.error(e);
      setMappedAccounts([]);
    }
  }, []);

  const handleCreateNew = useCallback(() => {
    setSelectedNode(null);
    setIsCreating(true);
    setFormData(DEFAULT_FORM);
    setMappedAccounts([]);
  }, []);

  const handleSubmit = async () => {
    try {
      const parentId = formData.parent_id === "null" ? null : parseInt(formData.parent_id);
      
      if (isCreating) {
        await createOrganization({
          name: formData.name,
          type: formData.type,
          parent_id: parentId,
          info: formData.info
        });
        toast.success("Organization created");
        setIsCreating(false);
      } else if (selectedNode) {
        await updateOrganization(selectedNode.id, {
          name: formData.name,
          type: formData.type,
          parent_id: parentId,
          info: formData.info
        });
        toast.success("Organization updated");
      }
      await refreshData();
    } catch (error) {
      toast.error("Failed to save organization");
      console.error(error);
    }
  };

  const handleDelete = async () => {
    if (!selectedNode) return;
    if (!confirm("Are you sure you want to delete this organization?")) return;
    
    try {
      await deleteOrganization(selectedNode.id);
      toast.success("Organization deleted");
      setSelectedNode(null);
      await refreshData();
    } catch (error) {
      toast.error("Failed to delete. Ensure it has no children.");
    }
  };
  
  const handleAddMapping = async (accountId: string) => {
    if (!selectedNode) return;
    try {
      await addAccountMapping(selectedNode.id, parseInt(accountId));
      const mappings = await getAccountMappings(selectedNode.id);
      setMappedAccounts(mappings);
      toast.success("Account mapped");
    } catch (e) {
      toast.error("Failed to map account");
    }
  };
  
  const handleRemoveMapping = async (accountId: number) => {
    if (!selectedNode) return;
    try {
      await removeAccountMapping(selectedNode.id, accountId);
      const mappings = await getAccountMappings(selectedNode.id);
      setMappedAccounts(mappings);
      toast.success("Mapping removed");
    } catch (e) {
      toast.error("Failed to remove mapping");
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'hierarchy' | 'mapping') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      try {
        if (type === 'hierarchy') {
          await importHierarchyCSV(content);
          toast.success("Hierarchy imported");
        } else {
          await importMappingCSV(content);
          toast.success("Mappings imported");
        }
        setImportOpen(false);
        await refreshData();
      } catch (error) {
        console.error(error);
        toast.error("Failed to import CSV");
      }
    };
    reader.readAsText(file);
  };

  const handleDownload = async (type: 'hierarchy' | 'mapping') => {
    try {
      const csvContent = type === 'hierarchy' 
        ? await exportHierarchyCSV() 
        : await exportMappingCSV();
      
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = type === 'hierarchy' ? 'hierarchy_export.csv' : 'mapping_export.csv';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error(error);
      toast.error("Failed to export CSV");
    }
  };

  const handleClear = async () => {
    if (!confirm("Are you sure you want to delete ALL hierarchy data? This cannot be undone.")) return;
    try {
      await deleteAllHierarchy();
      toast.success("Hierarchy cleared");
      setImportOpen(false);
      setSelectedNode(null);
      await refreshData();
    } catch (e) {
      toast.error("Failed to clear hierarchy");
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[700px]">
      {/* Graph Panel */}
      <div className="lg:col-span-2 h-full flex flex-col">
        <Card className="flex-1 flex flex-col overflow-hidden">
          <CardHeader className="py-3 px-4 flex flex-row items-center justify-between border-b">
            <CardTitle className="text-base font-medium">Organization Hierarchy</CardTitle>
            <div className="flex gap-2">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={refreshData}
                disabled={isRefreshing}
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              </Button>
              <Dialog open={importOpen} onOpenChange={setImportOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Upload className="w-4 h-4 mr-2" /> Import/Export
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Manage Data</DialogTitle>
                    <DialogDescription>Import or export hierarchy data via CSV.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <Label>Hierarchy Data</Label>
                        <Button variant="outline" size="sm" onClick={() => handleDownload('hierarchy')}>
                          <Download className="w-3 h-3 mr-1" /> Download
                        </Button>
                      </div>
                      <Input type="file" accept=".csv" onChange={(e) => handleFileUpload(e, 'hierarchy')} />
                      <p className="text-xs text-muted-foreground">Format: code, name, parent_code</p>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <Label>Account Mappings</Label>
                        <Button variant="outline" size="sm" onClick={() => handleDownload('mapping')}>
                          <Download className="w-3 h-3 mr-1" /> Download
                        </Button>
                      </div>
                      <Input type="file" accept=".csv" onChange={(e) => handleFileUpload(e, 'mapping')} />
                      <p className="text-xs text-muted-foreground">Format: slurm_account, org_code</p>
                    </div>
                    <div className="pt-4 border-t">
                      <Button variant="destructive" size="sm" className="w-full" onClick={handleClear}>
                        <Trash2 className="w-4 h-4 mr-2" /> Clear All Data
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent className="flex-1 p-0">
            <HierarchyFlow data={orgs} onNodeClick={handleNodeClick} />
          </CardContent>
        </Card>
      </div>
      
      {/* Edit Panel */}
      <div className="h-full overflow-y-auto">
        <Card className="h-full">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-medium">
                {isCreating ? "New Organization" : selectedNode ? "Edit Organization" : "Details"}
              </CardTitle>
              <Button size="sm" variant="outline" onClick={handleCreateNew}>
                <Plus className="w-4 h-4 mr-1" /> New
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {(selectedNode || isCreating) ? (
              <div className="space-y-4">
                <div className="space-y-1">
                  <Label className="text-xs">Name</Label>
                  <Input 
                    value={formData.name} 
                    onChange={(e) => setFormData({...formData, name: e.target.value})} 
                  />
                </div>
                
                <div className="space-y-1">
                  <Label className="text-xs">Type</Label>
                  <Select 
                    value={formData.type} 
                    onValueChange={(val) => setFormData({...formData, type: val})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="root">Root</SelectItem>
                      <SelectItem value="college">{labels.level1}</SelectItem>
                      <SelectItem value="department">{labels.level2}</SelectItem>
                      <SelectItem value="group">Group</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-1">
                  <Label className="text-xs">Parent</Label>
                  <Select 
                    value={formData.parent_id} 
                    onValueChange={(val) => setFormData({...formData, parent_id: val})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Parent" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="null">None (Root)</SelectItem>
                      {orgs
                        .filter(o => o.id !== selectedNode?.id && o.type !== 'group')
                        .map(org => (
                          <SelectItem key={org.id} value={org.id.toString()}>
                            {org.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-1">
                  <Label className="text-xs">Info</Label>
                  <Input 
                    value={formData.info} 
                    onChange={(e) => setFormData({...formData, info: e.target.value})} 
                    placeholder="Optional description"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <Button onClick={handleSubmit} size="sm" className="flex-1">
                    <Save className="w-4 h-4 mr-1" /> Save
                  </Button>
                  {!isCreating && (
                    <Button variant="destructive" size="sm" onClick={handleDelete}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
                
                {/* Account Mappings */}
                {!isCreating && selectedNode && (
                  <div className="pt-4 border-t mt-4">
                    <Label className="text-xs">Mapped Slurm Accounts</Label>
                    <div className="space-y-1 mt-2 mb-3">
                      {mappedAccounts.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No accounts mapped.</p>
                      ) : (
                        mappedAccounts.map(acc => (
                          <div key={acc.account_id} className="flex justify-between items-center bg-muted p-2 rounded text-sm">
                            <span className="text-xs">{acc.account_name}</span>
                            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => handleRemoveMapping(acc.account_id)}>
                              <Trash2 className="w-3 h-3 text-destructive" />
                            </Button>
                          </div>
                        ))
                      )}
                    </div>
                    <Select onValueChange={handleAddMapping}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Add account..." />
                      </SelectTrigger>
                      <SelectContent>
                        {accounts
                          .filter(acc => !mappedAccounts.some(m => m.account_id === acc.id))
                          .map(acc => (
                            <SelectItem key={acc.id} value={acc.id.toString()}>
                              {acc.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                Select a node from the graph to edit, or create a new one.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
