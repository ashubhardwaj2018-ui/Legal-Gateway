import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "./AdminLayout";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Upload, Download, Trash2, Edit2, ToggleLeft, ToggleRight,
  MapPin, Building2, Globe, Home, TreePine, RefreshCw,
  CheckCircle2, AlertCircle, X, Search, Star
} from "lucide-react";
import * as XLSX from "xlsx";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface Location {
  id: number;
  country: string;
  state: string;
  district?: string | null;
  city?: string | null;
  town?: string | null;
  village?: string | null;
  pincode?: string | null;
  slug: string;
  isActive: boolean;
  seoPriority?: boolean | null;
  population?: number | null;
  createdAt: string;
}

interface Stats {
  total: number;
  states: number;
  districts: number;
  cities: number;
  towns: number;
  villages: number;
  active: number;
  priority: number;
  lastUpload?: { fileName: string; inserted: number; updated: number; createdAt: string } | null;
}

interface UploadLog {
  id: number;
  fileName: string;
  totalRows: number;
  inserted: number;
  updated: number;
  duplicates: number;
  errors: number;
  createdAt: string;
}

interface UploadResult {
  totalRows: number;
  inserted: number;
  updated: number;
  duplicates: number;
  errors: number;
}

function StatCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: number; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
        <Icon size={20} />
      </div>
      <div>
        <div className="text-2xl font-bold font-serif text-[#0f2044]">{value.toLocaleString()}</div>
        <div className="text-xs text-gray-500">{label}</div>
      </div>
    </div>
  );
}

interface LocationRow { country?: string; state?: string; district?: string; city?: string; town?: string; village?: string; pincode?: string; latitude?: string | number; longitude?: string | number; population?: string | number; }

function normalizeRow(raw: Record<string, unknown>): LocationRow {
  const pick = (keys: string[]): string | undefined => {
    for (const k of keys) {
      const v = raw[k] ?? raw[k.toLowerCase()] ?? raw[k.toUpperCase()];
      if (v != null && String(v).trim()) return String(v).trim();
    }
    return undefined;
  };
  return {
    country: pick(["Country", "country"]),
    state: pick(["State", "state", "STATE"]),
    district: pick(["District", "district", "DISTRICT"]),
    city: pick(["City", "city", "CITY"]),
    town: pick(["Town", "town", "TOWN"]),
    village: pick(["Village", "village", "VILLAGE"]),
    pincode: pick(["Pincode", "pincode", "PIN", "Zip"]),
    latitude: Number(pick(["Latitude", "latitude", "lat"])) || undefined,
    longitude: Number(pick(["Longitude", "longitude", "lng", "lon"])) || undefined,
    population: Number(pick(["Population", "population"])) || undefined,
  };
}

export default function AdminLocations() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const [search, setSearch] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<"" | "1" | "0">("");
  const [page, setPage] = useState(1);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [editId, setEditId] = useState<number | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const { data: stats, isLoading: statsLoading } = useQuery<Stats>({
    queryKey: ["location-stats"],
    queryFn: () => fetch(`${BASE}/api/admin/locations/stats`).then((r) => r.json()),
    refetchInterval: 30000,
  });

  const { data: statesList = [] } = useQuery<string[]>({
    queryKey: ["location-states"],
    queryFn: () => fetch(`${BASE}/api/admin/locations/states`).then((r) => r.json()),
  });

  const { data: locData, isLoading: listLoading } = useQuery<{ data: Location[]; total: number }>({
    queryKey: ["locations-list", search, stateFilter, priorityFilter, page],
    queryFn: () => {
      const p = new URLSearchParams({ page: String(page), limit: "50" });
      if (search) p.set("search", search);
      if (stateFilter) p.set("state", stateFilter);
      if (priorityFilter) p.set("priority", priorityFilter);
      return fetch(`${BASE}/api/admin/locations?${p}`).then((r) => r.json());
    },
    placeholderData: (prev) => prev,
  });

  const { data: uploadLogs = [] } = useQuery<UploadLog[]>({
    queryKey: ["upload-logs"],
    queryFn: () => fetch(`${BASE}/api/admin/location-upload-logs`).then((r) => r.json()),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => fetch(`${BASE}/api/admin/locations/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["locations-list"] }); qc.invalidateQueries({ queryKey: ["location-stats"] }); toast({ title: "Location deleted" }); },
  });

  const toggleMutation = useMutation({
    mutationFn: (id: number) => fetch(`${BASE}/api/admin/locations/${id}/status`, { method: "PATCH" }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["locations-list"] }),
  });

  const seoPriorityMutation = useMutation({
    mutationFn: (id: number) =>
      fetch(`${BASE}/api/admin/locations/${id}/seo-priority`, { method: "PATCH" }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["locations-list"] });
      qc.invalidateQueries({ queryKey: ["location-stats"] });
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: number[]) => fetch(`${BASE}/api/admin/locations/bulk-delete`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids }) }),
    onSuccess: () => {
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ["locations-list"] });
      qc.invalidateQueries({ queryKey: ["location-stats"] });
      toast({ title: `Deleted ${selected.size} locations` });
    },
  });

  const processFile = useCallback(async (file: File) => {
    setUploading(true);
    setUploadProgress(10);
    setUploadResult(null);
    try {
      const buf = await file.arrayBuffer();
      setUploadProgress(30);
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);
      setUploadProgress(50);

      const records = raw.map(normalizeRow).filter((r) => r.state);
      setUploadProgress(70);

      const res = await fetch(`${BASE}/api/admin/locations/bulk-upsert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, records }),
      });
      setUploadProgress(90);
      const result = (await res.json()) as UploadResult;
      setUploadResult(result);
      setUploadProgress(100);
      qc.invalidateQueries({ queryKey: ["locations-list"] });
      qc.invalidateQueries({ queryKey: ["location-stats"] });
      qc.invalidateQueries({ queryKey: ["upload-logs"] });
      toast({ title: `Upload complete — ${result.inserted} inserted, ${result.updated} updated` });
    } catch {
      toast({ title: "Upload failed", description: "Please check your file format.", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }, [qc, toast]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = "";
  };

  const locations = locData?.data ?? [];
  const total = locData?.total ?? 0;
  const totalPages = Math.ceil(total / 50);

  const toggleSelect = (id: number) => {
    setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  return (
    <AdminLayout
      title="Locations"
      subtitle="Manage location database for programmatic SEO pages"
      actions={
        <a href={`${BASE}/api/sitemap.xml`} target="_blank" rel="noreferrer">
          <Button variant="outline" size="sm" className="gap-2"><Globe size={14} /> View Sitemap</Button>
        </a>
      }
    >
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-4 mb-6">
        <StatCard icon={Globe} label="Total Records" value={stats?.total ?? 0} color="bg-blue-50 text-blue-600" />
        <StatCard icon={MapPin} label="States" value={stats?.states ?? 0} color="bg-purple-50 text-purple-600" />
        <StatCard icon={Building2} label="Districts" value={stats?.districts ?? 0} color="bg-indigo-50 text-indigo-600" />
        <StatCard icon={Home} label="Cities" value={stats?.cities ?? 0} color="bg-green-50 text-green-600" />
        <StatCard icon={TreePine} label="Towns" value={stats?.towns ?? 0} color="bg-orange-50 text-orange-600" />
        <StatCard icon={CheckCircle2} label="Active" value={stats?.active ?? 0} color="bg-emerald-50 text-emerald-600" />
        <StatCard icon={Star} label="SEO Priority" value={stats?.priority ?? 0} color="bg-yellow-50 text-yellow-600" />
      </div>

      {/* Last upload info */}
      {stats?.lastUpload && (
        <div className="mb-6 flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-800">
          <CheckCircle2 size={16} className="shrink-0" />
          Last upload: <strong>{stats.lastUpload.fileName}</strong> — {stats.lastUpload.inserted} inserted · {new Date(stats.lastUpload.createdAt).toLocaleDateString("en-IN")}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Upload Zone */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold text-[#0f2044] mb-4 flex items-center gap-2"><Upload size={16} /> Upload Locations</h2>

          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${dragOver ? "border-[#c9a227] bg-[#c9a227]/5" : "border-gray-200 hover:border-gray-300"}`}
          >
            <Upload size={32} className="mx-auto text-gray-300 mb-3" />
            <p className="font-medium text-gray-700 mb-1">Drag & drop your Excel/CSV file here</p>
            <p className="text-xs text-gray-400 mb-4">Supported: .xlsx, .xls, .csv · Max recommended: 50,000 rows</p>
            <label className="cursor-pointer">
              <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={onFileInput} disabled={uploading} />
              <span className="inline-block bg-[#0f2044] text-white text-sm font-medium px-5 py-2 rounded-lg hover:bg-[#1a3060] transition-colors">
                Browse File
              </span>
            </label>
          </div>

          {/* Required columns hint */}
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <p className="text-xs font-semibold text-gray-600 mb-2">Required column names (case-insensitive):</p>
            <div className="flex flex-wrap gap-1.5">
              {["Country", "State ✱", "District", "City", "Town", "Village", "Pincode", "Latitude", "Longitude", "Population"].map((col) => (
                <span key={col} className={`text-xs px-2 py-0.5 rounded font-mono ${col.includes("✱") ? "bg-[#0f2044] text-white" : "bg-gray-200 text-gray-700"}`}>{col}</span>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-2">✱ Required. Duplicate slugs are automatically updated (upsert).</p>
          </div>

          {/* Upload progress */}
          {uploading && (
            <div className="mt-4">
              <div className="flex items-center justify-between text-sm text-gray-600 mb-1.5">
                <span className="flex items-center gap-2"><RefreshCw size={14} className="animate-spin" /> Processing…</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div className="bg-[#c9a227] h-2 rounded-full transition-all" style={{ width: `${uploadProgress}%` }} />
              </div>
            </div>
          )}

          {/* Upload result */}
          {uploadResult && !uploading && (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-xl">
              <div className="flex items-center gap-2 font-semibold text-green-800 mb-3">
                <CheckCircle2 size={16} />Upload Summary
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                {[
                  { label: "Rows", value: uploadResult.totalRows, color: "text-gray-700" },
                  { label: "Inserted", value: uploadResult.inserted, color: "text-green-700" },
                  { label: "Updated", value: uploadResult.updated, color: "text-blue-700" },
                  { label: "Errors", value: uploadResult.errors, color: "text-red-700" },
                ].map((s) => (
                  <div key={s.label} className="bg-white rounded-lg p-3">
                    <div className={`text-xl font-bold ${s.color}`}>{s.value.toLocaleString()}</div>
                    <div className="text-xs text-gray-500">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Upload History */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold text-[#0f2044] mb-4 flex items-center gap-2"><RefreshCw size={16} /> Upload History</h2>
          {uploadLogs.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No uploads yet</p>
          ) : (
            <div className="space-y-3 overflow-y-auto max-h-80">
              {uploadLogs.map((log) => (
                <div key={log.id} className="p-3 bg-gray-50 rounded-lg text-xs">
                  <div className="font-medium text-[#0f2044] truncate mb-1">{log.fileName}</div>
                  <div className="text-gray-400 mb-1.5">{new Date(log.createdAt).toLocaleString("en-IN")}</div>
                  <div className="flex gap-2 flex-wrap">
                    <span className="text-gray-500">{log.totalRows.toLocaleString()} rows</span>
                    <span className="text-green-600">+{log.inserted} ins</span>
                    <span className="text-blue-600">~{log.updated} upd</span>
                    {log.errors > 0 && <span className="text-red-600">{log.errors} err</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Location List */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-wrap gap-3">
          <h2 className="font-semibold text-[#0f2044] flex items-center gap-2"><MapPin size={16} /> Location Database</h2>
          <div className="flex items-center gap-2 flex-wrap">
            {selected.size > 0 && (
              <Button
                variant="destructive"
                size="sm"
                className="gap-1.5"
                onClick={() => bulkDeleteMutation.mutate(Array.from(selected))}
              >
                <Trash2 size={14} /> Delete ({selected.size})
              </Button>
            )}
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-2.5 text-gray-400" />
              <input
                className="pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0f2044]/20 w-44"
                placeholder="Search…"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              />
            </div>
            <select
              className="border border-gray-200 rounded-lg px-2.5 py-2 text-sm focus:outline-none text-gray-600"
              value={stateFilter}
              onChange={(e) => { setStateFilter(e.target.value); setPage(1); }}
            >
              <option value="">All States</option>
              {statesList.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select
              className="border border-gray-200 rounded-lg px-2.5 py-2 text-sm focus:outline-none text-gray-600"
              value={priorityFilter}
              onChange={(e) => { setPriorityFilter(e.target.value as "" | "1" | "0"); setPage(1); }}
            >
              <option value="">All Locations</option>
              <option value="1">⭐ SEO Priority Only</option>
              <option value="0">Non-Priority</option>
            </select>
          </div>
        </div>

        {listLoading ? (
          <div className="py-12 text-center text-gray-400">Loading…</div>
        ) : locations.length === 0 ? (
          <div className="py-12 text-center text-gray-400">
            <MapPin size={32} className="mx-auto mb-3 opacity-30" />
            <p>No locations found. Upload an Excel file to get started.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-3 text-left">
                    <input type="checkbox"
                      checked={selected.size === locations.length && locations.length > 0}
                      onChange={(e) => setSelected(e.target.checked ? new Set(locations.map((l) => l.id)) : new Set())}
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">City / Town</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">District</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">State</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Slug</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">
                    <span className="flex items-center gap-1"><Star size={11} className="text-yellow-500" />SEO Priority</span>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {locations.map((loc) => (
                  <tr key={loc.id} className={`hover:bg-gray-50 ${selected.has(loc.id) ? "bg-blue-50" : ""}`}>
                    <td className="px-3 py-3">
                      <input type="checkbox" checked={selected.has(loc.id)} onChange={() => toggleSelect(loc.id)} />
                    </td>
                    <td className="px-4 py-3 font-medium text-[#0f2044]">{loc.city || loc.town || loc.village || "—"}</td>
                    <td className="px-4 py-3 text-gray-500">{loc.district || "—"}</td>
                    <td className="px-4 py-3 text-gray-500">{loc.state}</td>
                    <td className="px-4 py-3">
                      <a href={`/gst-registration/${loc.slug}`} target="_blank" rel="noreferrer" className="font-mono text-xs text-[#c9a227] hover:underline">{loc.slug}</a>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${loc.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                        {loc.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => seoPriorityMutation.mutate(loc.id)}
                        disabled={seoPriorityMutation.isPending}
                        title={loc.seoPriority ? "Remove SEO priority" : "Mark as SEO priority"}
                        className="flex items-center gap-1.5 group"
                      >
                        <Star
                          size={15}
                          className={`transition-colors ${loc.seoPriority ? "fill-yellow-400 text-yellow-400" : "text-gray-300 group-hover:text-yellow-300"}`}
                        />
                        <span className={`text-xs font-medium ${loc.seoPriority ? "text-yellow-600" : "text-gray-400 group-hover:text-yellow-500"}`}>
                          {loc.seoPriority ? "Priority" : "—"}
                        </span>
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-[#0f2044] transition-colors"
                          title={loc.isActive ? "Disable" : "Enable"}
                          onClick={() => toggleMutation.mutate(loc.id)}
                        >
                          {loc.isActive ? <ToggleRight size={16} className="text-green-500" /> : <ToggleLeft size={16} />}
                        </button>
                        <button
                          className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                          title="Delete"
                          onClick={() => { if (confirm(`Delete ${loc.city || loc.slug}?`)) deleteMutation.mutate(loc.id); }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 text-sm text-gray-500">
            <span>{total.toLocaleString()} total records</span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>Prev</Button>
              <span>{page} / {totalPages}</span>
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Next</Button>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
