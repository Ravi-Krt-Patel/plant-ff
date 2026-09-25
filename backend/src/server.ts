import { createApp } from "./app";
import { readConfig } from "./config";
async function main() {
  const config = readConfig();
  const app = await createApp({ config, logger: true });
  for (const signal of ["SIGINT", "SIGTERM"] as const)
    process.once(signal, () => {
      void app.close().then(() => process.exit(0));
    });
  await app.listen({ port: config.port, host: config.host });
  app.log.info(
    { mode: config.mode, storage: config.storage },
    "Demo backend ready. Data resets on restart; no real payments or identity verification.",
  );
}
main().catch(() => {
  console.error(
    "Backend startup failed. Verify demo/memory configuration, environment values, and port availability.",
  );
  process.exitCode = 1;
});
