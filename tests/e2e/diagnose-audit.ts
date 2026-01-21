#!/usr/bin/env bun
/**
 * Quick diagnostic to check audit log entries
 */

import puppeteer from "puppeteer";

const SITE_URL = "https://uta-notify.jmorrison.workers.dev";
const TEST_USER = { email: "admin@uta.org", password: "***REDACTED***" };

async function main() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    // Login
    console.log("Logging in...");
    await page.goto(`${SITE_URL}/login`, { waitUntil: "networkidle0" });
    await page.type('input[type="email"]', TEST_USER.email);
    await page.type('input[type="password"]', TEST_USER.password);
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNavigation({ waitUntil: "networkidle0" }).catch(() => {}),
    ]);
    await new Promise((r) => setTimeout(r, 1500));
    console.log("✓ Logged in\n");

    // Go to audit log
    await page.goto(`${SITE_URL}/audit`, { waitUntil: "networkidle0" });
    await new Promise((r) => setTimeout(r, 2000));

    // Get detailed info about audit logs
    const auditInfo = await page.evaluate(() => {
      const rows = document.querySelectorAll('table tbody tr');
      const logs = Array.from(rows).slice(0, 20).map((row) => {
        const cells = row.querySelectorAll('td');
        return {
          time: cells[0]?.textContent?.trim() || "",
          user: cells[1]?.textContent?.trim() || "",
          action: cells[2]?.textContent?.trim() || "",
          resource: cells[3]?.textContent?.trim() || "",
          details: cells[4]?.textContent?.trim() || "",
        };
      });

      // Get stats
      const statsCards = document.querySelectorAll('.rounded-xl.border.bg-card');
      const stats: Record<string, string> = {};
      statsCards.forEach((card) => {
        const label = card.querySelector('.text-muted-foreground')?.textContent || "";
        const value = card.querySelector('.text-2xl')?.textContent || "";
        if (label && value) {
          stats[label.trim()] = value.trim();
        }
      });

      return { logs, stats, totalRows: rows.length };
    });

    console.log("=== AUDIT LOG STATS ===");
    for (const [key, value] of Object.entries(auditInfo.stats)) {
      console.log(`  ${key}: ${value}`);
    }

    console.log(`\n=== RECENT AUDIT LOGS (${auditInfo.totalRows} total) ===`);
    console.log("Time".padEnd(15), "User".padEnd(15), "Action".padEnd(10), "Resource".padEnd(30));
    console.log("-".repeat(70));

    for (const log of auditInfo.logs) {
      console.log(
        log.time.padEnd(15),
        log.user.substring(0, 14).padEnd(15),
        log.action.padEnd(10),
        log.resource.substring(0, 29).padEnd(30)
      );
    }

    // Check for specific resource types
    const resourceTypes = [...new Set(auditInfo.logs.map((l) => l.resource.split('"')[0].trim()))];
    const actions = [...new Set(auditInfo.logs.map((l) => l.action))];

    console.log("\n=== SUMMARY ===");
    console.log("Unique actions:", actions.join(", "));
    console.log("Unique resource types:", resourceTypes.join(", "));

    const hasIncident = auditInfo.logs.some((l) => l.resource.toLowerCase().includes("incident"));
    console.log("\nIncidents in log:", hasIncident ? "YES" : "NO");

  } finally {
    await browser.close();
  }
}

main().catch(console.error);
