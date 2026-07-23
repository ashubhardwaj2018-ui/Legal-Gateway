import { useState } from "react";
import {
  useListLawyerProfiles, useCreateLawyerProfile, useUpdateLawyerProfile, useDeleteLawyerProfile,
  getListLawyerProfilesQueryKey, type LawyerProfile
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "./AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, User, Briefcase, Award } from "lucide-react";


type FormData = {
  name: string;
  specialization: string;
  experienceYears: string;
  bio: string;
  photoUrl: string;
  languages: string;
  barCouncilNo: string;
  isActive: boolean;
};

const SPECIALIZATIONS = [
  "Intellectual Property", "Corporate Law", "Trademark & IP", "Documentation",
  "NGO & Trust Law", "Property Law", "Family Law", "Criminal Law",
  "Taxation", "Labour Law", "Arbitration", "Contract Law",
];

function LawyerForm({ initial, onSave, onCancel, loading }: {
  initial: FormData; onSave: (data: FormData) => void; onCancel: () => void; loading: boolean;
}) {
  const [form, setForm] = useState<FormData>(initial);
  const set = (key: keyof FormData, val: string | boolean) => setForm(f => ({ ...f, [key]: val }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <Label className="text-xs">Full Name *</Label>
          <Input className="mt-1 h-9 text-sm" value={form.name} onChange={e => set("name", e.target.value)} placeholder="Adv. Name Surname" />
        </div>
        <div>
          <Label className="text-xs">Specialization *</Label>
          <select
            className="w-full mt-1 h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={form.specialization}
            onChange={e => set("specialization", e.target.value)}
          >
            <option value="">Select specialization</option>
            {SPECIALIZATIONS.map(s => <option key={s} value={s}>{s}</option>)}
            <option value="Other">Other</option>
          </select>
        </div>
        <div>
          <Label className="text-xs">Years of Experience *</Label>
          <Input className="mt-1 h-9 text-sm" type="number" min={0} max={60} value={form.experienceYears} onChange={e => set("experienceYears", e.target.value)} placeholder="e.g., 10" />
        </div>
        <div className="col-span-2">
          <Label className="text-xs">Bio / Profile</Label>
          <Textarea className="mt-1 text-sm" rows={3} value={form.bio} onChange={e => set("bio", e.target.value)} placeholder="Professional background and expertise..." />
        </div>
        <div className="col-span-2">
          <Label className="text-xs">Photo URL</Label>
          <Input className="mt-1 h-9 text-sm" value={form.photoUrl} onChange={e => set("photoUrl", e.target.value)} placeholder="https://..." />
        </div>
        <div>
          <Label className="text-xs">Languages</Label>
          <Input className="mt-1 h-9 text-sm" value={form.languages} onChange={e => set("languages", e.target.value)} placeholder="English, Hindi, Marathi" />
        </div>
        <div>
          <Label className="text-xs">Bar Council No.</Label>
          <Input className="mt-1 h-9 text-sm" value={form.barCouncilNo} onChange={e => set("barCouncilNo", e.target.value)} placeholder="MH/1234/2010" />
        </div>
        <div className="flex items-center gap-3">
          <Switch checked={form.isActive} onCheckedChange={v => set("isActive", v)} id="lawyerActive" />
          <Label htmlFor="lawyerActive" className="text-xs cursor-pointer">Active / Available</Label>
        </div>
      </div>
      <div className="flex gap-3">
        <Button onClick={() => onSave(form)} disabled={loading || !form.name || !form.specialization || !form.experienceYears} className="flex-1 bg-[#0f2044] text-white hover:bg-[#0f2044]/90">
          {loading ? "Saving..." : "Save Profile"}
        </Button>
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}

export default function AdminLawyers() {
  const queryClient = useQueryClient();
  const { data: lawyers, isLoading } = useListLawyerProfiles();
  const createMutation = useCreateLawyerProfile();
  const updateMutation = useUpdateLawyerProfile();
  const deleteMutation = useDeleteLawyerProfile();
  const { toast } = useToast();

  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<LawyerProfile | null>(null);

  const emptyForm: FormData = { name: "", specialization: "", experienceYears: "0", bio: "", photoUrl: "", languages: "English, Hindi", barCouncilNo: "", isActive: true };

  const toForm = (l: LawyerProfile): FormData => ({
    name: l.name, specialization: l.specialization,
    experienceYears: l.experienceYears.toString(),
    bio: l.bio ?? "", photoUrl: l.photoUrl ?? "",
    languages: l.languages ?? "", barCouncilNo: l.barCouncilNo ?? "",
    isActive: l.isActive,
  });

  const handleCreate = (data: FormData) => {
    createMutation.mutate(
      {
        data: {
          name: data.name, specialization: data.specialization,
          experienceYears: parseInt(data.experienceYears) || 0,
          bio: data.bio || null, photoUrl: data.photoUrl || null,
          languages: data.languages || null, barCouncilNo: data.barCouncilNo || null,
          isActive: data.isActive,
        }
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListLawyerProfilesQueryKey() });
          setShowForm(false);
          toast({ title: "Lawyer profile created" });
        }
      }
    );
  };

  const handleUpdate = (data: FormData) => {
    if (!editingItem) return;
    updateMutation.mutate(
      {
        id: editingItem.id,
        data: {
          name: data.name, specialization: data.specialization,
          experienceYears: parseInt(data.experienceYears) || 0,
          bio: data.bio || null, photoUrl: data.photoUrl || null,
          languages: data.languages || null, barCouncilNo: data.barCouncilNo || null,
          isActive: data.isActive,
        }
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListLawyerProfilesQueryKey() });
          setEditingItem(null);
          toast({ title: "Lawyer profile updated" });
        }
      }
    );
  };

  const handleDelete = (id: number) => {
    if (!confirm("Delete this lawyer profile?")) return;
    deleteMutation.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListLawyerProfilesQueryKey() });
          toast({ title: "Lawyer profile deleted" });
        }
      }
    );
  };

  return (
    <AdminLayout
      title="Lawyer Profiles"
      subtitle="Manage your team of legal experts"
      actions={
        <Button size="sm" onClick={() => setShowForm(true)} className="gap-1.5 bg-[#0f2044] hover:bg-[#0f2044]/90 text-white">
          <Plus size={14} /> Add Lawyer
        </Button>
      }
    >
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif text-[#0f2044]">Add Lawyer Profile</DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            <LawyerForm initial={emptyForm} onSave={handleCreate} onCancel={() => setShowForm(false)} loading={createMutation.isPending} />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingItem} onOpenChange={() => setEditingItem(null)}>
        <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif text-[#0f2044]">Edit Lawyer Profile</DialogTitle>
          </DialogHeader>
          {editingItem && (
            <div className="mt-4">
              <LawyerForm initial={toForm(editingItem)} onSave={handleUpdate} onCancel={() => setEditingItem(null)} loading={updateMutation.isPending} />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {(lawyers ?? []).length === 0 && !isLoading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
          <User size={40} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400 mb-2">No lawyer profiles yet</p>
          <p className="text-gray-400 text-sm mb-5">Add your team of legal experts to showcase on the website</p>
          <Button onClick={() => setShowForm(true)} className="bg-[#0f2044] text-white gap-2">
            <Plus size={14} /> Add First Lawyer
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {(lawyers ?? []).map(l => (
            <div key={l.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    {l.photoUrl ? (
                      <img src={l.photoUrl} alt={l.name} className="w-12 h-12 rounded-full object-cover shrink-0 border-2 border-gray-100" />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-[#0f2044]/10 flex items-center justify-center shrink-0">
                        <User size={20} className="text-[#0f2044]" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="font-semibold text-[#0f2044] text-sm truncate">{l.name}</div>
                      <div className="text-xs text-[#c9a227] font-medium mt-0.5">{l.specialization}</div>
                    </div>
                  </div>
                  <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${l.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                    {l.isActive ? "Active" : "Inactive"}
                  </span>
                </div>

                <div className="mt-4 space-y-2">
                  <div className="flex items-center gap-2 text-xs text-gray-600">
                    <Briefcase size={12} className="text-gray-400 shrink-0" />
                    <span>{l.experienceYears} years experience</span>
                  </div>
                  {l.barCouncilNo && (
                    <div className="flex items-center gap-2 text-xs text-gray-600">
                      <Award size={12} className="text-gray-400 shrink-0" />
                      <span className="font-mono">{l.barCouncilNo}</span>
                    </div>
                  )}
                  {l.languages && (
                    <div className="text-xs text-gray-500">
                      Languages: {l.languages}
                    </div>
                  )}
                  {l.bio && <p className="text-xs text-gray-500 line-clamp-2 mt-1">{l.bio}</p>}
                </div>
              </div>

              <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setEditingItem(l)} className="flex-1 h-7 text-xs gap-1">
                  <Pencil size={11} /> Edit
                </Button>
                <Button size="sm" variant="ghost" onClick={() => handleDelete(l.id)} className="h-7 text-xs gap-1 text-red-500 hover:text-red-700 hover:bg-red-50">
                  <Trash2 size={11} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminLayout>
  );
}
