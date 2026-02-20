#!/usr/bin/env bun
/**
 * Test incident creation and verify it shows in audit log
 */

import puppeteer from "puppeteer";

const SITE_URL = process.env.TEST_URL || "http://localhost:3000";
const TEST_USER = {
  email: process.env.TEST_ADMIN_EMAIL || "admin@uta.org",
  password: process.env.TEST_ADMIN_PASSWORD || "changeme",
};

async function main() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    // Login
    console.log("1. Logging in...");
    await page.goto(`${SITE_URL}/login`, { waitUntil: "networkidle0" });
    await page.type('input[type="email"]', TEST_USER.email);
    await page.type('input[type="password"]', TEST_USER.password);
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNavigation({ waitUntil: "networkidle0" }).catch(() => {}),
    ]);
    await new Promise((r) => setTimeout(r, 1500));
    console.log("   ✓ Logged in\n");

    // Create an incident
    console.log("2. Creating incident...");
    await page.goto(`${SITE_URL}/incidents/new`, { waitUntil: "networkidle0" });
    await new Promise((r) => setTimeout(r, 2000));

    // Fill the form
    const testTitle = "Audit Test Incident " + Date.now();

    // Title
    const titleInput = await page.$('input[placeholder*="Brief description"]');
    if (titleInput) {
      await titleInput.type(testTitle);
      console.log("   ✓ Filled title:", testTitle);
    }

    // Select dropdowns
    await page.evaluate(() => {
      const selects = document.querySelectorAll('select');
      for (const select of selects) {
        const options = select.querySelectorAll('option');
        for (const opt of options) {
          if ((opt as HTMLOptionElement).value) {
            select.value = (opt as HTMLOptionElement).value;
            select.dispatchEvent(new Event('change', { bubbles: true }));
            break;
          }
        }
      }
    });
    console.log("   ✓ Selected dropdowns");

    // Select a mode
    await page.evaluate(() => {
      const buttons = document.querySelectorAll('button');
      for (const btn of buttons) {
        if (btn.textContent === "Bus") {
          btn.click();
          return;
        }
      }
    });
    console.log("   ✓ Selected mode: Bus");

    // Fill public message
    const textarea = await page.$('textarea');
    if (textarea) {
      await textarea.type("Test incident for audit logging verification");
      console.log("   ✓ Filled public message");
    }

    await new Promise((r) => setTimeout(r, 1000));

    // Submit
    const submitted = await page.evaluate(() => {
      const buttons = document.querySelectorAll('button');
      for (const btn of buttons) {
        if (btn.textContent?.includes('Create Incident')) {
          btn.click();
          return true;
        }
      }
      return false;
    });

    if (submitted) {
      console.log("   ✓ Clicked Create Incident");
      await new Promise((r) => setTimeout(r, 3000));
      const currentUrl = page.url();
      console.log("   Current URL:", currentUrl);

      if (currentUrl.includes('/incidents/inc_')) {
        console.log("   ✓ Incident created successfully!\n");
      } else {
        console.log("   ! May have failed to create incident\n");
      }
    }

    // Check audit log
    console.log("3. Checking audit log...");
    await page.goto(`${SITE_URL}/audit`, { waitUntil: "networkidle0" });
    await new Promise((r) => setTimeout(r, 2000));

    const auditCheck = await page.evaluate((searchTitle: string) => {
      const rows = document.querySelectorAll('table tbody tr');
      let foundIncident = false;
      let foundCreate = false;
      const recentLogs: string[] = [];

      for (const row of rows) {
        const text = row.textContent || "";
        const cells = row.querySelectorAll('td');
        const action = cells[2]?.textContent?.trim() || "";
        const resource = cells[3]?.textContent?.trim() || "";

        recentLogs.push(`[${action}] ${resource}`);

        if (resource.toLowerCase().includes('incident')) {
          foundIncident = true;
        }
        if (action.toLowerCase() === 'create') {
          foundCreate = true;
        }
        if (text.includes(searchTitle)) {
          return { found: true, recentLogs: recentLogs.slice(0, 10) };
        }
      }

      return { found: false, foundIncident, foundCreate, recentLogs: recentLogs.slice(0, 10) };
    }, testTitle);

    console.log("\n   Recent audit logs:");
    for (const log of auditCheck.recentLogs) {
      const highlight = log.toLowerCase().includes('incident') ? " <<< INCIDENT" : "";
      console.log(`   - ${log}${highlight}`);
    }

    console.log("\n=== RESULT ===");
    if (auditCheck.found) {
      console.log("✓ SUCCESS: Incident creation found in audit log!");
    } else if (auditCheck.foundIncident) {
      console.log("✓ PARTIAL: Found incident entries in audit log (may be older)");
    } else {
      console.log("✗ FAILED: No incident entries found in audit log");
      if (auditCheck.foundCreate) {
        console.log("  Note: Found 'create' actions, but none for incidents");
      }
    }

  } finally {
    await browser.close();
  }
}

main().catch(console.error);
