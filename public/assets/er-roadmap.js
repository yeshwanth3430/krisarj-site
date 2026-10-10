// Equity Research tab: one branching roadmap per stage, in the same style as the maths roadmap.
// Data lives here; the page only needs <div id="er-root"></div>.
(function () {
  "use strict";

  // status: "live" (published, linked), "next" (being written), "soon" (planned)
  var STAGES = [
    { id: "mgmt", n: "01", name: "Management & Governance", tag: "Who runs the company, and can you trust them?",
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
    { id: "fsa", n: "02", name: "Financial Statement Analysis", tag: "The three statements, line by line",
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
    { id: "ratio", n: "03", name: "Ratio Analysis", tag: "Statements turned into comparable numbers",
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
    { id: "sector", n: "04", name: "Sector Analysis", tag: "Every industry has its own rules",
      about: "How to read an industry's structure and economics, and the key numbers that matter sector by sector, with deep dives into consumer businesses and banking.",
      groups: [
        { name: "Frameworks", topics: [
          ["Industry structure", "competition, bargaining power, cycles", "soon"],
          ["A sector analysis framework", "drivers, KPIs, risks", "soon"] ] },
        { name: "Deep dives", topics: [
          ["Consumer: quick-service restaurants", "store-level economics", "soon"],
          ["Banking", "margins, asset quality, capital", "soon"] ] }
      ] },
    { id: "forensic", n: "05", name: "Forensic Accounting", tag: "Red flags before the market sees them",
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
    { id: "val", n: "06", name: "Valuation", tag: "What is the business worth?",
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
    { id: "ipo", n: "07", name: "IPO Analysis", tag: "Reading a new listing",
      about: "How to read an offer document, judge what is really being sold, and value a new listing against its listed peers, with recent IPOs worked through.",
      groups: [
        { name: "New listings", topics: [
          ["Reading the offer document", "DRHP and RHP: what's really on sale", "soon"],
          ["Pricing an IPO", "valuation against listed peers", "soon"],
          ["IPO case studies", "recent listings, worked through", "soon"] ] }
      ] },
    { id: "report", n: "08", name: "Report Writing & Presentation", tag: "From research to a recommendation",
      about: "Turning everything before into a clear research report and presentation: the thesis, the evidence, the risks and the target, and how to pitch it.",
      groups: [
        { name: "Communicating research", topics: [
          ["Writing a research report", "thesis, evidence, risks, target", "soon"],
          ["Building the presentation", "clear, honest slides", "soon"],
          ["The stock pitch", "presenting and defending a view", "soon"] ] }
      ] }
  ];

  // simple line icons (24 × 24, stroke) for each stage
  var ICON = {
    mgmt: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z M9 12l2 2 4-4",
    fsa: "M6 3h9l4 4v14H6z M15 3v4h4 M9 12h7 M9 16h7",
    ratio: "M5 19L19 5 M5 7a2 2 0 1 0 4 0a2 2 0 1 0-4 0 M15 17a2 2 0 1 0 4 0a2 2 0 1 0-4 0",
    sector: "M4 20V11 M10 20V5 M16 20v-8 M21 20H3",
    forensic: "M4 11a7 7 0 1 0 14 0a7 7 0 1 0-14 0 M21 21l-5-5",
    val: "M12 3v18 M5 7h14 M2 13l3-6 3 6a3 3 0 0 1-6 0z M16 13l3-6 3 6a3 3 0 0 1-6 0z",
    ipo: "M6 16v-5a6 6 0 0 1 12 0v5l2 2H4z M10 21h4",
    report: "M5 21V4 M5 4h11l-2 4 2 4H5"
  };
  var PHASES = [
    { name: "Phase 1 · Learn the craft", cls: "p1" },
    { name: "Phase 2 · Go deeper", cls: "p2" },
    { name: "Phase 3 · Price it & pitch it", cls: "p3" }
  ];
  var SVGNS = "http://www.w3.org/2000/svg";

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
    var branches = STAGES.reduce(function (a, s) { return a + s.groups.length; }, 0);
    root.innerHTML =
      '<div class="rm-intro rv"><h2 id="er-map" style="margin-top:8px">The research journey</h2>' +
      '<p>From judging management to a finished research report. Follow the road: every stop is a stage, every stage builds on the ones before, and the maths from Mathematics for Finance (ratios, growth, discounting, statistics) rides along the whole way.</p></div>' +
      '<div class="erj-stats">' +
        [[STAGES.length, "stages"], [branches, "branches"], [all, "topics"], [1, "finished report"]].map(function (x) {
          return '<div class="erj-stat"><b data-to="' + x[0] + '">0</b><span>' + x[1] + "</span></div>";
        }).join("") + "</div>" +
      '<div class="erj" id="erj"><svg class="erj-svg" aria-label="Equity research roadmap: nine stages along a road"></svg></div>' +
      '<div class="erj-peek" id="erj-peek"><span class="erj-peek-k">Hover or tap a stop</span><b>Preview a stage here</b><span class="erj-peek-txt">Click a stop to jump straight to its roadmap.</span></div>' +
      '<nav class="rm-chips" aria-label="Equity research stages">' + STAGES.map(function (s) { return '<a href="#er-' + s.id + '" data-id="' + s.id + '"><b>' + s.n + '</b> ' + esc(s.name) + '</a>'; }).join("") + '</nav>' +
      STAGES.map(stageHTML).join("");
  }

  // ---- the journey map: a winding road through the nine stages ----
  function el(tag, attrs, parent) { var e = document.createElementNS(SVGNS, tag); for (var k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; }
  function drawJourney() {
    var box = document.getElementById("erj"); if (!box || !box.offsetWidth) return;
    var svg = box.querySelector(".erj-svg"), W = box.offsetWidth, narrow = W < 720;
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    var pts = [], bands = [], H, d;
    if (!narrow) {
      var mx = 110, rowH = 210, top = 90;
      H = top + 2 * rowH + 120;
      STAGES.forEach(function (s, i) {
        var r = Math.floor(i / 3), c = i % 3; if (r % 2) c = 2 - c;
        pts.push({ x: mx + c * (W - 2 * mx) / 2, y: top + r * rowH, r: r });
      });
      for (var r = 0; r < 3; r++) bands.push({ x: 12, y: top + r * rowH - 62, w: W - 24, h: 150 });
      d = "M " + (mx - 80) + " " + pts[0].y + " L " + pts[0].x + " " + pts[0].y;
      for (var i = 1; i < pts.length; i++) {
        var a = pts[i - 1], b = pts[i];
        if (a.r === b.r) d += " L " + b.x + " " + b.y;
        else { var dir = a.x > W / 2 ? 1 : -1, bx = a.x + dir * 95; d += " C " + bx + " " + a.y + ", " + bx + " " + b.y + ", " + b.x + " " + b.y; }
      }
      var last = pts[pts.length - 1]; d += " L " + (last.x + 70) + " " + last.y;
    } else {
      var x0 = 46, step = 116, top2 = 84;
      H = top2 + (STAGES.length - 1) * step + 90;
      STAGES.forEach(function (s, i) { pts.push({ x: x0, y: top2 + i * step, r: Math.floor(i / 3) }); });
      for (var r2 = 0; r2 < 3; r2++) { var nIn = Math.min(3, STAGES.length - 3 * r2); bands.push({ x: 4, y: top2 + r2 * 3 * step - 62, w: W - 8, h: nIn * step - 10 }); }
      d = "M " + x0 + " " + (top2 - 52);
      pts.forEach(function (p, i) { var w = (i % 2 ? 18 : -18); d += " C " + (x0 + w) + " " + (p.y - step / 2) + ", " + (x0 - w) + " " + (p.y - step / 4) + ", " + p.x + " " + p.y; });
      d += " L " + x0 + " " + (pts[pts.length - 1].y + 52);
    }
    svg.setAttribute("viewBox", "0 0 " + W + " " + H); svg.setAttribute("height", H); svg.setAttribute("width", W);

    var defs = el("defs", {}, svg);
    var g1 = el("linearGradient", { id: "erj-grad", x1: "0", y1: "0", x2: "1", y2: "1" }, defs);
    el("stop", { offset: "0", "class": "erj-s1" }, g1); el("stop", { offset: ".5", "class": "erj-s2" }, g1); el("stop", { offset: "1", "class": "erj-s3" }, g1);
    var glow = el("filter", { id: "erj-glow", x: "-50%", y: "-50%", width: "200%", height: "200%" }, defs);
    el("feGaussianBlur", { stdDeviation: "4", result: "b" }, glow);
    var mg = el("feMerge", {}, glow); el("feMergeNode", { "in": "b" }, mg); el("feMergeNode", { "in": "SourceGraphic" }, mg);

    bands.forEach(function (b, i) {
      el("rect", { x: b.x, y: b.y, width: b.w, height: b.h, rx: 26, "class": "erj-band " + PHASES[i].cls }, svg);
      var right = !narrow && i === 2;   // the road enters band 3 from the left, so put its label on the right
      var t = el("text", { x: narrow ? 110 : (right ? b.x + b.w - 20 : b.x + 20), y: b.y + (narrow ? 20 : 24), "text-anchor": right ? "end" : "start", "class": "erj-phase " + PHASES[i].cls }, svg); t.textContent = PHASES[i].name;
    });

    el("path", { d: d, "class": "erj-road-bed" }, svg);
    var road = el("path", { d: d, id: "erj-path", "class": "erj-road" }, svg);
    var done = el("path", { d: d, "class": "erj-done" }, svg);
    el("path", { d: d, "class": "erj-lane" }, svg);
    var len = road.getTotalLength();
    road.style.strokeDasharray = len; road.style.strokeDashoffset = box.classList.contains("in") ? 0 : len;
    done.style.strokeDasharray = len; done.style.strokeDashoffset = len; done.dataset.len = len;

    // start pin and finish flag
    var start = road.getPointAtLength(0), end = road.getPointAtLength(len);
    var sp = el("g", { "class": "erj-start", transform: "translate(" + start.x + " " + start.y + ")" }, svg);
    el("circle", { r: 9 }, sp); var st = el("text", { y: narrow ? -16 : 30, "text-anchor": "middle" }, sp); st.textContent = "START";
    var fl = el("g", { "class": "erj-flag", transform: "translate(" + end.x + " " + end.y + ")" }, svg);
    el("path", { d: "M0 0 V-38 M0 -38 h22 l-6 7 6 7 H0" }, fl);
    var ft = el("text", { x: narrow ? 30 : 0, y: narrow ? -14 : 24, "text-anchor": narrow ? "start" : "middle" }, fl); ft.textContent = "YOUR REPORT";

    // the traveller
    var run = el("g", { "class": "erj-runner" }, svg);
    el("circle", { r: 11, "class": "erj-runner-halo" }, run); el("circle", { r: 6, "class": "erj-runner-dot" }, run);
    var am = el("animateMotion", { dur: "16s", repeatCount: "indefinite", rotate: "auto", calcMode: "linear" }, run);
    var mp = el("mpath", {}, am); mp.setAttribute("href", "#erj-path"); mp.setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", "#erj-path");

    // the stops
    pts.forEach(function (p, i) {
      var s = STAGES[i], k = count(s);
      var a = el("a", { href: "#er-" + s.id, "class": "erj-stop " + PHASES[p.r].cls, "data-id": s.id, style: "--i:" + i, tabindex: "0" }, svg);
      a.setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", "#er-" + s.id);
      var g = el("g", { transform: "translate(" + p.x + " " + p.y + ")" }, a);
      var inner = el("g", { "class": "erj-pop" }, g);
      el("circle", { r: 40, "class": "erj-ring" }, inner);
      el("circle", { r: 31, "class": "erj-disc" }, inner);
      el("path", { d: ICON[s.id], transform: "translate(-12 -15)", "class": "erj-ico" }, inner);
      var num = el("text", { y: 22, "text-anchor": "middle", "class": "erj-num" }, inner); num.textContent = s.n;
      var lx = narrow ? 56 : 0, ly = narrow ? -6 : 62, anchor = narrow ? "start" : "middle";
      var n1 = el("text", { x: lx, y: ly, "text-anchor": anchor, "class": "erj-name" }, g); n1.textContent = s.name;
      var n2 = el("text", { x: lx, y: ly + 18, "text-anchor": anchor, "class": "erj-meta" }, g); n2.textContent = s.groups.length + (s.groups.length === 1 ? " branch · " : " branches · ") + k.all + " topics";
      if (narrow && W >= 520) { var n3 = el("text", { x: lx, y: ly + 36, "class": "erj-tag" }, g); n3.textContent = s.tag; }
      var tt = el("title", {}, a); tt.textContent = s.name + ": " + s.tag;
      a.addEventListener("mouseenter", function () { peek(s); }); a.addEventListener("focus", function () { peek(s); });
    });
    box.classList.add("drawn");
    updateDone();
  }
  function peek(s) {
    var pk = document.getElementById("erj-peek"); if (!pk) return; var k = count(s);
    pk.innerHTML = '<span class="erj-peek-k">Stage ' + s.n + " · " + s.groups.length + (s.groups.length === 1 ? " branch · " : " branches · ") + k.all + " topics</span><b>" + esc(s.name) + '</b><span class="erj-peek-txt">' + esc(s.tag) + '</span><span class="erj-peek-br">' +
      s.groups.map(function (g) { return "<i>" + esc(g.name) + "</i>"; }).join("") + "</span>";
    pk.classList.remove("pulse"); void pk.offsetWidth; pk.classList.add("pulse");
    document.querySelectorAll(".erj-stop").forEach(function (a) { a.classList.toggle("hot", a.getAttribute("data-id") === s.id); });
  }
  // road fills in as you scroll through the stage roadmaps; passed stops light up
  function updateDone() {
    var done = document.querySelector("#erj .erj-done"); if (!done) return;
    var secs = document.querySelectorAll("#er-root .rms"); if (!secs.length) return;
    var vh = window.innerHeight, first = secs[0].getBoundingClientRect(), last = secs[secs.length - 1].getBoundingClientRect();
    var f = Math.max(0, Math.min(1, (vh * 0.5 - first.top) / Math.max(1, last.bottom - first.top)));
    var len = +done.dataset.len; done.style.strokeDashoffset = len * (1 - f);
    secs.forEach(function (sec) {
      var reached = sec.getBoundingClientRect().top < vh * 0.5;
      var stop = document.querySelector('.erj-stop[data-id="' + sec.dataset.id + '"]'); if (stop) stop.classList.toggle("reached", reached);
    });
  }
  function countUp() {
    document.querySelectorAll(".erj-stat b").forEach(function (b) {
      var to = +b.dataset.to, t0 = null;
      function step(ts) { if (!t0) t0 = ts; var f = Math.min(1, (ts - t0) / 1100); b.textContent = Math.round(to * (1 - Math.pow(1 - f, 3))); if (f < 1) requestAnimationFrame(step); }
      requestAnimationFrame(step);
    });
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
      updateDone();
    }
    window.addEventListener("scroll", function () { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
    document.querySelectorAll('[data-tab="er"]').forEach(function (b) { b.addEventListener("click", function () { setTimeout(onScroll, 30); }); });
    onScroll();
  }

  function mount() {
    var root = document.getElementById("er-root"); if (!root) return;
    build(root);
    effects(root);
    var box = document.getElementById("erj"), started = false;
    function reveal() {
      if (started || !box.offsetWidth) return;
      var r = box.getBoundingClientRect(); if (r.top > window.innerHeight || r.bottom < 0) return;
      started = true; drawJourney();
      requestAnimationFrame(function () { box.classList.add("in"); var road = box.querySelector(".erj-road"); if (road) road.style.strokeDashoffset = 0; });
      countUp();
    }
    if (window.ResizeObserver) new ResizeObserver(function () { if (started) drawJourney(); else reveal(); }).observe(box); else window.addEventListener("resize", function () { if (started) drawJourney(); });
    window.addEventListener("scroll", reveal, { passive: true });
    document.querySelectorAll('[data-tab="er"]').forEach(function (b) { b.addEventListener("click", function () { setTimeout(reveal, 40); }); });
    setTimeout(reveal, 60);
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
