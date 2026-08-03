import { useState, useRef, useCallback } from "react";
import {
  useListAdminBlogs, useCreateBlog, useUpdateBlog, useDeleteBlog,
  usePublishBlog, useAiGenerateBlog,
  type Blog, type CreateBlogBody, type AiGenerateBlogBody,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "./AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Pencil, Trash2, Eye, Send, Sparkles, Search,
  BookOpen, Clock, Tag, Globe, ChevronLeft, ChevronRight,
  FileText, Loader2, X, RefreshCw,
} from "lucide-react";

const CATEGORIES = [
  { value: "legal-advice", label: "Legal Advice" },
  { value: "business-setup", label: "Business Setup" },
  { value: "tax-compliance", label: "Tax & Compliance" },
  { value: "trademark-ip", label: "Trademark & IP" },
  { value: "property", label: "Property Law" },
  { value: "ngo", label: "NGO & Non-Profit" },
  { value: "fundraising", label: "Fundraising" },
  { value: "general", label: "General" },
];

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700 border border-gray-200",
  published: "bg-green-100 text-green-700 border border-green-200",
  archived: "bg-red-100 text-red-700 border border-red-200",
};

const BLANK_FORM = {
  title: "", slug: "", excerpt: "", content: "", featuredImage: "",
  category: "general", tags: "", status: "draft", authorName: "Legal Filing India",
  metaTitle: "", metaDescription: "", metaKeywords: "", faqs: "",
};

function slugify(t: string) {
  return t.toLowerCase().replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-").replace(/-+/g, "-").slice(0, 100);
}

export default function AdminBlogs() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);

  const [editorOpen, setEditorOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [editing, setEditing] = useState<Blog | null>(null);
  const [form, setForm] = useState({ ...BLANK_FORM });
  const [activeTab, setActiveTab] = useState<"content" | "seo" | "preview">("content");

  // AI form state
  const [aiForm, setAiForm] = useState({
    topic: "", serviceCategory: "", targetCity: "", tone: "professional", wordCount: 800,
  });
  const [aiGenerating, setAiGenerating] = useState(false);

  const { data, isLoading } = useListAdminBlogs({ status: statusFilter === "all" ? undefined : statusFilter, search: search || undefined, page, limit: 20 });
  const createMutation = useCreateBlog();
  const updateMutation = useUpdateBlog();
  const deleteMutation = useDeleteBlog();
  const publishMutation = usePublishBlog();
  const aiMutation = useAiGenerateBlog();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["listAdminBlogs"] });

  const openNew = () => {
    setEditing(null);
    setForm({ ...BLANK_FORM });
    setActiveTab("content");
    setEditorOpen(true);
  };

  const openEdit = (b: Blog) => {
    setEditing(b);
    setForm({
      title: b.title, slug: b.slug, excerpt: b.excerpt ?? "",
      content: b.content, featuredImage: b.featuredImage ?? "",
      category: b.category, tags: b.tags ?? "", status: b.status,
      authorName: b.authorName, metaTitle: b.metaTitle ?? "",
      metaDescription: b.metaDescription ?? "", metaKeywords: b.metaKeywords ?? "",
      faqs: b.faqs ?? "",
    });
    setActiveTab("content");
    setEditorOpen(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) { toast({ title: "Title is required", variant: "destructive" }); return; }
    const payload: CreateBlogBody = {
      title: form.title, slug: form.slug || slugify(form.title),
      excerpt: form.excerpt || null, content: form.content,
      featuredImage: form.featuredImage || null, category: form.category,
      tags: form.tags || null, status: form.status, authorName: form.authorName,
      metaTitle: form.metaTitle || null, metaDescription: form.metaDescription || null,
      metaKeywords: form.metaKeywords || null, faqs: form.faqs || null,
    };
    if (editing) {
      updateMutation.mutate({ id: editing.id, data: payload }, {
        onSuccess: () => { toast({ title: "Blog updated" }); invalidate(); setEditorOpen(false); },
        onError: () => toast({ title: "Update failed", variant: "destructive" }),
      });
    } else {
      createMutation.mutate({ data: payload }, {
        onSuccess: () => { toast({ title: "Blog created" }); invalidate(); setEditorOpen(false); },
        onError: () => toast({ title: "Create failed", variant: "destructive" }),
      });
    }
  };

  const handlePublish = (id: number) => {
    publishMutation.mutate({ id }, {
      onSuccess: () => { toast({ title: "Blog published!" }); invalidate(); },
      onError: () => toast({ title: "Publish failed", variant: "destructive" }),
    });
  };

  const handleDelete = (id: number) => {
    deleteMutation.mutate({ id }, {
      onSuccess: () => { toast({ title: "Blog deleted" }); invalidate(); setDeleteId(null); },
      onError: () => toast({ title: "Delete failed", variant: "destructive" }),
    });
  };

  const handleAiGenerate = async () => {
    if (!aiForm.topic.trim()) { toast({ title: "Topic is required", variant: "destructive" }); return; }
    setAiGenerating(true);
    const payload: AiGenerateBlogBody = {
      topic: aiForm.topic,
      serviceCategory: aiForm.serviceCategory || null,
      targetCity: aiForm.targetCity || null,
      tone: aiForm.tone as AiGenerateBlogBody["tone"],
      wordCount: aiForm.wordCount,
    };
    aiMutation.mutate({ data: payload }, {
      onSuccess: (result) => {
        setForm({
          title: result.title, slug: result.slug, excerpt: result.excerpt,
          content: result.content, featuredImage: "",
          category: result.category || "general", tags: result.tags,
          status: "draft", authorName: "Legal Filing India",
          metaTitle: result.metaTitle, metaDescription: result.metaDescription,
          metaKeywords: result.metaKeywords, faqs: result.faqs,
        });
        setAiGenerating(false);
        setAiOpen(false);
        setEditing(null);
        setActiveTab("content");
        setEditorOpen(true);
        toast({ title: "AI content generated! Review and save." });
      },
      onError: () => {
        setAiGenerating(false);
        toast({ title: "AI generation failed", variant: "destructive" });
      },
    });
  };

  const blogs = data?.data ?? [];
  const total = data?.total ?? 0;
  const pages = data?.pages ?? 1;
  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <AdminLayout
      title="Blog Manager"
      subtitle="Create, edit, and manage blog posts with AI assistance"
      actions={
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setAiOpen(true)} className="gap-1.5 text-purple-600 border-purple-200 hover:bg-purple-50">
            <Sparkles size={14} /> AI Generate
          </Button>
          <Button size="sm" onClick={openNew} className="gap-1.5 bg-[#0f2044] hover:bg-[#1a3260]">
            <Plus size={14} /> New Post
          </Button>
        </div>
      }
    >
      {/* Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {[
          { label: "Total Posts", value: total, icon: BookOpen, color: "text-blue-600 bg-blue-50" },
          { label: "Published", value: blogs.filter(b => b.status === "published").length, icon: Globe, color: "text-green-600 bg-green-50" },
          { label: "Drafts", value: blogs.filter(b => b.status === "draft").length, icon: FileText, color: "text-yellow-600 bg-yellow-50" },
          { label: "Total Views", value: blogs.reduce((s, b) => s + b.viewCount, 0).toLocaleString(), icon: Eye, color: "text-purple-600 bg-purple-50" },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border p-4 flex items-center gap-3">
            <div className={`p-2 rounded-lg ${s.color}`}><s.icon size={16} /></div>
            <div>
              <div className="text-xl font-bold text-[#0f2044]">{s.value}</div>
              <div className="text-xs text-gray-500">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border p-4 mb-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input placeholder="Search posts..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="pl-8 h-9 text-sm" />
        </div>
        <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="w-36 h-9 text-sm"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="draft">Drafts</SelectItem>
            <SelectItem value="published">Published</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="ghost" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ["listAdminBlogs"] })}>
          <RefreshCw size={14} />
        </Button>
      </div>

      {/* Blog List */}
      <div className="bg-white rounded-xl border overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
        ) : blogs.length === 0 ? (
          <div className="py-16 text-center text-gray-500">
            <BookOpen size={32} className="mx-auto mb-3 text-gray-300" />
            <p className="font-medium">No blog posts yet</p>
            <p className="text-sm mt-1">Create one manually or use AI generation</p>
          </div>
        ) : (
          <div className="divide-y">
            {blogs.map(blog => (
              <div key={blog.id} className="p-4 flex items-start gap-4 hover:bg-gray-50 transition-colors">
                <div className="w-10 h-10 rounded-lg bg-[#0f2044]/10 flex items-center justify-center shrink-0">
                  <BookOpen size={16} className="text-[#0f2044]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-[#0f2044] text-sm truncate">{blog.title}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[blog.status] ?? STATUS_COLORS.draft}`}>
                      {blog.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
                    <span className="flex items-center gap-1"><Tag size={10} /> {CATEGORIES.find(c => c.value === blog.category)?.label ?? blog.category}</span>
                    <span className="flex items-center gap-1"><Clock size={10} /> {blog.readingTime} min read</span>
                    <span className="flex items-center gap-1"><Eye size={10} /> {blog.viewCount} views</span>
                    {blog.publishedAt && <span>{new Date(blog.publishedAt).toLocaleDateString("en-IN")}</span>}
                  </div>
                  {blog.excerpt && <p className="text-xs text-gray-400 mt-1 truncate">{blog.excerpt}</p>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {blog.status === "draft" && (
                    <Button variant="ghost" size="sm" className="h-8 text-green-600 hover:text-green-700 hover:bg-green-50 text-xs gap-1"
                      onClick={() => handlePublish(blog.id)}>
                      <Send size={12} /> Publish
                    </Button>
                  )}
                  {blog.status === "published" && (
                    <Button variant="ghost" size="sm" className="h-8 text-blue-600 hover:bg-blue-50 text-xs gap-1" asChild>
                      <a href={`/blog/${blog.slug}`} target="_blank" rel="noopener noreferrer">
                        <Globe size={12} /> View
                      </a>
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-gray-500 hover:text-[#0f2044]" onClick={() => openEdit(blog)}>
                    <Pencil size={14} />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-gray-400 hover:text-red-600" onClick={() => setDeleteId(blog.id)}>
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {pages > 1 && (
          <div className="px-4 py-3 border-t flex items-center justify-between text-sm">
            <span className="text-gray-500">{total} posts</span>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft size={14} />
              </Button>
              <span className="text-gray-600">{page} / {pages}</span>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" disabled={page >= pages} onClick={() => setPage(p => p + 1)}>
                <ChevronRight size={14} />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ── Editor Dialog ── */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0">
          <DialogHeader className="px-6 pt-5 pb-3 border-b shrink-0">
            <DialogTitle className="font-serif text-[#0f2044]">{editing ? "Edit Post" : "New Blog Post"}</DialogTitle>
            <div className="flex gap-1 mt-2">
              {(["content", "seo", "preview"] as const).map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium capitalize transition-colors ${
                    activeTab === tab ? "bg-[#0f2044] text-white" : "text-gray-500 hover:bg-gray-100"
                  }`}>{tab}</button>
              ))}
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-4">
            {activeTab === "content" && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <Label>Title *</Label>
                    <Input value={form.title} onChange={e => {
                      const title = e.target.value;
                      setForm(f => ({ ...f, title, slug: f.slug || slugify(title) }));
                    }} placeholder="Blog post title" className="mt-1" />
                  </div>
                  <div>
                    <Label>URL Slug</Label>
                    <Input value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value }))}
                      placeholder="url-slug" className="mt-1 font-mono text-sm" />
                  </div>
                  <div>
                    <Label>Category</Label>
                    <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>{CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Author</Label>
                    <Input value={form.authorName} onChange={e => setForm(f => ({ ...f, authorName: e.target.value }))} className="mt-1" />
                  </div>
                  <div>
                    <Label>Status</Label>
                    <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="published">Published</SelectItem>
                        <SelectItem value="archived">Archived</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Tags (comma-separated)</Label>
                    <Input value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))}
                      placeholder="gst, registration, india" className="mt-1" />
                  </div>
                  <div>
                    <Label>Featured Image URL</Label>
                    <Input value={form.featuredImage} onChange={e => setForm(f => ({ ...f, featuredImage: e.target.value }))}
                      placeholder="https://..." className="mt-1" />
                  </div>
                  <div className="sm:col-span-2">
                    <Label>Excerpt</Label>
                    <Textarea value={form.excerpt} onChange={e => setForm(f => ({ ...f, excerpt: e.target.value }))}
                      placeholder="Brief summary (shown in listings)" rows={2} className="mt-1 resize-none" />
                  </div>
                  <div className="sm:col-span-2">
                    <Label>Content (HTML)</Label>
                    <Textarea value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                      placeholder="<h2>Introduction</h2><p>Your content here...</p>" rows={12}
                      className="mt-1 resize-none font-mono text-sm" />
                  </div>
                  <div className="sm:col-span-2">
                    <Label>FAQs (JSON array)</Label>
                    <Textarea value={form.faqs} onChange={e => setForm(f => ({ ...f, faqs: e.target.value }))}
                      placeholder='[{"q":"Question?","a":"Answer."}]' rows={3}
                      className="mt-1 resize-none font-mono text-xs" />
                  </div>
                </div>
              </div>
            )}

            {activeTab === "seo" && (
              <div className="space-y-4">
                <div>
                  <Label>Meta Title <span className="text-gray-400 font-normal">(max 60 chars)</span></Label>
                  <Input value={form.metaTitle} onChange={e => setForm(f => ({ ...f, metaTitle: e.target.value }))}
                    placeholder="SEO optimized title" className="mt-1" maxLength={60} />
                  <div className="text-xs text-gray-400 mt-1">{form.metaTitle.length}/60</div>
                </div>
                <div>
                  <Label>Meta Description <span className="text-gray-400 font-normal">(max 160 chars)</span></Label>
                  <Textarea value={form.metaDescription} onChange={e => setForm(f => ({ ...f, metaDescription: e.target.value }))}
                    placeholder="SEO meta description" rows={3} className="mt-1 resize-none" maxLength={160} />
                  <div className="text-xs text-gray-400 mt-1">{form.metaDescription.length}/160</div>
                </div>
                <div>
                  <Label>Meta Keywords</Label>
                  <Input value={form.metaKeywords} onChange={e => setForm(f => ({ ...f, metaKeywords: e.target.value }))}
                    placeholder="keyword1, keyword2, keyword3" className="mt-1" />
                </div>

                {/* SERP Preview */}
                <div className="mt-4 p-4 border rounded-xl bg-gray-50">
                  <p className="text-xs text-gray-500 font-medium mb-3 uppercase tracking-wide">Search Preview</p>
                  <div className="text-[#1a0dab] text-sm font-medium truncate">{form.metaTitle || form.title || "Post title"}</div>
                  <div className="text-[#006621] text-xs mt-0.5">vakil-co.com/blog/{form.slug || "post-slug"}</div>
                  <div className="text-gray-600 text-xs mt-1 leading-relaxed line-clamp-2">
                    {form.metaDescription || form.excerpt || "Meta description will appear here..."}
                  </div>
                </div>
              </div>
            )}

            {activeTab === "preview" && (
              <div className="prose prose-sm max-w-none">
                {form.title && <h1 className="text-2xl font-serif font-bold text-[#0f2044]">{form.title}</h1>}
                {form.excerpt && <p className="text-gray-500 italic">{form.excerpt}</p>}
                {form.content
                  ? <div dangerouslySetInnerHTML={{ __html: form.content }} />
                  : <p className="text-gray-400">No content yet. Add HTML content in the Content tab.</p>
                }
              </div>
            )}
          </div>

          <div className="px-6 py-4 border-t flex items-center justify-between shrink-0 bg-gray-50">
            <Button variant="ghost" onClick={() => setEditorOpen(false)}>Cancel</Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { setForm(f => ({ ...f, status: "draft" })); setTimeout(handleSave, 50); }}
                disabled={isSaving}>Save Draft</Button>
              <Button onClick={() => { setForm(f => ({ ...f, status: "published" })); setTimeout(handleSave, 50); }}
                disabled={isSaving} className="bg-[#0f2044] hover:bg-[#1a3260] gap-1.5">
                {isSaving && <Loader2 size={14} className="animate-spin" />}
                {form.status === "published" ? "Update Post" : "Publish"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── AI Generate Dialog ── */}
      <Dialog open={aiOpen} onOpenChange={setAiOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-serif text-[#0f2044] flex items-center gap-2">
              <Sparkles size={18} className="text-purple-500" /> AI Blog Generator
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="bg-purple-50 border border-purple-100 rounded-lg p-3 text-xs text-purple-700">
              AI will generate a complete blog post with title, content, meta tags, and FAQs. Powered by Claude AI.
            </div>
            <div>
              <Label>Blog Topic *</Label>
              <Input value={aiForm.topic} onChange={e => setAiForm(f => ({ ...f, topic: e.target.value }))}
                placeholder="e.g. How to register a Private Limited Company in India"
                className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Service Category</Label>
                <Select value={aiForm.serviceCategory} onValueChange={v => setAiForm(f => ({ ...f, serviceCategory: v }))}>
                  <SelectTrigger className="mt-1 text-sm"><SelectValue placeholder="Optional" /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Target City</Label>
                <Input value={aiForm.targetCity} onChange={e => setAiForm(f => ({ ...f, targetCity: e.target.value }))}
                  placeholder="e.g. Delhi" className="mt-1" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Writing Tone</Label>
                <Select value={aiForm.tone} onValueChange={v => setAiForm(f => ({ ...f, tone: v }))}>
                  <SelectTrigger className="mt-1 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="professional">Professional</SelectItem>
                    <SelectItem value="conversational">Conversational</SelectItem>
                    <SelectItem value="authoritative">Authoritative</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Target Word Count</Label>
                <Select value={String(aiForm.wordCount)} onValueChange={v => setAiForm(f => ({ ...f, wordCount: parseInt(v) }))}>
                  <SelectTrigger className="mt-1 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="500">~500 words</SelectItem>
                    <SelectItem value="800">~800 words</SelectItem>
                    <SelectItem value="1200">~1200 words</SelectItem>
                    <SelectItem value="1500">~1500 words</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setAiOpen(false)} disabled={aiGenerating}>Cancel</Button>
            <Button onClick={handleAiGenerate} disabled={aiGenerating || !aiForm.topic.trim()}
              className="bg-purple-600 hover:bg-purple-700 gap-1.5">
              {aiGenerating ? <><Loader2 size={14} className="animate-spin" /> Generating...</> : <><Sparkles size={14} /> Generate</>}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirm ── */}
      <Dialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="text-[#0f2044]">Delete Blog Post?</DialogTitle></DialogHeader>
          <p className="text-sm text-gray-600 mt-1">This action cannot be undone. The post will be permanently removed.</p>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="ghost" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteId && handleDelete(deleteId)}
              disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
