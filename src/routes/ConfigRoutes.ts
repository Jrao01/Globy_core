import { Router } from "express";
import { GetConfig, UpdateConfig, CreateConfig, ListarSinergias, CrearSinergia, ActualizarSinergia, EliminarSinergia, SeedSinergiasDefault, ListarCoeficientes, ActualizarCoeficiente, ListarCiudades, SyncCiudadesFromAPI, ConsultarCiudad } from "../controllers/ConfigControllers.js";
import { verifyToken, verifyRole } from "../middleware/authMiddleware.js";
import { upload } from "../middleware/uploadMiddleware.js";

const router = Router();

router.get("/data", GetConfig);
router.post("/create", verifyToken, verifyRole("admin"), CreateConfig);
router.put("/update", verifyToken, verifyRole("admin"), UpdateConfig);
router.get("/sinergias", verifyToken, verifyRole("admin", "gerente"), ListarSinergias);
router.post("/sinergias", verifyToken, verifyRole("admin", "gerente"), CrearSinergia);
router.put("/sinergias/:id", verifyToken, verifyRole("admin", "gerente"), ActualizarSinergia);
router.delete("/sinergias/:id", verifyToken, verifyRole("admin", "gerente"), EliminarSinergia);
router.post("/sinergias/seed", verifyToken, verifyRole("admin", "gerente"), SeedSinergiasDefault);

// Coeficientes de estacionalidad
router.get("/coeficientes", verifyToken, ListarCoeficientes);
router.put("/coeficientes/:id", verifyToken, verifyRole("admin"), ActualizarCoeficiente);

// Ciudades de Venezuela
router.get("/ciudades", verifyToken, ListarCiudades);
router.get("/ciudades/consultar", verifyToken, ConsultarCiudad);
router.post("/ciudades/sync", verifyToken, verifyRole("admin"), SyncCiudadesFromAPI);

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
