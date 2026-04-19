import { Router } from "express";
import { Ping } from "../controllers/IndexControllers.js";


const router = Router();

// Test Ping
router.get("/ping", Ping);



export default router;