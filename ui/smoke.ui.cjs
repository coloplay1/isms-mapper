/* 畫面冒煙測試：用瀏覽器實際開啟工具，切過每個分頁、每家範例公司與主要的詳細頁，
   確認沒有 JavaScript 錯誤、CSP 違規，手機寬度下頁面沒有左右捲動。
   執行：npm run test:ui（需要 playwright 與 Chromium） */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const ROOT = process.env.APP_ROOT || path.join(__dirname, "..");
const TABS = ["home", "overview", "risks", "annex", "clauses", "audit", "improve", "search", "docs", "projects"];
const TYPES = { ".js": "text/javascript", ".css": "text/css", ".html": "text/html; charset=utf-8", ".json": "application/json",
  ".png": "image/png", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".pdf": "application/pdf", ".webmanifest": "application/manifest+json" };

let server, base, browser;

test.before(async () => {
  server = http.createServer((q, r) => {
    let f = path.join(ROOT, decodeURIComponent(q.url.split("?")[0]));
    if (!f.startsWith(ROOT)) { r.writeHead(403); r.end(); return; }
    if (f.endsWith("/")) f += "index.html";
    fs.readFile(f, (e, d) => {
      if (e) { r.writeHead(404); r.end(); return; }
      r.writeHead(200, { "content-type": TYPES[path.extname(f)] || "application/octet-stream" });
      r.end(d);
    });
  });
  await new Promise(ok => server.listen(0, "127.0.0.1", ok));
  base = `http://127.0.0.1:${server.address().port}/`;
  browser = await chromium.launch();
});
test.after(async () => { await browser?.close(); server?.close(); });

/* 開一個新頁面，收集頁面錯誤與 console 錯誤（CSP 違規也會出現在 console） */
async function open(opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, ...opts });
  const pg = await ctx.newPage();
  const errors = [];
  pg.on("pageerror", e => errors.push("pageerror: " + e.message));
  pg.on("console", m => { if (m.type() === "error") errors.push("console: " + m.text()); });
  await pg.goto(base);
  await pg.waitForSelector("#view-home");
  return { pg, ctx, errors };
}

test("首次開啟：首頁顯示、沒有錯誤", async () => {
  const { pg, ctx, errors } = await open();
  assert.ok(await pg.locator("#view-home").isVisible());
  assert.ok(await pg.locator('[data-hpick="create"]').count() > 0, "首頁有「開始導入」");
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("新專案：建立後切過每個分頁，空白狀態的按鈕可用", async () => {
  const { pg, ctx, errors } = await open();
  await pg.click('[data-hpick="create"]');
  await pg.fill("#hName", "冒煙測試");
  await pg.fill("#hScope", "總部");
  await pg.click("#homeForm button.primary");
  await pg.waitForFunction(() => tab === "overview");
  for (const t of TABS) {
    await pg.click(`nav [data-tab="${t}"]`);
    const v = pg.locator(`#view-${t}`);
    assert.ok(await v.isVisible(), `${t} 分頁有顯示`);
    assert.ok((await v.innerText()).trim().length > 0, `${t} 分頁有內容`);
  }
  await pg.click('nav [data-tab="risks"]');
  await pg.click("#rNew2");
  assert.equal(await pg.locator("#drawerHost aside").count(), 1, "新增風險開啟挑選視窗");
  await pg.keyboard.press("Escape");
  await pg.evaluate(() => { $("#drawerHost").innerHTML = ""; });
  await pg.click("#rToSearch");
  assert.equal(await pg.evaluate(() => tab), "search", "前往案例搜尋");
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("每家範例公司：每個分頁、稽核準備子分頁與詳細頁都能開", async () => {
  const { pg, ctx, errors } = await open();
  const ids = await pg.evaluate(() => SAMPLE_DEFS.map(d => d.id));
  assert.ok(ids.length >= 20, "範例公司數量");
  for (const id of ids) {
    const res = await pg.evaluate(({ id, TABS }) => {
      openProject(id, "overview");
      const empty = [];
      for (const t of TABS) {
        tab = t; render();
        if (!document.querySelector(`#view-${t}`).innerText.trim()) empty.push(t);
      }
      tab = "audit";
      for (const v of ["ready", "trace", "spot"]) { auditView = v; render(); }
      auditView = "ready";
      const p = cur();
      openDrawer("A.5.1");
      const ctl = !!document.querySelector("#drawerHost aside");
      $("#drawerHost").innerHTML = "";
      let risk = true;
      if ((p.risks || []).length) {
        openRiskDrawer(p.risks[0].id);
        risk = !!document.querySelector("#drawerHost aside");
        $("#drawerHost").innerHTML = "";
      }
      return { empty, ctl, risk };
    }, { id, TABS });
    assert.deepEqual(res.empty, [], `${id} 沒有空白分頁`);
    assert.ok(res.ctl, `${id} 控制措施詳細頁`);
    assert.ok(res.risk, `${id} 風險詳細頁`);
  }
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("手機寬度、深色模式：每個分頁都沒有左右捲動", async () => {
  const { pg, ctx, errors } = await open({ viewport: { width: 390, height: 844 }, colorScheme: "dark", isMobile: true, hasTouch: true });
  const wide = await pg.evaluate(TABS => {
    openProject("sample:audit", "overview");
    const bad = [];
    for (const t of TABS) {
      tab = t; render();
      const w = document.documentElement.scrollWidth;
      if (w > window.innerWidth + 1) bad.push(`${t}（${w}px）`);
    }
    return bad;
  }, TABS);
  assert.deepEqual(wide, [], "頁面寬度不超過螢幕");
  assert.deepEqual(errors, []);
  await ctx.close();
});
