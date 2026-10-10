// Equity Research tab: one branching roadmap per stage, in the same style as the maths roadmap.
// Data lives here; the page only needs <div id="er-root"></div>.
(function () {
  "use strict";

  // status: "live" (published, linked), "next" (being written), "soon" (planned)
  var STAGES = [
    { id: "found", n: "01", name: "Research Foundations", tag: "How an analyst thinks, and where the facts are",
      about: "The research process from a question to an investment view, the habits of a good analyst, and the primary sources every view must rest on: annual reports, earnings calls and shareholding data.",
      groups: [
        { name: "How research works", topics: [
          ["The research process", "from a question to an investment view", "soon"],
          ["The analyst mindset", "scepticism, patience, writing things down", "soon"] ] },
        { name: "Primary sources", topics: [
          ["Reading annual reports", "where the real disclosures sit", "soon"],
          ["Reading earnings calls", "what management says, and what it avoids", "soon"],
          ["Following smart money", "shareholding patterns and large deals", "soon"] ] },
        { name: "Tools", topics: [
          ["Research tools & data sources", "screeners, filings, exchange data", "soon"],
          ["AI in research", "faster reading, careful checking", "soon"] ] }
      ] },
    { id: "mgmt", n: "02", name: "Management & Governance", tag: "Who runs the company, and can you trust them?",
      about: "Governance from first principles, then the failures that taught the market its lessons, then a repeatable checklist for judging management, applied to a real listed company.",
      groups: [
        { name: "Governance foundations", topics: [
          ["Governance basics", "boards, promoters, related parties", "soon"],
          ["Governance failures", "case studies of what went wrong", "soon"] ] },
        { name: "Judging management", topics: [
          ["Earnings-call analysis", "tracking promises against delivery", "soon"],
          ["A management checklist", "a repeatable scorecard", "soon"],
          ["Applying it to a listed company", "a full worked walkthrough", "soon"] ] }
      ] },
    { id: "fsa", n: "03", name: "Financial Statement Analysis", tag: "The three statements, line by line",
      about: "The income statement from revenue to profit after tax, the balance sheet from equity to working capital, and the cash flow statement that shows whether profit becomes cash.",
      groups: [
        { name: "Income statement", topics: [
          ["Revenue", "volume, price and mix", "soon"],
          ["Costs & margins", "cost of goods, gross and operating margin", "soon"],
          ["SG&A, EBITDA & depreciation", "from operating profit to cash earnings", "soon"],
          ["Interest, tax & PAT", "down to the bottom line", "soon"] ] },
        { name: "Balance sheet", topics: [
          ["Equity & liabilities", "how the business is funded", "soon"],
          ["Deferred tax", "DTA and DTL in plain words", "soon"],
          ["Fixed & intangible assets", "what the company owns", "soon"],
          ["Inventory & receivables", "working capital that ties up cash", "soon"] ] },
        { name: "Cash & context", topics: [
          ["The cash flow statement", "profit vs cash", "soon"],
          ["Economic indicators", "the macro backdrop behind revenue", "soon"] ] }
      ] },
    { id: "ratio", n: "04", name: "Ratio Analysis", tag: "Statements turned into comparable numbers",
      about: "Profitability, activity and solvency ratios, then the return-on-capital family (ROCE, ROIC, ROE, ROIIC) that separates good businesses from busy ones.",
      groups: [
        { name: "Profitability & efficiency", topics: [
          ["Profitability ratios", "margins and returns", "soon"],
          ["Activity ratios", "inventory, receivable and asset turns", "soon"] ] },
        { name: "Risk", topics: [
          ["Solvency ratios", "leverage and interest cover", "soon"] ] },
        { name: "Returns on capital", topics: [
          ["ROCE & ROIC", "return on the capital employed", "soon"],
          ["ROE & DuPont", "what drives shareholder returns", "soon"],
          ["ROIIC", "returns on new investment", "soon"] ] }
      ] },
    { id: "sector", n: "05", name: "Sector Analysis", tag: "Every industry has its own rules",
      about: "How to read an industry's structure and economics, and the key numbers that matter sector by sector, with deep dives into consumer businesses and banking.",
      groups: [
        { name: "Frameworks", topics: [
          ["Industry structure", "competition, bargaining power, cycles", "soon"],
          ["A sector analysis framework", "drivers, KPIs, risks", "soon"] ] },
        { name: "Deep dives", topics: [
          ["Consumer: quick-service restaurants", "store-level economics", "soon"],
          ["Banking", "margins, asset quality, capital", "soon"] ] }
      ] },
    { id: "forensic", n: "06", name: "Forensic Accounting", tag: "Red flags before the market sees them",
      about: "Where reported numbers get bent (revenue, depreciation, earnings quality), how working capital and cash flows give the game away, and real collapses worked through step by step.",
      groups: [
        { name: "Where numbers bend", topics: [
          ["Revenue recognition", "too good to be true", "soon"],
          ["Depreciation & earnings quality", "accounting choices that flatter profit", "soon"] ] },
        { name: "Working capital & cash", topics: [
          ["Receivables", "sales that don't turn into cash", "soon"],
          ["Inventory & payables", "stretching the cycle", "soon"],
          ["Cash flow red flags", "profit without cash", "soon"] ] },
        { name: "Case studies", topics: [
          ["Forensic case studies", "real collapses, step by step", "soon"] ] }
      ] },
    { id: "val", n: "07", name: "Valuation", tag: "What is the business worth?",
      about: "Intrinsic value from discounted cash flows and the cost of capital, then relative value from multiples and peer sets: the bridge from analysis to a price target.",
      groups: [
        { name: "Intrinsic value", topics: [
          ["Valuation foundations", "cash flows, risk and time", "soon"],
          ["Discounted cash flow (DCF)", "building the model", "soon"],
          ["Cost of capital", "WACC and the discount rate", "soon"] ] },
        { name: "Relative value", topics: [
          ["Multiples & peer sets", "P/E, EV/EBITDA, comparables", "soon"],
          ["Growth-adjusted multiples", "PEG: price against growth", "soon"] ] }
      ] },
    { id: "ipo", n: "08", name: "IPO Analysis", tag: "Reading a new listing",
      about: "How to read an offer document, judge what is really being sold, and value a new listing against its listed peers, with recent IPOs worked through.",
      groups: [
        { name: "New listings", topics: [
          ["Reading the offer document", "DRHP and RHP: what's really on sale", "soon"],
          ["Pricing an IPO", "valuation against listed peers", "soon"],
          ["IPO case studies", "recent listings, worked through", "soon"] ] }
      ] },
    { id: "report", n: "09", name: "Report Writing & Presentation", tag: "From research to a recommendation",
      about: "Turning everything before into a clear research report and presentation: the thesis, the evidence, the risks and the target, and how to pitch it.",
      groups: [
        { name: "Communicating research", topics: [
          ["Writing a research report", "thesis, evidence, risks, target", "soon"],
          ["Building the presentation", "clear, honest slides", "soon"],
          ["The stock pitch", "presenting and defending a view", "soon"] ] }
      ] }
  ];

  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;"); }
  function count(s) { var all = 0, live = 0; s.groups.forEach(function (g) { g.topics.forEach(function (t) { all++; if (t[2] === "live") live++; }); }); return { all: all, live: live }; }
  var TOPIC_TXT = { live: "Live", next: "Next up", soon: "Planned" };

  function stageHTML(s, i) {
    var k = count(s), pct = k.live / k.all, R = 26, C = 2 * Math.PI * R;
    var ring = '<svg class="rms-ring" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="' + R + '" class="rr-bg"/><circle cx="32" cy="32" r="' + R + '" class="rr-fg" style="stroke-dasharray:' + C.toFixed(1) + ';--off:' + (C * (1 - pct)).toFixed(1) + ';stroke-dashoffset:' + C.toFixed(1) + '"/><text x="32" y="37" text-anchor="middle">' + Math.round(100 * pct) + '%</text></svg>';
    var side = 0;
    var groups = s.groups.map(function (g, gi) {
      var nodes = g.topics.map(function (t) {
        var inner = '<span class="rmt-name">' + esc(t[0]) + '</span><span class="rmt-why">' + esc(t[1]) + '</span><span class="rmt-st">' + TOPIC_TXT[t[2]] + '</span>';
        var cls = 'rmt rmt-' + t[2] + ' rv ' + (side++ % 2 ? 'rmt-r' : 'rmt-l');
        return t[3] ? '<a class="' + cls + '" href="' + t[3] + '"><i class="rmt-dot"></i>' + inner + '</a>' : '<div class="' + cls + '"><i class="rmt-dot"></i>' + inner + '</div>';
      }).join("");
      return '<div class="rmg"><div class="rmg-head rv"><span class="rmg-k">Branch ' + (gi + 1) + '</span>' + esc(g.name) + '</div>' + nodes + '</div>';
    }).join("");
    var next = STAGES[i + 1];
    return '<section class="rms" id="er-' + s.id + '" data-id="' + s.id + '">' +
      '<header class="rms-head rv">' + ring + '<div><div class="rms-k">Stage ' + s.n + ' · Planned</div><h2 class="rms-title">' + esc(s.name) + '</h2><p class="rms-about">' + esc(s.about) + '</p>' +
      '<p class="rms-note">Planned outline; topics may be adjusted when this stage starts.</p></div></header>' +
      '<div class="rms-tree"><div class="rms-trunk"><i></i></div>' + groups + '<div class="rms-end rv">' +
      (next ? 'Next stage → ' + esc(next.name) : 'Destination: a complete, defensible research report on a listed company') + '</div></div></section>';
  }

  function build(root) {
    var all = STAGES.reduce(function (a, s) { return a + count(s).all; }, 0);
    root.innerHTML =
      '<div class="rm-intro rv"><h2 id="er-map" style="margin-top:8px">The research path</h2>' +
      '<p>Nine stages, ' + all + ' topics, from how an analyst thinks to a finished research report. Each stage builds on the ones before; the maths from Mathematics for Finance (ratios, growth, discounting, statistics) shows up throughout.</p></div>' +
      '<nav class="rm-chips" aria-label="Equity research stages">' + STAGES.map(function (s) { return '<a href="#er-' + s.id + '" data-id="' + s.id + '"><b>' + s.n + '</b> ' + esc(s.name) + '</a>'; }).join("") + '</nav>' +
      STAGES.map(stageHTML).join("");
  }

  // ---- scroll effects: reveal, trunk fill, active chip (same as the maths roadmap) ----
  function effects(root) {
    var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    var rv = root.querySelectorAll(".rv, .rms-ring");
    if (reduce || !("IntersectionObserver" in window)) rv.forEach(function (el) { el.classList.add("in"); });
    else {
      var io = new IntersectionObserver(function (es) { es.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } }); }, { rootMargin: "0px 0px -8% 0px" });
      rv.forEach(function (el) { io.observe(el); });
    }
    var chips = root.querySelectorAll(".rm-chips a"), secs = root.querySelectorAll(".rms"), ticking = false;
    function onScroll() {
      ticking = false;
      if (root.closest(".tab-panel") && root.closest(".tab-panel").hidden) return;
      var vh = window.innerHeight, active = null;
      secs.forEach(function (s) {
        var r = s.getBoundingClientRect(), tree = s.querySelector(".rms-tree").getBoundingClientRect();
        var f = Math.max(0, Math.min(1, (vh * 0.65 - tree.top) / Math.max(1, tree.height)));
        s.querySelector(".rms-trunk i").style.height = (f * 100) + "%";
        if (r.top < vh * 0.4 && r.bottom > vh * 0.4) active = s.dataset.id;
      });
      chips.forEach(function (c) { c.classList.toggle("on", c.dataset.id === active); });
    }
    window.addEventListener("scroll", function () { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
    document.querySelectorAll('[data-tab="er"]').forEach(function (b) { b.addEventListener("click", function () { setTimeout(onScroll, 30); }); });
    onScroll();
  }

  function mount() {
    var root = document.getElementById("er-root"); if (!root) return;
    build(root);
    effects(root);
    root.addEventListener("click", function (ev) {
      var a = ev.target.closest('a[href^="#er-"]'); if (!a) return;
      var t = document.getElementById(a.getAttribute("href").slice(1)); if (!t) return;
      ev.preventDefault(); history.replaceState(null, "", a.getAttribute("href"));
      t.scrollIntoView({ behavior: "smooth", block: "start" });
      t.classList.remove("flash"); void t.offsetWidth; t.classList.add("flash");
    });
    // a shared link like #er-val opens the Equity Research tab and scrolls to that stage
    var h = location.hash;
    if (/^#er-/.test(h)) {
      var tb = document.querySelector('.tabs [data-tab="er"]'); if (tb) tb.click();
      history.replaceState(null, "", h);
      setTimeout(function () { var t = document.getElementById(h.slice(1)); if (t) t.scrollIntoView({ block: "start" }); }, 80);
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount); else mount();
})();
