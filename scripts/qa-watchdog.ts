#!/usr/bin/env npx ts-node
/**
 * qa-watchdog.ts
 * Affiliate Castle — QA Agent Watchdog State Machine
 *
 * Mirrors the 3SR api-watchdog but scoped to QA validation sessions.
 * Tracks test pass/fail, source-file correlations, stall detection,
 * hard walls, and auto-generates qa_knowledge_base.json entries.
 *
 * Usage:
 *   npx ts-node scripts/qa-watchdog.ts init --goal "what you are testing"
 *   npx ts-node scripts/qa-watchdog.ts heartbeat
 *   npx ts-node scripts/qa-watchdog.ts pass --test "sprint12 full suite"
 *   npx ts-node scripts/qa-watchdog.ts fail --test "name" --error "msg" --file "src/..."
 *   npx ts-node scripts/qa-watchdog.ts research --finding "text" --source "file or URL"
 *   npx ts-node scripts/qa-watchdog.ts status
 *   npx ts-node scripts/qa-watchdog.ts done --summary "green result or diagnosis"
 *   npx ts-node scripts/qa-watchdog.ts wall --reason "what blocked you"
 */

import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type QAPhase =
  | "THINK"
  | "ACT"
  | "CHECK"
  | "RESEARCH"
  | "DONE"
  | "HARD_WALL";

interface TestResult {
  name: string;
  status: "pass" | "fail";
  error?: string;
  sourceFile?: string;
  sourceLine?: number;
  timestamp: string;
}

interface QAWatchdogState {
  sessionId: string;
  goal: string;
  phase: QAPhase;
  // Test tracking
  passed: number;
  failed: number;
  testResults: TestResult[];
  // Failure correlation
  failedSourceFiles: string[];
  researchFindings: string[];
  // Watchdog
  lastActionTimestamp: string;
  consecutiveIdleCycles: number;
  isHardWall: boolean;
  wallReason: string | null;
  // Memory
  auditEntries: string[];
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const ROOT = path.resolve(__dirname, "..");
const STATE_FILE = path.join(ROOT, "tmp", "qa-watchdog-state.json");
const KB_FILE = path.join(ROOT, "qa_knowledge_base.json");
const AUDIT_LOG = path.join(ROOT, "tmp", "qa-audit.log");
const STALL_THRESHOLD_MS = 30_000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function loadState(): QAWatchdogState | null {
  if (!fs.existsSync(STATE_FILE)) return null;
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, "utf8")) as QAWatchdogState;
  } catch {
    return null;
  }
}

function saveState(state: QAWatchdogState): void {
  const dir = path.dirname(STATE_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  state.updatedAt = new Date().toISOString();
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), "utf8");
}

function now(): string {
  return new Date().toISOString();
}

function log(msg: string): void {
  console.log(`[qa-watchdog] ${now()} ${msg}`);
}

function auditLog(entry: string): void {
  const line = `${now()} ${entry}\n`;
  try {
    const dir = path.dirname(AUDIT_LOG);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(AUDIT_LOG, line, "utf8");
  } catch { /* non-fatal */ }
}

// ---------------------------------------------------------------------------
// Watchdog checks (called on every command)
// ---------------------------------------------------------------------------

function runWatchdogChecks(state: QAWatchdogState): void {
  const elapsed = Date.now() - new Date(state.lastActionTimestamp).getTime();

  if (elapsed > STALL_THRESHOLD_MS) {
    log(`WATCHDOG ALERT: No action for ${Math.round(elapsed / 1000)}s — possible stall. Execute a terminal command now.`);
  }

  if (state.consecutiveIdleCycles >= 3) {
    log("WATCHDOG ALERT: 3+ reasoning cycles with no actions — recursive loop detected. Force a concrete command.");
  }

  if (state.failed > 0 && state.phase === "ACT") {
    log(`WATCHDOG: ${state.failed} test(s) failing — transition to CHECK phase for diagnosis.`);
  }
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

function cmdInit(args: Record<string, string>): void {
  const goal = args["goal"] || "Unspecified QA goal";

  const state: QAWatchdogState = {
    sessionId: crypto.randomUUID(),
    goal,
    phase: "THINK",
    passed: 0,
    failed: 0,
    testResults: [],
    failedSourceFiles: [],
    researchFindings: [],
    lastActionTimestamp: now(),
    consecutiveIdleCycles: 0,
    isHardWall: false,
    wallReason: null,
    auditEntries: [],
    createdAt: now(),
    updatedAt: now(),
  };

  saveState(state);
  auditLog(`INIT session=${state.sessionId} goal="${goal}"`);

  log(`Session initialized. ID: ${state.sessionId}`);
  log(`Goal: ${goal}`);
  log(`Phase: THINK | Read castle.md and qa_knowledge_base.json before acting.`);
}

function cmdHeartbeat(): void {
  const state = loadState();
  if (!state) { log("No active session. Run: init --goal '...'"); return; }

  state.lastActionTimestamp = now();
  state.consecutiveIdleCycles = 0;
  saveState(state);

  runWatchdogChecks(state);
  log(`Heartbeat. Phase: ${state.phase} | Passed: ${state.passed} | Failed: ${state.failed}`);
}

function cmdPass(args: Record<string, string>): void {
  const state = loadState();
  if (!state) { log("ERROR: No active session."); process.exit(1); }

  const testName = args["test"] || "unnamed test";
  state.passed += 1;
  state.phase = "CHECK";
  state.lastActionTimestamp = now();
  state.consecutiveIdleCycles = 0;
  state.testResults.push({ name: testName, status: "pass", timestamp: now() });

  auditLog(`PASS test="${testName}" total_passed=${state.passed}`);
  saveState(state);

  log(`PASS: ${testName} | Total passed: ${state.passed}`);
  runWatchdogChecks(state);
}

function cmdFail(args: Record<string, string>): void {
  const state = loadState();
  if (!state) { log("ERROR: No active session."); process.exit(1); }

  const testName = args["test"] || "unnamed test";
  const error = args["error"] || "No error text";
  const sourceFile = args["file"] || undefined;
  const sourceLine = args["line"] ? parseInt(args["line"], 10) : undefined;

  state.failed += 1;
  state.phase = "CHECK";
  state.lastActionTimestamp = now();
  state.consecutiveIdleCycles = 0;

  const result: TestResult = { name: testName, status: "fail", error, sourceFile, sourceLine, timestamp: now() };
  state.testResults.push(result);

  if (sourceFile && !state.failedSourceFiles.includes(sourceFile)) {
    state.failedSourceFiles.push(sourceFile);
  }

  auditLog(`FAIL test="${testName}" error="${error.slice(0, 80)}" file="${sourceFile ?? 'unknown'}"`);
  saveState(state);

  log(`FAIL: ${testName}`);
  log(`  Error: ${error.slice(0, 120)}`);
  if (sourceFile) log(`  Source: ${sourceFile}${sourceLine ? `:${sourceLine}` : ""}`);
  log(`  Total failed: ${state.failed}`);
  runWatchdogChecks(state);
}

function cmdResearch(args: Record<string, string>): void {
  const state = loadState();
  if (!state) { log("ERROR: No active session."); process.exit(1); }

  const finding = args["finding"] || "No finding described";
  const source = args["source"] || "unknown";

  state.researchFindings.push(`[${source}] ${finding}`);
  state.phase = "RESEARCH";
  state.lastActionTimestamp = now();
  state.consecutiveIdleCycles = 0;

  auditLog(`RESEARCH finding="${finding.slice(0, 80)}" source="${source}"`);
  saveState(state);

  log(`Research finding recorded (${state.researchFindings.length} total).`);
  log(`Finding: ${finding}`);
}

function cmdStatus(): void {
  const state = loadState();
  if (!state) { log("No active session. Run: init --goal '...'"); return; }

  runWatchdogChecks(state);

  const elapsed = Math.round(
    (Date.now() - new Date(state.lastActionTimestamp).getTime()) / 1000
  );

  const failedTests = state.testResults.filter((t) => t.status === "fail");

  console.log(`
╔══════════════════════════════════════════════════════════╗
║           AFFILIATE CASTLE — QA WATCHDOG STATUS          ║
╠══════════════════════════════════════════════════════════╣
  Session ID : ${state.sessionId}
  Goal       : ${state.goal}
  Phase      : ${state.phase}
  Passed     : ${state.passed}
  Failed     : ${state.failed}
  Last Action: ${elapsed}s ago
  Hard Wall  : ${state.isHardWall}
  Findings   : ${state.researchFindings.length}
${failedTests.length > 0 ? `
  Failed Tests:
${failedTests.map((t) => `    ✗ ${t.name}\n      ${t.error?.slice(0, 80) ?? ""}\n      ${t.sourceFile ?? ""}`).join("\n")}
` : "  All recorded tests: PASSING"}
╚══════════════════════════════════════════════════════════╝
`);
}

function cmdDone(args: Record<string, string>): void {
  const state = loadState();
  if (!state) { log("ERROR: No active session."); process.exit(1); }

  const summary = args["summary"] || "QA session complete";
  state.phase = "DONE";
  state.lastActionTimestamp = now();

  auditLog(`DONE summary="${summary}" passed=${state.passed} failed=${state.failed}`);

  // Auto-write to qa_knowledge_base.json
  persistToKnowledgeBase(state, summary, state.failed === 0 ? "passed" : "failed");
  saveState(state);

  log(`Session DONE.`);
  log(`Result: ${state.failed === 0 ? `✅ ${state.passed} passed` : `❌ ${state.failed} failed, ${state.passed} passed`}`);
  log(`Knowledge base updated: ${KB_FILE}`);
}

function cmdWall(args: Record<string, string>): void {
  const state = loadState();
  if (!state) { log("ERROR: No active session."); process.exit(1); }

  const reason = args["reason"] || "Unspecified hard wall";
  state.phase = "HARD_WALL";
  state.isHardWall = true;
  state.wallReason = reason;
  state.lastActionTimestamp = now();

  auditLog(`HARD_WALL reason="${reason}"`);
  saveState(state);

  console.log(`
╔══════════════════════════════════════════════════════════╗
║         QA HARD WALL — HUMAN INTERVENTION REQUIRED       ║
╠══════════════════════════════════════════════════════════╣
  Goal    : ${state.goal}
  Reason  : ${reason}
  Failed  : ${state.failed} test(s)
  Source  : ${state.failedSourceFiles.join(", ") || "none identified"}
  
  Human action required to unblock this QA session.
  When resolved, resume with: /qa <describe task>
╚══════════════════════════════════════════════════════════╝
`);
}

// ---------------------------------------------------------------------------
// Knowledge base persistence
// ---------------------------------------------------------------------------

function persistToKnowledgeBase(
  state: QAWatchdogState,
  summary: string,
  status: "passed" | "failed"
): void {
  let kb: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    "name": "Affiliate Castle QA Knowledge Base",
    "hasPart": [],
  };

  if (fs.existsSync(KB_FILE)) {
    try {
      kb = JSON.parse(fs.readFileSync(KB_FILE, "utf8"));
    } catch { /* use default */ }
  }

  const parts = (kb["hasPart"] as unknown[]) || [];

  const entry = {
    "@type": "QAEntry",
    "sessionId": state.sessionId,
    "date": state.createdAt.slice(0, 10),
    "status": status,
    "description": summary,
    "goal": state.goal,
    "testsPasssed": state.passed,
    "testsFailed": state.failed,
    "failedSourceFiles": state.failedSourceFiles,
    "researchFindings": state.researchFindings,
    "testResults": state.testResults.map((t) => ({
      name: t.name,
      status: t.status,
      ...(t.error ? { error: t.error.slice(0, 200) } : {}),
      ...(t.sourceFile ? { sourceFile: t.sourceFile } : {}),
      ...(t.sourceLine ? { sourceLine: t.sourceLine } : {}),
    })),
    "isHardWall": state.isHardWall,
    "wallReason": state.wallReason,
  };

  parts.unshift(entry); // most recent first
  kb["hasPart"] = parts;
  kb["dateModified"] = now();

  fs.writeFileSync(KB_FILE, JSON.stringify(kb, null, 2), "utf8");
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
  case "heartbeat": cmdHeartbeat(); break;
  case "pass":      cmdPass(flags); break;
  case "fail":      cmdFail(flags); break;
  case "research":  cmdResearch(flags); break;
  case "status":    cmdStatus(); break;
  case "done":      cmdDone(flags); break;
  case "wall":      cmdWall(flags); break;
  default:
    console.log(`Unknown command: ${command}`);
    console.log("Commands: init | heartbeat | pass | fail | research | status | done | wall");
    process.exit(1);
}
