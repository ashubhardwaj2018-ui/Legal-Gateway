import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Helmet } from "react-helmet-async";
import { useListBlogs } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Clock, Eye, Tag, ChevronLeft, ChevronRight, BookOpen } from "lucide-react";

function useDebounce<T>(value: T, delay = 400): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

const CATEGORIES = [
  { value: "", label: "All" },
  { value: "legal-advice", label: "Legal Advice" },
  { value: "business-setup", label: "Business Setup" },
  { value: "tax-compliance", label: "Tax & Compliance" },
  { value: "trademark-ip", label: "Trademark & IP" },
  { value: "property", label: "Property Law" },
  { value: "ngo", label: "NGO & Non-Profit" },
  { value: "fundraising", label: "Fundraising" },
  { value: "general", label: "General" },
];

export default function BlogList() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebounce(search, 400);

  const { data, isLoading } = useListBlogs({
    search: debouncedSearch || undefined,
    category: category || undefined,
    page, limit: 9,
  });

  const blogs = data?.data ?? [];
  const total = data?.total ?? 0;
  const pages = data?.pages ?? 1;

  return (
    <>
      <Helmet>
        <title>Legal Blog & Articles | Legal Filing India India's Trusted Filing Platform</title>
        <meta name="description" content="Expert legal advice, updates on Indian law, company registration guides, tax compliance tips and more from the team at Legal Filing India" />
      </Helmet>

      {/* Hero */}
      <section className="bg-[#0f2044] text-white py-14 px-4">
        <div className="max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 text-[#c9a227] text-sm font-medium mb-3">
            <BookOpen size={14} /> Legal Knowledge Hub
          </div>
          <h1 className="text-3xl sm:text-4xl font-serif font-bold mb-3">Legal Blog & Articles</h1>
          <p className="text-white/70 text-sm sm:text-base max-w-xl mx-auto">
            Expert insights on Indian law, company registration, taxation, intellectual property and more.
          </p>
          <div className="mt-6 max-w-md mx-auto relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search articles..."
              className="pl-9 bg-white text-gray-900 border-0 h-11"
            />
          </div>
        </div>
      </section>

      {/* Category Tabs */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 flex gap-1 overflow-x-auto py-2 scrollbar-none">
          {CATEGORIES.map(c => (
            <button
              key={c.value}
              onClick={() => { setCategory(c.value); setPage(1); }}
              className={`px-4 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors font-medium ${
                category === c.value
                  ? "bg-[#0f2044] text-white"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Blog Grid */}
      <div className="max-w-5xl mx-auto px-4 py-10">
        {isLoading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border overflow-hidden">
                <Skeleton className="h-44 w-full rounded-none" />
                <div className="p-4 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : blogs.length === 0 ? (
          <div className="text-center py-20 text-gray-500">
            <BookOpen size={40} className="mx-auto mb-3 text-gray-200" />
            <p className="font-medium text-lg">No articles found</p>
            <p className="text-sm mt-1">Try a different search or category</p>
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-500 mb-4">{total} article{total !== 1 ? "s" : ""} found</p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {blogs.map((blog, i) => (
                <Link key={blog.id} href={`/blog/${blog.slug}`}>
                  <article className={`bg-white rounded-2xl border overflow-hidden hover:shadow-lg transition-shadow cursor-pointer group ${
                    i === 0 && page === 1 ? "sm:col-span-2 lg:col-span-3 flex flex-col sm:flex-row" : ""
                  }`}>
                    {/* Image */}
                    <div className={`bg-[#0f2044]/5 relative overflow-hidden ${
                      i === 0 && page === 1 ? "sm:w-64 lg:w-80 shrink-0 h-48 sm:h-auto" : "h-44"
                    }`}>
                      {blog.featuredImage ? (
                        <img src={blog.featuredImage} alt={blog.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <BookOpen size={32} className="text-[#0f2044]/20" />
                        </div>
                      )}
                      <span className="absolute top-3 left-3 bg-[#c9a227] text-[#0f2044] text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                        {CATEGORIES.find(c => c.value === blog.category)?.label ?? blog.category}
                      </span>
                    </div>

                    {/* Content */}
                    <div className="p-5 flex flex-col justify-between flex-1">
                      <div>
                        <h2 className="font-serif font-bold text-[#0f2044] leading-snug group-hover:text-[#c9a227] transition-colors line-clamp-2">
                          {blog.title}
                        </h2>
                        {blog.excerpt && (
                          <p className="text-gray-500 text-sm mt-2 line-clamp-2 leading-relaxed">{blog.excerpt}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-3 text-xs text-gray-400 flex-wrap">
                        <span className="flex items-center gap-1"><Clock size={10} /> {blog.readingTime} min</span>
                        <span className="flex items-center gap-1"><Eye size={10} /> {blog.viewCount}</span>
                        {blog.publishedAt && <span>{new Date(blog.publishedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>}
                        <span className="text-[#0f2044] font-medium ml-auto">Read →</span>
                      </div>
                    </div>
                  </article>
                </Link>
              ))}
            </div>

            {/* Pagination */}
            {pages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-10">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                  <ChevronLeft size={14} /> Previous
                </Button>
                <span className="text-sm text-gray-600">Page {page} of {pages}</span>
                <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage(p => p + 1)}>
                  Next <ChevronRight size={14} />
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
