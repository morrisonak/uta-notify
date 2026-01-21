#!/usr/bin/env bun
/**
 * RBAC E2E Test Runner
 *
 * Comprehensive role-based access control tests for UTA Notify.
 * Tests all four roles against all pages and key actions.
 *
 * Usage:
 *   bun tests/e2e/run-rbac-tests.ts
 *   bun tests/e2e/run-rbac-tests.ts --url https://custom-url.workers.dev
 */

import puppeteer, { type Browser, type Page } from "puppeteer";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";

// ============================================
// CONFIGURATION
// ============================================

const args = process.argv.slice(2);
const urlIndex = args.indexOf("--url");
const SITE_URL = urlIndex !== -1 ? args[urlIndex + 1] : "https://uta-notify.jmorrison.workers.dev";

const SCREENSHOT_DIR = join(import.meta.dir, "rbac-screenshots");

const TEST_USERS = {
  admin: { email: "admin@uta.org", password: "***REDACTED***" },
  editor: { email: "editor@uta.org", password: "***REDACTED***" },
  operator: { email: "operator@uta.org", password: "***REDACTED***" },
  viewer: { email: "viewer@uta.org", password: "***REDACTED***" },
} as const;

type Role = keyof typeof TEST_USERS;

// Permission definitions from permissions.ts
const ROLE_PERMISSIONS: Record<Role, Set<string>> = {
  admin: new Set([
    "incidents.view", "incidents.create", "incidents.edit", "incidents.delete",
    "incidents.publish", "incidents.resolve", "incidents.archive",
    "messages.view", "messages.create", "messages.edit", "messages.delete", "messages.send",
    "templates.view", "templates.create", "templates.edit", "templates.delete",
    "subscribers.view", "subscribers.create", "subscribers.edit", "subscribers.delete", "subscribers.export",
    "reports.view", "reports.export",
    "settings.view", "settings.edit",
    "users.view", "users.create", "users.edit", "users.delete", "users.manage_roles",
    "automation.view", "automation.create", "automation.edit", "automation.delete",
    "audit.view",
  ]),
  editor: new Set([
    "incidents.view", "incidents.create", "incidents.edit", "incidents.publish",
    "incidents.resolve", "incidents.archive",
    "messages.view", "messages.create", "messages.edit", "messages.send",
    "templates.view", "templates.create", "templates.edit", "templates.delete",
    "subscribers.view", "subscribers.create", "subscribers.edit", "subscribers.export",
    "reports.view", "reports.export",
    "settings.view",
    "automation.view", "automation.create", "automation.edit",
    "audit.view",
  ]),
  operator: new Set([
    "incidents.view", "incidents.create", "incidents.edit", "incidents.resolve",
    "messages.view", "messages.create", "messages.edit",
    "templates.view",
    "subscribers.view",
    "reports.view",
    "settings.view",
    "automation.view",
  ]),
  viewer: new Set([
    "incidents.view",
    "messages.view",
    "templates.view",
    "subscribers.view",
    "reports.view",
    "settings.view",
  ]),
};

// ============================================
// TYPES
// ============================================

interface TestResult {
  role: Role;
  test: string;
  expected: boolean;
  actual: boolean;
  passed: boolean;
  error?: string;
  duration: number;
}

interface TestSummary {
  total: number;
  passed: number;
  failed: number;
  byRole: Record<Role, { passed: number; failed: number }>;
}

// ============================================
// HELPERS
// ============================================

const colors = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  dim: "\x1b[2m",
};

function log(msg: string) {
  console.log(msg);
}

function logPass(msg: string) {
  console.log(`${colors.green}✓${colors.reset} ${msg}`);
}

function logFail(msg: string) {
  console.log(`${colors.red}✗${colors.reset} ${msg}`);
}

function logInfo(msg: string) {
  console.log(`${colors.cyan}ℹ${colors.reset} ${msg}`);
}

function logSection(msg: string) {
  console.log(`\n${colors.blue}▸ ${msg}${colors.reset}`);
}

function hasPermission(role: Role, permission: string): boolean {
  return ROLE_PERMISSIONS[role].has(permission);
}

// ============================================
// BROWSER OPERATIONS
// ============================================

async function login(page: Page, email: string, password: string): Promise<boolean> {
  try {
    await page.goto(`${SITE_URL}/login`, { waitUntil: "networkidle0", timeout: 30000 });
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });

    // Clear and type email
    const emailInput = await page.$('input[type="email"]');
    if (emailInput) {
      await emailInput.click({ clickCount: 3 });
      await emailInput.type(email, { delay: 20 });
    }

    // Wait for password field and type password
    await page.waitForSelector('input[type="password"]', { timeout: 5000 });
    const passwordInput = await page.$('input[type="password"]');
    if (passwordInput) {
      await passwordInput.click({ clickCount: 3 });
      await passwordInput.type(password, { delay: 20 });
    }

    // Submit
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNavigation({ waitUntil: "networkidle0", timeout: 15000 }).catch(() => {}),
    ]);

    await new Promise((r) => setTimeout(r, 1500));

    // Verify login succeeded
    const url = page.url();
    return !url.includes("/login");
  } catch (error) {
    console.error(`Login failed for ${email}:`, error);
    return false;
  }
}

async function checkPageAccess(page: Page, path: string): Promise<{ accessible: boolean; error?: string }> {
  try {
    const response = await page.goto(`${SITE_URL}${path}`, {
      waitUntil: "networkidle0",
      timeout: 30000,
    });

    await new Promise((r) => setTimeout(r, 1000));

    const url = page.url();
    const status = response?.status() || 0;

    // Redirected to login = no access
    if (url.includes("/login")) {
      return { accessible: false, error: "Redirected to login" };
    }

    // 403/404 = no access
    if (status === 403 || status === 404) {
      return { accessible: false, error: `HTTP ${status}` };
    }

    // Check page content for permission errors or generic error boundaries
    const content = await page.content();
    const lowerContent = content.toLowerCase();
    if (
      lowerContent.includes("forbidden") ||
      lowerContent.includes("not authorized") ||
      lowerContent.includes("permission denied") ||
      lowerContent.includes("access denied") ||
      lowerContent.includes("something went wrong")
    ) {
      return { accessible: false, error: "Permission denied or error in page" };
    }

    return { accessible: true };
  } catch (error) {
    return { accessible: false, error: String(error) };
  }
}

async function checkButtonExists(page: Page, textPatterns: string[]): Promise<boolean> {
  // Use page.evaluate to find buttons/links by text content (Puppeteer-compatible)
  return await page.evaluate((patterns: string[]) => {
    const elements = document.querySelectorAll("button, a");
    for (const el of elements) {
      const text = el.textContent?.toLowerCase() || "";
      const isVisible = (el as HTMLElement).offsetParent !== null;
      if (!isVisible) continue;

      for (const pattern of patterns) {
        if (text.includes(pattern.toLowerCase())) {
          return true;
        }
      }
    }
    return false;
  }, textPatterns);
}

// ============================================
// TEST DEFINITIONS
// ============================================

interface PageTest {
  name: string;
  path: string;
  permission: string;
}

interface ButtonTest {
  name: string;
  path: string;
  permission: string;
  selectors: string[];
}

const PAGE_TESTS: PageTest[] = [
  { name: "Dashboard", path: "/", permission: "incidents.view" },
  { name: "Incidents List", path: "/incidents", permission: "incidents.view" },
  { name: "Create Incident", path: "/incidents/new", permission: "incidents.create" },
  { name: "Messages List", path: "/messages", permission: "messages.view" },
  { name: "Create Message", path: "/messages/new", permission: "messages.create" },
  { name: "Templates", path: "/templates", permission: "templates.view" },
  { name: "Subscribers", path: "/subscribers", permission: "subscribers.view" },
  { name: "Reports", path: "/reports", permission: "reports.view" },
  { name: "Settings", path: "/settings", permission: "settings.view" },
  { name: "Audit Log", path: "/audit", permission: "audit.view" },
];

const BUTTON_TESTS: ButtonTest[] = [
  {
    name: "Create Incident Button",
    path: "/incidents",
    permission: "incidents.create",
    selectors: ["new incident", "create incident"],
  },
  {
    name: "Create Template Button",
    path: "/templates",
    permission: "templates.create",
    selectors: ["new template", "create template"],
  },
  {
    name: "Create Subscriber Button",
    path: "/subscribers",
    permission: "subscribers.create",
    selectors: ["add subscriber", "new subscriber", "create subscriber"],
  },
];

// ============================================
// MAIN TEST RUNNER
// ============================================

async function runTests(): Promise<TestSummary> {
  log(`\n${"=".repeat(60)}`);
  log(`  RBAC E2E TEST SUITE`);
  log(`  Target: ${SITE_URL}`);
  log(`${"=".repeat(60)}\n`);

  await mkdir(SCREENSHOT_DIR, { recursive: true });

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const results: TestResult[] = [];
  const summary: TestSummary = {
    total: 0,
    passed: 0,
    failed: 0,
    byRole: {
      admin: { passed: 0, failed: 0 },
      editor: { passed: 0, failed: 0 },
      operator: { passed: 0, failed: 0 },
      viewer: { passed: 0, failed: 0 },
    },
  };

  try {
    for (const role of Object.keys(TEST_USERS) as Role[]) {
      const { email, password } = TEST_USERS[role];
      logSection(`Testing role: ${role.toUpperCase()} (${email})`);

      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 800 });

      // Login
      const loginStart = Date.now();
      const loggedIn = await login(page, email, password);

      if (!loggedIn) {
        logFail(`Failed to login as ${role}`);
        await page.close();
        continue;
      }

      logPass(`Logged in as ${role} (${Date.now() - loginStart}ms)`);

      // Run page access tests
      log(`\n  ${colors.dim}Page Access Tests:${colors.reset}`);

      for (const test of PAGE_TESTS) {
        const start = Date.now();
        const expected = hasPermission(role, test.permission);
        const result = await checkPageAccess(page, test.path);
        const actual = result.accessible;
        const passed = actual === expected;
        const duration = Date.now() - start;

        summary.total++;
        if (passed) {
          summary.passed++;
          summary.byRole[role].passed++;
          logPass(`  ${test.name}: ${expected ? "accessible" : "blocked"} (${duration}ms)`);
        } else {
          summary.failed++;
          summary.byRole[role].failed++;
          logFail(`  ${test.name}: expected ${expected ? "accessible" : "blocked"}, got ${actual ? "accessible" : "blocked"}${result.error ? ` (${result.error})` : ""}`);

          // Screenshot on failure
          await page.screenshot({
            path: join(SCREENSHOT_DIR, `${role}-${test.name.replace(/\s+/g, "-")}-fail.png`),
            fullPage: true,
          });
        }

        results.push({ role, test: `Page: ${test.name}`, expected, actual, passed, duration, error: result.error });
      }

      // Run button visibility tests
      log(`\n  ${colors.dim}UI Element Tests:${colors.reset}`);

      for (const test of BUTTON_TESTS) {
        const start = Date.now();
        await page.goto(`${SITE_URL}${test.path}`, { waitUntil: "networkidle0" });
        await new Promise((r) => setTimeout(r, 1000));

        const expected = hasPermission(role, test.permission);
        const actual = await checkButtonExists(page, test.selectors);
        const passed = actual === expected;
        const duration = Date.now() - start;

        summary.total++;
        if (passed) {
          summary.passed++;
          summary.byRole[role].passed++;
          logPass(`  ${test.name}: ${expected ? "visible" : "hidden"} (${duration}ms)`);
        } else {
          summary.failed++;
          summary.byRole[role].failed++;
          logFail(`  ${test.name}: expected ${expected ? "visible" : "hidden"}, got ${actual ? "visible" : "hidden"}`);
        }

        results.push({ role, test: `Button: ${test.name}`, expected, actual, passed, duration });
      }

      await page.close();
    }
  } finally {
    await browser.close();
  }

  // Save results
  await writeFile(
    join(SCREENSHOT_DIR, "results.json"),
    JSON.stringify({ summary, results }, null, 2)
  );

  // Print summary
  log(`\n${"=".repeat(60)}`);
  log(`  TEST SUMMARY`);
  log(`${"=".repeat(60)}`);
  log(`\n  Total: ${summary.total}`);
  log(`  ${colors.green}Passed: ${summary.passed}${colors.reset}`);
  log(`  ${colors.red}Failed: ${summary.failed}${colors.reset}`);
  log(`\n  By Role:`);
  for (const [role, stats] of Object.entries(summary.byRole)) {
    const pct = Math.round((stats.passed / (stats.passed + stats.failed)) * 100) || 0;
    const color = pct === 100 ? colors.green : pct >= 80 ? colors.yellow : colors.red;
    log(`    ${role}: ${color}${stats.passed}/${stats.passed + stats.failed} (${pct}%)${colors.reset}`);
  }

  log(`\n  Results saved to: ${join(SCREENSHOT_DIR, "results.json")}`);

  if (summary.failed > 0) {
    log(`\n${colors.red}  ⚠ Some tests failed! Check screenshots in ${SCREENSHOT_DIR}${colors.reset}`);
  } else {
    log(`\n${colors.green}  ✓ All tests passed!${colors.reset}`);
  }

  log("");

  return summary;
}

// ============================================
// RUN
// ============================================

const summary = await runTests();
process.exit(summary.failed > 0 ? 1 : 0);
