import { Router } from "express";
import { GetConfig, UpdateConfig, CreateConfig } from "../controllers/ConfigControllers.js";
import { verifyToken } from "../middlewares/authMiddleware.js";
import { upload } from "../middlewares/uploadMiddleware.js";

const router = Router();

router.get("/data", verifyToken, GetConfig);
router.post("/create", verifyToken, CreateConfig);
router.put("/update", verifyToken, UpdateConfig);

// Nueva ruta para subir el logo
router.post("/upload-logo", verifyToken, upload.single("logo"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: "No se subió ningún archivo" });
  }
  const logoUrl = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;
  res.json({ success: true, data: { logoUrl } });
});

export default router;
