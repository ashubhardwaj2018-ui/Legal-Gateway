import { Router, type IRouter } from "express";
import healthRouter from "./health";
import consultationsRouter from "./consultations";
import contactsRouter from "./contacts";
import newsletterRouter from "./newsletter";
import statsRouter from "./stats";
import adminRouter from "./admin/index";
import locationsRouter from "./locations";
import { blogsRouter } from "./blogs";
import { adminBlogsRouter } from "./admin/blogs";
import companiesRouter from "./companies";

const router: IRouter = Router();

router.use(healthRouter);
router.use(consultationsRouter);
router.use(contactsRouter);
router.use(newsletterRouter);
router.use(statsRouter);
router.use(adminRouter);
router.use(locationsRouter);
router.use(blogsRouter);
router.use(adminBlogsRouter);
router.use(companiesRouter);

export default router;
