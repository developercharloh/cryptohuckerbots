import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import dashboardRouter from "./dashboard";
import botsRouter from "./bots";
import cashierRouter from "./cashier";
import tradeRouter from "./trade";
import teamRouter from "./team";
import profileRouter from "./profile";
import notificationsRouter from "./notifications";
import supportRouter from "./support";
import adminRouter from "./admin";
import webhooksRouter from "./webhooks";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(dashboardRouter);
router.use(botsRouter);
router.use(cashierRouter);
router.use(tradeRouter);
router.use(teamRouter);
router.use(profileRouter);
router.use(notificationsRouter);
router.use(supportRouter);
router.use(adminRouter);
router.use(webhooksRouter);

export default router;
