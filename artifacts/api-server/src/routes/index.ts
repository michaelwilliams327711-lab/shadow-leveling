import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import characterRouter from "./character.js";
import questsRouter from "./quests.js";
import shopRouter from "./shop.js";
import bossesRouter from "./bosses.js";
import awakeningRouter from "./awakening.js";
import rngRouter from "./rng.js";
import dashboardRouter from "./dashboard.js";
import dailyOrdersRouter from "./daily-orders.js";
import badHabitsRouter from "./badHabits.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(characterRouter);
router.use(questsRouter);
router.use(shopRouter);
router.use(bossesRouter);
router.use(awakeningRouter);
router.use(rngRouter);
router.use(dashboardRouter);
router.use(dailyOrdersRouter);
router.use(badHabitsRouter);

export default router;
