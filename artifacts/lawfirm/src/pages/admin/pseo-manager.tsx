import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AdminLayout } from "./AdminLayout";
import {
  Globe, RefreshCw, Send, FileText, MapPin, BarChart2,
  ExternalLink, CheckCircle2, AlertCircle, Loader2, Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface PseoStats {
  totalLocations: number;
  totalServices: number;
  totalPseoUrls: number;
  pseoSitemapFiles: number;
  locationsPerFile: number;
  serviceCategories: number;
  baseDomain: string;
}

interface RebuildResult {
  inserted: number;
  locationsCovered: number;
  serviceCount: number;
  elapsed: number;
}

interface PingResult {
  google: boolean;
  bing: boolean;
  message: string;
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

function StatCard({ icon: Icon, label, value, sub, color = "blue" }: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}) {
  const colors: Record<string, string> = {
    blue: "bg-blue-50 text-blue-600",
    gold: "bg-yellow-50 text-yellow-600",
    green: "bg-green-50 text-green-600",
    navy: "bg-[#0f2044]/5 text-[#0f2044]",
    purple: "bg-purple-50 text-purple-600",
  };
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 flex gap-4 items-start">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${colors[color] ?? colors.blue}`}>
        <Icon size={18} />
      </div>
      <div>
        <div className="text-2xl font-bold text-[#0f2044]">
          {typeof value === "number" ? value.toLocaleString("en-IN") : value}
        </div>
        <div className="text-sm font-medium text-gray-700">{label}</div>
        {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

export default function AdminPSEOManager() {
  const [rebuildLog, setRebuildLog] = useState<string | null>(null);
  const [pingLog, setPingLog] = useState<string | null>(null);

  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useQuery<PseoStats>({
    queryKey: ["pseo-public-stats"],
    queryFn: () => fetch(`${BASE}/api/pseo-stats`).then((r) => r.json()),
    staleTime: 30_000,
  });

  const { data: uploadLogs } = useQuery<UploadLog[]>({
    queryKey: ["location-upload-logs"],
    queryFn: () =>
      fetch(`${BASE}/api/admin/location-upload-logs`, { credentials: "include" }).then((r) => r.json()),
  });

  const { data: adminStats, isLoading: adminStatsLoading } = useQuery<{
    total: number; states: number; districts: number; cities: number; active: number;
  }>({
    queryKey: ["admin-locations-stats"],
    queryFn: () =>
      fetch(`${BASE}/api/admin/locations/stats`, { credentials: "include" }).then((r) => r.json()),
  });

  const rebuildMutation = useMutation<RebuildResult>({
    mutationFn: () =>
      fetch(`${BASE}/api/admin/locations/rebuild-relationships`, {
        method: "POST",
        credentials: "include",
      }).then((r) => r.json()),
    onSuccess: (data) => {
      setRebuildLog(
        `✅ Done! Inserted ${data.inserted.toLocaleString()} service-location relationships for ${data.locationsCovered.toLocaleString()} locations × ${data.serviceCount} services in ${(data.elapsed / 1000).toFixed(1)}s.`
      );
      refetchStats();
    },
    onError: () => setRebuildLog("❌ Rebuild failed. Check server logs."),
  });

  const pingMutation = useMutation<PingResult>({
    mutationFn: () =>
      fetch(`${BASE}/api/admin/sitemap/ping`, {
        method: "POST",
        credentials: "include",
      }).then((r) => r.json()),
    onSuccess: (data) => {
      const parts = [];
      if (data.google) parts.push("✅ Google");
      else parts.push("⚠️ Google (failed)");
      if (data.bing) parts.push("✅ Bing");
      else parts.push("⚠️ Bing (failed)");
      setPingLog(`Ping result: ${parts.join("  |  ")} — ${data.message}`);
    },
    onError: () => setPingLog("❌ Ping request failed. Check server logs."),
  });

  const sitemapBase = `${window.location.origin}/api`;

  return (
    <AdminLayout title="pSEO Engine Manager" subtitle="Manage programmatic SEO — locations, sitemaps, and search engine submission">
      <div className="max-w-6xl mx-auto py-6 px-4 space-y-8">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-serif font-bold text-[#0f2044]">pSEO Engine Manager</h1>
            <p className="text-sm text-gray-500 mt-1">
              Manage programmatic SEO — service × location pages, sitemaps, and search engine submission.
            </p>
          </div>
          <Button
            variant="outline" size="sm"
            onClick={() => { refetchStats(); }}
            className="gap-2"
          >
            <RefreshCw size={14} /> Refresh Stats
          </Button>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard
            icon={MapPin} label="Active Locations" color="navy"
            value={statsLoading ? "…" : (stats?.totalLocations ?? 0)}
            sub={`${adminStats?.states ?? "?"} states · ${adminStats?.districts ?? "?"} districts`}
          />
          <StatCard
            icon={FileText} label="Services Indexed" color="gold"
            value={statsLoading ? "…" : (stats?.totalServices ?? 0)}
            sub={`${stats?.serviceCategories ?? "?"} categories`}
          />
          <StatCard
            icon={Globe} label="Total pSEO URLs" color="blue"
            value={statsLoading ? "…" : (stats?.totalPseoUrls ?? 0)}
            sub={`${stats?.pseoSitemapFiles ?? "?"} sitemap files`}
          />
          <StatCard
            icon={BarChart2} label="Cities Covered" color="green"
            value={adminStatsLoading ? "…" : (adminStats?.cities ?? 0)}
            sub={`${adminStats?.active ?? "?"} active locations`}
          />
          <StatCard
            icon={Search} label="Sitemap Files" color="purple"
            value={statsLoading ? "…" : (stats?.pseoSitemapFiles ?? 0)}
            sub={`~${stats?.locationsPerFile ?? "?"} locs per file`}
          />
          <StatCard
            icon={CheckCircle2} label="URLs per File" color="blue"
            value={statsLoading ? "…" : (stats?.locationsPerFile && stats?.totalServices ? (stats.locationsPerFile * stats.totalServices).toLocaleString("en-IN") : "…")}
            sub="≤ 50,000 limit"
          />
        </div>

        {/* Action panel */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Rebuild Relationships */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-xl bg-[#0f2044]/5 flex items-center justify-center">
                <RefreshCw size={16} className="text-[#0f2044]" />
              </div>
              <div>
                <h3 className="font-semibold text-[#0f2044]">Rebuild Service-Location Index</h3>
                <p className="text-xs text-gray-500">Auto-creates priority relationships for all active locations × all services</p>
              </div>
            </div>
            <p className="text-xs text-gray-500 mb-4 leading-relaxed">
              Populates the <code className="bg-gray-100 px-1 rounded">service_locations</code> table with featured service-location pairs. 
              This does not affect page rendering (all combinations work regardless), but powers featured listings and analytics.
              Run this after a bulk location upload.
            </p>
            {rebuildLog && (
              <div className={`mb-3 p-3 rounded-lg text-xs font-medium ${rebuildLog.startsWith("✅") ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
                {rebuildLog}
              </div>
            )}
            <Button
              className="w-full bg-[#0f2044] hover:bg-[#1a3060] text-white gap-2"
              onClick={() => { setRebuildLog(null); rebuildMutation.mutate(); }}
              disabled={rebuildMutation.isPending}
            >
              {rebuildMutation.isPending ? <><Loader2 size={14} className="animate-spin" /> Rebuilding…</> : <><RefreshCw size={14} /> Rebuild Relationships</>}
            </Button>
          </div>

          {/* Ping Search Engines */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-xl bg-[#c9a227]/10 flex items-center justify-center">
                <Send size={16} className="text-[#c9a227]" />
              </div>
              <div>
                <h3 className="font-semibold text-[#0f2044]">Ping Search Engines</h3>
                <p className="text-xs text-gray-500">Submit sitemap to Google and Bing for faster indexing</p>
              </div>
            </div>
            <p className="text-xs text-gray-500 mb-4 leading-relaxed">
              Notifies Google Search Console and Bing Webmaster Tools of your updated sitemap index.
              Do this after adding new locations, services, or blog posts to trigger re-crawl.
            </p>
            {pingLog && (
              <div className={`mb-3 p-3 rounded-lg text-xs font-medium ${pingLog.includes("✅") ? "bg-green-50 text-green-700" : "bg-yellow-50 text-yellow-700"}`}>
                {pingLog}
              </div>
            )}
            <Button
              className="w-full bg-[#c9a227] hover:bg-[#b8911f] text-[#0f2044] font-bold gap-2"
              onClick={() => { setPingLog(null); pingMutation.mutate(); }}
              disabled={pingMutation.isPending}
            >
              {pingMutation.isPending ? <><Loader2 size={14} className="animate-spin" /> Pinging…</> : <><Send size={14} /> Ping Google & Bing</>}
            </Button>
          </div>
        </div>

        {/* Sitemap Links */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6">
          <h3 className="font-semibold text-[#0f2044] mb-4 flex items-center gap-2">
            <Globe size={16} /> Sitemap Files
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              { label: "Sitemap Index", path: "/api/sitemap.xml", desc: "Root sitemap index" },
              { label: "Static Pages", path: "/api/sitemap-static.xml", desc: `Static + all ${stats?.totalServices ?? "?"} service pages` },
              { label: "Blog Articles", path: "/api/sitemap-blogs.xml", desc: "All published blog posts" },
              { label: "Companies", path: "/api/sitemap-companies.xml", desc: "Indian company database" },
              { label: "pSEO Page 1", path: "/api/sitemap-pseo-1.xml", desc: `First ${(stats?.locationsPerFile ?? 0) * (stats?.totalServices ?? 0)} service×city URLs` },
              { label: "robots.txt", path: "/api/robots.txt", desc: "Crawl rules + sitemap ref" },
            ].map((item) => (
              <a
                key={item.path}
                href={`${sitemapBase.replace("/api", "")}${item.path}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between p-3 border border-gray-200 rounded-xl hover:border-[#c9a227] hover:bg-[#c9a227]/5 transition-all group"
              >
                <div>
                  <div className="text-sm font-medium text-[#0f2044] group-hover:text-[#c9a227] transition-colors">{item.label}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{item.desc}</div>
                </div>
                <ExternalLink size={13} className="text-gray-300 group-hover:text-[#c9a227] shrink-0" />
              </a>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-4">
            All sitemap files are generated dynamically and cached for 24 hours. 
            pSEO sitemaps cover all {(stats?.totalServices ?? "?")} services × all {(stats?.totalLocations ?? "?")} active locations
            split into {stats?.pseoSitemapFiles ?? "?"} files of ~{stats?.locationsPerFile ? (stats.locationsPerFile * (stats?.totalServices ?? 0)).toLocaleString("en-IN") : "?"} URLs each.
          </p>
        </div>

        {/* Upload history */}
        {uploadLogs && uploadLogs.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-2xl p-6">
            <h3 className="font-semibold text-[#0f2044] mb-4 flex items-center gap-2">
              <MapPin size={16} /> Recent Location Uploads
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                    <th className="pb-2 font-medium">File</th>
                    <th className="pb-2 font-medium">Total</th>
                    <th className="pb-2 font-medium">Inserted</th>
                    <th className="pb-2 font-medium">Errors</th>
                    <th className="pb-2 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {uploadLogs.slice(0, 10).map((log) => (
                    <tr key={log.id} className="border-b border-gray-50 last:border-0">
                      <td className="py-2 text-[#0f2044] font-medium">{log.fileName}</td>
                      <td className="py-2 text-gray-600">{log.totalRows.toLocaleString("en-IN")}</td>
                      <td className="py-2 text-green-600">{log.inserted.toLocaleString("en-IN")}</td>
                      <td className="py-2">
                        {log.errors > 0 ? (
                          <span className="text-red-500 flex items-center gap-1">
                            <AlertCircle size={12} />{log.errors}
                          </span>
                        ) : (
                          <span className="text-green-500 flex items-center gap-1"><CheckCircle2 size={12} />0</span>
                        )}
                      </td>
                      <td className="py-2 text-gray-400 text-xs">{new Date(log.createdAt).toLocaleDateString("en-IN")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Quick Links */}
        <div className="bg-[#0f2044]/5 rounded-2xl p-5">
          <h3 className="font-semibold text-[#0f2044] mb-3 text-sm">Quick Links</h3>
          <div className="flex flex-wrap gap-2">
            {[
              { label: "Manage Locations", href: "/admin/locations" },
              { label: "Bulk Upload", href: "/admin/bulk-location-upload" },
              { label: "SEO Settings", href: "/admin/seo" },
              { label: "Blog Manager", href: "/admin/blogs" },
              { label: "Services & Pricing", href: "/admin/services" },
              { label: "Settings", href: "/admin/settings" },
            ].map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium text-[#0f2044] hover:border-[#c9a227] hover:text-[#c9a227] transition-colors"
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>

      </div>
    </AdminLayout>
  );
}
