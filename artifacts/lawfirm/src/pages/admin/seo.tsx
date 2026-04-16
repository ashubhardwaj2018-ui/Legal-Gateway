import { useState } from "react";
import { useListSeoSettings, useUpsertSeoSetting, getListSeoSettingsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "./AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Save, Globe, Eye, EyeOff } from "lucide-react";

const PAGES = [
  { id: "home", label: "Home Page", icon: "🏠" },
  { id: "trademark-ip", label: "Trademark & IP", icon: "®" },
  { id: "documentation", label: "Documentation", icon: "📄" },
  { id: "fundraising", label: "Fundraising & Company Setup", icon: "💰" },
  { id: "ngo", label: "NGO & Society", icon: "🤝" },
  { id: "property-personal", label: "Property & Personal", icon: "🏡" },
  { id: "lawyers-experts", label: "Lawyers & Experts", icon: "⚖" },
];

const ROBOTS_OPTIONS = [
  "index, follow",
  "noindex, follow",
  "index, nofollow",
  "noindex, nofollow",
];

const DEFAULT_SEO: Record<string, { title: string; description: string; keywords: string; robots: string }> = {
  home: {
    title: "Vakil & Co. Legal Associates | India's Premium Legal Network",
    description: "Expert legal services including trademark registration, company incorporation, NGO setup, property matters and more. Trusted by 50,000+ clients across India.",
    keywords: "law firm india, trademark registration, company registration, legal services india, vakil",
    robots: "index, follow",
  },
  "trademark-ip": {
    title: "Trademark & IP Services | Vakil & Co.",
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

export default function AdminSeo() {
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
    upsertMutation.mutate(
      {
        page: selectedPage,
        data: {
          title: form.title,
          description: form.description,
          keywords: form.keywords || null,
          ogTitle: form.ogTitle || null,
          ogDescription: form.ogDescription || null,
          ogImage: form.ogImage || null,
          robots: form.robots,
        }
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListSeoSettingsQueryKey() });
          toast({ title: "SEO settings saved", description: `Updated for ${PAGES.find(p => p.id === selectedPage)?.label}` });
          setSaving(false);
        },
        onError: () => setSaving(false),
      }
    );
  };

  const charCount = (str: string, limit: number) => {
    const len = str.length;
    const color = len > limit ? "text-red-500" : len > limit * 0.9 ? "text-yellow-500" : "text-gray-400";
    return <span className={`text-xs ${color}`}>{len}/{limit}</span>;
  };

  return (
    <AdminLayout
      title="SEO Manager"
      subtitle="Edit meta tags and SEO settings per page"
      actions={
        <Button size="sm" variant="outline" onClick={() => setPreviewMode(!previewMode)} className="gap-1.5">
          {previewMode ? <EyeOff size={14} /> : <Eye size={14} />}
          {previewMode ? "Edit" : "Preview"}
        </Button>
      }
    >
      <div className="flex flex-col lg:flex-row gap-5">
        {/* Page Selector */}
        <div className="lg:w-52 xl:w-64 shrink-0">
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide flex items-center gap-1.5"><Globe size={12} /> Select Page</p>
            </div>
            <nav className="p-2 space-y-0.5">
              {PAGES.map(page => {
                const hasSettings = (seoSettings ?? []).some(s => s.page === page.id);
                return (
                  <button
                    key={page.id}
                    onClick={() => handlePageChange(page.id)}
                    className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all flex items-center justify-between gap-2 ${
                      selectedPage === page.id ? "bg-[#0f2044] text-white" : "text-gray-700 hover:bg-gray-100"
                    }`}
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
          {previewMode ? (
            <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
              <h3 className="font-semibold text-[#0f2044] text-sm border-b pb-2">Google Search Preview</h3>
              <div className="border border-gray-200 rounded-lg p-4 max-w-[600px]">
                <div className="text-[13px] text-gray-500 truncate">vakilco.in &gt; {selectedPage}</div>
                <div className="text-blue-700 text-lg hover:underline cursor-pointer mt-0.5 line-clamp-2">{form.title || "Page Title"}</div>
                <div className="text-sm text-gray-600 mt-1 line-clamp-2">{form.description || "Page description will appear here..."}</div>
              </div>
              {(form.ogTitle || form.ogDescription) && (
                <>
                  <h3 className="font-semibold text-[#0f2044] text-sm border-b pb-2 mt-4">Social Share Preview</h3>
                  <div className="border border-gray-200 rounded-xl overflow-hidden max-w-[500px]">
                    {form.ogImage && <img src={form.ogImage} alt="OG" className="w-full h-40 object-cover" />}
                    <div className="p-4 bg-gray-50">
                      <div className="text-xs text-gray-400 uppercase">vakilco.in</div>
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

              {/* Primary SEO */}
              <div className="space-y-4">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Primary SEO</h4>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <Label className="text-xs">Meta Title</Label>
                    {charCount(form.title, 60)}
                  </div>
                  <Input
                    className="text-sm h-9"
                    value={form.title}
                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    placeholder="60 characters recommended"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <Label className="text-xs">Meta Description</Label>
                    {charCount(form.description, 160)}
                  </div>
                  <Textarea
                    className="text-sm resize-none"
                    rows={3}
                    value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="160 characters recommended"
                  />
                </div>
                <div>
                  <Label className="text-xs mb-1 block">Keywords</Label>
                  <Input
                    className="text-sm h-9"
                    value={form.keywords}
                    onChange={e => setForm(f => ({ ...f, keywords: e.target.value }))}
                    placeholder="keyword1, keyword2, keyword3"
                  />
                </div>
                <div>
                  <Label className="text-xs mb-1 block">Robots</Label>
                  <Select value={form.robots} onValueChange={v => setForm(f => ({ ...f, robots: v }))}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROBOTS_OPTIONS.map(o => <SelectItem key={o} value={o} className="text-sm">{o}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* OG Tags */}
              <div className="space-y-4 pt-2 border-t">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Open Graph (Social)</h4>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <Label className="text-xs">OG Title</Label>
                    {charCount(form.ogTitle, 60)}
                  </div>
                  <Input
                    className="text-sm h-9"
                    value={form.ogTitle}
                    onChange={e => setForm(f => ({ ...f, ogTitle: e.target.value }))}
                    placeholder="Defaults to Meta Title if empty"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <Label className="text-xs">OG Description</Label>
                    {charCount(form.ogDescription, 160)}
                  </div>
                  <Textarea
                    className="text-sm resize-none"
                    rows={2}
                    value={form.ogDescription}
                    onChange={e => setForm(f => ({ ...f, ogDescription: e.target.value }))}
                    placeholder="Defaults to Meta Description if empty"
                  />
                </div>
                <div>
                  <Label className="text-xs mb-1 block">OG Image URL</Label>
                  <Input
                    className="text-sm h-9"
                    value={form.ogImage}
                    onChange={e => setForm(f => ({ ...f, ogImage: e.target.value }))}
                    placeholder="https://vakilco.in/og-image.png"
                  />
                </div>
              </div>

              <Button
                onClick={handleSave}
                disabled={saving}
                className="w-full bg-[#0f2044] hover:bg-[#0f2044]/90 text-white gap-2"
              >
                <Save size={14} /> {saving ? "Saving..." : "Save SEO Settings"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
