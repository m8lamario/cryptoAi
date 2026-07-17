import { Client } from "pg";
import { logger } from "../logger.js";

export async function checkPostgres(): Promise<boolean> {
  const url = process.env["DATABASE_URL"];
  if (!url) {
    return false;
  }

  let client: Client | undefined;

  try {
    client = new Client({ connectionString: url });
    await client.connect();
    await client.query("SELECT 1");
    return true;
  } catch {
    logger.warn({ dependency: "postgres" }, "Readiness check failed");
    return false;
  } finally {
    if (client) {
      try {
        await client.end();
      } catch {
        logger.debug({ dependency: "postgres" }, "Readiness connection cleanup failed");
      }
    }
  }
}
