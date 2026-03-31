import { Router, type IRouter } from "express";
import healthRouter from "./health";
import transactionsRouter from "./transactions";
import monthlyConfigRouter from "./monthly-config";
import budgetGoalsRouter from "./budget-goals";
import goalVaultsRouter from "./goal-vaults";
import dashboardRouter from "./dashboard";
import budgetAnalysisRouter from "./budget-analysis";
import surplusRouter from "./surplus";

const router: IRouter = Router();

router.use(healthRouter);
router.use(transactionsRouter);
router.use(monthlyConfigRouter);
router.use(budgetGoalsRouter);
router.use(goalVaultsRouter);
router.use(dashboardRouter);
router.use(budgetAnalysisRouter);
router.use(surplusRouter);

export default router;
