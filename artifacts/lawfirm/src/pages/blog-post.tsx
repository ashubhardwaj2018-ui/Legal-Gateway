import { useRoute, Link } from "wouter";
import { Helmet } from "react-helmet-async";
import { useGetBlogBySlug, useListBlogs } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { BookOpen, Clock, Eye, Tag, ArrowLeft, Share2, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useRef } from "react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full text-left px-4 py-3.5 flex items-center justify-between bg-white hover:bg-gray-50 transition-colors"
      >
        <span className="font-medium text-[#0f2044] text-sm pr-4">{q}</span>
        <span className="shrink-0 text-[#c9a227] font-bold text-lg">{open ? "−" : "+"}</span>
      </button>
      {open && <div className="px-4 pb-4 text-sm text-gray-600 leading-relaxed border-t bg-gray-50">{a}</div>}
    </div>
  );
}

const CATEGORY_LABELS: Record<string, string> = {
  "legal-advice": "Legal Advice", "business-setup": "Business Setup",
  "tax-compliance": "Tax & Compliance", "trademark-ip": "Trademark & IP",
  "property": "Property Law", "ngo": "NGO & Non-Profit",
  "fundraising": "Fundraising", "general": "General",
};

function RelatedPosts({ category, currentSlug }: { category: string; currentSlug: string }) {
  const { data } = useListBlogs({ category, limit: 4 });
  const posts = (data?.data ?? []).filter(p => p.slug !== currentSlug).slice(0, 3);
  if (posts.length === 0) return null;
  return (
    <div className="border-t pt-10 mt-10">
      <h2 className="text-2xl font-serif font-bold text-[#0f2044] mb-6">Related Articles</h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {posts.map(post => (
          <Link key={post.slug} href={`/blog/${post.slug}`}>
            <div className="group border rounded-xl overflow-hidden hover:shadow-md transition-all cursor-pointer h-full flex flex-col">
              {post.featuredImage
                ? <img src={post.featuredImage} alt={post.title} className="w-full h-36 object-cover group-hover:scale-105 transition-transform duration-300" />
                : <div className="w-full h-36 bg-[#0f2044]/5 flex items-center justify-center"><BookOpen size={28} className="text-[#0f2044]/20" /></div>
              }
              <div className="p-4 flex flex-col flex-1">
                <span className="text-[#c9a227] text-xs font-semibold mb-1.5">{CATEGORY_LABELS[post.category] ?? post.category}</span>
                <h3 className="font-serif font-semibold text-[#0f2044] text-sm leading-snug group-hover:text-[#c9a227] transition-colors line-clamp-2 flex-1">{post.title}</h3>
                <div className="flex items-center gap-3 mt-3 text-xs text-gray-400">
                  <span className="flex items-center gap-1"><Clock size={10} /> {post.readingTime} min</span>
                  <span className="flex items-center gap-1"><Eye size={10} /> {post.viewCount}</span>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function ReadingProgressBar() {
  const [progress, setProgress] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const update = () => {
      const el = document.documentElement;
      const scrollTop = el.scrollTop || document.body.scrollTop;
      const scrollHeight = el.scrollHeight - el.clientHeight;
      setProgress(scrollHeight > 0 ? Math.min(100, (scrollTop / scrollHeight) * 100) : 0);
    };
    const onScroll = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(update);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] h-0.5 bg-transparent pointer-events-none">
      <div
        className="h-full bg-[#c9a227] transition-none"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}

export default function BlogPost() {
  const [, params] = useRoute("/blog/:slug");
  const slug = params?.slug ?? "";

  const { data: blog, isLoading, isError } = useGetBlogBySlug(slug);

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12">
        <Skeleton className="h-8 w-3/4 mb-4" />
        <Skeleton className="h-4 w-1/2 mb-8" />
        <Skeleton className="h-64 w-full mb-6" />
        {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-4 w-full mb-3" />)}
      </div>
    );
  }

  if (isError || !blog) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <BookOpen size={40} className="mx-auto mb-4 text-gray-300" />
        <h1 className="text-2xl font-serif font-bold text-[#0f2044]">Article Not Found</h1>
        <p className="text-gray-500 mt-2 mb-6">The article you're looking for doesn't exist or has been removed.</p>
        <Link href="/blog">
          <Button className="bg-[#0f2044] hover:bg-[#1a3260]">← Back to Blog</Button>
        </Link>
      </div>
    );
  }

  const faqs: { q: string; a: string }[] = (() => {
    try { return blog.faqs ? JSON.parse(blog.faqs) : []; } catch { return []; }
  })();

  const tags = blog.tags ? blog.tags.split(",").map(t => t.trim()).filter(Boolean) : [];
  const categoryLabel = CATEGORY_LABELS[blog.category] ?? blog.category;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: blog.metaTitle || blog.title,
    description: blog.metaDescription || blog.excerpt,
    datePublished: blog.publishedAt,
    dateModified: blog.updatedAt,
    author: { "@type": "Organization", name: blog.authorName },
    publisher: { "@type": "Organization", name: "Legal Filing India India's Trusted Filing Platform" },
    ...(blog.featuredImage && { image: blog.featuredImage }),
    ...(faqs.length > 0 && {
      mainEntity: faqs.map(f => ({
        "@type": "Question", name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    }),
  };

  return (
    <>
      <ReadingProgressBar />
      <Helmet>
        <title>{blog.metaTitle || blog.title} | Legal Filing India</title>
        <meta name="description" content={blog.metaDescription || blog.excerpt || ""} />
        {blog.metaKeywords && <meta name="keywords" content={blog.metaKeywords} />}
        <meta property="og:title" content={blog.metaTitle || blog.title} />
        <meta property="og:description" content={blog.metaDescription || blog.excerpt || ""} />
        {blog.ogImage && <meta property="og:image" content={blog.ogImage} />}
        {blog.featuredImage && !blog.ogImage && <meta property="og:image" content={blog.featuredImage} />}
        <meta property="og:type" content="article" />
        <link rel="canonical" href={`${BASE}/blog/${blog.slug}`} />
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      </Helmet>

      <div className="bg-white">
        {/* Breadcrumb */}
        <div className="border-b">
          <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-1.5 text-xs text-gray-500">
            <Link href="/" className="hover:text-[#0f2044]">Home</Link>
            <ChevronRight size={10} />
            <Link href="/blog" className="hover:text-[#0f2044]">Blog</Link>
            <ChevronRight size={10} />
            <span className="text-gray-700 truncate">{blog.title}</span>
          </div>
        </div>

        {/* Hero */}
        <div className="bg-[#0f2044] text-white pt-10 pb-0">
          <div className="max-w-3xl mx-auto px-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="bg-[#c9a227] text-[#0f2044] text-xs font-bold px-3 py-1 rounded-full">{categoryLabel}</span>
              {tags.slice(0, 2).map(tag => (
                <span key={tag} className="text-white/60 text-xs border border-white/20 px-2 py-0.5 rounded-full">{tag}</span>
              ))}
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-serif font-bold leading-tight mb-4">{blog.title}</h1>
            {blog.excerpt && <p className="text-white/70 text-sm sm:text-base leading-relaxed mb-5">{blog.excerpt}</p>}
            <div className="flex items-center gap-4 text-white/60 text-xs pb-6 border-b border-white/10 flex-wrap">
              <span className="font-medium text-white/80">{blog.authorName}</span>
              {blog.publishedAt && <span>{new Date(blog.publishedAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</span>}
              <span className="flex items-center gap-1"><Clock size={11} /> {blog.readingTime} min read</span>
              <span className="flex items-center gap-1"><Eye size={11} /> {blog.viewCount} views</span>
            </div>
          </div>
        </div>

        {/* Featured Image */}
        {blog.featuredImage && (
          <div className="max-w-3xl mx-auto px-4 -mt-1">
            <img src={blog.featuredImage} alt={blog.title}
              className="w-full h-64 sm:h-80 object-cover rounded-b-2xl shadow-lg" />
          </div>
        )}

        {/* Content */}
        <div className="max-w-3xl mx-auto px-4 py-10">
          <div
            className="prose prose-base prose-headings:font-serif prose-headings:text-[#0f2044] prose-a:text-[#c9a227] prose-a:no-underline hover:prose-a:underline prose-li:text-gray-700 prose-p:text-gray-700 prose-p:leading-relaxed max-w-none"
            dangerouslySetInnerHTML={{ __html: blog.content }}
          />

          {/* FAQs */}
          {faqs.length > 0 && (
            <div className="mt-10 pt-8 border-t">
              <h2 className="text-2xl font-serif font-bold text-[#0f2044] mb-5">Frequently Asked Questions</h2>
              <div className="space-y-2">
                {faqs.map((faq, i) => <FaqItem key={i} q={faq.q} a={faq.a} />)}
              </div>
            </div>
          )}

          {/* Tags */}
          {tags.length > 0 && (
            <div className="mt-8 pt-6 border-t flex items-center gap-2 flex-wrap">
              <Tag size={14} className="text-gray-400" />
              {tags.map(tag => (
                <span key={tag} className="bg-gray-100 text-gray-600 text-xs px-3 py-1 rounded-full">{tag}</span>
              ))}
            </div>
          )}

          {/* Share + Back */}
          <div className="mt-8 pt-6 border-t flex items-center justify-between flex-wrap gap-3">
            <Link href="/blog">
              <Button variant="outline" size="sm" className="gap-1.5">
                <ArrowLeft size={14} /> Back to Blog
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 flex items-center gap-1"><Share2 size={12} /> Share:</span>
              <a
                href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(blog.title)}&url=${encodeURIComponent(window.location.href)}`}
                target="_blank" rel="noopener noreferrer"
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-[#1DA1F2] hover:text-white flex items-center justify-center transition-colors text-gray-600"
                title="Share on Twitter/X"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.259 5.63L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
              </a>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(blog.title + " " + window.location.href)}`}
                target="_blank" rel="noopener noreferrer"
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-[#25D366] hover:text-white flex items-center justify-center transition-colors text-gray-600"
                title="Share on WhatsApp"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              </a>
              <a
                href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(window.location.href)}`}
                target="_blank" rel="noopener noreferrer"
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-[#0A66C2] hover:text-white flex items-center justify-center transition-colors text-gray-600"
                title="Share on LinkedIn"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
              </a>
              <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs" onClick={() => {
                navigator.clipboard.writeText(window.location.href);
              }}>
                Copy Link
              </Button>
            </div>
          </div>

          {/* CTA */}
          <div className="mt-10 bg-[#0f2044] rounded-2xl p-6 text-white text-center">
            <h3 className="font-serif font-bold text-xl mb-2">Need Expert Legal Advice?</h3>
            <p className="text-white/70 text-sm mb-4">Our team of experienced lawyers is ready to help you with your legal needs.</p>
            <Link href="/services/consult-expert">
              <Button className="bg-[#c9a227] text-[#0f2044] hover:bg-[#b8911f] font-semibold">
                Book Free Consultation
              </Button>
            </Link>
          </div>

          {/* Related Posts */}
          <RelatedPosts category={blog.category} currentSlug={blog.slug} />
        </div>
      </div>
    </>
  );
}
