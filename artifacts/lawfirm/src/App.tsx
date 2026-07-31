import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HelmetProvider } from "react-helmet-async";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout/Layout";
import Home from "@/pages/home";
import ServiceCategory from "@/pages/service-category";
import ServiceDetail from "@/pages/service-detail";
import ServiceLocation from "@/pages/service-location";
import NotFound from "@/pages/not-found";
import AdminLogin from "@/pages/admin/login";
import AdminDashboard from "@/pages/admin/dashboard";
import AdminLeads from "@/pages/admin/leads";
import MyLeads from "@/pages/admin/my-leads";
import AdminContacts from "@/pages/admin/contacts";
import AdminQuotations from "@/pages/admin/quotations";
import AdminSeo from "@/pages/admin/seo";
import AdminServices from "@/pages/admin/services";
import AdminCompanyData from "@/pages/admin/company-data";
import AdminNewsletter from "@/pages/admin/newsletter";
import AdminLawyers from "@/pages/admin/lawyers";
import AdminSettings from "@/pages/admin/settings";
import AdminLocations from "@/pages/admin/locations";
import BulkLocationUpload from "@/pages/admin/bulk-location-upload";
import AdminBlogs from "@/pages/admin/blogs";
import AdminTeam from "@/pages/admin/team";
import AdminIndianCompanies from "@/pages/admin/indian-companies";
import AdminTasks from "@/pages/admin/tasks";
import AdminInvoices from "@/pages/admin/invoices";
import AdminChat from "@/pages/admin/chat";
import AdminEmail from "@/pages/admin/email";
import AdminReports from "@/pages/admin/reports";
import AdminPageEditor from "@/pages/admin/page-editor";
import AdminEmployees from "@/pages/admin/employees";
import AdminRoles from "@/pages/admin/roles";
import AdminLoginHistory from "@/pages/admin/login-history";
import AdminActivityLog from "@/pages/admin/activity-log";
import AdminWhatsApp from "@/pages/admin/whatsapp";
import EmployeeDashboard from "@/pages/admin/employee-dashboard";
import TeamPerformance from "@/pages/admin/team-performance";
import PortalLogin from "@/pages/portal/login";
import PortalDashboard from "@/pages/portal/dashboard";
import IndianCompanies from "@/pages/indian-companies";
import CompanyDetail from "@/pages/company-detail";
import BlogList from "@/pages/blog-list";
import BlogPost from "@/pages/blog-post";
import AboutUs from "@/pages/about";
import Careers from "@/pages/careers";
import PrivacyPolicy from "@/pages/privacy";
import TermsOfUse from "@/pages/terms";
import OurLawyers from "@/pages/our-lawyers";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});

function Router() {
  return (
    <Switch>
      {/* Admin login — no layout */}
      <Route path="/admin/login" component={AdminLogin} />

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
      <Route path="/admin/employees" component={AdminEmployees} />
      <Route path="/admin/roles" component={AdminRoles} />
      <Route path="/admin/login-history" component={AdminLoginHistory} />
      <Route path="/admin/activity-log" component={AdminActivityLog} />
      <Route path="/admin/whatsapp" component={AdminWhatsApp} />
      <Route path="/admin/my-dashboard" component={EmployeeDashboard} />
      <Route path="/admin/team-performance" component={TeamPerformance} />

      {/* Customer Portal */}
      <Route path="/portal" component={PortalLogin} />
      <Route path="/portal/dashboard" component={PortalDashboard} />

      {/* Public Routes — wrapped in Navbar/Footer layout */}
      <Route>
        <Layout>
          <Switch>
            <Route path="/" component={Home} />
            <Route path="/about" component={AboutUs} />
            <Route path="/careers" component={Careers} />
            <Route path="/privacy-policy" component={PrivacyPolicy} />
            <Route path="/terms-of-use" component={TermsOfUse} />
            <Route path="/our-lawyers" component={OurLawyers} />
            <Route path="/indian-companies" component={IndianCompanies} />
            <Route path="/company/:slug" component={CompanyDetail} />
            <Route path="/blog" component={BlogList} />
            <Route path="/blog/:slug" component={BlogPost} />
            <Route path="/services/:catId/:slug" component={ServiceDetail} />
            <Route path="/services/:id" component={ServiceCategory} />
            {/* Programmatic SEO — must be last specific route */}
            <Route path="/:serviceSlug/:locationSlug" component={ServiceLocation} />
            <Route component={NotFound} />
          </Switch>
        </Layout>
      </Route>
    </Switch>
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
