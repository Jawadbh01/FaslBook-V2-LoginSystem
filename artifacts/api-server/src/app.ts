import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// Redirect root to the Next.js frontend (port 5000 / webview)
app.get("/", (req, res) => {
  const devDomain = process.env["REPLIT_DEV_DOMAIN"];
  if (devDomain) {
    res.redirect(302, `https://${devDomain}:5000`);
  } else {
    const host = (req.headers.host ?? "localhost").split(":")[0];
    res.redirect(302, `http://${host}:5000`);
  }
});

export default app;
