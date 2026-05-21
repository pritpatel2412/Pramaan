import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import projectsRouter from "./projects";
import credentialsRouter from "./credentials";
import testSuitesRouter from "./testSuites";
import runsRouter from "./runs";
import reportsRouter from "./reports";
import analyticsRouter from "./analytics";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(projectsRouter);
router.use(credentialsRouter);
router.use(testSuitesRouter);
router.use(runsRouter);
router.use(reportsRouter);
router.use(analyticsRouter);

export default router;
