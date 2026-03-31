import { Router, type IRouter } from "express";
import healthRouter from "./health";
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

const router: IRouter = Router();

router.use(healthRouter);
router.use(transactionsRouter);
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

export default router;
