import { Router, type IRouter } from "express";
import seoRouter from "./seo";
import servicesRouter from "./services";
import quotationsRouter from "./quotations";
import companyDataRouter from "./company-data";
import lawyersRouter from "./lawyers";
import settingsRouter from "./settings";

const router: IRouter = Router();

router.use(seoRouter);
router.use(servicesRouter);
router.use(quotationsRouter);
router.use(companyDataRouter);
router.use(lawyersRouter);
router.use(settingsRouter);

export default router;
