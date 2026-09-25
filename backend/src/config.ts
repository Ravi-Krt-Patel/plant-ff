import { z } from "zod";
export const configSchema = z.object({
  host: z.string().default("127.0.0.1"),
  port: z.coerce.number().int().min(0).max(65535).default(4000),
  mode: z.literal("demo").default("demo"),
  storage: z.literal("memory").default("memory"),
  origins: z
    .array(z.url())
    .min(1)
    .default(["http://localhost:3000", "http://localhost:3001"]),
  secureCookies: z.boolean().default(false),
  operationsToken: z.string().min(32).optional(),
  sessionTtlMs: z
    .number()
    .positive()
    .default(8 * 60 * 60 * 1000),
  quoteTtlMs: z
    .number()
    .positive()
    .default(10 * 60 * 1000),
  reservationTtlMs: z
    .number()
    .positive()
    .default(15 * 60 * 1000),
});
export type Config = z.infer<typeof configSchema>;
export function readConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return configSchema.parse({
    host: env.BACKEND_HOST,
    port: env.BACKEND_PORT,
    mode: env.BACKEND_MODE,
    storage: env.BACKEND_STORAGE,
    origins: env.BACKEND_ALLOWED_ORIGINS?.split(",").map((s) => s.trim()),
    secureCookies:
      env.BACKEND_SECURE_COOKIES === undefined
        ? false
        : z.enum(["true", "false"]).parse(env.BACKEND_SECURE_COOKIES) ===
          "true",
    operationsToken: env.BACKEND_OPERATIONS_TOKEN,
  });
}
