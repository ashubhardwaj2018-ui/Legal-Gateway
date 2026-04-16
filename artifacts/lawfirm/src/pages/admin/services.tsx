import { useState } from "react";
import {
  useListServicesConfig, useCreateServiceConfig, useUpdateServiceConfig, useDeleteServiceConfig,
  getListServicesConfigQueryKey
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
import { Plus, Pencil, Trash2, Star, Check, X } from "lucide-react";

type ServiceConfig = NonNullable<ReturnType<typeof useListServicesConfig>["data"]>[number];

const CATEGORIES = [
  { id: "trademark-ip", label: "Trademark & IP" },
  { id: "documentation", label: "Documentation" },
  { id: "fundraising", label: "Fundraising & Company Setup" },
  { id: "ngo", label: "NGO & Society" },
  { id: "property-personal", label: "Property & Personal" },
  { id: "lawyers-experts", label: "Lawyers & Experts" },
];

type FormData = {
  categoryId: string;
  serviceName: string;
  displayName: string;
  description: string;
  basePrice: string;
  priceDisplay: string;
  duration: string;
  isPopular: boolean;
  isActive: boolean;
};

function ServiceForm({ initial, categories, onSave, onCancel, loading }: {
  initial: FormData;
  categories: typeof CATEGORIES;
  onSave: (data: FormData) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const [form, setForm] = useState<FormData>(initial);
  const set = (key: keyof FormData, val: string | boolean) => setForm(f => ({ ...f, [key]: val }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Category *</Label>
          <select
            className="w-full mt-1 h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={form.categoryId}
            onChange={e => set("categoryId", e.target.value)}
          >
            <option value="">Select category</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </div>
        <div>
          <Label className="text-xs">Service Key *</Label>
          <Input className="mt-1 h-9 text-sm" value={form.serviceName} onChange={e => set("serviceName", e.target.value)} placeholder="e.g., trademark-registration" />
        </div>
        <div className="col-span-2">
          <Label className="text-xs">Display Name</Label>
          <Input className="mt-1 h-9 text-sm" value={form.displayName} onChange={e => set("displayName", e.target.value)} placeholder="Display name (overrides default)" />
        </div>
        <div className="col-span-2">
          <Label className="text-xs">Description</Label>
          <Textarea className="mt-1 text-sm" rows={2} value={form.description} onChange={e => set("description", e.target.value)} placeholder="Service description..." />
        </div>
        <div>
          <Label className="text-xs">Base Price (₹)</Label>
          <Input className="mt-1 h-9 text-sm" type="number" value={form.basePrice} onChange={e => set("basePrice", e.target.value)} placeholder="e.g., 4999" />
        </div>
        <div>
          <Label className="text-xs">Price Display</Label>
          <Input className="mt-1 h-9 text-sm" value={form.priceDisplay} onChange={e => set("priceDisplay", e.target.value)} placeholder="e.g., Starting ₹4,999" />
        </div>
        <div className="col-span-2">
          <Label className="text-xs">Duration</Label>
          <Input className="mt-1 h-9 text-sm" value={form.duration} onChange={e => set("duration", e.target.value)} placeholder="e.g., 7-10 business days" />
        </div>
        <div className="flex items-center gap-3">
          <Switch checked={form.isPopular} onCheckedChange={v => set("isPopular", v)} id="isPopular" />
          <Label htmlFor="isPopular" className="text-xs cursor-pointer flex items-center gap-1"><Star size={12} className="text-[#c9a227]" /> Popular</Label>
        </div>
        <div className="flex items-center gap-3">
          <Switch checked={form.isActive} onCheckedChange={v => set("isActive", v)} id="isActive" />
          <Label htmlFor="isActive" className="text-xs cursor-pointer flex items-center gap-1"><Check size={12} className="text-green-600" /> Active</Label>
        </div>
      </div>
      <div className="flex gap-3">
        <Button onClick={() => onSave(form)} disabled={loading || !form.categoryId || !form.serviceName} className="flex-1 bg-[#0f2044] text-white hover:bg-[#0f2044]/90">
          {loading ? "Saving..." : "Save Service Config"}
        </Button>
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}

export default function AdminServices() {
  const queryClient = useQueryClient();
  const { data: services, isLoading } = useListServicesConfig();
  const createMutation = useCreateServiceConfig();
  const updateMutation = useUpdateServiceConfig();
  const deleteMutation = useDeleteServiceConfig();
  const { toast } = useToast();

  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<ServiceConfig | null>(null);
  const [selectedCategory, setSelectedCategory] = useState("all");

  const emptyForm: FormData = {
    categoryId: selectedCategory === "all" ? "" : selectedCategory,
    serviceName: "", displayName: "", description: "",
    basePrice: "", priceDisplay: "", duration: "",
    isPopular: false, isActive: true,
  };

  const filtered = (services ?? []).filter(s =>
    selectedCategory === "all" || s.categoryId === selectedCategory
  );

  const grouped = CATEGORIES.reduce((acc, cat) => {
    acc[cat.id] = filtered.filter(s => s.categoryId === cat.id);
    return acc;
  }, {} as Record<string, ServiceConfig[]>);

  const handleCreate = (data: FormData) => {
    createMutation.mutate(
      {
        data: {
          categoryId: data.categoryId,
          serviceName: data.serviceName,
          displayName: data.displayName || null,
          description: data.description || null,
          basePrice: data.basePrice ? parseInt(data.basePrice) : null,
          priceDisplay: data.priceDisplay || null,
          duration: data.duration || null,
          isPopular: data.isPopular,
          isActive: data.isActive,
        }
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListServicesConfigQueryKey() });
          setShowForm(false);
          toast({ title: "Service config created" });
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
          displayName: data.displayName || null,
          description: data.description || null,
          basePrice: data.basePrice ? parseInt(data.basePrice) : null,
          priceDisplay: data.priceDisplay || null,
          duration: data.duration || null,
          isPopular: data.isPopular,
          isActive: data.isActive,
        }
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListServicesConfigQueryKey() });
          setEditingItem(null);
          toast({ title: "Service updated" });
        }
      }
    );
  };

  const handleDelete = (id: number) => {
    if (!confirm("Delete this service config?")) return;
    deleteMutation.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListServicesConfigQueryKey() });
          toast({ title: "Service config deleted" });
        }
      }
    );
  };

  const toEditForm = (s: ServiceConfig): FormData => ({
    categoryId: s.categoryId,
    serviceName: s.serviceName,
    displayName: s.displayName ?? "",
    description: s.description ?? "",
    basePrice: s.basePrice?.toString() ?? "",
    priceDisplay: s.priceDisplay ?? "",
    duration: s.duration ?? "",
    isPopular: s.isPopular,
    isActive: s.isActive,
  });

  return (
    <AdminLayout
      title="Services & Pricing Editor"
      subtitle="Configure service descriptions, pricing and visibility"
      actions={
        <Button size="sm" onClick={() => setShowForm(true)} className="gap-1.5 bg-[#0f2044] hover:bg-[#0f2044]/90 text-white">
          <Plus size={14} /> Add Service Config
        </Button>
      }
    >
      {/* Create Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle className="font-serif text-[#0f2044]">Add Service Config</DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            <ServiceForm
              initial={emptyForm}
              categories={CATEGORIES}
              onSave={handleCreate}
              onCancel={() => setShowForm(false)}
              loading={createMutation.isPending}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingItem} onOpenChange={() => setEditingItem(null)}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle className="font-serif text-[#0f2044]">Edit Service Config</DialogTitle>
          </DialogHeader>
          {editingItem && (
            <div className="mt-4">
              <ServiceForm
                initial={toEditForm(editingItem)}
                categories={CATEGORIES}
                onSave={handleUpdate}
                onCancel={() => setEditingItem(null)}
                loading={updateMutation.isPending}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Category Filter */}
      <div className="flex flex-wrap gap-2 mb-5">
        {[{ id: "all", label: "All Categories" }, ...CATEGORIES].map(cat => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              selectedCategory === cat.id ? "bg-[#0f2044] text-white" : "bg-white border border-gray-200 text-gray-600 hover:border-[#0f2044]"
            }`}
          >
            {cat.label}
            {cat.id !== "all" && (
              <span className="ml-1.5 opacity-70">
                ({(services ?? []).filter(s => s.categoryId === cat.id).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {(services ?? []).length === 0 && !isLoading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-gray-400 mb-3">No service configurations yet</p>
          <p className="text-gray-400 text-sm mb-5">Add pricing and descriptions for your services</p>
          <Button onClick={() => setShowForm(true)} className="bg-[#0f2044] text-white gap-2">
            <Plus size={14} /> Add First Service Config
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {CATEGORIES.filter(c => selectedCategory === "all" || c.id === selectedCategory).map(cat => {
            const catServices = grouped[cat.id] ?? [];
            if (catServices.length === 0 && selectedCategory !== "all") return null;
            return (
              <div key={cat.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-5 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-[#0f2044]">{cat.label}</h3>
                  <span className="text-xs text-gray-400">{catServices.length} configured</span>
                </div>
                {catServices.length === 0 ? (
                  <div className="px-5 py-4 text-sm text-gray-400">No services configured for this category</div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {catServices.map(s => (
                      <div key={s.id} className="px-5 py-4 flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm text-[#0f2044]">{s.displayName || s.serviceName}</span>
                            {s.isPopular && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs bg-[#c9a227]/10 text-[#c9a227] font-medium">
                                <Star size={10} /> Popular
                              </span>
                            )}
                            {!s.isActive && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs bg-gray-100 text-gray-500">
                                <X size={10} /> Inactive
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-400 mt-0.5 font-mono">{s.serviceName}</div>
                          {s.description && <div className="text-xs text-gray-500 mt-1 line-clamp-1">{s.description}</div>}
                          <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                            {s.priceDisplay && <span className="text-[#c9a227] font-medium">{s.priceDisplay}</span>}
                            {s.basePrice && !s.priceDisplay && <span className="text-[#c9a227] font-medium">₹{s.basePrice.toLocaleString("en-IN")}</span>}
                            {s.duration && <span>⏱ {s.duration}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button size="sm" variant="ghost" onClick={() => setEditingItem(s)} className="h-7 w-7 p-0 text-gray-500 hover:text-[#0f2044]">
                            <Pencil size={13} />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => handleDelete(s.id)} className="h-7 w-7 p-0 text-gray-400 hover:text-red-600">
                            <Trash2 size={13} />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </AdminLayout>
  );
}
