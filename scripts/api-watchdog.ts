#!/usr/bin/env npx ts-node
/**
 * api-watchdog.ts
 * 3SR Protocol — Action Watchdog State Machine
 *
 * Usage:
 *   npx ts-node scripts/api-watchdog.ts init --task "describe task" [--target "api name"]
 *   npx ts-node scripts/api-watchdog.ts strike --hypothesis "text" --error "text"
 *   npx ts-node scripts/api-watchdog.ts status
 *   npx ts-node scripts/api-watchdog.ts research --fix "text" --source "url"
 *   npx ts-node scripts/api-watchdog.ts success --summary "text"
 *   npx ts-node scripts/api-watchdog.ts wall --reason "text"
 *   npx ts-node scripts/api-watchdog.ts heartbeat   (call every action to reset stall timer)
 */

import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Phase =
  | "CONTEXT"
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

interface WatchdogState {
  taskId: string;
  problemStatement: string;
  targetApi: string;
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
const STATE_FILE = path.join(ROOT, "tmp", "api-watchdog-state.json");
const STALL_THRESHOLD_MS = 30_000; // 30 seconds

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function loadState(): WatchdogState | null {
  if (!fs.existsSync(STATE_FILE)) return null;
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, "utf8")) as WatchdogState;
  } catch {
    return null;
  }
}

function saveState(state: WatchdogState): void {
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
  const line = `[api-watchdog] ${now()} ${msg}`;
  console.log(line);
}

function auditContabo(entry: string, state: WatchdogState): void {
  // Best-effort: append to local audit log; Contabo SSH audit is agent responsibility
  const auditPath = path.join(ROOT, "tmp", "api-audit.log");
  const line = `${now()} ${entry}\n`;
  try {
    fs.appendFileSync(auditPath, line, "utf8");
  } catch {
    // non-fatal
  }
  state.auditLogEntries.push(line.trim());
}

// ---------------------------------------------------------------------------
// Phase transition matrix
// ---------------------------------------------------------------------------

const PHASE_ORDER: Phase[] = [
  "CONTEXT",
  "STRIKE_1",
  "STRIKE_2",
  "STRIKE_3",
  "RESEARCH",
  "VALIDATION",
  "DONE",
];

function nextPhase(current: Phase): Phase {
  const idx = PHASE_ORDER.indexOf(current);
  if (idx === -1 || idx >= PHASE_ORDER.length - 1) return current;
  return PHASE_ORDER[idx + 1];
}

// ---------------------------------------------------------------------------
// Watchdog checks
// ---------------------------------------------------------------------------

function runWatchdogChecks(state: WatchdogState): void {
  // Stall detection
  const elapsed = Date.now() - new Date(state.lastActionTimestamp).getTime();
  if (elapsed > STALL_THRESHOLD_MS) {
    log(
      `WATCHDOG ALERT: No action for ${Math.round(elapsed / 1000)}s — possible stall. Force a concrete action now.`
    );
  }

  // Confidence guard
  if (state.confidenceScore < 90 && state.phase !== "RESEARCH" && state.phase !== "HARD_WALL") {
    log(
      `WATCHDOG ALERT: Confidence ${state.confidenceScore}% < 90% — entering RESEARCH mode early.`
    );
  }

  // Strike limit
  if (state.strikeCount >= 3 && state.phase !== "RESEARCH" && state.phase !== "HARD_WALL" && state.phase !== "DONE") {
    log("WATCHDOG ALERT: 3 strikes exhausted — RESEARCH mode required immediately.");
  }
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

function cmdInit(args: Record<string, string>): void {
  const task = args["task"] || "Unspecified API integration task";
  const target = args["target"] || "unknown";

  const state: WatchdogState = {
    taskId: crypto.randomUUID(),
    problemStatement: task,
    targetApi: target,
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
  auditContabo(`INIT task="${task}" target="${target}" id=${state.taskId}`, state);
  saveState(state);

  log(`Initialized. Task ID: ${state.taskId}`);
  log(`Phase: ${state.phase} | Strikes: ${state.strikeCount}/3`);
}

function cmdStrike(args: Record<string, string>): void {
  const state = loadState();
  if (!state) { log("ERROR: No active task. Run: init --task '...'"); process.exit(1); }

  const hypothesis = args["hypothesis"] || "No hypothesis provided";
  const error = args["error"] || "No error text provided";
  const fp = fingerprint(hypothesis + error + state.strikeCount);

  // Duplicate fingerprint check
  const existing = state.attempts.find((a) => a.fingerprintHash === fp);
  if (existing) {
    log(`WATCHDOG BLOCK: Duplicate fingerprint ${fp} — this is not a strategy mutation. Change your approach.`);
    process.exit(1);
  }

  state.strikeCount += 1;
  state.lastError = error;
  state.hypothesesLog.push(hypothesis);
  state.lastActionTimestamp = now();

  const attempt: Attempt = {
    strike: state.strikeCount,
    fingerprintHash: fp,
    hypothesis,
    error,
    timestamp: now(),
  };
  state.attempts.push(attempt);

  // Advance phase
  if (state.strikeCount === 1) state.phase = "STRIKE_1";
  else if (state.strikeCount === 2) state.phase = "STRIKE_2";
  else if (state.strikeCount >= 3) {
    state.phase = "RESEARCH";
    log("Strike 3 reached — transitioning to RESEARCH mode.");
  }

  auditContabo(`STRIKE ${state.strikeCount} fp=${fp} hypothesis="${hypothesis}"`, state);
  saveState(state);

  log(`Strike ${state.strikeCount}/3 recorded. Phase: ${state.phase}`);
  log(`Fingerprint: ${fp}`);
  runWatchdogChecks(state);
}

function cmdResearch(args: Record<string, string>): void {
  const state = loadState();
  if (!state) { log("ERROR: No active task."); process.exit(1); }

  const fix = args["fix"] || "No fix described";
  const source = args["source"] || "unknown source";

  state.verifiedFixes.push(`[${source}] ${fix}`);
  state.phase = "RESEARCH";
  state.lastActionTimestamp = now();

  // Reset strike counter when a verified fix is found
  if (state.strikeCount >= 3) {
    state.strikeCount = 0;
    log("Strike counter reset — applying verified fix in a clean attempt.");
  }

  auditContabo(`RESEARCH_FIX source="${source}" fix="${fix}"`, state);
  saveState(state);

  log(`Research finding recorded. Verified fixes: ${state.verifiedFixes.length}`);
  log(`Phase: ${state.phase} | Strikes reset to: ${state.strikeCount}/3`);
}

function cmdStatus(): void {
  const state = loadState();
  if (!state) { log("No active task. Run: init --task '...'"); return; }

  runWatchdogChecks(state);

  const elapsed = Math.round(
    (Date.now() - new Date(state.lastActionTimestamp).getTime()) / 1000
  );

  console.log(`
╔══════════════════════════════════════════════════════════╗
║              API AGENT — 3SR WATCHDOG STATUS             ║
╠══════════════════════════════════════════════════════════╣
  Task ID    : ${state.taskId}
  Task       : ${state.problemStatement}
  Target API : ${state.targetApi}
  Phase      : ${state.phase}
  Strikes    : ${state.strikeCount}/3
  Confidence : ${state.confidenceScore}%
  Last Action: ${elapsed}s ago
  Hard Wall  : ${state.isHardWall}
  Fixes Found: ${state.verifiedFixes.length}
  Last Error : ${state.lastError?.slice(0, 80) ?? "none"}
╚══════════════════════════════════════════════════════════╝
`);
}

function cmdSuccess(args: Record<string, string>): void {
  const state = loadState();
  if (!state) { log("ERROR: No active task."); process.exit(1); }

  const summary = args["summary"] || "Task completed";
  state.phase = "DONE";
  state.lastActionTimestamp = now();

  auditContabo(`SUCCESS summary="${summary}"`, state);
  saveState(state);

  log(`Task DONE. ${summary}`);
  log(`State preserved at: ${STATE_FILE}`);
}

function cmdWall(args: Record<string, string>): void {
  const state = loadState();
  if (!state) { log("ERROR: No active task."); process.exit(1); }

  const reason = args["reason"] || "Unspecified hard wall";
  state.phase = "HARD_WALL";
  state.isHardWall = true;
  state.lastActionTimestamp = now();

  auditContabo(`HARD_WALL reason="${reason}"`, state);
  saveState(state);

  console.log(`
╔══════════════════════════════════════════════════════════╗
║              HARD WALL — HUMAN INTERVENTION REQUIRED     ║
╠══════════════════════════════════════════════════════════╣
  Task   : ${state.problemStatement}
  Phase  : ${state.phase}
  Reason : ${reason}
  Last Error: ${state.lastError?.slice(0, 120) ?? "none"}
  
  Required: Human must resolve "${reason}" before the agent
            can proceed.
            
  Resume via: /api --resume ${state.taskId}
╚══════════════════════════════════════════════════════════╝
`);
}

function cmdHeartbeat(): void {
  const state = loadState();
  if (!state) return;
  state.lastActionTimestamp = now();
  saveState(state);
  log(`Heartbeat. Phase: ${state.phase} | Strikes: ${state.strikeCount}/3 | Confidence: ${state.confidenceScore}%`);
}

// ---------------------------------------------------------------------------
// Argument parser
// ---------------------------------------------------------------------------

function parseArgs(argv: string[]): { command: string; flags: Record<string, string> } {
  const [, , command = "status", ...rest] = argv;
  const flags: Record<string, string> = {};
  for (let i = 0; i < rest.length; i++) {
    if (rest[i].startsWith("--") && rest[i + 1] && !rest[i + 1].startsWith("--")) {
      flags[rest[i].slice(2)] = rest[i + 1];
      i++;
    }
  }
  return { command, flags };
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

const { command, flags } = parseArgs(process.argv);

switch (command) {
  case "init":      cmdInit(flags); break;
  case "strike":    cmdStrike(flags); break;
  case "research":  cmdResearch(flags); break;
  case "status":    cmdStatus(); break;
  case "success":   cmdSuccess(flags); break;
  case "wall":      cmdWall(flags); break;
  case "heartbeat": cmdHeartbeat(); break;
  default:
    console.log(`Unknown command: ${command}`);
    console.log("Commands: init | strike | research | status | success | wall | heartbeat");
    process.exit(1);
}
