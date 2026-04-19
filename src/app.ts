import "dotenv/config";
import express, { type Application} from "express";
import indexroutes from "./routes/indexroutes.js";

const app: Application = express();

app.use(express.json());

app.use("/", indexroutes);

app.listen(3000, () => {
    console.log("Server is running on port 3000");
});