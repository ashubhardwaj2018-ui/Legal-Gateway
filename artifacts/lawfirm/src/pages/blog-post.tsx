import { useRoute, Link } from "wouter";
import { Helmet } from "react-helmet-async";
import { useGetBlogBySlug } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { BookOpen, Clock, Eye, Tag, ArrowLeft, Share2, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

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
    publisher: { "@type": "Organization", name: "Vakil & Co. Legal Associates" },
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
      <Helmet>
        <title>{blog.metaTitle || blog.title} | Vakil & Co.</title>
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
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => {
              navigator.clipboard.writeText(window.location.href);
            }}>
              <Share2 size={14} /> Copy Link
            </Button>
          </div>

          {/* CTA */}
          <div className="mt-10 bg-[#0f2044] rounded-2xl p-6 text-white text-center">
            <h3 className="font-serif font-bold text-xl mb-2">Need Expert Legal Advice?</h3>
            <p className="text-white/70 text-sm mb-4">Our team of experienced lawyers is ready to help you with your legal needs.</p>
            <Link href="/contact">
              <Button className="bg-[#c9a227] text-[#0f2044] hover:bg-[#b8911f] font-semibold">
                Book Free Consultation
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
