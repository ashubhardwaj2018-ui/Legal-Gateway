import { Router, type IRouter } from "express";
import healthRouter from "./health";
import consultationsRouter from "./consultations";
import contactsRouter from "./contacts";
import newsletterRouter from "./newsletter";
import statsRouter from "./stats";

const router: IRouter = Router();

router.use(healthRouter);
router.use(consultationsRouter);
router.use(contactsRouter);
router.use(newsletterRouter);
router.use(statsRouter);

export default router;
