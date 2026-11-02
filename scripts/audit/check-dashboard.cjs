const { chromium } = require("/Users/Nicolas/Developer/Autopilot-source/node_modules/playwright");
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ storageState: "audit/.auth/admin.json", viewport: { width: 1280, height: 900 } });
  const p = await ctx.newPage();
  await p.goto("http://localhost:8080/dashboard", { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(3000);
  console.log("url:", p.url());
  console.log("title:", await p.title());
  await b.close();
})();
