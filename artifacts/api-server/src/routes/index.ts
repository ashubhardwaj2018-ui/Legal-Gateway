import { Router, type IRouter } from "express";
import healthRouter from "./health";
import consultationsRouter from "./consultations";
import contactsRouter from "./contacts";
import newsletterRouter from "./newsletter";
import statsRouter from "./stats";
import locationsRouter from "./locations";
import { blogsRouter } from "./blogs";
import companiesRouter from "./companies";
import portalRouter from "./portal";
import publicPagesRouter from "./public-pages";
import publicDocRouter from "./public-doc";
import ssrRouter from "./ssr";
import adminRouter from "./admin/index";

const router: IRouter = Router();

// ── Public routes first (no auth required) ────────────────────────────────────
// These MUST be registered before adminRouter, which mounts adminAuthMiddleware
// for all paths passing through it. Any public router registered after adminRouter
// would return 401 to unauthenticated visitors.
router.use(healthRouter);
router.use(consultationsRouter);
router.use(contactsRouter);
router.use(newsletterRouter);
router.use(statsRouter);
router.use(locationsRouter);
router.use(blogsRouter);
router.use(companiesRouter);
router.use(portalRouter);
router.use(publicPagesRouter);
router.use(publicDocRouter);
router.use(ssrRouter);

// ── Admin routes last (protected by adminAuthMiddleware inside) ────────────────
router.use(adminRouter);

export default router;
