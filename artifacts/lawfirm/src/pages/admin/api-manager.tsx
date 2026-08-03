import { useState, useCallback } from "react";
import { AdminLayout } from "./AdminLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Bot, Search, CreditCard, MessageCircle, Bell, HardDrive,
  Shield, ScanLine, Share2, Mail, Grid3x3, ChevronDown, ChevronRight,
  CheckCircle2, XCircle, HelpCircle, Zap, Clock, ScrollText, Trash2,
  ExternalLink, RefreshCw, Eye, EyeOff, Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { format, formatDistanceToNow } from "date-fns";

// ── Types ────────────────────────────────────────────────────────────────────

interface ApiField {
  key: string;
  label: string;
  sensitive?: boolean;
  placeholder?: string;
  type?: "text" | "url" | "password" | "textarea";
  hint?: string;
}

interface ApiIntegration {
  slug: string;
  name: string;
  category: string;
  description: string;
  badge: string | null;
  testable: boolean;
  fields: ApiField[];
  enabled: boolean;
  status: "untested" | "ok" | "error";
  statusMessage: string | null;
  lastUsedAt: string | null;
  config: Record<string, string>;
}

interface ApiLog {
  id: number;
  slug: string;
  action: string;
  ok: boolean;
  message: string | null;
  createdAt: string;
}

// ── Constants ────────────────────────────────────────────────────────────────

const SENSITIVE_PLACEHOLDER = "__SET__";

const CATEGORIES = [
  { id: "all",           label: "All APIs",       Icon: Grid3x3 },
  { id: "ai",            label: "AI & ML",         Icon: Bot },
  { id: "google",        label: "Google APIs",     Icon: Search },
  { id: "payments",      label: "Payments",        Icon: CreditCard },
  { id: "messaging",     label: "Messaging",       Icon: MessageCircle },
  { id: "notifications", label: "Notifications",   Icon: Bell },
  { id: "storage",       label: "Storage",         Icon: HardDrive },
  { id: "security",      label: "Security",        Icon: Shield },
  { id: "ocr",           label: "OCR & Vision",    Icon: ScanLine },
  { id: "social",        label: "Social / Meta",   Icon: Share2 },
  { id: "email",         label: "Email",           Icon: Mail },
] as const;

// ── Status helpers ───────────────────────────────────────────────────────────

function StatusBadge({ status, enabled }: { status: string; enabled: boolean }) {
  if (!enabled) return <Badge variant="outline" className="text-xs text-muted-foreground">Disabled</Badge>;
  if (status === "ok")       return <Badge className="text-xs bg-emerald-100 text-emerald-700 border-emerald-200">● Connected</Badge>;
  if (status === "error")    return <Badge variant="destructive" className="text-xs">● Error</Badge>;
  return <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">● Untested</Badge>;
}

function StatusIcon({ status, enabled }: { status: string; enabled: boolean }) {
  if (!enabled)            return <HelpCircle className="h-4 w-4 text-muted-foreground" />;
  if (status === "ok")     return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
  if (status === "error")  return <XCircle className="h-4 w-4 text-red-500" />;
  return <HelpCircle className="h-4 w-4 text-amber-400" />;
}

// ── Logs Dialog ──────────────────────────────────────────────────────────────

function LogsDialog({ slug, name }: { slug: string; name: string }) {
  const [open, setOpen] = useState(false);
  const { data: logs = [], isLoading } = useQuery<ApiLog[]>({
    queryKey: ["api-logs", slug],
    queryFn: async () => {
      const r = await fetch(`/api/admin/api-integrations/${slug}/logs`, { credentials: "include" });
      return r.json();
    },
    enabled: open,
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1">
          <ScrollText className="h-3 w-3" /> Logs
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScrollText className="h-4 w-4" /> {name} — Activity Logs
          </DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <div className="py-8 text-center text-muted-foreground text-sm">Loading logs…</div>
        ) : logs.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground text-sm">No activity logged yet.</div>
        ) : (
          <div className="space-y-1">
            {logs.map(log => (
              <div key={log.id} className={cn(
                "flex items-start gap-3 px-3 py-2 rounded-md text-sm",
                log.ok ? "bg-emerald-50" : "bg-red-50",
              )}>
                {log.ok
                  ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
                  : <XCircle    className="h-3.5 w-3.5 text-red-500 mt-0.5 shrink-0" />}
                <div className="min-w-0 flex-1">
                  <span className="font-medium capitalize">{log.action}</span>
                  {log.message && <span className="text-muted-foreground ml-2">{log.message}</span>}
                </div>
                <span className="text-xs text-muted-foreground shrink-0">
                  {format(new Date(log.createdAt), "dd MMM, HH:mm")}
                </span>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Single API Card ──────────────────────────────────────────────────────────

function ApiCard({ integration, onRefresh }: { integration: ApiIntegration; onRefresh: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [showValues, setShowValues] = useState<Set<string>>(new Set());
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  // Initialise form when card opens
  const handleOpen = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      const init: Record<string, string> = {};
      for (const f of integration.fields) {
        // sensitive fields show as empty (user must re-enter to change)
        init[f.key] = f.sensitive ? "" : (integration.config[f.key] ?? "");
      }
      setFormValues(init);
      setTestResult(null);
    }
  };

  const isSet = (field: ApiField) =>
    field.sensitive && integration.config[field.key] === SENSITIVE_PLACEHOLDER;

  const toggleMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const r = await fetch(`/api/admin/api-integrations/${integration.slug}/toggle`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      if (!r.ok) throw new Error("Toggle failed");
      return r.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["api-integrations"] }),
    onError: () => toast({ title: "Error", description: "Could not toggle API", variant: "destructive" }),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/admin/api-integrations/${integration.slug}`, {
        method: "PUT", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: formValues }),
      });
      if (!r.ok) throw new Error("Save failed");
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "Saved", description: `${integration.name} configuration saved.` });
      queryClient.invalidateQueries({ queryKey: ["api-integrations"] });
      setOpen(false);
    },
    onError: () => toast({ title: "Error", description: "Could not save configuration", variant: "destructive" }),
  });

  const clearFieldMutation = useMutation({
    mutationFn: async (field: string) => {
      const r = await fetch(`/api/admin/api-integrations/${integration.slug}/field/${field}`, {
        method: "DELETE", credentials: "include",
      });
      if (!r.ok) throw new Error("Clear failed");
    },
    onSuccess: (_data, field) => {
      toast({ title: "Cleared", description: `${field} removed.` });
      queryClient.invalidateQueries({ queryKey: ["api-integrations"] });
    },
  });

  const handleTest = useCallback(async () => {
    setTesting(true);
    setTestResult(null);
    try {
      // Save first, then test
      const saveR = await fetch(`/api/admin/api-integrations/${integration.slug}`, {
        method: "PUT", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: formValues }),
      });
      if (!saveR.ok) throw new Error("Save failed");

      const r = await fetch(`/api/admin/api-integrations/${integration.slug}/test`, {
        method: "POST", credentials: "include",
      });
      const data = await r.json() as { ok: boolean; message: string };
      setTestResult(data);
      queryClient.invalidateQueries({ queryKey: ["api-integrations"] });
    } catch {
      setTestResult({ ok: false, message: "Request failed — check network or server" });
    } finally {
      setTesting(false);
    }
  }, [integration.slug, formValues, queryClient]);

  // SMTP redirect card
  if (integration.fields.some(f => f.key === "_redirect")) {
    return (
      <div className="border rounded-xl p-4 bg-white flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">{integration.name}</span>
              <Badge variant="outline" className="text-xs">Configured elsewhere</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{integration.description}</p>
          </div>
        </div>
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
          SMTP is configured in <strong>Site Settings → Email</strong> section.
        </p>
        <Button variant="outline" size="sm" asChild>
          <a href="/admin/settings">Open Site Settings <ExternalLink className="h-3 w-3 ml-1" /></a>
        </Button>
      </div>
    );
  }

  return (
    <Collapsible open={open} onOpenChange={handleOpen}>
      <div className={cn(
        "border rounded-xl bg-white transition-shadow",
        open ? "shadow-md ring-1 ring-primary/20" : "hover:shadow-sm",
      )}>
        {/* Card header */}
        <div className="flex items-center gap-3 p-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm">{integration.name}</span>
              {integration.badge && (
                <Badge className="text-xs bg-amber-100 text-amber-700 border-amber-200">
                  <Sparkles className="h-2.5 w-2.5 mr-1" />{integration.badge}
                </Badge>
              )}
              <StatusBadge status={integration.status} enabled={integration.enabled} />
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{integration.description}</p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Switch
              checked={integration.enabled}
              onCheckedChange={(v) => toggleMutation.mutate(v)}
              disabled={toggleMutation.isPending}
            />
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
          </div>
        </div>

        {/* Expanded config */}
        <CollapsibleContent>
          <div className="border-t px-4 pb-4 pt-3 space-y-4">

            {/* Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {integration.fields.map(field => {
                const set = isSet(field);
                const show = showValues.has(field.key);
                const inputType = field.sensitive
                  ? (show ? "text" : "password")
                  : (field.type === "url" ? "url" : "text");

                if (field.type === "textarea") {
                  return (
                    <div key={field.key} className="sm:col-span-2 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-medium">{field.label}</Label>
                        {set && (
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-emerald-600 flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3" /> Set
                            </span>
                            <Button variant="ghost" size="icon" className="h-5 w-5"
                              onClick={() => clearFieldMutation.mutate(field.key)}>
                              <Trash2 className="h-3 w-3 text-red-400" />
                            </Button>
                          </div>
                        )}
                      </div>
                      <Textarea
                        rows={4}
                        className="text-xs font-mono"
                        placeholder={set ? "••• already set — paste to replace •••" : (field.placeholder ?? field.hint ?? "")}
                        value={formValues[field.key] ?? ""}
                        onChange={e => setFormValues(p => ({ ...p, [field.key]: e.target.value }))}
                      />
                      {field.hint && !set && <p className="text-xs text-muted-foreground">{field.hint}</p>}
                    </div>
                  );
                }

                return (
                  <div key={field.key} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-medium">{field.label}</Label>
                      {set && (
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-emerald-600 flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" /> Set
                          </span>
                          <Button variant="ghost" size="icon" className="h-5 w-5"
                            onClick={() => clearFieldMutation.mutate(field.key)}>
                            <Trash2 className="h-3 w-3 text-red-400" />
                          </Button>
                        </div>
                      )}
                    </div>
                    <div className="relative">
                      <Input
                        type={inputType}
                        className={cn("text-xs pr-8", field.type === "url" && "pr-2")}
                        placeholder={
                          set ? "••••••••• (leave blank to keep existing)" :
                          (field.placeholder ?? field.hint ?? "")
                        }
                        value={formValues[field.key] ?? ""}
                        onChange={e => setFormValues(p => ({ ...p, [field.key]: e.target.value }))}
                        autoComplete="off"
                      />
                      {field.sensitive && (
                        <button
                          type="button"
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          onClick={() => setShowValues(s => {
                            const n = new Set(s);
                            n.has(field.key) ? n.delete(field.key) : n.add(field.key);
                            return n;
                          })}
                        >
                          {show ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                        </button>
                      )}
                    </div>
                    {field.hint && <p className="text-xs text-muted-foreground">{field.hint}</p>}
                  </div>
                );
              })}
            </div>

            {/* Test result */}
            {testResult && (
              <div className={cn(
                "flex items-start gap-2 text-sm px-3 py-2 rounded-lg border",
                testResult.ok
                  ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                  : "bg-red-50 border-red-200 text-red-800",
              )}>
                {testResult.ok
                  ? <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
                  : <XCircle className="h-4 w-4 mt-0.5 shrink-0" />}
                <span>{testResult.message}</span>
              </div>
            )}

            {/* Footer actions */}
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-2">
                {integration.testable && (
                  <Button
                    variant="outline" size="sm"
                    onClick={handleTest}
                    disabled={testing}
                    className="gap-1.5"
                  >
                    {testing
                      ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      : <Zap className="h-3.5 w-3.5" />}
                    {testing ? "Testing…" : "Test Connection"}
                  </Button>
                )}
                <LogsDialog slug={integration.slug} name={integration.name} />
              </div>

              <div className="flex items-center gap-2">
                {integration.lastUsedAt && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatDistanceToNow(new Date(integration.lastUsedAt), { addSuffix: true })}
                  </span>
                )}
                <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
                <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? "Saving…" : "Save"}
                </Button>
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function ApiManagerPage() {
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();

  const { data: integrations = [], isLoading } = useQuery<ApiIntegration[]>({
    queryKey: ["api-integrations"],
    queryFn: async () => {
      const r = await fetch("/api/admin/api-integrations", { credentials: "include" });
      if (!r.ok) throw new Error("Failed to load integrations");
      return r.json();
    },
    refetchInterval: 60_000,
  });

  const filtered = integrations.filter(i => {
    const matchCat  = activeCategory === "all" || i.category === activeCategory;
    const q         = search.toLowerCase();
    const matchText = !q || i.name.toLowerCase().includes(q) || i.description.toLowerCase().includes(q) || i.category.toLowerCase().includes(q);
    return matchCat && matchText;
  });

  const countByCategory = (id: string) =>
    id === "all" ? integrations.length : integrations.filter(i => i.category === id).length;

  const enabledCount  = integrations.filter(i => i.enabled).length;
  const connectedCount = integrations.filter(i => i.status === "ok").length;
  const errorCount    = integrations.filter(i => i.enabled && i.status === "error").length;

  return (
    <AdminLayout title="API Manager">
      <div className="flex flex-col h-full min-h-0">
        {/* Page header */}
        <div className="px-6 pt-6 pb-4 border-b shrink-0">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-2xl font-bold">API Manager</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Configure, test, and monitor every external API integration from one place
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-sm font-medium">{enabledCount} enabled · {connectedCount} connected</p>
                {errorCount > 0 && (
                  <p className="text-xs text-red-600">{errorCount} with errors</p>
                )}
              </div>
              <Button
                variant="outline" size="sm"
                onClick={() => queryClient.invalidateQueries({ queryKey: ["api-integrations"] })}
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Category sidebar */}
          <div className="w-52 shrink-0 border-r overflow-y-auto py-3 px-2 hidden md:block">
            {CATEGORIES.map(({ id, label, Icon }) => {
              const count = countByCategory(id);
              return (
                <button
                  key={id}
                  onClick={() => setActiveCategory(id)}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors",
                    activeCategory === id
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <span className="flex items-center gap-2">
                    <Icon className="h-4 w-4" />
                    {label}
                  </span>
                  <span className={cn(
                    "text-xs rounded-full px-1.5 py-0.5 min-w-[1.25rem] text-center",
                    activeCategory === id ? "bg-primary/20" : "bg-muted",
                  )}>{count}</span>
                </button>
              );
            })}
          </div>

          {/* Cards panel */}
          <div className="flex-1 overflow-y-auto p-4 md:p-6">
            {/* Mobile category tabs */}
            <div className="flex gap-1.5 overflow-x-auto pb-2 mb-4 md:hidden">
              {CATEGORIES.map(({ id, label }) => (
                <button key={id}
                  onClick={() => setActiveCategory(id)}
                  className={cn(
                    "shrink-0 px-3 py-1.5 rounded-full text-xs border transition-colors",
                    activeCategory === id
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border text-muted-foreground",
                  )}
                >{label}</button>
              ))}
            </div>

            {/* Search */}
            <div className="relative mb-5">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search APIs…"
                className="pl-9"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>

            {/* Status summary for active category */}
            {activeCategory !== "all" && (
              <div className="flex items-center gap-4 mb-4 text-xs text-muted-foreground">
                <span className="font-medium text-foreground capitalize">{activeCategory}</span>
                <span>{filtered.filter(i => i.enabled).length} / {filtered.length} enabled</span>
                {filtered.some(i => i.enabled && i.status === "error") && (
                  <span className="text-red-600 flex items-center gap-1">
                    <XCircle className="h-3 w-3" />
                    {filtered.filter(i => i.enabled && i.status === "error").length} error(s)
                  </span>
                )}
              </div>
            )}

            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {Array.from({ length: 9 }).map((_, i) => (
                  <div key={i} className="border rounded-xl h-24 bg-muted/40 animate-pulse" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Grid3x3 className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No APIs match your search</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {filtered.map(integration => (
                  <ApiCard
                    key={integration.slug}
                    integration={integration}
                    onRefresh={() => queryClient.invalidateQueries({ queryKey: ["api-integrations"] })}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
