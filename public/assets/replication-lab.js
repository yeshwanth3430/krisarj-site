// Options Replication Lab
// Choose expiry levels, products (CE / PE / future / bond) and a target payoff.
// The lab writes the question, builds the payoff table and equations, runs elimination
// step by step (exact fractions), gives the answer in trading words, draws the row and
// column pictures (2D or 3D), prices the target and checks for arbitrage.
(function () {
  "use strict";

  // ---------- exact fractions ----------
  function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { var t = a % b; a = b; b = t; } return a || 1; }
  function Fr(n, d) {
    if (d === undefined) d = 1;
    if (!Number.isInteger(n) || !Number.isInteger(d) || Math.abs(n) > 1e12 || Math.abs(d) > 1e12) {
      this.n = n / d; this.d = 1; this.f = true; return;   // decimal mode (Black-Scholes values)
    }
    if (d < 0) { n = -n; d = -d; }
    var g = gcd(n, d); this.n = n / g; this.d = d / g;
  }
  function fmtDec(v) { var r = +v.toFixed(4); return String(Math.abs(r) < 1e-9 ? 0 : r); }
  Fr.prototype.add = function (o) { return new Fr(this.n * o.d + o.n * this.d, this.d * o.d); };
  Fr.prototype.sub = function (o) { return new Fr(this.n * o.d - o.n * this.d, this.d * o.d); };
  Fr.prototype.mul = function (o) { return new Fr(this.n * o.n, this.d * o.d); };
  Fr.prototype.div = function (o) { return new Fr(this.n * o.d, this.d * o.n); };
  Fr.prototype.neg = function () { return new Fr(-this.n, this.d); };
  Fr.prototype.isZero = function () { return this.f ? Math.abs(this.n) < 1e-9 : this.n === 0; };
  Fr.prototype.num = function () { return this.n / this.d; };
  Fr.prototype.tex = function () {
    if (this.f) return fmtDec(this.n);
    if (this.d === 1) return String(this.n);
    return (this.n < 0 ? "-" : "") + "\\tfrac{" + Math.abs(this.n) + "}{" + this.d + "}";
  };
  Fr.prototype.txt = function () {
    if (this.f) return fmtDec(this.n);
    if (this.d === 1) return String(this.n);
    var dec = +(this.n / this.d).toFixed(3);
    return this.n + "/" + this.d + " (≈ " + dec + ")";
  };
  var ZERO = new Fr(0), ONE = new Fr(1);
  function parseFr(s) {
    s = String(s).trim().replace(/,/g, "");
    if (s === "" || s === "-") return null;
    if (s.indexOf("/") >= 0) {
      var p = s.split("/"); var a = parseInt(p[0], 10), b = parseInt(p[1], 10);
      if (isNaN(a) || isNaN(b) || b === 0) return null; return new Fr(a, b);
    }
    var v = parseFloat(s); if (isNaN(v)) return null;
    var k = (s.split(".")[1] || "").length; var d = Math.pow(10, Math.min(k, 6));
    return new Fr(Math.round(v * d), d);
  }

  // ---------- helpers ----------
  var VARS = ["x", "y", "z"], NAMES = ["A", "B", "C"];
  function fmtLvl(v) { return Number(v).toLocaleString("en-IN"); }
  // rupees for a value in lab units (1 unit = 100 points on 1 quantity), on ONE real lot of `lot` quantities
  function rupees(units) { var v = units * 100 * (state.mkt.lot || 65); return (v < 0 ? "−₹" : "₹") + Math.round(Math.abs(v)).toLocaleString("en-IN"); }
  function el(id) { return document.getElementById(id); }
  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;"); }
  function cssv(v) { return getComputedStyle(document.documentElement).getPropertyValue(v).trim(); }
  function nice(span) {
    var raw = span / 6, p = Math.pow(10, Math.floor(Math.log10(raw || 1))), m = raw / p;
    return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p;
  }

  // ---------- market presets ----------
  var PRESETS = {
    ex2: { label: "Lecture example: 20,100 PE, 19,900 CE, 20,000 PE (3 levels)", n: 3, levels: [19900, 20000, 20100],
      products: [{ side: "buy", type: "PE", k: 20100, p: "" }, { side: "buy", type: "CE", k: 19900, p: "" }, { side: "buy", type: "PE", k: 20000, p: "" }],
      target: ["3", "2", "2"], auto: true },
    fly: { label: "Build a butterfly from three calls", n: 3, levels: [19900, 20000, 20100],
      products: [{ side: "buy", type: "CE", k: 19800, p: "230" }, { side: "buy", type: "CE", k: 19900, p: "150" }, { side: "buy", type: "CE", k: 20000, p: "60" }],
      target: ["0", "1", "0"] },
    parity: { label: "Put–call parity: CE, PE, future (many answers, arbitrage check)", n: 3, levels: [19900, 20000, 20100],
      products: [{ side: "buy", type: "CE", k: 20000, p: "60" }, { side: "buy", type: "PE", k: 20000, p: "50" }, { side: "buy", type: "FUT", k: 20000, p: "0" }],
      target: ["1", "0", "1"] },
    incomplete: { label: "Incomplete market: bond, future, 19,900 CE (can't build a butterfly)", n: 3, levels: [19900, 20000, 20100],
      products: [{ side: "buy", type: "BOND", k: 0, p: "100" }, { side: "buy", type: "FUT", k: 20000, p: "0" }, { side: "buy", type: "CE", k: 19900, p: "130" }],
      target: ["0", "1", "0"] },
    two: { label: "Two levels: 20,100 PE and 19,800 CE", n: 2, levels: [19900, 20000],
      products: [{ side: "buy", type: "PE", k: 20100, p: "210" }, { side: "buy", type: "CE", k: 19800, p: "190" }],
      target: ["3", "3"] }
  };

  var state = { n: 3, levels: [19900, 20000, 20100], products: [], target: [], challenge: false, revealed: false,
    mkt: { S0: 20000, T0: 7, iv: 13, r: 6.5, auto: true, Tn: 0, lot: 65 } };

  // ---------- Black-Scholes ----------
  function ncdf(x) {
    var t = 1 / (1 + 0.2316419 * Math.abs(x)), d = 0.3989423 * Math.exp(-x * x / 2);
    var p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
    return x > 0 ? 1 - p : p;
  }
  function bs(type, S, K, days) {
    var T = days / 365, iv = state.mkt.iv / 100, r = state.mkt.r / 100;
    if (T <= 0) return type === "CE" ? Math.max(S - K, 0) : Math.max(K - S, 0);
    var sd = iv * Math.sqrt(T), d1 = (Math.log(S / K) + (r + iv * iv / 2) * T) / sd, d2 = d1 - sd, df = Math.exp(-r * T);
    return type === "CE" ? S * ncdf(d1) - K * df * ncdf(d2) : K * df * ncdf(-d2) - S * ncdf(-d1);
  }
  // value in Nifty points of one lot, when Nifty = S and `days` are left to expiry
  function valuePts(pr, S, days) {
    var T = days / 365, r = state.mkt.r / 100, v;
    if (pr.type === "CE" || pr.type === "PE") v = bs(pr.type, S, pr.k, days);
    else if (pr.type === "FUT") v = S - pr.k * Math.exp(-r * T);
    else v = 100 * Math.exp(-r * T);
    if (days <= 0) v = Math.round(v * 1e6) / 1e6;
    return pr.side === "sell" ? -v : v;
  }
  function toFr(pts) { return Number.isInteger(pts) ? new Fr(pts, 100) : new Fr(pts / 100); }
  function premAuto(pr) { return valuePts(pr, state.mkt.S0, state.mkt.T0); }

  // ---------- payoffs ----------
  function payoffPts(pr, S) {
    var v;
    if (pr.type === "CE") v = Math.max(S - pr.k, 0);
    else if (pr.type === "PE") v = Math.max(pr.k - S, 0);
    else if (pr.type === "FUT") v = S - pr.k;
    else v = 100;
    return pr.side === "sell" ? -v : v;
  }
  function prodLabel(pr) {
    var s = pr.side === "buy" ? "Buy" : "Sell";
    if (pr.type === "CE" || pr.type === "PE") return s + " " + fmtLvl(pr.k) + " " + pr.type;
    if (pr.type === "FUT") return s + " Nifty future @ " + fmtLvl(pr.k);
    return s + " bond (pays 100 points)";
  }
  function formulaTxt(pr, S) {
    var Tn = state.mkt.Tn;
    if (Tn > 0) {
      var v = valuePts(pr, S, Tn), sg = pr.side === "sell" ? -1 : 1, base = sg * v, txtv;
      if (pr.type === "CE" || pr.type === "PE") {
        var intr = pr.type === "CE" ? Math.max(S - pr.k, 0) : Math.max(pr.k - S, 0);
        txtv = "BS " + base.toFixed(1) + " = payoff " + intr + " + time value " + (base - intr).toFixed(1);
      } else if (pr.type === "FUT") txtv = fmtLvl(S) + " − " + fmtLvl(pr.k) + "·e^(−rT) = " + base.toFixed(1);
      else txtv = "100·e^(−rT) = " + base.toFixed(2);
      return (sg < 0 ? "−(" + txtv + ")" : txtv) + " → " + fmtDec(v / 100);
    }
    var raw;
    if (pr.type === "CE") raw = "max(" + fmtLvl(S) + " − " + fmtLvl(pr.k) + ", 0) = " + Math.max(S - pr.k, 0);
    else if (pr.type === "PE") raw = "max(" + fmtLvl(pr.k) + " − " + fmtLvl(S) + ", 0) = " + Math.max(pr.k - S, 0);
    else if (pr.type === "FUT") raw = fmtLvl(S) + " − " + fmtLvl(pr.k) + " = " + (S - pr.k);
    else raw = "100";
    var pts = payoffPts(pr, S);
    return (pr.side === "sell" ? "−(" + raw + ")" : raw) + " → " + new Fr(pts, 100).txt();
  }

  // ---------- elimination (exact) ----------
  function solve(A, b) {
    var n = A.length, m = A[0].length;
    var M = A.map(function (row, i) { return row.concat([b[i]]); });
    var steps = [], pivots = [], r = 0;
    function eye() { return A.map(function (_, i) { return A.map(function (_, j) { return i === j ? ONE : ZERO; }); }); }
    var Et = eye(); // running product of all step matrices (E so that E·A = U)
    function snap() { return M.map(function (row) { return row.slice(); }); }
    for (var c = 0; c < m && r < n; c++) {
      if (M[r][c].isZero()) {
        var k = -1;
        for (var i = r + 1; i < n; i++) if (!M[i][c].isZero()) { k = i; break; }
        if (k < 0) { steps.push({ kind: "nopivot", col: c, row: r, mat: snap() }); continue; }
        var t = M[r]; M[r] = M[k]; M[k] = t;
        var tE = Et[r]; Et[r] = Et[k]; Et[k] = tE;
        var Pm = eye(), tp = Pm[r]; Pm[r] = Pm[k]; Pm[k] = tp;
        steps.push({ kind: "swap", r1: r, r2: k, col: c, mat: snap(), E: Pm });
      }
      var piv = M[r][c];
      for (var i2 = r + 1; i2 < n; i2++) {
        if (M[i2][c].isZero()) { steps.push({ kind: "zero", row: i2, col: c, prow: r }); continue; }
        var mult = M[i2][c].div(piv);
        var before = M[i2].slice(), sub = M[r].map(function (v) { return v.mul(mult); });
        M[i2] = M[i2].map(function (v, j) { return v.sub(sub[j]); });
        var Erow = Et[r];
        Et[i2] = Et[i2].map(function (v, j) { return v.sub(Erow[j].mul(mult)); });
        var Em = eye(); Em[i2][r] = mult.neg();
        steps.push({ E: Em, kind: "elim", row: i2, prow: r, col: c, piv: piv, remove: before[c], mult: mult, before: before, sub: sub, after: M[i2].slice(), mat: snap() });
      }
      pivots.push(c); r++;
    }
    var rank = pivots.length, bad = [];
    for (var z = rank; z < n; z++) if (!M[z][m].isZero()) bad.push(z);
    var free = []; for (var fc = 0; fc < m; fc++) if (pivots.indexOf(fc) < 0) free.push(fc);
    function back(rhsZero, freeVals) {
      var x = []; for (var j = 0; j < m; j++) x.push(ZERO);
      free.forEach(function (f, i) { x[f] = freeVals[i]; });
      var bs = [];
      for (var i = rank - 1; i >= 0; i--) {
        var pc = pivots[i], rhs = rhsZero ? ZERO : M[i][m], sum = rhs, known = [];
        for (var j2 = pc + 1; j2 < m; j2++) if (!M[i][j2].isZero()) { sum = sum.sub(M[i][j2].mul(x[j2])); known.push(j2); }
        x[pc] = sum.div(M[i][pc]);
        bs.push({ row: i, pc: pc, coefs: M[i].slice(0, m), rhs: rhs, known: known, xsnap: x.slice(), val: x[pc], sum: sum });
      }
      return { x: x, bs: bs };
    }
    var res = { Et: Et, M: M, steps: steps, pivots: pivots, rank: rank, bad: bad, free: free, n: n, m: m };
    if (!bad.length) {
      var part = back(false, free.map(function () { return ZERO; }));
      res.x = part.x; res.bs = part.bs;
      res.nulls = free.map(function (f, i) { return back(true, free.map(function (_, j) { return j === i ? ONE : ZERO; })).x; });
    }
    return res;
  }

  // ---------- LaTeX builders ----------
  function augTex(M, m, hi) {
    var cols = "", i; for (i = 0; i < m; i++) cols += "c";
    var rows = M.map(function (row, ri) {
      return row.map(function (v, j) {
        var t = v.tex();
        if (hi && hi.row === ri && hi.col === j) t = "\\color{#b42318}{" + t + "}";
        return t;
      }).join(" & ");
    });
    return "\\left[\\begin{array}{" + cols + "|c}" + rows.join(" \\\\ ") + "\\end{array}\\right]";
  }
  function eqTex(coefs, rhs, n) {
    var s = "", first = true;
    coefs.forEach(function (c, j) {
      if (c.isZero()) return;
      var abs = c.n < 0 ? c.neg() : c, cs = (abs.n === 1 && abs.d === 1) ? "" : abs.tex();
      if (first) s += (c.n < 0 ? "-" : "") + cs + VARS[j];
      else s += (c.n < 0 ? " - " : " + ") + cs + VARS[j];
      first = false;
    });
    if (first) s = "0";
    return s + " = " + rhs.tex();
  }
  function vecTex(v) { return "\\begin{bmatrix}" + v.map(function (x) { return x.tex(); }).join("\\\\") + "\\end{bmatrix}"; }


  // ---------- "how each plane is built" (Lecture 01 lab only) ----------
  function planeGuide(A, tgt, L, n, vars, names, R) {
    var sheet = n === 2 ? "line" : "plane", Sheet = n === 2 ? "Line" : "Plane", h = [];
    function pt(p) { return "(" + p.map(function (v) { return v.txt(); }).join(", ") + ")"; }
    function dot(row, p) { return row.reduce(function (s, a, j) { return s.add(a.mul(p[j])); }, ZERO); }
    h.push('<h4>7b. How each ' + sheet + ' in the row picture is built</h4>');
    h.push('<p>The row picture has one ' + sheet + ' per Nifty level (named "at 19,900" etc. in the graph\'s legend). ' +
      'A point in it is a mix of lots ' + "(" + vars.join(", ") + ")" + '. The ' + sheet + ' holds <b>every</b> mix that pays exactly what the client wants at that one level. Here is how each one is made, point by point.</p>');
    A.forEach(function (row, i) {
      var lvl = fmtLvl(L[i]), b = tgt[i];
      h.push('<div class="box example"><span class="label">' + Sheet + ' ' + (i + 1) + ': Nifty at ' + lvl + '</span><ol class="step-list kid-step">');
      // 1. where it comes from
      h.push('<li><p class="k"><span class="kl">Where it comes from</span> The ' + lvl + ' row of the payoff table: 1 lot of ' +
        names.map(function (nm, j) { return nm + ' pays ' + row[j].txt(); }).join(", ") + '. The client wants <b>' + b.txt() + '</b> at ' + lvl + '.</p>' +
        '<p class="k"><span class="kl">The equation</span> $' + eqTex(row, b, n) + '$</p>' +
        '<p class="k"><span class="kl">In words</span> Any mix of lots that makes this true pays exactly ' + b.txt() + ' if Nifty ends at ' + lvl + '. Each such mix is one point of the ' + sheet + '.</p></li>');
      var nz = row.map(function (a, j) { return a.isZero() ? -1 : j; }).filter(function (j) { return j >= 0; });
      if (!nz.length) {
        h.push('<li><p class="k"><span class="kl">Special case</span> Every product pays 0 at ' + lvl + ', so the equation says $0 = ' + b.tex() + '$. ' +
          (b.isZero() ? 'That is always true: <b>every</b> point works, so this ' + sheet + ' is the whole space and puts no limit on the answer.' :
            'That is never true: <b>no</b> point works, so there is no ' + sheet + ' at all and the client\'s payoff cannot be built.') + '</p></li></ol></div>');
        return;
      }
      // 2. where it crosses the axes
      function cv(a, v) { var t = a.tex(); return t === "1" ? v : t === "-1" ? "-" + v : t + v; }
      function lots(v) { return v.txt() + (v.num() === 1 ? ' lot' : ' lots'); }
      var origin = pt(vars.map(function () { return ZERO; }));
      var cross = vars.map(function (v, j) {
        if (row[j].isZero()) return b.isZero()
          ? '<li>' + v + '-axis: the <b>whole axis</b> lies in the ' + sheet + '. ' + names[j] + ' pays 0 at ' + lvl + ' and the client wants 0 there, so any number of ' + names[j] + ' lots works.</li>'
          : '<li>' + v + '-axis: <b>never</b>. ' + names[j] + ' pays 0 at ' + lvl + ', so changing ' + v + ' does not change the payoff here. The ' + sheet + ' runs parallel to the ' + v + '-axis.</li>';
        if (b.isZero()) return '<li>' + v + '-axis: only at the origin ' + origin + '. With only ' + names[j] + ', the payoff here is $' + cv(row[j], v) + '$, which is 0 only when ' + v + ' = 0.</li>';
        var val = b.div(row[j]), p = vars.map(function (w, k) { return k === j ? val : ZERO; });
        return '<li>' + v + '-axis at <b>' + pt(p) + '</b>: set the other lots to 0, then $' + cv(row[j], v) + ' = ' + b.tex() + '$, so $' + v + ' = ' + b.tex() + ' \\div ' + (row[j].num() < 0 ? '(' + row[j].tex() + ')' : row[j].tex()) + ' = ' + val.tex() + '$. ' +
          'Only ' + names[j] + ': ' + lots(val) + '.</li>';
      });
      if (b.isZero()) cross.unshift('<li>The client wants 0 here, so buying nothing works: the ' + sheet + ' passes through the origin ' + origin + '.</li>');
      h.push('<li><p class="k"><span class="kl">Where it crosses the axes</span> Keep only one product at a time.</p><ul>' + cross.join("") + '</ul></li>');
      // 3. sample points
      var k = nz[nz.length - 1], others = vars.map(function (v, j) { return j; }).filter(function (j) { return j !== k; });
      var picks = n === 2 ? [[0], [1], [2], [-1]] : [[0, 0], [1, 0], [0, 1], [1, 1], [2, -1]];
      var pts = picks.map(function (pk) {
        var p = vars.map(function () { return ZERO; }), rest = b;
        others.forEach(function (j, t) { p[j] = new Fr(pk[t]); rest = rest.sub(row[j].mul(p[j])); });
        p[k] = rest.div(row[k]); return { p: p, pk: pk };
      });
      if (R && !R.bad.length && !R.free.length && R.x) {
        var ans = R.x, dup = pts.some(function (q) { return q.p.every(function (v, j) { return v.sub(ans[j]).isZero(); }); });
        if (!dup) pts.push({ p: ans, pk: others.map(function (j) { return ans[j].num(); }), isAns: true });
      }
      var rows = pts.map(function (q) {
        var pick = others.map(function (j) { return vars[j] + ' = ' + q.p[j].txt(); }).join(", ");
        var here = dot(row, q.p);
        var elsewhere = A.map(function (r2, i2) {
          if (i2 === i) return null;
          var v = dot(r2, q.p), ok = v.sub(tgt[i2]).isZero();
          return fmtLvl(L[i2]) + ': ' + v.txt() + (ok ? ' ✓' : ' ✗ (wants ' + tgt[i2].txt() + ')');
        }).filter(Boolean).join("<br>");
        var all = A.every(function (r2, i2) { return dot(r2, q.p).sub(tgt[i2]).isZero(); });
        return '<tr><td>' + pick + '</td><td>' + vars[k] + ' = ' + q.p[k].txt() + '</td><td><b>' + pt(q.p) + '</b></td><td>' + here.txt() + ' ✓</td><td>' + elsewhere + '</td><td>' + (all ? '<b>yes: the answer</b>' : 'no') + '</td></tr>';
      });
      var ex = pts[1] || pts[0], exSum = others.map(function (j) { return row[j].txt() + ' × ' + ex.p[j].txt(); });
      h.push('<li><p class="k"><span class="kl">Find more points</span> Choose ' + others.map(function (j) { return vars[j]; }).join(" and ") + ' freely, then work out ' + vars[k] + ' from the equation.</p>' +
        '<p class="k"><span class="kl">Example</span> Pick ' + others.map(function (j) { return vars[j] + ' = ' + ex.p[j].txt(); }).join(", ") + '. Then ' + exSum.join(" + ") + ' + ' + row[k].txt() + ' × ' + vars[k] + ' = ' + b.txt() +
        ', so ' + vars[k] + ' = ' + ex.p[k].txt() + '. Point ' + pt(ex.p) + '.</p>' +
        '<table><tr><th>Pick</th><th>Then</th><th>Point</th><th>Pays at ' + lvl + '</th><th>Pays at the other levels</th><th>On every ' + sheet + '?</th></tr>' + rows.join("") + '</table></li>');
      // 4. why it is a plane / line
      h.push('<li><p class="k"><span class="kl">Why it is a ' + sheet + '</span> ' + (n === 2 ? 'One lot can be chosen freely and the other is then fixed. One free choice = a straight line.' :
        'Two lots can be chosen freely and the third is then fixed. Two free choices = a flat sheet, a plane.') + ' Every point you can make this way lies on it, and nothing else does.</p>' +
        '<p class="k"><span class="kl">In market words</span> Every point here is a mix that is correct at ' + lvl + ' only. Look at the last column: most points pay the wrong amount at the other levels. Being on one ' + sheet + ' is not enough.</p></li>');
      h.push('</ol></div>');
    });
    var meet = R.bad.length ? 'No point is on every ' + sheet + ', so no mix works at every level.' :
      R.free.length ? 'A whole line of points is on every ' + sheet + ': many mixes work.' :
      'Only one point is on every ' + sheet + ': ' + pt(R.x) + '. That mix pays the right amount at every level, so it is the answer.';
    h.push('<p class="answer">Putting the ' + sheet + 's together: ' + meet + '</p>');
    return h.join("");
  }


  // ---------- UI ----------
  function readUI() {
    state.n = +document.querySelector('input[name="labn"]:checked').value;
    state.levels = []; for (var i = 0; i < state.n; i++) state.levels.push(parseInt(el("lablvl" + i).value, 10) || 0);
    state.products = []; state.target = [];
    for (var j = 0; j < state.n; j++) {
      state.products.push({ side: el("labside" + j).value, type: el("labtype" + j).value, k: parseInt(el("labk" + j).value, 10) || 0, p: el("labp" + j).value });
      state.target.push(el("labt" + j).value);
    }
    var tp = el("labtpre");
    if (tp) for (var o = 0; o < tp.options.length; o++) {
      var ov = tp.options[o].value;
      if (ov.indexOf("ad") === 0) tp.options[o].text = "Pays 1 only at " + fmtLvl(state.levels[+ov.slice(2)]) + " (Arrow–Debreu)";
    }
    state.challenge = el("labchal").checked;
    var mk = state.mkt;
    mk.S0 = parseFloat(el("labS0").value) || 20000; mk.T0 = Math.max(0, parseInt(el("labT0").value, 10) || 0);
    mk.iv = Math.max(0.1, parseFloat(el("labiv").value) || 13); mk.r = parseFloat(el("labr").value) || 0;
    mk.auto = el("labauto").checked;
    mk.lot = Math.max(1, parseInt(el("lablot").value, 10) || 65);
    var sl = el("labTn"); sl.max = mk.T0; mk.Tn = Math.min(parseInt(sl.value, 10) || 0, mk.T0); el("labTnv").textContent = mk.Tn;
    for (var q = 0; q < state.n; q++) {
      var inp = el("labp" + q);
      if (mk.auto) { var pv = premAuto(state.products[q]); state.products[q].p = pv.toFixed(2); inp.value = pv.toFixed(2); inp.disabled = true; }
      else inp.disabled = false;
    }
  }

  function buildControls(root) {
    var n = state.n, h = [];
    h.push('<div class="lab-controls">');
    h.push('<div class="lab-row"><b>Market preset:</b> <select id="labpreset"><option value="">— choose a ready-made market —</option>');
    Object.keys(PRESETS).forEach(function (k) { h.push('<option value="' + k + '">' + esc(PRESETS[k].label) + '</option>'); });
    h.push('</select> <button type="button" id="labrand" class="lab-btn">🎲 Random market</button></div>');
    h.push('<div class="lab-row"><b>Expiry levels:</b> <label><input type="radio" name="labn" value="2"' + (n === 2 ? " checked" : "") + '> 2 (2D)</label> <label><input type="radio" name="labn" value="3"' + (n === 3 ? " checked" : "") + '> 3 (3D)</label>');
    for (var i = 0; i < n; i++) h.push(' <span class="lab-lvl">Nifty level ' + (i + 1) + ': <input id="lablvl' + i + '" type="number" step="50" value="' + state.levels[i] + '"></span>');
    h.push('</div>');
    var mk = state.mkt;
    h.push('<div class="lab-row"><b>Time &amp; market today:</b> <span class="lab-lvl">Nifty spot <input id="labS0" type="number" step="50" value="' + mk.S0 + '"></span>' +
      ' <span class="lab-lvl">Days to expiry <input id="labT0" type="number" min="0" max="365" step="1" value="' + mk.T0 + '"></span>' +
      ' <span class="lab-lvl">IV % <input id="labiv" type="number" min="1" step="0.5" value="' + mk.iv + '"></span>' +
      ' <span class="lab-lvl">Rate % <input id="labr" type="number" step="0.25" value="' + mk.r + '"></span>' +
      ' <span class="lab-lvl">Lot size <input id="lablot" type="number" min="1" step="1" value="' + mk.lot + '" title="Quantity in 1 NSE Nifty lot"></span>' +
      ' <label><input type="checkbox" id="labauto"' + (mk.auto ? " checked" : "") + '> Auto premiums (Black–Scholes)</label></div>');
    h.push('<div class="lab-row"><b>Look at the position with</b> <input type="range" id="labTn" min="0" max="' + mk.T0 + '" step="1" value="' + Math.min(mk.Tn, mk.T0) + '" style="flex:1;min-width:160px;accent-color:var(--accent)"> <b id="labTnv">' + Math.min(mk.Tn, mk.T0) + '</b> days left <span style="color:var(--ink-soft)">(0 = at expiry: plain payoffs)</span></div>');
    h.push('<table class="lab-table"><tr><th>Product</th><th>Buy / sell</th><th>Type</th><th>Strike / entry</th><th>Premium today (points, optional)</th></tr>');
    for (var j = 0; j < n; j++) {
      var p = state.products[j];
      h.push('<tr><td><b>' + NAMES[j] + '</b> (lots = <i>' + VARS[j] + '</i>)</td>' +
        '<td><select id="labside' + j + '"><option value="buy"' + (p.side === "buy" ? " selected" : "") + '>Buy</option><option value="sell"' + (p.side === "sell" ? " selected" : "") + '>Sell</option></select></td>' +
        '<td><select id="labtype' + j + '">' + ["CE", "PE", "FUT", "BOND"].map(function (t) {
          var lbl = t === "FUT" ? "Future" : t === "BOND" ? "Bond" : t;
          return '<option value="' + t + '"' + (p.type === t ? " selected" : "") + '>' + lbl + '</option>';
        }).join("") + '</select></td>' +
        '<td><input id="labk' + j + '" type="number" step="50" value="' + p.k + '"' + (p.type === "BOND" ? " disabled" : "") + '></td>' +
        '<td><input id="labp' + j + '" type="text" placeholder="e.g. 120" value="' + esc(p.p || "") + '"></td></tr>');
    }
    h.push('</table>');
    h.push('<div class="lab-row"><b>Client wants</b> (in units of 100 points): ');
    for (var t = 0; t < n; t++) h.push('<span class="lab-lvl">at Nifty <input id="labtl' + t + '" type="number" step="50" value="' + state.levels[t] + '" title="Nifty level (same as Nifty level ' + (t + 1) + ' above)">: <input id="labt' + t + '" type="text" value="' + esc(state.target[t]) + '" size="5"></span> ');
    h.push(' <select id="labtpre"><option value="">target shapes…</option>');
    for (var q = 0; q < n; q++) h.push('<option value="ad' + q + '">Pays 1 only at ' + fmtLvl(state.levels[q]) + ' (Arrow–Debreu)</option>');
    h.push('<option value="one">Pays 1 everywhere (like a bond)</option>');
    if (n === 3) h.push('<option value="strad">Straddle shape (2, 0, 2)</option><option value="crash">Crash protection (3, 1, 0)</option><option value="rally">Rally bet (0, 1, 3)</option>');
    else h.push('<option value="down">Down bet (2, 0)</option><option value="up">Up bet (0, 2)</option>');
    h.push('</select></div>');
    h.push('<div class="lab-row"><label><input type="checkbox" id="labchal"' + (state.challenge ? " checked" : "") + '> Challenge mode: hide the answer, let me guess first</label></div>');
    h.push('</div><div id="labout"></div>');
    root.innerHTML = h.join("");

    function onChange() { readUI(); render(); }
    root.querySelectorAll("input,select").forEach(function (e) {
      if (e.id === "labpreset" || e.id === "labtpre" || e.name === "labn" || e.id === "labrand" || /^labtl\d/.test(e.id)) return;
      e.addEventListener("input", onChange); e.addEventListener("change", onChange);
    });
    // the level boxes in "Expiry levels" and in "Client wants" are the same numbers: keep them in sync
    for (var lv = 0; lv < n; lv++) (function (i) {
      var top = el("lablvl" + i), low = el("labtl" + i);
      function fromLow() { top.value = low.value; onChange(); }
      low.addEventListener("input", fromLow); low.addEventListener("change", fromLow);
      top.addEventListener("input", function () { low.value = top.value; });
    })(lv);
    root.querySelectorAll('select[id^="labtype"]').forEach(function (s) {
      s.addEventListener("change", function () { var j = s.id.slice(7); el("labk" + j).disabled = s.value === "BOND"; });
    });
    root.querySelectorAll('input[name="labn"]').forEach(function (r) {
      r.addEventListener("change", function () {
        readUI(); var n2 = +r.value;
        if (n2 === 3 && state.levels.length < 3) { state.levels.push(state.levels[state.levels.length - 1] + 100); }
        state.n = n2; loadPreset(n2 === 3 ? "ex2" : "two", true);
      });
    });
    el("labpreset").addEventListener("change", function () { if (this.value) loadPreset(this.value); });
    el("labtpre").addEventListener("change", function () {
      var v = this.value, t = [], i;
      for (i = 0; i < state.n; i++) t.push("0");
      if (v.indexOf("ad") === 0) t[+v.slice(2)] = "1";
      else if (v === "one") t = t.map(function () { return "1"; });
      else if (v === "strad") t = ["2", "0", "2"]; else if (v === "crash") t = ["3", "1", "0"]; else if (v === "rally") t = ["0", "1", "3"];
      else if (v === "down") t = ["2", "0"]; else if (v === "up") t = ["0", "2"];
      else return;
      t.forEach(function (x, i2) { el("labt" + i2).value = x; });
      readUI(); render();
    });
    el("labchal").addEventListener("change", function () { state.revealed = false; });
    el("labrand").addEventListener("click", randomMarket);
  }

  function loadPreset(key, keepLevels) {
    var P = PRESETS[key];
    state.n = P.n; state.levels = P.levels.slice(); state.products = P.products.map(function (p) { return Object.assign({}, p); });
    state.target = P.target.slice(); state.revealed = false; state.mkt.auto = !!P.auto; state.mkt.Tn = 0;
    buildControls(el("replab")); readUI(); render();
  }

  function randomMarket() {
    readUI();
    var n = state.n, L = state.levels, tries = 0, prods, A;
    var types = ["CE", "CE", "PE", "PE", "FUT", "BOND"];
    do {
      prods = [];
      for (var j = 0; j < n; j++) {
        var t = types[Math.floor(Math.random() * types.length)];
        var base = L[Math.floor(Math.random() * n)] + [-100, 0, 100][Math.floor(Math.random() * 3)];
        prods.push({ side: Math.random() < 0.8 ? "buy" : "sell", type: t, k: t === "BOND" ? 0 : base, p: "" });
      }
      A = L.map(function (S) { return prods.map(function (pr) { return toFr(valuePts(pr, S, state.mkt.Tn)); }); });
      tries++;
    } while (solve(A, L.map(function () { return ZERO; })).rank < n && tries < 300);
    var x = prods.map(function () { var v = Math.floor(Math.random() * 5) - 2; return v === 0 ? 1 : v; });
    var b = A.map(function (row) { return row.reduce(function (s, a, j) { return s.add(a.mul(new Fr(x[j]))); }, ZERO); });
    state.products = prods; state.target = b.map(function (f) { return f.f ? fmtDec(f.n) : f.d === 1 ? String(f.n) : f.n + "/" + f.d; });
    state.mkt.auto = true;
    state.challenge = true; state.revealed = false;
    buildControls(el("replab")); readUI(); render();
  }

  // ---------- render ----------
  function render() {
    var out = el("labout"), n = state.n, L = state.levels, P = state.products;
    var tgt = state.target.map(parseFr);
    if (tgt.some(function (t) { return t === null; })) { out.innerHTML = '<p class="lab-warn">Enter a number for every target payoff.</p>'; return; }
    var A = L.map(function (S) { return P.map(function (pr) { return toFr(valuePts(pr, S, state.mkt.Tn)); }); });
    var R = solve(A, tgt);
    var hidden = state.challenge && !state.revealed;
    var h = [], vars = VARS.slice(0, n), names = NAMES.slice(0, n);

    // 1. question
    var mk = state.mkt, Tn = mk.Tn;
    var when = Tn > 0 ? 'with <b>' + Tn + ' day' + (Tn > 1 ? 's' : '') + ' still left to expiry</b>, Nifty could be at' : 'Nifty will expire at';
    h.push('<h4>1. The question</h4><div class="box finance"><span class="label">Generated from your inputs</span><p>Today Nifty is at <b>' + fmtLvl(mk.S0) + '</b> with <b>' + mk.T0 + ' days</b> to expiry (IV ' + mk.iv + '%, rate ' + mk.r + '%). ' +
      'Later, ' + when + ' one of these levels: <b>' + L.map(fmtLvl).join("</b>, <b>") + '</b>. Values are in Nifty points ÷ 100, per 1 quantity; 1 lot = ' + mk.lot + ' quantity, so a value of 1 = 100 points = ' + rupees(1) + ' on 1 lot. You can trade:</p><ul>' +
      P.map(function (pr, j) { return '<li><b>' + names[j] + '</b> = ' + esc(prodLabel(pr)) + '</li>'; }).join("") +
      '</ul><p>A client wants a position ' + (Tn > 0 ? 'worth' : 'that pays') + ' ' + L.map(function (S, i) { return '<b>' + tgt[i].txt() + '</b> (' + Math.round(tgt[i].num() * 100) + ' points = ' + rupees(tgt[i].num()) + ' per lot) if Nifty ' + (Tn > 0 ? 'is at ' : 'expires at ') + fmtLvl(S); }).join(", ") + (Tn > 0 ? ' at that moment' : '') +
      '. <b>How many lots ' + vars.map(function (v) { return "$" + v + "$"; }).join(", ") + ' of ' + names.join(", ") + '</b> should you trade?</p></div>');

    // 2. payoff table
    if (Tn > 0) h.push('<div class="box intuition"><span class="label">Before expiry: payoff + time value</span><p>With ' + Tn + ' days left, an option is worth more than its expiry payoff $\\max(S - K, 0)$: it still has <b>time value</b> (the chance of moving further in the money). Each value below comes from the <b>Black–Scholes</b> formula (spot = that Nifty level, ' + Tn + ' days, IV ' + mk.iv + '%, rate ' + mk.r + '%). So the columns are no longer sharp "hockey sticks" but smooth curves, and the lots that copy the client change as time passes. Drag the <b>days-left</b> slider to watch this (time decay, theta).</p></div>');
    h.push('<h4>2. ' + (Tn > 0 ? 'What each product is worth with ' + Tn + ' days left' : 'Where the payoff numbers come from') + '</h4><table><tr><th>Product</th>' + L.map(function (S) { return '<th>At ' + fmtLvl(S) + '</th>'; }).join("") + '</tr>');
    P.forEach(function (pr, j) { h.push('<tr><td><b>' + names[j] + '</b>: ' + esc(prodLabel(pr)) + '</td>' + L.map(function (S) { return '<td>' + formulaTxt(pr, S) + '</td>'; }).join("") + '</tr>'); });
    h.push('</table>');
    h.push('<p><b>In rupees, per 1 lot (' + mk.lot + ' quantity):</b></p><table><tr><th>Product</th>' + L.map(function (S) { return '<th>At ' + fmtLvl(S) + '</th>'; }).join("") + '</tr>' +
      P.map(function (pr, j) { return '<tr><td>' + names[j] + '</td>' + L.map(function (S, i) { return '<td>' + rupees(A[i][j].num()) + '</td>'; }).join("") + '</tr>'; }).join("") + '</table>');

    // 3. equations
    var eqs = A.map(function (row, i) { return eqTex(row, tgt[i], n) + " &&\\text{(Nifty at " + fmtLvl(L[i]) + (Tn > 0 ? ", " + Tn + "d left" : "") + ")}"; });
    h.push('<h4>3. The equations (one row per ' + (Tn > 0 ? 'Nifty level, ' + Tn + ' days before expiry' : 'expiry level') + ')</h4>$$\\begin{aligned}' + eqs.map(function (e) { return e.replace(" = ", " &= "); }).join(" \\\\ ") + '\\end{aligned}$$');
    h.push('$$\\underbrace{\\begin{bmatrix}' + A.map(function (r) { return r.map(function (v) { return v.tex(); }).join(" & "); }).join(" \\\\ ") +
      '\\end{bmatrix}}_{\\text{columns} = ' + names.join(", ") + '}\\begin{bmatrix}' + vars.join("\\\\") + '\\end{bmatrix} = \\underbrace{' + vecTex(tgt) + '}_{\\text{client}}$$');
    h.push('<table><tr><th>Part</th><th>Market meaning</th></tr><tr><td>row $i$</td><td>' + (Tn > 0 ? 'what every product is worth if Nifty is at level $i$ (with ' + Tn + ' days left)' : 'what every product pays if Nifty expires at level $i$') + '</td></tr><tr><td>column $j$</td><td>product $j$\'s ' + (Tn > 0 ? 'value' : 'payoff') + ' at every level (its "arrow")</td></tr><tr><td>' + vars.map(function (v) { return "$" + v + "$"; }).join(", ") + '</td><td>lots of ' + names.join(", ") + '</td></tr><tr><td>right side</td><td>the client\'s wanted payoff</td></tr></table>');

    // challenge guess box
    if (state.challenge) {
      h.push('<div class="mixer"><b>Your guess:</b> ' + vars.map(function (v, j) { return v + ' = <input id="labg' + j + '" type="text" size="4" placeholder="lots">'; }).join(" ") +
        ' <button type="button" id="labcheck" class="lab-btn">Check my guess</button> <button type="button" id="labreveal" class="lab-btn">' + (state.revealed ? "Hide answer" : "Reveal answer") + '</button><div id="labgout"></div></div>');
    }

    // diagnosis
    var diag;
    if (R.bad.length) diag = '<div class="box pitfall"><span class="label">Diagnosis: can\'t be built exactly</span><p>Elimination leaves a row that says <b>0 = something non-zero</b>. The client\'s payoff is <b>outside the column space</b>: no mix of these products copies it. See the closest possible hedge in step 6.</p></div>';
    else if (R.free.length) diag = '<div class="box intuition"><span class="label">Diagnosis: many ways to build it</span><p>Some product is a <b>copy</b> of the others (a missing pivot). There is a whole family of answers, and a <b>zero-payoff trade</b> (nullspace). See step 8 for the arbitrage check.</p></div>';
    else diag = '<div class="box theorem"><span class="label">Diagnosis: exactly one way to build it</span><p>Every column has a pivot: the products are independent, so there is exactly one recipe.</p></div>';

    var hh = [], closest = null;
    hh.push('<h4>4. Elimination, step by step</h4>' + diag + '<p>Start with the augmented matrix (products on the left, client on the right):</p>$$' + augTex(A.map(function (r, i) { return r.concat([tgt[i]]); }), n) + '$$');
    var sn = 1;
    R.steps.forEach(function (s) {
      if (s.kind === "swap") {
        hh.push('<p><b>Step ' + (sn++) + ' (swap).</b> The pivot spot (row ' + (s.r1 + 1) + ', column ' + (s.col + 1) + ') is 0, but row ' + (s.r2 + 1) + ' has a non-zero number there. Swap rows ' + (s.r1 + 1) + ' and ' + (s.r2 + 1) + ' (just reorder the scenarios):</p>$$' + augTex(s.mat, n) + '$$');
      }
      else if (s.kind === "nopivot") hh.push('<p><b>Step ' + (sn++) + ' (no pivot).</b> Column ' + (s.col + 1) + ' (product ' + names[s.col] + ') has only zeros from row ' + (s.row + 1) + ' down. It adds <b>no new direction</b>: product ' + names[s.col] + ' is a mix of the earlier products. Move on to the next column.</p>');
      else if (s.kind === "zero") hh.push('<p><b>Step ' + (sn++) + '.</b> Row ' + (s.row + 1) + ' already has 0 in column ' + (s.col + 1) + ' (multiplier 0). Nothing to do.</p>');
      else {
        hh.push('<p><b>Step ' + (sn++) + '.</b> Pivot $= ' + s.piv.tex() + '$ (row ' + (s.prow + 1) + '). Number to remove $= ' + s.remove.tex() + '$. Multiplier $= ' + s.remove.tex() + ' \\div ' + s.piv.tex() + ' = ' + s.mult.tex() + '$. Row ' + (s.row + 1) + ' $-\\,' + s.mult.tex() + '\\times$ row ' + (s.prow + 1) + ':</p>');
        hh.push('<table><tr><th></th>' + vars.map(function (v) { return '<th>$' + v + '$</th>'; }).join("") + '<th>client</th></tr>' +
          '<tr><td>Row ' + (s.row + 1) + '</td>' + s.before.map(function (v) { return '<td>$' + v.tex() + '$</td>'; }).join("") + '</tr>' +
          '<tr><td>minus $' + s.mult.tex() + '\\times$ row ' + (s.prow + 1) + '</td>' + s.sub.map(function (v) { return '<td>$' + v.neg().tex() + '$</td>'; }).join("") + '</tr>' +
          '<tr><td><b>New row ' + (s.row + 1) + '</b></td>' + s.after.map(function (v) { return '<td><b>$' + v.tex() + '$</b></td>'; }).join("") + '</tr></table>');
      }
    });
    hh.push('<p>Staircase reached:</p>$$' + augTex(R.M, n) + '$$');

    // 5. back substitution / answer
    var tradeTxt = function (x) {
      return x.map(function (v, j) {
        if (v.isZero()) return "no " + names[j];
        var lots = v.n < 0 ? v.neg() : v, verb = (v.n < 0) ? (P[j].side === "buy" ? "sell" : "buy") : (P[j].side === "buy" ? "buy" : "sell");
        var inner = P[j].type === "BOND" ? "bond" : P[j].type === "FUT" ? "Nifty future @ " + fmtLvl(P[j].k) : fmtLvl(P[j].k) + " " + P[j].type;
        return verb + " " + lots.txt() + " × " + inner;
      }).join(", ");
    };
    if (R.bad.length) {
      hh.push('<h4>5. What the last row says</h4>');
      R.bad.forEach(function (i) { hh.push('<p>Row ' + (i + 1) + ' reads $0 = ' + R.M[i][n].tex() + '$, which is impossible. The client\'s payoff cannot be built.</p>'); });
      // closest hedge (least squares on pivot columns)
      var cols = R.pivots, An = A.map(function (r) { return r.map(function (v) { return v.num(); }); }), bn = tgt.map(function (v) { return v.num(); });
      var k2 = cols.length, G = [], g = [];
      for (var a = 0; a < k2; a++) { G.push([]); g.push(0); for (var c2 = 0; c2 < k2; c2++) { var sg = 0; for (var r2 = 0; r2 < n; r2++) sg += An[r2][cols[a]] * An[r2][cols[c2]]; G[a].push(sg); } for (var r3 = 0; r3 < n; r3++) g[a] += An[r3][cols[a]] * bn[r3]; }
      for (var p1 = 0; p1 < k2; p1++) { for (var p2 = p1 + 1; p2 < k2; p2++) { var f = G[p2][p1] / G[p1][p1]; for (var q1 = p1; q1 < k2; q1++) G[p2][q1] -= f * G[p1][q1]; g[p2] -= f * g[p1]; } }
      var w = new Array(k2).fill(0); for (var p3 = k2 - 1; p3 >= 0; p3--) { var sm = g[p3]; for (var q2 = p3 + 1; q2 < k2; q2++) sm -= G[p3][q2] * w[q2]; w[p3] = sm / G[p3][p3]; }
      var xf = new Array(n).fill(0); cols.forEach(function (c3, i) { xf[c3] = w[i]; });
      closest = xf;
      var got = An.map(function (r) { return r.reduce(function (s, v, j) { return s + v * xf[j]; }, 0); });
      hh.push('<h4>6. The closest possible hedge</h4><p>Since an exact copy is impossible, find the mix whose payoff is <b>as close as possible</b> to the client\'s (smallest total squared miss, "least squares", coming in Unit II): ' +
        vars.map(function (v, j) { return '$' + v + ' \\approx ' + (+xf[j].toFixed(3)) + '$'; }).join(", ") + '.</p><table><tr><th>Nifty at</th><th>Client wants</th><th>Closest hedge pays</th><th>Miss</th></tr>' +
        L.map(function (S, i) { return '<tr><td>' + fmtLvl(S) + '</td><td>' + (+bn[i].toFixed(3)) + '</td><td>' + (+got[i].toFixed(3)) + '</td><td>' + (+(bn[i] - got[i]).toFixed(3)) + '</td></tr>'; }).join("") + '</table>' +
        '<p>The "miss" is risk the market maker must carry, which is why hard-to-replicate options trade at a premium.</p>');
    } else {
      hh.push('<h4>5. Back substitution (bottom to top)</h4>');
      if (R.free.length) hh.push('<p>Free choice: ' + R.free.map(function (f) { return '$' + vars[f] + '$'; }).join(", ") + ' (no pivot). Set ' + (R.free.length > 1 ? "them" : "it") + ' to $0$ to get one answer.</p>');
      hh.push('<table><tr><th>Row</th><th>Equation</th><th>Result</th></tr>');
      R.bs.forEach(function (b) {
        hh.push('<tr><td>' + (b.row + 1) + '</td><td>$' + eqTex(b.coefs, b.rhs, n) + '$' + (b.known.length ? '<br>put ' + b.known.map(function (j) { return '$' + vars[j] + ' = ' + b.xsnap[j].tex() + '$'; }).join(", ") : "") +
          '</td><td>$' + vars[b.pc] + ' = ' + b.val.tex() + '$</td></tr>');
      });
      hh.push('</table>');
      var x = R.x;
      hh.push('<p class="answer">Answer: ' + vars.map(function (v, j) { return '$' + v + ' = ' + x[j].tex() + '$'; }).join(", ") + '. In trading words: ' + esc(tradeTxt(x)) + '.</p>');
      hh.push('<h4>6. Check, scenario by scenario</h4><table><tr><th>Nifty at</th>' + names.map(function (nm, j) { return '<th>$' + x[j].tex() + '\\times$ ' + nm + '</th>'; }).join("") + '<th>Total</th><th>Client wants</th></tr>');
      A.forEach(function (row, i) {
        var tot = ZERO, cells = row.map(function (a, j) { var v = a.mul(x[j]); tot = tot.add(v); return '<td>$' + v.tex() + '$</td>'; }).join("");
        hh.push('<tr><td>' + fmtLvl(L[i]) + '</td>' + cells + '<td>$' + tot.tex() + '$</td><td>$' + tgt[i].tex() + '$ ✓</td></tr>');
      });
      hh.push('</table>');
      if (R.nulls.length) {
        R.nulls.forEach(function (z) {
          hh.push('<p><b>Zero-payoff trade (nullspace):</b> $' + vecTex(z) + '$, i.e. ' + esc(tradeTxt(z)) + '. It pays 0 at every level, so you can add any multiple of it to the answer and still copy the client\'s payoff.</p>');
        });
      }
    }

    // 7. pictures

    // 7. pictures: captions written with the live numbers
    var shape = n === 2 ? "line" : "flat sheet", shapes = n === 2 ? "lines" : "sheets";
    var mixOf = names.join(" and ").replace(/ and (?=.* and )/g, ", ");
    var lotsVec = "(" + vars.join(", ") + ")";
    var meet;
    if (R.bad.length) meet = 'Here the ' + shapes + ' <b>never all meet</b> at one point: no mix of lots pays what the client wants at every level.';
    else if (R.free.length) meet = 'Here they meet along a <b>whole line</b>, not one point: many different mixes work.';
    else meet = 'Here they meet at ' + vars.map(function (v, j) { return '$' + v + ' = ' + R.x[j].tex() + '$'; }).join(", ") + ': that one mix works at <b>every</b> level at once. That point is the answer.';
    var rowCap = '<b>Row picture: one Nifty level at a time.</b><ul>' +
      '<li>The axes are <b>lots</b>: how many of ' + mixOf + ' you buy, ' + lotsVec + '.</li>' +
      '<li>Each ' + shape + ' is one Nifty level. The ' + fmtLvl(L[0]) + ' ' + shape + ' holds every mix of lots that pays exactly <b>' + tgt[0].txt() + '</b> if Nifty ends at ' + fmtLvl(L[0]) + ' (what the client wants there). Same for ' + L.slice(1).map(fmtLvl).join(" and ") + '.</li>' +
      '<li>A mix that works at one level can fail at another. You need a point on <b>all</b> the ' + shapes + '.</li>' +
      '<li>' + meet + '</li></ul>';
    var colCap = '<b>Column picture: one product at a time.</b><ul>' +
      '<li>The axes are <b>payoffs</b>: what you get if Nifty ends at ' + L.map(fmtLvl).join(" / ") + '.</li>' +
      '<li>Each arrow is <b>1 lot</b> of one product. Arrow ' + names[0] + ' points to ' + '(' + A.map(function (r) { return r[0].txt(); }).join(", ") + '): that is what 1 lot of ' + names[0] + ' pays at each level.</li>' +
      '<li>Buying more lots stretches the arrow; selling flips it. Buying two products means walking along one arrow, then the next from where you stopped.</li>' +
      '<li>The red dot is the client\'s payoff (' + tgt.map(function (t) { return t.txt(); }).join(", ") + '). ' +
        (R.bad.length ? 'No walk along these arrows reaches it: the red dot is outside what the products can build.'
          : R.free.length ? 'Several different walks end on the red dot: that is why there are many answers.'
          : 'The recipe is the walk that ends exactly on the red dot: ' + names.map(function (nm, j) { return '$' + R.x[j].tex() + '$ lot' + (R.x[j].num() === 1 ? '' : 's') + ' of ' + nm; }).join(', then ') + '.') + '</li></ul>';
    hh.push('<h4>7. Row picture and column picture</h4><div class="figs"><figure class="fig plot3d" style="margin:0"><div id="labrow" class="plot3d-box"></div><figcaption>' + rowCap + '</figcaption></figure>' +
      '<figure class="fig plot3d" style="margin:0"><div id="labcol" class="plot3d-box"></div><figcaption>' + colCap + '</figcaption></figure></div>');

    hh.push(planeGuide(A, tgt, L, n, vars, names, R));

    // 8. pricing
    var prem = P.map(function (pr) { return parseFr(pr.p); });
    hh.push('<h4>8. Price and arbitrage check</h4>');
    if (mk.auto) hh.push('<p>Premiums today come from <b>Black–Scholes</b> (Nifty ' + fmtLvl(mk.S0) + ', ' + mk.T0 + ' days, IV ' + mk.iv + '%, rate ' + mk.r + '%). Black–Scholes prices are consistent with each other, so they never create arbitrage. Untick "Auto premiums" and type real LTPs from the NSE option chain to hunt for real mispricings.</p>');
    if (prem.some(function (p) { return p === null; })) hh.push('<p>Enter a premium (in points) for every product to price the client\'s payoff and check for arbitrage.</p>');
    else {
      if (!R.bad.length) {
        var cost = ZERO; R.x.forEach(function (v, j) { cost = cost.add(v.mul(prem[j])); });
        hh.push('<table><tr><th>Leg</th><th>Lots</th><th>Premium</th><th>Cost</th></tr>' + R.x.map(function (v, j) { return '<tr><td>' + names[j] + ': ' + esc(prodLabel(P[j])) + '</td><td>$' + v.tex() + '$</td><td>' + prem[j].txt() + '</td><td>$' + v.mul(prem[j]).tex() + '$</td></tr>'; }).join("") +
          '<tr><td colspan="3"><b>Total cost today</b></td><td><b>$' + cost.tex() + '$ points</b><br>= ' + rupees(cost.num() / 100) + ' for these lots (' + mk.lot + ' quantity per lot)</td></tr></table><p class="answer">Fair price of the client\'s payoff ≈ ' + (+cost.num().toFixed(2)) + ' points (the cost of the recipe that copies it).</p>');
        var nonneg = tgt.every(function (t) { return t.n >= 0; }), somepos = tgt.some(function (t) { return t.n > 0; });
        if (nonneg && somepos && cost.n <= 0) hh.push('<div class="box pitfall"><span class="label">Arbitrage!</span><p>The client\'s payoff <b>never loses</b> and sometimes pays, yet copying it costs <b>' + (+cost.num().toFixed(2)) + ' points</b> today (zero or negative). Buy the recipe: you are paid (or pay nothing) now and can only gain at expiry. These premiums are inconsistent: a butterfly, for example, must always cost more than zero.</p></div>');
        (R.nulls || []).forEach(function (z) {
          var zc = ZERO; z.forEach(function (v, j) { zc = zc.add(v.mul(prem[j])); });
          if (zc.isZero()) hh.push('<p><b>No arbitrage:</b> the zero-payoff trade costs 0, as it should. The premiums are consistent.</p>');
          else {
            var rev = zc.n > 0 ? z.map(function (v) { return v.neg(); }) : z, gain = zc.n > 0 ? zc : zc.neg();
            hh.push('<div class="box pitfall"><span class="label">Arbitrage!</span><p>The trade ' + esc(tradeTxt(rev)) + ' pays <b>0 in every scenario</b>, but you <b>receive ' + gain.txt() + ' points today</b> for it. Free money: the premiums break the rule "zero payoff ⇒ zero price" (e.g. put–call parity).</p></div>');
          }
        });
      } else {
        var cc = closest.reduce(function (sm, v, j) { return sm + v * prem[j].num(); }, 0);
        hh.push('<p>The payoff can\'t be copied exactly, so these products give it no single "fair" price. The closest hedge costs ≈ <b>' + (+cc.toFixed(2)) + ' points</b>; the miss is unhedgeable risk the seller must charge extra for.</p>');
      }
    }

    h.push('<div id="labreveal-wrap"' + (hidden ? ' hidden' : '') + '>' + hh.join("") + '</div>');
    out.innerHTML = h.join("");

    if (state.challenge) {
      el("labreveal").addEventListener("click", function () { state.revealed = !state.revealed; render(); });
      el("labcheck").addEventListener("click", function () {
        var gs = vars.map(function (_, j) { return parseFr(el("labg" + j).value); });
        if (gs.some(function (g) { return g === null; })) { el("labgout").innerHTML = "<p>Fill in every guess.</p>"; return; }
        var ok = true, rows = A.map(function (row, i) {
          var tot = row.reduce(function (s, a, j) { return s.add(a.mul(gs[j])); }, ZERO), hit = tot.sub(tgt[i]).isZero(); ok = ok && hit;
          return '<tr><td>' + fmtLvl(L[i]) + '</td><td>' + tot.txt() + '</td><td>' + tgt[i].txt() + '</td><td>' + (hit ? "✓" : "✗") + '</td></tr>';
        }).join("");
        el("labgout").innerHTML = '<table><tr><th>Nifty at</th><th>Your mix pays</th><th>Client wants</th><th></th></tr>' + rows + '</table><p class="answer">' + (ok ? "Correct! Your recipe copies the client's payoff." : "Not yet: some scenarios miss. Adjust and try again, or reveal the answer.") + '</p>';
        typeset(el("labgout"));
      });
    }
    typeset(out);
    if (!hidden) drawPlots(A, tgt, R, n);
  }

  function typeset(node) {
    if (window.renderMathInElement) {
      renderMathInElement(node, { delimiters: [{ left: "$$", right: "$$", display: true }, { left: "$", right: "$", display: false }], throwOnError: false });
    } else setTimeout(function () { typeset(node); }, 300);
  }

  // ---------- pictures ----------
  function drawPlots(A, tgt, R, n) {
    if (!window.Plotly) { setTimeout(function () { drawPlots(A, tgt, R, n); }, 300); return; }
    var col = ["--def-b", "--ex-b", "--int-b"].map(cssv), red = cssv("--warn-b"), ink = cssv("--ink"), soft = cssv("--ink-soft"), rule = cssv("--rule"), paper2 = cssv("--paper-2");
    var An = A.map(function (r) { return r.map(function (v) { return v.num(); }); }), bn = tgt.map(function (v) { return v.num(); });
    var x = R.x ? R.x.map(function (v) { return v.num(); }) : null;
    var cfg = { responsive: true, displaylogo: false, modeBarButtonsToRemove: ["toImage"] };
    var base = { margin: { l: 50, r: 10, t: 10, b: 60 }, paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(0,0,0,0)", showlegend: true,
      legend: { orientation: "h", x: 0, y: -0.12, yanchor: "top", font: { color: ink, size: 11 } }, font: { color: ink } };
    function ax(t, lo, hi) {
      return { title: { text: t }, range: [lo, hi], autorange: false, tickmode: "linear", tick0: 0, dtick: nice(hi - lo), gridcolor: rule,
        zeroline: true, zerolinecolor: soft, zerolinewidth: 2, fixedrange: true, showbackground: true, backgroundcolor: paper2, color: soft };
    }
    var names = NAMES.slice(0, n), L = state.levels;
    var cx = x || new Array(n).fill(0), R0 = 4;

    if (n === 2) {
      // row picture: lines a1 x + a2 y = b
      var xr = [cx[0] - R0, cx[0] + R0], yr = [cx[1] - R0, cx[1] + R0], rowT = [];
      An.forEach(function (r, i) {
        var t = { type: "scatter", mode: "lines", name: "at " + fmtLvl(L[i]), line: { color: col[i], width: 3 } };
        if (Math.abs(r[1]) > 1e-12) { t.x = xr; t.y = xr.map(function (xx) { return (bn[i] - r[0] * xx) / r[1]; }); }
        else if (Math.abs(r[0]) > 1e-12) { t.x = [bn[i] / r[0], bn[i] / r[0]]; t.y = yr; }
        else { t.x = []; t.y = []; }
        rowT.push(t);
      });
      if (x) rowT.push({ type: "scatter", mode: "markers+text", name: "answer", marker: { color: red, size: 11 }, x: [x[0]], y: [x[1]], text: ["(" + x.map(function (v) { return +v.toFixed(2); }).join(", ") + ")"], textposition: "top right", textfont: { color: red } });
      var l1 = Object.assign({}, base, { xaxis: ax("lots of A (x)", xr[0], xr[1]), yaxis: ax("lots of B (y)", yr[0], yr[1]) });
      Plotly.react("labrow", rowT, l1, cfg);

      // column picture: arrows
      var pts = [[0, 0], [An[0][0], An[1][0]], [An[0][1], An[1][1]], [bn[0], bn[1]]], ann = [], colT = [];
      function arrow(a, b, c, dash) { ann.push({ x: b[0], y: b[1], ax: a[0], ay: a[1], xref: "x", yref: "y", axref: "x", ayref: "y", showarrow: true, arrowhead: 3, arrowsize: 1.3, arrowwidth: 3, arrowcolor: c, opacity: dash ? 0.45 : 1 }); }
      arrow([0, 0], pts[1], col[0], !!x); arrow([0, 0], pts[2], col[1], !!x);
      colT.push({ type: "scatter", mode: "lines", name: "A (column 1)", line: { color: col[0], width: 3 }, x: [null], y: [null] });
      colT.push({ type: "scatter", mode: "lines", name: "B (column 2)", line: { color: col[1], width: 3 }, x: [null], y: [null] });
      if (x) {
        var p1 = [x[0] * An[0][0], x[0] * An[1][0]], p2 = [p1[0] + x[1] * An[0][1], p1[1] + x[1] * An[1][1]];
        arrow([0, 0], p1, col[0]); arrow(p1, p2, col[1]); pts.push(p1, p2);
      } else if (R.rank === 1) {
        var d = R.pivots[0], v = [An[0][d], An[1][d]], s = 10;
        colT.push({ type: "scatter", mode: "lines", name: "everything A, B can reach", line: { color: soft, width: 2, dash: "dot" }, x: [-s * v[0], s * v[0]], y: [-s * v[1], s * v[1]] });
      }
      colT.push({ type: "scatter", mode: "markers+text", name: "client target", marker: { color: red, size: 12 }, x: [bn[0]], y: [bn[1]], text: ["target"], textposition: "bottom right", textfont: { color: red } });
      var xs = pts.map(function (p) { return p[0]; }), ys = pts.map(function (p) { return p[1]; });
      var lo = Math.floor(Math.min.apply(null, xs.concat(ys)) - 1), hi = Math.ceil(Math.max.apply(null, xs.concat(ys)) + 1);
      var l2 = Object.assign({}, base, { annotations: ann, xaxis: ax("pays at " + fmtLvl(L[0]), lo, hi), yaxis: ax("pays at " + fmtLvl(L[1]), lo, hi) });
      Plotly.react("labcol", colT, l2, cfg);
    } else {
      var sc = function (t, lo, hi, eye) {
        return { xaxis: ax(t[0], lo[0], hi[0]), yaxis: ax(t[1], lo[1], hi[1]), zaxis: ax(t[2], lo[2], hi[2]), aspectmode: "cube",
          dragmode: "turntable", camera: { eye: eye, up: { x: 0, y: 0, z: 1 } } };
      };
      // row picture: planes
      var lo3 = cx.map(function (v) { return v - R0; }), hi3 = cx.map(function (v) { return v + R0; }), rowP = [];
      An.forEach(function (r, i) {
        var k = [0, 1, 2].reduce(function (bi, j) { return Math.abs(r[j]) > Math.abs(r[bi]) ? j : bi; }, 0);
        if (Math.abs(r[k]) < 1e-12) return;
        var o = [0, 1, 2].filter(function (j) { return j !== k; }), corners = [];
        [[0, 0], [1, 0], [1, 1], [0, 1]].forEach(function (cc) {
          var p = [0, 0, 0]; p[o[0]] = cc[0] ? hi3[o[0]] : lo3[o[0]]; p[o[1]] = cc[1] ? hi3[o[1]] : lo3[o[1]];
          p[k] = (bn[i] - r[o[0]] * p[o[0]] - r[o[1]] * p[o[1]]) / r[k]; corners.push(p);
        });
        rowP.push({ type: "mesh3d", name: "at " + fmtLvl(L[i]), showlegend: true, opacity: 0.35, color: col[i], flatshading: true, hoverinfo: "name",
          x: corners.map(function (p) { return p[0]; }), y: corners.map(function (p) { return p[1]; }), z: corners.map(function (p) { return p[2]; }), i: [0, 0], j: [1, 2], k: [2, 3] });
      });
      if (x) rowP.push({ type: "scatter3d", mode: "markers+text", name: "answer", marker: { color: red, size: 7 }, x: [x[0]], y: [x[1]], z: [x[2]], text: ["(" + x.map(function (v) { return +v.toFixed(2); }).join(", ") + ")"], textposition: "top right", textfont: { color: red, size: 13 } });
      var lr = Object.assign({}, base, { margin: { l: 0, r: 0, t: 0, b: 60 }, scene: sc(["lots A (x)", "lots B (y)", "lots C (z)"], lo3, hi3, { x: 1.6, y: -1.5, z: 0.9 }) });
      Plotly.react("labrow", rowP, lr, cfg);

      // column picture: chained arrows
      var cols3 = [0, 1, 2].map(function (j) { return [An[0][j], An[1][j], An[2][j]]; }), colP = [], allPts = [[0, 0, 0], bn];
      if (x) {
        var cur = [0, 0, 0];
        cols3.forEach(function (c, j) {
          var nxt = [cur[0] + x[j] * c[0], cur[1] + x[j] * c[1], cur[2] + x[j] * c[2]];
          colP.push({ type: "scatter3d", mode: "lines+markers", name: (+x[j].toFixed(2)) + " × " + names[j], line: { color: col[j], width: 8 }, marker: { size: [2, 5], color: col[j] }, x: [cur[0], nxt[0]], y: [cur[1], nxt[1]], z: [cur[2], nxt[2]] });
          allPts.push(nxt); cur = nxt;
        });
      } else {
        cols3.forEach(function (c, j) {
          colP.push({ type: "scatter3d", mode: "lines+markers", name: names[j] + " (column " + (j + 1) + ")", line: { color: col[j], width: 7 }, marker: { size: [2, 5], color: col[j] }, x: [0, c[0]], y: [0, c[1]], z: [0, c[2]] });
          allPts.push(c);
        });
        if (R.rank === 2) {
          var u = cols3[R.pivots[0]], w = cols3[R.pivots[1]], s3 = 3, q = [[-s3, -s3], [s3, -s3], [s3, s3], [-s3, s3]].map(function (ab) { return [ab[0] * u[0] + ab[1] * w[0], ab[0] * u[1] + ab[1] * w[1], ab[0] * u[2] + ab[1] * w[2]]; });
          colP.push({ type: "mesh3d", name: "everything the products can reach", opacity: 0.2, color: soft, hoverinfo: "name", showlegend: true, x: q.map(function (p) { return p[0]; }), y: q.map(function (p) { return p[1]; }), z: q.map(function (p) { return p[2]; }), i: [0, 0], j: [1, 2], k: [2, 3] });
        }
      }
      colP.push({ type: "scatter3d", mode: "markers+text", name: "client target", marker: { color: red, size: 8 }, x: [bn[0]], y: [bn[1]], z: [bn[2]], text: ["target"], textposition: "top center", textfont: { color: red, size: 13 } });
      var flat = [].concat.apply([], allPts), lo = Math.floor(Math.min.apply(null, flat) - 1), hi = Math.ceil(Math.max.apply(null, flat) + 1);
      var lc = Object.assign({}, base, { margin: { l: 0, r: 0, t: 0, b: 60 }, scene: sc(["pays at " + fmtLvl(L[0]), "pays at " + fmtLvl(L[1]), "pays at " + fmtLvl(L[2])], [lo, lo, lo], [hi, hi, hi], { x: 1.6, y: -1.6, z: 0.9 }) });
      Plotly.react("labcol", colP, lc, cfg);
    }
  }

  // ---------- start ----------
  function start() {
    var root = el("replab"); if (!root) return;
    var q = (location.search.match(/labpreset=(\w+)/) || [])[1] || root.getAttribute("data-preset");
    var qd = (location.search.match(/labdays=(\d+)/) || [])[1]; if (qd) state.mkt.Tn = +qd;
    if (q && PRESETS[q]) { var keepTn = state.mkt.Tn; loadPreset(q); if (qd) { state.mkt.Tn = keepTn; buildControls(root); readUI(); render(); } }
    else { var P = PRESETS.ex2; state.products = P.products.map(function (p) { return Object.assign({}, p); }); state.target = P.target.slice(); state.mkt.auto = true; buildControls(root); readUI(); render(); }
    document.querySelectorAll(".tabs button[data-tab]").forEach(function (b) {
      b.addEventListener("click", function () { setTimeout(function () { if (window.Plotly) ["labrow", "labcol"].forEach(function (id) { if (el(id)) Plotly.Plots.resize(id); }); }, 0); });
    });
  }
  if (document.readyState === "complete") start(); else window.addEventListener("load", start);
})();
