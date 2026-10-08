// Screenshot one section of a lesson page and report errors.
// Usage: node tools/check/section.js <page.html> <#fromId> <#toId> <outPrefix> [setup]
// setup "spacetest" also cycles the space tester's presets and prints each verdict.
// setup "examples" opens the Examples tab first; "nslab" also cycles the nullspace lab presets;
// "cycle:<select>:<output>" opens Examples and prints each preset's answer lines from <output>.
const path = require("path");
const { chromium } = require(path.join(__dirname, "../downloads/node_modules/playwright-core"));
(async () => {
  const [page, from, to, out, setup] = process.argv.slice(2);
  const url = "file://" + path.resolve(page).split(path.sep).map(encodeURIComponent).join("/").replace(/^%2F/, "/");
  const b = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const p = await b.newPage({ viewport: { width: 1300, height: 900 } });
  const errs = []; p.on("pageerror", e => errs.push(e.message)); p.on("console", m => { if (m.type() === "error") errs.push(m.text()); });
  await p.goto(url, { waitUntil: "networkidle" }); await p.waitForTimeout(2500);
  if (setup === "spacetest") {
    const n = await p.$$eval(".st-pick option", o => o.length);
    for (let i = 0; i < n; i++) { await p.selectOption(".st-pick", String(i)); await p.waitForTimeout(250); console.log(i + ": " + (await p.$eval(".st-out", e => e.innerText.replace(/\s+/g, " ").slice(-110)))); }
    await p.selectOption(".st-pick", "1"); await p.waitForTimeout(300);
  }
  if (setup === "examples" || setup === "nslab") { await p.click('.tabs button[data-tab="examples"]'); await p.waitForTimeout(800); }
  if (setup && setup.startsWith("cycle:")) {
    const [, sel, outSel] = setup.split(":");
    await p.click('.tabs button[data-tab="examples"]'); await p.waitForTimeout(800);
    const n = await p.$$eval(sel + " option", o => o.length);
    for (let i = 0; i < n; i++) { await p.selectOption(sel, String(i)); await p.waitForTimeout(300); console.log(i + ": " + (await p.$$eval(outSel + " .answer, " + outSel + " .lab-warn", es => es.map(e => e.innerText.replace(/\s+/g, " ")).join(" | ")))); }
    await p.selectOption(sel, "0"); await p.waitForTimeout(300);
  }
  if (setup === "nslab") {
    const n = await p.$$eval(".ns-pick option", o => o.length);
    for (let i = 0; i < n; i++) { await p.selectOption(".ns-pick", String(i)); await p.waitForTimeout(300); console.log(i + ": " + (await p.$$eval(".ns-out .answer, .ns-out .lab-warn", es => es.map(e => e.innerText.replace(/\s+/g, " ")).join(" | ")))); }
    await p.selectOption(".ns-pick", "0"); await p.waitForTimeout(300);
  }
  const y0 = await p.evaluate(s => document.querySelector(s).getBoundingClientRect().top + scrollY - 60, from);
  const y1 = await p.evaluate(s => document.querySelector(s).getBoundingClientRect().top + scrollY - 60, to);
  let i = 0; for (let y = y0; y < y1; y += 820) { await p.evaluate(v => scrollTo(0, v), y); await p.waitForTimeout(250); await p.screenshot({ path: out + "-" + (i++) + ".png" }); }
  console.log("shots", i, "| katex errors:", await p.evaluate(() => document.querySelectorAll(".katex-error").length), "|", errs.join("; ") || "no errors");
  await b.close();
})();
