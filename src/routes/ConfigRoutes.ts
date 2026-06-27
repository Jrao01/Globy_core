import { Router } from "express";
import { GetConfig, UpdateConfig, CreateConfig } from "../controllers/ConfigControllers.js";
import { verifyToken, verifyRole } from "../middlewares/authMiddleware.js";
import { upload } from "../middlewares/uploadMiddleware.js";

const router = Router();

router.get("/data", verifyToken, GetConfig);
router.post("/create", verifyToken, verifyRole("admin"), CreateConfig);
router.put("/update", verifyToken, verifyRole("admin"), UpdateConfig);

// Nueva ruta para subir el logo
router.post("/upload-logo", verifyToken, verifyRole("admin"), upload.single("logo"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: "No se subió ningún archivo" });
  }
  const logoUrl = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;
  res.json({ success: true, data: { logoUrl } });
});

// Ruta para subir banner de la tienda
router.post("/upload-banner", verifyToken, verifyRole("admin"), upload.single("banner"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: "No se subió ningún archivo" });
  }
  const bannerImg = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;
  res.json({ success: true, data: { bannerImg } });
});

export default router;
