import { Router, type IRouter } from "express";
import healthRouter from "./health";
import consultationsRouter from "./consultations";
import contactsRouter from "./contacts";
import newsletterRouter from "./newsletter";
import statsRouter from "./stats";
import adminRouter from "./admin/index";
import locationsRouter from "./locations";
import { blogsRouter } from "./blogs";
import companiesRouter from "./companies";
import portalRouter from "./portal";
import publicPagesRouter from "./public-pages";

const router: IRouter = Router();

router.use(healthRouter);
router.use(consultationsRouter);
router.use(contactsRouter);
router.use(newsletterRouter);
router.use(statsRouter);
router.use(adminRouter);
router.use(locationsRouter);
router.use(blogsRouter);
router.use(companiesRouter);
router.use(portalRouter);
router.use(publicPagesRouter);

export default router;
