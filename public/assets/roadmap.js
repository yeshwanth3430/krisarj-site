// Roadmap tab: subject dependency map + one branching roadmap per subject.
// Data lives here; the page only needs <div id="roadmap-root"></div>.
(function () {
  "use strict";

  // status: "live" (published, linked), "next" (being written), "soon" (planned)
  var SUBJECTS = [
    { id: "la", n: "01", name: "Linear Algebra", tag: "Portfolios as vectors, hedges as equations", state: "now", col: 0, row: 0,
      about: "Vectors, matrices, elimination, vector spaces, orthogonality, determinants, eigenvalues and the SVD. The language every portfolio, hedge and factor model is written in.",
      groups: [
        { name: "Solving equations", topics: [
          ["Vectors & linear equations", "mixing products into a payoff", "live", "linear-algebra/topic-01.html"],
          ["Elimination, A = LU & permutations", "solving for the lots", "live", "linear-algebra/topic-02.html"],
          ["Inverses & transposes", "one recipe for every payoff", "live", "linear-algebra/topic-03.html"] ] },
        { name: "The four subspaces", topics: [
          ["Vector spaces, column space & nullspace", "what you can build, what is free", "live", "linear-algebra/topic-04.html"],
          ["Independence, rank & the four subspaces", "is the market complete?", "next"],
          ["Graphs & networks", "price loops and arbitrage", "soon"] ] },
        { name: "Geometry & fitting", topics: [
          ["Orthogonality & projections", "the best possible hedge", "soon"],
          ["Least squares & Gram–Schmidt", "beta and clean factors", "soon"],
          ["Determinants & Cramer's rule", "redundant products, exact lots", "soon"] ] },
        { name: "Eigenvalues & beyond", topics: [
          ["Eigenvalues, diagonalization & powers", "where risk sits, compounding", "soon"],
          ["ODEs, Markov chains & Fourier", "mean reversion, regimes, seasonality", "soon"],
          ["Positive definite matrices & minima", "valid covariance, optimal portfolios", "soon"],
          ["Complex matrices, FFT & Jordan form", "cycles in prices", "soon"],
          ["SVD & linear transformations", "factor models", "soon"],
          ["Change of basis & pseudoinverse", "hedging with spare products", "soon"] ] }
      ] },
    { id: "svc", n: "02", name: "Single Variable Calculus", tag: "How a price changes", state: "later", col: 0, row: 1,
      about: "Limits, derivatives, integrals, series and Taylor expansions: the base toolkit for pricing, sensitivities and compounding.",
      groups: [
        { name: "Change", topics: [
          ["Limits & continuity", "what 'instant' means", "soon"],
          ["Derivatives & their rules", "delta as a rate of change", "soon"],
          ["Using derivatives", "max/min, rates, linear approximation", "soon"] ] },
        { name: "Accumulation", topics: [
          ["Integrals & the fundamental theorem", "adding up tiny changes", "soon"],
          ["Exponentials & logarithms", "continuous compounding, log returns", "soon"],
          ["Integration techniques", "areas under payoff curves", "soon"] ] },
        { name: "Approximation", topics: [
          ["Series & convergence", "when infinite sums settle", "soon"],
          ["Taylor series", "P&L for a small Nifty move: delta + gamma", "soon"] ] }
      ] },
    { id: "mvc", n: "03", name: "Multivariable Calculus", tag: "Many inputs at once", state: "later", col: 1, row: 0,
      about: "Partial derivatives, gradients, Lagrange multipliers, multiple integrals and vector calculus: optimisation when a price depends on many things.",
      groups: [
        { name: "Many inputs", topics: [
          ["Functions of several variables", "premium as a surface over spot and vol", "soon"],
          ["Partial derivatives & gradients", "every Greek on its own", "soon"],
          ["The chain rule", "how risk flows through a model", "soon"] ] },
        { name: "Optimisation", topics: [
          ["Maxima & minima", "the best mix of products", "soon"],
          ["Lagrange multipliers", "best portfolio under a budget", "soon"] ] },
        { name: "Integrals & fields", topics: [
          ["Double & triple integrals", "probabilities over regions", "soon"],
          ["Line integrals & Green's theorem", "path-dependent quantities", "soon"],
          ["Divergence & Stokes", "the vector-calculus finale", "soon"] ] }
      ] },
    { id: "pr", n: "04", name: "Probability", tag: "Uncertainty and expected payoffs", state: "later", col: 1, row: 1,
      about: "Random variables, distributions, expectation, conditioning and limit theorems: the core of every quant model.",
      groups: [
        { name: "Foundations", topics: [
          ["Counting & probability rules", "how likely is a move?", "soon"],
          ["Conditioning & Bayes", "updating on new information", "soon"],
          ["Random variables", "a payoff that depends on chance", "soon"] ] },
        { name: "Distributions", topics: [
          ["Binomial & Poisson", "up/down steps, rare jumps", "soon"],
          ["Normal & lognormal", "returns and prices", "soon"],
          ["Joint distributions & covariance", "how Nifty and BankNifty move together", "soon"] ] },
        { name: "Limits & inference", topics: [
          ["Expectation & variance", "fair value and risk", "soon"],
          ["Law of large numbers & CLT", "why averages are reliable", "soon"],
          ["Estimation & confidence", "trusting a backtest", "soon"] ] }
      ] },
    { id: "de", n: "05", name: "Differential Equations", tag: "Change over time", state: "later", col: 1, row: 2,
      about: "First and second order ODEs, systems, Laplace transforms, and the road to the PDEs behind option pricing.",
      groups: [
        { name: "First order", topics: [
          ["Growth & decay", "compounding and discounting", "soon"],
          ["Linear first-order equations", "mean reversion and half-life", "soon"] ] },
        { name: "Second order & systems", topics: [
          ["Oscillations & damping", "a basis that overshoots and settles", "soon"],
          ["Systems & e^(At)", "several quantities moving together", "soon"],
          ["Laplace transforms", "solving with a change of view", "soon"] ] },
        { name: "Towards PDEs", topics: [
          ["The heat equation", "the shape behind Black–Scholes", "soon"] ] }
      ] },
    { id: "fin", n: "06", name: "Maths for Finance", tag: "Where it all comes together", state: "later", col: 2, row: 1,
      about: "Stochastic processes, Itô calculus, Black–Scholes, portfolio theory and time series: the payoff of every stage before.",
      groups: [
        { name: "Randomness in time", topics: [
          ["Random walks & Brownian motion", "price paths", "soon"],
          ["Itô calculus", "calculus for random paths", "soon"] ] },
        { name: "Pricing", topics: [
          ["Binomial trees & risk-neutral pricing", "pricing without forecasting", "soon"],
          ["Black–Scholes & the Greeks", "pricing Nifty options", "soon"] ] },
        { name: "Portfolios & data", topics: [
          ["Mean-variance portfolios", "the best risk/return mix", "soon"],
          ["Factor models & PCA", "what really drives returns", "soon"],
          ["Time series & volatility", "modelling and testing on data", "soon"] ] }
      ] }
  ];
  // which subject builds on which (arrows in the main map)
  var EDGES = [["la", "mvc"], ["svc", "mvc"], ["svc", "pr"], ["la", "de"], ["svc", "de"], ["mvc", "fin"], ["pr", "fin"], ["de", "fin"], ["la", "pr"]];

  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;"); }
  function count(s) { var all = 0, live = 0; s.groups.forEach(function (g) { g.topics.forEach(function (t) { all++; if (t[2] === "live") live++; }); }); return { all: all, live: live }; }
  var STATE_TXT = { now: "In progress", later: "Later" };
  var TOPIC_TXT = { live: "Live", next: "Next up", soon: "Planned" };

  function mapHTML() {
    var cols = [0, 1, 2].map(function (c) {
      var items = SUBJECTS.filter(function (s) { return s.col === c; }).sort(function (a, b) { return a.row - b.row; });
      return '<div class="rmm-col">' + items.map(function (s) {
        var k = count(s), pct = Math.round(100 * k.live / k.all);
        return '<a class="rmm-node rmm-' + s.state + '" href="#rm-' + s.id + '" data-id="' + s.id + '">' +
          '<span class="rmm-n">' + s.n + '</span>' +
          '<span class="rmm-body"><span class="rmm-name">' + esc(s.name) + '</span><span class="rmm-tag">' + esc(s.tag) + '</span>' +
          '<span class="rmm-bar"><i style="--w:' + pct + '%"></i></span>' +
          '<span class="rmm-meta">' + STATE_TXT[s.state] + ' · ' + k.live + ' / ' + k.all + ' topics live</span></span></a>';
      }).join("") + '</div>';
    }).join("");
    return '<div class="rmm" id="rmm"><svg class="rmm-edges" aria-hidden="true"><defs><marker id="rmm-ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="currentColor"/></marker></defs></svg>' + cols + '</div>' +
      '<div class="rmm-legend"><span><i class="lg-now"></i>In progress</span><span><i class="lg-later"></i>Later</span><span><i class="lg-edge"></i>builds on</span><span class="rmm-hint">Click a subject to jump to its roadmap</span></div>';
  }

  function subjectHTML(s) {
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
    return '<section class="rms" id="rm-' + s.id + '" data-id="' + s.id + '">' +
      '<header class="rms-head rv">' + ring + '<div><div class="rms-k">Stage ' + s.n + ' · ' + STATE_TXT[s.state] + '</div><h2 class="rms-title">' + esc(s.name) + '</h2><p class="rms-about">' + esc(s.about) + '</p>' +
      (s.state === "later" ? '<p class="rms-note">Planned outline; topics may be adjusted when this subject starts.</p>' : '') + '</div></header>' +
      '<div class="rms-tree"><div class="rms-trunk"><i></i></div>' + groups + '<div class="rms-end rv">' + (s.id === "fin" ? 'Destination: price, hedge and manage risk on Nifty options from first principles' : 'Next stage → ' + esc(SUBJECTS[SUBJECTS.indexOf(s) + 1].name)) + '</div></div></section>';
  }

  function build(root) {
    root.innerHTML =
      '<div class="rm-intro rv"><h2 id="rm-map" style="margin-top:8px">The big picture</h2><p>Six subjects. The map shows the order and what each subject builds on; every subject then has its own roadmap of topics below.</p></div>' +
      mapHTML() +
      '<nav class="rm-chips" aria-label="Subject roadmaps">' + SUBJECTS.map(function (s) { return '<a href="#rm-' + s.id + '" data-id="' + s.id + '"><b>' + s.n + '</b> ' + esc(s.name) + '</a>'; }).join("") + '</nav>' +
      SUBJECTS.map(subjectHTML).join("");
  }

  // ---- draw the map's arrows between node edges (works for column and stacked layouts) ----
  function drawEdges() {
    var box = document.getElementById("rmm"); if (!box || !box.offsetWidth) return;
    var svg = box.querySelector(".rmm-edges"), b = box.getBoundingClientRect();
    svg.setAttribute("width", b.width); svg.setAttribute("height", b.height); svg.setAttribute("viewBox", "0 0 " + b.width + " " + b.height);
    svg.querySelectorAll("path.e").forEach(function (p) { p.remove(); });
    var stacked = getComputedStyle(box).flexDirection === "column";
    var list = stacked ? SUBJECTS.slice(1).map(function (t, i) { return [SUBJECTS[i].id, t.id]; }) : EDGES;
    list.forEach(function (e, i) {
      var a = box.querySelector('[data-id="' + e[0] + '"]').getBoundingClientRect(), c = box.querySelector('[data-id="' + e[1] + '"]').getBoundingClientRect(), d;
      if (!stacked) {
        var x1 = a.right - b.left, y1 = a.top + a.height / 2 - b.top, x2 = c.left - b.left - 4, y2 = c.top + c.height / 2 - b.top, m = (x1 + x2) / 2;
        d = "M" + x1 + " " + y1 + " C " + m + " " + y1 + ", " + m + " " + y2 + ", " + x2 + " " + y2;
      } else {
        var off = 0;
        var sx = a.left + a.width / 2 + off - b.left, sy = a.bottom - b.top, ex = c.left + c.width / 2 + off - b.left, ey = c.top - b.top - 4, my = (sy + ey) / 2;
        d = "M" + sx + " " + sy + " C " + sx + " " + my + ", " + ex + " " + my + ", " + ex + " " + ey;
      }
      var p = document.createElementNS("http://www.w3.org/2000/svg", "path");
      p.setAttribute("d", d); p.setAttribute("class", "e" + (e[0] === "la" ? " e-now" : "")); p.setAttribute("marker-end", "url(#rmm-ar)");
      p.style.animationDelay = (i * 0.08) + "s";
      svg.appendChild(p);
    });
  }

  // ---- scroll effects: reveal, trunk fill, active chip ----
  function effects(root) {
    var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    var rv = root.querySelectorAll(".rv, .rms-ring, .rmm");
    if (reduce || !("IntersectionObserver" in window)) rv.forEach(function (el) { el.classList.add("in"); });
    else {
      var io = new IntersectionObserver(function (es) { es.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } }); }, { rootMargin: "0px 0px -8% 0px" });
      rv.forEach(function (el) { io.observe(el); });
    }
    var chips = root.querySelectorAll(".rm-chips a"), secs = root.querySelectorAll(".rms"), ticking = false;
    function onScroll() {
      ticking = false;
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
    onScroll();
  }

  function mount() {
    var root = document.getElementById("roadmap-root"); if (!root) return;
    build(root);
    effects(root);
    var box = document.getElementById("rmm");
    if (window.ResizeObserver) new ResizeObserver(drawEdges).observe(box); else window.addEventListener("resize", drawEdges);
    document.querySelectorAll('[data-tab="roadmap"]').forEach(function (b) { b.addEventListener("click", function () { setTimeout(drawEdges, 30); }); });
    // smooth scroll for in-roadmap links (map nodes + chips)
    root.addEventListener("click", function (ev) {
      var a = ev.target.closest('a[href^="#rm-"]'); if (!a) return;
      var t = document.getElementById(a.getAttribute("href").slice(1)); if (!t) return;
      ev.preventDefault(); history.replaceState(null, "", a.getAttribute("href"));
      t.scrollIntoView({ behavior: "smooth", block: "start" });
      t.classList.remove("flash"); void t.offsetWidth; t.classList.add("flash");
    });
    setTimeout(drawEdges, 50);
    // a shared link like #rm-la opens the Roadmap tab and scrolls to that subject
    var h = location.hash;
    if (/^#rm-/.test(h)) {
      var tb = document.querySelector('.tabs [data-tab="roadmap"]'); if (tb) tb.click();
      history.replaceState(null, "", h);
      setTimeout(function () { var t = document.getElementById(h.slice(1)); if (t) t.scrollIntoView({ block: "start" }); drawEdges(); }, 80);
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount); else mount();
})();
