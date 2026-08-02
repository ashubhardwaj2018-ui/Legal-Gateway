import { useState } from "react";
import {
  X, Sparkles, Loader2, CheckCircle2, AlertCircle,
  RotateCcw, Minimize2, Maximize2, Briefcase, Search,
  Smile, HelpCircle, Tag, AlignLeft, Share2, MousePointerClick,
  Languages, SpellCheck, ChevronDown,
} from "lucide-react";

interface Props {
  fieldLabel: string;
  currentText: string;
  onApply: (text: string) => void;
  onClose: () => void;
}

const ACTIONS = [
  { id: "rewrite",          label: "Rewrite",              icon: RotateCcw,        group: "rewrite" },
  { id: "shorten",          label: "Shorten",              icon: Minimize2,        group: "rewrite" },
  { id: "expand",           label: "Expand",               icon: Maximize2,        group: "rewrite" },
  { id: "professional",     label: "Professional",         icon: Briefcase,        group: "tone" },
  { id: "seo",              label: "SEO Optimised",        icon: Search,           group: "tone" },
  { id: "human_friendly",   label: "Human Friendly",       icon: Smile,            group: "tone" },
  { id: "generate_faq",     label: "Generate FAQ",         icon: HelpCircle,       group: "generate" },
  { id: "meta_title",       label: "Meta Title",           icon: Tag,              group: "generate" },
  { id: "meta_description", label: "Meta Description",     icon: AlignLeft,        group: "generate" },
  { id: "schema",           label: "Generate Schema",      icon: Share2,           group: "generate" },
  { id: "internal_links",   label: "Internal Links",       icon: Share2,           group: "generate" },
  { id: "generate_cta",     label: "Generate CTA",         icon: MousePointerClick,group: "generate" },
  { id: "translate",        label: "Translate to Hindi",   icon: Languages,        group: "utility" },
  { id: "grammar",          label: "Grammar Check",        icon: SpellCheck,       group: "utility" },
] as const;

type ActionId = typeof ACTIONS[number]["id"];

const GROUPS: Record<string, string> = {
  rewrite:  "Rewrite & Tone",
  tone:     "Tone",
  generate: "Generate",
  utility:  "Utility",
};

const PROVIDERS = [
  { id: "anthropic", label: "Claude (Anthropic)", color: "bg-orange-500" },
  { id: "openai",    label: "ChatGPT (OpenAI)",  color: "bg-green-500" },
] as const;

type ProviderId = "anthropic" | "openai";

export default function AIPanel({ fieldLabel, currentText, onApply, onClose }: Props) {
  const [provider, setProvider]   = useState<ProviderId>("anthropic");
  const [loading, setLoading]     = useState(false);
  const [result, setResult]       = useState<string | null>(null);
  const [error, setError]         = useState<string | null>(null);
  const [action, setAction]       = useState<ActionId | null>(null);

  async function runAction(actionId: ActionId) {
    if (!currentText.trim()) {
      setError("This field is empty — add some text first.");
      return;
    }
    setAction(actionId);
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const r = await fetch("/api/admin/ai/improve", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: currentText, action: actionId, provider }),
      });
      const data = await r.json() as { result?: string; error?: string };
      if (!r.ok || data.error) throw new Error(data.error ?? "AI request failed");
      setResult(data.result ?? "");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "AI request failed");
    } finally {
      setLoading(false);
    }
  }

  // Group actions for rendering
  const groups = ["rewrite", "tone", "generate", "utility"] as const;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
              <Sparkles size={14} className="text-white" />
            </div>
            <div>
              <p className="font-semibold text-sm text-gray-900">AI Writing Assistant</p>
              <p className="text-xs text-gray-400 truncate max-w-56">Field: {fieldLabel}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <X size={16} />
          </button>
        </div>

        {/* Provider selector */}
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">AI Provider</p>
          <div className="flex gap-2">
            {PROVIDERS.map(p => (
              <button
                key={p.id}
                onClick={() => setProvider(p.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                  provider === p.id
                    ? "border-[#0f2044] bg-[#0f2044] text-white"
                    : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${p.color}`} />
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

          {/* Actions grid by group */}
          {groups.map(g => {
            const groupActions = ACTIONS.filter(a => a.group === g || (g === "rewrite" && a.group === "tone"));
            if (g === "tone") return null; // merged with rewrite
            return (
              <div key={g}>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  {GROUPS[g]}
                </p>
                <div className="grid grid-cols-3 gap-1.5">
                  {ACTIONS.filter(a => a.group === g || (g === "rewrite" && a.group === "tone")).map(a => {
                    const Icon = a.icon;
                    const isRunning = loading && action === a.id;
                    return (
                      <button
                        key={a.id}
                        onClick={() => runAction(a.id)}
                        disabled={loading}
                        className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-all border ${
                          action === a.id && !loading && result
                            ? "border-violet-300 bg-violet-50 text-violet-700"
                            : "border-gray-200 bg-white text-gray-700 hover:border-[#0f2044]/30 hover:bg-[#0f2044]/5 disabled:opacity-50"
                        }`}
                      >
                        {isRunning
                          ? <Loader2 size={12} className="animate-spin shrink-0 text-violet-500" />
                          : <Icon size={12} className="shrink-0" />}
                        {a.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Loading state */}
          {loading && (
            <div className="flex items-center gap-3 py-4 text-violet-600">
              <Loader2 size={18} className="animate-spin" />
              <span className="text-sm">
                {PROVIDERS.find(p => p.id === provider)?.label} is working…
              </span>
            </div>
          )}

          {/* Error */}
          {error && !loading && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          {/* Result preview */}
          {result !== null && !loading && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <CheckCircle2 size={13} className="text-green-500" />
                Result — review before applying
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm text-gray-800 leading-relaxed max-h-48 overflow-y-auto whitespace-pre-wrap font-mono text-xs">
                {result}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { onApply(result); onClose(); }}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#0f2044] text-white text-sm font-medium rounded-xl hover:bg-[#0f2044]/90 transition-colors"
                >
                  <CheckCircle2 size={14} /> Apply to Field
                </button>
                <button
                  onClick={() => setResult(null)}
                  className="px-4 py-2.5 border border-gray-200 text-gray-600 text-sm rounded-xl hover:bg-gray-50"
                >
                  Discard
                </button>
              </div>
            </div>
          )}

          {/* Current text preview */}
          {!result && !loading && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
              <p className="text-[10px] font-semibold text-blue-400 uppercase tracking-wider mb-1.5">Current content</p>
              <p className="text-xs text-blue-800 leading-relaxed line-clamp-4">
                {currentText || <span className="italic text-blue-400">Empty field</span>}
              </p>
            </div>
          )}

        </div>

        {/* Footer hint */}
        <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
          <p className="text-[10px] text-gray-400 text-center">
            AI-generated content uses Replit AI Integrations · Review before applying
          </p>
        </div>
      </div>
    </div>
  );
}
