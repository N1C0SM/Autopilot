import { chromium } from "@playwright/test";
import fs from "node:fs";

const email = process.env.AUTOPILOT_QA_ADMIN_EMAIL;
const password = process.env.AUTOPILOT_QA_ADMIN_PASSWORD;
if (!email || !password) { console.error("missing creds"); process.exit(1); }

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: "dark" });
const page = await context.newPage();
await page.goto("http://localhost:8080/login", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(800);
await page.fill("#email", email);
await page.fill("#password", password);
await page.click('button[type="submit"]');
await page.waitForURL(/\/(dashboard|admin|trainer)/, { timeout: 30000 });
await page.waitForTimeout(2000);
await context.storageState({ path: "audit/.auth/admin.json" });
console.log("saved", page.url());
await browser.close();
