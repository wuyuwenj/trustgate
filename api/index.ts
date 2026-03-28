import type { IncomingMessage, ServerResponse } from "node:http";
import { buildApp } from "../src/app.js";

const app = buildApp();
const appReady = app.ready();

export default async function handler(
  request: IncomingMessage,
  response: ServerResponse
) {
  try {
    await appReady;
    app.server.emit("request", request, response);
  } catch (error) {
    app.log.error({ error }, "Failed to initialize serverless app");

    if (!response.headersSent) {
      response.statusCode = 500;
      response.setHeader("content-type", "application/json");
    }

    response.end(JSON.stringify({ error: "Failed to initialize server" }));
  }
}
