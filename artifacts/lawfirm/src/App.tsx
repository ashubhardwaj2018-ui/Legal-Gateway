import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { useEffect, lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HelmetProvider } from "react-helmet-async";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout/Layout";

// ── Public pages — loaded eagerly (affect initial paint) ─────────────────────
import Home from "@/pages/home";
import Contact from "@/pages/contact";
import AboutUs from "@/pages/about";
import NotFound from "@/pages/not-found";

// ── Public pages — lazy (not needed on first paint) ──────────────────────────
const ServiceCategory   = lazy(() => import("@/pages/service-category"));
const ServiceDetail     = lazy(() => import("@/pages/service-detail"));
const ServiceLocation   = lazy(() => import("@/pages/service-location"));
const StateHub          = lazy(() => import("@/pages/state-hub"));
const IndianCompanies   = lazy(() => import("@/pages/indian-companies"));
const CompanyDetail     = lazy(() => import("@/pages/company-detail"));
const BlogList          = lazy(() => import("@/pages/blog-list"));
const BlogPost          = lazy(() => import("@/pages/blog-post"));
const Careers           = lazy(() => import("@/pages/careers"));
const PrivacyPolicy     = lazy(() => import("@/pages/privacy"));
const TermsOfUse        = lazy(() => import("@/pages/terms"));
const OurLawyers        = lazy(() => import("@/pages/our-lawyers"));
const Sitemap           = lazy(() => import("@/pages/sitemap"));

// ── Admin auth pages ──────────────────────────────────────────────────────────
const AdminLogin          = lazy(() => import("@/pages/admin/login"));
const AdminChangePassword = lazy(() => import("@/pages/admin/change-password"));
const ForgotPassword      = lazy(() => import("@/pages/admin/forgot-password"));
const ResetPassword       = lazy(() => import("@/pages/admin/reset-password"));

// ── Admin pages ───────────────────────────────────────────────────────────────
const AdminDashboard        = lazy(() => import("@/pages/admin/dashboard"));
const AdminLeads            = lazy(() => import("@/pages/admin/leads"));
const MyLeads               = lazy(() => import("@/pages/admin/my-leads"));
const AdminContacts         = lazy(() => import("@/pages/admin/contacts"));
const AdminQuotations       = lazy(() => import("@/pages/admin/quotations"));
const AdminSeo              = lazy(() => import("@/pages/admin/seo"));
const AdminServices         = lazy(() => import("@/pages/admin/services"));
const AdminCompanyData      = lazy(() => import("@/pages/admin/company-data"));
const AdminNewsletter       = lazy(() => import("@/pages/admin/newsletter"));
const AdminLawyers          = lazy(() => import("@/pages/admin/lawyers"));
const AdminSettings         = lazy(() => import("@/pages/admin/settings"));
const AdminLocations        = lazy(() => import("@/pages/admin/locations"));
const BulkLocationUpload    = lazy(() => import("@/pages/admin/bulk-location-upload"));
const BulkServiceUpload     = lazy(() => import("@/pages/admin/bulk-service-upload"));
const AdminBlogs            = lazy(() => import("@/pages/admin/blogs"));
const AdminTeam             = lazy(() => import("@/pages/admin/team"));
const AdminIndianCompanies  = lazy(() => import("@/pages/admin/indian-companies"));
const AdminTasks            = lazy(() => import("@/pages/admin/tasks"));
const AdminInvoices         = lazy(() => import("@/pages/admin/invoices"));
const AdminChat             = lazy(() => import("@/pages/admin/chat"));
const AdminEmail            = lazy(() => import("@/pages/admin/email"));
const AdminReports          = lazy(() => import("@/pages/admin/reports"));
const AdminPageEditor       = lazy(() => import("@/pages/admin/page-editor"));
const AdminDbManager        = lazy(() => import("@/pages/admin/db-manager"));
const AdminEmployees        = lazy(() => import("@/pages/admin/employees"));
const AdminRoles            = lazy(() => import("@/pages/admin/roles"));
const AdminLoginHistory     = lazy(() => import("@/pages/admin/login-history"));
const AdminActivityLog      = lazy(() => import("@/pages/admin/activity-log"));
const AdminWhatsApp         = lazy(() => import("@/pages/admin/whatsapp"));
const AdminPSEOManager      = lazy(() => import("@/pages/admin/pseo-manager"));
const EmployeeDashboard     = lazy(() => import("@/pages/admin/employee-dashboard"));
const TeamPerformance       = lazy(() => import("@/pages/admin/team-performance"));
const PortalAccessPage      = lazy(() => import("@/pages/admin/portal-access"));
const ApiManagerPage        = lazy(() => import("@/pages/admin/api-manager"));

// ── Customer portal ───────────────────────────────────────────────────────────
const PortalLogin     = lazy(() => import("@/pages/portal/login"));
const PortalDashboard = lazy(() => import("@/pages/portal/dashboard"));

// ── Public document view ──────────────────────────────────────────────────────
const DocView = lazy(() => import("@/pages/public/DocView"));

// ─────────────────────────────────────────────────────────────────────────────

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});

/** Minimal full-page spinner shown while a lazy chunk loads */
function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-gray-200 border-t-[#0f2044] rounded-full animate-spin" />
    </div>
  );
}

function ScrollToTop() {
  const [location] = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [location]);
  return null;
}

function Router() {
  return (
    <Suspense fallback={<PageLoader />}>
      <ScrollToTop />
      <Switch>
        {/* Admin auth pages — no layout */}
        <Route path="/admin/login" component={AdminLogin} />
        <Route path="/admin/change-password" component={AdminChangePassword} />
        <Route path="/admin/forgot-password" component={ForgotPassword} />
        <Route path="/admin/reset-password" component={ResetPassword} />

        {/* Admin Routes — no public Layout */}
        <Route path="/admin" component={AdminDashboard} />
        <Route path="/admin/leads" component={AdminLeads} />
        <Route path="/admin/my-leads" component={MyLeads} />
        <Route path="/admin/contacts" component={AdminContacts} />
        <Route path="/admin/quotations" component={AdminQuotations} />
        <Route path="/admin/seo" component={AdminSeo} />
        <Route path="/admin/services" component={AdminServices} />
        <Route path="/admin/company-data" component={AdminCompanyData} />
        <Route path="/admin/newsletter" component={AdminNewsletter} />
        <Route path="/admin/lawyers" component={AdminLawyers} />
        <Route path="/admin/settings" component={AdminSettings} />
        <Route path="/admin/locations" component={AdminLocations} />
        <Route path="/admin/bulk-location-upload" component={BulkLocationUpload} />
        <Route path="/admin/blogs" component={AdminBlogs} />
        <Route path="/admin/team" component={AdminTeam} />
        <Route path="/admin/indian-companies" component={AdminIndianCompanies} />
        <Route path="/admin/tasks" component={AdminTasks} />
        <Route path="/admin/invoices" component={AdminInvoices} />
        <Route path="/admin/chat" component={AdminChat} />
        <Route path="/admin/email" component={AdminEmail} />
        <Route path="/admin/reports" component={AdminReports} />
        <Route path="/admin/page-editor" component={AdminPageEditor} />
        <Route path="/admin/db-manager" component={AdminDbManager} />
        <Route path="/admin/employees" component={AdminEmployees} />
        <Route path="/admin/roles" component={AdminRoles} />
        <Route path="/admin/login-history" component={AdminLoginHistory} />
        <Route path="/admin/activity-log" component={AdminActivityLog} />
        <Route path="/admin/whatsapp" component={AdminWhatsApp} />
        <Route path="/admin/pseo" component={AdminPSEOManager} />
        <Route path="/admin/bulk-service-upload" component={BulkServiceUpload} />
        <Route path="/admin/my-dashboard" component={EmployeeDashboard} />
        <Route path="/admin/team-performance" component={TeamPerformance} />
        <Route path="/admin/portal-access" component={PortalAccessPage} />
        <Route path="/admin/api-manager" component={ApiManagerPage} />

        {/* Public document view — no auth, no layout */}
        <Route path="/public/doc/:token" component={DocView} />

        {/* Customer Portal */}
        <Route path="/portal" component={PortalLogin} />
        <Route path="/portal/dashboard" component={PortalDashboard} />

        {/* Public Routes — wrapped in Navbar/Footer layout */}
        <Route>
          <Layout>
            <Switch>
              <Route path="/" component={Home} />
              <Route path="/contact" component={Contact} />
              <Route path="/about" component={AboutUs} />
              <Route path="/careers" component={Careers} />
              <Route path="/privacy-policy" component={PrivacyPolicy} />
              <Route path="/terms-of-use" component={TermsOfUse} />
              <Route path="/our-lawyers" component={OurLawyers} />
              <Route path="/indian-companies" component={IndianCompanies} />
              <Route path="/company/:slug" component={CompanyDetail} />
              <Route path="/blog" component={BlogList} />
              <Route path="/blog/:slug" component={BlogPost} />
              <Route path="/sitemap" component={Sitemap} />
              <Route path="/services/:catId/:slug" component={ServiceDetail} />
              <Route path="/services/:id" component={ServiceCategory} />
              {/* State hub — must be before pSEO catch-all */}
              <Route path="/state/:stateSlug" component={StateHub} />
              {/* Programmatic SEO — must be last specific route */}
              <Route path="/:serviceSlug/:locationSlug" component={ServiceLocation} />
              <Route component={NotFound} />
            </Switch>
          </Layout>
        </Route>
      </Switch>
    </Suspense>
  );
}

export default function App() {
  return (
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </HelmetProvider>
  );
}
