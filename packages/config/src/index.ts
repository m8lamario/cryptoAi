import { z } from "zod";

const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url("DATABASE_URL must be a valid URL"),
  REDIS_URL: z.string().url("REDIS_URL must be a valid URL"),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  OWNER_USERNAME: z.string().min(1, "OWNER_USERNAME is required"),
});

export type ServerConfig = z.infer<typeof serverEnvSchema>;

let _serverConfig: ServerConfig | undefined;

export function getServerConfig(): ServerConfig {
  if (!_serverConfig) {
    const result = serverEnvSchema.safeParse(process.env);
    if (!result.success) {
      throw new Error(
        `Invalid server configuration:\n${result.error.issues
          .map((issue) => `  ${issue.path.join(".")}: ${issue.message}`)
          .join("\n")}`
      );
    }
    _serverConfig = result.data;
  }

  return _serverConfig;
}

const authEnvSchema = z.object({
  APP_ORIGIN: z
    .string()
    .refine(
      (val) =>
        val.split(",").every((o) =>
          z.string().url().safeParse(o.trim()).success
        ),
      { message: "APP_ORIGIN must be a valid URL or comma-separated list of valid URLs" }
    )
    .default("http://localhost:3001"),
  API_BASE_URL: z.string().url().default("http://localhost:4000"),
  SESSION_TTL_SECONDS: z.coerce.number().int().positive().default(86400),
  SESSION_COOKIE_SECURE: z.enum(["true", "false", "1", "0"]).optional(),
  LOGIN_RATE_LIMIT_MAX_ATTEMPTS: z.coerce.number().int().min(1).default(10),
  LOGIN_RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().min(1).default(900),
});

const telegramEnvSchema = z.object({
  TELEGRAM_BOT_TOKEN: z.string().trim().min(1).optional(),
  TELEGRAM_CHAT_ID: z.string().trim().min(1).optional(),
  TELEGRAM_DISABLE_NOTIFICATION: z.enum(["true", "false", "1", "0"]).optional(),
});

export interface TelegramConfig {
  botToken: string;
  chatId: string;
  disableNotification: boolean;
}

/** Returns Telegram configuration, or null when notifications are not configured. */
export function getTelegramConfig(): TelegramConfig | null {
  const result = telegramEnvSchema.safeParse(process.env);
  if (!result.success) {
    throw new Error(
      `Invalid Telegram configuration: ${result.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join(", ")}`,
    );
  }

  const { TELEGRAM_BOT_TOKEN: botToken, TELEGRAM_CHAT_ID: chatId } = result.data;
  if (!botToken && !chatId) return null;
  if (!botToken || !chatId) {
    throw new Error("TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID must be configured together");
  }

  return {
    botToken,
    chatId,
    disableNotification:
      result.data.TELEGRAM_DISABLE_NOTIFICATION === "true" ||
      result.data.TELEGRAM_DISABLE_NOTIFICATION === "1",
  };
}

export interface AuthConfig {
  appOrigin: string;
  apiBaseUrl: string;
  sessionTtlSeconds: number;
  sessionCookieSecure: boolean;
  loginRateLimitMaxAttempts: number;
  loginRateLimitWindowSeconds: number;
}

/** Returns auth-specific configuration from environment variables. All fields have defaults. */
export function getAuthConfig(): AuthConfig {
  const result = authEnvSchema.safeParse(process.env);
  if (!result.success) {
    throw new Error("Invalid auth configuration");
  }
  const d = result.data;
  return {
    appOrigin: d.APP_ORIGIN,
    apiBaseUrl: d.API_BASE_URL,
    sessionTtlSeconds: d.SESSION_TTL_SECONDS,
    sessionCookieSecure:
      process.env["NODE_ENV"] === "production" ||
      d.SESSION_COOKIE_SECURE === "true" ||
      d.SESSION_COOKIE_SECURE === "1",
    loginRateLimitMaxAttempts: d.LOGIN_RATE_LIMIT_MAX_ATTEMPTS,
    loginRateLimitWindowSeconds: d.LOGIN_RATE_LIMIT_WINDOW_SECONDS,
  };
}

export { getBrowserConfig } from "./browser.js";
export type { BrowserConfig } from "./browser.js";

export {
  ModelFamilySchema,
  ConsensusModeSchema,
  RoleModelConfigSchema,
  MultiModelConfigSchema,
  DEFAULT_MULTI_MODEL_CONFIG,
  getRoleConfig,
  validateModelDiversity,
} from "./multi-model.js";
export type {
  ModelFamily,
  ConsensusMode,
  RoleModelConfig,
  MultiModelConfig,
} from "./multi-model.js";

const aiConfigSchema = z.object({
  AI_DAILY_BUDGET_USD: z.coerce.number().min(0).default(1),
  AI_MONTHLY_BUDGET_USD: z.coerce.number().min(0).default(20),
  AI_DEFAULT_TIMEOUT_MS: z.coerce.number().int().min(1000).max(300000).default(60000),
  AI_DEFAULT_MAX_RETRIES: z.coerce.number().int().min(0).max(5).default(2),
  AI_DEFAULT_MAX_TOKENS: z.coerce.number().int().min(1).max(100000).default(1500),
});

export interface AICoreConfig {
  dailyBudgetUsd: number;
  monthlyBudgetUsd: number;
  defaultTimeoutMs: number;
  defaultMaxRetries: number;
  defaultMaxTokens: number;
}

/** Returns core AI configuration from environment variables. All fields have defaults. */
export function getAICoreConfig(): AICoreConfig {
  const result = aiConfigSchema.safeParse(process.env);
  if (!result.success) {
    throw new Error("Invalid AI configuration");
  }
  const d = result.data;
  return {
    dailyBudgetUsd: d.AI_DAILY_BUDGET_USD,
    monthlyBudgetUsd: d.AI_MONTHLY_BUDGET_USD,
    defaultTimeoutMs: d.AI_DEFAULT_TIMEOUT_MS,
    defaultMaxRetries: d.AI_DEFAULT_MAX_RETRIES,
    defaultMaxTokens: d.AI_DEFAULT_MAX_TOKENS,
  };
}
