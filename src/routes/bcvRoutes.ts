import { Router } from "express";
import { SyncBcvPrice, CheckBcvPrice } from "../controllers/BcvControllers.js";

const router = Router();

router.post("/sync", SyncBcvPrice);
router.get("/check", CheckBcvPrice);

export default router;
