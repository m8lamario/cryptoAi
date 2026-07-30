import { config as dotenvConfig } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
dotenvConfig({ path: resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", ".env") });
import { Queue } from "bullmq";
const q = new Queue("ai-orchestration", {
  connection: { url: process.env["REDIS_URL"] ?? "redis://localhost:6379" },
});
await q.add("manual-trigger", {});
const counts = await q.getJobCounts();
console.log("✅ AI cycle triggered — active:", counts.active, "waiting:", counts.waiting);
await q.close();
process.exit(0);
