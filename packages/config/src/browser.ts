import { z } from "zod";

const browserEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export type BrowserConfig = z.infer<typeof browserEnvSchema>;

let _browserConfig: BrowserConfig | undefined;

export function getBrowserConfig(): BrowserConfig {
  if (!_browserConfig) {
    const result = browserEnvSchema.safeParse({
      NODE_ENV: process.env["NODE_ENV"],
    });
    if (!result.success) {
      throw new Error("Invalid browser configuration");
    }
    _browserConfig = result.data;
  }

  return _browserConfig;
}
