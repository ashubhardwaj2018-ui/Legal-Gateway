import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "./AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Shield, Plus, Pencil, Trash2, Key, Check, X, Loader2 } from "lucide-react";

interface Role { id: number; name: string; description?: string; isSystem: boolean; createdAt: string; }
interface PermMatrix { roleId: number; matrix: Record<string, Record<string, boolean>>; modules: string[]; actions: string[]; }

const ACTION_LABELS: Record<string, string> = {
  view: "View", create: "Create", edit: "Edit", delete: "Delete",
  export: "Export", approve: "Approve", assign: "Assign",
  print: "Print", download: "Download", upload: "Upload",
};

export default function AdminRoles() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Role | null>(null);
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [permRole, setPermRole] = useState<Role | null>(null);
  const [permMatrix, setPermMatrix] = useState<Record<string, Record<string, boolean>>>({});
  const [saving, setSaving] = useState(false);

  const { data: roles = [], isLoading } = useQuery<Role[]>({
    queryKey: ["roles"],
    queryFn: () => fetch("/api/admin/roles").then(r => r.json()),
  });

  const { data: permData, isLoading: permLoading } = useQuery<PermMatrix>({
    queryKey: ["role-perms", permRole?.id],
    queryFn: () => fetch(`/api/admin/roles/${permRole!.id}/permissions`).then(r => r.json()),
    enabled: !!permRole,
  });

  // When perm data loads, sync matrix state
  const matrixToShow = permRole && permData && permData.roleId === permRole.id ? permMatrix : null;

  const saveRole = useMutation({
    mutationFn: async () => {
      const url = editing ? `/api/admin/roles/${editing.id}` : "/api/admin/roles";
      const method = editing ? "PATCH" : "POST";
      return fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: formName, description: formDesc }) }).then(r => r.json());
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["roles"] }); closeForm(); },
  });

  const deleteRole = useMutation({
    mutationFn: (id: number) => fetch(`/api/admin/roles/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["roles"] }),
  });

  function closeForm() { setShowForm(false); setEditing(null); setFormName(""); setFormDesc(""); }

  function openPermissions(role: Role) {
    setPermRole(role);
    setPermMatrix({});
  }

  function handlePermOpen(data: PermMatrix) {
    if (Object.keys(permMatrix).length === 0) setPermMatrix(data.matrix);
  }

  if (permData && permRole && permData.roleId === permRole.id && Object.keys(permMatrix).length === 0) {
    handlePermOpen(permData);
  }

  function togglePerm(module: string, action: string) {
    setPermMatrix(m => ({
      ...m,
      [module]: { ...m[module], [action]: !m[module]?.[action] },
    }));
  }

  async function savePermissions() {
    if (!permRole) return;
    setSaving(true);
    await fetch(`/api/admin/roles/${permRole.id}/permissions`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ matrix: permMatrix }),
    });
    setSaving(false);
    qc.invalidateQueries({ queryKey: ["role-perms", permRole.id] });
  }

  return (
    <AdminLayout title="Roles & Permissions" subtitle="Define roles and grant granular module-level permissions">
      <div className="grid lg:grid-cols-3 gap-5">
        {/* Left — Roles list */}
        <div className="lg:col-span-1">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-[#0f2044]">All Roles</h2>
            <Button size="sm" className="bg-[#c9a227] hover:bg-[#b8911e] text-[#0f2044] font-semibold" onClick={() => setShowForm(true)}>
              <Plus size={13} className="mr-1" /> New Role
            </Button>
          </div>

          <div className="space-y-2">
            {isLoading && <div className="text-gray-400 text-sm p-4 text-center"><Loader2 className="animate-spin mx-auto" size={18} /></div>}
            {roles.map(role => (
              <div key={role.id}
                className={`bg-white rounded-xl border p-3.5 cursor-pointer transition-all ${permRole?.id === role.id ? "border-[#c9a227] ring-1 ring-[#c9a227]/30" : "border-gray-200 hover:border-gray-300"}`}
                onClick={() => openPermissions(role)}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <Shield size={13} className="text-[#c9a227] shrink-0" />
                      <span className="font-semibold text-sm text-gray-900 truncate">{role.name}</span>
                    </div>
                    {role.description && <div className="text-xs text-gray-400 mt-0.5 truncate">{role.description}</div>}
                    <div className="mt-1.5">
                      {role.isSystem
                        ? <Badge className="text-[10px] bg-blue-100 text-blue-700 border-blue-200">System</Badge>
                        : <Badge className="text-[10px] bg-purple-100 text-purple-700 border-purple-200">Custom</Badge>}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {!role.isSystem && (
                      <>
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={e => { e.stopPropagation(); setEditing(role); setFormName(role.name); setFormDesc(role.description ?? ""); setShowForm(true); }}>
                          <Pencil size={11} />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-6 w-6 text-red-500" onClick={e => { e.stopPropagation(); if (confirm(`Delete role "${role.name}"?`)) deleteRole.mutate(role.id); }}>
                          <Trash2 size={11} />
                        </Button>
                      </>
                    )}
                    <Button size="icon" variant="ghost" className="h-6 w-6 text-[#c9a227]" title="Permissions" onClick={e => { e.stopPropagation(); openPermissions(role); }}>
                      <Key size={11} />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right — Permission matrix */}
        <div className="lg:col-span-2">
          {!permRole ? (
            <div className="bg-white rounded-xl border border-gray-200 h-64 flex items-center justify-center text-center">
              <div>
                <Key size={32} className="text-gray-300 mx-auto mb-2" />
                <p className="text-gray-400 text-sm">Select a role to manage permissions</p>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <div>
                  <div className="font-semibold text-[#0f2044]">Permissions — {permRole.name}</div>
                  <div className="text-xs text-gray-400">Click checkboxes to toggle; save when done</div>
                </div>
                <Button size="sm" className="bg-[#0f2044] text-white" onClick={savePermissions} disabled={saving}>
                  {saving ? <><Loader2 size={13} className="animate-spin mr-1" />Saving…</> : <>Save Changes</>}
                </Button>
              </div>

              {permLoading || Object.keys(permMatrix).length === 0 ? (
                <div className="p-8 text-center text-gray-400"><Loader2 className="animate-spin mx-auto" size={20} /></div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left px-4 py-2.5 font-semibold text-gray-600 uppercase tracking-wide w-32">Module</th>
                        {permData?.actions.map(a => (
                          <th key={a} className="text-center px-2 py-2.5 font-semibold text-gray-500 uppercase tracking-wide">{ACTION_LABELS[a] ?? a}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {permData?.modules.map(mod => (
                        <tr key={mod} className="hover:bg-gray-50">
                          <td className="px-4 py-2.5 font-medium text-gray-700 capitalize">{mod.replace("-", " ")}</td>
                          {permData.actions.map(action => {
                            const allowed = permMatrix[mod]?.[action] ?? false;
                            return (
                              <td key={action} className="text-center px-2 py-2.5">
                                <button
                                  onClick={() => togglePerm(mod, action)}
                                  className={`w-5 h-5 rounded flex items-center justify-center mx-auto transition-colors ${allowed ? "bg-[#c9a227] text-[#0f2044]" : "border border-gray-300 bg-white text-transparent hover:border-[#c9a227]"}`}
                                >
                                  <Check size={11} strokeWidth={3} />
                                </button>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Role Dialog */}
      <Dialog open={showForm} onOpenChange={v => { if (!v) closeForm(); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{editing ? "Edit Role" : "Create Custom Role"}</DialogTitle></DialogHeader>
          <div className="mt-2 space-y-3">
            <div>
              <Label className="text-xs mb-1 block">Role Name *</Label>
              <Input value={formName} onChange={e => setFormName(e.target.value)} placeholder="e.g. Regional Manager" />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Description</Label>
              <Input value={formDesc} onChange={e => setFormDesc(e.target.value)} placeholder="Brief description" />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={closeForm}>Cancel</Button>
              <Button className="bg-[#c9a227] hover:bg-[#b8911e] text-[#0f2044] font-semibold"
                onClick={() => saveRole.mutate()} disabled={!formName.trim() || saveRole.isPending}>
                {saveRole.isPending ? "Saving…" : editing ? "Update" : "Create Role"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
