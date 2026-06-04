import "dotenv/config";
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
import { startBcvCron } from "./utils/BcvCron.js";
import { geoMiddleware } from "./middleware/geoMiddleware.js";
import { auditoriaMiddleware } from "./middleware/auditoriaMiddleware.js";
import path from "path";
import cors from "cors";

const app: Application = express();

app.use(cors());
app.use(express.json());
// Servir archivos estáticos
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

// Middleware global: geolocalización + auditoría
app.use(geoMiddleware);
app.use(auditoriaMiddleware);

app.use("/", indexroutes);
app.use("/clientes", clienteroutes);
app.use("/personal", personalroutes);
app.use("/productos", productosroutes);
app.use("/sucursales", sucursalroutes);
app.use("/config", configroutes);
app.use("/pedidos", pedidosroutes);
app.use("/categorias", categoriasroutes);
app.use("/competitors", competitorroutes);
app.use("/gestion-economica", gestionEconomicaRoutes);
app.use("/bcv", bcvRoutes);
app.use("/tienda", tiendaRoutes);

startBcvCron();

app.listen(3000, () => {
    console.log("Server is running on port 3000");
});