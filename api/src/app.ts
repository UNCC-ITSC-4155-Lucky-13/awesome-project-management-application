import express from "express";
import swaggerUi from "swagger-ui-express";

const openApiDocument = {
  openapi: "3.0.3",
  info: {
    title: "Awesome Project Management API",
    version: "1.0.0",
  },
  servers: [{ url: "http://localhost:4000" }],
  paths: {
    "/health": {
      get: {
        responses: {
          "200": {
            description: "API is available.",
          },
        },
      },
    },
  },
};

export const app = express();

app.use(express.json());
app.use("/docs", swaggerUi.serve, swaggerUi.setup(openApiDocument));
app.get("/openapi.json", (_request, response) => {
  response.json(openApiDocument);
});
app.get("/health", (_request, response) => {
  response.status(200).json({ status: "ok" });
});
