import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import transactionsRouter from "./transactions";
import monthlyConfigRouter from "./monthly-config";
import budgetGoalsRouter from "./budget-goals";
import dashboardRouter from "./dashboard";
import budgetAnalysisRouter from "./budget-analysis";
import surplusRouter from "./surplus";
import accountsRouter from "./accounts";
import categoriesRouter from "./categories";
import transfersRouter from "./transfers";
import trendsRouter from "./trends";
import goalsRouter from "./goals";
import analyticsRouter from "./analytics";
import settingsRouter from "./settings";
import aiRouter from "./ai";
import aiChatRouter from "./ai-chat";
import { aiRateLimiter } from "../lib/rate-limit";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated()) {
    next();
    return;
  }
  res.status(401).json({ error: "Unauthorized" });
}

router.use(requireAuth);

router.use("/ai", aiRateLimiter);
router.use("/transactions/parse-natural", aiRateLimiter);
router.use(transactionsRouter);
router.use(aiChatRouter);
router.use(monthlyConfigRouter);
router.use(budgetGoalsRouter);
router.use(dashboardRouter);
router.use(budgetAnalysisRouter);
router.use(surplusRouter);
router.use(accountsRouter);
router.use(categoriesRouter);
router.use(transfersRouter);
router.use(trendsRouter);
router.use(goalsRouter);
router.use(analyticsRouter);
router.use(settingsRouter);
router.use(aiRouter);

export default router;
