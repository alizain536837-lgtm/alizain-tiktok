import { createServer } from "node:http";
import { app } from "./app";
import { initSocket } from "./lib/socket";
import { prisma } from "./lib/prisma";

// Local dev entrypoint only. The Netlify Function imports `app` from
// src/app.ts and must NOT use this file (it would try to listen).
const PORT = Number(process.env.PORT || 4000);

async function main() {
  const server = createServer(app);
  initSocket(server);
  await prisma.$connect();
  server.listen(PORT, () => {
    console.log(`ALIZAIN TIKTOK backend listening on port ${PORT}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
