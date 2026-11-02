const { chromium } = require("/Users/Nicolas/Developer/Autopilot-source/node_modules/playwright");
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.goto("http://localhost:8080/", { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(2500);
  const rows = await p.evaluate(() => {
    const main = document.getElementById("contenido");
    return Array.from(main.children).map((el) => {
      const r = el.getBoundingClientRect();
      return { aria: el.getAttribute("aria-label") || el.id || "", top: Math.round(r.top + scrollY), h: Math.round(r.height) };
    });
  });
  console.table(rows);
  await b.close();
})();
