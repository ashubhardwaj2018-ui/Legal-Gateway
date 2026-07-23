import { Router, type IRouter } from "express";
import seoRouter from "./seo";
import servicesRouter from "./services";
import quotationsRouter from "./quotations";
import companyDataRouter from "./company-data";
import lawyersRouter from "./lawyers";
import settingsRouter from "./settings";
import locationsRouter from "./locations";
import leadsRouter from "./leads";
import teamRouter from "./team";
import indianCompaniesRouter from "./indian-companies";
import tasksRouter from "./tasks";
import invoicesRouter from "./invoices";
import chatRouter from "./chat";

const router: IRouter = Router();

router.use(leadsRouter);
router.use(invoicesRouter);
router.use(chatRouter);
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

export default router;
