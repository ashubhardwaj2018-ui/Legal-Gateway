








































































































































































































import { useState, useEffect, useMemo } from "react";
import { useListSeoSettings, useUpsertSeoSetting, getListSeoSettingsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "./AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Save, Globe, Eye, EyeOff, Link2, FileCode2, Map, Tag,
  Plus, Trash2, ExternalLink, RefreshCw, Search,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

// ── Tab types ───────────────────────────────────────────────────────────────
type SeoTab = "meta" | "linking" | "sitemap" | "robots";

const SEO_TABS: Array<{ key: SeoTab; label: string; icon: React.ElementType }> = [
  { key: "meta",     label: "Meta Tags",          icon: Tag },
  { key: "linking",  label: "Internal Linking",   icon: Link2 },
  { key: "sitemap",  label: "Sitemap",             icon: Map },
  { key: "robots",   label: "Robots.txt",          icon: FileCode2 },
];

// ── Meta Tags tab ────────────────────────────────────────────────────────────
const PAGES = [
  { id: "home",                  label: "Home Page",                  icon: "🏠" },
  { id: "trademark-ip",          label: "Trademark & IP",             icon: "®" },
  { id: "documentation",         label: "Documentation",              icon: "📄" },
  { id: "fundraising",           label: "Fundraising & Company Setup", icon: "💰" },
  { id: "ngo",                   label: "NGO & Society",              icon: "🤝" },
  { id: "property-personal",     label: "Property & Personal",        icon: "🏡" },
  { id: "lawyers-experts",       label: "Lawyers & Experts",          icon: "⚖" },
];

const ROBOTS_OPTIONS = [
  "index, follow",
  "noindex, follow",
  "index, nofollow",
  "noindex, nofollow",
];

const DEFAULT_SEO: Record<string, { title: string; description: string; keywords: string; robots: string }> = {
  home: {
    title: "Legal Filing India India's Trusted Filing Platform | India's Premium Legal Network",
    description: "Expert legal services including trademark registration, company incorporation, NGO setup, property matters and more. Trusted by 50,000+ clients across India.",
    keywords: "law firm india, trademark registration, company registration, legal services india, vakil",
    robots: "index, follow",
  },
  "trademark-ip": {
    title: "Trademark & IP Services | Legal Filing India",
    description: "Professional trademark registration and intellectual property services in India. Protect your brand with expert legal assistance.",
    keywords: "trademark registration india, ip protection, copyright registration, patent filing",
    robots: "index, follow",
  },
};

type SeoData = {
  title: string;
  description: string;
  keywords: string;
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  robots: string;
};

// ── Internal Linking types ───────────────────────────────────────────────────
interface InternalLink { id: string; keyword: string; targetUrl: string; matchMode: "exact" | "partial" | "first-only"; }
const STORAGE_KEY = "vakil_internal_links";
function loadLinks(): InternalLink[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]"); } catch { return []; }
}
function saveLinks(links: InternalLink[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(links));
}

// ── Meta Tags Tab Component ──────────────────────────────────────────────────
function MetaTagsTab() {
  const queryClient = useQueryClient();
  const { data: seoSettings } = useListSeoSettings();
  const upsertMutation = useUpsertSeoSetting();
  const { toast } = useToast();
  const [selectedPage, setSelectedPage] = useState(PAGES[0].id);
  const [saving, setSaving] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);

  const existing = (seoSettings ?? []).find(s => s.page === selectedPage);
  const defaults = DEFAULT_SEO[selectedPage];

  const [form, setForm] = useState<SeoData>({
    title: existing?.title ?? defaults?.title ?? "",
    description: existing?.description ?? defaults?.description ?? "",
    keywords: existing?.keywords ?? defaults?.keywords ?? "",
    ogTitle: existing?.ogTitle ?? "",
    ogDescription: existing?.ogDescription ?? "",
    ogImage: existing?.ogImage ?? "",
    robots: existing?.robots ?? "index, follow",
  });

  const handlePageChange = (page: string) => {
    setSelectedPage(page);
    const ex = (seoSettings ?? []).find(s => s.page === page);
    const def = DEFAULT_SEO[page];
    setForm({
      title: ex?.title ?? def?.title ?? "",
      description: ex?.description ?? def?.description ?? "",
      keywords: ex?.keywords ?? def?.keywords ?? "",
      ogTitle: ex?.ogTitle ?? "",
      ogDescription: ex?.ogDescription ?? "",
      ogImage: ex?.ogImage ?? "",
      robots: ex?.robots ?? "index, follow",
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await upsertMutation.mutateAsync({ page: selectedPage, data: form });
      await queryClient.invalidateQueries({ queryKey: getListSeoSettingsQueryKey() });
      toast({ title: "SEO settings saved" });
    } catch {
      toast({ title: "Save failed", variant: "destructive" });
    } finally { setSaving(false); }
  };

  const charCount = (val: string, limit: number) => {
    const len = val.length;
    const color = len > limit ? "text-red-500" : len > limit * 0.9 ? "text-yellow-500" : "text-gray-400";
    return <span className={`text-xs ${color}`}>{len}/{limit}</span>;
  };

  return (
    <div className="flex flex-col lg:flex-row gap-5">
      {/* Page Selector */}
      <div className="lg:w-52 xl:w-64 shrink-0">
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide flex items-center gap-1.5">
              <Globe size={12} /> Select Page
            </p>
          </div>
          <nav className="p-2 space-y-0.5">
            {PAGES.map(page => {
              const hasSettings = (seoSettings ?? []).some(s => s.page === page.id);
              return (
                <button
                  key={page.id}
                  onClick={() => handlePageChange(page.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all flex items-center justify-between gap-2 ${selectedPage === page.id ? "bg-[#0f2044] text-white" : "text-gray-700 hover:bg-gray-100"}`}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <span>{page.icon}</span>
                    <span className="truncate text-xs">{page.label}</span>
                  </span>
                  {hasSettings && (
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${selectedPage === page.id ? "bg-[#c9a227]" : "bg-green-500"}`} />
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 min-w-0">
        <div className="flex justify-end mb-3">
          <Button size="sm" variant="outline" onClick={() => setPreviewMode(!previewMode)} className="gap-1.5">
            {previewMode ? <EyeOff size={14} /> : <Eye size={14} />}
            {previewMode ? "Edit" : "Preview"}
          </Button>
        </div>
        {previewMode ? (
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
            <h3 className="font-semibold text-[#0f2044] text-sm border-b pb-2">Google Search Preview</h3>
            <div className="border border-gray-200 rounded-lg p-4 max-w-[600px]">
              <div className="text-[13px] text-gray-500 truncate">legalfilingindia.com &gt; {selectedPage}</div>
              <div className="text-blue-700 text-lg hover:underline cursor-pointer mt-0.5 line-clamp-2">{form.title || "Page Title"}</div>
              <div className="text-sm text-gray-600 mt-1 line-clamp-2">{form.description || "Page description will appear here..."}</div>
            </div>
            {(form.ogTitle || form.ogDescription) && (
              <>
                <h3 className="font-semibold text-[#0f2044] text-sm border-b pb-2 mt-4">Social Share Preview</h3>
                <div className="border border-gray-200 rounded-xl overflow-hidden max-w-[500px]">
                  {form.ogImage && <img src={form.ogImage} alt="OG" className="w-full h-40 object-cover" />}
                  <div className="p-4 bg-gray-50">
                    <div className="text-xs text-gray-400 uppercase">legalfilingindia.com</div>
                    <div className="font-semibold mt-1">{form.ogTitle || form.title}</div>
                    <div className="text-sm text-gray-600 mt-1 line-clamp-2">{form.ogDescription || form.description}</div>
                  </div>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-5">
            <div className="flex items-center justify-between pb-2 border-b">
              <h3 className="font-semibold text-[#0f2044]">{PAGES.find(p => p.id === selectedPage)?.label}</h3>
              <span className={`text-xs px-2 py-0.5 rounded-full ${(seoSettings ?? []).some(s => s.page === selectedPage) ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                {(seoSettings ?? []).some(s => s.page === selectedPage) ? "Saved" : "Using defaults"}
              </span>
            </div>
            <div className="space-y-4">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Primary SEO</h4>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label className="text-xs">Meta Title</Label>
                  {charCount(form.title, 60)}
                </div>
                <Input className="text-sm h-9" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="60 characters recommended" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label className="text-xs">Meta Description</Label>
                  {charCount(form.description, 160)}
                </div>
                <Textarea className="text-sm resize-none" rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="160 characters recommended" />
              </div>
              <div>
                <Label className="text-xs mb-1 block">Keywords</Label>
                <Input className="text-sm h-9" value={form.keywords} onChange={e => setForm(f => ({ ...f, keywords: e.target.value }))} placeholder="keyword1, keyword2, keyword3" />
              </div>
              <div>
                <Label className="text-xs mb-1 block">Robots</Label>
                <Select value={form.robots} onValueChange={v => setForm(f => ({ ...f, robots: v }))}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ROBOTS_OPTIONS.map(o => <SelectItem key={o} value={o} className="text-sm">{o}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-4 pt-2 border-t">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Open Graph (Social)</h4>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label className="text-xs">OG Title</Label>
                  {charCount(form.ogTitle, 60)}
                </div>
                <Input className="text-sm h-9" value={form.ogTitle} onChange={e => setForm(f => ({ ...f, ogTitle: e.target.value }))} placeholder="Defaults to Meta Title if empty" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label className="text-xs">OG Description</Label>
                  {charCount(form.ogDescription, 160)}
                </div>
                <Textarea className="text-sm resize-none" rows={2} value={form.ogDescription} onChange={e => setForm(f => ({ ...f, ogDescription: e.target.value }))} placeholder="Defaults to Meta Description if empty" />
              </div>
              <div>
                <Label className="text-xs mb-1 block">OG Image URL</Label>
                <Input className="text-sm h-9" value={form.ogImage} onChange={e => setForm(f => ({ ...f, ogImage: e.target.value }))} placeholder="https://legalfilingindia.com/og-image.png" />
              </div>
            </div>
            <Button onClick={handleSave} disabled={saving} className="w-full bg-[#0f2044] hover:bg-[#0f2044]/90 text-white gap-2">
              <Save size={14} /> {saving ? "Saving..." : "Save SEO Settings"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Internal Linking Tab ─────────────────────────────────────────────────────
function InternalLinkingTab() {
  const [links, setLinks] = useState<InternalLink[]>(loadLinks);
  const [form, setForm] = useState<Omit<InternalLink, "id">>({ keyword: "", targetUrl: "", matchMode: "first-only" });
  const { toast } = useToast();

  const add = () => {
    if (!form.keyword.trim() || !form.targetUrl.trim()) return;
    const updated = [...links, { ...form, id: crypto.randomUUID() }];
    setLinks(updated); saveLinks(updated);
    setForm({ keyword: "", targetUrl: "", matchMode: "first-only" });
    toast({ title: "Link rule added" });
  };
  const remove = (id: string) => {
    const updated = links.filter(l => l.id !== id);
    setLinks(updated); saveLinks(updated);
  };

  return (
    <div className="space-y-5">
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
        <strong>Internal Linking Manager</strong> — define keyword-to-URL rules. These rules guide your content team when creating blog posts and service pages. Rules are stored locally and can be exported for use in your content workflow.
      </div>

      {/* Add form */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="font-semibold text-[#0f2044] text-sm mb-4">Add Link Rule</h3>
        <div className="grid sm:grid-cols-3 gap-3 mb-3">
          <div>
            <Label className="text-xs mb-1 block">Keyword / Anchor Text</Label>
            <Input className="h-9 text-sm" placeholder="e.g. trademark registration" value={form.keyword} onChange={e => setForm(f => ({ ...f, keyword: e.target.value }))} />
          </div>
          <div>
            <Label className="text-xs mb-1 block">Target URL</Label>
            <Input className="h-9 text-sm" placeholder="/services/trademark-registration" value={form.targetUrl} onChange={e => setForm(f => ({ ...f, targetUrl: e.target.value }))} />
          </div>
          <div>
            <Label className="text-xs mb-1 block">Match Mode</Label>
            <Select value={form.matchMode} onValueChange={v => setForm(f => ({ ...f, matchMode: v as InternalLink["matchMode"] }))}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="first-only">First occurrence only</SelectItem>
                <SelectItem value="exact">Exact match</SelectItem>
                <SelectItem value="partial">Partial match</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button size="sm" onClick={add} className="bg-[#0f2044] hover:bg-[#0f2044]/90 text-white gap-1.5">
          <Plus size={13} /> Add Rule
        </Button>
      </div>

      {/* Rules table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{links.length} Rules</p>
          {links.length > 0 && (
            <button
              onClick={() => {
                const csv = ["keyword,targetUrl,matchMode", ...links.map(l => `"${l.keyword}","${l.targetUrl}","${l.matchMode}"`)].join("\n");
                const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = "internal-links.csv"; a.click();
              }}
              className="text-xs text-[#c9a227] hover:underline"
            >Export CSV</button>
          )}
        </div>
        {links.length === 0 ? (
          <div className="px-4 py-10 text-center text-gray-400 text-sm">No rules yet. Add your first internal link rule above.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Keyword</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Target URL</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Mode</th>
                <th className="px-4 py-2 w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {links.map(l => (
                <tr key={l.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium text-[#0f2044]">{l.keyword}</td>
                  <td className="px-4 py-2">
                    <a href={l.targetUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-1 text-xs">
                      {l.targetUrl} <ExternalLink size={10} />
                    </a>
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-500 capitalize">{l.matchMode}</td>
                  <td className="px-4 py-2">
                    <button onClick={() => remove(l.id)} className="text-red-400 hover:text-red-600 p-1 rounded">
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ── Sitemap helpers ───────────────────────────────────────────────────────────
interface SitemapEntry { url: string; filename: string; label: string; desc: string; group: string; }

function classifyUrl(url: string): { label: string; desc: string; group: string } {
  const file = url.split("/").pop() ?? url;
  if (file === "sitemap-index.xml" || file === "sitemap.xml")
    return { label: "Sitemap Index", desc: "Master index — submit this to Google Search Console", group: "index" };
  if (file === "sitemap-static.xml")
    return { label: "Static + Services", desc: "Home, service, and category pages", group: "core" };
  if (file === "sitemap-blogs.xml")
    return { label: "Blog Posts", desc: "All published blog articles", group: "core" };
  const coMatch = file.match(/^sitemap-companies-(\d+)\.xml$/);
  if (coMatch)
    return { label: `Companies — part ${coMatch[1]}`, desc: "Up to 50,000 company pages", group: "companies" };
  const pseoMatch = file.match(/^sitemap-pseo-(\d+)\.xml$/);
  if (pseoMatch)
    return { label: `pSEO — part ${pseoMatch[1]}`, desc: "Service × location pages (up to 50,000 URLs)", group: "pseo" };
  return { label: file, desc: "", group: "other" };
}

/** Parse <loc> values out of a sitemapindex XML string */
function parseSitemapIndex(xml: string): string[] {
  const locs: string[] = [];
  const re = /<loc>\s*([^<]+)\s*<\/loc>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) locs.push(m[1].trim());
  return locs;
}

const GROUP_ORDER = ["index", "core", "companies", "pseo", "other"];
const GROUP_LABELS: Record<string, string> = {
  index: "Sitemap Index",
  core: "Core Files",
  companies: "Company Sitemaps",
  pseo: "pSEO Sitemaps (Service × Location)",
  other: "Other",
};

// ── Sitemap Tab ──────────────────────────────────────────────────────────────
function SitemapTab() {
  const { toast } = useToast();
  const [stats, setStats]       = useState<{ locations: number; services: number; blogs: number; companies: number } | null>(null);
  const [entries, setEntries]   = useState<SitemapEntry[]>([]);
  const [loading, setLoading]   = useState(false);
  const [pinging, setPinging]   = useState(false);
  const [pingResult, setPingResult] = useState<{ google: boolean; bing: boolean; message: string } | null>(null);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [loc, svc, blog, co, indexXml] = await Promise.all([
        fetch(`${BASE}/api/locations?limit=1`, { credentials: "include" }).then(r => r.json()).then(d => Number(d.total ?? 0)).catch(() => 0),
        fetch(`${BASE}/api/services`, { credentials: "include" }).then(r => r.json()).then(d => Array.isArray(d) ? d.length : 0).catch(() => 0),
        fetch(`${BASE}/api/blogs?limit=1`, { credentials: "include" }).then(r => r.json()).then(d => Number(d.total ?? 0)).catch(() => 0),
        fetch(`${BASE}/api/companies?limit=1`).then(r => r.json()).then(d => Number(d.total ?? 0)).catch(() => 0),
        fetch(`${BASE}/api/sitemap-index.xml`).then(r => r.text()).catch(() => ""),
      ]);
      setStats({ locations: loc, services: svc, blogs: blog, companies: co });

      // Parse every <loc> from the index, then add the index itself at the front
      const locs = parseSitemapIndex(indexXml);
      const built: SitemapEntry[] = [
        // Index file itself (always first)
        (() => {
          const u = `${BASE}/api/sitemap-index.xml`;
          const { label, desc, group } = classifyUrl(u);
          return { url: u, filename: "sitemap-index.xml", label, desc, group };
        })(),
        // Static + blogs (always present, may or may not be in the index)
        ...([`${BASE}/api/sitemap-static.xml`, `${BASE}/api/sitemap-blogs.xml`].map(u => {
          const { label, desc, group } = classifyUrl(u);
          return { url: u, filename: u.split("/").pop()!, label, desc, group };
        })),
        // Everything from the parsed index (companies, pseo, …)
        ...locs.map(rawUrl => {
          // Rewrite the hostname to the current origin so links work in dev
          const filename = rawUrl.split("/").pop() ?? rawUrl;
          const url = `${BASE}/api/${filename}`;
          const { label, desc, group } = classifyUrl(url);
          return { url, filename, label, desc, group };
        }),
      ];

      // Deduplicate by filename, preserve order
      const seen = new Set<string>();
      setEntries(built.filter(e => { if (seen.has(e.filename)) return false; seen.add(e.filename); return true; }));
    } finally { setLoading(false); }
  };

  const pingSearchEngines = async () => {
    setPinging(true); setPingResult(null);
    try {
      const r = await fetch(`${BASE}/api/admin/sitemap/ping`, { method: "POST", credentials: "include" });
      if (!r.ok) throw new Error();
      const d = await r.json();
      setPingResult({ google: d.google, bing: d.bing, message: d.message });
      toast({ title: `Sitemap pinged — Google: ${d.google ? "✓" : "✗"}  Bing: ${d.bing ? "✓" : "✗"}` });
    } catch {
      toast({ title: "Ping failed", description: "Check server logs", variant: "destructive" });
    } finally { setPinging(false); }
  };

  useEffect(() => { fetchAll(); }, []);

  // Group entries
  const grouped = GROUP_ORDER.reduce<Record<string, SitemapEntry[]>>((acc, g) => {
    acc[g] = entries.filter(e => e.group === g);
    return acc;
  }, {});

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Locations",  value: stats?.locations,  color: "bg-blue-50   border-blue-100   text-blue-700"   },
          { label: "Services",   value: stats?.services,   color: "bg-amber-50  border-amber-100  text-amber-700"  },
          { label: "Blog Posts", value: stats?.blogs,      color: "bg-green-50  border-green-100  text-green-700"  },
          { label: "Companies",  value: stats?.companies,  color: "bg-purple-50 border-purple-100 text-purple-700" },
        ].map(s => (
          <div key={s.label} className={`rounded-xl border p-4 text-center ${s.color}`}>
            <div className="text-2xl font-bold">{loading ? "…" : (s.value ?? "—").toLocaleString()}</div>
            <div className="text-xs mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Ping */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[#0f2044]">Ping Search Engines</p>
          <p className="text-xs text-gray-400 mt-0.5">Notify Google &amp; Bing that the sitemap has been updated</p>
          {pingResult && (
            <div className="flex gap-3 mt-2 flex-wrap">
              <span className={`text-xs font-medium ${pingResult.google ? "text-green-600" : "text-red-500"}`}>{pingResult.google ? "✓" : "✗"} Google</span>
              <span className={`text-xs font-medium ${pingResult.bing   ? "text-green-600" : "text-red-500"}`}>{pingResult.bing   ? "✓" : "✗"} Bing</span>
              <span className="text-xs text-gray-400">{pingResult.message}</span>
            </div>
          )}
        </div>
        <Button onClick={pingSearchEngines} disabled={pinging}
          className="bg-[#0f2044] hover:bg-[#c9a227] hover:text-[#0f2044] text-white gap-2 shrink-0 transition-colors" size="sm">
          <RefreshCw size={13} className={pinging ? "animate-spin" : ""} />
          {pinging ? "Pinging…" : "Ping Google & Bing"}
        </Button>
      </div>

      {/* All sitemap files grouped */}
      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400 text-sm">
          <RefreshCw size={18} className="animate-spin mx-auto mb-2" /> Loading sitemap files…
        </div>
      ) : (
        GROUP_ORDER.filter(g => grouped[g]?.length > 0).map(g => (
          <div key={g} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{GROUP_LABELS[g]}</p>
                <p className="text-xs text-gray-400 mt-0.5">{grouped[g].length} file{grouped[g].length !== 1 ? "s" : ""}</p>
              </div>
              {g === "index" && (
                <button onClick={fetchAll} disabled={loading}
                  className="text-xs text-[#c9a227] hover:underline flex items-center gap-1">
                  <RefreshCw size={11} className={loading ? "animate-spin" : ""} /> Refresh all
                </button>
              )}
            </div>
            <div className={`divide-y divide-gray-100 ${grouped[g].length > 6 ? "max-h-72 overflow-y-auto" : ""}`}>
              {grouped[g].map(e => (
                <div key={e.filename} className="px-4 py-2.5 flex items-center justify-between gap-4 hover:bg-gray-50/60 transition-colors">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#0f2044] truncate">{e.label}</p>
                    {e.desc && <p className="text-xs text-gray-400 mt-0.5">{e.desc}</p>}
                    <p className="text-[10px] text-gray-300 font-mono mt-0.5 truncate">{e.filename}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <a href={e.url} download={e.filename}
                      className="flex items-center gap-1 text-xs text-gray-600 hover:text-[#0f2044] border border-gray-200 px-2.5 py-1.5 rounded-lg hover:border-[#0f2044] hover:bg-gray-50 transition-all font-medium">
                      ↓ Download
                    </a>
                    <a href={e.url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 hover:underline">
                      <ExternalLink size={12} /> View
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {/* HTML sitemap link (not an XML file — listed separately) */}
      <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-[#0f2044]">HTML Sitemap</p>
          <p className="text-xs text-gray-400">Human-readable page for visitors and crawlers</p>
        </div>
        <a href={`${BASE}/sitemap`} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-blue-600 hover:underline shrink-0">
          <ExternalLink size={12} /> Open
        </a>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
        <strong>Tip:</strong> Submit <code className="bg-amber-100 px-1 rounded text-xs">/api/sitemap-index.xml</code> to
        Google Search Console — it automatically references all company, pSEO, blog, and static sitemaps.
        Hit <strong>Ping Google &amp; Bing</strong> after importing new data or publishing blog posts.
      </div>
    </div>
  );
}

// ── Robots.txt Tab ───────────────────────────────────────────────────────────
const DEFAULT_ROBOTS = `User-agent: *
Allow: /

# Block admin panel
Disallow: /admin/
Disallow: /portal/

# Sitemaps
Sitemap: https://legalfilingindia.com/api/sitemap-index.xml
Sitemap: https://legalfilingindia.com/api/sitemap.xml`;

function RobotsTab() {
  const { toast } = useToast();
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`${BASE}/api/admin/settings`, { credentials: "include" })
      .then(r => r.json())
      .then((d: Array<{ key: string; value: string }>) => {
        const row = Array.isArray(d) ? d.find((s) => s.key === "robots_txt_content") : null;
        setContent(row?.value ?? DEFAULT_ROBOTS);
      })
      .catch(() => setContent(DEFAULT_ROBOTS))
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const r = await fetch(`${BASE}/api/admin/settings`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "robots_txt_content", value: content }),
      });
      if (!r.ok) throw new Error();
      toast({ title: "robots.txt saved" });
    } catch {
      toast({ title: "Save failed", variant: "destructive" });
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-sm text-yellow-800">
        <strong>robots.txt</strong> — controls which pages search engine crawlers can access.
        Changes here update the site-wide robots.txt served from the domain root.
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-semibold text-[#0f2044]">robots.txt content</Label>
          <button onClick={() => setContent(DEFAULT_ROBOTS)} className="text-xs text-gray-400 hover:text-gray-600">Reset to default</button>
        </div>
        {loading ? (
          <div className="h-40 bg-gray-50 rounded-lg animate-pulse" />
        ) : (
          <Textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            rows={14}
            className="font-mono text-xs resize-none"
            placeholder={DEFAULT_ROBOTS}
          />
        )}
        <Button onClick={save} disabled={saving || loading} className="w-full bg-[#0f2044] hover:bg-[#0f2044]/90 text-white gap-2">
          <Save size={14} /> {saving ? "Saving..." : "Save robots.txt"}
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Quick Reference</p>
        <div className="space-y-1 text-xs text-gray-500 font-mono">
          <p><span className="text-green-600">Allow: /path</span> — allow crawling this path</p>
          <p><span className="text-red-500">Disallow: /path</span> — block crawling this path</p>
          <p><span className="text-blue-500">User-agent: *</span> — applies to all bots</p>
          <p><span className="text-purple-500">Sitemap: url</span> — declare a sitemap location</p>
        </div>
      </div>
    </div>
  );
}

// ── Main export ──────────────────────────────────────────────────────────────
export default function AdminSeo() {
  const [activeTab, setActiveTab] = useState<SeoTab>("meta");

  return (
    <AdminLayout title="SEO Manager" subtitle="Meta tags, internal linking, sitemap & robots.txt">
      {/* Tab bar */}
      <div className="bg-white border border-gray-200 rounded-2xl p-1.5 mb-6 overflow-x-auto">
        <div className="flex gap-1 min-w-max">
          {SEO_TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition-all whitespace-nowrap ${activeTab === key ? "bg-[#0f2044] text-white shadow-sm" : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"}`}
            >
              <Icon size={13} />{label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "meta"     && <MetaTagsTab />}
      {activeTab === "linking"  && <InternalLinkingTab />}
      {activeTab === "sitemap"  && <SitemapTab />}
      {activeTab === "robots"   && <RobotsTab />}
    </AdminLayout>
  );
}
