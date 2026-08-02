import { Router, type IRouter } from "express";
import seoRouter from "./seo";
import servicesRouter from "./services";
import quotationsRouter from "./quotations";
import companyDataRouter from "./company-data";
import lawyersRouter from "./lawyers";
import settingsRouter from "./settings";
import locationsRouter from "./locations";
import leadsRouter from "./leads";
import leadsAssignmentRouter from "./leads-assignment";
import teamRouter from "./team";
import attendanceMeRouter from "./attendance-self-service";
import indianCompaniesRouter from "./indian-companies";
import tasksRouter from "./tasks";
import invoicesRouter from "./invoices";
import chatRouter from "./chat";
import dashboardRouter from "./dashboard";
import emailRouter from "./email";
import reportsRouter from "./reports";
import { authRouter, adminAuthMiddleware, seedDefaultAdmin, seedDefaultRoles, seedDefaultRolePermissions, crudActivityMiddleware, makeModulePermissionMiddleware } from "./auth";
import { adminBlogsRouter } from "./blogs";
import pagesRouter from "./pages";
import employeesRouter from "./employees";
import rolesRouter from "./roles";
import loginHistoryRouter from "./login-history";
import activityLogsRouter from "./activity-logs";
import performanceRouter from "./performance";
import notificationsRouter, { startFollowUpScheduler } from "./notifications";
import portalAdminRouter from "./portal-admin";
import portalAccessRouter from "./portal-access";
import apiManagerRouter from "./api-manager";
import whatsappRouter from "./whatsapp";
import aiRouter from "./ai";
import dbManagerRouter from "./db-manager/index";

const router: IRouter = Router();

// Seed defaults on startup
seedDefaultAdmin().catch(() => {});
seedDefaultRoles().catch(() => {});
seedDefaultRolePermissions().catch(() => {});

// Follow-up reminder scheduler
startFollowUpScheduler();

// Public auth routes (no auth required)
router.use(authRouter);

// --- All routes below require valid admin session ---
router.use(adminAuthMiddleware);

// Auto-log all successful mutations (POST/PUT/PATCH/DELETE) to activity_logs
router.use(crudActivityMiddleware);

// Self-service attendance routes — accessible to all authenticated users (no module
// permission needed); must be registered before makeModulePermissionMiddleware.
router.use(attendanceMeRouter);

// Enforce module-level permissions for non-admin (employee) sessions.
// Admins have permissions.all = true and skip all checks.
// Each tuple: [URL prefix, module name] — sorted longest-first for correct matching.
router.use(makeModulePermissionMiddleware([
  ["/admin/activity-logs",      "employees"],
  ["/admin/login-history",      "employees"],
  ["/admin/indian-companies",   "indian_companies"],
  ["/admin/attendance-corrections", "team"],
  ["/admin/attendance/report",      "team"],
  ["/admin/working-hours",          "team"],
  ["/admin/company-data",       "company_data"],
  ["/admin/dashboard",          "dashboard"],
  ["/admin/quotations",         "quotations"],
  ["/admin/newsletter",         "newsletter"],
  ["/admin/locations",          "locations"],
  ["/admin/employees",          "employees"],
  ["/admin/contacts",           "contacts"],
  ["/admin/invoices",           "invoices"],
  ["/admin/reports",            "reports"],
  ["/admin/lawyers",            "lawyers"],
  ["/admin/services",           "services"],
  ["/admin/settings",           "settings"],
  ["/admin/tasks",              "tasks"],
  ["/admin/leads",              "leads",   [{ pattern: /\/assign(ments)?(\/|$)/, actions: ["assign"] }]],
  ["/admin/email",              "email"],
  ["/admin/roles",              "employees"],
  ["/admin/pages",              "settings"],
  ["/admin/team",               "team"],
  ["/admin/chat",               "chat"],
  ["/admin/blogs",              "seo"],
  ["/admin/seo",                "seo"],
  ["/admin/performance/team",   "team"],
  ["/admin/whatsapp",           "whatsapp"],
  ["/admin/ai",                 "settings"],
  ["/admin/db-manager",         "database"],
]));


router.use(leadsAssignmentRouter);
router.use(leadsRouter);
router.use(invoicesRouter);
router.use(chatRouter);
router.use(dashboardRouter);
router.use(emailRouter);
router.use(reportsRouter);
router.use(tasksRouter);
router.use(teamRouter);
router.use(indianCompaniesRouter);
router.use(seoRouter);
router.use(servicesRouter);
router.use(quotationsRouter);
router.use(companyDataRouter);
router.use(lawyersRouter);
router.use(settingsRouter);
router.use(locationsRouter);
router.use(pagesRouter);
router.use(employeesRouter);
router.use(rolesRouter);
router.use(loginHistoryRouter);
router.use(activityLogsRouter);
router.use(adminBlogsRouter);
router.use(performanceRouter);
router.use(notificationsRouter);
router.use(portalAdminRouter);
router.use(portalAccessRouter);
router.use(apiManagerRouter);
router.use(whatsappRouter);
router.use(aiRouter);
router.use(dbManagerRouter);

export default router;
