import "dotenv/config";
import express, { type Application} from "express";
import indexroutes from "./routes/indexroutes.js";
import clienteroutes from "./routes/clienteRoutes.js";
import personalroutes from "./routes/personalRoutes.js";
import productosroutes from "./routes/productoRoutes.js";
import sucursalroutes from "./routes/sucursalRoutes.js";
import configroutes from "./routes/ConfigRoutes.js";
import pedidosroutes from "./routes/pedidoRoutes.js";
import path from "path";
import cors from "cors";

const app: Application = express();

app.use(cors());
app.use(express.json());
// Servir archivos estáticos
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

app.use("/", indexroutes);
app.use("/clientes", clienteroutes);
app.use("/personal", personalroutes);
app.use("/productos", productosroutes);
app.use("/sucursales", sucursalroutes);
app.use("/config", configroutes);
app.use("/pedidos", pedidosroutes);


app.listen(3000, () => {
    console.log("Server is running on port 3000");
});