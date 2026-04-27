#!/usr/bin/env npx ts-node
/**
 * ma-watchdog.ts
 * Master Affiliate Architect — Marketing Watchdog State Machine
 *
 * Usage:
 *   npx ts-node scripts/ma-watchdog.ts init --task "describe marketing task"
 *   npx ts-node scripts/ma-watchdog.ts strike --hypothesis "text" --error "text"
 *   npx ts-node scripts/ma-watchdog.ts status
 *   npx ts-node scripts/ma-watchdog.ts research --fix "text" --source "url"
 *   npx ts-node scripts/ma-watchdog.ts success --summary "text"
 *   npx ts-node scripts/ma-watchdog.ts wall --reason "text"
 *   npx ts-node scripts/ma-watchdog.ts heartbeat
 */

import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Phase =
  | "CONTEXT"
  | "THINK"
  | "STRIKE_1"
  | "STRIKE_2"
  | "STRIKE_3"
  | "RESEARCH"
  | "VALIDATION"
  | "DONE"
  | "HARD_WALL";

interface Attempt {
  strike: number;
  fingerprintHash: string;
  hypothesis: string;
  error: string;
  timestamp: string;
}

interface MAWatchdogState {
  taskId: string;
  problemStatement: string;
  funnelPhase: string;      // e.g. "Phase 5 - Hyper-Buyer", "Value Ladder - SLO"
  trafficTemp: string;      // Hot | Warm | Cold
  platform: string;         // Pinterest | Telegram | Reddit | dev.to | Hashnode | email | funnel
  phase: Phase;
  strikeCount: number;
  hypothesesLog: string[];
  attempts: Attempt[];
  verifiedFixes: string[];
  lastError: string | null;
  confidenceScore: number;
  lastActionTimestamp: string;
  isHardWall: boolean;
  auditLogEntries: string[];
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const ROOT = path.resolve(__dirname, "..");
const STATE_FILE = path.join(ROOT, "tmp", "ma-watchdog-state.json");
const STALL_THRESHOLD_MS = 30_000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function loadState(): MAWatchdogState | null {
  if (!fs.existsSync(STATE_FILE)) return null;
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, "utf8")) as MAWatchdogState;
  } catch {
    return null;
  }
}

function saveState(state: MAWatchdogState): void {
  const dir = path.dirname(STATE_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  state.updatedAt = new Date().toISOString();
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), "utf8");
}

function fingerprint(data: string): string {
  return crypto.createHash("sha256").update(data).digest("hex").slice(0, 12);
}

function now(): string {
  return new Date().toISOString();
}

function log(msg: string): void {
  console.log(`[ma-watchdog] ${now()} ${msg}`);
}

function auditLocal(entry: string, state: MAWatchdogState): void {
  const auditPath = path.join(ROOT, "tmp", "ma-audit.log");
  const line = `${now()} ${entry}\n`;
  try { fs.appendFileSync(auditPath, line, "utf8"); } catch { /* non-fatal */ }
  state.auditLogEntries.push(line.trim());
}

// ---------------------------------------------------------------------------
// Phase transitions
// ---------------------------------------------------------------------------

const PHASE_ORDER: Phase[] = [
  "CONTEXT", "THINK", "STRIKE_1", "STRIKE_2", "STRIKE_3",
  "RESEARCH", "VALIDATION", "DONE",
];

function nextPhase(current: Phase): Phase {
  const idx = PHASE_ORDER.indexOf(current);
  if (idx === -1 || idx >= PHASE_ORDER.length - 1) return current;
  return PHASE_ORDER[idx + 1];
}

// ---------------------------------------------------------------------------
// Watchdog checks
// ---------------------------------------------------------------------------

function runWatchdogChecks(state: MAWatchdogState): void {
  const elapsed = Date.now() - new Date(state.lastActionTimestamp).getTime();
  if (elapsed > STALL_THRESHOLD_MS) {
    log(`ALERT: No action for ${Math.round(elapsed / 1000)}s — possible stall. Force a concrete action now.`);
  }
  if (state.confidenceScore < 90 && !["RESEARCH", "HARD_WALL", "DONE"].includes(state.phase)) {
    log(`ALERT: Confidence ${state.confidenceScore}% < 90% — entering RESEARCH mode early.`);
  }
  if (state.strikeCount >= 3 && !["RESEARCH", "HARD_WALL", "DONE"].includes(state.phase)) {
    log("ALERT: 3 strikes exhausted — RESEARCH mode required immediately.");
  }
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

function cmdInit(args: Record<string, string>): void {
  const task = args["task"] || "Unspecified marketing task";
  const funnelPhase = args["funnel"] || "unknown";
  const trafficTemp = args["temp"] || "unknown";
  const platform = args["platform"] || "unknown";

  const state: MAWatchdogState = {
    taskId: crypto.randomUUID(),
    problemStatement: task,
    funnelPhase,
    trafficTemp,
    platform,
    phase: "CONTEXT",
    strikeCount: 0,
    hypothesesLog: [],
    attempts: [],
    verifiedFixes: [],
    lastError: null,
    confidenceScore: 100,
    lastActionTimestamp: now(),
    isHardWall: false,
    auditLogEntries: [],
    createdAt: now(),
    updatedAt: now(),
  };

  saveState(state);
  auditLocal(`INIT task="${task}" funnel="${funnelPhase}" platform="${platform}" id=${state.taskId}`, state);
  saveState(state);

  log(`Initialized. Task ID: ${state.taskId}`);
  log(`Phase: ${state.phase} | Strikes: 0/3 | Platform: ${platform} | Traffic: ${trafficTemp}`);
}

function cmdHeartbeat(): void {
  const state = loadState();
  if (!state) { log("ERROR: No active task. Run: init --task '...'"); process.exit(1); }
  state.lastActionTimestamp = now();
  runWatchdogChecks(state);
  saveState(state);
  log(`Heartbeat recorded. Phase: ${state.phase} | Strikes: ${state.strikeCount}/3 | Confidence: ${state.confidenceScore}%`);
}

function cmdStrike(args: Record<string, string>): void {
  const state = loadState();
  if (!state) { log("ERROR: No active task. Run: init --task '...'"); process.exit(1); }

  const hypothesis = args["hypothesis"] || "No hypothesis provided";
  const error = args["error"] || "No error text provided";
  const fp = fingerprint(hypothesis + error + state.strikeCount);

  // Duplicate fingerprint guard
  const duplicate = state.attempts.find((a) => a.fingerprintHash === fp);
  if (duplicate) {
    log(`WATCHDOG BLOCK: Duplicate fingerprint ${fp} detected. You must mutate strategy before retrying.`);
    process.exit(1);
  }

  state.strikeCount += 1;
  state.hypothesesLog.push(hypothesis);
  state.lastError = error;
  state.lastActionTimestamp = now();
  state.confidenceScore = Math.max(0, state.confidenceScore - 15);

  const attempt: Attempt = {
    strike: state.strikeCount,
    fingerprintHash: fp,
    hypothesis,
    error,
    timestamp: now(),
  };
  state.attempts.push(attempt);

  if (state.strikeCount >= 3) {
    state.phase = "RESEARCH";
    log(`Strike ${state.strikeCount}/3 recorded. RESEARCH MODE ACTIVATED.`);
    log(`Fingerprint: ${fp}`);
    log(`You must now research before any further attempts.`);
  } else {
    state.phase = nextPhase(state.phase) as Phase;
    log(`Strike ${state.strikeCount}/3 recorded. Phase → ${state.phase}`);
    log(`Fingerprint: ${fp} (next attempt must differ)`);
  }

  auditLocal(`STRIKE_${state.strikeCount} fp=${fp} error="${error.slice(0, 80)}"`, state);
  runWatchdogChecks(state);
  saveState(state);
}

function cmdResearch(args: Record<string, string>): void {
  const state = loadState();
  if (!state) { log("ERROR: No active task."); process.exit(1); }

  const fix = args["fix"] || "No fix described";
  const source = args["source"] || "No source";

  state.verifiedFixes.push(`${fix} [source: ${source}]`);
  state.strikeCount = 0;
  state.confidenceScore = Math.min(100, state.confidenceScore + 20);
  state.phase = "CONTEXT";
  state.lastActionTimestamp = now();

  auditLocal(`RESEARCH fix="${fix.slice(0, 80)}" source="${source}"`, state);
  saveState(state);

  log(`Research finding recorded. Strike counter RESET. Phase → CONTEXT (clean retry).`);
  log(`Fix: ${fix}`);
  log(`Source: ${source}`);
}

function cmdStatus(): void {
  const state = loadState();
  if (!state) { log("No active task found."); return; }

  runWatchdogChecks(state);

  const elapsed = Math.round((Date.now() - new Date(state.lastActionTimestamp).getTime()) / 1000);
  console.log(`
MA Watchdog Status
──────────────────────────────────────────
Task ID:       ${state.taskId}
Task:          ${state.problemStatement}
Funnel Phase:  ${state.funnelPhase}
Traffic Temp:  ${state.trafficTemp}
Platform:      ${state.platform}
Phase:         ${state.phase}
Strikes:       ${state.strikeCount}/3
Confidence:    ${state.confidenceScore}%
Last action:   ${elapsed}s ago
Hard Wall:     ${state.isHardWall}
Verified Fixes: ${state.verifiedFixes.length}
Attempts:      ${state.attempts.length}
──────────────────────────────────────────`);
}

function cmdSuccess(args: Record<string, string>): void {
  const state = loadState();
  if (!state) { log("ERROR: No active task."); process.exit(1); }

  const summary = args["summary"] || "Task completed";
  state.phase = "DONE";
  state.lastActionTimestamp = now();

  auditLocal(`SUCCESS summary="${summary.slice(0, 120)}"`, state);
  saveState(state);

  log(`SUCCESS. Phase → DONE`);
  log(`Summary: ${summary}`);
  log(`Update qa_knowledge_base.json with this finding.`);
}

function cmdWall(args: Record<string, string>): void {
  const state = loadState();
  if (!state) { log("ERROR: No active task."); process.exit(1); }

  const reason = args["reason"] || "Unspecified block";
  state.isHardWall = true;
  state.phase = "HARD_WALL";
  state.lastActionTimestamp = now();

  auditLocal(`HARD_WALL reason="${reason}"`, state);
  saveState(state);

  log(`HARD WALL reached. Phase → HARD_WALL`);
  log(`Reason: ${reason}`);
  log(`Human intervention required. Do not retry.`);

  console.log(`
## MA HARD WALL — HUMAN REQUIRED

Task:     ${state.problemStatement}
Platform: ${state.platform}
Block:    ${reason}
Required: Provide missing credential / resolve MFA / unban account
Resume:   /ma <describe task to resume>
`);
}

// ---------------------------------------------------------------------------
// CLI dispatch
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const command = args[0];
const parsedArgs: Record<string, string> = {};
for (let i = 1; i < args.length; i += 2) {
  if (args[i]?.startsWith("--")) {
    parsedArgs[args[i].slice(2)] = args[i + 1] ?? "";
  }
}

switch (command) {
  case "init":      cmdInit(parsedArgs); break;
  case "heartbeat": cmdHeartbeat(); break;
  case "strike":    cmdStrike(parsedArgs); break;
  case "research":  cmdResearch(parsedArgs); break;
  case "status":    cmdStatus(); break;
  case "success":   cmdSuccess(parsedArgs); break;
  case "wall":      cmdWall(parsedArgs); break;
  default:
    console.log(`Usage: npx ts-node scripts/ma-watchdog.ts <init|heartbeat|strike|research|status|success|wall> [--key value ...]`);
    process.exit(1);
}
