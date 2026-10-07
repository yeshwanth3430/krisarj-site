// Builds each lesson's downloads into public/downloads/:
//   <slug>-slides.pdf  the slide carousel page, one 1080 × 1350 page per slide (LinkedIn's portrait size)
//   <slug>-notes.pdf   the lesson's Notes tab as an A4 report (answers unfolded, 3D plots as images)
// It also saves the 3D plots the slides use as PNGs. Needs Google Chrome and network access (fonts, KaTeX, Plotly).
// Usage: cd tools/downloads && npm install && npm run build
const path = require("path");
const fs = require("fs");
const { chromium } = require("playwright-core");

const PUBLIC = path.resolve(__dirname, "../../public");
const CHROME = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const LESSONS = [
  {
    slug: "la-01-geometry-of-linear-equations",
    title: "Linear Algebra · Lesson 1 · The Geometry of Linear Equations",
    page: "linear-algebra/01_geometry-of-linear-equations.html",
    slides: "linear-algebra/01_geometry-of-linear-equations-slides.html",
    plots: { t7row: "linear-algebra/img/l1-3x3-row.png", t7col: "linear-algebra/img/l1-3x3-col.png" }
  },
  {
    slug: "la-02-elimination-with-matrices",
    title: "Linear Algebra · Lesson 2 · Elimination with Matrices",
    page: "linear-algebra/02_elimination-with-matrices.html",
    slides: "linear-algebra/02_elimination-with-matrices-slides.html",
    plots: { e3U: "linear-algebra/img/l2-planes-U.png" }
  },
  {
    slug: "la-03-multiplication-and-inverse-matrices",
    title: "Linear Algebra · Lesson 3 · Multiplication and Inverse Matrices",
    page: "linear-algebra/03_multiplication-and-inverse-matrices.html",
    slides: "linear-algebra/03_multiplication-and-inverse-matrices-slides.html",
    plots: {}
  },
  {
    slug: "la-04-factorization-into-a-lu",
    title: "Linear Algebra · Lesson 4 · Factorization into A = LU",
    page: "linear-algebra/04_factorization-into-a-lu.html",
    slides: "linear-algebra/04_factorization-into-a-lu-slides.html",
    plots: { costChart: { file: "linear-algebra/img/l4-cost.png", width: 560, height: 420 } }
  },
  {
    slug: "la-05-transposes-permutations-vector-spaces",
    title: "Linear Algebra · Lesson 5 · Transposes, Permutations, Vector Spaces",
    page: "linear-algebra/05_transposes-permutations-vector-spaces.html",
    slides: "linear-algebra/05_transposes-permutations-vector-spaces-slides.html",
    plots: { csPlane: "linear-algebra/img/l5-colspace.png" }
  }
];

const url = (rel) => "file://" + path.join(PUBLIC, rel).split(path.sep).map(encodeURIComponent).join("/").replace(/^%2F/, "/");

async function open(browser, rel, viewport) {
  const page = await browser.newPage({ viewport, colorScheme: "light" });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(url(rel), { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(2500);   // KaTeX + Plotly render on load
  if (errors.length) throw new Error(rel + ": " + errors.join("; "));
  return page;
}

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  for (const L of LESSONS) {
    // 1. Notes page: plot images, then the A4 report
    const notes = await open(browser, L.page, { width: 1100, height: 900 });
    for (const [id, spec] of Object.entries(L.plots)) {
      // a plot is "file.png", or { file, width, height } to export on a smaller canvas (bigger text on the slide)
      const out = typeof spec === "string" ? spec : spec.file, w = spec.width || 1000, h = spec.height || 760;
      const data = await notes.evaluate(([id, w, h]) => { const gd = document.getElementById(id);
        return Plotly.toImage({ data: gd.data, layout: Object.assign({}, gd.layout, { updatemenus: [] }) }, { format: "png", width: w, height: h, scale: 3 }); }, [id, w, h]);
      fs.writeFileSync(path.join(PUBLIC, out), Buffer.from(data.split(",")[1], "base64"));
      console.log("  image", out);
    }
    await notes.evaluate(async () => {
      document.querySelectorAll("details").forEach((d) => (d.open = true));
      for (const el of document.querySelectorAll(".tab-panel[data-panel='notes'] .plot3d-box")) {
        const src = await Plotly.toImage({ data: el.data, layout: Object.assign({}, el.layout, { updatemenus: [] }) }, { format: "png", width: 1000, height: 700, scale: 2 });
        const img = document.createElement("img");
        img.src = src; img.style.width = "100%"; img.alt = "";
        el.replaceWith(img);
      }
    });
    await notes.emulateMedia({ media: "print" });
    const foot = '<div style="width:100%;font:8px Inter,sans-serif;color:#777;padding:0 14mm;display:flex;justify-content:space-between">' +
      '<span>Quant from First Principles · learn.krisarj.com · ' + L.title + '</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>';
    await notes.pdf({ path: path.join(PUBLIC, "downloads", L.slug + "-notes.pdf"), format: "A4", printBackground: true,
      margin: { top: "14mm", bottom: "16mm", left: "14mm", right: "14mm" }, displayHeaderFooter: true, headerTemplate: "<span></span>", footerTemplate: foot });
    console.log("  pdf  ", L.slug + "-notes.pdf");
    await notes.close();

    // 2. Slides page (after the images exist)
    const slides = await open(browser, L.slides, { width: 1080, height: 1350 });
    // every slide's content must end above its footer
    const over = await slides.evaluate(() => [...document.querySelectorAll(".slide")].map((s, i) => {
      const limit = s.getBoundingClientRect().bottom - 120;
      const low = Math.max(...[...s.children].filter((c) => !c.classList.contains("foot")).map((c) => c.getBoundingClientRect().bottom));
      return low > limit ? "slide " + (i + 1) + " overflows by " + Math.round(low - limit) + "px" : null;
    }).filter(Boolean));
    if (over.length) throw new Error(L.slides + ": " + over.join(", "));
    await slides.pdf({ path: path.join(PUBLIC, "downloads", L.slug + "-slides.pdf"), width: "1080px", height: "1350px", printBackground: true, preferCSSPageSize: true });
    console.log("  pdf  ", L.slug + "-slides.pdf");
    await slides.close();
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
