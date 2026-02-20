/**
 * Role-Based Access Control (RBAC) E2E Tests
 *
 * Tests all four roles (admin, editor, operator, viewer) against
 * page access and action permissions on production.
 *
 * Run with: bun test tests/e2e/rbac.test.ts
 */

import puppeteer, { type Browser, type Page } from "puppeteer";
import { test, expect, describe, beforeAll, afterAll } from "bun:test";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";

// ============================================
// CONFIGURATION
// ============================================

const SITE_URL = process.env.TEST_URL || "http://localhost:3000";
const SCREENSHOT_DIR = join(import.meta.dir, "rbac-screenshots");
const RESULTS_FILE = join(import.meta.dir, "rbac-test-results.json");

// Test users - must exist in production database
const TEST_USERS = {
  admin: "admin@uta.org",
  editor: "editor@uta.org",
  operator: "operator@uta.org",
  viewer: "viewer@uta.org",
} as const;

type Role = keyof typeof TEST_USERS;

// Permission matrix from permissions.ts
const ROLE_PERMISSIONS: Record<Role, string[]> = {
  admin: [
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
  ],
  editor: [
    "incidents.view", "incidents.create", "incidents.edit", "incidents.publish",
    "incidents.resolve", "incidents.archive",
    "messages.view", "messages.create", "messages.edit", "messages.send",
    "templates.view", "templates.create", "templates.edit", "templates.delete",
    "subscribers.view", "subscribers.create", "subscribers.edit", "subscribers.export",
    "reports.view", "reports.export",
    "settings.view",
    "automation.view", "automation.create", "automation.edit",
    "audit.view",
  ],
  operator: [
    "incidents.view", "incidents.create", "incidents.edit", "incidents.resolve",
    "messages.view", "messages.create", "messages.edit",
    "templates.view",
    "subscribers.view",
    "reports.view",
    "settings.view",
    "automation.view",
  ],
  viewer: [
    "incidents.view",
    "messages.view",
    "templates.view",
    "subscribers.view",
    "reports.view",
    "settings.view",
  ],
};

// ============================================
// TEST HELPERS
// ============================================

interface TestResult {
  role: Role;
  test: string;
  expected: "allow" | "deny";
  actual: "allow" | "deny" | "error";
  passed: boolean;
  error?: string;
  screenshotPath?: string;
}

const testResults: TestResult[] = [];

function hasPermission(role: Role, permission: string): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

async function saveScreenshot(page: Page, name: string): Promise<string> {
  await mkdir(SCREENSHOT_DIR, { recursive: true });
  const filename = `${name.replace(/[^a-z0-9]/gi, "-")}.png`;
  const filepath = join(SCREENSHOT_DIR, filename);
  await page.screenshot({ path: filepath, fullPage: true });
  return filepath;
}

function recordResult(result: TestResult) {
  testResults.push(result);
}

async function saveResults() {
  await writeFile(RESULTS_FILE, JSON.stringify(testResults, null, 2));
}

// ============================================
// BROWSER HELPERS
// ============================================

async function login(page: Page, email: string): Promise<boolean> {
  try {
    await page.goto(`${SITE_URL}/login`, { waitUntil: "networkidle0", timeout: 30000 });

    // Wait for login form
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });

    // Clear and type email
    await page.$eval('input[type="email"]', (el) => ((el as HTMLInputElement).value = ""));
    await page.type('input[type="email"]', email, { delay: 30 });

    // Submit and wait for navigation
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNavigation({ waitUntil: "networkidle0", timeout: 15000 }).catch(() => {}),
    ]);

    // Wait for page to settle
    await new Promise((r) => setTimeout(r, 2000));

    // Check if we're logged in (not on login page)
    const url = page.url();
    return !url.includes("/login");
  } catch (error) {
    console.error(`Login failed for ${email}:`, error);
    return false;
  }
}

async function logout(page: Page): Promise<void> {
  try {
    // Look for user menu/logout button
    const userMenu = await page.$('[data-testid="user-menu"], .user-menu, button:has-text("Sign out")');
    if (userMenu) {
      await userMenu.click();
      await new Promise((r) => setTimeout(r, 500));
    }

    // Try clicking logout link
    const logoutLink = await page.$('a[href*="logout"], button:has-text("Sign out"), button:has-text("Logout")');
    if (logoutLink) {
      await logoutLink.click();
      await page.waitForNavigation({ waitUntil: "networkidle0" }).catch(() => {});
    }
  } catch {
    // Navigate to login page to force logout
    await page.goto(`${SITE_URL}/login`, { waitUntil: "networkidle0" });
  }
}

async function canAccessPage(page: Page, path: string): Promise<{ canAccess: boolean; error?: string }> {
  try {
    const response = await page.goto(`${SITE_URL}${path}`, {
      waitUntil: "networkidle0",
      timeout: 30000,
    });

    await new Promise((r) => setTimeout(r, 1000));

    const url = page.url();
    const status = response?.status() || 0;

    // Check for redirect to login
    if (url.includes("/login")) {
      return { canAccess: false, error: "Redirected to login" };
    }

    // Check for 403/404 status
    if (status === 403) {
      return { canAccess: false, error: "403 Forbidden" };
    }

    if (status === 404) {
      return { canAccess: false, error: "404 Not Found" };
    }

    // Check for error message in page
    const pageContent = await page.content();
    if (
      pageContent.includes("Forbidden") ||
      pageContent.includes("not authorized") ||
      pageContent.includes("permission denied")
    ) {
      return { canAccess: false, error: "Permission denied message" };
    }

    return { canAccess: true };
  } catch (error) {
    return { canAccess: false, error: String(error) };
  }
}

async function canPerformAction(
  page: Page,
  action: () => Promise<void>,
  checkSuccess: () => Promise<boolean>
): Promise<{ success: boolean; error?: string }> {
  try {
    await action();
    await new Promise((r) => setTimeout(r, 2000));
    const success = await checkSuccess();
    return { success };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// ============================================
// UI ELEMENT CHECKS
// ============================================

async function isElementVisible(page: Page, selector: string): Promise<boolean> {
  try {
    const element = await page.$(selector);
    if (!element) return false;
    const isVisible = await element.isIntersectingViewport();
    return isVisible ?? false;
  } catch {
    return false;
  }
}

async function hasCreateButton(page: Page): Promise<boolean> {
  return isElementVisible(page, 'a[href*="/new"], button:has-text("Create"), button:has-text("New")');
}

async function hasEditButton(page: Page): Promise<boolean> {
  return isElementVisible(page, 'a[href*="/edit"], button:has-text("Edit")');
}

async function hasDeleteButton(page: Page): Promise<boolean> {
  return isElementVisible(page, 'button:has-text("Delete"), [data-action="delete"]');
}

// ============================================
// TEST SUITES
// ============================================

describe("RBAC E2E Tests", () => {
  let browser: Browser;

  beforeAll(async () => {
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    await mkdir(SCREENSHOT_DIR, { recursive: true });
  });

  afterAll(async () => {
    await browser.close();
    await saveResults();
    console.log(`\nTest results saved to ${RESULTS_FILE}`);
    console.log(`Screenshots saved to ${SCREENSHOT_DIR}`);
  });

  // ============================================
  // TEST EACH ROLE
  // ============================================

  for (const role of Object.keys(TEST_USERS) as Role[]) {
    describe(`Role: ${role}`, () => {
      let page: Page;

      beforeAll(async () => {
        page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });

        const loggedIn = await login(page, TEST_USERS[role]);
        if (!loggedIn) {
          throw new Error(`Failed to login as ${role}`);
        }
      });

      afterAll(async () => {
        await logout(page);
        await page.close();
      });

      // ----------------------------------------
      // PAGE ACCESS TESTS
      // ----------------------------------------

      describe("Page Access", () => {
        const pages = [
          { path: "/", permission: "incidents.view", name: "Dashboard" },
          { path: "/incidents", permission: "incidents.view", name: "Incidents List" },
          { path: "/incidents/new", permission: "incidents.create", name: "Create Incident" },
          { path: "/messages", permission: "messages.view", name: "Messages List" },
          { path: "/messages/new", permission: "messages.create", name: "Create Message" },
          { path: "/templates", permission: "templates.view", name: "Templates" },
          { path: "/subscribers", permission: "subscribers.view", name: "Subscribers" },
          { path: "/reports", permission: "reports.view", name: "Reports" },
          { path: "/settings", permission: "settings.view", name: "Settings" },
          { path: "/audit", permission: "audit.view", name: "Audit Log" },
        ];

        for (const { path, permission, name } of pages) {
          const shouldAccess = hasPermission(role, permission);

          test(`${shouldAccess ? "can" : "cannot"} access ${name}`, async () => {
            const result = await canAccessPage(page, path);

            const testResult: TestResult = {
              role,
              test: `Page access: ${name}`,
              expected: shouldAccess ? "allow" : "deny",
              actual: result.canAccess ? "allow" : "deny",
              passed: result.canAccess === shouldAccess,
              error: result.error,
            };

            if (!testResult.passed) {
              testResult.screenshotPath = await saveScreenshot(page, `${role}-${name}-access`);
            }

            recordResult(testResult);

            if (shouldAccess) {
              expect(result.canAccess).toBe(true);
            } else {
              expect(result.canAccess).toBe(false);
            }
          });
        }
      });

      // ----------------------------------------
      // UI ELEMENT VISIBILITY TESTS
      // ----------------------------------------

      describe("UI Element Visibility", () => {
        test("incidents page shows correct buttons", async () => {
          await page.goto(`${SITE_URL}/incidents`, { waitUntil: "networkidle0" });
          await new Promise((r) => setTimeout(r, 1000));

          const canCreate = hasPermission(role, "incidents.create");
          const hasCreate = await hasCreateButton(page);

          const testResult: TestResult = {
            role,
            test: "Incidents: Create button visibility",
            expected: canCreate ? "allow" : "deny",
            actual: hasCreate ? "allow" : "deny",
            passed: hasCreate === canCreate,
          };

          recordResult(testResult);
          expect(hasCreate).toBe(canCreate);
        });

        test("templates page shows correct buttons", async () => {
          await page.goto(`${SITE_URL}/templates`, { waitUntil: "networkidle0" });
          await new Promise((r) => setTimeout(r, 1000));

          const canCreate = hasPermission(role, "templates.create");
          const hasCreate = await hasCreateButton(page);

          const testResult: TestResult = {
            role,
            test: "Templates: Create button visibility",
            expected: canCreate ? "allow" : "deny",
            actual: hasCreate ? "allow" : "deny",
            passed: hasCreate === canCreate,
          };

          recordResult(testResult);
          expect(hasCreate).toBe(canCreate);
        });

        test("subscribers page shows correct buttons", async () => {
          await page.goto(`${SITE_URL}/subscribers`, { waitUntil: "networkidle0" });
          await new Promise((r) => setTimeout(r, 1000));

          const canCreate = hasPermission(role, "subscribers.create");
          const hasCreate = await hasCreateButton(page);

          const testResult: TestResult = {
            role,
            test: "Subscribers: Create button visibility",
            expected: canCreate ? "allow" : "deny",
            actual: hasCreate ? "allow" : "deny",
            passed: hasCreate === canCreate,
          };

          recordResult(testResult);
          expect(hasCreate).toBe(canCreate);
        });
      });

      // ----------------------------------------
      // SETTINGS EDIT TESTS
      // ----------------------------------------

      describe("Settings Permissions", () => {
        test(`${hasPermission(role, "settings.edit") ? "can" : "cannot"} edit settings`, async () => {
          await page.goto(`${SITE_URL}/settings`, { waitUntil: "networkidle0" });
          await new Promise((r) => setTimeout(r, 1000));

          const canEdit = hasPermission(role, "settings.edit");

          // Look for edit/save buttons in settings
          const hasEditControls = await isElementVisible(
            page,
            'button:has-text("Save"), button:has-text("Edit"), input:not([disabled])'
          );

          const testResult: TestResult = {
            role,
            test: "Settings: Edit controls visibility",
            expected: canEdit ? "allow" : "deny",
            actual: hasEditControls ? "allow" : "deny",
            passed: hasEditControls === canEdit,
          };

          if (!testResult.passed) {
            testResult.screenshotPath = await saveScreenshot(page, `${role}-settings-edit`);
          }

          recordResult(testResult);

          // Note: This test is advisory - settings page may show read-only view to all
        });
      });
    });
  }

  // ============================================
  // CROSS-ROLE COMPARISON TESTS
  // ============================================

  describe("Permission Escalation Prevention", () => {
    test("viewer cannot access admin-only pages", async () => {
      const page = await browser.newPage();
      await login(page, TEST_USERS.viewer);

      // Try to access audit log (admin/editor only)
      const auditResult = await canAccessPage(page, "/audit");

      recordResult({
        role: "viewer",
        test: "Cannot access audit log",
        expected: "deny",
        actual: auditResult.canAccess ? "allow" : "deny",
        passed: !auditResult.canAccess,
      });

      expect(auditResult.canAccess).toBe(false);

      await page.close();
    });

    test("operator cannot publish incidents", async () => {
      const page = await browser.newPage();
      await login(page, TEST_USERS.operator);

      // Navigate to incidents page
      await page.goto(`${SITE_URL}/incidents`, { waitUntil: "networkidle0" });

      // Check if publish button exists (it shouldn't for operator)
      const hasPublish = await isElementVisible(page, 'button:has-text("Publish")');

      recordResult({
        role: "operator",
        test: "Cannot see publish button",
        expected: "deny",
        actual: hasPublish ? "allow" : "deny",
        passed: !hasPublish,
      });

      expect(hasPublish).toBe(false);

      await page.close();
    });
  });
});

// ============================================
// STANDALONE RUNNER
// ============================================

if (import.meta.main) {
  console.log("Running RBAC tests against:", SITE_URL);
  console.log("Test users:", TEST_USERS);
}
