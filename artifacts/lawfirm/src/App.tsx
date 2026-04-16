import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout/Layout";
import Home from "@/pages/home";
import ServiceCategory from "@/pages/service-category";
import NotFound from "@/pages/not-found";
import AdminDashboard from "@/pages/admin/dashboard";
import AdminLeads from "@/pages/admin/leads";
import AdminContacts from "@/pages/admin/contacts";
import AdminQuotations from "@/pages/admin/quotations";
import AdminSeo from "@/pages/admin/seo";
import AdminServices from "@/pages/admin/services";
import AdminCompanyData from "@/pages/admin/company-data";
import AdminNewsletter from "@/pages/admin/newsletter";
import AdminLawyers from "@/pages/admin/lawyers";
import AdminSettings from "@/pages/admin/settings";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});

function Router() {
  return (
    <Switch>
      {/* Admin Routes — no public Layout */}
      <Route path="/admin" component={AdminDashboard} />
      <Route path="/admin/leads" component={AdminLeads} />
      <Route path="/admin/contacts" component={AdminContacts} />
      <Route path="/admin/quotations" component={AdminQuotations} />
      <Route path="/admin/seo" component={AdminSeo} />
      <Route path="/admin/services" component={AdminServices} />
      <Route path="/admin/company-data" component={AdminCompanyData} />
      <Route path="/admin/newsletter" component={AdminNewsletter} />
      <Route path="/admin/lawyers" component={AdminLawyers} />
      <Route path="/admin/settings" component={AdminSettings} />

      {/* Public Routes — wrapped in Navbar/Footer layout */}
      <Route>
        <Layout>
          <Switch>
            <Route path="/" component={Home} />
            <Route path="/services/:id" component={ServiceCategory} />
            <Route component={NotFound} />
          </Switch>
        </Layout>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
