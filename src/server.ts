import { createServer } from "node:http";

import { createRequestHandler } from "./app.js";
import { loadConfig } from "./config.js";
import { createNoteRepository } from "./note-repository.js";

const config = loadConfig();
const repository = createNoteRepository(config.mysql);
const server = createServer(createRequestHandler(repository, { sessionSecret: config.sessionSecret }));

server.listen(config.port, config.host, () => {
  console.info(`stu-note listening on ${config.host}:${config.port}`);
});

let stopping = false;
async function stop(signal: string) {
  if (stopping) return;
  stopping = true;
  console.info(`Received ${signal}; shutting down.`);
  server.closeIdleConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await repository.close();
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    void stop(signal).then(() => process.exit(0), (error: unknown) => {
      console.error(error);
      process.exit(1);
    });
  });
}
