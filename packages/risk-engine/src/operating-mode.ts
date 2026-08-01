import type { AutoApprovalRule, OperatingMode } from "./auto-approval.js";
import { DEFAULT_AUTO_APPROVAL_RULES } from "./auto-approval.js";

/**
 * In-memory Operating Mode state.
 *
 * The operating mode and auto-approval rules are held in memory.
 * Persistence to DB is handled by the API layer (apps/api/src/routes/operating-mode.ts).
 */

const DEFAULT_MODE: OperatingMode = "PAPER";

let _mode: OperatingMode = DEFAULT_MODE;
let _rules: AutoApprovalRule[] = DEFAULT_AUTO_APPROVAL_RULES;

/** Set the operating mode (called on startup and on change) */
export function initOperatingMode(mode: OperatingMode, rules?: AutoApprovalRule[]): void {
  _mode = mode;
  if (rules) _rules = rules;
}

/** Get current operating mode */
export function getOperatingMode(): OperatingMode {
  return _mode;
}

/** Get current auto-approval rules */
export function getAutoApprovalRules(): AutoApprovalRule[] {
  return _rules;
}

/** Set operating mode */
export function setOperatingMode(mode: OperatingMode): void {
  _mode = mode;
}

/** Set auto-approval rules */
export function setAutoApprovalRules(rules: AutoApprovalRule[]): void {
  _rules = rules;
}
