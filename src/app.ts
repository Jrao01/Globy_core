import "dotenv/config";
import { validateEnv } from "./config/env.js";
validateEnv();

import express, { type Application} from "express";
import indexroutes from "./routes/indexroutes.js";
import clienteroutes from "./routes/clienteRoutes.js";
import personalroutes from "./routes/personalRoutes.js";
import productosroutes from "./routes/productoRoutes.js";
import sucursalroutes from "./routes/sucursalRoutes.js";
import configroutes from "./routes/ConfigRoutes.js";
import pedidosroutes from "./routes/pedidoRoutes.js";
import categoriasroutes from "./routes/categoriaRoutes.js";
import competitorroutes from "./routes/competitorRoutes.js";
import gestionEconomicaRoutes from "./routes/gestionEconomicaRoutes.js";
import bcvRoutes from "./routes/bcvRoutes.js";
import tiendaRoutes from "./routes/tiendaRoutes.js";
import analisisRoutes from "./routes/analisisRoutes.js";
import ofertaRoutes from "./routes/ofertaRoutes.js";
import conexionRoutes from "./routes/conexionRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";
import { startBcvCron } from "./utils/BcvCron.js";
import { geoMiddleware } from "./middleware/geoMiddleware.js";
import { auditoriaMiddleware } from "./middleware/auditoriaMiddleware.js";
import { globalLimiter } from "./middleware/rateLimit.js";
import path from "path";
import cors from "cors";

const app: Application = express();

const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((o) => o.trim())
  : ["http://localhost:8080"];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("No permitido por CORS"));
    }
  },
  credentials: true,
}));
app.use(express.json());
app.use(globalLimiter);
// Servir archivos estáticos
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));
app.use("/documents", express.static(path.join(process.cwd(), "documents")));

// Middleware global: geolocalización + auditoría
app.use(geoMiddleware);
app.use(auditoriaMiddleware);

app.use("/", indexroutes);
app.use("/clientes", clienteroutes);
app.use("/personal", personalroutes);
app.use("/productos", productosroutes);
app.use("/sucursales", sucursalroutes);
app.use("/config", configroutes);
app.use("/compras", pedidosroutes);
app.use("/categorias", categoriasroutes);
app.use("/competitors", competitorroutes);
app.use("/gestion-economica", gestionEconomicaRoutes);
app.use("/bcv", bcvRoutes);
app.use("/tienda", tiendaRoutes);
app.use("/analisis", analisisRoutes);
app.use("/ofertas", ofertaRoutes);
app.use("/conexion", conexionRoutes);
app.use("/chat", chatRoutes);

startBcvCron();

app.listen(3000, () => {
    console.log("Server is running on port 3000");
});
