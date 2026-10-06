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


  // ---------- inverse mode (Lecture 04 lab: <div id="replab" data-inv>) ----------
  function eyeN(n) { var I = []; for (var i = 0; i < n; i++) { I.push([]); for (var j = 0; j < n; j++) I[i].push(i === j ? ONE : ZERO); } return I; }
  function mTex(Mx) { return "\\begin{bmatrix}" + Mx.map(function (r) { return r.map(function (v) { return v.tex(); }).join(" & "); }).join(" \\\\ ") + "\\end{bmatrix}"; }
  function augI(M, I) {
    var c = ""; for (var i = 0; i < M.length; i++) c += "c";
    return "\\left[\\begin{array}{" + c + "|" + c + "}" + M.map(function (r, i) { return r.concat(I[i]).map(function (v) { return v.tex(); }).join(" & "); }).join(" \\\\ ") + "\\end{array}\\right]";
  }
  function matMul(X, Y) { return X.map(function (r) { return Y[0].map(function (_, j) { return r.reduce(function (s, a, k) { return s.add(a.mul(Y[k][j])); }, ZERO); }); }); }
  function gaussJordan(A) {
    var n = A.length, M = A.map(function (r) { return r.slice(); }), I = eyeN(n), steps = [];
    function snap() { return { M: M.map(function (r) { return r.slice(); }), I: I.map(function (r) { return r.slice(); }) }; }
    for (var c = 0; c < n; c++) {
      if (M[c][c].isZero()) {
        var k = -1; for (var i = c + 1; i < n; i++) if (!M[i][c].isZero()) { k = i; break; }
        if (k < 0) return { steps: steps, singular: true, col: c };
        var t = M[c]; M[c] = M[k]; M[k] = t; t = I[c]; I[c] = I[k]; I[k] = t;
        steps.push(Object.assign({ kind: "swap", r1: c, r2: k, col: c }, snap()));
      }
      var piv = M[c][c];
      if (!piv.sub(ONE).isZero()) {
        M[c] = M[c].map(function (v) { return v.div(piv); }); I[c] = I[c].map(function (v) { return v.div(piv); });
        steps.push(Object.assign({ kind: "scale", row: c, piv: piv }, snap()));
      }
      for (var r = 0; r < n; r++) {
        if (r === c || M[r][c].isZero()) continue;
        var mult = M[r][c];
        M[r] = M[r].map(function (v, j) { return v.sub(M[c][j].mul(mult)); });
        I[r] = I[r].map(function (v, j) { return v.sub(I[c][j].mul(mult)); });
        steps.push(Object.assign({ kind: "elim", row: r, prow: c, col: c, mult: mult }, snap()));
      }
    }
    return { steps: steps, inv: I };
  }

  function invSections(A, tgt, L, n, vars, names, R, tradeTxt) {
    var h = [], lv = L.map(fmtLvl);
    function vtx(v) { return "\\begin{bmatrix}" + v.map(function (x) { return x.tex(); }).join("\\\\") + "\\end{bmatrix}"; }
    function col(Mx, j) { return Mx.map(function (r) { return r[j]; }); }
    function mulV(Mx, v) { return Mx.map(function (r) { return r.reduce(function (s, a, k) { return s.add(a.mul(v[k])); }, ZERO); }); }
    function paren(v) { return v.num() < 0 ? "(" + v.tex() + ")" : v.tex(); }

    // 4. multiplication
    var useAns = R.x && !R.bad.length && !R.free.length, xs = useAns ? R.x : vars.map(function () { return ONE; });
    var got = mulV(A, xs);
    h.push('<h4>4. Multiplication: lots in, payoffs out</h4>');
    h.push('<p>Multiplying the payoff matrix $A$ by a list of lots $x$ gives what the whole position pays at every level. Take ' + (useAns ? 'the answer' : 'a test position') + ' $x = ' + vtx(xs) + '$ (' + esc(tradeTxt(xs)) + ').</p>');
    h.push('<ol class="step-list kid-step"><li><p class="k"><span class="kl">Way 1: by rows</span> One Nifty level at a time: row of $A$ times $x$ (multiply matching numbers, then add).</p><ul>' +
      A.map(function (r, i) { return '<li>At ' + lv[i] + ': $' + r.map(function (a, k) { return paren(a) + '\\times' + paren(xs[k]); }).join(" + ") + ' = ' + got[i].tex() + '$</li>'; }).join("") + '</ul></li>');
    h.push('<li><p class="k"><span class="kl">Way 2: by columns</span> One product at a time: lots × that product\'s payoff column, then add the columns.</p>' +
      '$$' + xs.map(function (v, j) { return paren(v) + vtx(col(A, j)); }).join(" + ") + ' = ' + vtx(got) + '$$' +
      '<p class="k"><span class="kl">Same answer</span> Both ways give (' + got.map(function (v) { return v.txt(); }).join(", ") + ')' + (useAns ? ', exactly what the client wants.' : '.') + '</p>' +
      '<p class="k"><span class="kl">Market meaning</span> Rows = "what do I get if Nifty ends here?". Columns = "add up what each product contributes".</p></li></ol>');

    // 5. Gauss-Jordan
    var G = gaussJordan(A);
    h.push('<h4>5. The inverse $A^{-1}$ by Gauss–Jordan</h4><p>Put the identity $I$ next to $A$ and do row moves until the left side becomes $I$. Whatever the right side has become is $A^{-1}$.</p>$$' + augI(A, eyeN(n)) + '$$');
    var sn = 1;
    G.steps.forEach(function (s) {
      var txt;
      if (s.kind === "swap") txt = 'The pivot spot (row ' + (s.r1 + 1) + ', column ' + (s.col + 1) + ') is 0. Swap rows ' + (s.r1 + 1) + ' and ' + (s.r2 + 1) + ' on both sides.';
      else if (s.kind === "scale") txt = 'Make the pivot 1: divide row ' + (s.row + 1) + ' by $' + s.piv.tex() + '$ on both sides. (At the end the left side must be $I$, which has 1s on the diagonal.)';
      else txt = 'Clear column ' + (s.col + 1) + ' in row ' + (s.row + 1) + ' (' + (s.row < s.prow ? 'above' : 'below') + ' the pivot): row ' + (s.row + 1) + ' $-\\,' + paren(s.mult) + '\\times$ row ' + (s.prow + 1) + ', on both sides. (In $I$, everything off the diagonal is 0.)';
      h.push('<p><b>Step ' + (sn++) + '.</b> ' + txt + '</p>$$' + augI(s.M, s.I) + '$$');
    });
    if (G.singular) {
      h.push('<div class="box pitfall"><span class="label">No inverse</span><p>Column ' + (G.col + 1) + ' (product ' + names[G.col] + ') has no pivot: after clearing, every number from row ' + (G.col + 1) + ' down is 0. So $A$ is <b>singular</b>: some product is a mix of the others, or the products can\'t reach every level on their own. ' +
        '$A^{-1}$ does not exist, so there is no one-shot recipe for every client. Use elimination (Lecture 03) and the nullspace (Lecture 08) instead. Try a ready-made market with independent products, e.g. the Lecture example or the butterfly.</p></div>');
      return h.join("");
    }
    var Ai = G.inv;
    h.push('<p class="answer">The left side is $I$, so $A^{-1} = ' + mTex(Ai) + '$.</p>');

    // 6. meaning of A^-1: it swaps the roles of levels and products
    function payLine(c) {   // what the trade c pays, level by level, with the arithmetic
      return A.map(function (r, i) {
        var v = r.reduce(function (sm, a, k) { return sm.add(a.mul(c[k])); }, ZERO);
        return '<li>At ' + lv[i] + ': $' + r.map(function (a, k) { return paren(c[k]) + '\\times' + paren(a); }).join(" + ") + ' = ' + v.tex() + '$</li>';
      }).join("");
    }
    h.push('<h4>6. What $A^{-1}$ means: one ticket per Nifty level</h4><ol class="step-list kid-step">');
    h.push('<li><p class="k"><span class="kl">$A$ and $A^{-1}$ swap jobs</span> $A$ turns <b>lots into payoffs</b>. $A^{-1}$ does the opposite: it turns <b>payoffs into lots</b>. So the labels swap too:</p>' +
      '<table><tr><th></th><th>Rows are</th><th>Columns are</th><th>Job</th></tr>' +
      '<tr><td>$A$</td><td>Nifty levels (' + lv.join(", ") + ')</td><td>products (' + names.join(", ") + ')</td><td>lots → payoffs</td></tr>' +
      '<tr><td>$A^{-1}$</td><td>products (' + names.join(", ") + ')</td><td>Nifty levels (' + lv.join(", ") + ')</td><td>payoffs → lots</td></tr></table></li>');
    h.push('<li><p class="k"><span class="kl">Read it with labels</span> Each <b>column</b> belongs to one Nifty level. Read it top to bottom: it is a list of lots of ' + names.join(", ") + '.</p>' +
      '<table><tr><th></th>' + lv.map(function (x) { return '<th>column for ' + x + '</th>'; }).join("") + '</tr>' +
      names.map(function (nm, k) { return '<tr><td>lots of ' + nm + '</td>' + L.map(function (_, j) { return '<td>$' + Ai[k][j].tex() + '$</td>'; }).join("") + '</tr>'; }).join("") + '</table>' +
      '<p class="k"><span class="kl">Careful</span> Use the columns. A row of $A^{-1}$ is not a trade by itself.</p></li>');
    L.forEach(function (S, j) {
      var c = col(Ai, j);
      h.push('<li><p class="k"><span class="kl">Column for ' + lv[j] + '</span> Lots $' + vtx(c) + '$: ' + esc(tradeTxt(c)) + '.</p>' +
        '<p class="k"><span class="kl">What it pays</span> Lots × what each product pays at that level, added up:</p><ul>' + payLine(c) + '</ul>' +
        '<p class="k"><span class="kl">What we have now</span> It pays <b>1 at ' + lv[j] + '</b> and 0 at the other level' + (n > 2 ? 's' : '') + '. This trade is <b>ticket T' + (j + 1) + '</b>: "1 unit if Nifty ends at ' + lv[j] + '".</p></li>');
    });
    h.push('<li><p class="k"><span class="kl">Why this always works</span> $A \\times A^{-1} = I$. Column $j$ of that product is $A \\times$ (column $j$ of $A^{-1}$) = what column $j$\'s trade pays, and column $j$ of $I$ is "1 in spot $j$, 0 elsewhere". So every column of $A^{-1}$ must be a ticket.</p></li></ol>');

    // 7. build the client from tickets: x = A^-1 b
    var xi = mulV(Ai, tgt);
    h.push('<h4>7. Build the client from tickets: $x = A^{-1} b$</h4><ol class="step-list kid-step">');
    h.push('<li><p class="k"><span class="kl">Read the wish as tickets</span> The client wants ' + tgt.map(function (t, i) { return t.txt() + ' at ' + lv[i]; }).join(", ") + '. Each ticket pays 1 at its level, so take ' +
      tgt.map(function (t, i) { return '<b>' + t.txt() + ' × T' + (i + 1) + '</b>'; }).join(" + ") + '.</p>' +
      '<p class="k"><span class="kl">Units</span> Here "1" = 100 Nifty points per quantity. With a lot size of ' + state.mkt.lot + ', "1" on 1 lot = ' + rupees(1) + ', so ' + tgt.map(function (t) { return t.txt(); }).join(" / ") + ' means ' + tgt.map(function (t) { return rupees(t.num()); }).join(" / ") + ' per lot. If the client gives rupees, first divide by (100 × lot size).</p></li>');
    h.push('<li><p class="k"><span class="kl">Add up the lots</span> One product at a time: (tickets wanted) × (that ticket\'s lots of the product), then add across.</p>' +
      '<table><tr><th>Product</th>' + tgt.map(function (t, j) { return '<th>' + t.txt() + ' × T' + (j + 1) + '</th>'; }).join("") + '<th>Total lots</th></tr>' +
      names.map(function (nm, k) {
        return '<tr><td>' + nm + '</td>' + tgt.map(function (t, j) { return '<td>$' + paren(t) + '\\times' + paren(Ai[k][j]) + ' = ' + t.mul(Ai[k][j]).tex() + '$</td>'; }).join("") + '<td><b>$' + xi[k].tex() + '$</b></td></tr>';
      }).join("") + '</table>' +
      '<p class="k"><span class="kl">What we have now</span> ' + esc(tradeTxt(xi)) + '.</p></li>');
    h.push('<li><p class="k"><span class="kl">This is $A^{-1}b$</span> Each row of that table is one row of $A^{-1}$ times the client\'s list $b$. For ' + names[0] + ': $(' + Ai[0].map(function (v) { return v.tex(); }).join(", ") + ') \\cdot (' + tgt.map(function (t) { return t.tex(); }).join(", ") + ') = ' + xi[0].tex() + '$.</p>' +
      '$$x = A^{-1}b = ' + mTex(Ai) + vtx(tgt) + ' = ' + vtx(xi) + '$$</li>');
    h.push('<li><p class="k"><span class="kl">Check</span> What these lots pay, level by level:</p><ul>' + payLine(xi) + '</ul><p class="k"><span class="kl">Result</span> Exactly (' + tgt.map(function (t) { return t.txt(); }).join(", ") + '), what the client wanted ✓.</p></li></ol>');

    // 8. check A A^-1 = I
    var AAi = matMul(A, Ai);
    h.push('<h4>8. Check: $A\\,A^{-1} = I$ (row times column)</h4><p>Entry (row $i$, column $j$) of the product = row $i$ of $A$ times column $j$ of $A^{-1}$. It must be 1 on the diagonal and 0 elsewhere.</p><table><tr><th>Entry</th><th>Row of $A$ × column of $A^{-1}$</th><th>Result</th></tr>' +
      A.map(function (r, i) { return Ai[0].map(function (_, j) {
        var c = col(Ai, j), v = AAi[i][j], want = i === j ? 1 : 0;
        return '<tr><td>(' + (i + 1) + ', ' + (j + 1) + ')</td><td>$' + r.map(function (a, k) { return paren(a) + '\\times' + paren(c[k]); }).join(" + ") + '$</td><td>$' + v.tex() + '$ ' + (Math.abs(v.num() - want) < 1e-9 ? '✓' : '✗') + '</td></tr>';
      }).join(""); }).join("") + '</table>');

    // 9. many clients: AX = B
    var shapes = n === 3 ? [tgt, [new Fr(2), ZERO, new Fr(2)], [ZERO, ONE, new Fr(3)]] : [tgt, [new Fr(2), ZERO], [ZERO, new Fr(2)]];
    var labels = n === 3 ? ["your client", "straddle shape", "rally bet"] : ["your client", "down bet", "up bet"];
    var B = tgt.map(function (_, i) { return shapes.map(function (sh) { return sh[i]; }); }), X = matMul(Ai, B);
    h.push('<h4>9. Many clients at once: $X = A^{-1} B$</h4><p>Put several clients\' wishes side by side as the columns of $B$. One matrix multiplication gives every recipe at once: column $k$ of $X$ is the recipe for client $k$.</p>' +
      '$$X = A^{-1}B = ' + mTex(Ai) + mTex(B) + ' = ' + mTex(X) + '$$' +
      '<table><tr><th>Client</th><th>Wants at ' + lv.join(" / ") + '</th><th>Recipe (column of $X$)</th></tr>' +
      shapes.map(function (sh, k) { return '<tr><td>' + labels[k] + '</td><td>' + sh.map(function (v) { return v.txt(); }).join(" / ") + '</td><td>' + esc(tradeTxt(col(X, k))) + '</td></tr>'; }).join("") + '</table>' +
      '<p>This is why desks like $A^{-1}$: work it out once, then every new client is just a multiplication.</p>');
    return h.join("");
  }

  function statePrices(Ai, prem, tgt, L, names, P) {
    var lv = L.map(fmtLvl), n = L.length, h = [];
    var q = L.map(function (_, j) { return prem.reduce(function (s, p, k) { return s.add(p.mul(Ai[k][j])); }, ZERO); });
    h.push('<h4>12. State prices: what each ticket costs today</h4><p>Ticket $j$ (column $j$ of $A^{-1}$) pays 1 only if Nifty ends at level $j$. Its price today = its lots × the premiums, added up. These prices are called <b>state prices</b> $q$.</p>' +
      '<table><tr><th>Ticket</th><th>Lots × premiums</th><th>Price today $q$</th></tr>' +
      L.map(function (S, j) {
        return '<tr><td>pays 1 at ' + lv[j] + '</td><td>$' + prem.map(function (p, k) { var a = Ai[k][j]; return (a.num() < 0 ? '(' + a.tex() + ')' : a.tex()) + '\\times' + p.tex(); }).join(" + ") + '$</td><td><b>$' + q[j].tex() + '$</b></td></tr>';
      }).join("") + '</table>');
    var neg = q.map(function (v, j) { return v.num() <= 0 ? j : -1; }).filter(function (j) { return j >= 0; });
    // a ticket only pays 1-or-0 at the chosen levels; check what it pays just outside them before calling it arbitrage
    var gap = n > 1 ? L[1] - L[0] : 100, outside = [L[0] - gap, L[n - 1] + gap];
    function ticketPays(j, S) { return P.reduce(function (sm, pr, k) { return sm + Ai[k][j].num() * valuePts(pr, S, 0) / 100; }, 0); }
    neg.forEach(function (j) {
      var losses = outside.map(function (S) { return { S: S, v: ticketPays(j, S) }; }).filter(function (o) { return o.v < -1e-9; });
      if (!losses.length) h.push('<div class="box pitfall"><span class="label">Arbitrage!</span><p>The ticket for ' + lv[j] + ' pays 1 or 0 at the chosen levels, and nothing negative just outside them either, yet it costs ' + q[j].txt() + ' today (zero or negative). Buy it: free money. The premiums are inconsistent.</p></div>');
      else h.push('<div class="box intuition"><span class="label">Negative price, but not free money</span><p>The ticket for ' + lv[j] + ' costs ' + q[j].txt() + ' today, which looks like free money. But it only pays "1 or 0" if Nifty ends <b>exactly</b> at ' + lv.join(", ") + '. ' +
        losses.map(function (o) { return 'If Nifty ends at ' + fmtLvl(o.S) + ' it pays ' + (+o.v.toFixed(2)) + ' (' + Math.round(o.v * 100) + ' points): a loss'; }).join('; ') + '. ' +
        'Real Nifty can end anywhere, so this is <b>not</b> an arbitrage. The negative price shows that a model with only ' + n + ' levels is too simple for these ' + (state.mkt.auto ? 'Black–Scholes' : '') + ' premiums. Real desks read state prices from butterflies on closely spaced strikes, where the "just outside" losses are tiny.</p></div>');
    });
    if (!neg.length) h.push('<p>All state prices are positive: no arbitrage from these tickets.</p>');
    var price = tgt.reduce(function (s, b, i) { return s.add(b.mul(q[i])); }, ZERO);
    h.push('<p class="answer">Any payoff\'s price = (what it pays at each level) × (that level\'s state price), added up. Your client: $' + tgt.map(function (b, i) { return (b.num() < 0 ? '(' + b.tex() + ')' : b.tex()) + '\\times' + (q[i].num() < 0 ? '(' + q[i].tex() + ')' : q[i].tex()); }).join(" + ") + ' = ' + price.tex() + '$ points, the same as the recipe\'s cost in section 11.</p>');
    return h.join("");
  }


  // ---------- LU mode (Lecture 05 lab: <div id="replab" data-lu>) ----------
  function luFactor(A) {
    var n = A.length, M = A.map(function (r) { return r.slice(); }), Lm = [], perm = [], steps = [], swaps = 0, zeroPiv = -1;
    for (var i = 0; i < n; i++) { Lm.push([]); perm.push(i); for (var j = 0; j < n; j++) Lm[i].push(ZERO); }
    for (var c = 0; c < n; c++) {
      if (M[c][c].isZero()) {
        var k = -1; for (var r = c + 1; r < n; r++) if (!M[r][c].isZero()) { k = r; break; }
        if (k < 0) { steps.push({ kind: "nopivot", col: c }); if (zeroPiv < 0) zeroPiv = c; continue; }
        var t = M[c]; M[c] = M[k]; M[k] = t; t = perm[c]; perm[c] = perm[k]; perm[k] = t;
        for (var q = 0; q < c; q++) { t = Lm[c][q]; Lm[c][q] = Lm[k][q]; Lm[k][q] = t; }
        swaps++; steps.push({ kind: "swap", r1: c, r2: k, col: c, U: M.map(function (x) { return x.slice(); }) });
      }
      for (var r2 = c + 1; r2 < n; r2++) {
        var mult = M[r2][c].div(M[c][c]), before = M[r2].slice();
        Lm[r2][c] = mult;
        if (mult.isZero()) { steps.push({ kind: "zero", row: r2, prow: c, col: c }); continue; }
        M[r2] = M[r2].map(function (v, j) { return v.sub(M[c][j].mul(mult)); });
        steps.push({ kind: "elim", row: r2, prow: c, col: c, piv: M[c][c], remove: before[c], mult: mult, before: before, after: M[r2].slice() });
      }
    }
    for (var d = 0; d < n; d++) Lm[d][d] = ONE;
    return { L: Lm, U: M, perm: perm, steps: steps, swaps: swaps, zeroPiv: zeroPiv };
  }


  var luPics = null;
  function drawLuPics(D) {
    if (!window.Plotly) { setTimeout(function () { drawLuPics(D); }, 300); return; }
    function cssv(v) { return getComputedStyle(document.documentElement).getPropertyValue(v).trim(); }
    var col = [cssv("--accent"), cssv("--ex-b"), cssv("--thm-b")], red = cssv("--warn-b"), ink = cssv("--ink"), soft = cssv("--ink-soft"), rule = cssv("--rule"), paper2 = cssv("--paper-2");
    var vcol = [cssv("--def-b"), cssv("--int-b"), red];
    var cfg = { responsive: true, displaylogo: false, modeBarButtonsToRemove: ["toImage"] };
    var n = D.n, Lv = D.Lv, gap = n > 1 ? Lv[1] - Lv[0] : 100, lo = Lv[0] - gap, hi = Lv[n - 1] + gap, xs = [];
    for (var S = lo; S <= hi + 1e-9; S += Math.max(1, gap / 20)) xs.push(Math.round(S));
    function payS(j, S) { return valuePts(D.P[j], S, D.Tn) / 100; }
    function num(v) { return v.num(); }
    function ax(t, r, dt) { var o = { title: { text: t, font: { color: ink, size: 13 } }, tickfont: { color: soft, size: 11 }, gridcolor: rule, zeroline: true, zerolinecolor: soft, fixedrange: true, tickformat: ",d" }; if (r) { o.range = r; o.autorange = false; } if (dt) { o.tickmode = "linear"; o.dtick = dt; } return o; }
    var base = { paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: paper2, margin: { l: 60, r: 20, t: 20, b: 70 }, legend: { orientation: "h", y: -0.25, font: { color: ink } } };
    function yr(vals) { var mn = Math.min.apply(null, vals.concat([0])), mx = Math.max.apply(null, vals.concat([0])); return [Math.floor(mn) - 0.5, Math.ceil(mx) + 0.5]; }
    // 1
    var t1 = [], all1 = [];
    D.names.forEach(function (nm, j) {
      var ys = xs.map(function (S) { return payS(j, S); }); all1 = all1.concat(ys);
      t1.push({ type: "scatter", mode: "lines", name: nm + ": " + prodLabel(D.P[j]), x: xs, y: ys, line: { color: col[j], width: 3 } });
      t1.push({ type: "scatter", mode: "markers", showlegend: false, x: Lv, y: D.A.map(function (r) { return num(r[j]); }), marker: { color: col[j], size: 10 } });
    });
    Plotly.newPlot("lablu1", t1, Object.assign({}, base, { xaxis: ax("Nifty", [lo, hi], gap), yaxis: ax("payoff (points ÷ 100)", yr(all1), 1) }), cfg);
    // 2
    if (D.bend && document.getElementById("lablu2")) {
      var t2 = [], ann2 = [], lay2 = Object.assign({}, base, { meta: { noFrame: true }, showlegend: false, annotations: ann2, margin: { l: 40, r: 10, t: 90, b: 50 } }), allv = [];
      D.A.forEach(function (r) { r.forEach(function (v) { allv.push(num(v)); }); });
      D.names.forEach(function (nm, j) {
        var v = D.A.map(function (r) { return num(r[j]); }), mid = (v[0] + v[2]) / 2, bend = v[0] - 2 * v[1] + v[2], xa = "x" + (j ? j + 1 : ""), ya = "y" + (j ? j + 1 : ""), dom = [j / 3 + 0.03, (j + 1) / 3 - 0.03];
        t2.push({ type: "scatter", mode: "lines+markers", x: Lv, y: v, xaxis: xa, yaxis: ya, line: { color: col[j], width: 3 }, marker: { size: 10, color: col[j] } });
        t2.push({ type: "scatter", mode: "lines", x: [Lv[0], Lv[2]], y: [v[0], v[2]], xaxis: xa, yaxis: ya, line: { color: soft, width: 2, dash: "dash" } });
        if (Math.abs(mid - v[1]) > 1e-9) t2.push({ type: "scatter", mode: "lines", x: [Lv[1], Lv[1]], y: [v[1], mid], xaxis: xa, yaxis: ya, line: { color: red, width: 6 } });
        lay2["xaxis" + (j ? j + 1 : "")] = Object.assign(ax("", [Lv[0] - gap / 2, Lv[2] + gap / 2]), { domain: dom, anchor: ya, tickvals: Lv, ticktext: D.lv });
        lay2["yaxis" + (j ? j + 1 : "")] = Object.assign(ax("", yr(allv), 1), { anchor: xa });
        ann2.push({ xref: "paper", yref: "paper", x: (dom[0] + dom[1]) / 2, y: 1.22, showarrow: false, text: "<b>" + nm + "</b><br>" + (+v[0].toFixed(2)) + " − 2×" + (+v[1].toFixed(2)) + " + " + (+v[2].toFixed(2)) + "<br>bend = <b>" + (+bend.toFixed(2)) + "</b>", font: { color: col[j], size: 11 } });
      });
      Plotly.newPlot("lablu2", t2, lay2, cfg);
    }
    // 3
    var Un = D.U.map(function (r) { return r.map(num); }), vnames = Un.map(function (_, i) { return "Eq. " + (i + 1) + " of U"; }), all3 = [];
    Un.forEach(function (r) { all3 = all3.concat(r); });
    Plotly.newPlot("lablu3", D.names.map(function (nm, j) {
      return { type: "bar", name: nm, x: vnames, y: Un.map(function (r) { return r[j]; }), marker: { color: col[j] }, text: Un.map(function (r, i) { return Math.abs(r[j]) < 1e-9 ? (j < i ? "0 (gone)" : "0") : String(+r[j].toFixed(2)); }), textposition: "outside" };
    }), Object.assign({}, base, { meta: { noFrame: true }, barmode: "group", xaxis: { tickfont: { color: ink, size: 12 } }, yaxis: ax("what the product shows", yr(all3), 1) }), cfg);
    // 4
    var Lmn = D.Lm.map(function (r) { return r.map(num); }), cats = [], pieces = Un.map(function () { return []; }), real = [];
    D.perm.forEach(function (pi, i) {
      D.names.forEach(function (nm, j) {
        cats.push(nm + " at " + D.lv[pi]);
        for (var v = 0; v < n; v++) pieces[v].push(Lmn[i][v] * Un[v][j]);
        real.push(num(D.A[pi][j]));
      });
    });
    var t4 = pieces.map(function (pc, v) { return { type: "bar", name: "from eq. " + (v + 1) + " of U", x: cats, y: pc, marker: { color: vcol[v % 3], opacity: 0.75 } }; });
    t4.push({ type: "scatter", mode: "markers", name: "real payoff", x: cats, y: real, marker: { color: ink, size: 10 } });
    var all4 = real.slice(); pieces.forEach(function (pc) { all4 = all4.concat(pc); });
    Plotly.newPlot("lablu4", t4, Object.assign({}, base, { meta: { noFrame: true }, barmode: "relative", xaxis: { tickfont: { color: ink, size: 11 }, tickangle: -30 }, yaxis: ax("payoff (points ÷ 100)", yr(all4), 1), legend: { orientation: "h", y: -0.45, font: { color: ink } }, margin: { l: 60, r: 20, t: 20, b: 120 } }), cfg);
    // 5
    var tg = D.tgt.map(num), t5 = [], all5 = tg.slice();
    if (D.x) { var rec = xs.map(function (S) { return D.x.reduce(function (sm, xv, j) { return sm + num(xv) * payS(j, S); }, 0); }); all5 = all5.concat(rec); t5.push({ type: "scatter", mode: "lines", name: "recipe", x: xs, y: rec, line: { color: col[1], width: 3 } }); }
    if (D.bend) {
      var m5 = (tg[0] + tg[2]) / 2;
      t5.push({ type: "scatter", mode: "lines", name: "ruler", x: [Lv[0], Lv[2]], y: [tg[0], tg[2]], line: { color: soft, width: 2, dash: "dash" } });
      if (Math.abs(m5 - tg[1]) > 1e-9) t5.push({ type: "scatter", mode: "lines", name: "gap → bend " + (+(tg[0] - 2 * tg[1] + tg[2]).toFixed(2)), x: [Lv[1], Lv[1]], y: [tg[1], m5], line: { color: red, width: 6 } });
    }
    t5.push({ type: "scatter", mode: "markers+text", name: "client wants", x: Lv, y: tg, marker: { color: red, size: 12 }, text: tg.map(function (v) { return String(+v.toFixed(2)); }), textposition: "top center", textfont: { color: red } });
    Plotly.newPlot("lablu5", t5, Object.assign({}, base, { xaxis: ax("Nifty", [lo, hi], gap), yaxis: ax("payoff (points ÷ 100)", yr(all5), 1) }), cfg);
  }

  function luSections(A, tgt, Lv, n, vars, names, R, tradeTxt) {
    var h = [], lv = Lv.map(fmtLvl), F = luFactor(A), Lm = F.L, U = F.U, hU = [], hUv = [], hL = [], hChk = [], pic = {};
    function paren(v) { return v.num() < 0 ? "(" + v.tex() + ")" : v.tex(); }
    function vtx(v) { return "\\begin{bmatrix}" + v.map(function (x) { return x.tex(); }).join("\\\\") + "\\end{bmatrix}"; }
    function rowTxt(r) { return "(" + r.map(function (v) { return v.txt(); }).join(", ") + ")"; }
    var rowName = F.perm.map(function (pi) { return "the " + lv[pi] + " row"; });

    // 4. build U, record multipliers
    hU.push('<p>Same elimination as Lecture 03, with one extra habit: every multiplier $\\ell$ gets written into $L$. Start from $A$ (rows = ' + lv.join(", ") + '):</p>$$A = ' + mTex(A) + '$$<ol class="step-list kid-step">');
    F.steps.forEach(function (s) {
      if (s.kind === "swap") hU.push('<li><p class="k"><span class="kl">Swap</span> The pivot spot (row ' + (s.r1 + 1) + ', column ' + (s.col + 1) + ') is 0. Swap rows ' + (s.r1 + 1) + ' and ' + (s.r2 + 1) + '. This reorders the Nifty levels; a permutation $P$ records it, and we factor $PA$ instead of $A$.</p></li>');
      else if (s.kind === "nopivot") hU.push('<li><p class="k"><span class="kl">No pivot</span> Column ' + (s.col + 1) + ' has 0 in the pivot spot and nothing below to swap in. $U$ will have a 0 on its diagonal: product ' + names[s.col] + ' adds no new direction.</p></li>');
      else if (s.kind === "zero") hU.push('<li><p class="k"><span class="kl">Row ' + (s.row + 1) + ', column ' + (s.col + 1) + '</span> Already 0. Multiplier $\\ell_{' + (s.row + 1) + (s.col + 1) + '} = 0$: nothing to do, write 0 into $L$.</p></li>');
      else hU.push('<li><p class="k"><span class="kl">Row ' + (s.row + 1) + ', column ' + (s.col + 1) + '</span> Pivot $' + s.piv.tex() + '$, number to remove $' + s.remove.tex() + '$, multiplier $\\ell_{' + (s.row + 1) + (s.col + 1) + '} = ' + s.remove.tex() + ' \\div ' + paren(s.piv) + ' = ' + s.mult.tex() + '$.</p>' +
        '<p class="k"><span class="kl">How</span> Row ' + (s.row + 1) + ' $-\\,' + paren(s.mult) + ' \\times$ row ' + (s.prow + 1) + ': ' + rowTxt(s.before) + ' → <b>' + rowTxt(s.after) + '</b>.</p>' +
        '<p class="k"><span class="kl">Write it down</span> $\\ell_{' + (s.row + 1) + (s.col + 1) + '} = ' + s.mult.tex() + '$ goes into $L$ at row ' + (s.row + 1) + ', column ' + (s.col + 1) + ' (same number, plus sign).</p></li>');
    });
    hU.push('</ol><p class="answer">What is left is the staircase $U = ' + mTex(U) + '$.</p>');

    // 5. each factor on its own
    var P = F.perm.map(function (pi) { return Lv.map(function (_, j) { return j === pi ? ONE : ZERO; }); });
    var PA = F.perm.map(function (pi) { return A[pi]; }), LU = matMul(Lm, U);
    // views: row i of U = (row i of L^-1) applied to the (reordered) Nifty levels
    var Linv = Lv.map(function (_, j) { var e = Lv.map(function (_, i) { return i === j ? ONE : ZERO; }), y = []; e.forEach(function (ei, i) { var v = ei; for (var k = 0; k < i; k++) v = v.sub(Lm[i][k].mul(y[k])); y.push(v); }); return y; });
    Linv = Lv.map(function (_, i) { return Lv.map(function (_, j) { return Linv[j][i]; }); });   // transpose back: Linv[i][j]
    var W = Linv.map(function (row) { var w = Lv.map(function () { return ZERO; }); row.forEach(function (v, k) { w[F.perm[k]] = v; }); return w; });  // weights per real level
    function mixTxt(w) {
      var parts = [];
      var order = w.map(function (v, i) { return i; }).sort(function (p1, p2) { return (w[p2].num() > 0) - (w[p1].num() > 0) || p1 - p2; });
      order.forEach(function (i) { var v = w[i]; if (v.isZero()) return; var a = v.num(), mag = v.num() < 0 ? v.neg() : v, coef = mag.sub(ONE).isZero() ? "" : (mag.f ? mag.txt() : (mag.d === 1 ? String(mag.n) : mag.n + "/" + mag.d)) + " × ";
        parts.push((parts.length ? (a < 0 ? " − " : " + ") : (a < 0 ? "−" : "")) + coef + "(at " + lv[i] + ")"); });
      return parts.join("") || "0";
    }
    function isBend(w) { if (n !== 3 || Lv[1] - Lv[0] !== Lv[2] - Lv[1] || w[0].isZero()) return false; var r1 = w[1].div(w[0]), r2 = w[2].div(w[0]); return r1.sub(new Fr(-2)).isZero() && r2.sub(ONE).isZero(); }
    hUv.push('<li><p class="k"><span class="kl">$U$, the staircase</span> $U = ' + mTex(U) + '$. Zeros below the diagonal, so the bottom row has only the last product and the lots come out bottom-up.</p></li>');
    hUv.push('<li><p class="k"><span class="kl">What $U$ tells you</span> Each row of $U$ is a <b>view</b> of your payoff graph: a mix of Nifty levels chosen so that one more product <b>disappears</b>.</p>' +
      '<table><tr><th>View (row of $U$)</th><th>Mix of Nifty levels</th>' + names.map(function (nm) { return '<th>' + nm + ' shows</th>'; }).join("") + '<th>Gone</th></tr>' +
      U.map(function (r, i) {
        var gone = names.filter(function (_, j) { return j < i && r[j].isZero(); });   // products this view cancels out
        return '<tr><td>' + (i + 1) + '</td><td>' + mixTxt(W[i]) + (isBend(W[i]) ? '<br><i>= the bend of the graph at ' + lv[1] + '</i>' : '') + '</td>' + r.map(function (v) { return '<td>$' + v.tex() + '$</td>'; }).join("") + '<td>' + (gone.length ? gone.join(", ") : '—') + '</td></tr>';
      }).join("") + '</table>' +
      '<p class="k"><span class="kl">How to read a view</span> Take the products\' payoffs at those Nifty levels and mix them the same way. E.g. view ' + n + ' for product ' + names[n - 1] + ': ' +
        W[n - 1].map(function (w, i) { return w.isZero() ? null : paren(w) + ' × ' + A[i][n - 1].txt(); }).filter(Boolean).join(" + ") + ' = ' + U[n - 1][n - 1].txt() + '.</p>' +
      '<p class="k"><span class="kl">Why it helps</span> The last view shows only ' + names[n - 1] + ', so it gives ' + names[n - 1] + '\'s lots straight away. The view above adds one more product, and so on up. ' +
        (isBend(W[n - 1]) ? 'Here the last view is the <b>bend</b> of the graph at ' + lv[1] + ': the products that are straight lines across the three levels have no bend and vanish; only the one with a kink at ' + lv[1] + ' remains.' : '') + '</p></li>');
    hL.push('<li><p class="k"><span class="kl">What $L$ tells you</span> $L = ' + mTex(Lm) + '$ is the <b>translation</b> back: how each real Nifty level is made from the views (the rows of $U$). Its numbers are the multipliers you subtracted.</p><ul>' +
      Lm.map(function (lr, i) {
        var parts = [], sum = U[0].map(function () { return ZERO; });
        lr.forEach(function (l, j) { if (!l.isZero()) { parts.push((l.sub(ONE).isZero() ? '' : paren(l) + '\\times') + '\\text{view ' + (j + 1) + '}'); sum = sum.map(function (v, k) { return v.add(l.mul(U[j][k])); }); } });
        return '<li>' + rowName[i].charAt(0).toUpperCase() + rowName[i].slice(1) + ' = $' + parts.join(" + ") + ' = (' + sum.map(function (v) { return v.tex(); }).join(", ") + ')$ ✓</li>';
      }).join("") + '</ul>' +
      '<p class="k"><span class="kl">In graph words</span> The real graph at each Nifty level = some of the views added back together. Used the other way (section 7, top down), $L$ turns the client\'s graph into the same views.</p></li>');
    if (F.swaps) hL.push('<li><p class="k"><span class="kl">$P$, the reorder</span> $P = ' + mTex(P) + '$ puts the Nifty levels in the order used: ' + F.perm.map(function (pi) { return lv[pi]; }).join(", ") + '. So the factorization is $PA = LU$.</p></li>');
    var ok = LU.every(function (r, i) { return r.every(function (v, j) { return v.sub(PA[i][j]).isZero(); }); });
    hChk.push('<li><p class="k"><span class="kl">Check</span> $L \\times U = ' + mTex(LU) + '$, which is ' + (F.swaps ? '$PA$' : '$A$') + ' ' + (ok ? '✓' : '✗') + '. $L$ and $U$ together give back exactly the payoff table we started with.</p></li>');

    // 5b. pictures of U and L, drawn from the live inputs
    function ft(v) { var t = v.f ? String(+v.num().toFixed(3)) : (v.d === 1 ? String(v.n) : v.n + '/' + v.d); return t.replace('-', '−'); }
    function fp(v) { return v.num() < 0 ? '(' + ft(v) + ')' : ft(v); }
    var bendLast = isBend(W[n - 1]), xs5 = (R.x && !R.bad.length && !R.free.length) ? R.x : null;
    // pic 1
    var kinks = state.products.map(function (pr, j) { return (pr.type === "CE" || pr.type === "PE") ? names[j] + ' at ' + fmtLvl(pr.k) : names[j] + ': no kink (a straight line)'; });
    pic.p1 = ('<ol class="step-list kid-step"><li><p class="k"><span class="kl">Picture 1</span> What each of your products pays across Nifty (points ÷ 100' + (state.mkt.Tn > 0 ? ', valued with ' + state.mkt.Tn + ' days left' : '') + '). The dots are your Nifty levels ' + lv.join(", ") + '.</p>' +
      '<p class="k"><span class="kl">What to see</span> Where each graph bends (its kink): ' + kinks.join("; ") + '.</p></li></ol>' +
      '<figure class="fig plot3d"><div id="lablu1" class="plot3d-box" style="height:420px"></div><figcaption>Your products\' payoff graphs. Dots = your Nifty levels.</figcaption></figure>');
    // pic 2
    if (bendLast) {
      pic.p2 = ('<ol class="step-list kid-step"><li><p class="k"><span class="kl">Picture 2: the last view is the bend</span> Your bottom row of $U$ mixes the levels as ' + mixTxt(W[n - 1]) + ': that is the <b>bend</b> of a graph at ' + lv[1] + '. Lay a straight ruler from the dot at ' + lv[0] + ' to the dot at ' + lv[2] + ' and look at the gap at ' + lv[1] + '. Bend = 2 × gap.</p>' +
        names.map(function (nm, j) {
          var v0 = A[0][j], v1 = A[1][j], v2 = A[2][j], mid = v0.add(v2).div(new Fr(2)), gap = mid.sub(v1), bend = v0.sub(v1.mul(new Fr(2))).add(v2);
          return '<p class="k"><span class="kl">' + nm + '</span> Dots ' + ft(v0) + ', ' + ft(v1) + ', ' + ft(v2) + '. Ruler at ' + lv[1] + ' = (' + ft(v0) + ' + ' + ft(v2) + ') ÷ 2 = ' + ft(mid) + '. Gap = ' + ft(gap) + '. Bend = <b>' + ft(bend) + '</b>' + (bend.isZero() ? ': straight here, so it vanishes.' : ': it bends, so it shows.') + '</p>';
        }).join("") + '</li></ol>' +
        '<figure class="fig plot3d"><div id="lablu2" class="plot3d-box" style="height:360px"></div><figcaption>The bottom view drawn. Dashed = the ruler; red bar = the gap at ' + lv[1] + '. When the ruler lies on the line there is no gap: bend 0.</figcaption></figure>');
    } else {
      pic.p2 = ('<ol class="step-list kid-step"><li><p class="k"><span class="kl">Picture 2</span> Your bottom view is ' + mixTxt(W[n - 1]) + '. ' + (n === 3 ? 'It is not a plain "bend" here (the levels are not equally spaced, or a row swap happened), but it works the same way: ' : '') + 'products that show 0 in it vanish: ' +
        (names.filter(function (_, j) { return U[n - 1][j].isZero(); }).join(", ") || 'none') + '. (No ruler picture for this case; see picture 3.)</p></li></ol>');
    }
    // pic 3
    pic.p3 = ('<ol class="step-list kid-step"><li><p class="k"><span class="kl">Picture 3: $U$ as a staircase</span> One group of bars per view (row of $U$).</p><ul>' +
      U.map(function (r, i) { var gone = names.filter(function (_, j) { return j < i && r[j].isZero(); }); return '<li>View ' + (i + 1) + ' = ' + mixTxt(W[i]) + ': ' + names.map(function (nm, j) { return nm + ' ' + ft(r[j]); }).join(", ") + (gone.length ? ' (gone: ' + gone.join(", ") + ')' : '') + '</li>'; }).join("") +
      '</ul><p class="k"><span class="kl">What to see</span> Each view has one fewer product than the one above, so the bottom view gives the last product\'s lots first.</p></li></ol>' +
      '<figure class="fig plot3d"><div id="lablu3" class="plot3d-box" style="height:360px"></div><figcaption>Rows of $U$ as bars: products drop out one view at a time.</figcaption></figure>');
    // pic 4
    var ex4 = Lm.map(function (lr, i) {
      var j = 0; for (var q = 0; q < n; q++) if (lr.some(function (l, v) { return !l.isZero() && !U[v][q].isZero(); })) { j = q; }
      var parts = lr.map(function (l, v) { return l.isZero() ? null : fp(l) + ' × ' + fp(U[v][j]) + ' (view ' + (v + 1) + ')'; }).filter(Boolean);
      var tot = lr.reduce(function (sm, l, v) { return sm.add(l.mul(U[v][j])); }, ZERO);
      return '<li>' + names[j] + ' at ' + lv[F.perm[i]] + ': ' + parts.join(" + ") + ' = <b>' + ft(tot) + '</b> ✓</li>';
    });
    pic.p4 = ('<ol class="step-list kid-step"><li><p class="k"><span class="kl">Picture 4: $L$ rebuilds the real levels</span> Each real Nifty level = the views mixed with $L$\'s numbers. The bars stack those pieces; the black dot is the real payoff.</p><ul>' + ex4.join("") + '</ul></li></ol>' +
      '<figure class="fig plot3d"><div id="lablu4" class="plot3d-box" style="height:380px"></div><figcaption>Each bar = one product at one real Nifty level, built from pieces of the views (colours). Black dot = the real payoff: they match, $LU = ' + (F.swaps ? 'PA' : 'A') + '$.</figcaption></figure>');
    // pic 5
    var cLast = W[n - 1].reduce(function (sm, w, i) { return sm.add(w.mul(tgt[i])); }, ZERO);
    var shows = names.filter(function (_, j) { return !U[n - 1][j].isZero(); });
    pic.p5 = ('<ol class="step-list kid-step"><li><p class="k"><span class="kl">Picture 5: your client</span> The client\'s dots are ' + tgt.map(function (t) { return ft(t); }).join(", ") + '. Seen through the bottom view (' + mixTxt(W[n - 1]) + '), the client shows <b>' + ft(cLast) + '</b>' + (bendLast ? ' (the client\'s bend at ' + lv[1] + ')' : '') + '.</p>' +
      (xs5 ? '<p class="k"><span class="kl">Why that gives the lots</span> In the bottom view only ' + shows.join(", ") + ' show' + (shows.length === 1 ? 's' : '') + ', so ' + names[n - 1] + '\'s lots = ' + ft(cLast) + ' ÷ ' + ft(U[n - 1][n - 1]) + ' = <b>' + ft(xs5[n - 1]) + '</b>. Then the views above give the rest: ' + esc(tradeTxt(xs5)) + '.</p>' +
        '<p class="k"><span class="kl">What to see</span> The recipe\'s graph (green) passes through every client dot.</p>' : '<p class="k"><span class="kl">No single recipe</span> This market has no unique answer, so only the client\'s dots are drawn.</p>') +
      '</li></ol><figure class="fig plot3d"><div id="lablu5" class="plot3d-box" style="height:420px"></div><figcaption>The client\'s wanted payoff (red dots)' + (bendLast ? ', its ruler and bend' : '') + (xs5 ? ', and the recipe\'s payoff graph (green)' : '') + '.</figcaption></figure>');
    luPics = { A: A, U: U, Lm: Lm, W: W, perm: F.perm, Lv: Lv, lv: lv, names: names, P: state.products.slice(), Tn: state.mkt.Tn, tgt: tgt, x: xs5, bend: bendLast, n: n };
    var lSteps = F.steps.filter(function (st) { return st.kind === "elim" || st.kind === "zero"; }).map(function (st) {
      var val = st.kind === "zero" ? ZERO : st.mult;
      return '<li>$\\ell_{' + (st.row + 1) + (st.prow + 1) + '} = ' + val.tex() + '$ (from 4b: ' + (st.kind === "zero" ? 'row ' + (st.row + 1) + ' already had 0' : 'we took ' + ft(val) + ' × row ' + (st.prow + 1) + ' away from row ' + (st.row + 1)) + ') → row ' + (st.row + 1) + ', column ' + (st.prow + 1) + ' of $L$</li>';
    });
    var buildLtxt = '<ol class="step-list kid-step"><li><p class="k"><span class="kl">Start</span> Begin with the identity: 1s on the diagonal, 0s everywhere else.</p></li>' +
      '<li><p class="k"><span class="kl">Fill in the multipliers</span> Every number we subtracted with in 4b goes below the diagonal, in the spot (row we changed, row we used):</p><ul>' + lSteps.join("") + '</ul></li>' +
      '<li><p class="k"><span class="kl">What we have now</span> $L = ' + mTex(Lm) + '$.</p>' +
      '<p class="k"><span class="kl">Why only below the diagonal</span> Elimination only ever takes an upper row away from a lower row, so every multiplier sits below the diagonal. That is why $L$ is <b>lower</b> triangular.</p></li></ol>';
    // ---- compact Part 1 (U) and Part 2 (L) ----
    function vec(r) { return '(' + r.map(ft).join(', ') + ')'; }
    function aug(r, c) { return '(' + r.map(ft).join(', ') + ' | ' + ft(c) + ')'; }
    // replay elimination on [A | client] to show the client's numbers moving too
    var M = A.map(function (r) { return r.slice(); }), rhs = tgt.slice(), elimRows = [], sn = 0;
    F.steps.forEach(function (st) {
      if (st.kind === "swap") {
        var t = M[st.r1]; M[st.r1] = M[st.r2]; M[st.r2] = t; t = rhs[st.r1]; rhs[st.r1] = rhs[st.r2]; rhs[st.r2] = t;
        elimRows.push('<tr><td>' + (++sn) + '</td><td>Swap rows ' + (st.r1 + 1) + ' and ' + (st.r2 + 1) + ' (the pivot spot was 0)</td><td colspan="2">rows reordered</td><td>—</td></tr>');
      } else if (st.kind === "nopivot") {
        elimRows.push('<tr><td>' + (++sn) + '</td><td>Column ' + (st.col + 1) + ' has no pivot</td><td colspan="2">' + names[st.col] + ' adds nothing new</td><td>—</td></tr>');
      } else if (st.kind === "zero") {
        elimRows.push('<tr><td>' + (++sn) + '</td><td>Row ' + (st.row + 1) + ' already has 0 in column ' + (st.col + 1) + '</td><td>' + aug(M[st.row], rhs[st.row]) + '</td><td>unchanged</td><td>$\\ell_{' + (st.row + 1) + (st.prow + 1) + '} = 0$</td></tr>');
      } else {
        var before = aug(M[st.row], rhs[st.row]);
        M[st.row] = M[st.row].map(function (v, j) { return v.sub(M[st.prow][j].mul(st.mult)); });
        rhs[st.row] = rhs[st.row].sub(rhs[st.prow].mul(st.mult));
        elimRows.push('<tr><td>' + (++sn) + '</td><td>Row ' + (st.row + 1) + ' − ' + fp(st.mult) + ' × row ' + (st.prow + 1) + '<br><small>(' + ft(st.remove) + ' ÷ pivot ' + ft(st.piv) + ' = ' + ft(st.mult) + ')</small></td><td>' + before + '</td><td><b>' + aug(M[st.row], rhs[st.row]) + '</b></td><td>$\\ell_{' + (st.row + 1) + (st.prow + 1) + '} = ' + st.mult.tex() + '$</td></tr>');
      }
    });
    var c0 = rhs;
    var part1 = [];
    part1.push('<h4>4. Part 1: $U$</h4>');
    part1.push('<p><b>Your products</b> (the starting point):</p>' + pic.p1);
    part1.push('<h4>4a. Eliminate (the client\'s numbers come along)</h4><p>Each row is one Nifty level: (what A, B, … pay | what the client wants). Start: ' + A.map(function (r, i) { return aug(r, tgt[i]); }).join(", ") + '.</p>' +
      '<table><tr><th>Step</th><th>Move</th><th>Row before</th><th>Row after</th><th>Multiplier</th></tr>' + elimRows.join("") + '</table>');
    var eqs = U.map(function (r, i) { var z = r.every(function (v) { return v.isZero(); }); return z ? '0 = ' + c0[i].tex() : eqTex(r, c0[i], n); });
    part1.push('<h4>4b. $U$ = the simplified equations</h4>$$\\begin{aligned}' + eqs.map(function (e) { return e.replace(" = ", " &= "); }).join(" \\\\ ") + '\\end{aligned}$$' +
      '<p>The last equation has only ' + names[n - 1] + ' (lots $' + vars[n - 1] + '$). Each equation above it adds one more product. So we solve from the bottom.</p>');
    if (F.zeroPiv < 0) {
      var bw0 = backward(c0), srows = [];
      for (var ii = n - 1; ii >= 0; ii--) {
        var counted = ZERO, parts = [];
        for (var jj = ii + 1; jj < n; jj++) if (!U[ii][jj].isZero()) { var cnt = U[ii][jj].mul(bw0.x[jj]); parts.push(names[jj] + ': ' + fp(U[ii][jj]) + ' × ' + ft(bw0.x[jj]) + ' = ' + ft(cnt)); counted = counted.add(cnt); }
        var left = c0[ii].sub(counted);
        srows.push('<tr><td>' + (ii + 1) + '</td><td>' + names[ii] + ': ' + ft(U[ii][ii]) + '</td><td>' + ft(c0[ii]) + '</td><td>' + (parts.length ? parts.join('<br>') : '—') + '</td><td>' + (parts.length ? ft(c0[ii]) + ' − ' + fp(counted) + ' = ' : '') + ft(left) + '</td><td><b>' + ft(left) + ' ÷ ' + ft(U[ii][ii]) + ' = ' + ft(bw0.x[ii]) + '</b></td></tr>');
      }
      part1.push('<h4>4c. Solve from the bottom, per 1 lot</h4><table><tr><th>Equation</th><th>1 lot counts</th><th>Client needs</th><th>Already found</th><th>Left</th><th>Lots</th></tr>' + srows.join("") + '</table>' +
        '<p class="answer">' + esc(tradeTxt(bw0.x)) + '. $U$ turns one hard problem into easy ones: one product at a time.</p>');
    } else part1.push('<h4>4c. Solve from the bottom</h4><p class="lab-warn">One equation has 0 in front of its product, so it can\'t be solved for that product: no single recipe.</p>');
    var viewRows = U.map(function (r, i) {
      var gone = names.filter(function (_, j) { return j < i && r[j].isZero(); });
      var meaning = i === 0 ? 'the graph at ' + lv[F.perm[0]] : (isBend(W[i]) ? 'the <b>bend</b> of the graph at ' + lv[1] + ': straight products cancel' : gone.join(", ") + ' cancel' + (gone.length === 1 ? 's' : '') + ' out');
      return '<tr><td>' + (i + 1) + '</td><td>' + mixTxt(W[i]) + '</td>' + r.map(function (v) { return '<td>' + ft(v) + '</td>'; }).join("") + '<td>' + meaning + '</td></tr>';
    });
    part1.push('<h4>4d. What $U$ means on your payoff graph</h4><p>Each equation of $U$ looks at your graph through a <b>mix of Nifty levels</b>, chosen so that one more product cancels out:</p>' +
      '<table><tr><th>Equation</th><th>Mix of Nifty levels</th>' + names.map(function (nm) { return '<th>' + nm + '</th>'; }).join("") + '<th>What it shows</th></tr>' + viewRows.join("") + '</table>' +
      (bendLast ? pic.p2 : '') +
      '<figure class="fig plot3d"><div id="lablu3" class="plot3d-box" style="height:340px"></div><figcaption>Each group of bars = one equation of $U$. Products drop out one equation at a time: that\'s the staircase.</figcaption></figure>');
    // Part 2
    var part2 = [];
    var lRows = F.steps.filter(function (st) { return st.kind === "elim" || st.kind === "zero"; }).map(function (st) {
      return '<tr><td>' + (st.kind === "zero" ? 'row ' + (st.row + 1) + ' already 0' : 'row ' + (st.row + 1) + ' − ' + fp(st.mult) + ' × row ' + (st.prow + 1)) + '</td><td>$\\ell_{' + (st.row + 1) + (st.prow + 1) + '} = ' + (st.kind === "zero" ? '0' : st.mult.tex()) + '$</td><td>row ' + (st.row + 1) + ', column ' + (st.prow + 1) + '</td></tr>';
    });
    part2.push('<h4>5. Part 2: $L$</h4><h4>5a. $L$ = the multipliers from 4a</h4><p>Start from the identity (1s on the diagonal). Put each multiplier from 4a in its spot:</p>' +
      '<table><tr><th>Move in 4a</th><th>Multiplier</th><th>Spot in $L$</th></tr>' + lRows.join("") + '</table>' +
      '$$L = ' + mTex(Lm) + '$$<p>Only below the diagonal, because we only ever take an upper row away from a lower row.' + (F.swaps ? ' Rows were swapped, so $P = ' + mTex(P) + '$ and $PA = LU$.' : '') + '</p>');
    var undoRows = Lm.map(function (lr, i) {
      var used = lr.map(function (l, j) { return l.isZero() ? null : j; }).filter(function (j) { return j !== null; });
      var coef = U[0].map(function () { return ZERO; }), rr = ZERO;
      used.forEach(function (j) { coef = coef.map(function (v, k) { return v.add(lr[j].mul(U[j][k])); }); rr = rr.add(lr[j].mul(c0[j])); });
      var combo = used.map(function (j) { return (lr[j].sub(ONE).isZero() ? '' : fp(lr[j]) + ' × ') + 'eq. ' + (j + 1); }).join(" + ");
      return '<tr><td>' + lv[F.perm[i]] + '</td><td>' + combo + '</td><td>$' + eqTex(coef, rr, n) + '$</td><td>✓ original</td></tr>';
    });
    part2.push('<h4>5b. What $L$ does: undo the moves</h4><p>Each number in $L$ says how much of a simplified equation to add back. Doing it rebuilds every original equation, right side included:</p>' +
      '<table><tr><th>Nifty level</th><th>= from $U$\'s equations</th><th>Gives</th><th></th></tr>' + undoRows.join("") + '</table>' +
      '<p>So $L$ is the <b>record</b> of the elimination. Read forwards, it turns any client\'s numbers into $U$\'s right side (section 7); read backwards, it turns $U$ back into $A$.</p>' +
      '<figure class="fig plot3d"><div id="lablu4" class="plot3d-box" style="height:360px"></div><figcaption>The same idea as a picture: each bar is one product at one real Nifty level, stacked from pieces of $U$\'s equations (colours). Black dot = the real payoff. They match.</figcaption></figure>');
    part2.push('<h4>5c. Check</h4><p>$L \\times U = ' + mTex(LU) + '$ = ' + (F.swaps ? '$PA$' : '$A$') + ' ' + (LU.every(function (r, i) { return r.every(function (v, j) { return v.sub(PA[i][j]).isZero(); }); }) ? '✓' : '✗') + '</p>');
    h.push(part1.join("") + part2.join(""));

    // 6. D
    var piv = U.map(function (r, i) { return r[i]; });
    if (piv.some(function (v) { return v.isZero(); })) h.push('<h4>6. $D$ (the pivots)</h4><p>$U$ has a 0 on its diagonal, so the pivots can\'t all be pulled out. That 0 is the sign of a <b>singular</b> market.</p>');
    else {
      var D = U.map(function (r, i) { return r.map(function (_, j) { return i === j ? piv[i] : ZERO; }); }), U1 = U.map(function (r, i) { return r.map(function (v) { return v.div(piv[i]); }); });
      h.push('<h4>6. $D$: pull the pivots out ($' + (F.swaps ? 'PA' : 'A') + ' = LDU$)</h4><p>Divide each row of $U$ by its pivot, and keep the pivots in a diagonal matrix $D$. Now $L$ and the new $U$ both have 1s on the diagonal.</p>' +
        '$$' + (F.swaps ? 'PA' : 'A') + ' = ' + mTex(Lm) + mTex(D) + mTex(U1) + '$$<p>The pivots ' + piv.map(function (v) { return v.txt(); }).join(", ") + ' measure how much new payoff each product adds at each step.</p>');
    }

    // 7. solve in two steps
    if (F.zeroPiv >= 0) {
      h.push('<h4>7. Solve with $L$ and $U$</h4><div class="box pitfall"><span class="label">Stuck</span><p>$U$ has a 0 on its diagonal, so back substitution would divide by 0. There is no single answer: the client\'s payoff is either impossible or has many recipes. See the diagnosis in Lectures 08 and 09.</p></div>');
      h.push('<h4>7b. Your client in a picture</h4>' + pic.p5);
      return h.join("");
    }
    function forward(b) { var c = [], lines = []; b.forEach(function (bi, i) { var v = bi, terms = [bi.tex()]; for (var j = 0; j < i; j++) if (!Lm[i][j].isZero()) { v = v.sub(Lm[i][j].mul(c[j])); terms.push('- ' + paren(Lm[i][j]) + '\\times' + paren(c[j])); } c.push(v); lines.push(terms.length === 1 ? '$c_' + (i + 1) + ' = ' + v.tex() + '$ (nothing above it to subtract)' : '$c_' + (i + 1) + ' = ' + terms.join(" ") + ' = ' + v.tex() + '$'); }); return { c: c, lines: lines }; }
    function backward(c) { var x = [], lines = []; for (var i = n - 1; i >= 0; i--) { var v = c[i], terms = [c[i].tex()]; for (var j = i + 1; j < n; j++) if (!U[i][j].isZero()) { v = v.sub(U[i][j].mul(x[j])); terms.push('- ' + paren(U[i][j]) + '\\times' + paren(x[j])); } x[i] = v.div(U[i][i]); lines.unshift('$' + vars[i] + ' = (' + terms.join(" ") + ') \\div ' + paren(U[i][i]) + ' = ' + x[i].tex() + '$'); } return { x: x, lines: lines }; }
    var Pb = F.perm.map(function (pi) { return tgt[pi]; }), fw = forward(Pb), bw = backward(fw.c);
    h.push('<h4>7. Solve the client in two easy steps</h4><ol class="step-list kid-step">' +
      '<li><p class="k"><span class="kl">Step 1: $Lc = ' + (F.swaps ? 'Pb' : 'b') + '$, top down</span> $L$ has zeros above the diagonal, so the first equation has only $c_1$, the second only $c_1, c_2$, and so on.</p><ul>' + fw.lines.map(function (l) { return '<li>' + l + '</li>'; }).join("") + '</ul>' +
      '<p class="k"><span class="kl">What $c$ is</span> The client\'s payoff graph seen through the same views as $U$: ' + fw.c.map(function (cv, i) { return '$c_' + (i + 1) + '$ = ' + mixTxt(W[i]) + ' of the client = ' + cv.txt(); }).join('; ') + '.</p></li>' +
      '<li><p class="k"><span class="kl">Step 2: $Ux = c$, bottom up</span> $U$ has zeros below the diagonal, so start at the bottom row.</p><ul>' + bw.lines.slice().reverse().map(function (l) { return '<li>' + l + '</li>'; }).join("") + '</ul>' +
      '<p class="k"><span class="kl">What we have now</span> ' + esc(tradeTxt(bw.x)) + '.</p></li>' +
      '<li><p class="k"><span class="kl">Check</span> These lots pay ' + A.map(function (r, i) { return lv[i] + ': ' + r.reduce(function (sm, a, k) { return sm.add(a.mul(bw.x[k])); }, ZERO).txt(); }).join(", ") + ', which is what the client wanted ✓.</p></li></ol>');

    h.push('<h4>7b. Your client in a picture</h4>' + pic.p5);

    // 8. many clients
    var shapes = n === 3 ? [tgt, [new Fr(2), ZERO, new Fr(2)], [ZERO, ONE, new Fr(3)]] : [tgt, [new Fr(2), ZERO], [ZERO, new Fr(2)]];
    var labels = n === 3 ? ["your client", "straddle shape", "rally bet"] : ["your client", "down bet", "up bet"];
    h.push('<h4>8. Many clients: factor once, then two quick solves each</h4><p>$L$ and $U$ depend only on the products, not on the client. So factor once, then every new client needs only step 1 (top down) and step 2 (bottom up).</p>' +
      '<table><tr><th>Client</th><th>Wants at ' + lv.join(" / ") + '</th><th>$c$ (top down)</th><th>Lots $x$ (bottom up)</th><th>In trading words</th></tr>' +
      shapes.map(function (b, k) { var f = forward(F.perm.map(function (pi) { return b[pi]; })), g = backward(f.c); return '<tr><td>' + labels[k] + '</td><td>' + b.map(function (v) { return v.txt(); }).join(" / ") + '</td><td>' + rowTxt(f.c) + '</td><td>' + rowTxt(g.x) + '</td><td>' + esc(tradeTxt(g.x)) + '</td></tr>'; }).join("") + '</table>' +
      '<p><b>Why it saves work:</b> factoring costs about $n^3/3$ steps, once. Each client then costs about $n^2$. With 3 levels that is 9 vs 9, but with 100 Nifty levels it is about 333,333 steps once, then only 10,000 per client.</p>');
    return h.join("");
  }


  // ---------- transpose / permutation / vector-space mode (Lecture 06 lab: <div id="replab" data-tpv>) ----------
  // Every part is written as What / How / Why, with the user's own numbers.

  var tpvPics = null;
  function drawTpvPics(D) {
    if (!window.Plotly) { setTimeout(function () { drawTpvPics(D); }, 300); return; }
    function cssv(v) { return getComputedStyle(document.documentElement).getPropertyValue(v).trim(); }
    var col = [cssv("--accent"), cssv("--ex-b"), cssv("--thm-b")], red = cssv("--warn-b"), ink = cssv("--ink"), soft = cssv("--ink-soft"), rule = cssv("--rule"), paper2 = cssv("--paper-2");
    var cfg = { responsive: true, displaylogo: false, modeBarButtonsToRemove: ["toImage"] };
    var idA = D.idA === undefined ? "lab8a" : D.idA, idB = D.idB || "lab8b";
    var n = D.n, cols = D.names.map(function (_, j) { return D.A.map(function (r) { return r[j].num(); }); }), tg = D.tgt.map(function (v) { return v.num(); });
    var a = cols[0], pts = [a, a.map(function (v) { return 2 * v; }), a.map(function (v) { return -v; }), tg].concat(cols); if (n === 2) pts.push(a.map(function (v) { return 3 * v; }));
    var xs = D.x ? D.x.map(function (v) { return v.num(); }) : null, chain = [], cur = cols[0].map(function () { return 0; });
    if (xs) cols.forEach(function (c, j) { var nx = cur.map(function (v, i) { return v + xs[j] * c[i]; }); chain.push([cur, nx, j]); pts.push(nx); cur = nx; });
    var m = 1; pts.forEach(function (p) { p.forEach(function (v) { m = Math.max(m, Math.abs(v)); }); }); m = Math.ceil(m) + 1;
    var dt = m <= 6 ? 1 : (m <= 12 ? 2 : 5);
    function axis(t) { return { title: { text: t, font: { color: ink, size: 13 } }, range: [-m, m], autorange: false, tickmode: "linear", dtick: dt, tickfont: { color: soft, size: 11 }, gridcolor: rule, zeroline: true, zerolinecolor: soft }; }
    var lab = function (i) { return n === 2 ? "payoff at " + D.lv[i] : D.lv[i]; };
    if (n === 2) {
      function arrow(from, to, color, text, dash) {
        return [{ x: to[0], y: to[1], ax: from[0], ay: from[1], xref: "x", yref: "y", axref: "x", ayref: "y", showarrow: true, arrowhead: 3, arrowsize: 1.2, arrowwidth: dash ? 2 : 3, arrowcolor: color, text: "" },
          { x: to[0], y: to[1], xref: "x", yref: "y", showarrow: false, text: text, font: { color: color, size: 13 }, xanchor: to[0] < 0 ? "right" : "left", yanchor: to[1] < 0 ? "top" : "bottom", xshift: to[0] < 0 ? -4 : 4 }];
      }
      var base2 = { paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: paper2, margin: { l: 60, r: 20, t: 10, b: 60 }, showlegend: false, xaxis: Object.assign(axis(lab(0)), { scaleanchor: "y", scaleratio: 1 }), yaxis: axis(lab(1)) };
      // picture 1: line of multiples of A
      var L = m * 3, an1 = [].concat(arrow([0, 0], a.map(function (v) { return 2 * v; }), soft, "2×" + D.names[0], true), arrow([0, 0], a.map(function (v) { return -v; }), red, "−1×" + D.names[0] + " (sell)"), arrow([0, 0], a, col[0], D.names[0]),
        cols[1] ? arrow([0, 0], cols[1], soft, D.names[1] + " (off the line)") : []);
      if (idA) Plotly.newPlot(idA, [{ type: "scatter", mode: "lines", x: [-L * a[0], L * a[0]], y: [-L * a[1], L * a[1]], line: { color: col[0], width: 2, dash: "dash" }, hoverinfo: "skip" },
        { type: "scatter", mode: "markers", x: [0, 3 * a[0]], y: [0, 3 * a[1]], marker: { color: [ink, col[0]], size: [7, 9] }, text: ["0", D.names[0] + " + 2×" + D.names[0] + " = 3×" + D.names[0]], hoverinfo: "text" }],
        Object.assign({}, base2, { annotations: an1.concat([{ x: 3 * a[0], y: 3 * a[1], xref: "x", yref: "y", showarrow: false, text: D.names[0] + " + 2×" + D.names[0], font: { color: col[0], size: 12 }, xanchor: "left", yanchor: "top", xshift: 6 }]) }), cfg);
      // picture 2: column space
      var tr2 = [], an2 = [];
      if (D.rank >= 2) tr2.push({ type: "scatter", x: [-m, m, m, -m, -m], y: [-m, -m, m, m, -m], fill: "toself", fillcolor: "rgba(47,93,138,0.10)", line: { width: 0 }, mode: "lines", hoverinfo: "skip" });
      else tr2.push({ type: "scatter", mode: "lines", x: [-L * a[0], L * a[0]], y: [-L * a[1], L * a[1]], line: { color: col[0], width: 8 }, opacity: 0.25, hoverinfo: "skip" });
      cols.forEach(function (c, j) { an2 = an2.concat(arrow([0, 0], c, col[j % 3], D.names[j])); });
      chain.forEach(function (ch) { an2 = an2.concat(arrow(ch[0], ch[1], col[ch[2] % 3], "", true)); });
      tr2.push({ type: "scatter", mode: "markers+text", x: [tg[0]], y: [tg[1]], marker: { color: red, size: 12 }, text: ["client"], textposition: "top right", textfont: { color: red }, hoverinfo: "skip" });
      if (D.rank >= 2) an2.push({ xref: "paper", yref: "paper", x: 0.02, y: 0.98, showarrow: false, xanchor: "left", yanchor: "top", text: "shaded = whole plane: every payoff is buildable", font: { color: soft, size: 12 } });
      Plotly.newPlot(idB, tr2, Object.assign({}, base2, { annotations: an2 }), cfg);
    } else {
      function ax3(t) { var o = axis(t); o.showbackground = false; return o; }
      var scene = { xaxis: ax3(lab(0)), yaxis: ax3(lab(1)), zaxis: ax3(lab(2)), aspectmode: "cube", dragmode: "turntable", camera: { eye: { x: 1.25, y: -1.7, z: 0.75 }, up: { x: 0, y: 0, z: 1 } } };
      function seg(p, q, color, name, w, dash) { return { type: "scatter3d", mode: "lines+text", x: [p[0], q[0]], y: [p[1], q[1]], z: [p[2], q[2]], line: { color: color, width: w || 10, dash: dash ? "dash" : "solid" }, text: ["", name || ""], textposition: "top center", textfont: { color: color, size: 14 }, hoverinfo: "skip" }; }
      var L3 = m * 3, o = [0, 0, 0];
      if (idA) Plotly.newPlot(idA, [seg(a.map(function (v) { return -L3 * v; }), a.map(function (v) { return L3 * v; }), col[0], "", 2, true),
        seg(o, a.map(function (v) { return 2 * v; }), soft, "2×" + D.names[0], 4), seg(o, a.map(function (v) { return -v; }), red, "−1×" + D.names[0] + " (sell)"), seg(o, a, col[0], D.names[0]),
        cols[1] ? seg(o, cols[1], soft, D.names[1] + " (off the line)", 4) : seg(o, o, soft, "")],
        { paper_bgcolor: "rgba(0,0,0,0)", margin: { l: 0, r: 0, t: 0, b: 0 }, showlegend: false, scene: scene }, cfg);
      var tr3 = [];
      if (D.rank === 2) {
        var u = cols[D.piv[0]], w = cols[D.piv[1]], K = m * 2, corner = [[-K, -K], [K, -K], [K, K], [-K, K]].map(function (st) { return u.map(function (v, i) { return st[0] * v + st[1] * w[i]; }); });
        tr3.push({ type: "mesh3d", x: corner.map(function (p) { return p[0]; }), y: corner.map(function (p) { return p[1]; }), z: corner.map(function (p) { return p[2]; }), i: [0, 0], j: [1, 2], k: [2, 3], color: col[0], opacity: 0.18, hoverinfo: "skip" });
      }
      cols.forEach(function (c, j) { tr3.push(seg(o, c, col[j % 3], D.names[j])); });
      chain.forEach(function (ch) { tr3.push(seg(ch[0], ch[1], col[ch[2] % 3], "", 4, true)); });
      tr3.push({ type: "scatter3d", mode: "markers+text", x: [tg[0]], y: [tg[1]], z: [tg[2]], marker: { color: red, size: 7 }, text: ["client"], textposition: "top center", textfont: { color: red }, hoverinfo: "skip" });
      if (D.rank === 2 && !D.x) {   // show the gap from the client to the sheet
        var u2 = cols[D.piv[0]], w2 = cols[D.piv[1]], nrm = [u2[1] * w2[2] - u2[2] * w2[1], u2[2] * w2[0] - u2[0] * w2[2], u2[0] * w2[1] - u2[1] * w2[0]];
        var nn = nrm[0] * nrm[0] + nrm[1] * nrm[1] + nrm[2] * nrm[2], k2 = (tg[0] * nrm[0] + tg[1] * nrm[1] + tg[2] * nrm[2]) / nn, foot = tg.map(function (v, i) { return v - k2 * nrm[i]; });
        tr3.push(seg(foot, tg, red, "gap: outside", 8, true));
      }
      Plotly.newPlot(idB, tr3, { paper_bgcolor: "rgba(0,0,0,0)", margin: { l: 0, r: 0, t: 0, b: 0 }, showlegend: false, scene: JSON.parse(JSON.stringify(scene)) }, cfg);
    }
  }


  // ---------- column space & nullspace mode (Lecture 07 lab: <div id="replab" data-csn>) ----------
  var csnPics = null;
  function drawCsnNull(D) {
    if (!window.Plotly) { setTimeout(function () { drawCsnNull(D); }, 300); return; }
    function cssv(v) { return getComputedStyle(document.documentElement).getPropertyValue(v).trim(); }
    var green = cssv("--ex-b"), purple = cssv("--thm-b"), red = cssv("--warn-b"), ink = cssv("--ink"), soft = cssv("--ink-soft"), rule = cssv("--rule"), paper2 = cssv("--paper-2");
    var cfg = { responsive: true, displaylogo: false, modeBarButtonsToRemove: ["toImage"] };
    var n = D.n, nulls = D.nulls.map(function (z) { return z.map(function (v) { return v.num(); }); }), xp = D.xp ? D.xp.map(function (v) { return v.num(); }) : null;
    var pts = [[0, 0, 0].slice(0, n)].concat(nulls); if (xp) { pts.push(xp); nulls.forEach(function (z) { pts.push(xp.map(function (v, i) { return v + z[i]; })); pts.push(xp.map(function (v, i) { return v - z[i]; })); }); }
    var m = 1; pts.forEach(function (p) { p.forEach(function (v) { m = Math.max(m, Math.abs(v)); }); }); m = Math.ceil(m) + 1;
    var dt = m <= 6 ? 1 : 2, labels = D.names.map(function (nm) { return "lots of " + nm; }), K = m * 3;
    function axis(t) { return { title: { text: t, font: { color: ink, size: 13 } }, range: [-m, m], autorange: false, tickmode: "linear", dtick: dt, tickfont: { color: soft, size: 11 }, gridcolor: rule, zeroline: true, zerolinecolor: soft, showbackground: false }; }
    var tr = [];
    if (n === 2) {
      if (nulls.length === 1) { var z = nulls[0]; tr.push({ type: "scatter", mode: "lines", name: "zero-payoff trades (nullspace)", x: [-K * z[0], K * z[0]], y: [-K * z[1], K * z[1]], line: { color: purple, width: 3, dash: "dash" } });
        if (xp) tr.push({ type: "scatter", mode: "lines", name: "every recipe for the client", x: [xp[0] - K * z[0], xp[0] + K * z[0]], y: [xp[1] - K * z[1], xp[1] + K * z[1]], line: { color: green, width: 3 } }); }
      tr.push({ type: "scatter", mode: "markers+text", name: "no trade (0)", x: [0], y: [0], marker: { color: ink, size: 8 }, text: ["0"], textposition: "bottom left" });
      nulls.forEach(function (z, k) { tr.push({ type: "scatter", mode: "markers+text", name: "zero trade " + (k + 1), x: [z[0]], y: [z[1]], marker: { color: purple, size: 10 }, text: ["zero trade"], textposition: "top right", textfont: { color: purple } }); });
      if (xp) tr.push({ type: "scatter", mode: "markers+text", name: "one recipe", x: [xp[0]], y: [xp[1]], marker: { color: green, size: 11 }, text: ["recipe"], textposition: "top right", textfont: { color: green } });
      Plotly.newPlot(D.id, tr, { paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: paper2, margin: { l: 60, r: 20, t: 10, b: 70 }, legend: { orientation: "h", y: -0.25, font: { color: ink } }, xaxis: Object.assign(axis(labels[0]), { scaleanchor: "y", scaleratio: 1 }), yaxis: axis(labels[1]) }, cfg);
    } else {
      function line3(p, d, color, name, dash) { return { type: "scatter3d", mode: "lines", name: name, x: [p[0] - K * d[0], p[0] + K * d[0]], y: [p[1] - K * d[1], p[1] + K * d[1]], z: [p[2] - K * d[2], p[2] + K * d[2]], line: { color: color, width: 6, dash: dash ? "dash" : "solid" } }; }
      function plane3(p, u, w, color, name) { var c = [[-K, -K], [K, -K], [K, K], [-K, K]].map(function (st) { return p.map(function (v, i) { return v + st[0] * u[i] + st[1] * w[i]; }); }); return { type: "mesh3d", name: name, x: c.map(function (q) { return q[0]; }), y: c.map(function (q) { return q[1]; }), z: c.map(function (q) { return q[2]; }), i: [0, 0], j: [1, 2], k: [2, 3], color: color, opacity: 0.2 }; }
      var o = [0, 0, 0];
      if (nulls.length === 1) { tr.push(line3(o, nulls[0], purple, "zero-payoff trades (nullspace)", true)); if (xp) tr.push(line3(xp, nulls[0], green, "every recipe for the client")); }
      if (nulls.length === 2) { tr.push(plane3(o, nulls[0], nulls[1], purple, "zero-payoff trades (nullspace)")); if (xp) tr.push(plane3(xp, nulls[0], nulls[1], green, "every recipe for the client")); }
      tr.push({ type: "scatter3d", mode: "markers+text", name: "no trade (0)", x: [0], y: [0], z: [0], marker: { color: ink, size: 5 }, text: ["0"], textposition: "bottom center" });
      nulls.forEach(function (z) { tr.push({ type: "scatter3d", mode: "markers+text", name: "zero trade", x: [z[0]], y: [z[1]], z: [z[2]], marker: { color: purple, size: 6 }, text: ["zero trade"], textposition: "top center", textfont: { color: purple } }); });
      if (xp) tr.push({ type: "scatter3d", mode: "markers+text", name: "one recipe", x: [xp[0]], y: [xp[1]], z: [xp[2]], marker: { color: green, size: 7 }, text: ["recipe"], textposition: "top center", textfont: { color: green } });
      Plotly.newPlot(D.id, tr, { paper_bgcolor: "rgba(0,0,0,0)", margin: { l: 0, r: 0, t: 0, b: 0 }, legend: { orientation: "h", y: -0.02, font: { color: ink } },
        scene: { xaxis: axis(labels[0]), yaxis: axis(labels[1]), zaxis: axis(labels[2]), aspectmode: "cube", dragmode: "turntable", camera: { eye: { x: 1.5, y: -1.5, z: 0.9 }, up: { x: 0, y: 0, z: 1 } } } }, cfg);
    }
  }


  var csnSub = null;
  function drawCsnSub(D) {
    if (!window.Plotly) { setTimeout(function () { drawCsnSub(D); }, 300); return; }
    function cssv(v) { return getComputedStyle(document.documentElement).getPropertyValue(v).trim(); }
    var blue = cssv("--accent"), green = cssv("--ex-b"), purple = cssv("--thm-b"), red = cssv("--warn-b"), ink = cssv("--ink"), soft = cssv("--ink-soft"), rule = cssv("--rule"), paper2 = cssv("--paper-2");
    var cfg = { responsive: true, displaylogo: false, modeBarButtonsToRemove: ["toImage"] };
    var n = D.n, num = function (v) { return v.num(); }, cols = D.names.map(function (_, j) { return D.A.map(function (r) { return r[j].num(); }); });
    var u = cols[0], v = n > 1 ? cols[1] : cols[0], uv = u.map(function (x, i) { return x + v[i]; }), u2 = u.map(function (x) { return 2 * x; }), un = u.map(function (x) { return -x; });
    function rng(pts) { var m = 1; pts.forEach(function (p) { p.forEach(function (x) { m = Math.max(m, Math.abs(x)); }); }); return Math.ceil(m) + 1; }
    function axis(t, m) { return { title: { text: t, font: { color: ink, size: 13 } }, range: [-m, m], autorange: false, tickmode: "linear", dtick: m <= 6 ? 1 : 2, tickfont: { color: soft, size: 11 }, gridcolor: rule, zeroline: true, zerolinecolor: soft, showbackground: false }; }
    function seg3(p, q, c, name, w, dash) { return { type: "scatter3d", mode: "lines+text", x: [p[0], q[0]], y: [p[1], q[1]], z: [p[2], q[2]], line: { color: c, width: w || 8, dash: dash ? "dash" : "solid" }, text: ["", name || ""], textposition: "top center", textfont: { color: c, size: 13 }, hoverinfo: "skip" }; }
    function arr2(p, q, c, t, dash) { return [{ x: q[0], y: q[1], ax: p[0], ay: p[1], xref: "x", yref: "y", axref: "x", ayref: "y", showarrow: true, arrowhead: 3, arrowsize: 1.2, arrowwidth: dash ? 2 : 3, arrowcolor: c, text: "" }, { x: q[0], y: q[1], xref: "x", yref: "y", showarrow: false, text: t, font: { color: c, size: 13 }, xanchor: "left", yanchor: "bottom", xshift: 4 }]; }
    var o = n === 2 ? [0, 0] : [0, 0, 0];
    // picture 1: subspace in payoff space
    var m1 = rng([u, v, uv, u2, un]);
    if (n === 2) {
      var sh = [];
      if (D.rank >= 2) sh.push({ type: "scatter", x: [-m1, m1, m1, -m1, -m1], y: [-m1, -m1, m1, m1, -m1], fill: "toself", fillcolor: "rgba(47,93,138,0.10)", line: { width: 0 }, mode: "lines", hoverinfo: "skip" });
      else sh.push({ type: "scatter", mode: "lines", x: [-3 * m1 * u[0], 3 * m1 * u[0]], y: [-3 * m1 * u[1], 3 * m1 * u[1]], line: { color: blue, width: 8 }, opacity: 0.25, hoverinfo: "skip" });
      sh.push({ type: "scatter", mode: "markers", x: [0], y: [0], marker: { color: ink, size: 8 }, hoverinfo: "skip" });
      var an = [].concat(arr2(o, u, blue, D.names[0]), n > 1 ? arr2(o, v, blue, D.names[1]) : [], arr2(o, uv, green, D.names[0] + " + " + D.names[1]), arr2(o, u2, soft, "2×" + D.names[0], true), arr2(o, un, red, "−1×" + D.names[0]));
      Plotly.newPlot("lab7sub", sh, { paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: paper2, margin: { l: 60, r: 20, t: 10, b: 60 }, showlegend: false, annotations: an, xaxis: Object.assign(axis("payoff at " + D.lv[0], m1), { scaleanchor: "y", scaleratio: 1 }), yaxis: axis("payoff at " + D.lv[1], m1) }, cfg);
    } else {
      var tr = [];
      if (D.rank === 2) { var a1 = cols[D.piv[0]], b1 = cols[D.piv[1]], K = m1 * 2, c4 = [[-K, -K], [K, -K], [K, K], [-K, K]].map(function (st) { return a1.map(function (x, i) { return st[0] * x + st[1] * b1[i]; }); });
        tr.push({ type: "mesh3d", x: c4.map(function (p) { return p[0]; }), y: c4.map(function (p) { return p[1]; }), z: c4.map(function (p) { return p[2]; }), i: [0, 0], j: [1, 2], k: [2, 3], color: blue, opacity: 0.18, hoverinfo: "skip" }); }
      tr.push(seg3(o, u, blue, D.names[0])); tr.push(seg3(o, v, blue, D.names[1])); tr.push(seg3(o, uv, green, D.names[0] + " + " + D.names[1])); tr.push(seg3(o, u2, soft, "2×" + D.names[0], 4, true)); tr.push(seg3(o, un, red, "−1×" + D.names[0]));
      tr.push({ type: "scatter3d", mode: "markers", x: [0], y: [0], z: [0], marker: { color: ink, size: 5 }, hoverinfo: "skip" });
      Plotly.newPlot("lab7sub", tr, { paper_bgcolor: "rgba(0,0,0,0)", margin: { l: 0, r: 0, t: 0, b: 0 }, showlegend: false, scene: { xaxis: axis(D.lv[0], m1), yaxis: axis(D.lv[1], m1), zaxis: axis(D.lv[2], m1), aspectmode: "cube", dragmode: "turntable", camera: { eye: { x: 1.5, y: -1.5, z: 0.9 }, up: { x: 0, y: 0, z: 1 } } } }, cfg);
    }
    // picture 2: not a subspace
    if (!document.getElementById("lab7nsub")) return;
    if (D.kind === "recipes") {
      var z = D.nulls[0].map(num), r1 = D.x.map(num), r2 = r1.map(function (x, i) { return x + z[i]; }), r12 = r1.map(function (x, i) { return x + r2[i]; }), m2 = rng([z, r1, r2, r12]), K2 = m2 * 3;
      var lab = D.names.map(function (nm) { return "lots of " + nm; });
      if (n === 2) {
        Plotly.newPlot("lab7nsub", [
          { type: "scatter", mode: "lines", x: [-K2 * z[0], K2 * z[0]], y: [-K2 * z[1], K2 * z[1]], line: { color: purple, width: 2, dash: "dash" }, hoverinfo: "skip" },
          { type: "scatter", mode: "lines", x: [r1[0] - K2 * z[0], r1[0] + K2 * z[0]], y: [r1[1] - K2 * z[1], r1[1] + K2 * z[1]], line: { color: green, width: 4 }, hoverinfo: "skip" },
          { type: "scatter", mode: "markers+text", x: [0, r1[0], r2[0], r12[0]], y: [0, r1[1], r2[1], r12[1]], text: ["0", "recipe 1", "recipe 2", "recipe 1 + recipe 2"], textposition: "top right", marker: { color: [ink, green, green, red], size: 10 }, hoverinfo: "skip" }],
          { paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: paper2, margin: { l: 60, r: 20, t: 10, b: 60 }, showlegend: false, xaxis: Object.assign(axis(lab[0], m2), { scaleanchor: "y", scaleratio: 1 }), yaxis: axis(lab[1], m2) }, cfg);
      } else {
        function ln(p, d, c, w, dash) { return { type: "scatter3d", mode: "lines", x: [p[0] - K2 * d[0], p[0] + K2 * d[0]], y: [p[1] - K2 * d[1], p[1] + K2 * d[1]], z: [p[2] - K2 * d[2], p[2] + K2 * d[2]], line: { color: c, width: w, dash: dash ? "dash" : "solid" }, hoverinfo: "skip" }; }
        Plotly.newPlot("lab7nsub", [ln([0, 0, 0], z, purple, 3, true), ln(r1, z, green, 7),
          { type: "scatter3d", mode: "markers+text", x: [0, r1[0], r2[0], r12[0]], y: [0, r1[1], r2[1], r12[1]], z: [0, r1[2], r2[2], r12[2]], text: ["0", "recipe 1", "recipe 2", "recipe 1 + recipe 2"], textposition: "top center", marker: { color: [ink, green, green, red], size: 6 }, textfont: { size: 13 }, hoverinfo: "skip" }],
          { paper_bgcolor: "rgba(0,0,0,0)", margin: { l: 0, r: 0, t: 0, b: 0 }, showlegend: false, scene: { xaxis: axis(lab[0], m2), yaxis: axis(lab[1], m2), zaxis: axis(lab[2], m2), aspectmode: "cube", dragmode: "turntable", camera: { eye: { x: 1.5, y: -1.5, z: 0.9 }, up: { x: 0, y: 0, z: 1 } } } }, cfg);
      }
    } else {
      var m3 = rng([u, v, uv]), K3 = m3 * 3;
      if (n === 2) {
        Plotly.newPlot("lab7nsub", [
          { type: "scatter", mode: "lines", x: [-K3 * u[0], K3 * u[0]], y: [-K3 * u[1], K3 * u[1]], line: { color: blue, width: 3 }, hoverinfo: "skip" },
          { type: "scatter", mode: "lines", x: [-K3 * v[0], K3 * v[0]], y: [-K3 * v[1], K3 * v[1]], line: { color: green, width: 3 }, hoverinfo: "skip" },
          { type: "scatter", mode: "markers+text", x: [0, u[0], v[0], uv[0]], y: [0, u[1], v[1], uv[1]], text: ["0", D.names[0], D.names[1], D.names[0] + " + " + D.names[1] + " (on neither line)"], textposition: "top right", marker: { color: [ink, blue, green, red], size: 10 }, hoverinfo: "skip" }],
          { paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: paper2, margin: { l: 60, r: 20, t: 10, b: 60 }, showlegend: false, xaxis: Object.assign(axis("payoff at " + D.lv[0], m3), { scaleanchor: "y", scaleratio: 1 }), yaxis: axis("payoff at " + D.lv[1], m3) }, cfg);
      } else {
        function ln3(d, c) { return { type: "scatter3d", mode: "lines", x: [-K3 * d[0], K3 * d[0]], y: [-K3 * d[1], K3 * d[1]], z: [-K3 * d[2], K3 * d[2]], line: { color: c, width: 5 }, hoverinfo: "skip" }; }
        Plotly.newPlot("lab7nsub", [ln3(u, blue), ln3(v, green),
          { type: "scatter3d", mode: "markers+text", x: [0, u[0], v[0], uv[0]], y: [0, u[1], v[1], uv[1]], z: [0, u[2], v[2], uv[2]], text: ["0", D.names[0], D.names[1], D.names[0] + " + " + D.names[1] + " (on neither line)"], textposition: "top center", marker: { color: [ink, blue, green, red], size: 6 }, hoverinfo: "skip" }],
          { paper_bgcolor: "rgba(0,0,0,0)", margin: { l: 0, r: 0, t: 0, b: 0 }, showlegend: false, scene: { xaxis: axis(D.lv[0], m3), yaxis: axis(D.lv[1], m3), zaxis: axis(D.lv[2], m3), aspectmode: "cube", dragmode: "turntable", camera: { eye: { x: 1.5, y: -1.5, z: 0.9 }, up: { x: 0, y: 0, z: 1 } } } }, cfg);
      }
    }
  }


  var csnAO = null;
  function drawAndOr(D) {
    if (!window.Plotly) { setTimeout(function () { drawAndOr(D); }, 300); return; }
    function cssv(v) { return getComputedStyle(document.documentElement).getPropertyValue(v).trim(); }
    var blue = cssv("--accent"), green = cssv("--ex-b"), purple = cssv("--thm-b"), red = cssv("--warn-b"), ink = cssv("--ink"), soft = cssv("--ink-soft"), rule = cssv("--rule"), paper2 = cssv("--paper-2");
    var cfg = { responsive: true, displaylogo: false, modeBarButtonsToRemove: ["toImage"] };
    var a = D.a.map(function (v) { return v.num(); }), b = D.b.map(function (v) { return v.num(); }), ab = a.map(function (x, i) { return x + b[i]; });
    var m = 1; [a, b, ab].forEach(function (p) { p.forEach(function (x) { m = Math.max(m, Math.abs(x)); }); }); m = Math.ceil(m) + 1; var K = m * 3;
    function axis(t) { return { title: { text: t, font: { color: ink, size: 13 } }, range: [-m, m], autorange: false, tickmode: "linear", dtick: m <= 6 ? 1 : 2, tickfont: { color: soft, size: 11 }, gridcolor: rule, zeroline: true, zerolinecolor: soft, showbackground: false }; }
    if (D.n === 2) {
      var tr = [];
      if (!D.par) tr.push({ type: "scatter", x: [-m, m, m, -m, -m], y: [-m, -m, m, m, -m], fill: "toself", fillcolor: "rgba(111,76,155,0.08)", line: { width: 0 }, mode: "lines", hoverinfo: "skip" });
      tr.push({ type: "scatter", mode: "lines", x: [-K * a[0], K * a[0]], y: [-K * a[1], K * a[1]], line: { color: blue, width: 4 }, hoverinfo: "skip" });
      tr.push({ type: "scatter", mode: "lines", x: [-K * b[0], K * b[0]], y: [-K * b[1], K * b[1]], line: { color: green, width: D.par ? 2 : 4, dash: D.par ? "dash" : "solid" }, hoverinfo: "skip" });
      tr.push({ type: "scatter", mode: "markers+text", x: [0, a[0], b[0], ab[0]], y: [0, a[1], b[1], ab[1]], text: [D.par ? "" : "AND = 0", D.names[0], D.names[1], D.names[0] + " + " + D.names[1]], textposition: "top right", marker: { color: [ink, blue, green, red], size: [11, 9, 9, 12] }, textfont: { size: 13 }, hoverinfo: "skip" });
      Plotly.newPlot("lab7ao", tr, { paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: paper2, margin: { l: 60, r: 20, t: 10, b: 60 }, showlegend: false, xaxis: Object.assign(axis("payoff at " + D.lv[0]), { scaleanchor: "y", scaleratio: 1 }), yaxis: axis("payoff at " + D.lv[1]) }, cfg);
    } else {
      function ln(d, c, w, dash) { return { type: "scatter3d", mode: "lines", x: [-K * d[0], K * d[0]], y: [-K * d[1], K * d[1]], z: [-K * d[2], K * d[2]], line: { color: c, width: w, dash: dash ? "dash" : "solid" }, hoverinfo: "skip" }; }
      var tr3 = [];
      if (!D.par) { var S = m * 2, c4 = [[-S, -S], [S, -S], [S, S], [-S, S]].map(function (st) { return a.map(function (x, i) { return st[0] * x + st[1] * b[i]; }); });
        tr3.push({ type: "mesh3d", x: c4.map(function (p) { return p[0]; }), y: c4.map(function (p) { return p[1]; }), z: c4.map(function (p) { return p[2]; }), i: [0, 0], j: [1, 2], k: [2, 3], color: purple, opacity: 0.12, hoverinfo: "skip" }); }
      tr3.push(ln(a, blue, 7)); tr3.push(ln(b, green, D.par ? 3 : 7, D.par));
      tr3.push({ type: "scatter3d", mode: "markers+text", x: [0, a[0], b[0], ab[0]], y: [0, a[1], b[1], ab[1]], z: [0, a[2], b[2], ab[2]], text: [D.par ? "" : "AND = 0", D.names[0], D.names[1], D.names[0] + " + " + D.names[1]], textposition: "top center", marker: { color: [ink, blue, green, red], size: [7, 6, 6, 8] }, textfont: { size: 13 }, hoverinfo: "skip" });
      Plotly.newPlot("lab7ao", tr3, { paper_bgcolor: "rgba(0,0,0,0)", margin: { l: 0, r: 0, t: 0, b: 0 }, showlegend: false, scene: { xaxis: axis(D.lv[0]), yaxis: axis(D.lv[1]), zaxis: axis(D.lv[2]), aspectmode: "cube", dragmode: "turntable", camera: { eye: { x: 1.5, y: -1.5, z: 0.9 }, up: { x: 0, y: 0, z: 1 } } } }, cfg);
    }
  }

  function csnSections(A, tgt, Lv, n, vars, names, R, tradeTxt, P) {
    var h = [], lv = Lv.map(fmtLvl);
    function ft(v) { var t = (v.f || Math.abs(v.d) > 12) ? String(+v.num().toFixed(2)) : (v.d === 1 ? String(v.n) : v.n + '/' + v.d); return t.replace('-', '−'); }
    function fp(v) { return v.num() < 0 ? '(' + ft(v) + ')' : ft(v); }
    function vec(r) { return '(' + r.map(ft).join(', ') + ')'; }
    function col(Mx, j) { return Mx.map(function (r) { return r[j]; }); }
    function dot(u, v) { return u.reduce(function (sm, a, k) { return sm.add(a.mul(v[k])); }, ZERO); }
    function payOf(l) { return A.map(function (r) { return dot(r, l); }); }
    function lotsTxt(lots) { var parts = lots.map(function (v, j) { return v.isZero() ? null : (v.num() < 0 ? 'sell ' + ft(v.neg()) : 'buy ' + ft(v)) + ' ' + names[j]; }).filter(Boolean); return parts.length ? parts.join(', ') : 'no trade'; }
    function levelSum(lots, want) { return Lv.map(function (_, i) { var terms = lots.map(function (v, j) { return v.isZero() ? null : fp(v) + '×' + fp(A[i][j]); }).filter(Boolean); var got = dot(A[i], lots); return '<li>At ' + lv[i] + ': ' + (terms.length ? terms.join(' + ') : '0') + ' = <b>' + ft(got) + '</b>' + (want ? (got.sub(want[i]).isZero() ? ' ✓' : ' ✗') : '') + '</li>'; }).join(''); }
    var zero = Lv.map(function () { return ZERO; }), N0 = solve(A, zero), nulls = N0.nulls || [], rk = N0.rank;
    var zeroRows = Lv.map(function (_, i) { return A[i].every(function (v) { return v.isZero(); }) ? i : -1; }).filter(function (i) { return i >= 0; });

    // ---- 4. COLUMN SPACE ----
    var eJ = function (j) { return names.map(function (_, k) { return k === j ? ONE : ZERO; }); };
    var mixes = [eJ(0)]; if (n > 1) { mixes.push(eJ(1)); mixes.push(eJ(0).map(function (v, i) { return v.add(eJ(1)[i]); })); mixes.push(eJ(0).map(function (v, i) { return v.sub(eJ(1)[i]); })); } if (n === 3) mixes.push(names.map(function () { return ONE; }));
    h.push('<h4>4. Column space: which payoffs can you build?</h4>' +
      '<p><b>Definition.</b> The column space $C(A)$ = all combinations of the columns = <b>all the payoffs you can build from your products</b>.</p>' +
      '<div class="box intuition"><span class="label">Remember this</span><p>Column space answers: <b>what outputs can I produce by combining the columns?</b> A target <b>inside</b> it can be built; a target <b>outside</b> cannot.</p></div>' +
      '<p><b>How the diagram is formed, step by step.</b></p><ol>' +
      '<li><b>Draw each product as an arrow</b> from 0 to its payoff (axes = payoffs at ' + lv.join(' / ') + '): ' + names.map(function (nm, j) { return nm + ' → ' + vec(col(A, j)); }).join('; ') + '.</li>' +
      '<li><b>A mix = walking along the arrows.</b> Where you land is that mix\'s payoff:</li></ol>' +
      '<table><tr><th>Mix</th><th>Lands at (payoff)</th></tr>' + mixes.map(function (mx) { return '<tr><td>' + lotsTxt(mx) + '</td><td><b>' + vec(payOf(mx)) + '</b></td></tr>'; }).join('') + '</table>' +
      '<ol start="3"><li><b>Colour every point you can land on.</b> Your products point in <b>' + rk + '</b> different direction' + (rk === 1 ? '' : 's') + ' (the rank), so they fill ' + (rk >= n ? 'the whole ' + (n === 2 ? 'plane' : 'space') : rk === 2 ? 'a flat sheet through 0' : 'a line through 0') + '.' +
        (zeroRows.length ? ' Notice: every product pays 0 at ' + zeroRows.map(function (i) { return lv[i]; }).join(', ') + ', so <b>every</b> buildable payoff is 0 there too.' : '') + '</li>' +
      '<li><b>Put in the client\'s point</b> ' + vec(tgt) + ': ' + (R.bad.length ? '<b>outside</b> (red gap), so it cannot be built.' : '<b>inside</b>, so some mix lands on it.') + '</li></ol>' +
      '<figure class="fig plot3d"><div id="lab7cs" class="plot3d-box" style="height:460px"></div><figcaption>Your column space. Arrows = products; shaded = every payoff you can build; red dot = your client.</figcaption></figure>' +
      (R.bad.length ? '<p><b>Check:</b> elimination ends with a row saying 0 = something non-zero, so no lots pay exactly ' + vec(tgt) + '.' + (zeroRows.length && zeroRows.some(function (i) { return !tgt[i].isZero(); }) ? ' Simple reason: the client wants ' + zeroRows.filter(function (i) { return !tgt[i].isZero(); }).map(function (i) { return ft(tgt[i]) + ' at ' + lv[i]; }).join(', ') + ', but every product pays 0 there.' : '') + '</p>'
        : '<p><b>Check one recipe, level by level</b> (' + lotsTxt(R.x) + '):</p><ul>' + levelSum(R.x, tgt) + '</ul>'));

    // ---- 5. NULLSPACE ----
    h.push('<h4>5. Nullspace: which trades pay nothing at all?</h4>' +
      '<p><b>Definition.</b> The nullspace $N(A)$ = all lots $x$ with $Ax = 0$: every position that pays <b>0 at every Nifty level</b> ("zero-payoff trades"). It always contains "no trade".</p>' +
      '<p><b>How to find it, step by step.</b></p><ol>' +
      '<li><b>Set every level\'s payoff to 0:</b> ' + A.map(function (r, i) { return '$' + eqTex(r, ZERO, n) + '$ (' + lv[i] + ')'; }).join('; ') + '.</li>' +
      '<li><b>Eliminate</b> (as in Lecture 03): pivot columns = ' + (N0.pivots.map(function (c) { return names[c]; }).join(', ') || 'none') + '; free columns = ' + (N0.free.map(function (c) { return names[c]; }).join(', ') || 'none') + '.</li>' +
      (nulls.length ? '<li><b>Set one free product to 1</b> (the others 0) and solve for the rest. That gives the special solution' + (nulls.length > 1 ? 's' : '') + ':</li></ol>' : '<li><b>No free columns</b>, so nothing can be set freely: the only answer is "no trade".</li></ol>'));
    if (nulls.length) {
      var prem = P.map(function (pr) { return parseFr(pr.p); });
      nulls.forEach(function (z, k) {
        var cost = prem.some(function (p) { return p === null; }) ? null : dot(z, prem);
        h.push('<p><b>Zero trade ' + (k + 1) + ': ' + lotsTxt(z) + '</b> (lots ' + vec(z) + '). What it pays:</p><ul>' + levelSum(z, zero) + '</ul>' +
          '<p><b>So what does this tell us?</b> This mix pays nothing in every scenario: the products are not all different, and one is a <b>copy</b> of the others. ' +
          (cost === null ? '' : 'Its price today: ' + z.map(function (v, j) { return fp(v) + ' × ' + ft(prem[j]); }).join(' + ') + ' = <b>' + ft(cost) + '</b>. ' + (cost.isZero() ? 'Zero, as it must be: no arbitrage.' : 'Not zero! Something that pays nothing must cost nothing, so this is <b>arbitrage</b>: ' + (cost.num() > 0 ? 'do the opposite trade and receive ' + ft(cost) + ' today for free.' : 'do this trade and receive ' + ft(cost.neg()) + ' today for free.'))) + '</p>');
      });
      var z0 = nulls[0], two = z0.map(function (v) { return v.mul(new Fr(2)); });
      h.push('<p><b>It is a vector space:</b> 2 × zero trade 1 = ' + lotsTxt(two) + ' still pays ' + vec(payOf(two)) + ', and adding zero trades still pays 0.</p>');
      h.push('<p><b>How the diagram is formed, step by step</b> (axes = <b>lots</b> of ' + names.join(', ') + ', not payoffs):</p><ol>' +
        '<li>Mark "no trade" at 0 and zero trade 1 at ' + vec(z0) + '.</li>' +
        '<li>Scale it (2×, −1×, ½×): all these zero trades lie on ' + (nulls.length === 1 ? 'one line' : 'one flat sheet') + ' through 0 (purple dashed): that is the nullspace.</li>' +
        (R.bad.length ? '' : '<li>Mark one recipe for your client, ' + vec(R.x) + ' (green dot).</li><li>Add any zero trade to it: it still pays the client exactly the same. So <b>every</b> recipe lies on the same ' + (nulls.length === 1 ? 'line' : 'sheet') + ', shifted to pass through the recipe (green).</li>') + '</ol>' +
        '<figure class="fig plot3d"><div id="lab7ns" class="plot3d-box" style="height:440px"></div><figcaption>Lots space. Purple = the nullspace (trades that pay nothing). ' + (R.bad.length ? '' : 'Green = every recipe for your client: one recipe + any zero trade.') + '</figcaption></figure>');
      if (!R.bad.length) {
        var ts = [ONE, ONE.neg(), new Fr(2)];
        h.push('<p><b>Why it matters: many recipes.</b> Recipe + any amount of zero trade 1:</p><table><tr><th>Recipe</th><th>Lots</th><th>In words</th><th>Pays</th></tr>' +
          '<tr><td>the one found</td><td>' + vec(R.x) + '</td><td>' + lotsTxt(R.x) + '</td><td>' + vec(payOf(R.x)) + ' ✓</td></tr>' +
          ts.map(function (t) { var l = R.x.map(function (v, i) { return v.add(z0[i].mul(t)); }); return '<tr><td>+ ' + ft(t) + ' × zero trade</td><td>' + vec(l) + '</td><td>' + lotsTxt(l) + '</td><td>' + vec(payOf(l)) + ' ✓</td></tr>'; }).join('') + '</table>' +
          '<p>All pay the client exactly ' + vec(tgt) + '. If they cost different amounts today, sell the dear one and buy the cheap one: that is the arbitrage above.</p>');
      }
    } else {
      h.push('<p><b>So what does this tell us?</b> Only "no trade" pays 0 everywhere: every product adds something new (no copies). So each buildable payoff has <b>exactly one</b> recipe, and there is no zero-payoff trade to mis-price.</p>' +
        '<figure class="fig plot3d"><div id="lab7ns" class="plot3d-box" style="height:380px"></div><figcaption>Lots space: the nullspace is just the point 0' + (R.bad.length ? '.' : '; your client has exactly one recipe (green).') + '</figcaption></figure>');
    }

    // ---- 6. SUBSPACE ----
    var m = n, colA = function (j) { return A.map(function (r) { return r[j]; }); };
    var pA = colA(0), pB = n > 1 ? colA(1) : colA(0), pAB = pA.map(function (v, i) { return v.add(pB[i]); }), p2A = pA.map(function (v) { return v.mul(new Fr(2)); }), pNegA = pA.map(function (v) { return v.neg(); });
    var sub = ['<h4>6. Subspace: a "closed room" of vectors</h4>' +
      '<p><b>Definition.</b> A <b>subspace</b> is a collection of vectors, sitting inside a bigger space, that passes 3 tests:</p>' +
      '<table><tr><th>Test</th><th>Meaning</th><th>Market words</th></tr>' +
      '<tr><td>1. Contains 0</td><td>the zero vector is in it</td><td>"no trade" belongs</td></tr>' +
      '<tr><td>2. Add</td><td>add any two members → still a member</td><td>combine two positions → still allowed</td></tr>' +
      '<tr><td>3. Scale</td><td>multiply a member by any number (also negative) → still a member</td><td>size up, size down, or reverse (sell) → still allowed</td></tr></table>' +
      '<p>Think of a room inside a house: adding and stretching never walks you out of the room.</p>'];
    sub.push('<p><b>Picture 1: a subspace (your column space). How it is formed:</b></p><ol>' +
      '<li>Shade every payoff your products can build (section 4): ' + (rk >= n ? 'here that is the whole ' + (n === 2 ? 'plane' : 'space') : rk === 2 ? 'a flat sheet through 0' : 'a line through 0') + '.</li>' +
      '<li>Pick two members: ' + names[0] + ' pays ' + vec(pA) + (n > 1 ? ' and ' + names[1] + ' pays ' + vec(pB) : '') + ' (blue arrows).</li>' +
      (n > 1 ? '<li><b>Add</b> them: ' + vec(pA) + ' + ' + vec(pB) + ' = ' + vec(pAB) + ' (green): it lands on the shaded shape.</li>' : '') +
      '<li><b>Scale</b>: 2 × ' + names[0] + ' = ' + vec(p2A) + ' and −1 × ' + names[0] + ' = ' + vec(pNegA) + ' (selling, red): both land on it too.</li>' +
      '<li><b>Zero</b>: the black dot at 0 is on it.</li></ol>' +
      '<figure class="fig plot3d"><div id="lab7sub" class="plot3d-box" style="height:440px"></div><figcaption><b>A subspace.</b> Shaded = your column space. Every add or scale lands back on it, and 0 is on it: it is closed.</figcaption></figure>');
    sub.push('<p><b>Check 1: the column space is a subspace</b> (from the picture):</p><ul>' +
      '<li>Contains 0: no trade pays ' + vec(zero) + ' ✓</li>' +
      (n > 1 ? '<li>Add: ' + vec(pA) + ' + ' + vec(pB) + ' = ' + vec(pAB) + ' = payoff of buy 1 ' + names[0] + ' + 1 ' + names[1] + ' ✓</li>' : '') +
      '<li>Scale: ' + vec(p2A) + ' (buy 2 ' + names[0] + ') ✓; ' + vec(pNegA) + ' (sell 1 ' + names[0] + ') ✓</li></ul>');
    if (nulls.length) { var zN = nulls[0], zN2 = zN.map(function (v) { return v.mul(new Fr(2)); });
      sub.push('<p><b>Check 2: the nullspace is a subspace</b> (zero trades): contains no trade ✓; 2 × zero trade = ' + lotsTxt(zN2) + ' still pays ' + vec(payOf(zN2)) + ' ✓; zero trade + zero trade pays 0 + 0 = 0 ✓.</p>'); }
    else sub.push('<p><b>Check 2: the nullspace</b> here is just {no trade}: 0 + 0 = 0 and any number × 0 = 0, so it passes too (the smallest possible subspace).</p>');
    var notSubKind = (nulls.length && !R.bad.length) ? 'recipes' : 'union';
    if (notSubKind === 'recipes') {
      var r1 = R.x, r2 = R.x.map(function (v, i) { return v.add(nulls[0][i]); }), r12 = r1.map(function (v, i) { return v.add(r2[i]); });
      sub.push('<p><b>Picture 2: NOT a subspace, "all recipes for your client".</b> How it is formed (axes = lots):</p><ol>' +
        '<li>Every recipe for the client ' + vec(tgt) + ' lies on one line (green): recipe 1 ' + vec(r1) + ' plus any zero trade.</li>' +
        '<li>Recipe 2 = recipe 1 + zero trade = ' + vec(r2) + ' (also on the line; it also pays ' + vec(payOf(r2)) + ').</li>' +
        '<li><b>Add</b> the two recipes: ' + vec(r1) + ' + ' + vec(r2) + ' = ' + vec(r12) + ' (red). It pays ' + vec(payOf(r12)) + ' = 2 × the client, so it is <b>off</b> the line ✗.</li>' +
        '<li>0 (no trade) pays ' + vec(zero) + ', not the client: <b>not</b> on the line ✗.</li></ol>' +
        '<figure class="fig plot3d"><div id="lab7nsub" class="plot3d-box" style="height:440px"></div><figcaption><b>Not a subspace.</b> Green = all recipes for one client. Adding two of them (red) leaves the line, and 0 is not on it. (Purple dashed = the zero trades through 0, which <b>is</b> a subspace: the green line is the same line, shifted.)</figcaption></figure>');
    } else if (n > 1) {
      sub.push('<p><b>Picture 2: NOT a subspace, "either line".</b> How it is formed:</p><ol>' +
        '<li>Line 1 = every multiple of ' + names[0] + ' (blue); line 2 = every multiple of ' + names[1] + ' (green). Each line alone is a subspace.</li>' +
        '<li>Take the <b>union</b> (points on either line). Add ' + names[0] + ' ' + vec(pA) + ' + ' + names[1] + ' ' + vec(pB) + ' = ' + vec(pAB) + ' (red): it is on <b>neither</b> line ✗.</li>' +
        '<li>So the union is not closed under adding: not a subspace. The <b>overlap</b> (on both lines) is just 0, which is a subspace ✓.</li></ol>' +
        '<figure class="fig plot3d"><div id="lab7nsub" class="plot3d-box" style="height:440px"></div><figcaption><b>Not a subspace.</b> Two lines together: adding one point from each (red) lands on neither line.</figcaption></figure>');
    }
    sub.push('<p><b>Why a trader cares:</b> a subspace is a set of positions you can freely combine, size and reverse without leaving it. Buildable payoffs and zero trades behave that way; "exactly what one client wants" does not.</p>');
    sub.push('<div class="box theorem"><span class="label">Remember: subspace in one look</span>' +
      '<p><b>Definition.</b> A subspace is a set of positions (or payoffs) where <b>no trade is allowed</b>, and <b>adding</b> or <b>resizing</b> allowed positions always keeps them allowed. On a graph it is always a line, a plane or everything, <b>through 0</b>.</p>' +
      '<p class="answer">Subspace → you can freely scale (up, down, negative) and combine, and you stay inside. Not a subspace → you can\'t: some scale or combination takes you outside.</p>' +
      '<p><b>The 3-test check:</b> (1) (0, 0) is in it; (2) add two members → still in; (3) any number × a member → still in. One failure = not a subspace.</p>' +
      '<table><tr><th>Rule (positions = lots of A, B)</th><th>Examples</th><th>Test that decides</th><th>Subspace?</th></tr>' +
      '<tr><td>always hold 2 B per 1 A</td><td>(1, 2), (2, 4), (−1, −2)</td><td>(1, 2) + (2, 4) = (3, 6), still 2 per 1</td><td>✓ a line through 0</td></tr>' +
      '<tr><td>always hold 1 extra B (B = 2A + 1)</td><td>(0, 1), (1, 3)</td><td>(0, 0) not allowed; (0, 1) + (1, 3) = (1, 4) breaks the rule</td><td>✗ a line NOT through 0</td></tr>' +
      '<tr><td>buy only (lots ≥ 0)</td><td>(1, 1), (2, 0)</td><td>−1 × (1, 1) = (−1, −1) needs selling</td><td>✗</td></tr>' +
      '<tr><td>anything you like</td><td>every position</td><td>all pass</td><td>✓ the whole space</td></tr>' +
      '<tr><td>no trade only</td><td>(0, 0)</td><td>0 + 0 = 0, any number × 0 = 0</td><td>✓ the <b>zero subspace</b></td></tr></table>' +
      '<p><b>Where it shows up in these lessons:</b></p><table><tr><th>Set</th><th>Subspace?</th><th>When</th></tr>' +
      '<tr><td>column space (all payoffs you can build)</td><td>✓ always</td><td>every market</td></tr>' +
      '<tr><td>nullspace (all trades that pay 0 everywhere)</td><td>✓ always</td><td>every market</td></tr>' +
      '<tr><td>→ nullspace = {0} (zero subspace)</td><td>✓</td><td>all products truly different (e.g. the "Two levels" preset)</td></tr>' +
      '<tr><td>→ nullspace = a line of zero trades</td><td>✓</td><td>a product is a copy (e.g. put–call parity, or two identical products)</td></tr>' +
      '<tr><td>all recipes for one client</td><td>✗</td><td>a line not through 0 (two recipes together pay 2× the client)</td></tr></table>' +
      '<p><b>What to do.</b></p><table><tr><th>If it IS a subspace</th><th>If it is NOT</th></tr><tr><td><ul>' +
      '<li>Column space: check the client is inside, find the recipe, then reuse it: 10× the client = 10× the lots; two clients = add the recipes; closing = −1× the lots.</li>' +
      '<li>Nullspace {0}: one recipe per payoff, nothing to arbitrage between products.</li>' +
      '<li>Nullspace a line or plane: find the copy relation, check every zero trade costs 0 (else arbitrage), and pick the cheapest recipe.</li></ul></td><td><ul>' +
      '<li>All recipes for a client: write it as <b>one recipe + the nullspace</b> and work with the nullspace.</li>' +
      '<li>Client outside the column space: closest hedge (Unit II), add a product that brings the missing direction, or decline.</li>' +
      '<li>Buy only: use optimization (lots ≥ 0, lowest cost), not plain linear algebra.</li>' +
      '<li>"Only A or only B": use the smallest subspace containing both: mix A and B freely (the column space).</li></ul></td></tr></table></div>');
    h.push(sub.join(''));

    // ---- 6b. AND and OR (intersection and union) ----
    if (n > 1) {
      var par = (function () { var k = -1; for (var i = 0; i < pA.length; i++) if (!pA[i].isZero()) { k = i; break; } if (k < 0) return true; var t = pB[k].div(pA[k]); return pA.every(function (v, i) { return v.mul(t).sub(pB[i]).isZero(); }); })();
      function onLine(v, d) { var k = -1; for (var i = 0; i < d.length; i++) if (!d[i].isZero()) { k = i; break; } if (k < 0) return v.every(function (x) { return x.isZero(); }); var t = v[k].div(d[k]); return d.every(function (x, i) { return x.mul(t).sub(v[i]).isZero(); }); }
      var mB = pB.map(function (v) { return v.neg(); }), p2B = pB.map(function (v) { return v.mul(new Fr(2)); });
      function yn(b) { return b ? '✓ yes' : '✗ no'; }
      var ao = [];
      ao.push('<h4>6b. AND and OR: intersection and union</h4>' +
        '<p><b>What.</b> Take two sets of payoffs. <b>AND</b> (intersection, $\\cap$) = payoffs that are in <b>both</b> sets. <b>OR</b> (union, $\\cup$) = payoffs that are in <b>at least one</b> set. The question: are these new sets subspaces?</p>' +
        '<p><b>The two sets, from your products:</b></p><table><tr><th>Set</th><th>What is in it</th><th>Examples</th><th>Subspace?</th></tr>' +
        '<tr><td><b>Line A</b></td><td>every payoff of "' + names[0] + ' only" (any lots of ' + names[0] + ', buy or sell)</td><td>' + vec(pA) + ', ' + vec(p2A) + ', ' + vec(pNegA) + ', ' + vec(zero) + '</td><td>✓ (a line through 0)</td></tr>' +
        '<tr><td><b>Line B</b></td><td>every payoff of "' + names[1] + ' only"</td><td>' + vec(pB) + ', ' + vec(p2B) + ', ' + vec(mB) + ', ' + vec(zero) + '</td><td>✓ (a line through 0)</td></tr></table>');
      // AND
      ao.push('<p><b>AND, step by step.</b> Check each payoff: is it on line A? is it on line B? Only "yes and yes" counts.</p>' +
        '<table><tr><th>Payoff</th><th>On line A?</th><th>On line B?</th><th>In A AND B?</th></tr>' +
        [['0 (no trade)', zero], [names[0] + ' ' + vec(pA), pA], [names[1] + ' ' + vec(pB), pB], ['2×' + names[0] + ' ' + vec(p2A), p2A]].map(function (r) { var a1 = onLine(r[1], pA), b1 = onLine(r[1], pB); return '<tr><td>' + r[0] + '</td><td>' + yn(a1) + '</td><td>' + yn(b1) + '</td><td><b>' + yn(a1 && b1) + '</b></td></tr>'; }).join('') + '</table>' +
        '<p><b>What we have now:</b> ' + (par ? names[1] + ' is a multiple of ' + names[0] + ', so line A and line B are the <b>same line</b>: AND = that whole line.' : 'To be on both lines a payoff must be "some lots of ' + names[0] + '" and "some lots of ' + names[1] + '" at the same time. ' + names[0] + ' and ' + names[1] + ' point in different directions, so the only such payoff is <b>0</b>: AND = {0}.') + '</p>' +
        '<p><b>Is AND a subspace?</b> Zero: 0 is on both lines ✓. Add: if two payoffs are on both lines, their sum is on line A (line A is closed) and on line B (line B is closed) ✓. Scale: same reason ✓. <b>So AND is always a subspace</b>, for any two subspaces. It is not always just 0: it is 0 only when the sets share no direction.</p>');
      // OR
      var orRows = [['0 (no trade)', zero], [names[0] + ' ' + vec(pA), pA], [names[1] + ' ' + vec(pB), pB], ['−1×' + names[1] + ' ' + vec(mB), mB], [names[0] + ' + ' + names[1] + ' ' + vec(pAB), pAB]];
      ao.push('<p><b>OR, step by step.</b> Anything on line A, or on line B (or both), is a member:</p>' +
        '<table><tr><th>Payoff</th><th>On line A?</th><th>On line B?</th><th>In A OR B?</th></tr>' +
        orRows.map(function (r) { var a1 = onLine(r[1], pA), b1 = onLine(r[1], pB); return '<tr><td>' + r[0] + '</td><td>' + yn(a1) + '</td><td>' + yn(b1) + '</td><td><b>' + yn(a1 || b1) + '</b></td></tr>'; }).join('') + '</table>' +
        '<p><b>The 3 tests on OR:</b></p><table><tr><th>Test</th><th>Try</th><th>Result</th></tr>' +
        '<tr><td>Zero</td><td>0 is on both lines</td><td>✓</td></tr>' +
        '<tr><td>Scale</td><td>any multiple of a member stays on its own line (2×' + names[0] + ', −1×' + names[1] + ')</td><td>✓</td></tr>' +
        '<tr><td>Add</td><td>' + names[0] + ' ' + vec(pA) + ' + ' + names[1] + ' ' + vec(pB) + ' = ' + vec(pAB) + '</td><td>' + (par ? '✓ (same line)' : '<b>✗ on neither line</b>') + '</td></tr></table>' +
        '<p><b>What we have now:</b> ' + (par ? 'because the two lines are the same, OR is just that line, so here it passes. That only happens when one set sits inside the other.' : 'one failure is enough: <b>OR is not a subspace</b>. Adding one member from each line jumps off both lines.') + '</p>');
      // diagram
      ao.push('<p><b>How the diagram is formed:</b></p><ol>' +
        '<li>Draw line A (blue): every multiple of ' + vec(pA) + '.</li>' +
        '<li>Draw line B (green): every multiple of ' + vec(pB) + '.</li>' +
        '<li><b>AND</b> = where they cross: ' + (par ? 'they lie on top of each other, so the whole line.' : 'only the black dot at 0.') + '</li>' +
        '<li><b>OR</b> = both lines together (blue + green).</li>' +
        '<li>Add ' + names[0] + ' + ' + names[1] + ': the red dot ' + vec(pAB) + (par ? ' lands on the line.' : ' lands on neither line, so OR is not closed.') + '</li>' +
        '<li><b>The fix</b> (light purple): allow <b>all mixes</b> of ' + names[0] + ' and ' + names[1] + '. That fills ' + (par ? 'the same line' : (n === 2 ? 'the whole plane' : 'a flat sheet')) + ' and contains the red dot: the smallest subspace holding both lines.</li></ol>' +
        '<figure class="fig plot3d"><div id="lab7ao" class="plot3d-box" style="height:440px"></div><figcaption><b>AND and OR.</b> Blue = line A, green = line B. AND = their crossing (black). OR = both lines. Red = ' + names[0] + ' + ' + names[1] + '. Light purple = all mixes (the fix).</figcaption></figure>');
      var tRatio = null; if (par) { var kk0 = -1; for (var q0 = 0; q0 < pA.length; q0++) if (!pA[q0].isZero()) { kk0 = q0; break; } if (kk0 >= 0) tRatio = pB[kk0].div(pA[kk0]); }
      var tTxt = tRatio ? (tRatio.f ? String(+tRatio.num().toFixed(2)) : (tRatio.d === 1 ? String(tRatio.n) : tRatio.n + '/' + tRatio.d)).replace('-', '−') : '2';
      var ratioTxt = par && tRatio ? 'here ' + names[1] + ' = ' + tTxt + ' × ' + names[0] + ', so 1 lot of ' + names[1] + ' does the job of ' + tTxt + (tTxt === '1' ? ' lot of ' : ' lots of ') + names[0] : 'e.g. if B = 2 × A, 1 lot of B does the job of 2 lots of A';
      var priceTxt = par && tRatio ? 'price of ' + names[1] + ' must be ' + tTxt + ' × price of ' + names[0] : 'if B = 2 × A, price of B must be 2 × price of A';
      var zeroTxt = par && tRatio ? 'buy 1 ' + names[1] + ', sell ' + tTxt + ' ' + names[0] : 'buy B, sell 2 A';
      ao.push('<table><tr><th></th><th>AND (intersection)</th><th>OR (union)</th></tr>' +
        '<tr><td>Rule</td><td>in both sets</td><td>in at least one set</td></tr>' +
        '<tr><td>Your market</td><td>' + (par ? 'the whole line' : '{0}') + '</td><td>' + (par ? 'the same line' : 'line A + line B') + '</td></tr>' +
        '<tr><td>Subspace?</td><td>✓ always</td><td>' + (par ? '✓ here (one inside the other)' : '✗ usually not') + '</td></tr>' +
        '<tr><td>Market meaning</td><td>payoffs you can make with ' + names[0] + ' alone <b>and</b> with ' + names[1] + ' alone</td><td>the rule "trade only ' + names[0] + ' or only ' + names[1] + ', never both"</td></tr>' +
        '<tr><td>What to do</td><td>use it freely: it is closed</td><td>allow all mixes (the column space of those products)</td></tr></table>' +
        '<div class="box intuition"><span class="label">What the picture tells you</span>' +
        '<table><tr><th></th><th>Lines cross only at 0<br><small>(the products point in different directions)</small></th><th>Both lines are the same line<br><small>(one product is a copy of the other)</small></th></tr>' +
        '<tr><td><b>AND</b></td><td>just the dot at <b>0</b></td><td>the <b>whole line</b></td></tr>' +
        '<tr><td><b>OR</b></td><td><b>not</b> a subspace: A + B lands on neither line</td><td><b>is</b> a subspace: it is that same line</td></tr>' +
        '<tr><td><b>In trading</b></td><td>you <b>cannot</b> make one product\'s payoff from the other alone; to get something like A + B you must <b>mix both</b></td><td><b>one product is enough</b>: anything the other pays, you can recreate with it alone</td></tr>' +
        '<tr><td><b>What you can do: build</b></td><td><b>use both</b>: each brings something the other cannot; mixing them builds new payoffs (A + B, 2A − B, …)</td><td><b>swap them</b>: use whichever is cheaper or more liquid (' + ratioTxt + ')</td></tr>' +
        '<tr><td><b>What you can do: price</b></td><td>price each <b>separately</b>: their prices do not have to match each other, so no arbitrage between just these two</td><td><b>check the ratio</b>: ' + priceTxt + '. If not, buy the cheap side and sell the dear side: it pays nothing but you get money today (<b>arbitrage</b>)</td></tr>' +
        '<tr><td><b>What you can do: hedge</b></td><td>you <b>cannot</b> hedge with one in place of the other</td><td><b>drop one</b>: it adds nothing new</td></tr>' +
        '<tr><td><b>Recipes</b></td><td>no copy → each payoff has <b>one</b> recipe</td><td>a zero trade exists (' + zeroTxt + ') → <b>many</b> recipes</td></tr>' +
        '<tr><td><b>Your market</b></td><td>' + (par ? '' : '← <b>this is you</b>') + '</td><td>' + (par ? '← <b>this is you</b>' : '') + '</td></tr></table>' +
        '<p>Either way, AND always exists and is always a subspace: it is either just the dot at 0 or the whole line.</p></div>' +
        '<div class="box theorem"><span class="label">Remember: AND and OR</span><p><b>AND (intersection)</b> is <b>always</b> a subspace. It is just {0} when the two sets point in different directions, and bigger when they share directions.</p>' +
        '<p><b>OR (union)</b> is <b>usually not</b> a subspace: one member from each set, added together, lands outside both. It works only when one set already sits inside the other. Fix it by allowing all mixes.</p></div>');
      h.push(ao.join(''));
      csnAO = { n: n, lv: lv, names: names, a: pA, b: pB, par: par };
    }

    // ---- 7. RANK ----
    var missing = m - rk, copies = n - rk, RR = rrefSteps(A), Rm = RR.R;
    var hl = 'background: color-mix(in srgb, var(--accent) 25%, transparent); font-weight: 700;', grey = 'color: var(--ink-soft);';
    var cases = [
      { k: 'full', cond: '$r = m = n$', shape: 'square, every row and column has a pivot', mean: 'every payoff buildable, exactly one recipe (invertible)' },
      { k: 'rowfull', cond: '$r = m &lt; n$', shape: 'every row has a pivot, some columns free', mean: 'every payoff buildable, many recipes (copies)' },
      { k: 'colfull', cond: '$r = n &lt; m$', shape: 'every column has a pivot, zero rows', mean: 'no copies (one recipe), but some payoffs impossible' },
      { k: 'neither', cond: '$r &lt; m$ and $r &lt; n$', shape: 'zero rows and free columns', mean: 'some payoffs impossible, and copies (many recipes when possible)' }];
    var mine = (rk === m && rk === n) ? 'full' : (rk === m ? 'rowfull' : (rk === n ? 'colfull' : 'neither'));
    h.push('<h4>7. Rank: how many truly different products?</h4>' +
      '<p><b>Step 1: the three letters.</b></p><table><tr><th>Letter</th><th>Means</th><th>Where it comes from</th><th>Your market</th></tr>' +
      '<tr><td>$m$</td><td>number of Nifty levels</td><td>rows of $A$ (one equation per level)</td><td><b>' + m + '</b> (' + lv.join(', ') + ')</td></tr>' +
      '<tr><td>$n$</td><td>number of products</td><td>columns of $A$</td><td><b>' + n + '</b> (' + names.join(', ') + ')</td></tr>' +
      '<tr><td>$r$</td><td>rank = number of pivots</td><td>count the pivots after elimination</td><td><b>' + rk + '</b></td></tr></table>' +
      '<p><b>Step 2: see the pivots.</b> Eliminate and tidy (Lecture 08) until each row starts with a pivot 1. Highlighted = pivot:</p>' +
      '<table><tr><th></th>' + names.map(function (nm, j) { var fr = RR.free.indexOf(j) >= 0; return '<th>' + nm + (fr ? '<br><small>free (copy)</small>' : '<br><small>pivot column</small>') + '</th>'; }).join('') + '<th></th></tr>' +
        Rm.map(function (row, i) { var zeroRow = row.every(function (v) { return v.isZero(); }); return '<tr><th>row ' + (i + 1) + '</th>' + row.map(function (v, j) { var isPiv = i < RR.rank && RR.piv[i] === j; return '<td style="' + (isPiv ? hl : (zeroRow || RR.free.indexOf(j) >= 0 ? grey : '')) + '">' + ft(v) + '</td>'; }).join('') + '<td><small>' + (zeroRow ? 'zero row: no new information' : 'pivot in ' + names[RR.piv[i]]) + '</small></td></tr>'; }).join('') + '</table>' +
      '<p>Count the highlighted cells: <b>$r$ = ' + rk + '</b>. Each pivot = one product that adds a <b>new direction</b>. A free column = a product made from the others. A zero row = a Nifty level that added nothing new.</p>' +
      '<p><b>Step 3: why $r \\le m$ and $r \\le n$.</b> Each pivot needs its <b>own row</b> and its <b>own column</b>. There are only ' + m + ' rows and ' + n + ' columns, so $r$ can be at most ' + Math.min(m, n) + '. Your market: $r$ = ' + rk + '.</p>' +
      '<p><b>Step 4: the four cases</b> (your market highlighted):</p><table><tr><th>Case</th><th>What the pivots look like</th><th>Market meaning</th></tr>' +
        cases.map(function (c) { return '<tr style="' + (c.k === mine ? hl : '') + '"><td>' + c.cond + '</td><td>' + c.shape + '</td><td>' + c.mean + (c.k === mine ? ' ← <b>you</b>' : '') + '</td></tr>'; }).join('') + '</table>' +
      '<p><b>Step 5: rank as a shape.</b> The column space picture in section 4 is ' + (rk === 1 ? 'a <b>line</b> (rank 1)' : rk === 2 ? 'a <b>flat sheet</b> (rank 2)' : 'all of ' + (n === 2 ? 'the plane' : '3D') + ' (rank ' + rk + ')') + '. Rank 1 = a line, 2 = a sheet, 3 = all of 3D: the rank is how many directions the buildable payoffs spread in.</p>' +
      '<table><tr><th>Number</th><th>Formula</th><th>Your market</th><th>Meaning</th></tr>' +
        '<tr><td>directions you can build</td><td>$r$</td><td>' + rk + '</td><td>size of the column space</td></tr>' +
        '<tr><td>missing directions</td><td>$m - r$</td><td>' + missing + '</td><td>' + (missing ? 'payoff shapes you cannot build' + (zeroRows.length ? ' (e.g. non-zero at ' + zeroRows.map(function (i) { return lv[i]; }).join(', ') + ')' : '') : 'none: every payoff buildable') + '</td></tr>' +
        '<tr><td>copies (free products)</td><td>$n - r$</td><td>' + copies + '</td><td>' + (copies ? copies + ' zero trade' + (copies === 1 ? '' : 's') + ' = ' + copies + ' price rule' + (copies === 1 ? '' : 's') : 'none: one recipe per payoff') + '</td></tr></table>' +
      '<p><b>In one line:</b> $r$ = how many products really count. Compare it with $m$ (can I build every payoff?) and with $n$ (are there copies?).</p>' +
      '<div class="box theorem"><span class="label">Remember: m, n and rank in one look</span>' +
      '<p><b>Start with the payoff table.</b> Each <b>row</b> is a Nifty level, each <b>column</b> is a product, each number is what 1 lot pays there. Example (CE, PE, future at 20,000):</p>' +
      '<table><tr><th></th><th>CE</th><th>PE</th><th>future</th></tr>' +
      '<tr><th>19,900</th><td>0</td><td>1</td><td>−1</td></tr><tr><th>20,000</th><td>0</td><td>0</td><td>0</td></tr><tr><th>20,100</th><td>1</td><td>0</td><td>1</td></tr></table>' +
      '<ul><li><b>m</b> = how many rows = how many <b>Nifty levels</b> → 3</li><li><b>n</b> = how many columns = how many <b>products</b> → 3</li></ul>' +
      '<p><b>Rank (r)</b> = how many products <b>really count</b>. A product does not count if you can make it from the others. Here future = CE − PE, so only CE and PE count: <b>r = 2</b>. (To find r without guessing: eliminate and count the pivots.)</p>' +
      '<p><b>Rank answers two questions.</b></p>' +
      '<p><b>1. Can I build any payoff the client wants?</b> Compare r with <b>m</b> (levels).</p><ul>' +
      '<li><b>r = m → yes</b>, every payoff can be built.</li><li><b>r &lt; m → no</b>, some payoffs are impossible.</li></ul>' +
      '<p>Here r = 2 &lt; 3: every product pays 0 at 20,000, so a client who wants money at 20,000 cannot be served.</p>' +
      '<p><b>2. Is there only one way to build it?</b> Compare r with <b>n</b> (products).</p><ul>' +
      '<li><b>r = n → one way</b>: no product is a copy.</li><li><b>r &lt; n → many ways</b>: some product is a copy, so check the prices agree.</li></ul>' +
      '<p>Here r = 2 &lt; 3: the future is a copy, so (1, 0, 1) = 1 CE + 1 PE, or 2 PE + 1 future, or 2 CE − 1 future.</p>' +
      '<p><b>Quick check card</b></p><table><tr><th></th><th>r = n (no copies)</th><th>r &lt; n (copies)</th></tr>' +
      '<tr><th>r = m (build anything)</th><td>anything, one way</td><td>anything, many ways</td></tr>' +
      '<tr><th>r &lt; m (not everything)</th><td>some things, one way</td><td>some things, many ways ← this example</td></tr></table>' +
      '<p class="answer">m = levels, n = products, r = products that really count. r vs m → can I build it? r vs n → how many ways?</p></div>');
    csnSub = { n: n, lv: lv, names: names, rank: rk, piv: N0.pivots, A: A, kind: notSubKind, nulls: nulls, x: (!R.bad.length ? R.x : null) };

    // ---- 6. side by side ----
    h.push('<h4>8. Column space vs nullspace</h4><table><tr><th></th><th>Column space $C(A)$</th><th>Nullspace $N(A)$</th></tr>' +
      '<tr><td>Question</td><td>Which payoffs can I build?</td><td>Which trades pay nothing at all?</td></tr>' +
      '<tr><td>Lives among</td><td>payoffs (one number per Nifty level)</td><td>lots (one number per product)</td></tr>' +
      '<tr><td>Size</td><td>' + rk + ' direction' + (rk === 1 ? '' : 's') + ' (the rank)</td><td>' + nulls.length + ' direction' + (nulls.length === 1 ? '' : 's') + ' (free columns = products − rank = ' + n + ' − ' + rk + ')</td></tr>' +
      '<tr><td>Your market</td><td>' + (rk >= n ? 'every payoff' : 'only some payoffs') + '; your client is ' + (R.bad.length ? '<b>outside</b>' : '<b>inside</b>') + '</td><td>' + (nulls.length ? lotsTxt(nulls[0]) + (nulls.length > 1 ? ' (and more)' : '') : 'only no trade') + '</td></tr>' +
      '<tr><td>Why a trader cares</td><td>can I serve this client?</td><td>are there copies, many recipes, and is there free money?</td></tr></table>');
    csnPics = { cs: { A: A, tgt: tgt, x: (!R.bad.length ? R.x : null), n: n, lv: lv, names: names, rank: rk, piv: N0.pivots, idA: null, idB: "lab7cs" },
      ns: { id: "lab7ns", n: n, names: names, nulls: nulls, xp: (!R.bad.length ? R.x : null) } };
    return h.join("");
  }


  // ---------- Ax = 0 mode (Lecture 08 lab: <div id="replab" data-ax0>) ----------
  var ax0Pics = null;
  function rrefSteps(A) {
    var n = A.length, m = A[0].length, M = A.map(function (r) { return r.slice(); }), steps = [], piv = [], free = [], r = 0;
    function snap() { return M.map(function (x) { return x.slice(); }); }
    for (var c = 0; c < m; c++) {
      if (r >= n) { free.push(c); continue; }
      var k = -1; for (var i = r; i < n; i++) if (!M[i][c].isZero()) { k = i; break; }
      if (k < 0) { free.push(c); steps.push({ kind: "free", col: c }); continue; }
      if (k !== r) { var t = M[r]; M[r] = M[k]; M[k] = t; steps.push({ kind: "swap", r1: r, r2: k, col: c, M: snap() }); }
      var pv = M[r][c];
      if (!pv.sub(ONE).isZero()) { M[r] = M[r].map(function (v) { return v.div(pv); }); steps.push({ kind: "scale", row: r, piv: pv, col: c, M: snap() }); }
      for (var i2 = 0; i2 < n; i2++) {
        if (i2 === r || M[i2][c].isZero()) continue;
        var mult = M[i2][c], before = M[i2].slice();
        M[i2] = M[i2].map(function (v, j) { return v.sub(M[r][j].mul(mult)); });
        steps.push({ kind: "elim", row: i2, prow: r, col: c, mult: mult, before: before, after: M[i2].slice(), dir: i2 < r ? "above" : "below", M: snap() });
      }
      piv.push(c); r++;
    }
    return { R: M, piv: piv, free: free, steps: steps, rank: piv.length };
  }

  function echelonSteps(A) {   // plain elimination (no scaling): the staircase U
    var n = A.length, m = A[0].length, M = A.map(function (r) { return r.slice(); }), steps = [], piv = [], free = [], r = 0;
    function snap() { return M.map(function (x) { return x.slice(); }); }
    for (var c = 0; c < m; c++) {
      if (r >= n) { free.push(c); steps.push({ kind: "free", col: c, why: "rows" }); continue; }
      var k = -1; for (var i = r; i < n; i++) if (!M[i][c].isZero()) { k = i; break; }
      if (k < 0) { free.push(c); steps.push({ kind: "free", col: c }); continue; }
      if (k !== r) { var t = M[r]; M[r] = M[k]; M[k] = t; steps.push({ kind: "swap", r1: r, r2: k, col: c, M: snap() }); }
      for (var i2 = r + 1; i2 < n; i2++) {
        if (M[i2][c].isZero()) continue;
        var mult = M[i2][c].div(M[r][c]);
        M[i2] = M[i2].map(function (v, j) { return v.sub(M[r][j].mul(mult)); });
        steps.push({ kind: "elim", row: i2, prow: r, col: c, mult: mult, piv: M[r][c], M: snap() });
      }
      piv.push(c); r++;
    }
    return { U: M, piv: piv, free: free, steps: steps, rank: piv.length };
  }

  function ax0Sections(A, tgt, Lv, n, vars, names, R, tradeTxt, P) {
    var h = [], lv = Lv.map(fmtLvl), m = Lv.length;
    function ft(v) { var t = (v.f || Math.abs(v.d) > 12) ? String(+v.num().toFixed(2)) : (v.d === 1 ? String(v.n) : v.n + '/' + v.d); return t.replace('-', '−'); }
    function fp(v) { return v.num() < 0 ? '(' + ft(v) + ')' : ft(v); }
    function vec(r) { return '(' + r.map(ft).join(', ') + ')'; }
    function dot(u, v) { return u.reduce(function (sm, a, k) { return sm.add(a.mul(v[k])); }, ZERO); }
    function payOf(l) { return A.map(function (r) { return dot(r, l); }); }
    function lotsTxt(lots) { var parts = lots.map(function (v, j) { return v.isZero() ? null : (v.num() < 0 ? 'sell ' + ft(v.neg()) : 'buy ' + ft(v)) + ' ' + names[j]; }).filter(Boolean); return parts.length ? parts.join(', ') : 'no trade'; }
    function label(j) { return names[j] + ' (' + esc(prodLabel(P[j])) + ')'; }
    var hl = 'background: color-mix(in srgb, var(--accent) 25%, transparent); font-weight: 700;', grey = 'color: var(--ink-soft);';
    var EU = echelonSteps(A), U = EU.U, rk = EU.rank, pivC = EU.piv, freeC = EU.free;
    var AT = A[0].map(function (_, j) { return A.map(function (r) { return r[j]; }); }), rkT = echelonSteps(AT).rank;
    var zero = Lv.map(function () { return ZERO; }), prem = P.map(function (pr) { return parseFr(pr.p); }), havePrem = !prem.some(function (q) { return q === null; });

    // 4. the goal
    h.push('<h4>4. The goal: which trades pay nothing at all?</h4>' +
      '<p>Solve $Ax = 0$: find every list of lots $x$ (' + vars.join(', ') + ' = lots of ' + names.join(', ') + ') whose total payoff is <b>0 at every Nifty level</b>. One equation per level:</p><ul>' +
      A.map(function (r, i) { return '<li>At ' + lv[i] + ': $' + eqTex(r, ZERO, n) + '$</li>'; }).join('') + '</ul>' +
      '<p>"No trade" ($x = 0$) always works. The question is whether any <b>other</b> trade works, and how to find <b>all</b> of them. The method below works for any market: any number of levels and products.</p>');

    // 5. elimination to U
    h.push('<h4>5. Step 1: eliminate to the staircase $U$</h4>' +
      '<p><b>How.</b> Same moves as Lecture 03 (the right side is 0 and stays 0). <b>New rule:</b> if a column has 0 in the pivot spot and nothing non-zero below, <b>don\'t stop</b>: that column is <b>free</b>; move to the next column.</p>' +
      '<table><tr><th>Step</th><th>Move</th><th>Why</th><th>Rows after</th></tr>' +
      (EU.steps.length ? EU.steps.map(function (st, k) {
        var mv, why;
        if (st.kind === "swap") { mv = 'swap rows ' + (st.r1 + 1) + ' and ' + (st.r2 + 1); why = 'pivot spot in column ' + (st.col + 1) + ' (' + names[st.col] + ') was 0'; }
        else if (st.kind === "elim") { mv = 'row ' + (st.row + 1) + ' − ' + fp(st.mult) + ' × row ' + (st.prow + 1); why = 'clear column ' + (st.col + 1) + ' under pivot ' + ft(st.piv) + ' (' + ft(st.mult) + ' = number ÷ pivot)'; }
        else { mv = 'column ' + (st.col + 1) + ' (' + names[st.col] + '): no pivot'; why = st.why === 'rows' ? 'all rows already have a pivot' : '0 in the pivot spot and nothing below: <b>free</b>, move on'; }
        return '<tr><td>' + (k + 1) + '</td><td>' + mv + '</td><td>' + why + '</td><td>' + (st.M ? st.M.map(vec).join('<br>') : '—') + '</td></tr>';
      }).join('') : '<tr><td colspan="4">nothing to do: $A$ is already a staircase</td></tr>') + '</table>' +
      '<p><b>What we have now: the staircase $U$</b> (pivots highlighted):</p>' +
      '<table><tr><th></th>' + names.map(function (nm, j) { return '<th>' + nm + '<br><small>' + (pivC.indexOf(j) >= 0 ? 'pivot' : 'free') + '</small></th>'; }).join('') + '</tr>' +
        U.map(function (row, i) { return '<tr><th>row ' + (i + 1) + '</th>' + row.map(function (v, j) { var isP = i < rk && pivC[i] === j; return '<td style="' + (isP ? hl : (row.every(function (x) { return x.isZero(); }) ? grey : '')) + '">' + ft(v) + '</td>'; }).join('') + '</tr>'; }).join('') + '</table>');
    // keeps / changes
    var ns1 = null;
    if (freeC.length) { ns1 = names.map(function () { return ZERO; }); ns1[freeC[0]] = ONE; for (var i = rk - 1; i >= 0; i--) { var pc = pivC[i], sm = ZERO; for (var j = pc + 1; j < n; j++) sm = sm.add(U[i][j].mul(ns1[j])); ns1[pc] = sm.neg().div(U[i][pc]); } }
    h.push('<p><b>What elimination keeps and what it changes.</b></p><table><tr><th></th><th>Kept?</th><th>Check with your numbers</th></tr>' +
      '<tr><td>the zero trades (nullspace)</td><td>✓ kept</td><td>' + (ns1 ? lotsTxt(ns1) + ' pays ' + vec(payOf(ns1)) + ' in $A$ and ' + vec(U.map(function (r) { return dot(r, ns1); })) + ' in $U$' : 'only "no trade" in both') + ': row moves never change which $x$ give 0</td></tr>' +
      '<tr><td>the columns (what each product pays)</td><td>✗ changed</td><td>column ' + names[0] + ': ' + vec(A.map(function (r) { return r[0]; })) + ' in $A$, ' + vec(U.map(function (r) { return r[0]; })) + ' in $U$. So read payoffs from $A$, never from $U$.</td></tr></table>');

    // 6. rank
    var cases = [[rk === m, 'r = m', 'every payoff at these levels can be built'], [rk < m, 'r &lt; m', (m - rk) + ' missing direction(s): some payoffs impossible'], [rk === n, 'r = n', 'no free products: only "no trade" pays 0'], [rk < n, 'r &lt; n', (n - rk) + ' free product(s): ' + (n - rk) + ' special solution(s)']];
    h.push('<h4>6. Step 2: the rank, pivot and free</h4>' +
      '<p><b>Rank</b> $r$ = number of pivots = <b>' + rk + '</b> (count the highlighted cells). It is the number of <b>truly different</b> products (and of truly independent Nifty-level equations).</p>' +
      '<table><tr><th>Product</th><th>Column</th><th>Variable (its lots)</th><th>Meaning</th></tr>' +
        names.map(function (nm, j) { var isP = pivC.indexOf(j) >= 0; return '<tr><td>' + label(j) + '</td><td><b>' + (isP ? 'pivot column' : 'free column') + '</b></td><td>$' + vars[j] + '$ = ' + (isP ? 'pivot variable: <b>worked out</b> from the others' : 'free variable: <b>you choose it</b>') + '</td><td>' + (isP ? 'truly new product' : 'a copy (mix of the pivot products)') + '</td></tr>'; }).join('') + '</table>' +
      '<table><tr><th>Number</th><th>Your market</th><th>Meaning</th></tr>' +
        '<tr><td>$m$ (Nifty levels)</td><td>' + m + '</td><td>rows</td></tr><tr><td>$n$ (products)</td><td>' + n + '</td><td>columns</td></tr>' +
        '<tr><td>$r$ (rank)</td><td>' + rk + '</td><td>pivots</td></tr><tr><td>$n - r$</td><td>' + (n - rk) + '</td><td>free products = number of special solutions</td></tr></table>' +
      '<ul>' + cases.filter(function (c) { return c[0]; }).map(function (c) { return '<li>$' + c[1] + '$: ' + c[2] + '.</li>'; }).join('') + '</ul>' +
      '<p><b>Rank of $A$ = rank of $A^T$.</b> Flip the table (rows = products, columns = levels) and eliminate again: rank of $A^T$ = <b>' + rkT + '</b> = ' + rk + ' ✓. Number of truly different <b>products</b> = number of truly different <b>Nifty-level rows</b>. This is always true.</p>' +
      (function () {
        var rowPiv = echelonSteps(AT).piv, extraRows = Lv.map(function (_, i) { return i; }).filter(function (i) { return rowPiv.indexOf(i) < 0; });
        return '<div class="box intuition"><span class="label">In simple words: rank ' + rk + ' = ' + rk + ' useful products and ' + rk + ' useful Nifty levels</span>' +
          '<table><tr><th></th><th>Useful (really count)</th><th>Extra</th></tr>' +
          '<tr><td><b>Products</b> (columns)</td><td>' + pivC.map(function (c) { return names[c]; }).join(', ') + ' → <b>' + rk + '</b></td><td>' + (freeC.length ? freeC.map(function (c) { return names[c]; }).join(', ') + ': a copy, made from the useful ones' : 'none') + '</td></tr>' +
          '<tr><td><b>Nifty levels</b> (rows)</td><td>' + rowPiv.map(function (i) { return lv[i]; }).join(', ') + ' → <b>' + rk + '</b></td><td>' + (extraRows.length ? extraRows.map(function (i) { return lv[i] + (A[i].every(function (v) { return v.isZero(); }) ? ' (all zeros: tells nothing)' : ' (a mix of the other rows: nothing new)'); }).join(', ') : 'none') + '</td></tr></table>' +
          '<p>The two counts are <b>always</b> the same number: that is all "rank of $A$ = rank of $A^T$" says. It is not a condition that can fail; it holds for every market.</p>' +
          '<ul><li>rank 1 → 1 useful product (the rest are copies of it); rank 2 → 2 useful; rank 3 → 3 useful; and so on.</li>' +
          '<li><b>An extra product is not useless for trading:</b> you do not <b>need</b> it to build payoffs, but it is a copy, so use it if it is <b>cheaper</b>, and check its <b>price</b>: if it does not match, that is arbitrage.</li>' +
          '<li><b>An extra Nifty level is not always all zeros:</b> it can be a mix of other rows. Either way it adds no new information.</li></ul>' +
          '<p class="answer">Rank = how many products (and levels) really count. The others are extra: skip them for building, but still use them for price checks.</p></div>';
      })() +
      (function () {
        var d = n - rk, rowsNR = [[0, 'none of them is a copy: every product is new', 'no zero trade; each payoff has only <b>one</b> recipe'], [1, '<b>one</b> of them is a copy of the others', '1 zero trade, many recipes, <b>1</b> price rule'], [2, '<b>two</b> of them are copies of the others', '2 zero trades, <b>2</b> price rules'], [3, 'k of them are copies of the others (k = 3, 4, …)', 'k zero trades, <b>k</b> price rules']];
        var anyCopy = '';
        if (ns1) {
          var inv = pivC.concat(freeC).filter(function (j) { return !ns1[j].isZero(); }).sort(function (a, b) { return a - b; });
          anyCopy = '<p><b>Which one is the copy? You can pick.</b> The zero trade ' + lotsTxt(ns1) + ' links ' + inv.map(function (j) { return label(j); }).join(', ') + ', so <b>any one</b> of them can be built from the others:</p><ul>' +
            inv.map(function (j) {
              var out = '';
              inv.forEach(function (k) { if (k === j) return; var c = ns1[k].div(ns1[j]).neg(), mag = c.num() < 0 ? c.neg() : c, term = (mag.sub(ONE).isZero() ? '' : ft(mag) + ' × ') + names[k]; out += out ? (c.num() < 0 ? ' − ' : ' + ') + term : (c.num() < 0 ? '−' : '') + term; });
              return '<li>' + names[j] + ' = ' + (out || '0') + '</li>';
            }).join('') + '</ul><p>There is one <b>extra</b> product' + (d > 1 ? ' per special solution' : '') + '; which one you call "the copy" is your choice.</p>';
        }
        return '<div class="box intuition"><span class="label">What $n - r$ tells you: how many products are copies</span>' +
          '<p>$n$ = how many products you have. $r$ = how many are <b>useful</b> (truly new). So $n - r$ = how many are <b>copies</b> of the others. In your market: $n - r$ = ' + n + ' − ' + rk + ' = <b>' + d + '</b>.</p>' +
          '<table><tr><th>$n - r$</th><th>What it tells you</th><th>What you get</th></tr>' +
          '<tr><td>−1 or less</td><td><b>impossible</b></td><td>it would mean more useful products than products</td></tr>' +
          rowsNR.map(function (rw) { var mine = rw[0] === 3 ? d >= 3 : d === rw[0]; return '<tr style="' + (mine ? hl : '') + '"><td>' + (rw[0] === 3 ? 'k' : rw[0]) + (mine ? ' ← yours' : '') + '</td><td>' + rw[1] + '</td><td>' + rw[2] + '</td></tr>'; }).join('') + '</table>' +
          '<p><b>Why it can never be negative.</b> Each pivot sits in its own product column, so pivots ≤ products: $r \\le n$. With 2 products (CE, PE) you cannot have 3 useful ones, just like 2 fruits in a bag cannot have 3 fresh ones. The smallest $n - r$ can be is 0.</p>' +
          anyCopy +
          '<p><b>Each copy gives one price rule:</b> the copy must cost exactly what building it from the others costs. If not, that is arbitrage.</p>' +
          '<p class="answer">n − r = 0: no copies. n − r = 1: one product is a copy of the others (with 3 products, one can be built from the other 2). n − r = 2: two copies. Never negative.</p></div>';
      })() +
      '<p><b>More products than levels ($n &gt; m$)?</b> Then $r \\le m &lt; n$, so there is <b>always</b> at least one free product and one zero trade. ' + (n > m ? 'That is your case.' : 'Your market has $n$ = ' + n + ', $m$ = ' + m + ', so this rule does not force one here' + (rk < n ? ', but a copy exists anyway.' : '.')) + '</p>');

    // 7. special solutions (back substitution in U)
    var specials = freeC.map(function (fc) {
      var x = names.map(function () { return ZERO; }), lines = []; x[fc] = ONE;
      for (var i = rk - 1; i >= 0; i--) {
        var pc = pivC[i], sm = ZERO, terms = [];
        for (var j = pc + 1; j < n; j++) if (!U[i][j].isZero()) { sm = sm.add(U[i][j].mul(x[j])); terms.push(fp(U[i][j]) + '×' + fp(x[j])); }
        x[pc] = sm.neg().div(U[i][pc]);
        lines.push('Row ' + (i + 1) + ' of $U$: ' + ft(U[i][pc]) + '×' + vars[pc] + (terms.length ? ' + ' + terms.join(' + ') : '') + ' = 0 → $' + vars[pc] + '$ = ' + ft(x[pc]));
      }
      return { fc: fc, x: x, lines: lines };
    });
    h.push('<h4>7. Step 3: special solutions</h4>' +
      '<div class="box theorem"><span class="label">Recipe for a special solution</span><p>Set <b>one free variable to 1</b>, the other free variables to 0, then solve for the pivot variables <b>bottom up</b> in $U$. One special solution per free column: $n - r$ = ' + (n - rk) + '.</p></div>');
    if (!specials.length) h.push('<p>No free columns, so no special solutions: only "no trade" pays 0 everywhere. Every product is truly different.</p>');
    specials.forEach(function (sp, k) {
      var cost = havePrem ? dot(sp.x, prem) : null;
      h.push('<p><b>Special solution ' + (k + 1) + ': set $' + vars[sp.fc] + '$ = 1</b> (lots of ' + names[sp.fc] + ')' + (freeC.length > 1 ? ', other free variables 0' : '') + '.</p><ol>' + sp.lines.map(function (l) { return '<li>' + l + '</li>'; }).join('') + '</ol>' +
        '<p>Lots ' + vec(sp.x) + ' = <b>' + lotsTxt(sp.x) + '</b>. Check in the original $A$: ' + Lv.map(function (_, i) { return lv[i] + ': ' + ft(dot(A[i], sp.x)); }).join(', ') + ' ✓ all 0.</p>' +
        '<p><b>In market words:</b> ' + names[sp.fc] + ' = ' + (function () { var out = ''; pivC.forEach(function (pc) { var c = sp.x[pc].neg(); if (c.isZero()) return; var mag = c.num() < 0 ? c.neg() : c, term = (mag.sub(ONE).isZero() ? '' : ft(mag) + ' × ') + names[pc]; out += out ? (c.num() < 0 ? ' − ' : ' + ') + term : (c.num() < 0 ? '−' : '') + term; }); return out || '0'; })() + ': a copy.' +
        (cost === null ? '' : ' Price of this zero trade: ' + sp.x.map(function (v, j) { return fp(v) + ' × ' + ft(prem[j]); }).join(' + ') + ' = <b>' + ft(cost) + '</b>' + (cost.isZero() ? ' → fair.' : ' → should be 0, so <b>arbitrage</b> of ' + ft(cost.num() < 0 ? cost.neg() : cost) + '.')) + '</p>');
    });

    // 8. the whole nullspace
    if (specials.length) {
      var s1 = specials[0].x, combos = [new Fr(2), ONE.neg(), new Fr(1, 2)];
      h.push('<h4>8. Step 4: the whole nullspace</h4>' +
        '<p><b>Every</b> trade that pays nothing is a combination of the special solutions: $x = ' + specials.map(function (_, k) { return 'c_' + (k + 1) + ' s_' + (k + 1); }).join(' + ') + '$ for any numbers. Check a few:</p>' +
        '<table><tr><th>Combination</th><th>Lots</th><th>In words</th><th>Pays</th></tr>' +
        combos.map(function (c) { var l = s1.map(function (v) { return v.mul(c); }); return '<tr><td>' + ft(c) + ' × $s_1$</td><td>' + vec(l) + '</td><td>' + lotsTxt(l) + '</td><td>' + vec(payOf(l)) + ' ✓</td></tr>'; }).join('') +
        (specials.length > 1 ? (function () { var l = s1.map(function (v, i) { return v.add(specials[1].x[i]); }); return '<tr><td>$s_1 + s_2$</td><td>' + vec(l) + '</td><td>' + lotsTxt(l) + '</td><td>' + vec(payOf(l)) + ' ✓</td></tr>'; })() : '') + '</table>' +
        '<p><b>Size:</b> ' + specials.length + ' special solution' + (specials.length === 1 ? '' : 's') + ' → the nullspace is ' + (specials.length === 1 ? 'a <b>line</b>' : specials.length === 2 ? 'a <b>flat sheet</b>' : 'a ' + specials.length + '-direction space') + ' of trades (dimension $n - r$ = ' + specials.length + ').</p>' +
        '<p><b>How the picture is formed</b> (axes = lots of ' + names.join(', ') + '): mark "no trade" at 0; mark $s_1$ = ' + vec(s1) + '; mark the combinations from the table: they all line up through 0 (purple dashed). ' + (R.bad.length ? '' : 'One client recipe ' + vec(R.x) + ' plus any of them gives every recipe (green).') + '</p>' +
        '<figure class="fig plot3d"><div id="labax0" class="plot3d-box" style="height:420px"></div><figcaption>Lots space. Purple = the whole nullspace (every zero trade). ' + (R.bad.length ? '' : 'Green = every recipe for your client.') + '</figcaption></figure>');
      ax0Pics = { id: "labax0", n: n, names: names, nulls: specials.map(function (sp) { return sp.x; }), xp: (!R.bad.length ? R.x : null) };
    } else h.push('<h4>8. Step 4: the whole nullspace</h4><p>Only "no trade": the nullspace is the zero subspace {0} (dimension $n - r$ = 0).</p>');

    // 9. R and reading N
    var RR = rrefSteps(A), Rm = RR.R, tidy = RR.steps.filter(function (st) { return st.kind === "scale" || (st.kind === "elim" && st.dir === "above"); });
    var F = Rm.slice(0, rk).map(function (r) { return freeC.map(function (c) { return r[c]; }); });
    h.push('<h4>9. Step 5: tidy to $R$ and read $N$ straight off it</h4>' +
      '<p><b>How.</b> From $U$: divide each pivot row by its pivot (pivots become 1), then clear the numbers <b>above</b> each pivot.' + (tidy.length ? ' Moves: ' + tidy.map(function (st) { return st.kind === "scale" ? 'row ' + (st.row + 1) + ' ÷ ' + fp(st.piv) : 'row ' + (st.row + 1) + ' − ' + fp(st.mult) + ' × row ' + (st.prow + 1); }).join('; ') + '.' : ' Here nothing more is needed.') + '</p>' +
      '<table><tr><th></th>' + names.map(function (nm, j) { return '<th>' + nm + '<br><small>' + (pivC.indexOf(j) >= 0 ? 'part of $I$' : 'part of $F$') + '</small></th>'; }).join('') + '</tr>' +
        Rm.map(function (row, i) { return '<tr><th>row ' + (i + 1) + '</th>' + row.map(function (v, j) { var isP = i < rk && pivC[i] === j, isF = i < rk && freeC.indexOf(j) >= 0; return '<td style="' + (isP ? hl : isF ? 'background: color-mix(in srgb, var(--thm-b) 18%, transparent);' : grey) + '">' + ft(v) + '</td>'; }).join('') + '</tr>'; }).join('') + '</table>' +
      '<p>$R$ = pivot columns form $I$ (blue), free columns form $F$ (purple)' + (rk < m ? ', plus ' + (m - rk) + ' zero row' + (m - rk === 1 ? '' : 's') : '') + '.' + (freeC.length ? ' $F = ' + mTex(F) + '$.' : '') + '</p>' +
      (freeC.length ? '<p><b>Read $N$ directly:</b> $N = \\begin{bmatrix} -F \\\\ I \\end{bmatrix}$: in the pivot rows put $-F$, in the free rows put $I$. That gives ' + specials.map(function (sp) { return vec(sp.x); }).join(', ') + ' (rows = ' + names.join(', ') + '): the <b>same</b> special solutions as step 3, with no back substitution.</p>' : ''));

    // 10. summary
    h.push('<h4>10. Everything from this lecture, for your market</h4><table><tr><th>Concept</th><th>What it is</th><th>Your market</th></tr>' +
      '<tr><td>Goal</td><td>every trade with $Ax = 0$</td><td>' + (specials.length ? specials.length + ' independent zero trade' + (specials.length === 1 ? '' : 's') : 'only no trade') + '</td></tr>' +
      '<tr><td>Staircase $U$</td><td>elimination; no pivot → free, move on</td><td>pivots in ' + pivC.map(function (c) { return names[c]; }).join(', ') + '</td></tr>' +
      '<tr><td>Rank $r$</td><td>number of pivots</td><td>' + rk + ' (rank of $A^T$ = ' + rkT + ')</td></tr>' +
      '<tr><td>Pivot / free variables</td><td>worked out / chosen</td><td>pivot: ' + pivC.map(function (c) { return vars[c]; }).join(', ') + '; free: ' + (freeC.map(function (c) { return vars[c]; }).join(', ') || 'none') + '</td></tr>' +
      '<tr><td>Special solutions</td><td>one free variable = 1, others 0; $n - r$ of them</td><td>' + (specials.map(function (sp) { return vec(sp.x); }).join(', ') || 'none') + '</td></tr>' +
      '<tr><td>Nullspace</td><td>all combinations of them (dimension $n - r$)</td><td>' + (specials.length === 0 ? '{0}' : specials.length === 1 ? 'a line of trades' : 'a ' + specials.length + '-direction space') + '</td></tr>' +
      '<tr><td>$R$, $N = [-F;\\ I]$</td><td>tidy form; read $N$ directly</td><td>' + (freeC.length ? '$F = ' + mTex(F) + '$' : 'no $F$') + '</td></tr>' +
      '<tr><td>Market meaning</td><td>zero trade = a copy; must cost 0</td><td>' + (specials.length && havePrem ? specials.map(function (sp) { var c = dot(sp.x, prem); return 'cost ' + ft(c) + (c.isZero() ? ' (fair)' : ' (arbitrage)'); }).join('; ') : '—') + '</td></tr></table>');
    return h.join("");
  }

  // ---------- Ax = b mode (Lecture 09 lab: <div id="replab" data-axb>) ----------
  var axbPics = null;
  function augSteps(A, b) {   // elimination on [A | b]: pivots searched only in A's columns; E records the row combinations
    var m = A.length, n = A[0].length, M = A.map(function (r, i) { return r.concat([b[i]]); }), steps = [], piv = [], free = [], r = 0;
    var E = A.map(function (_, i) { return A.map(function (_, j) { return i === j ? ONE : ZERO; }); });
    function snap() { return M.map(function (x) { return x.slice(); }); }
    for (var c = 0; c < n; c++) {
      if (r >= m) { free.push(c); steps.push({ kind: "free", col: c, why: "rows" }); continue; }
      var k = -1; for (var i = r; i < m; i++) if (!M[i][c].isZero()) { k = i; break; }
      if (k < 0) { free.push(c); steps.push({ kind: "free", col: c }); continue; }
      if (k !== r) { var t = M[r]; M[r] = M[k]; M[k] = t; var tE = E[r]; E[r] = E[k]; E[k] = tE; steps.push({ kind: "swap", r1: r, r2: k, col: c, M: snap() }); }
      for (var i2 = r + 1; i2 < m; i2++) {
        if (M[i2][c].isZero()) continue;
        var mult = M[i2][c].div(M[r][c]), pr = M[r], pe = E[r];
        M[i2] = M[i2].map(function (v, j) { return v.sub(pr[j].mul(mult)); });
        E[i2] = E[i2].map(function (v, j) { return v.sub(pe[j].mul(mult)); });
        steps.push({ kind: "elim", row: i2, prow: r, col: c, mult: mult, piv: M[r][c], M: snap() });
      }
      piv.push(c); r++;
    }
    return { M: M, E: E, piv: piv, free: free, steps: steps, rank: r };
  }

  function axbSections(A, tgt, Lv, n, vars, names, R, tradeTxt, P) {
    var h = [], lv = Lv.map(fmtLvl), m = Lv.length;
    function ft(v) { var t = (v.f || Math.abs(v.d) > 12) ? String(+v.num().toFixed(2)) : (v.d === 1 ? String(v.n) : v.n + '/' + v.d); return t.replace('-', '−'); }
    function fp(v) { return v.num() < 0 ? '(' + ft(v) + ')' : ft(v); }
    function vec(r) { return '(' + r.map(ft).join(', ') + ')'; }
    function dot(u, v) { return u.reduce(function (sm, a, k) { return sm.add(a.mul(v[k])); }, ZERO); }
    function payOf(l) { return A.map(function (r) { return dot(r, l); }); }
    function lotsTxt(lots) { var parts = lots.map(function (v, j) { return v.isZero() ? null : (v.num() < 0 ? 'sell ' + ft(v.neg()) : 'buy ' + ft(v)) + ' ' + names[j]; }).filter(Boolean); return parts.length ? parts.join(', ') : 'no trade'; }
    function label(j) { return names[j] + ' (' + esc(prodLabel(P[j])) + ')'; }
    var hl = 'background: color-mix(in srgb, var(--accent) 25%, transparent); font-weight: 700;', bad = 'background: color-mix(in srgb, var(--warn-b) 22%, transparent); font-weight: 700;', grey = 'color: var(--ink-soft);';
    var G = augSteps(A, tgt), M = G.M, rk = G.rank, pivC = G.piv, freeC = G.free;
    var zeroRows = []; for (var zi = rk; zi < m; zi++) zeroRows.push(zi);
    var badRows = zeroRows.filter(function (i) { return !M[i][n].isZero(); }), ok = !badRows.length;
    var prem = P.map(function (pr) { return parseFr(pr.p); }), havePrem = !prem.some(function (q) { return q === null; });
    function combTxt(e) { var out = ''; e.forEach(function (c, k) { if (c.isZero()) return; var mag = c.num() < 0 ? c.neg() : c, term = (mag.sub(ONE).isZero() ? '' : ft(mag) + ' × ') + 'row ' + lv[k]; out += out ? (c.num() < 0 ? ' − ' : ' + ') + term : (c.num() < 0 ? '−' : '') + term; }); return out || '0'; }
    function solvable(b) { var g = augSteps(A, b); for (var i = g.rank; i < m; i++) if (!g.M[i][n].isZero()) return false; return true; }

    // 4. the question and [A | b]
    h.push('<h4>4. The question: can the client\'s payoff be built, and in how many ways?</h4>' +
      '<p>Solve $Ax = b$: lots $x$ (' + vars.join(', ') + ' = lots of ' + names.join(', ') + ') whose total payoff equals the client\'s payoff $b$ = ' + vec(tgt) + ' at every Nifty level. One equation per level:</p><ul>' +
      A.map(function (r, i) { return '<li>At ' + lv[i] + ': $' + eqTex(r, tgt[i], n) + '$</li>'; }).join('') + '</ul>' +
      '<p><b>The augmented matrix $[A \\mid b]$:</b> the payoff table with the client\'s column stuck on the right, so every row move is done to the client\'s numbers too.</p>' +
      '<table><tr><th>Nifty at</th>' + names.map(function (nm) { return '<th>' + nm + '</th>'; }).join('') + '<th>| client $b$</th></tr>' +
        A.map(function (r, i) { return '<tr><td>' + lv[i] + '</td>' + r.map(function (v) { return '<td>' + ft(v) + '</td>'; }).join('') + '<td><b>' + ft(tgt[i]) + '</b></td></tr>'; }).join('') + '</table>' +
      '<p class="answer">Three questions, in order: (1) <b>is there any</b> recipe? (2) find <b>one</b> recipe; (3) find <b>all</b> recipes.</p>');

    // 5. elimination with b carried along
    h.push('<h4>5. Step 1: eliminate, carrying the client\'s column along</h4>' +
      '<p><b>How.</b> Same moves as Lecture 08 (no pivot → free column, move on), but each move is also done to the client column. The client column is <b>never</b> used as a pivot column.</p>' +
      '<table><tr><th>Step</th><th>Move</th><th>Why</th><th>Rows after [products | client]</th></tr>' +
      (G.steps.length ? G.steps.map(function (st, k) {
        var mv, why;
        if (st.kind === "swap") { mv = 'swap rows ' + (st.r1 + 1) + ' and ' + (st.r2 + 1); why = 'pivot spot in column ' + names[st.col] + ' was 0'; }
        else if (st.kind === "elim") { mv = 'row ' + (st.row + 1) + ' − ' + fp(st.mult) + ' × row ' + (st.prow + 1); why = 'clear column ' + names[st.col] + ' under pivot ' + ft(st.piv); }
        else { mv = 'column ' + names[st.col] + ': no pivot'; why = st.why === 'rows' ? 'all rows already have a pivot' : 'nothing non-zero left: <b>free</b>'; }
        return '<tr><td>' + (k + 1) + '</td><td>' + mv + '</td><td>' + why + '</td><td>' + (st.M ? st.M.map(function (r) { return '(' + r.slice(0, n).map(ft).join(', ') + ' | <b>' + ft(r[n]) + '</b>)'; }).join('<br>') : '—') + '</td></tr>';
      }).join('') : '<tr><td colspan="4">nothing to do: already a staircase</td></tr>') + '</table>' +
      '<p><b>What we have now: $[U \\mid c]$</b> (pivots blue; a zero row with a non-zero client number is red):</p>' +
      '<table><tr><th></th>' + names.map(function (nm, j) { return '<th>' + nm + '<br><small>' + (pivC.indexOf(j) >= 0 ? 'pivot' : 'free') + '</small></th>'; }).join('') + '<th>| client $c$</th></tr>' +
        M.map(function (row, i) { var isZ = i >= rk; return '<tr><th>row ' + (i + 1) + '</th>' + row.slice(0, n).map(function (v, j) { return '<td style="' + (i < rk && pivC[i] === j ? hl : isZ ? grey : '') + '">' + ft(v) + '</td>'; }).join('') + '<td style="' + (isZ && !row[n].isZero() ? bad : isZ ? grey : '') + '"><b>' + ft(row[n]) + '</b></td></tr>'; }).join('') + '</table>' +
      '<p>Rank $r$ = ' + rk + ' (pivots), so ' + (m - rk) + ' zero row' + (m - rk === 1 ? '' : 's') + ' on the left and ' + (n - rk) + ' free column' + (n - rk === 1 ? '' : 's') + '.</p>');

    // 6. solvability
    var s6 = '<h4>6. Step 2: is there any recipe? (the solvability test)</h4>';
    if (!zeroRows.length) s6 += '<p>No zero rows: every Nifty level row kept a pivot ($r = m$ = ' + m + '). Nothing can go wrong: <b>every</b> client payoff can be built. ✓</p>';
    else {
      s6 += '<p><b>How.</b> A zero row on the left reads "0 × every product = client number". That is fine only if the client number is <b>0</b> too.</p>' +
        '<table><tr><th>Zero row</th><th>Reads</th><th>Where it came from (original rows)</th><th>So the client needs</th><th>OK?</th></tr>' +
        zeroRows.map(function (i) { var e = G.E[i], c = M[i][n]; return '<tr><td>row ' + (i + 1) + '</td><td>0 = ' + ft(c) + '</td><td>' + combTxt(e) + ' = all zeros</td><td>the same mix of $b$: ' + combTxt(e).replace(/row /g, 'b@') + ' = 0</td><td style="' + (c.isZero() ? '' : bad) + '">' + (c.isZero() ? '✓ 0 = 0' : '✗ 0 = ' + ft(c)) + '</td></tr>'; }).join('') + '</table>' +
        '<p><b>Two ways to say the same test:</b></p><ul><li><b>Row way:</b> if some mix of the Nifty-level rows adds to all zeros, the same mix of the client\'s numbers must be 0.</li>' +
        '<li><b>Column way:</b> $b$ must be in the <b>column space</b> $C(A)$: the client\'s payoff must be a mix of the products\' payoffs (Lecture 07).</li></ul>';
    }
    s6 += '<p class="answer">' + (ok ? 'Your client ' + vec(tgt) + ': <b>solvable</b>. Go on to find the recipes.' : 'Your client ' + vec(tgt) + ': <b>not solvable</b>. Row ' + badRows.map(function (i) { return i + 1; }).join(', ') + ' says 0 = ' + badRows.map(function (i) { return ft(M[i][n]); }).join(', ') + ', which is impossible. No mix of these products copies this payoff.') + '</p>';
    var tests = [tgt].concat(Lv.map(function (_, i) { return Lv.map(function (_, k) { return i === k ? ONE : ZERO; }); }), [A.map(function (r) { return r[0]; })]);
    s6 += '<p><b>Other clients, same products</b> (the test depends only on $b$):</p><table><tr><th>Client pays</th><th>Solvable?</th></tr>' +
      tests.map(function (b, k) { var s = solvable(b); return '<tr><td>' + vec(b) + (k === 0 ? ' (yours)' : k > m ? ' (pays like 1 lot of ' + names[0] + ': always buildable)' : ' (1 only at ' + lv[k - 1] + ')') + '</td><td>' + (s ? '✓ yes' : '✗ no') + '</td></tr>'; }).join('') + '</table>';
    h.push(s6);

    // 7. particular solution
    var xp = null, specials = [];
    specials = freeC.map(function (fc) { var x = names.map(function () { return ZERO; }); x[fc] = ONE; for (var i = rk - 1; i >= 0; i--) { var pc = pivC[i], sm = ZERO; for (var j = pc + 1; j < n; j++) sm = sm.add(M[i][j].mul(x[j])); x[pc] = sm.neg().div(M[i][pc]); } return { fc: fc, x: x }; });
    if (ok) {
      xp = names.map(function () { return ZERO; }); var lines = [];
      for (var i = rk - 1; i >= 0; i--) {
        var pc = pivC[i], sm = M[i][n], terms = [];
        for (var j = pc + 1; j < n; j++) if (!M[i][j].isZero()) { sm = sm.sub(M[i][j].mul(xp[j])); terms.push(fp(M[i][j]) + '×' + fp(xp[j])); }
        xp[pc] = sm.div(M[i][pc]);
        lines.push('Row ' + (i + 1) + ': ' + ft(M[i][pc]) + '×' + vars[pc] + (terms.length ? ' + ' + terms.join(' + ') : '') + ' = ' + ft(M[i][n]) + ' → $' + vars[pc] + '$ = ' + ft(xp[pc]));
      }
      h.push('<h4>7. Step 3: one recipe (the particular solution $x_p$)</h4>' +
        '<div class="box theorem"><span class="label">Recipe for $x_p$</span><p>Set <b>every free variable to 0</b>' + (freeC.length ? ' (' + freeC.map(function (c) { return vars[c] + ' = 0'; }).join(', ') + ')' : ' (there are none)') + ', then solve for the pivot variables <b>bottom up</b> in $[U \\mid c]$.</p></div><ol>' +
        lines.map(function (l) { return '<li>' + l + '</li>'; }).join('') + '</ol>' +
        '<p>$x_p$ = ' + vec(xp) + ' = <b>' + lotsTxt(xp) + '</b>. Check in the original $A$: ' + Lv.map(function (_, i2) { return lv[i2] + ': ' + ft(dot(A[i2], xp)) + ' (wants ' + ft(tgt[i2]) + ')'; }).join(', ') + ' ✓</p>');
    } else h.push('<h4>7. Step 3: one recipe (the particular solution $x_p$)</h4><p>None: the test in step 2 failed, so there is <b>no</b> recipe at all. Change the client\'s numbers so every zero row ends as 0 = 0 (see the table in step 2).</p>');

    // 8. complete solution
    var s8 = '<h4>8. Step 4: all recipes (the complete solution $x = x_p + x_n$)</h4>';
    if (!ok) s8 += '<p>No recipes, so nothing to complete. (The zero trades still exist: ' + (specials.length ? specials.map(function (sp) { return lotsTxt(sp.x); }).join('; ') : 'only no trade') + '.)</p>';
    else {
      s8 += '<p><b>Idea.</b> Take the one recipe $x_p$ and add <b>any zero trade</b> $x_n$ (a nullspace trade from Lecture 08): the payoff does not change, so it is still a recipe. $A(x_p + x_n) = b + 0 = b$.</p>';
      if (!specials.length) s8 += '<p>No free columns, so the only zero trade is "no trade": <b>exactly one recipe</b>, $x = x_p$.</p>';
      else {
        s8 += '<p>Zero trades here (special solutions, one per free column): ' + specials.map(function (sp, k) { return '$s_' + (k + 1) + '$ = ' + vec(sp.x) + ' (' + lotsTxt(sp.x) + ')'; }).join('; ') + '.</p>' +
          '<p>$$x = x_p + ' + specials.map(function (_, k) { return 'c_' + (k + 1) + 's_' + (k + 1); }).join(' + ') + '$$ for any numbers. Check a few:</p>' +
          '<table><tr><th>Choice</th><th>Lots</th><th>In words</th><th>Pays</th>' + (havePrem ? '<th>Cost today</th>' : '') + '</tr>' +
          [ZERO, ONE, new Fr(2), ONE.neg()].map(function (c) { var l = xp.map(function (v, j) { return v.add(specials[0].x[j].mul(c)); }); return '<tr><td>$x_p$ ' + (c.num() < 0 ? '− ' + ft(c.neg()) : '+ ' + ft(c)) + ' × $s_1$</td><td>' + vec(l) + '</td><td>' + lotsTxt(l) + '</td><td>' + vec(payOf(l)) + ' ✓</td>' + (havePrem ? '<td>' + ft(dot(l, prem)) + '</td>' : '') + '</tr>'; }).join('') + '</table>';
        if (havePrem) { var zc = dot(specials[0].x, prem); s8 += '<p><b>Cost check:</b> every recipe pays the same, so every recipe should cost the same. Adding one $s_1$ changes the cost by ' + ft(zc) + (zc.isZero() ? ': all costs equal, fair ✓.' : ': the costs differ, so buy the cheap recipe and sell the dear one: <b>arbitrage</b>.') + '</p>'; }
      }
    }
    h.push(s8);

    // 9. picture
    var s9 = '<h4>9. The picture: a shifted copy of the nullspace</h4>';
    if (n > 3 || specials.length > 2) s9 += '<p>' + n + ' products: the lots space has ' + n + ' axes, too many to draw. The idea is the same: the recipes are the zero trades moved over by $x_p$.</p>';
    else {
      s9 += '<p><b>How the picture is formed</b> (axes = lots of ' + names.join(', ') + '):</p><ol>' +
        '<li>Mark "no trade" at 0.</li>' +
        (specials.length ? '<li>Draw the zero trades through 0 (purple dashed): the nullspace, ' + (specials.length === 1 ? 'a line' : 'a flat sheet') + '.</li>' : '<li>No zero trades besides 0: the nullspace is just the dot at 0.</li>') +
        (ok ? '<li>Mark one recipe $x_p$ = ' + vec(xp) + ' (green dot).</li><li>Slide the purple ' + (specials.length === 2 ? 'sheet' : 'line') + ' over so it passes through $x_p$: that is every recipe (green).' + (specials.length ? '' : ' Here it is just the one dot.') + '</li>' : '<li>No recipe to mark: the client cannot be built.</li>') + '</ol>' +
        '<figure class="fig plot3d"><div id="labaxb" class="plot3d-box" style="height:420px"></div><figcaption>Lots space. Purple = zero trades (goes through 0). ' + (ok ? 'Green = every recipe for your client (does <b>not</b> go through 0).' : '') + '</figcaption></figure>';
      axbPics = { id: "labaxb", n: n, names: names, nulls: specials.map(function (sp) { return sp.x; }), xp: xp };
    }
    if (ok) s9 += '<p><b>Not a subspace</b> (unless the client wants all zeros): "no trade" pays 0, not ' + vec(tgt) + ', so 0 is not a recipe; and 2 × a recipe pays ' + vec(tgt.map(function (t) { return t.mul(new Fr(2)); })) + ', twice what the client wants. The recipes are a <b>shifted</b> line/sheet, not one through 0.</p>';
    h.push(s9);

    // 10. rank limits
    h.push('<h4>10. Rank limits: $r \\le m$ and $r \\le n$</h4>' +
      '<table><tr><th>Rule</th><th>Why</th><th>Your market</th></tr>' +
      '<tr><td>$r \\le m$ (levels)</td><td>each pivot needs its own row</td><td>' + rk + ' ≤ ' + m + ' ✓</td></tr>' +
      '<tr><td>$r \\le n$ (products)</td><td>each pivot needs its own column</td><td>' + rk + ' ≤ ' + n + ' ✓</td></tr></table>' +
      '<table><tr><th>Name</th><th>Means</th><th>Consequence</th><th>Yours?</th></tr>' +
      '<tr><td>full column rank</td><td>$r = n$: every product has a pivot</td><td>no free columns, no zero trades: <b>0 or 1</b> recipe</td><td>' + (rk === n ? '✓' : '✗ (' + (n - rk) + ' free)') + '</td></tr>' +
      '<tr><td>full row rank</td><td>$r = m$: every level has a pivot</td><td>no zero rows: <b>every</b> client can be built</td><td>' + (rk === m ? '✓' : '✗ (' + (m - rk) + ' zero row' + (m - rk === 1 ? '' : 's') + ')') + '</td></tr></table>');

    // 11. the four cases
    var cs = [[rk === m && rk === n, '$r = m = n$', 'square, invertible', 'exactly <b>1</b>', 'every client, one recipe each'],
      [rk === n && rk < m, '$r = n &lt; m$', 'tall, full column rank', '<b>0 or 1</b>', 'more levels than useful products: some clients impossible, others one recipe'],
      [rk === m && rk < n, '$r = m &lt; n$', 'wide, full row rank', '<b>∞</b>', 'every client, many recipes (copies exist)'],
      [rk < m && rk < n, '$r &lt; m$, $r &lt; n$', 'not full either way', '<b>0 or ∞</b>', 'some clients impossible; the rest have many recipes']];
    var mine = cs.filter(function (c) { return c[0]; })[0];
    h.push('<h4>11. The four cases: how many recipes?</h4>' +
      '<table><tr><th>Case</th><th>Shape</th><th>Recipes</th><th>In the market</th></tr>' +
      cs.map(function (c) { return '<tr style="' + (c[0] ? hl : '') + '"><td>' + c[1] + (c[0] ? ' ← yours' : '') + '</td><td>' + c[2] + '</td><td>' + c[3] + '</td><td>' + c[4] + '</td></tr>'; }).join('') + '</table>' +
      '<p><b>How to read it:</b> zero rows ($r &lt; m$) decide <b>whether</b> a recipe exists (0 possible); free columns ($r &lt; n$) decide <b>how many</b> (∞ possible).</p>' +
      '<p class="answer">Your market: $m$ = ' + m + ', $n$ = ' + n + ', $r$ = ' + rk + ' → ' + mine[1] + ' → ' + mine[3] + '. Your client: <b>' + (!ok ? '0 recipes' : specials.length ? 'infinitely many recipes' : 'exactly 1 recipe') + '</b>.</p>');

    // 12. summary
    h.push('<h4>12. Everything from this lecture, for your market</h4><table><tr><th>Concept</th><th>What it is</th><th>Your market</th></tr>' +
      '<tr><td>$[A \\mid b]$</td><td>payoffs with the client column attached</td><td>' + m + ' rows × (' + n + ' + 1) columns</td></tr>' +
      '<tr><td>Elimination</td><td>same moves on $b$</td><td>rank ' + rk + ', pivots ' + pivC.map(function (c) { return names[c]; }).join(', ') + '</td></tr>' +
      '<tr><td>Solvable?</td><td>zero rows must read 0 = 0; $b$ in $C(A)$</td><td>' + (ok ? '✓ yes' : '✗ no') + '</td></tr>' +
      '<tr><td>$x_p$</td><td>free variables 0, solve pivots</td><td>' + (xp ? vec(xp) : '—') + '</td></tr>' +
      '<tr><td>Complete solution</td><td>$x_p$ + any zero trade</td><td>' + (!ok ? '—' : specials.length ? '$x_p$ + ' + specials.map(function (sp, k) { return 'c' + (k + 1) + '×' + vec(sp.x); }).join(' + ') : 'just $x_p$') + '</td></tr>' +
      '<tr><td>Picture</td><td>nullspace shifted to $x_p$</td><td>' + (!ok ? 'no recipes' : specials.length === 0 ? 'one dot' : specials.length === 1 ? 'a line not through 0' : 'a sheet not through 0') + '</td></tr>' +
      '<tr><td>Rank limits</td><td>$r \\le m$, $r \\le n$</td><td>' + rk + ' ≤ ' + m + ', ' + rk + ' ≤ ' + n + '</td></tr>' +
      '<tr><td>Case</td><td>one of four</td><td>' + mine[1] + ': ' + mine[3] + '</td></tr></table>');
    return h.join("");
  }

  function drawIbd2d() {
    if (!window.Plotly) { setTimeout(drawIbd2d, 300); return; }
    function cssv(v) { return getComputedStyle(document.documentElement).getPropertyValue(v).trim(); }
    var blue = cssv("--accent"), green = cssv("--ex-b"), purple = cssv("--thm-b"), red = cssv("--warn-b"), orange = cssv("--int-b"), ink = cssv("--ink"), soft = cssv("--ink-soft"), rule = cssv("--rule"), paper2 = cssv("--paper-2");
    function axis(t) { return { title: { text: t, font: { color: ink, size: 13 } }, range: [-3.5, 3.5], autorange: false, tickmode: "linear", dtick: 1, tickfont: { color: soft, size: 11 }, gridcolor: rule, zeroline: true, zerolinecolor: soft }; }
    function arr(to, c, t, dx) { return [{ x: to[0], y: to[1], ax: 0, ay: 0, xref: "x", yref: "y", axref: "x", ayref: "y", showarrow: true, arrowhead: 3, arrowsize: 1.2, arrowwidth: 3, arrowcolor: c, text: "" }, { x: to[0], y: to[1], xref: "x", yref: "y", showarrow: false, text: t, font: { color: c, size: 13 }, xanchor: "left", xshift: dx || 6 }]; }
    var ok = [[0, 1], [0, 3], [0, -2]], no = [[1, 0], [1, 1]];
    var tr = [{ type: "scatter", mode: "lines", x: [0, 0], y: [-3.5, 3.5], line: { color: purple, width: 5 }, opacity: 0.5, name: "span (buildable)", hoverinfo: "skip" },
      { type: "scatter", mode: "markers+text", x: ok.map(function (p) { return p[0]; }), y: ok.map(function (p) { return p[1]; }), marker: { color: green, size: 11 }, text: ok.map(function (p) { return "(" + p.join(", ") + ") ✓"; }), textposition: "middle left", textfont: { color: green }, name: "can build", hoverinfo: "skip" },
      { type: "scatter", mode: "markers+text", x: no.map(function (p) { return p[0]; }), y: no.map(function (p) { return p[1]; }), marker: { color: red, size: 11, symbol: "x" }, text: no.map(function (p) { return "(" + p.join(", ") + ") ✗"; }), textposition: "bottom right", textfont: { color: red }, name: "can't build", hoverinfo: "skip" }];
    var an = [].concat(arr([0, 1], blue, "A (0, 1)", 30), arr([0, 0.5], blue, "B (0, 0.5)", 30), arr([1, 0], orange, "fix: C = PE (1, 0)", 4).map(function (o) { if (o.showarrow) o.arrowwidth = 2; return o; }));
    Plotly.newPlot("labibd2d", tr, { paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: paper2, margin: { l: 60, r: 20, t: 10, b: 60 }, showlegend: true, legend: { orientation: "h", y: -0.2, font: { color: ink } }, annotations: an,
      xaxis: Object.assign(axis("payoff at 19,900"), { scaleanchor: "y", scaleratio: 1 }), yaxis: axis("payoff at 20,100") }, { responsive: true, displaylogo: false, modeBarButtonsToRemove: ["toImage"] });
  }
  // ---------- independence / basis / dimension mode (Lecture 10 lab: <div id="replab" data-ibd>) ----------
  var ibdPics = null;
  function ibdSections(A, tgt, Lv, n, vars, names, R, tradeTxt, P) {
    var h = [], lv = Lv.map(fmtLvl), m = Lv.length;
    function ft(v) { var t = (v.f || Math.abs(v.d) > 12) ? String(+v.num().toFixed(2)) : (v.d === 1 ? String(v.n) : v.n + '/' + v.d); return t.replace('-', '−'); }
    function fp(v) { return v.num() < 0 ? '(' + ft(v) + ')' : ft(v); }
    function vec(r) { return '(' + r.map(ft).join(', ') + ')'; }
    function dot(u, v) { return u.reduce(function (sm, a, k) { return sm.add(a.mul(v[k])); }, ZERO); }
    function col(j) { return A.map(function (r) { return r[j]; }); }
    function lotsTxt(lots) { var parts = lots.map(function (v, j) { return v.isZero() ? null : (v.num() < 0 ? 'sell ' + ft(v.neg()) : 'buy ' + ft(v)) + ' ' + names[j]; }).filter(Boolean); return parts.length ? parts.join(', ') : 'no trade'; }
    function label(j) { return names[j] + ' (' + esc(prodLabel(P[j])) + ')'; }
    function rankOf(cols) { if (!cols.length) return 0; return echelonSteps(Lv.map(function (_, i) { return cols.map(function (c) { return c[i]; }); })).rank; }
    function inSpan(b) { var g = augSteps(A, b); for (var i = g.rank; i < m; i++) if (!g.M[i][n].isZero()) return false; return true; }
    var hl = 'background: color-mix(in srgb, var(--accent) 25%, transparent); font-weight: 700;';
    var EU = echelonSteps(A), U = EU.U, rk = EU.rank, pivC = EU.piv, freeC = EU.free;
    var specials = freeC.map(function (fc) { var x = names.map(function () { return ZERO; }); x[fc] = ONE; for (var i = rk - 1; i >= 0; i--) { var pc = pivC[i], sm = ZERO; for (var j = pc + 1; j < n; j++) sm = sm.add(U[i][j].mul(x[j])); x[pc] = sm.neg().div(U[i][pc]); } return { fc: fc, x: x }; });
    function copyTxt(sp) { var out = ''; pivC.forEach(function (pc) { var c = sp.x[pc].neg(); if (c.isZero()) return; var mag = c.num() < 0 ? c.neg() : c, term = (mag.sub(ONE).isZero() ? '' : ft(mag) + ' × ') + names[pc]; out += out ? (c.num() < 0 ? ' − ' : ' + ') + term : (c.num() < 0 ? '−' : '') + term; }); return names[sp.fc] + ' = ' + (out || '0'); }
    var indep = rk === n, spans = rk === m;

    // 4. the question
    h.push('<h4>4. The question: how many truly different products does this market have?</h4>' +
      '<p>Each product is a <b>vector</b>: its payoff at each Nifty level (' + lv.join(', ') + ').</p>' +
      '<table><tr><th>Product</th><th>Vector (payoff at ' + lv.join(' / ') + ')</th></tr>' + names.map(function (nm, j) { return '<tr><td>' + label(j) + '</td><td>' + vec(col(j)) + '</td></tr>'; }).join('') + '</table>' +
      '<p>Four words answer four questions, in this order:</p>' +
      '<table><tr><th>Word</th><th>Question</th><th>Said about</th></tr>' +
      '<tr><td><b>Independent</b></td><td>Is any product a copy of the others?</td><td>a set of products</td></tr>' +
      '<tr><td><b>Span</b></td><td>Which payoffs can they build?</td><td>a set of products</td></tr>' +
      '<tr><td><b>Basis</b></td><td>Smallest set that still builds everything they build?</td><td>a set of products</td></tr>' +
      '<tr><td><b>Dimension</b></td><td>How many products in that smallest set?</td><td>a space (a number)</td></tr></table>' +
      '<div class="box pitfall"><span class="label">Use the words correctly</span><table><tr><th>Say</th><th>Not</th></tr>' +
      '<tr><td>"these <b>products</b> (vectors) are independent / span / form a basis"</td><td>"the matrix is independent"</td></tr>' +
      '<tr><td>"the <b>matrix</b> $A$ has rank ' + rk + '"</td><td>"the rank of a space"</td></tr>' +
      '<tr><td>"the <b>column space</b> of $A$ has dimension ' + rk + '"</td><td>"the dimension of $A$"</td></tr></table>' +
      '<p>They meet in one sentence: <b>rank of $A$ = dimension of its column space</b> (here both = ' + rk + ').</p></div>');

    // 5. independence
    h.push('<h4>5. Independence: is any product a copy?</h4>' +
      '<div class="box definition"><span class="label">Definition</span><p>Products are <b>independent</b> if the <b>only</b> lots that pay 0 at every level are "no trade" (all lots 0). If some other lots pay 0, they are <b>dependent</b>: one product is a copy of the others.</p></div>' +
      (function () {
        var zeroP = names.some(function (_, j) { return col(j).every(function (v) { return v.isZero(); }); }), mult = false;
        for (var a = 0; a < n; a++) for (var b2 = a + 1; b2 < n; b2++) if (rankOf([col(a), col(b2)]) < 2) mult = true;
        function yn(cond) { return cond === null ? '— (not square)' : cond ? '<b>✓ yes</b>' : '✗ no'; }
        var indRows = [['rank $r$ = number of products $n$ (a pivot in every column)', rk === n],
          ['no free columns', !freeC.length],
          ['the only zero trade is "no trade" (nullspace = {0})', !specials.length],
          ['products ≤ levels ($n \\le m$): needed, but not enough on its own', n <= m],
          ['if square ($n = m$): the matrix is invertible (same as the test above)', n === m ? (rk === n) : null]];
        var depRows = [['rank $r$ &lt; $n$ (some column has no pivot)', rk < n],
          ['at least one free column', freeC.length > 0],
          ['some lots other than 0 pay 0 everywhere (a zero trade)', specials.length > 0],
          ['a product pays 0 at every level', zeroP],
          ['a product is a stretched copy of another (e.g. 2 × CE)', mult],
          ['a product is a mix of the others (e.g. future = CE − PE)', specials.length > 0 && !zeroP && !mult],
          ['more products than levels ($n &gt; m$): always dependent', n > m]];
        return '<div class="box theorem"><span class="label">Conditions: when are they independent, when not?</span>' +
          '<p><b>Independent</b> when the first three hold (they are one test said three ways). The last two are facts that come with it:</p>' +
          '<table><tr><th>Condition for independent</th><th>Your market</th></tr>' + indRows.map(function (r) { return '<tr><td>' + r[0] + '</td><td>' + yn(r[1]) + '</td></tr>'; }).join('') + '</table>' +
          '<p><b>Dependent</b> as soon as <b>any one</b> of these holds:</p>' +
          '<table><tr><th>Condition for dependent</th><th>Your market</th></tr>' + depRows.map(function (r) { return '<tr><td>' + r[0] + '</td><td>' + yn(r[1]) + '</td></tr>'; }).join('') + '</table>' +
          '<p class="answer">One-line rule: count pivots. $r = n$ → independent. $r &lt; n$ → dependent. Your market: $r$ = ' + rk + ', $n$ = ' + n + ' → <b>' + (rk === n ? 'independent' : 'dependent') + '</b>.</p></div>';
      })() +
      '<p><b>How to test (with a matrix):</b> put the products as columns of $A$ and solve $Ax = 0$ (Lecture 08). Independent ⇔ no free columns ⇔ rank $r = n$.</p>' +
      '<table><tr><th>Step</th><th>What we do</th><th>Your market</th></tr>' +
      '<tr><td>1</td><td>eliminate to the staircase $U$</td><td>' + U.map(vec).join(', ') + '</td></tr>' +
      '<tr><td>2</td><td>pivot columns / free columns</td><td>pivot: ' + pivC.map(function (c) { return names[c]; }).join(', ') + '; free: ' + (freeC.map(function (c) { return names[c]; }).join(', ') || 'none') + '</td></tr>' +
      '<tr><td>3</td><td>rank $r$ vs products $n$</td><td>$r$ = ' + rk + ', $n$ = ' + n + (indep ? ' → equal' : ' → $r &lt; n$') + '</td></tr>' +
      '<tr><td>4</td><td>any zero trade?</td><td>' + (specials.length ? specials.map(function (sp) { return vec(sp.x) + ' = ' + lotsTxt(sp.x); }).join('; ') : 'only no trade') + '</td></tr></table>' +
      (indep ? '<p class="answer">Your products are <b>independent</b>: no product can be copied from the others.</p>'
        : '<p class="answer">Your products are <b>dependent</b>: ' + specials.map(function (sp) { return copyTxt(sp); }).join('; ') + ' (a copy). Check: ' + specials.map(function (sp) { return Lv.map(function (_, i) { return lv[i] + ': ' + ft(dot(A[i], sp.x)); }).join(', '); }).join('; ') + ' ✓ all 0.</p>') +
      (specials.length ? '<p><b>In child words: walk and get home.</b> Start at 0 (home). W' + specials[0].x.map(function (v, j) { return v.isZero() ? null : (v.num() < 0 ? 'walk ' + ft(v.neg()) + ' step' + (v.neg().sub(ONE).isZero() ? '' : 's') + ' <b>backward</b> along ' + names[j] : 'walk ' + ft(v) + ' step' + (v.sub(ONE).isZero() ? '' : 's') + ' forward along ' + names[j]); }).filter(Boolean).join(', then ').slice(1) + ': you land back at 0 without standing still. That is dependence. Independent = the <b>only</b> way home is not to move.</p>' : '<p><b>In child words:</b> the only way to walk along these products and get back home (0) is to not move at all. That is independence.</p>') +
      (function () {
        var rows = [], zeroP = [], mult = [];
        names.forEach(function (_, j) { if (col(j).every(function (v) { return v.isZero(); })) zeroP.push(j); });
        for (var a = 0; a < n; a++) for (var b2 = a + 1; b2 < n; b2++) { if (zeroP.indexOf(a) >= 0 || zeroP.indexOf(b2) >= 0) continue; if (rankOf([col(a), col(b2)]) === 1) mult.push([a, b2]); }
        rows.push('<tr><td>a product that pays 0 everywhere</td><td>' + (zeroP.length ? '<b>yes</b>: ' + zeroP.map(function (j) { return names[j]; }).join(', ') + ' → dependent (take any amount of it, none of the rest)' : 'none') + '</td></tr>');
        rows.push('<tr><td>one product a stretched copy of another (same direction)</td><td>' + (mult.length ? mult.map(function (pr) { var i0 = col(pr[0]).findIndex(function (v) { return !v.isZero(); }); return names[pr[1]] + ' = ' + ft(col(pr[1])[i0].div(col(pr[0])[i0])) + ' × ' + names[pr[0]]; }).join('; ') + ' → dependent' : 'none') + '</td></tr>');
        rows.push('<tr><td>a copy made from <b>several</b> others</td><td>' + (specials.length && !mult.length && !zeroP.length ? specials.map(copyTxt).join('; ') : specials.length ? 'see above' : 'none') + '</td></tr>');
        return '<p><b>Quick checks</b> (each one alone makes a set dependent):</p><table><tr><th>Check</th><th>Your products</th></tr>' + rows.join('') + '</table>';
      })() +
      (function () {
        var Ab = A.map(function (r, i) { return r.concat([tgt[i]]); }), g = echelonSteps(Ab), names2 = names.concat(['client']);
        if (!g.free.length) return '';
        var fc = g.free[g.free.length - 1], x = names2.map(function () { return ZERO; }); x[fc] = ONE;
        for (var i = g.rank - 1; i >= 0; i--) { var pc = g.piv[i], sm = ZERO; for (var j = pc + 1; j < n + 1; j++) sm = sm.add(g.U[i][j].mul(x[j])); x[pc] = sm.neg().div(g.U[i][pc]); }
        return '<p><b>See the key fact happen ($n &gt; m$):</b> add your client\'s payoff ' + vec(tgt) + ' as a ' + (n + 1) + 'th vector. Now ' + (n + 1) + ' vectors with ' + m + ' numbers each: more vectors than levels, so they <b>must</b> be dependent. Found: ' +
          x.map(function (v, j) { return v.isZero() ? null : [v, names2[j]]; }).filter(Boolean).map(function (t, k) { var neg = t[0].num() < 0, mag = neg ? t[0].neg() : t[0]; return (k ? (neg ? ' − ' : ' + ') : (neg ? '−' : '')) + ft(mag) + ' × ' + t[1]; }).join('') + ' = ' + vec(Lv.map(function (_, i2) { return Ab[i2].reduce(function (sm, a, k) { return sm.add(a.mul(x[k])); }, ZERO); })) + ' ✓.</p>';
      })() +
      '<p><b>Key fact: more products than levels ($n &gt; m$) ⇒ always dependent.</b> Each pivot needs its own row, so $r \\le m &lt; n$: at least $n - m$ free columns. E.g. 5 products at 3 Nifty levels: at least 2 are copies. ' + (n > m ? 'That is your case.' : 'Your market has ' + n + ' products and ' + m + ' levels, so this rule does not force it.') + '</p>');

    // 6. span
    var tests = Lv.map(function (_, i) { return Lv.map(function (_, k) { return i === k ? ONE : ZERO; }); }).concat([tgt]);
    h.push('<h4>6. Span: which payoffs can they build?</h4>' +
      '<div class="box definition"><span class="label">Definition</span><p>The products <b>span</b> a space = that space is <b>all</b> their combinations (any lots, buy or sell). The space they span is the column space $C(A)$.</p></div>' +
      '<div class="box theorem"><span class="label">Span = which payoffs you CAN build (not automatically every payoff)</span>' +
      '<table><tr><th>Case</th><th>What the span is</th><th>Can you build every payoff?</th></tr>' +
      '<tr style="' + (rk === m ? hl : '') + '"><td>$r = m$ (rank = number of Nifty levels)' + (rk === m ? ' ← yours' : '') + '</td><td>the <b>whole</b> space</td><td><b>Yes</b>: every payoff at these levels can be built (a complete market)</td></tr>' +
      '<tr style="' + (rk < m ? hl : '') + '"><td>$r &lt; m$' + (rk < m ? ' ← yours' : '') + '</td><td>only <b>part</b> of the space (' + (m - rk === 1 && m === 3 ? 'a flat sheet' : m - rk === 2 && m === 3 ? 'a line' : 'a ' + rk + '-direction part') + ')</td><td><b>No</b>: only the payoffs on that part</td></tr></table>' +
      '<p class="answer">Your market: $r$ = ' + rk + ', $m$ = ' + m + ' → ' + (rk === m ? 'the span is <b>everything</b>: any payoff can be built.' : 'the span is only <b>part</b>: some payoffs (see the ✗ rows below) can\'t be built.') + ' Span = the list of payoffs you can build; it covers every payoff only when $r = m$.</p></div>' +
      '<p><b>How to test whether a payoff is in the span:</b> solve $Ax = b$ (Lecture 09): zero rows must read 0 = 0.</p>' +
      '<table><tr><th>Payoff</th><th>In the span?</th></tr>' + tests.map(function (b, k) { var s = inSpan(b); return '<tr><td>' + vec(b) + (k < m ? ' (1 only at ' + lv[k] + ')' : ' (your client)') + '</td><td>' + (s ? '✓ yes' : '✗ no') + '</td></tr>'; }).join('') + '</table>' +
      '<p><b>Do they span every payoff?</b> Yes exactly when $r = m$ (every level row has a pivot). Your market: $r$ = ' + rk + ', $m$ = ' + m + ' → ' + (spans ? '<b>yes</b>: every payoff at these levels can be built (a complete market).' : '<b>no</b>: they span only a ' + (rk === 1 ? 'line' : rk === 2 ? 'flat sheet' : rk + '-direction space') + ' inside all payoffs.') + '</p>' +
      (function () {
        var g = augSteps(A, Lv.map(function () { return ZERO; })), zr = []; for (var i = g.rank; i < m; i++) zr.push(g.E[i]);
        function rule(e) { var out = ''; e.forEach(function (c, k) { if (c.isZero()) return; var mag = c.num() < 0 ? c.neg() : c, term = (mag.sub(ONE).isZero() ? '' : ft(mag) + ' × ') + '(payoff at ' + lv[k] + ')'; out += out ? (c.num() < 0 ? ' − ' : ' + ') + term : (c.num() < 0 ? '−' : '') + term; }); return out + ' = 0'; }
        function obeys(b) { return zr.every(function (e) { return dot(e, b).isZero(); }); }
        var tries = [tgt].concat(Lv.map(function (_, i) { return Lv.map(function (_, k) { return i === k ? ONE : ZERO; }); }), [Lv.map(function () { return ONE; })], [A.map(function (r) { return r[pivC[0]].mul(new Fr(3)); })]);
        var live = '<h5>When $r &lt; m$: which payoffs CAN you build? (your market)</h5>' +
          (rk === m ? '<p>Your market has $r = m$ = ' + m + ': <b>no rules</b>. Every payoff can be built. (Try the 2D example below to see the $r &lt; m$ case.)</p>' :
          '<p><b>How:</b> eliminate; each zero row gives one <b>rule</b> the payoff must obey (the same mix of rows that made the zero row must give 0). Number of rules = $m - r$ = ' + m + ' − ' + rk + ' = <b>' + (m - rk) + '</b>.</p>' +
          '<table><tr><th>Rule</th><th>In words</th></tr>' + zr.map(function (e, k) { var single = e.filter(function (v) { return !v.isZero(); }).length === 1; return '<tr><td>' + (k + 1) + '. ' + rule(e) + '</td><td>' + (single ? 'every product pays 0 at ' + lv[e.findIndex(function (v) { return !v.isZero(); })] + ', so the payoff must too' : 'a mix of levels where every product nets to 0; the payoff must net to 0 there too') + '</td></tr>'; }).join('') + '</table>' +
          '<table><tr><th>Payoff you want</th><th>Obeys the rule' + (zr.length > 1 ? 's' : '') + '?</th><th>Can build?</th></tr>' + tries.map(function (b, k) { var o = obeys(b); return '<tr><td>' + vec(b) + (k === 0 ? ' (your client)' : '') + '</td><td>' + (o ? '✓' : '✗') + '</td><td>' + (o ? '<b>yes</b>' : '<b>no</b>') + '</td></tr>'; }).join('') + '</table>' +
          '<p class="answer">With $r &lt; m$ you can build <b>only</b> the payoffs that obey the rule' + (zr.length > 1 ? 's' : '') + ': the points on the span. Every point off it is impossible with these products.</p>');
        var ex = '<div class="box finance"><span class="label">Worked example in 2D: $r &lt; m$, so not every point can be built</span>' +
          '<p><b>Setup.</b> Two Nifty levels: 19,900 and 20,100 ($m$ = 2). Payoffs in units of 100 points.</p>' +
          '<table><tr><th>Product</th><th>pays at 19,900</th><th>pays at 20,100</th><th>Why</th></tr>' +
          '<tr><td>A = 20,000 CE</td><td>0</td><td>1</td><td>below the strike: 0; at 20,100: 100 points = 1</td></tr>' +
          '<tr><td>B = 20,050 CE</td><td>0</td><td>0.5</td><td>below the strike: 0; at 20,100: 50 points = 0.5</td></tr></table>' +
          '<table><tr><th>Step</th><th>What we do</th><th>What we get</th></tr>' +
          '<tr><td>1. Rank</td><td>B = 0.5 × A (same direction, half as long). The 19,900 row is (0, 0): no pivot there. Only 1 pivot.</td><td>$r$ = 1 &lt; $m$ = 2</td></tr>' +
          '<tr><td>2. Rule</td><td>Both products pay 0 at 19,900, so any mix pays 0 there.</td><td><b>payoff at 19,900 must be 0</b> ($m - r$ = 1 rule)</td></tr>' +
          '<tr><td>3. Span</td><td>All mixes $a$ × A + $b$ × B = (0, $a$ + 0.5$b$).</td><td>the vertical line: points (0, anything)</td></tr></table>' +
          '<table><tr><th>Payoff (19,900, 20,100)</th><th>0 at 19,900?</th><th>Can build?</th><th>Recipe</th></tr>' +
          '<tr><td>(0, 1)</td><td>✓</td><td><b>yes</b></td><td>buy 1 A</td></tr>' +
          '<tr><td>(0, 3)</td><td>✓</td><td><b>yes</b></td><td>buy 3 A (or 6 B: many recipes, since B is a copy)</td></tr>' +
          '<tr><td>(0, −2)</td><td>✓</td><td><b>yes</b></td><td>sell 2 A</td></tr>' +
          '<tr><td>(1, 0)</td><td>✗</td><td><b>no</b></td><td>none</td></tr>' +
          '<tr><td>(1, 1)</td><td>✗</td><td><b>no</b></td><td>none</td></tr></table>' +
          '<p><b>How the picture is formed:</b> (1) draw arrow A to (0, 1) and arrow B to (0, 0.5): both point straight up; (2) stretch and flip them: every mix lands on the vertical line (purple), the span; (3) mark the payoffs from the table: green dots sit on the line (buildable), red dots sit off it (impossible); (4) the orange arrow is the fix below.</p>' +
          '<figure class="fig plot3d"><div id="labibd2d" class="plot3d-box" style="height:400px"></div><figcaption>Payoff space for 2 levels. The whole page = every possible payoff. Purple line = the span (what A and B can build). Green = on the line, red = off it.</figcaption></figure>' +
          '<table><tr><th>What the picture tells you</th><th>Meaning</th></tr>' +
          '<tr><td>the whole page</td><td>every possible payoff at these 2 levels</td></tr>' +
          '<tr><td>the purple line</td><td>the only payoffs A and B can build</td></tr>' +
          '<tr><td>most of the page is off the line</td><td>most payoffs <b>can\'t</b> be built: $r &lt; m$</td></tr></table>' +
          '<p><b>The fix:</b> add a product that points <b>off</b> the line, e.g. C = 20,000 PE paying (1, 0) (orange). Now $r$ = 2 = $m$: the span is the whole page and <b>every</b> payoff can be built, e.g. (1, 1) = 1 C + 1 A.</p>' +
          '<p class="answer">$r &lt; m$: the products cover only a line (in 2D), so only points on it can be built. $r = m$: they cover the whole page, every point can be built.</p></div>';
        return live + ex;
      })() +
      '<p><b>Span is the smallest space holding the products</b>: any space that holds them must hold all their mixes. <b>Spanning says nothing about extras:</b> ' + (freeC.length ? pivC.map(function (c) { return names[c]; }).join(' and ') + ' alone already span the same space; ' + freeC.map(function (c) { return names[c]; }).join(', ') + ' adds nothing (it is a copy), yet all ' + n + ' still "span" it.' : 'here there are no extras; every product adds a new direction.') + '</p>' +
      '<p><b>How the picture is formed</b> (axes = payoff at each level): draw each product as an arrow from 0 to its vector; every combination lands on the shaded ' + (rk >= m ? 'whole space' : rk === 2 ? 'sheet' : 'line') + ' they make; the red dot is your client.</p>' +
      '<figure class="fig plot3d"><div id="labibd" class="plot3d-box" style="height:420px"></div><figcaption>Payoff space. Arrows = products. Shaded = their span (column space). Red = your client.</figcaption></figure>');

    // 7. basis
    var combos = []; (function pick(start, cur) { if (cur.length === rk) { combos.push(cur.slice()); return; } for (var j = start; j < n; j++) { cur.push(j); pick(j + 1, cur); cur.pop(); } })(0, []);
    var alt = rk >= 2 ? [col(pivC[0]).map(function (v) { return v.mul(new Fr(2)); }), col(pivC[0]).map(function (v, i) { return v.add(col(pivC[1])[i]); })] : null;
    h.push('<h4>7. Basis: the smallest set that still builds everything</h4>' +
      '<div class="box definition"><span class="label">Definition</span><p>A <b>basis</b> for a space = products that are (1) <b>independent</b> and (2) <b>span</b> the space. No copies, nothing missing.</p></div>' +
      '<p><b>Basis for your column space $C(A)$:</b> the <b>pivot columns of the original $A$</b>: ' + pivC.map(function (c) { return label(c) + ' = ' + vec(col(c)); }).join(', ') + '. ' + (freeC.length ? freeC.map(function (c) { return names[c]; }).join(', ') + ' can be dropped: a copy, it adds nothing new.' : 'Nothing can be dropped.') + '</p>' +
      '<p><b>Why the original $A$, not $U$?</b> Elimination changes the columns (in $U$, ' + names[pivC[0]] + ' looks like ' + vec(U.map(function (r) { return r[pivC[0]]; })) + ', not ' + vec(col(pivC[0])) + '). It keeps only <b>which</b> columns are pivot columns.</p>' +
      '<p><b>A space has many bases.</b> Any ' + rk + ' independent products from the space work. Check every set of ' + rk + ' of your products:</p>' +
      '<table><tr><th>Set</th><th>Independent?</th><th>Basis for $C(A)$?</th></tr>' + combos.map(function (cs) { var r2 = rankOf(cs.map(col)); return '<tr><td>' + cs.map(function (c) { return names[c]; }).join(', ') + '</td><td>' + (r2 === rk ? '✓' : '✗ (one is a copy of the other)') + '</td><td>' + (r2 === rk ? '✓ yes' : '✗ no') + '</td></tr>'; }).join('') +
      (alt ? '<tr><td>2 × ' + names[pivC[0]] + ' = ' + vec(alt[0]) + ' and ' + names[pivC[0]] + ' + ' + names[pivC[1]] + ' = ' + vec(alt[1]) + '</td><td>' + (rankOf(alt) === 2 ? '✓' : '✗') + '</td><td>' + (rk === 2 && rankOf(alt) === 2 ? '✓ yes (new vectors, same space)' : rk === 2 ? '✗ no' : '— (needs ' + rk + ' vectors)') + '</td></tr>' : '') + '</table>' +
      '<p><b>Basis for <u>all</u> payoffs (every possible payoff at these ' + m + ' levels)?</b> Needs independent <b>and</b> spanning: $r = n = m$. Your products: ' + (indep && spans ? '<b>yes</b>, they are a basis: every payoff has exactly one recipe.' : '<b>no</b>: ' + (!indep ? 'they are dependent (a copy). ' : '') + (!spans ? (indep ? 'they' : 'They') + ' don\'t span everything (' + (m - rk) + ' direction' + (m - rk === 1 ? '' : 's') + ' missing).' : '')) + '</p>' +
      (function () {
        var Bc = pivC.map(col), Bm = Lv.map(function (_, i) { return Bc.map(function (c) { return c[i]; }); }), g = augSteps(Bm, tgt), okb = true;
        for (var i = g.rank; i < m; i++) if (!g.M[i][Bc.length].isZero()) okb = false;
        if (!okb) return '<p><b>With a basis, every payoff in the space has exactly one recipe.</b> Your client ' + vec(tgt) + ' is not in this space, so it has none.</p>';
        var y = Bc.map(function () { return ZERO; });
        for (var i2 = g.rank - 1; i2 >= 0; i2--) { var pc = g.piv[i2], sm = g.M[i2][Bc.length]; for (var j = pc + 1; j < Bc.length; j++) sm = sm.sub(g.M[i2][j].mul(y[j])); y[pc] = sm.div(g.M[i2][pc]); }
        return '<p><b>With a basis, every payoff in the space has exactly one recipe</b> (no copies, so no zero trade to add). Your client ' + vec(tgt) + ' with only ' + pivC.map(function (c) { return names[c]; }).join(', ') + ': ' + y.map(function (v, k) { return ft(v) + ' × ' + names[pivC[k]]; }).join(' + ') + '. The <b>only</b> one.' + (freeC.length ? ' (With all ' + n + ' products there were many recipes, because of the copy.)' : '') + '</p>';
      })() +
      '<div class="box theorem"><span class="label">Test: are ' + n + ' products a basis for all payoffs at ' + m + ' levels?</span>' +
      (n === m ? '<p>$n$ products in $\\mathbb{R}^n$ form a basis exactly when the square matrix with those columns is <b>invertible</b> (a pivot in every row and column, Lecture 04). Yours: ' + rk + ' pivots in a ' + n + ' × ' + n + ' matrix → ' + (rk === n ? '<b>invertible: a basis</b> ✓' : '<b>not invertible: not a basis</b> ✗') + '.</p>' : '<p>Needs exactly ' + m + ' products (the dimension). You have ' + n + ': ' + (n > m ? 'too many, they must be dependent.' : 'too few, they can\'t span.') + '</p>') +
      (function () {
        if (rk === m && rk === n) return '';
        var miss = Lv.map(function (_, i) { return Lv.map(function (_, k) { return i === k ? ONE : ZERO; }); }).filter(function (b) { return !inSpan(b); });
        if (!miss.length || !freeC.length) return '';
        var newCols = names.map(function (_, j) { return col(j); }), fixed = freeC.slice(0, miss.length);
        fixed.forEach(function (fc, k) { newCols[fc] = miss[k]; });
        var r2 = rankOf(newCols);
        return '<p><b>How to fix it:</b> drop the copy ' + fixed.map(function (c) { return names[c]; }).join(', ') + ' and add a product that leaves the ' + (rk === 2 ? 'sheet' : 'span') + ', e.g. a ticket paying ' + miss.slice(0, fixed.length).map(vec).join(', ') + ' (1 only at ' + miss.slice(0, fixed.length).map(function (b) { return lv[b.findIndex(function (v) { return !v.isZero(); })]; }).join(', ') + '). New rank = ' + r2 + (r2 === m && r2 === n ? ': <b>now a basis</b> ✓.' : '.') + '</p>';
      })() + '</div>' +
      '<p class="answer">Basis = the minimum set of products a desk needs: ' + pivC.map(function (c) { return names[c]; }).join(', ') + '. Everything else is a fixed recipe of them.</p>');

    // 8. dimension
    h.push('<h4>8. Dimension: how many in every basis?</h4>' +
      '<div class="box definition"><span class="label">Definition</span><p>Every basis of a space has the <b>same number</b> of vectors. That number is the <b>dimension</b> of the space. (Bases differ; their size does not.)</p></div>' +
      '<table><tr><th>Space</th><th>Basis</th><th>Dimension</th><th>Market meaning</th></tr>' +
      '<tr><td>column space $C(A)$</td><td>pivot columns: ' + pivC.map(function (c) { return names[c]; }).join(', ') + '</td><td>$r$ = <b>' + rk + '</b></td><td>truly different products</td></tr>' +
      '<tr><td>nullspace $N(A)$</td><td>special solutions: ' + (specials.map(function (sp) { return vec(sp.x); }).join(', ') || 'empty') + '</td><td>$n - r$ = <b>' + (n - rk) + '</b></td><td>independent zero trades (price rules)</td></tr>' +
      '<tr><td>all payoffs at ' + m + ' levels</td><td>"1 only at one level" tickets</td><td>$m$ = <b>' + m + '</b></td><td>what a complete market needs</td></tr></table>' +
      '<p><b>Check:</b> $r + (n - r) = n$: ' + rk + ' + ' + (n - rk) + ' = ' + n + ' products. Pivot columns count $C(A)$; free columns count $N(A)$.</p>' +
      (specials.length ? '<p><b>Why the special solutions are a basis of $N(A)$:</b> in the free entries they read ' + specials.map(function (sp) { return '(' + freeC.map(function (c) { return ft(sp.x[c]); }).join(', ') + ')'; }).join(', ') + ' (the identity), so they are independent; and every zero trade is a mix of them.</p>' +
        '<figure class="fig plot3d"><div id="labibdn" class="plot3d-box" style="height:380px"></div><figcaption>Lots space. Purple = the nullspace, built from its basis (the special solution' + (specials.length === 1 ? '' : 's') + '): dimension ' + specials.length + '.</figcaption></figure>' : '') +
      '<p><b>If you know the dimension $d$ of a space</b> (here: all payoffs, $d$ = ' + m + '):</p>' +
      '<table><tr><th>You have</th><th>Then</th><th>Yours</th></tr>' +
      '<tr><td>more than $d$ products</td><td>must be dependent</td><td>' + (n > m ? '← yours (' + n + ' &gt; ' + m + ')' : '') + '</td></tr>' +
      '<tr><td>fewer than $d$ products</td><td>can\'t span</td><td>' + (n < m ? '← yours (' + n + ' &lt; ' + m + ')' : '') + '</td></tr>' +
      '<tr><td>exactly $d$ products</td><td>independent ⇔ span ⇔ basis: check one, the other comes free</td><td>' + (n === m ? '← yours: ' + (indep ? 'independent, so they also span ✓' : 'dependent, so they also fail to span ✗') : '') + '</td></tr></table>');
    ibdPics = { span: { A: A, tgt: tgt, x: (!R.bad.length ? R.x : null), n: n, lv: lv, names: names, rank: rk, piv: pivC, idA: null, idB: "labibd" },
      nul: specials.length ? { id: "labibdn", n: n, names: names, nulls: specials.map(function (sp) { return sp.x; }), xp: null } : null };

    // 9. summary
    h.push('<h4>9. Everything from this lecture, for your market</h4><table><tr><th>Concept</th><th>Test / rule</th><th>Your market</th></tr>' +
      '<tr><td>Independent</td><td>$r = n$ (only no trade pays 0)</td><td>' + (indep ? '✓ yes' : '✗ no: ' + specials.map(copyTxt).join('; ')) + '</td></tr>' +
      '<tr><td>$n &gt; m$ rule</td><td>more products than levels ⇒ dependent</td><td>' + n + ' vs ' + m + '</td></tr>' +
      '<tr><td>Span</td><td>all combinations = $C(A)$; spans everything iff $r = m$</td><td>' + (spans ? 'everything' : 'a ' + rk + '-direction part') + '</td></tr>' +
      '<tr><td>Basis of $C(A)$</td><td>pivot columns of the original $A$</td><td>' + pivC.map(function (c) { return names[c]; }).join(', ') + '</td></tr>' +
      '<tr><td>Basis of all payoffs</td><td>$r = m = n$</td><td>' + (indep && spans ? '✓' : '✗') + '</td></tr>' +
      '<tr><td>$\\dim C(A)$</td><td>= rank $r$</td><td>' + rk + '</td></tr>' +
      '<tr><td>$\\dim N(A)$</td><td>= $n - r$</td><td>' + (n - rk) + '</td></tr></table>');
    return h.join("");
  }

  // ---------- four fundamental subspaces mode (Lecture 11 lab: <div id="replab" data-fs>) ----------
  var fsPics = null;
  function rrefE(A) {   // Gauss-Jordan on [A | I] with pivots only in A's columns: returns R, E (EA = R), and the moves
    var m = A.length, n = A[0].length, M = A.map(function (r) { return r.slice(); }), E = A.map(function (_, i) { return A.map(function (_, j) { return i === j ? ONE : ZERO; }); });
    var steps = [], piv = [], free = [], r = 0;
    function snapE() { return E.map(function (x) { return x.slice(); }); }
    function fq(v) { var t = v.f ? String(+v.num().toFixed(2)) : (v.d === 1 ? String(v.n) : v.n + '/' + v.d); t = t.replace('-', '−'); return v.num() < 0 ? '(' + t + ')' : t; }
    for (var c = 0; c < n; c++) {
      if (r >= m) { free.push(c); continue; }
      var k = -1; for (var i = r; i < m; i++) if (!M[i][c].isZero()) { k = i; break; }
      if (k < 0) { free.push(c); continue; }
      if (k !== r) { var t = M[r]; M[r] = M[k]; M[k] = t; t = E[r]; E[r] = E[k]; E[k] = t; steps.push({ txt: 'swap rows ' + (r + 1) + ' and ' + (k + 1), E: snapE(), M: M.map(function (x) { return x.slice(); }) }); }
      var pv = M[r][c];
      if (!pv.sub(ONE).isZero()) { M[r] = M[r].map(function (v) { return v.div(pv); }); E[r] = E[r].map(function (v) { return v.div(pv); }); steps.push({ txt: 'row ' + (r + 1) + ' ÷ ' + fq(pv), E: snapE(), M: M.map(function (x) { return x.slice(); }) }); }
      for (var i2 = 0; i2 < m; i2++) {
        if (i2 === r || M[i2][c].isZero()) continue;
        var mult = M[i2][c], pr = M[r], pe = E[r];
        M[i2] = M[i2].map(function (v, j) { return v.sub(pr[j].mul(mult)); });
        E[i2] = E[i2].map(function (v, j) { return v.sub(pe[j].mul(mult)); });
        steps.push({ txt: 'row ' + (i2 + 1) + ' − ' + fq(mult) + ' × row ' + (r + 1), E: snapE(), M: M.map(function (x) { return x.slice(); }) });
      }
      piv.push(c); r++;
    }
    return { R: M, E: E, piv: piv, free: free, rank: r, steps: steps };
  }

  function fsSections(A, tgt, Lv, n, vars, names, R0, tradeTxt, P) {
    var h = [], lv = Lv.map(fmtLvl), m = Lv.length;
    function ft(v) { var t = (v.f || Math.abs(v.d) > 12) ? String(+v.num().toFixed(2)) : (v.d === 1 ? String(v.n) : v.n + '/' + v.d); return t.replace('-', '−'); }
    function vec(r) { return '(' + r.map(ft).join(', ') + ')'; }
    function dot(u, v) { return u.reduce(function (sm, a, k) { return sm.add(a.mul(v[k])); }, ZERO); }
    function col(j) { return A.map(function (r) { return r[j]; }); }
    function lotsTxt(lots) { var parts = lots.map(function (v, j) { return v.isZero() ? null : (v.num() < 0 ? 'sell ' + ft(v.neg()) : 'buy ' + ft(v)) + ' ' + names[j]; }).filter(Boolean); return parts.length ? parts.join(', ') : 'no trade'; }
    function rowMix(y, lab) { var out = ''; y.forEach(function (c, k) { if (c.isZero()) return; var mag = c.num() < 0 ? c.neg() : c, term = (mag.sub(ONE).isZero() ? '' : ft(mag) + ' × ') + lab(k); out += out ? (c.num() < 0 ? ' − ' : ' + ') + term : (c.num() < 0 ? '−' : '') + term; }); return out || '0'; }
    var hl = 'background: color-mix(in srgb, var(--accent) 25%, transparent); font-weight: 700;', fcol = 'background: color-mix(in srgb, var(--thm-b) 18%, transparent);', zrow = 'background: color-mix(in srgb, var(--warn-b) 15%, transparent);';
    var G = rrefE(A), RR = G.R, E = G.E, rk = G.rank, pivC = G.piv, freeC = G.free;
    var AT = A[0].map(function (_, j) { return A.map(function (r) { return r[j]; }); }), rkT = echelonSteps(AT).rank;
    var rowB = RR.slice(0, rk), nullB = freeC.map(function (fc) { var x = names.map(function () { return ZERO; }); x[fc] = ONE; pivC.forEach(function (pc, i) { x[pc] = RR[i][fc].neg(); }); return x; });
    var colB = pivC.map(col), leftB = E.slice(rk);
    var prem = P.map(function (pr) { return parseFr(pr.p); }), havePrem = !prem.some(function (q) { return q === null; });
    function lvl(i) { return 'row ' + lv[i]; }

    // 4. the four subspaces
    h.push('<h4>4. The four subspaces of your market</h4>' +
      '<p>$A$ has $m$ = ' + m + ' rows (Nifty levels) and $n$ = ' + n + ' columns (products). From one matrix come <b>four</b> spaces: two from the columns, two from the rows.</p>' +
      '<table><tr><th>#</th><th>Name</th><th>Symbol</th><th>What is in it</th><th>Market meaning</th><th>New?</th></tr>' +
      '<tr><td>1</td><td>column space</td><td>$C(A)$</td><td>all mixes of the columns (products)</td><td>every payoff you can build</td><td>Lecture 07</td></tr>' +
      '<tr><td>2</td><td>nullspace</td><td>$N(A)$</td><td>all lots $x$ with $Ax = 0$</td><td>every zero trade (copies)</td><td>Lectures 07–08</td></tr>' +
      '<tr><td>3</td><td>row space</td><td>$C(A^T)$</td><td>all mixes of the rows (Nifty levels)</td><td>where fair price lists live</td><td><b>new</b></td></tr>' +
      '<tr><td>4</td><td>left nullspace</td><td>$N(A^T)$</td><td>all $y$ with $A^Ty = 0$: mixes of rows giving the zero row</td><td>the tests a payoff must pass to be buildable</td><td><b>new</b></td></tr></table>' +
      '<p><b>Why "row space" is written $C(A^T)$:</b> transposing turns rows into columns, so mixes of the rows of $A$ = mixes of the columns of $A^T$.</p>' +
      '<p><b>Why "left" nullspace:</b> $A^Ty = 0$ flipped is $y^TA = 0$: the row $y^T$ multiplies $A$ from the <b>left</b>, giving $y_1$(row 1) + $y_2$(row 2) + … = zero row. Nullspace = columns mixing to zero; left nullspace = <b>rows</b> mixing to zero (the mirror image).</p>');

    // 4b. what each space tells you
    (function () {
      function card(cls, title, rows) { return '<div class="box ' + cls + '"><span class="label">' + title + '</span><table>' + rows.map(function (r) { return '<tr><th style="width:24%">' + r[0] + '</th><td>' + r[1] + '</td></tr>'; }).join('') + '</table></div>'; }
      var inC = leftB.every(function (y) { return dot(y, tgt).isZero(); });
      var unit = Lv.map(function (_, i) { return Lv.map(function (_, k) { return i === k ? ONE : ZERO; }); });
      var bad = unit.filter(function (b) { return !leftB.every(function (y) { return dot(y, b).isZero(); }); });
      var zc = havePrem && nullB.length ? dot(nullB[0], prem) : null;
      var anyX = names.map(function (_, j) { return j === 0 ? new Fr(2) : ONE; }), xPay = A.map(function (r) { return dot(r, anyX); });
      var out = '<h4>4b. What each space tells you (one at a time)</h4><p>Four spaces, four different questions. Read them in this order: two about <b>payoffs</b> (column space, left nullspace) and two about <b>lots and prices</b> (nullspace, row space).</p>';

      out += card('definition', '1. Column space $C(A)$: what can I BUILD?', [
        ['Definition', 'All combinations of the columns of $A$: $C(A) = \\{Ax\\}$ for every possible list of lots $x$. Each column is one product\'s payoff at the ' + m + ' Nifty levels.'],
        ['In simple words', 'Your <b>menu of payoffs</b>: everything you can get by buying and selling these products in any amounts.'],
        ['Question it answers', 'Can a client\'s payoff be built from these products?'],
        ['Market link', 'A payoff inside $C(A)$ can be replicated (copied) and so priced exactly. Outside: can\'t be hedged, the seller carries risk.'],
        ['How to find it', 'Eliminate; the <b>pivot columns of the original $A$</b> are a basis. Size = $r$.'],
        ['Your market', 'Basis ' + colB.map(vec).join(', ') + ' (' + pivC.map(function (c) { return names[c]; }).join(', ') + '); size ' + rk + ' of ' + m + ' → ' + (rk === m ? '<b>every</b> payoff can be built' : 'only <b>part</b> of all payoffs')],
        ['See it', 'Your client ' + vec(tgt) + ': <b>' + (inC ? 'inside ✓ (can build)' : 'outside ✗ (can\'t build)') + '</b>. Any lots, e.g. ' + vec(anyX) + ', land inside: they pay ' + vec(xPay) + '.']]);

      out += card('pitfall', '2. Left nullspace $N(A^T)$: what CAN\'T I build, and why?', [
        ['Definition', 'All $y$ (one number per Nifty level) with $A^Ty = 0$, i.e. $y^TA = $ zero row: a <b>mix of the Nifty-level rows</b> in which every product nets to 0.'],
        ['In simple words', 'A <b>blind spot</b> of your products: a combination of levels that no product can "see". Each one gives a <b>rule</b> every buildable payoff must obey: $y \\cdot b = 0$.'],
        ['Question it answers', 'Which payoffs are impossible, and what test must a payoff pass?'],
        ['Market link', 'Missing directions = the market is <b>incomplete</b>. To fill a blind spot you need a new strike/product. Also: state prices are <b>not unique</b> by exactly these directions.'],
        ['How to find it', 'The rows of $E$ that produced the <b>zero rows</b> of $R$ (last $m - r$ rows of $E$). Size = $m - r$.'],
        ['Your market', (leftB.length ? 'Basis ' + leftB.map(vec).join(', ') + ': rule' + (leftB.length > 1 ? 's' : '') + ' ' + leftB.map(function (y) { return rowMix(y, function (k) { return 'b@' + lv[k]; }) + ' = 0'; }).join('; ') + '. Size ' + (m - rk) + '.' : 'Only {0}: <b>no blind spots</b>, no rules: complete market.')],
        ['See it', leftB.length ? 'Your client: ' + leftB.map(function (y) { return vec(y) + ' · ' + vec(tgt) + ' = ' + ft(dot(y, tgt)); }).join(', ') + ' → ' + (inC ? 'passes ✓' : 'fails ✗') + '. ' + (bad.length ? 'E.g. ' + vec(bad[0]) + ' fails: impossible.' : '') : 'Every payoff passes.']]);

      out += card('intuition', '3. Nullspace $N(A)$: which trades do NOTHING?', [
        ['Definition', 'All lots $x$ (one number per product) with $Ax = 0$: the payoff is 0 at <b>every</b> Nifty level.'],
        ['In simple words', '<b>Zero trades</b>: positions that pay nothing whatever happens. They exist only if some product is a <b>copy</b> of others.'],
        ['Question it answers', 'Are there copies? How many recipes does a payoff have?'],
        ['Market link', '(1) Each zero trade must cost <b>0</b> today, else <b>arbitrage</b>. (2) Any recipe + a zero trade = another recipe for the same payoff, so you can pick the cheapest.'],
        ['How to find it', 'Special solutions: set one free variable to 1, solve the pivots (or read $N = [-F;\\ I]$ from $R$). Size = $n - r$.'],
        ['Your market', nullB.length ? 'Basis ' + nullB.map(function (x) { return vec(x) + ' = ' + lotsTxt(x); }).join('; ') + '. Size ' + (n - rk) + '.' : 'Only "no trade": no copies, one recipe per payoff.'],
        ['See it', nullB.length ? 'Pays ' + vec(A.map(function (r) { return dot(r, nullB[0]); })) + ' ✓.' + (zc ? ' Costs ' + ft(zc) + ' today → ' + (zc.isZero() ? 'fair ✓' : '<b>arbitrage</b> ✗') + '.' : '') : 'Nothing to check.']]);

      out += card('theorem', '4. Row space $C(A^T)$: which PRICES are fair?', [
        ['Definition', 'All combinations of the rows of $A$. Each row = what <b>every</b> product pays if Nifty ends at one level. Vectors have one number per product.'],
        ['In simple words', 'The <b>fair price lists</b>. Suppose "1 unit paid only if Nifty ends at level $i$" costs $q_i$ today (a state price). Then a fair price list is $q_1 \\times$ row 1 + $q_2 \\times$ row 2 + … $= A^Tq$: a mix of the rows.'],
        ['Question it answers', 'Are today\'s premiums consistent with each other (no free money)?'],
        ['Market link', 'Premiums <b>in</b> the row space ⇔ some state prices explain every premium ⇔ every zero trade costs 0. <b>Outside</b> ⇒ arbitrage. Bonus: the row space is also the part of a trade that <b>changes</b> the payoff; the nullspace part changes nothing.'],
        ['How to find it', 'The first $r$ rows of $R$ (same row space as $A$). Size = $r$ (same as the column space!).'],
        ['Your market', 'Basis ' + rowB.map(vec).join(', ') + '; size ' + rk + ' of ' + n + '.'],
        ['See it', havePrem ? 'Premiums ' + vec(prem) + ': ' + (nullB.length ? (zc.isZero() ? '<b>in</b> the row space ✓ (fair)' : '<b>outside</b> the row space ✗ (the zero trade costs ' + ft(zc) + ')') : 'with $r = n$ every price list is in the row space ✓') + '.' : 'Enter premiums to check.']]);

      out += '<table><tr><th>Space</th><th>Lives in</th><th>Asks</th><th>Size</th><th>Your answer</th></tr>' +
        '<tr><td>column space</td><td>payoffs</td><td>what can I build?</td><td>$r$ = ' + rk + '</td><td>' + (rk === m ? 'everything' : 'part') + '</td></tr>' +
        '<tr><td>left nullspace</td><td>payoffs</td><td>what can\'t I build (the rules)?</td><td>$m - r$ = ' + (m - rk) + '</td><td>' + (leftB.length ? leftB.length + ' rule' + (leftB.length > 1 ? 's' : '') : 'no rules') + '</td></tr>' +
        '<tr><td>nullspace</td><td>lots</td><td>which trades do nothing?</td><td>$n - r$ = ' + (n - rk) + '</td><td>' + (nullB.length ? nullB.length + ' zero trade' + (nullB.length > 1 ? 's' : '') : 'none') + '</td></tr>' +
        '<tr><td>row space</td><td>prices (per product)</td><td>which prices are fair?</td><td>$r$ = ' + rk + '</td><td>' + (havePrem ? (nullB.length && !zc.isZero() ? 'premiums unfair' : 'premiums fair') : '—') + '</td></tr></table>' +
        '<p class="answer">Column space = what you can build. Left nullspace = what you can\'t (and the test). Nullspace = trades that do nothing (copies, must cost 0). Row space = fair price lists. Payoff side: ' + rk + ' + ' + (m - rk) + ' = ' + m + ' levels. Lots side: ' + rk + ' + ' + (n - rk) + ' = ' + n + ' products.</p>';
      h.push(out);
    })();

    // 5. rows tell about columns
    h.push('<h4>5. The rows tell you about the columns</h4>' +
      '<p>Number of independent rows = number of independent columns = $r$. Your market: rank by columns = <b>' + rk + '</b>, rank by rows (eliminate $A^T$) = <b>' + rkT + '</b> ✓.</p>' +
      (leftB.length ? '<p><b>Here a row mix gives zero:</b> ' + rowMix(leftB[0], lvl) + ' = zero row. So at most ' + rk + ' rows are independent, and therefore at most ' + rk + ' columns: the products must be dependent' + (nullB.length ? ' (' + lotsTxt(nullB[0]) + ' pays 0)' : '') + '. Sometimes the dependence is easy to see in the rows and hidden in the columns (or the other way round).</p>' : '<p>No row mix gives zero: all ' + m + ' rows independent, so all ' + rk + ' columns are too.</p>'));

    // 6. where they live and dimensions
    h.push('<h4>6. Where they live, and their sizes</h4>' +
      '<p>Count how many numbers each vector has.</p>' +
      '<table><tr><th>Space</th><th>Its vectors are…</th><th>Length</th><th>Lives in</th><th>Dimension</th><th>Yours</th></tr>' +
      '<tr><td>row space $C(A^T)$</td><td>rows: one number per product</td><td>$n$ = ' + n + '</td><td>lots space $\\mathbb{R}^' + n + '$</td><td>$r$</td><td><b>' + rk + '</b></td></tr>' +
      '<tr><td>nullspace $N(A)$</td><td>lots: one number per product</td><td>$n$ = ' + n + '</td><td>lots space $\\mathbb{R}^' + n + '$</td><td>$n - r$</td><td><b>' + (n - rk) + '</b></td></tr>' +
      '<tr><td>column space $C(A)$</td><td>payoffs: one number per level</td><td>$m$ = ' + m + '</td><td>payoff space $\\mathbb{R}^' + m + '$</td><td>$r$</td><td><b>' + rk + '</b></td></tr>' +
      '<tr><td>left nullspace $N(A^T)$</td><td>level mixes: one number per level</td><td>$m$ = ' + m + '</td><td>payoff space $\\mathbb{R}^' + m + '$</td><td>$m - r$</td><td><b>' + (m - rk) + '</b></td></tr></table>' +
      '<p><b>They add up on each side:</b> lots side $r + (n - r) = n$: ' + rk + ' + ' + (n - rk) + ' = ' + n + '. Payoff side $r + (m - r) = m$: ' + rk + ' + ' + (m - rk) + ' = ' + m + '. The wonderful fact: row space and column space have the <b>same</b> dimension $r$.</p>');

    // 7. column space basis
    h.push('<h4>7. Column space: basis = pivot columns of the original $A$</h4>' +
      '<p>Eliminate (steps in section 8); pivots fall in ' + pivC.map(function (c) { return names[c]; }).join(', ') + '. Basis: ' + pivC.map(function (c) { return names[c] + ' = ' + vec(col(c)); }).join(', ') + '. Dimension ' + rk + '.</p>' +
      (rk < m ? '<p><b>Row moves change the column space:</b> in $R$ every column ends with ' + (m - rk) + ' zero' + (m - rk === 1 ? '' : 's') + ' (the zero row' + (m - rk === 1 ? '' : 's') + '), e.g. ' + names[pivC[0]] + ' becomes ' + vec(RR.map(function (r) { return r[pivC[0]]; })) + '. But ' + names[pivC[0]] + '\'s real payoff ' + vec(col(pivC[0])) + ' is in $C(A)$. So $C(R) \\ne C(A)$: take the columns from the <b>original</b> $A$; elimination only says <b>which</b> ones.</p>' : '<p>$r = m$: the column space is every payoff, and here $C(R) = C(A)$ = everything.</p>'));

    // 8. row space basis from R (with the moves, carrying I along for section 10)
    h.push('<h4>8. Row space: basis = first $r$ rows of $R$</h4>' +
      '<p><b>How.</b> Go all the way to the tidy form $R$ (pivots 1, zeros above and below). Do every move to $I$ as well: $[A \\mid I] \\to [R \\mid E]$ (we need $E$ in section 10).</p>' +
      '<table><tr><th>Move</th><th>$R$ side (rows)</th><th>$I$ side becomes $E$</th></tr><tr><td>start</td><td>' + A.map(vec).join('<br>') + '</td><td>' + A.map(function (_, i) { return vec(A.map(function (_, j) { return i === j ? ONE : ZERO; })); }).join('<br>') + '</td></tr>' +
      G.steps.map(function (st) { return '<tr><td>' + st.txt + '</td><td>' + st.M.map(vec).join('<br>') + '</td><td>' + st.E.map(vec).join('<br>') + '</td></tr>'; }).join('') + '</table>' +
      '<p><b>$R$</b> (pivots blue, $F$ purple, zero rows red):</p><table><tr><th></th>' + names.map(function (nm) { return '<th>' + nm + '</th>'; }).join('') + '</tr>' +
      RR.map(function (row, i) { return '<tr style="' + (i >= rk ? zrow : '') + '"><th>row ' + (i + 1) + '</th>' + row.map(function (v, j) { return '<td style="' + (i < rk && pivC[i] === j ? hl : i < rk && freeC.indexOf(j) >= 0 ? fcol : '') + '">' + ft(v) + '</td>'; }).join('') + '</tr>'; }).join('') + '</table>' +
      '<p><b>Why $A$ and $R$ have the same row space:</b> every move builds a new row from old rows, and every move can be undone. So the rows of $R$ are mixes of the rows of $A$ and the other way round.</p>' +
      '<p><b>Basis:</b> ' + rowB.map(vec).join(', ') + '. Independent: in the pivot columns they read the identity. Dimension ' + rk + '.</p>' +
      '<p><b>Check: rebuild each row of $A$</b> (trick: the amounts are just $A$\'s numbers in the pivot columns):</p><table><tr><th>Row of $A$</th><th>Recipe from the basis</th><th>Result</th></tr>' +
      A.map(function (row, i) { var cs = pivC.map(function (pc) { return row[pc]; }), res = names.map(function (_, j) { return cs.reduce(function (sm, c, k) { return sm.add(c.mul(rowB[k][j])); }, ZERO); }); return '<tr><td>' + lv[i] + ': ' + vec(row) + '</td><td>' + cs.map(function (c, k) { return ft(c) + ' × ' + vec(rowB[k]); }).join(' + ') + '</td><td>' + vec(res) + ' ✓</td></tr>'; }).join('') + '</table>');

    // 9. nullspace basis
    h.push('<h4>9. Nullspace: basis = special solutions</h4>' +
      (nullB.length ? '<p>From $R$: pivots ' + pivC.map(function (c) { return vars[c]; }).join(', ') + '; free ' + freeC.map(function (c) { return vars[c]; }).join(', ') + '. One free = 1, others 0, read pivots as $-F$ (Lecture 08):</p><table><tr><th>Special solution</th><th>In words</th><th>Check $A x$</th></tr>' +
        nullB.map(function (x) { return '<tr><td>' + vec(x) + '</td><td>' + lotsTxt(x) + '</td><td>' + vec(A.map(function (r) { return dot(r, x); })) + ' ✓</td></tr>'; }).join('') + '</table><p>Dimension ' + nullB.length + ' = $n - r$ = ' + n + ' − ' + rk + '.</p>'
        : '<p>No free columns: $N(A) = \\{0\\}$, dimension 0 = $n - r$.</p>'));

    // 10. left nullspace from E
    h.push('<h4>10. Left nullspace: basis = last $m - r$ rows of $E$</h4>' +
      '<p>$E$ records the moves, so $EA = R$: each row of $E$ is a recipe of the rows of $A$.</p>' +
      '<table><tr><th>Row of $E$</th><th>Recipe of $A$\'s rows</th><th>Gives row of $R$</th></tr>' +
      E.map(function (e, i) { return '<tr style="' + (i >= rk ? zrow : '') + '"><td>' + vec(e) + '</td><td>' + rowMix(e, lvl) + '</td><td>' + vec(RR[i]) + (i >= rk ? ' ← zero row' : '') + '</td></tr>'; }).join('') + '</table>' +
      (leftB.length ? '<p><b>Read the answer:</b> the row' + (leftB.length === 1 ? '' : 's') + ' of $E$ that made the zero row' + (leftB.length === 1 ? '' : 's') + ': ' + leftB.map(vec).join(', ') + '. Basis of $N(A^T)$, dimension $m - r$ = ' + (m - rk) + '.</p>' +
        '<p><b>Check $A^Ty = 0$</b> ($y$ dotted with each product column): ' + leftB.map(function (y) { return names.map(function (nm, j) { return nm + ': ' + ft(dot(y, col(j))); }).join(', '); }).join('; ') + ' ✓ all 0.</p>' +
        '<p><b>Market meaning: the test a payoff must pass.</b> $b$ is buildable ⇔ $y \\cdot b = 0$ for every $y$ here (Lecture 09\'s condition). Your client ' + vec(tgt) + ': ' + leftB.map(function (y) { return vec(y) + ' · b = ' + ft(dot(y, tgt)); }).join(', ') + ' → ' + (leftB.every(function (y) { return dot(y, tgt).isZero(); }) ? '<b>buildable</b> ✓' : '<b>not buildable</b> ✗') + '.</p>'
        : '<p>No zero rows: $N(A^T) = \\{0\\}$. $R = I$, so $EA = I$ and $E = A^{-1}$ (Gauss–Jordan, Lecture 04). Every payoff passes: complete market.</p>'));

    // 11. big picture
    function box(title, sub, items) { return '<div style="flex:1;min-width:240px;border:2px solid var(--rule);border-radius:10px;padding:10px"><p style="margin:0 0 6px"><b>' + title + '</b><br><small>' + sub + '</small></p>' + items.map(function (it) { return '<div style="border:1px solid var(--rule);border-radius:8px;padding:8px;margin:6px 0;background:' + it[2] + '"><b>' + it[0] + '</b><br><small>' + it[1] + '</small></div>'; }).join('') + '</div>'; }
    var bgA = 'color-mix(in srgb, var(--accent) 12%, transparent)', bgB = 'color-mix(in srgb, var(--thm-b) 14%, transparent)';
    h.push('<h4>11. The big picture</h4>' +
      '<div style="display:flex;gap:14px;flex-wrap:wrap;align-items:center">' +
      box('Lots space ℝ<sup>' + n + '</sup>', 'one number per product (inputs $x$)', [['row space $C(A^T)$, dim ' + rk, 'basis: ' + rowB.map(vec).join(', '), bgA], ['nullspace $N(A)$, dim ' + (n - rk), 'basis: ' + (nullB.map(vec).join(', ') || '{0}') + '<br>$Ax = 0$: lands on 0', bgB]]) +
      '<div style="text-align:center;font-size:1.4em">$x \\mapsto Ax$<br>→</div>' +
      box('Payoff space ℝ<sup>' + m + '</sup>', 'one number per Nifty level (outputs $Ax$)', [['column space $C(A)$, dim ' + rk, 'basis: ' + colB.map(vec).join(', '), bgA], ['left nullspace $N(A^T)$, dim ' + (m - rk), 'basis: ' + (leftB.map(vec).join(', ') || '{0}'), bgB]]) + '</div>' +
      '<p><b>How the diagram is formed:</b> left box = vectors with ' + n + ' numbers (lots); right box = vectors with ' + m + ' numbers (payoffs). $A$ takes any lots $x$ on the left to the payoff $Ax$ on the right: it lands in the column space; if $x$ is in the nullspace it lands on 0. Each box splits into two pieces whose sizes add up (' + rk + ' + ' + (n - rk) + ' = ' + n + '; ' + rk + ' + ' + (m - rk) + ' = ' + m + '). The pictures below draw each piece; the two pieces on each side meet at a right angle (Lecture 14).</p>' +
      '<div class="figs"><figure class="fig plot3d" style="margin:0"><div id="labfsL" class="plot3d-box" style="height:380px"></div><figcaption>Lots space: row space (blue) and nullspace (purple).</figcaption></figure>' +
      '<figure class="fig plot3d" style="margin:0"><div id="labfsR" class="plot3d-box" style="height:380px"></div><figcaption>Payoff space: column space (blue) and left nullspace (purple).</figcaption></figure></div>');
    fsPics = { n: n, m: m, rowB: rowB, nullB: nullB, colB: colB, leftB: leftB, names: names, lv: lv };

    // 12. the four subspaces in the market: prices
    var s12 = '<h4>12. The four subspaces in your market: payoffs and prices</h4>' +
      '<table><tr><th>Space</th><th>Market meaning</th><th>Your market</th></tr>' +
      '<tr><td>$C(A)$</td><td>every payoff you can build</td><td>' + (rk === m ? 'everything' : 'a ' + rk + '-direction part; client ' + (leftB.every(function (y) { return dot(y, tgt).isZero(); }) ? 'inside' : 'outside')) + '</td></tr>' +
      '<tr><td>$N(A)$</td><td>zero trades; each must cost 0</td><td>' + (nullB.map(lotsTxt).join('; ') || 'only no trade') + '</td></tr>' +
      '<tr><td>$C(A^T)$</td><td>fair price lists: $p = A^Tq$ (price of each product = Σ state price × its payoff)</td><td>' + (havePrem ? 'premiums ' + vec(prem) : 'enter premiums') + '</td></tr>' +
      '<tr><td>$N(A^T)$</td><td>buildability tests; freedom in state prices</td><td>' + (leftB.map(vec).join(', ') || 'none: complete') + '</td></tr></table>';
    if (havePrem) {
      var g2 = augSteps(AT, prem), okp = true; for (var zi = g2.rank; zi < n; zi++) if (!g2.M[zi][m].isZero()) okp = false;
      s12 += '<p><b>Are the premiums a fair price list?</b> Fair ⇔ the premium list is in the row space ⇔ there are state prices $q$ (one per Nifty level) with $A^Tq = p$ ⇔ every zero trade costs 0.</p>' +
        '<table><tr><th>Check</th><th>Result</th></tr>' + (nullB.length ? nullB.map(function (x) { var c = dot(x, prem); return '<tr><td>zero trade ' + lotsTxt(x) + ' costs</td><td>' + ft(c) + (c.isZero() ? ' ✓' : ' ✗ (should be 0)') + '</td></tr>'; }).join('') : '<tr><td>zero trades</td><td>none, nothing to check</td></tr>') + '</table>';
      if (okp) {
        var q = Lv.map(function () { return ZERO; }); for (var i3 = g2.rank - 1; i3 >= 0; i3--) { var pc = g2.piv[i3], sm = g2.M[i3][m]; for (var j3 = pc + 1; j3 < m; j3++) sm = sm.sub(g2.M[i3][j3].mul(q[j3])); q[pc] = sm.div(g2.M[i3][pc]); }
        s12 += '<p class="answer">Fair ✓. One set of state prices: $q$ = ' + vec(q) + ' (price today of "1 unit only at ' + lv.join(' / ') + '"). Check: ' + names.map(function (nm, j) { return nm + ' = ' + ft(dot(q, col(j))); }).join(', ') + '. ' + (q.some(function (v) { return v.num() < 0; }) ? '<b>Note:</b> a negative state price means this ' + m + '-level model is too coarse (real Nifty can end between the levels); the full no-arbitrage rule needs all $q$ positive, which comes later. ' : '') + (leftB.length ? 'Not unique: add any multiple of the left nullspace vector ' + vec(leftB[0]) + ' and the prices still fit (incomplete market).' : 'Unique (complete market).') + '</p>';
      } else s12 += '<p class="answer">Not fair ✗: no state prices fit, the premium list is <b>outside</b> the row space. That is exactly the arbitrage: a zero trade with non-zero cost.</p>';
    }
    h.push(s12);

    // 13. matrix space
    var N2 = n * n, up = A.every(function (r, i) { return r.every(function (v, j) { return j >= i || v.isZero(); }); }), sym = n === m && A.every(function (r, i) { return r.every(function (v, j) { return v.sub(A[j][i]).isZero(); }); }), dia = A.every(function (r, i) { return r.every(function (v, j) { return i === j || v.isZero(); }); });
    h.push('<h4>13. A new vector space: matrices</h4>' +
      '<p>Treat a whole ' + m + ' × ' + n + ' matrix as one "vector": you can add two and multiply one by 7. Basis: the ' + N2 + ' matrices $E_{ij}$ with a single 1. Your $A$ = ' + A.map(function (r, i) { return r.map(function (v, j) { return v.isZero() ? null : ft(v) + 'E<sub>' + (i + 1) + (j + 1) + '</sub>'; }).filter(Boolean).join(' + '); }).filter(Boolean).join(' + ') + '.</p>' +
      (n === m ? '<table><tr><th>Subspace of all ' + n + ' × ' + n + ' matrices</th><th>Closed? (add two, scale one)</th><th>Dimension</th><th>Your $A$ in it?</th></tr>' +
        '<tr><td>all matrices $M$</td><td>yes</td><td>' + N2 + '</td><td>✓</td></tr>' +
        '<tr><td>upper triangular $U$</td><td>yes: zeros below stay zero</td><td>' + (n * (n + 1) / 2) + '</td><td>' + (up ? '✓' : '✗') + '</td></tr>' +
        '<tr><td>symmetric $S$ ($A^T = A$)</td><td>yes: mirror pairs stay equal</td><td>' + (n * (n + 1) / 2) + '</td><td>' + (sym ? '✓' : '✗') + '</td></tr>' +
        '<tr><td>diagonal $D = U \\cap S$</td><td>yes</td><td>' + n + '</td><td>' + (dia ? '✓' : '✗') + '</td></tr></table>' : '') +
      '<p>Market use: your "payoff tables" form a vector space too; e.g. adding two markets\' tables or scaling one.</p>');

    // 14. summary
    h.push('<h4>14. Everything from this lecture, for your market</h4><table><tr><th>Space</th><th>Lives in</th><th>Dimension</th><th>Basis</th><th>Your market</th></tr>' +
      '<tr><td>row space $C(A^T)$</td><td>$\\mathbb{R}^n$</td><td>$r$ = ' + rk + '</td><td>first $r$ rows of $R$</td><td>' + rowB.map(vec).join(', ') + '</td></tr>' +
      '<tr><td>nullspace $N(A)$</td><td>$\\mathbb{R}^n$</td><td>$n - r$ = ' + (n - rk) + '</td><td>special solutions</td><td>' + (nullB.map(vec).join(', ') || '{0}') + '</td></tr>' +
      '<tr><td>column space $C(A)$</td><td>$\\mathbb{R}^m$</td><td>$r$ = ' + rk + '</td><td>pivot columns of $A$</td><td>' + colB.map(vec).join(', ') + '</td></tr>' +
      '<tr><td>left nullspace $N(A^T)$</td><td>$\\mathbb{R}^m$</td><td>$m - r$ = ' + (m - rk) + '</td><td>last $m - r$ rows of $E$</td><td>' + (leftB.map(vec).join(', ') || '{0}') + '</td></tr></table>');
    return h.join("");
  }

  function drawFs(D) {
    if (!window.Plotly) { setTimeout(function () { drawFs(D); }, 300); return; }
    function cssv(v) { return getComputedStyle(document.documentElement).getPropertyValue(v).trim(); }
    var blue = cssv("--accent"), purple = cssv("--thm-b"), ink = cssv("--ink"), soft = cssv("--ink-soft"), rule = cssv("--rule"), paper2 = cssv("--paper-2");
    var cfg = { responsive: true, displaylogo: false, modeBarButtonsToRemove: ["toImage"] };
    function num(vs) { return vs.map(function (v) { return v.map(function (x) { return x.num(); }); }); }
    function draw(id, dim, A1, A2, labels, n1, n2) {
      var a = num(A1), b = num(A2), mx = 1; a.concat(b).forEach(function (v) { v.forEach(function (x) { mx = Math.max(mx, Math.abs(x)); }); }); mx = Math.ceil(mx) + 1; var K = mx * 3;
      function axis(t) { return { title: { text: t, font: { color: ink, size: 12 } }, range: [-mx, mx], autorange: false, tickmode: "linear", dtick: mx <= 6 ? 1 : 2, tickfont: { color: soft, size: 10 }, gridcolor: rule, zeroline: true, zerolinecolor: soft, showbackground: false }; }
      var tr = [];
      function span(vs, color, name) {
        if (!vs.length) { tr.push(dim === 3 ? { type: "scatter3d", mode: "markers", x: [0], y: [0], z: [0], marker: { color: color, size: 6 }, name: name + " = {0}" } : { type: "scatter", mode: "markers", x: [0], y: [0], marker: { color: color, size: 10 }, name: name + " = {0}" }); return; }
        if (vs.length >= dim) { if (dim === 2) tr.push({ type: "scatter", x: [-mx, mx, mx, -mx, -mx], y: [-mx, -mx, mx, mx, -mx], fill: "toself", fillcolor: "rgba(47,93,138,0.12)", line: { width: 0 }, mode: "lines", name: name + " = everything" }); else tr.push({ type: "scatter3d", mode: "markers", x: [0], y: [0], z: [0], marker: { color: color, size: 4 }, name: name + " = everything" }); }
        else if (vs.length === 1) { var v = vs[0]; tr.push(dim === 3 ? { type: "scatter3d", mode: "lines", x: [-K * v[0], K * v[0]], y: [-K * v[1], K * v[1]], z: [-K * v[2], K * v[2]], line: { color: color, width: 7 }, name: name + " (a line)" } : { type: "scatter", mode: "lines", x: [-K * v[0], K * v[0]], y: [-K * v[1], K * v[1]], line: { color: color, width: 4 }, name: name + " (a line)" }); }
        else { var u = vs[0], w = vs[1], c = [[-K, -K], [K, -K], [K, K], [-K, K]].map(function (st) { return u.map(function (x, i) { return st[0] * x + st[1] * w[i]; }); }); tr.push({ type: "mesh3d", x: c.map(function (p) { return p[0]; }), y: c.map(function (p) { return p[1]; }), z: c.map(function (p) { return p[2]; }), i: [0, 0], j: [1, 2], k: [2, 3], color: color, opacity: 0.25, name: name + " (a sheet)", showlegend: true }); }
        vs.forEach(function (v) { tr.push(dim === 3 ? { type: "scatter3d", mode: "lines", x: [0, v[0]], y: [0, v[1]], z: [0, v[2]], line: { color: color, width: 10 }, showlegend: false, hoverinfo: "skip" } : { type: "scatter", mode: "lines+markers", x: [0, v[0]], y: [0, v[1]], line: { color: color, width: 4 }, showlegend: false, hoverinfo: "skip" }); });
      }
      span(a, blue, n1); span(b, purple, n2);
      var lay = { paper_bgcolor: "rgba(0,0,0,0)", margin: dim === 3 ? { l: 0, r: 0, t: 0, b: 0 } : { l: 60, r: 20, t: 10, b: 60 }, legend: { orientation: "h", y: -0.05, font: { color: ink } } };
      if (dim === 3) lay.scene = { xaxis: axis(labels[0]), yaxis: axis(labels[1]), zaxis: axis(labels[2]), aspectmode: "cube", dragmode: "turntable", camera: { eye: { x: 1.5, y: -1.5, z: 0.9 } } };
      else { lay.plot_bgcolor = paper2; lay.xaxis = Object.assign(axis(labels[0]), { scaleanchor: "y", scaleratio: 1 }); lay.yaxis = axis(labels[1]); }
      Plotly.newPlot(id, tr, lay, cfg);
    }
    if (D.n <= 3) draw("labfsL", D.n, D.rowB, D.nullB, D.names.map(function (nm) { return "lots of " + nm; }), "row space", "nullspace");
    if (D.m <= 3) draw("labfsR", D.m, D.colB, D.leftB, D.lv.map(function (l) { return "payoff at " + l; }), "column space", "left nullspace");
  }

  // ---------- matrix spaces / rank 1 mode (Lecture 12 lab: <div id="replab" data-msr>) ----------
  function msrSections(A, tgt, Lv, n, vars, names, R0, tradeTxt, P) {
    var h = [], lv = Lv.map(fmtLvl), m = Lv.length;
    function ft(v) { var t = (v.f || Math.abs(v.d) > 12) ? String(+v.num().toFixed(2)) : (v.d === 1 ? String(v.n) : v.n + '/' + v.d); return t.replace('-', '−'); }
    function vec(r) { return '(' + r.map(ft).join(', ') + ')'; }
    function dot(u, v) { return u.reduce(function (sm, a, k) { return sm.add(a.mul(v[k])); }, ZERO); }
    function col(j) { return A.map(function (r) { return r[j]; }); }
    function tbl(M, hi) { return '<table><tr><th></th>' + names.map(function (nm) { return '<th>' + nm + '</th>'; }).join('') + '</tr>' + M.map(function (r, i) { return '<tr><th>' + lv[i] + '</th>' + r.map(function (v, j) { return '<td style="' + (hi ? hi(i, j) : '') + '">' + ft(v) + '</td>'; }).join('') + '</tr>'; }).join('') + '</table>'; }
    function rankOf(M) { return echelonSteps(M).rank; }
    function lotsTxt(lots) { var parts = lots.map(function (v, j) { return v.isZero() ? null : (v.num() < 0 ? 'sell ' + ft(v.neg()) : 'buy ' + ft(v)) + ' ' + names[j]; }).filter(Boolean); return parts.length ? parts.join(', ') : 'no trade'; }
    var hl = 'background: color-mix(in srgb, var(--accent) 22%, transparent); font-weight: 700;', soft = 'color: var(--ink-soft);';
    var G = rrefE(A), RR = G.R, rk = G.rank, pivC = G.piv;
    var prem = P.map(function (pr) { return parseFr(pr.p); }), havePrem = !prem.some(function (q) { return q === null; });

    // 4. table as a vector
    var terms = []; A.forEach(function (r, i) { r.forEach(function (v, j) { if (!v.isZero()) terms.push(ft(v) + ' E<sub>' + (i + 1) + (j + 1) + '</sub>'); }); });
    h.push('<h4>4. Your payoff table is one "vector" in the space of all ' + m + ' × ' + n + ' tables</h4>' +
      '<p><b>Why it counts as a vector:</b> two tables can be <b>added</b> (two books combined, entry by entry) and <b>scaled</b> (every position × 2). That is all a vector space needs.</p>' +
      tbl(A) +
      '<p><b>Basis:</b> the ' + (m * n) + ' tables $E_{ij}$ with a single 1 (row $i$ = level, column $j$ = product). Your table = ' + (terms.join(' + ') || '0') + '. <b>Dimension</b> of the space of all ' + m + ' × ' + n + ' tables = ' + (m * n) + ' (one free number per cell).</p>' +
      '<p><b>Two books added:</b> your table + (2 × your table) = 3 × your table: still a ' + m + ' × ' + n + ' table, still in the space ✓.</p>');

    // 5. symmetric + upper split
    if (m === n) {
      var S = A.map(function (r, i) { return r.map(function (_, j) { return i >= j ? A[i][j] : A[j][i]; }); }), U = A.map(function (r, i) { return r.map(function (v, j) { return v.sub(S[i][j]); }); });
      var isSym = A.every(function (r, i) { return r.every(function (v, j) { return v.sub(A[j][i]).isZero(); }); }), isUp = A.every(function (r, i) { return r.every(function (v, j) { return j >= i || v.isZero(); }); }), isDia = isSym && isUp;
      var dS = n * (n + 1) / 2;
      h.push('<h4>5. Subspaces of tables: symmetric, upper triangular, and their sum</h4>' +
        '<table><tr><th>Subspace</th><th>Rule</th><th>Dimension (' + n + ' × ' + n + ')</th><th>Your table in it?</th></tr>' +
        '<tr><td>symmetric $S$</td><td>entry $(i,j)$ = entry $(j,i)$</td><td>' + dS + '</td><td>' + (isSym ? '✓' : '✗') + '</td></tr>' +
        '<tr><td>upper triangular $U$</td><td>zeros below the diagonal</td><td>' + dS + '</td><td>' + (isUp ? '✓' : '✗') + '</td></tr>' +
        '<tr><td>$S \\cap U$ = diagonal</td><td>both</td><td>' + n + '</td><td>' + (isDia ? '✓' : '✗') + '</td></tr>' +
        '<tr><td>$S + U$ = all tables</td><td>symmetric + upper</td><td>' + (n * n) + '</td><td>✓ (always, see split)</td></tr></table>' +
        '<p><b>Split your table:</b> step 1: copy the numbers below the diagonal into their mirror spots (keep the diagonal) → $S$. Step 2: $U = A - S$ (zeros on and below the diagonal).</p>' +
        '<div class="figs"><div><p><b>$S$ (symmetric)</b></p>' + tbl(S, function (i, j) { return i > j ? hl : ''; }) + '</div><div><p><b>$U = A - S$ (upper)</b></p>' + tbl(U, function (i, j) { return i >= j ? soft : ''; }) + '</div></div>' +
        '<p><b>Check:</b> $S + U$ = ' + (S.every(function (r, i) { return r.every(function (v, j) { return v.add(U[i][j]).sub(A[i][j]).isZero(); }); }) ? 'your table ✓' : '✗') + '. <b>Dimension formula:</b> $\\dim S + \\dim U = \\dim(S \\cap U) + \\dim(S + U)$: ' + dS + ' + ' + dS + ' = ' + n + ' + ' + (n * n) + ' ✓.</p>' +
        '<p><b>Union is not a subspace:</b> $S$ (symmetric) and $U$ (upper) are each in "$S$ or $U$", but $S + U$ = your table' + (isSym || isUp ? '' : ', which is neither symmetric nor upper triangular') + '. ' + (isSym || isUp ? 'Try a table that is neither to see the union fail.' : 'Adding left the union ✗.') + '</p>');
    }

    // 6. rank-1 pieces
    var pieces = pivC.map(function (pc, k) { var u = col(pc), v = RR[k]; return { u: u, v: v, M: u.map(function (a) { return v.map(function (b) { return a.mul(b); }); }) }; });
    var sum = A.map(function (r) { return r.map(function () { return ZERO; }); }); pieces.forEach(function (p) { p.M.forEach(function (r, i) { r.forEach(function (v, j) { sum[i][j] = sum[i][j].add(v); }); }); });
    h.push('<h4>6. Rank-1 pieces: your table = ' + rk + ' bet' + (rk === 1 ? '' : 's') + '</h4>' +
      '<p><b>Rule:</b> a rank-' + rk + ' table is a sum of ' + rk + ' rank-1 tables, each a <b>column × row</b> ($uv^T$). Recipe: column = a pivot product\'s payoff (from $A$); row = the matching row of $R$ (how much of that bet each product carries).</p>' +
      pieces.map(function (p, k) { return '<p><b>Bet ' + (k + 1) + '</b> = payoff shape of ' + names[pivC[k]] + ' $u$ = ' + vec(p.u) + ' × row $v^T$ = ' + vec(p.v) + ' (how many units of this bet each product holds: ' + names.map(function (nm, j) { return nm + ' ' + ft(p.v[j]); }).join(', ') + '):</p>' + tbl(p.M); }).join('') +
      '<p><b>Check:</b> bet 1' + (rk > 1 ? ' + … + bet ' + rk : '') + ' = ' + (sum.every(function (r, i) { return r.every(function (v, j) { return v.sub(A[i][j]).isZero(); }); }) ? 'your table ✓' : '✗') + '.</p>' +
      '<p class="answer">' + (rk === 1 ? 'Rank 1: every product is just a different size of <b>one</b> payoff shape ' + vec(pieces[0].u) + '. All your products are one bet.' : 'Rank ' + rk + ': your ' + n + ' products are really ' + rk + ' independent bets; each product is a mix of them (its numbers in the rows of $R$).') + '</p>');

    // 7. not a subspace
    var a1 = pieces[0] ? pieces[0].M : null, a2;
    if (rk >= 2) a2 = pieces[1].M; else { a2 = A.map(function (r, i) { return r.map(function (_, j) { return ZERO; }); }); var free = 0; for (var i = 0; i < m; i++) { if (!a1 || a1.every(function (r) { return r[0].isZero(); }) || i !== 0) { } } a2[m - 1][n - 1] = ONE; if (a1 && rankOf(a1.map(function (r, i) { return r.map(function (v, j) { return v.add(a2[i][j]); }); })) < 2) { a2[m - 1][n - 1] = ZERO; a2[0][0] = ONE; } }
    if (a1) {
      var ss = a1.map(function (r, i) { return r.map(function (v, j) { return v.add(a2[i][j]); }); });
      h.push('<h4>7. Rank-1 tables are NOT a subspace</h4>' +
        '<p>Take two rank-1 tables (' + (rk >= 2 ? 'bet 1 and bet 2 above' : 'your table and a single-1 table') + ') and add them:</p>' +
        '<div class="figs"><div>' + tbl(a1) + '<p>rank ' + rankOf(a1) + '</p></div><div style="align-self:center;font-size:1.4em">+</div><div>' + tbl(a2) + '<p>rank ' + rankOf(a2) + '</p></div><div style="align-self:center;font-size:1.4em">=</div><div>' + tbl(ss) + '<p><b>rank ' + rankOf(ss) + '</b></p></div></div>' +
        '<p>The sum has rank ' + rankOf(ss) + ', not 1: adding left "rank 1", so it is <b>not</b> a subspace. Rule: rank$(A + B) \\le$ rank $A$ + rank $B$.</p>');
    }

    // 8. zero-cost vs zero-payoff (dimension formula)
    if (havePrem) {
      var pz = prem.every(function (v) { return v.isZero(); });
      var dPay = n - rk, dCost = pz ? n : n - 1, stack = A.concat([prem]), dBoth = n - rankOf(stack), dSum = dPay + dCost - dBoth;
      var pc0 = prem.findIndex(function (v) { return !v.isZero(); });
      var costB = pz ? [] : names.map(function (_, j) { return j; }).filter(function (j) { return j !== pc0; }).map(function (j) { var x = names.map(function () { return ZERO; }); x[j] = ONE; x[pc0] = prem[j].div(prem[pc0]).neg(); return x; });
      h.push('<h4>8. Two subspaces of trades: zero COST and zero PAYOFF</h4>' +
        '<table><tr><th>Subspace (of lots, ' + n + ' numbers)</th><th>Rule</th><th>It is the nullspace of</th><th>Dimension</th></tr>' +
        '<tr><td>zero-cost trades $Z_c$</td><td>premium · lots = 0 (self-financing)</td><td>the premium row ' + vec(prem) + '</td><td>' + dCost + '</td></tr>' +
        '<tr><td>zero-payoff trades $Z_p$</td><td>pays 0 at every level</td><td>$A$</td><td>' + dPay + '</td></tr>' +
        '<tr><td>$Z_c \\cap Z_p$</td><td>costs 0 <b>and</b> pays 0: harmless</td><td>$A$ with the premium row added</td><td>' + dBoth + '</td></tr>' +
        '<tr><td>$Z_c + Z_p$</td><td>sums of the two</td><td>—</td><td>' + dSum + '</td></tr></table>' +
        (costB.length ? '<p><b>Basis of zero-cost trades</b> (one per product except ' + names[pc0] + '): ' + costB.map(function (x) { return vec(x) + ' = ' + lotsTxt(x); }).join('; ') + '.</p>' : '') +
        '<p><b>Dimension formula:</b> ' + dCost + ' + ' + dPay + ' = ' + dBoth + ' + ' + dSum + ' ✓.</p>' +
        '<p class="answer">' + (dPay === 0 ? 'No zero-payoff trades: nothing to check.' : dBoth === dPay ? 'Every zero-payoff trade also costs 0 ($Z_p$ sits inside $Z_c$): <b>no arbitrage</b>.' : 'Some zero-payoff trade does <b>not</b> cost 0 ($Z_p$ is not inside $Z_c$: the intersection is smaller, ' + dBoth + ' &lt; ' + dPay + '): <b>arbitrage</b>.') + '</p>');
    }

    // 9. summary
    h.push('<h4>9. Everything from this lecture, for your market</h4><table><tr><th>Idea</th><th>Your market</th></tr>' +
      '<tr><td>table as a vector</td><td>one of the ' + (m * n) + '-dimensional space of ' + m + ' × ' + n + ' tables</td></tr>' +
      (m === n ? '<tr><td>symmetric / upper / diagonal</td><td>dimensions ' + (n * (n + 1) / 2) + ', ' + (n * (n + 1) / 2) + ', ' + n + '; $S + U$ = all</td></tr>' : '') +
      '<tr><td>rank-1 pieces</td><td>' + rk + ' bet' + (rk === 1 ? '' : 's') + '</td></tr>' +
      '<tr><td>rank-1 not a subspace</td><td>two rank-1 tables added → rank 2</td></tr>' +
      (havePrem ? '<tr><td>zero cost ∩ zero payoff</td><td>' + (n - rankOf(A.concat([prem]))) + ' of ' + (n - rk) + ' zero-payoff directions cost 0</td></tr>' : '') + '</table>');
    return h.join("");
  }

  function tpvSections(A, tgt, Lv, n, vars, names, R, tradeTxt, P) {
    var h = [], lv = Lv.map(fmtLvl), lot = state.mkt.lot || 65;
    function ft(v) { var t = (v.f || Math.abs(v.d) > 12) ? String(+v.num().toFixed(2)) : (v.d === 1 ? String(v.n) : v.n + '/' + v.d); return t.replace('-', '−'); }
    function fp(v) { return v.num() < 0 ? '(' + ft(v) + ')' : ft(v); }
    function vec(r) { return '(' + r.map(ft).join(', ') + ')'; }
    function mulV(Mx, v) { return Mx.map(function (r) { return r.reduce(function (sm, a, k) { return sm.add(a.mul(v[k])); }, ZERO); }); }
    function dot(u, v) { return u.reduce(function (sm, a, k) { return sm.add(a.mul(v[k])); }, ZERO); }
    function col(Mx, j) { return Mx.map(function (r) { return r[j]; }); }
    function li(label, text) { return '<p class="k"><span class="kl">' + label + '</span> ' + text + '</p>'; }
    function box(items) { return '<ol class="step-list kid-step">' + items.map(function (it) { return '<li>' + it + '</li>'; }).join("") + '</ol>'; }
    var unique = R.x && !R.bad.length && !R.free.length, x = unique ? R.x : null;
    var AT = A[0].map(function (_, j) { return A.map(function (r) { return r[j]; }); });
    var symA = A.every(function (r, i) { return r.every(function (v, j) { return v.sub(A[j][i]).isZero(); }); });

    // 3b. how to read sections 2 and 3
    var j0 = 0, i0 = 0;
    h.push('<h4>3b. Reading sections 2 and 3 slowly</h4>' + box([
      li('What', 'Section 2 is how much <b>1 lot</b> of each product pays at each Nifty level. Section 3 turns that table into one equation per Nifty level.') +
      li('How (one number)', names[j0] + ' = ' + esc(prodLabel(P[j0])) + ' at ' + lv[i0] + ': ' + formulaTxt(P[j0], Lv[i0]) + '. We count in units of 100 points, so it is <b>' + ft(A[i0][j0]) + '</b>. In rupees on 1 lot: ' + ft(A[i0][j0]) + ' × 100 points × ' + lot + ' = ₹' + Math.round(A[i0][j0].num() * 100 * lot).toLocaleString("en-IN") + '.'),
      li('How (one equation)', 'At ' + lv[0] + ': ' + names.map(function (nm, j) { return '$' + vars[j] + '$ lots of ' + nm + ' pay ' + ft(A[0][j]) + ' each'; }).join(', ') + ', and together they must make what the client wants there, ' + ft(tgt[0]) + '. So $' + eqTex(A[0], tgt[0], n) + '$.') +
      li('Why', 'Each equation says: "if Nifty ends at this level, my position must pay what the client wants." All the maths below uses only this small table.') +
      (x ? li('Answer', vars.map(function (v, j) { return '$' + v + ' = ' + x[j].tex() + '$'; }).join(', ') + '. Check at ' + lv[0] + ': ' + A[0].map(function (a, j) { return fp(a) + ' × ' + fp(x[j]); }).join(' + ') + ' = ' + ft(dot(A[0], x)) + ' ✓.') : '')
    ]));

    // 4. permutations
    var rev = Lv.map(function (_, i) { return n - 1 - i; });
    var Pm = rev.map(function (k) { return Lv.map(function (_, j) { return j === k ? ONE : ZERO; }); });
    var PA = rev.map(function (k) { return A[k]; }), Pb = rev.map(function (k) { return tgt[k]; });
    var F = luFactor(A);
    var sw = [1, 0].concat(Lv.slice(2).map(function (_, i) { return i + 2; })), APc = A.map(function (r) { return sw.map(function (k) { return r[k]; }); });
    h.push('<h4>4. Permutations: changing the order</h4>' + box([
      li('Purpose', 'The purpose of permutations in Gaussian elimination is to <b>rearrange rows when needed</b>, particularly to obtain a <b>nonzero pivot</b>. A pivot of 0 can\'t be used to clear the numbers under it (you can\'t divide by 0), so we swap in a row that has a nonzero number there.'),
      li('What', 'Write the same equations in a different order: ' + rev.map(function (k) { return lv[k]; }).join(', ') + ' instead of ' + lv.join(', ') + '.') +
      li('How', 'A permutation matrix $P$ is the identity with its rows shuffled. $P = ' + mTex(Pm) + '$. $PA = ' + mTex(PA) + '$ is the same rows in the new order, and the client\'s numbers move with them: $Pb = ' + vecTex(Pb) + '$.'),
      li('Why the answer doesn\'t change', 'It is like a shopping list: writing one item before another doesn\'t change what you buy. Each equation is still the same true fact.' + (x ? ' The lots are still ' + vec(x) + '. Check the new first row (' + lv[rev[0]] + '): ' + PA[0].map(function (a, j) { return fp(a) + ' × ' + fp(x[j]); }).join(' + ') + ' = ' + ft(dot(PA[0], x)) + ' ✓.' : '')),
      li('Swapping products', 'Swap ' + names[0] + ' and ' + names[1] + ' (that is $AP$, with $P$ on the right): $AP = ' + mTex(APc) + '$. It only renames who comes first.' + (x ? ' The lots are listed as (' + sw.map(function (k) { return names[k]; }).join(', ') + ') = ' + vec(sw.map(function (k) { return x[k]; })) + ': the same trades.' : '')),
      li('Why we care', 'A computer must swap rows when a pivot spot is 0 (you can\'t divide by 0). $P$ records the swap. ' + (F.swaps ? 'Your market needs one: it factors as $PA = LU$.' : 'Your market doesn\'t need one ($P = I$). Make a product pay 0 at the first level to see a swap.')) +
      li('Undo', 'Swapping twice brings you back, so undoing $P$ = flipping it: $P^{-1} = P^T$. There are ' + (n === 3 ? '3! = 6' : '2! = 2') + ' ways to order ' + n + ' Nifty levels.')
    ]));

    // 5. transpose (kept short on purpose)
    function dec(v) { return String(+v.num().toFixed(2)).replace('-', '−'); }
    function grid(title, rowHead, colHead, cell) {
      return '<table><tr><th>' + title + '</th>' + colHead.map(function (c) { return '<th>' + c + '</th>'; }).join("") + '</tr>' +
        rowHead.map(function (r, i) { return '<tr><th>' + r + '</th>' + colHead.map(function (_, j) { return '<td>' + cell(i, j) + '</td>'; }).join("") + '</tr>'; }).join("") + '</table>';
    }
    h.push('<h4>5. Transpose: flip the table</h4>' +
      '<div class="figs"><div>' + grid('$A$', lv, names, function (i, j) { return ft(A[i][j]); }) + '</div><div>' +
      grid('$A^T$', names, lv, function (i, j) { return ft(A[j][i]); }) + '</div></div>' +
      '<ul><li>Rows become columns. Nothing is calculated.</li>' +
      '<li>$A$: one row per Nifty level. $A^T$: one row per product, e.g. ' + names[0] + ' pays ' + vec(col(A, 0)) + '.</li>' +
      (symA ? '<li>In your market both tables look the same (the table is a mirror). That is a coincidence.</li>' : '') + '</ul>');

    // 6. value two ways: one table with totals on both edges
    var prem = P.map(function (pr) { return parseFr(pr.p); }), G = gaussJordan(A);
    if (x && !G.singular && !prem.some(function (p) { return p === null; })) {
      var q = Lv.map(function (_, j) { return prem.reduce(function (sm, p, k) { return sm.add(p.mul(G.inv[k][j])); }, ZERO); });
      var piece = function (j, i) { return x[j].mul(A[i][j]).mul(q[i]); }, total = dot(x, prem);
      h.push('<h4>6. Price your position two ways</h4>' +
        '<ul><li><b>Price of each Nifty level today</b> (from the premiums): ' + q.map(function (v, i) { return lv[i] + ' ≈ <b>' + dec(v) + '</b>'; }).join(', ') + '. Check ' + names[0] + ': ' + Lv.map(function (_, i) { return ft(A[i][0]) + ' × ' + dec(q[i]); }).join(' + ') + ' = ' + dec(prem[0]) + ' ✓' +
          (q.some(function (v) { return v.num() <= 0; }) ? ' <small>(a price ≤ 0 means ' + n + ' levels is too simple a model; see Lecture 04)</small>' : '') + '</li>' +
        '<li><b>Each cell</b> = lots × what it pays there × that level\'s price.</li></ul>' +
        '<table><tr><th></th>' + lv.map(function (L1) { return '<th>' + L1 + '</th>'; }).join("") + '<th>Add across</th></tr>' +
        names.map(function (nm, j) { var rs = Lv.reduce(function (sm, _, i) { return sm.add(piece(j, i)); }, ZERO); return '<tr><th>' + nm + ' (' + ft(x[j]) + ' lot)</th>' + Lv.map(function (_, i) { return '<td>' + dec(piece(j, i)) + '</td>'; }).join("") + '<td><b>' + dec(rs) + '</b></td></tr>'; }).join("") +
        '<tr><th>Add down</th>' + Lv.map(function (_, i) { var cs = names.reduce(function (sm, _, j) { return sm.add(piece(j, i)); }, ZERO); return '<td><b>' + dec(cs) + '</b></td>'; }).join("") + '<td><b>' + dec(total) + '</b></td></tr></table>' +
        '<ul><li><b>Add across</b> = each product\'s cost (its premium × lots). Total ' + dec(total) + '.</li>' +
        '<li><b>Add down</b> = what each Nifty level is worth. Total ' + dec(total) + '.</li>' +
        '<li>Same cells, so the same total. The transpose just switches which way you add: $x \\cdot (A^Tq) = (Ax) \\cdot q$.</li></ul>');
    } else h.push('<h4>6. Price your position two ways</h4><p>Needs a market with exactly one recipe and a premium for every product.</p>');

    // 7. A^T A, explained one multiplication at a time
    var S = matMul(AT, A), pairs = [];
    for (var jj = 0; jj < n; jj++) for (var kk = jj + 1; kk < n; kk++) pairs.push([jj, kk]);
    function levelLines(j, k) {
      return Lv.map(function (_, i) { return '<li>At ' + lv[i] + ': ' + ft(A[i][j]) + ' × ' + ft(A[i][k]) + ' = <b>' + ft(A[i][j].mul(A[i][k])) + '</b></li>'; }).join('') +
        '<li>Add the results: ' + Lv.map(function (_, i) { return fp(A[i][j].mul(A[i][k])); }).join(' + ') + ' = <b>' + ft(S[j][k]) + '</b></li>';
    }
    var j1 = 0, k1 = n > 1 ? 1 : 0;
    var h7 = [];
    h7.push('<h4>7. $A^TA$: comparing products, one multiplication at a time</h4>');
    // A with A
    h7.push('<p><b>' + names[j1] + ' compared with ' + names[j1] + '.</b> Take product ' + names[j1] + ', which pays ' + Lv.map(function (_, i) { return ft(A[i][j1]); }).join(' and ') + '. Multiply each number by itself:</p><ul>' + levelLines(j1, j1) + '</ul>' +
      '<p><b>So what does ' + ft(S[j1][j1]) + ' tell us?</b> It is a measure of ' + names[j1] + '\'s own payoff pattern: its payoffs multiplied by themselves and added. It is <b>not</b> saying that ' + names[j1] + ' pays ' + ft(S[j1][j1]) + ' points, ₹' + ft(S[j1][j1]) + ', or earns a profit of ' + ft(S[j1][j1]) + '. A product that pays more, or at more levels, gets a bigger number.</p>');
    // A with B
    if (n > 1) {
      h7.push('<p><b>' + names[j1] + ' compared with ' + names[k1] + '.</b> Now multiply ' + names[j1] + '\'s payoff by ' + names[k1] + '\'s payoff at each level:</p><ul>' + levelLines(j1, k1) + '</ul>' +
        '<p><b>So what does ' + ft(S[j1][k1]) + ' tell us?</b> How much ' + names[j1] + '\'s and ' + names[k1] + '\'s payoffs overlap when we compare them level by level. ' +
        Lv.map(function (_, i) { var u = A[i][j1], w = A[i][k1]; return 'At ' + lv[i] + ', ' + names[j1] + ' pays ' + ft(u) + ' and ' + names[k1] + ' pays ' + ft(w) + (u.isZero() || w.isZero() ? ', so this level adds nothing (one of them pays 0).' : ', so their product is ' + ft(u.mul(w)) + '.'); }).join(' ') +
        ' Adding these gives ' + ft(S[j1][k1]) + '.</p>');
      // difference table
      h7.push('<p><b>The difference between ' + ft(S[j1][j1]) + ' and ' + ft(S[j1][k1]) + '.</b></p>' +
        '<table><tr><th></th><th>Calculation</th><th>Result</th></tr>' +
        '<tr><td>' + names[j1] + ' compared with ' + names[j1] + '</td><td>' + Lv.map(function (_, i) { return ft(A[i][j1]) + '×' + ft(A[i][j1]); }).join(' + ') + '</td><td><b>' + ft(S[j1][j1]) + '</b></td></tr>' +
        '<tr><td>' + names[j1] + ' compared with ' + names[k1] + '</td><td>' + Lv.map(function (_, i) { return ft(A[i][j1]) + '×' + ft(A[i][k1]); }).join(' + ') + '</td><td><b>' + ft(S[j1][k1]) + '</b></td></tr></table>' +
        '<p>Think of it this way:</p><ul><li><b>' + ft(S[j1][j1]) + '</b>: how much do ' + names[j1] + '\'s payoffs multiply with ' + names[j1] + '\'s own payoffs?</li>' +
        '<li><b>' + ft(S[j1][k1]) + '</b>: how much do ' + names[j1] + '\'s payoffs multiply with ' + names[k1] + '\'s payoffs?</li>' +
        '<li>' + (S[j1][k1].isZero() ? 'A result of 0 means they never pay at the same level.' : S[j1][k1].num() >= 0.7 * S[j1][j1].num() ? 'The two numbers are close, so ' + names[k1] + ' pays in much the same scenarios as ' + names[j1] + '.' : 'The second number is much smaller, so ' + names[k1] + ' pays in different scenarios from ' + names[j1] + ' most of the time.') + '</li></ul>');
    }
    // remaining pairs and self-products, compactly
    if (n > 2) {
      var rest = [];
      for (var j = 0; j < n; j++) for (var k = j; k < n; k++) if (!((j === j1 && k === j1) || (j === j1 && k === k1))) rest.push([j, k]);
      h7.push('<p><b>The same for every other pair:</b></p><table><tr><th>Compared</th>' + lv.map(function (L1) { return '<th>At ' + L1 + '</th>'; }).join('') + '<th>Add</th></tr>' +
        rest.map(function (pr) { var j = pr[0], k = pr[1]; return '<tr><td>' + names[j] + ' with ' + names[k] + '</td>' + Lv.map(function (_, i) { return '<td>' + ft(A[i][j]) + '×' + ft(A[i][k]) + ' = ' + ft(A[i][j].mul(A[i][k])) + '</td>'; }).join('') + '<td><b>' + ft(S[j][k]) + '</b></td></tr>'; }).join('') + '</table>');
    }
    // the whole table and the mirror
    h7.push('<p><b>All the results in one table</b> (this table is $A^TA$):</p>' + grid('$A^TA$', names, names, function (j, k) { return '<b>' + ft(S[j][k]) + '</b>'; }));
    if (n > 1) h7.push('<p><b>Why the table is a mirror.</b> "' + names[j1] + ' compared with ' + names[k1] + '" and "' + names[k1] + ' compared with ' + names[j1] + '" multiply the same numbers, just the other way round: ' +
      Lv.map(function (_, i) { return ft(A[i][j1]) + '×' + ft(A[i][k1]) + ' = ' + ft(A[i][k1]) + '×' + ft(A[i][j1]); }).join(', ') + '. So both cells are ' + ft(S[j1][k1]) + ', and the table always reads the same on both sides of its diagonal.</p>');
    h.push(h7.join(''));

    // 8. column space first (complete), then vector space (complete)
    var zeroV = Lv.map(function () { return ZERO; });
    function payOf(lots) { return mulV(A, lots); }
    function lotsTxt(lots) { var parts = lots.map(function (v, j) { return v.isZero() ? null : (v.num() < 0 ? 'sell ' + ft(v.neg()) : ft(v)) + ' ' + names[j]; }).filter(Boolean); return parts.length ? parts.join(' + ') : 'no trade'; }
    function levelSum(lots) { return Lv.map(function (_, i) { var terms = lots.map(function (v, j) { return v.isZero() ? null : fp(v) + '×' + fp(A[i][j]); }).filter(Boolean); return '<li>At ' + lv[i] + ': ' + (terms.length ? terms.join(' + ') : '0') + ' = <b>' + ft(dot(A[i], lots)) + '</b></li>'; }).join(''); }
    var eJ = function (j) { return Lv.map(function (_, k) { return k === j ? ONE : ZERO; }); };
    var l1 = eJ(0), l2 = n > 1 ? eJ(1) : eJ(0), lBoth = l1.map(function (v, i) { return v.add(l2[i]); });
    var p1 = payOf(l1), p2 = payOf(l2), pBoth = payOf(lBoth), l3 = l1.map(function (v) { return v.mul(new Fr(3)); }), lNeg = l1.map(function (v) { return v.neg(); });
    var full = !R.bad.length && !R.free.length && F.zeroPiv < 0, rk = R.rank !== undefined ? R.rank : n;
    var h8 = [];
    h8.push('<h4>8. Which payoffs can you build? Column space, then vector space</h4>');

    // ---- 8a. COLUMN SPACE ----
    h8.push('<h4>8a. Column space</h4>' +
      '<p><b>Definition.</b> The column space $C(A)$ is the collection of all possible combinations of the columns of a particular matrix: <b>all the payoffs you can build from your available products</b>.</p>' +
      '<div class="box intuition"><span class="label">Remember this</span><p>Column space answers the question: <b>what outputs can I produce by combining the columns of this matrix?</b></p><p>If a target vector lies <b>inside</b> the column space, it can be created by some combination of the columns. If it lies <b>outside</b>, it cannot.</p></div>');
    var mixes = [l1, l2, lBoth, l1.map(function (v) { return v.mul(new Fr(2)); }), l1.map(function (v, i) { return v.sub(l2[i]); })];
    if (n === 3) mixes.push(Lv.map(function () { return ONE; }));
    h8.push('<p><b>How the diagram is formed, step by step.</b></p><ol>' +
      '<li><b>Draw each product as an arrow</b> from 0 to its payoff. The axes are the payoffs at ' + lv.join(' / ') + '. ' + names.map(function (nm, j) { return nm + ' pays ' + vec(col(A, j)) + ', so its arrow goes to that point'; }).join('; ') + '.</li>' +
      '<li><b>A mix = walking along the arrows.</b> x lots of ' + names[0] + (n > 1 ? ' then y lots of ' + names[1] : '') + ': walk along ' + names[0] + '\'s arrow x times, then along the next arrow. Where you land is the payoff of that mix:</li></ol>' +
      '<table><tr><th>Mix</th><th>Walk</th><th>Lands at (the payoff)</th></tr>' +
      mixes.map(function (mx) { return '<tr><td>' + lotsTxt(mx) + '</td><td>' + mx.map(function (v, j) { return v.isZero() ? null : fp(v) + '×' + vec(col(A, j)); }).filter(Boolean).join(' + ') + '</td><td><b>' + vec(payOf(mx)) + '</b></td></tr>'; }).join('') + '</table>' +
      '<ol start="3"><li><b>Colour every point you can land on</b>, trying every possible number of lots (including fractions and selling). ' +
        (rk >= n ? 'Your ' + n + ' products point in ' + n + ' different directions, so the landing points fill the <b>whole ' + (n === 2 ? 'plane' : 'space') + '</b>: everything is shaded.' : rk === 2 ? 'Your products only reach a <b>flat sheet</b> through 0 (they point in just 2 different directions), so only that sheet is shaded.' : 'Your products all point along <b>one line</b>, so only that line is shaded.') + '</li>' +
      '<li><b>Put in the client\'s point</b> ' + vec(tgt) + '. ' + (R.bad.length ? 'It is <b>off</b> the shaded part (outside), so no mix lands on it. The red dashed line shows the gap.' : 'It is <b>on</b> the shaded part (inside), so some walk lands on it: ' + lotsTxt(R.x) + ' (the dashed coloured path).') + '</li></ol>' +
      '<figure class="fig plot3d"><div id="lab8b" class="plot3d-box" style="height:460px"></div><figcaption><b>Your column space.</b> Arrows = your products. Shaded = every payoff they can build. Red dot = your client ' + vec(tgt) + (R.bad.length ? ': outside, cannot be built.' : ': inside, reached by ' + lotsTxt(R.x) + '.') + '</figcaption></figure>');
    if (!R.bad.length) h8.push('<p><b>Check the client, level by level:</b></p><ul>' + levelSum(R.x) + '</ul><p>' + lotsTxt(R.x) + ' pays exactly ' + vec(tgt) + ' ✓, so the client is <b>inside</b> $C(A)$.' + (full ? ' In fact every payoff is inside: $C(A) = \\mathbb{R}^' + n + '$.' : '') + '</p>');
    else h8.push('<p><b>The client is outside:</b> elimination ended with a row saying 0 = something non-zero, so no mix of lots pays exactly ' + vec(tgt) + '. The closest possible hedge is in the pricing section.</p>');

    // ---- 8b. VECTOR SPACE ----
    var aV = col(A, 0), bV = n > 1 ? col(A, 1) : null;
    var t = null; if (bV) { var k0 = -1; for (var i2 = 0; i2 < n; i2++) if (!aV[i2].isZero()) { k0 = i2; break; } if (k0 >= 0) { t = bV[k0].div(aV[k0]); if (!aV.every(function (v, i) { return v.mul(t).sub(bV[i]).isZero(); })) t = null; } }
    var half = aV.map(function (v) { return v.div(new Fr(2)); }), two = aV.map(function (v) { return v.mul(new Fr(2)); }), neg1 = aV.map(function (v) { return v.neg(); }), three = aV.map(function (v) { return v.mul(new Fr(3)); });
    h8.push('<h4>8b. Vector space</h4>' +
      '<p><b>Definition.</b> A vector space is a collection of vectors where <b>adding them or scaling them doesn\'t take you outside the collection</b>.</p>' +
      '<p><b>How the diagram is formed, step by step.</b> We build the simplest vector space from your market: all positions in <b>one</b> product, ' + names[0] + '.</p><ol>' +
      '<li><b>Start with 1 lot of ' + names[0] + '</b>: it pays ' + vec(aV) + '. Draw it as an arrow.</li>' +
      '<li><b>Scale it</b> (buy more, buy less, or sell): 2 lots pay ' + vec(two) + '; ½ lot pays ' + vec(half) + '; sell 1 lot (−1×) pays ' + vec(neg1) + '; 0 lots pay ' + vec(zeroV) + '.</li>' +
      '<li><b>All these points fall on one straight line through 0</b> (dashed): each one is ' + vec(aV) + ' times some number, so they all point the same way (or exactly the opposite way).</li>' +
      '<li><b>Add two of them</b>: 1 lot + 2 lots = 3 lots, paying ' + vec(aV) + ' + ' + vec(two) + ' = ' + vec(three) + ': still on the line. <b>Adding and scaling never leave the line, so the line is a vector space.</b></li>' +
      (bV ? '<li><b>Where is ' + names[1] + '?</b> ' + names[1] + ' pays ' + vec(bV) + '. ' + (t ? 'That is ' + ft(t) + ' × ' + names[0] + ', so it is <b>on</b> the line (a copy of ' + names[0] + ').' : 'To be on the line it would have to be ' + names[0] + ' × one number at every level' + (function () { var k = -1; for (var i = 0; i < n; i++) if (!aV[i].isZero()) { k = i; break; } if (k < 0) return ''; var tt = bV[k].div(aV[k]); return ' (at ' + lv[k] + ' that number would be ' + ft(bV[k]) + ' ÷ ' + ft(aV[k]) + ' = ' + ft(tt) + ', but ' + ft(tt) + ' × ' + vec(aV) + ' = ' + vec(aV.map(function (v) { return v.mul(tt); })) + ' ≠ ' + vec(bV) + ')'; })() + '. So ' + names[1] + ' is <b>off</b> the line: one product alone can\'t reach it, you need a second product.') + '</li>' : '') + '</ol>' +
      '<figure class="fig plot3d"><div id="lab8a" class="plot3d-box" style="height:420px"></div><figcaption><b>A vector space: the line of ' + names[0] + '.</b> Dashed = every multiple of ' + names[0] + ' ' + vec(aV) + '. ' + names[0] + ', 2×' + names[0] + ' and −1×' + names[0] + ' (red, selling) all lie on it. ' + (bV ? names[1] + ' (grey) ' + (t ? 'is on it too.' : 'is off it.') : '') + '</figcaption></figure>');
    h8.push('<p><b>The three rules, with your products.</b></p><ul>' +
      '<li><b>Add:</b> 1 ' + names[0] + ' ' + vec(p1) + ' + 1 ' + names[1 % n] + ' ' + vec(p2) + ' = ' + vec(pBoth) + ', which is the payoff of ' + lotsTxt(lBoth) + '. Holding two positions together just adds their lots.</li>' +
      '<li><b>Scale:</b> 3 lots of ' + names[0] + ' pay ' + vec(payOf(l3)) + '; selling 1 lot pays ' + vec(payOf(lNeg)) + '.</li>' +
      '<li><b>Zero:</b> no trade pays ' + vec(zeroV) + '.</li></ul>' +
      '<p><b>So what does this tell us?</b> The column space from 8a passes all three rules, so it is a vector space too: <b>the column space is the vector space your products make</b>. It is not saying every payoff can be built; that is the inside / outside question from 8a.</p>');
    if (!R.bad.length) {
      var X = R.x, pX = payOf(X);
      var cases = [
        { what: '10× your client', b: tgt.map(function (v) { return v.mul(new Fr(10)); }), how: 'multiply the lots by 10', lots: X.map(function (v) { return v.mul(new Fr(10)); }) },
        { what: 'your client + 1 lot of ' + names[0], b: tgt.map(function (v, i) { return v.add(p1[i]); }), how: 'add 1 to ' + names[0] + '\'s lots', lots: X.map(function (v, i) { return v.add(l1[i]); }) },
        { what: 'close your client (the opposite)', b: tgt.map(function (v) { return v.neg(); }), how: 'multiply the lots by −1', lots: X.map(function (v) { return v.neg(); }) },
        { what: 'half your client', b: tgt.map(function (v) { return v.div(new Fr(2)); }), how: 'halve the lots', lots: X.map(function (v) { return v.div(new Fr(2)); }) }
      ];
      h8.push('<h4>8c. Reuse your recipes (what the vector space gives you)</h4><p>Your client ' + vec(tgt) + ' = <b>' + lotsTxt(X) + '</b>. New clients made by adding or scaling this payoff need <b>no new solving</b>: do the same to the lots.</p>' +
        '<table><tr><th>New client</th><th>Wants</th><th>Do this with the lots</th><th>Recipe</th><th>Check (what it pays)</th></tr>' +
        cases.map(function (c) { var pay = payOf(c.lots), ok = pay.every(function (v, i) { return v.sub(c.b[i]).isZero(); }); return '<tr><td>' + c.what + '</td><td>' + vec(c.b) + '</td><td>' + c.how + '</td><td><b>' + lotsTxt(c.lots) + '</b></td><td>' + vec(pay) + ' ' + (ok ? '✓' : '✗') + '</td></tr>'; }).join('') + '</table>' +
        '<p><b>Column space</b> told us the client can be built and how. <b>Vector space</b> lets us reuse that recipe: add, scale, reverse or net payoffs by doing the same to the lots.</p>');
    }
    h8.push('<p><b>The catch: "buy only, never sell".</b> Suppose you are only allowed to buy (lots ≥ 0), like many funds.</p>' +
      '<table><tr><th>Rule</th><th>Example with your products</th><th>Buying and selling allowed</th><th>Buy only</th></tr>' +
      '<tr><td>Add</td><td>1 ' + names[0] + ' + 1 ' + names[1 % n] + ' pays ' + vec(pBoth) + '</td><td>✓</td><td>✓</td></tr>' +
      '<tr><td>Scale by 3</td><td>3 ' + names[0] + ' pays ' + vec(payOf(l3)) + '</td><td>✓</td><td>✓</td></tr>' +
      '<tr><td>Scale by −1</td><td>sell 1 ' + names[0] + ' pays ' + vec(payOf(lNeg)) + '</td><td>✓</td><td><b>✗ needs selling</b></td></tr>' +
      '<tr><td>Zero</td><td>no trade pays ' + vec(zeroV) + '</td><td>✓</td><td>✓</td></tr></table>' +
      '<p>With buy only, the "scale by −1" rule breaks, so buy-only payoffs are <b>not</b> a vector space. On the picture: you could only use the half of the line on ' + names[0] + '\'s side of 0.</p>');
    h.push(h8.join(''));
    tpvPics = { A: A, tgt: tgt, x: (!R.bad.length ? R.x : null), n: n, lv: lv, names: names, rank: R.rank !== undefined ? R.rank : (R.pivots ? R.pivots.length : n), piv: R.pivots || [] };
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

    luPics = null; tpvPics = null; csnPics = null; ax0Pics = null; axbPics = null; ibdPics = null; fsPics = null; csnSub = null; csnAO = null;
    var hh = [], closest = null, invMode = el("replab").hasAttribute("data-inv"), luMode = el("replab").hasAttribute("data-lu"), tpvMode = el("replab").hasAttribute("data-tpv"), csnMode = el("replab").hasAttribute("data-csn"), ax0Mode = el("replab").hasAttribute("data-ax0"), axbMode = el("replab").hasAttribute("data-axb"), ibdMode = el("replab").hasAttribute("data-ibd"), fsMode = el("replab").hasAttribute("data-fs"), msrMode = el("replab").hasAttribute("data-msr"), hhMain = hh;
    if (invMode || luMode || tpvMode || csnMode || ax0Mode || axbMode || ibdMode || fsMode || msrMode) hh = [];   // elimination sections still run (for R, tradeTxt, closest) but are not shown
    hh.push('<h4>4. Elimination, step by step</h4>' + diag + '<p>Start with the augmented matrix (products on the left, client on the right):</p>$$' + augTex(A.map(function (r, i) { return r.concat([tgt[i]]); }), n) + '$$');
    var sn = 1, elimMode = el("replab").hasAttribute("data-elim");
    function matTex(Mx) { return "\\begin{bmatrix}" + Mx.map(function (r) { return r.map(function (v) { return v.tex(); }).join(" & "); }).join(" \\\\ ") + "\\end{bmatrix}"; }
    R.steps.forEach(function (s) {
      if (s.kind === "swap") {
        hh.push('<p><b>Step ' + (sn++) + ' (swap).</b> The pivot spot (row ' + (s.r1 + 1) + ', column ' + (s.col + 1) + ') is 0, but row ' + (s.r2 + 1) + ' has a non-zero number there. Swap rows ' + (s.r1 + 1) + ' and ' + (s.r2 + 1) + ' (just reorder the scenarios):</p>$$' + augTex(s.mat, n) + '$$');
        if (elimMode) hh.push('<p class="lab-emat">As a matrix: the permutation $P_{' + (s.r1 + 1) + (s.r2 + 1) + '} = ' + matTex(s.E) + '$, the identity with rows ' + (s.r1 + 1) + ' and ' + (s.r2 + 1) + ' swapped, multiplying from the left.</p>');
      }
      else if (s.kind === "nopivot") hh.push('<p><b>Step ' + (sn++) + ' (no pivot).</b> Column ' + (s.col + 1) + ' (product ' + names[s.col] + ') has only zeros from row ' + (s.row + 1) + ' down. It adds <b>no new direction</b>: product ' + names[s.col] + ' is a mix of the earlier products. Move on to the next column.</p>');
      else if (s.kind === "zero") hh.push('<p><b>Step ' + (sn++) + '.</b> Row ' + (s.row + 1) + ' already has 0 in column ' + (s.col + 1) + ' (multiplier 0). Nothing to do.</p>');
      else {
        hh.push('<p><b>Step ' + (sn++) + '.</b> Pivot $= ' + s.piv.tex() + '$ (row ' + (s.prow + 1) + '). Number to remove $= ' + s.remove.tex() + '$. Multiplier $= ' + s.remove.tex() + ' \\div ' + s.piv.tex() + ' = ' + s.mult.tex() + '$. Row ' + (s.row + 1) + ' $-\\,' + s.mult.tex() + '\\times$ row ' + (s.prow + 1) + ':</p>');
        hh.push('<table><tr><th></th>' + vars.map(function (v) { return '<th>$' + v + '$</th>'; }).join("") + '<th>client</th></tr>' +
          '<tr><td>Row ' + (s.row + 1) + '</td>' + s.before.map(function (v) { return '<td>$' + v.tex() + '$</td>'; }).join("") + '</tr>' +
          '<tr><td>minus $' + s.mult.tex() + '\\times$ row ' + (s.prow + 1) + '</td>' + s.sub.map(function (v) { return '<td>$' + v.neg().tex() + '$</td>'; }).join("") + '</tr>' +
          '<tr><td><b>New row ' + (s.row + 1) + '</b></td>' + s.after.map(function (v) { return '<td><b>$' + v.tex() + '$</b></td>'; }).join("") + '</tr></table>');
        if (elimMode) hh.push('<p class="lab-emat">As a matrix: $E_{' + (s.row + 1) + (s.prow + 1) + '} = ' + matTex(s.E) + '$: the identity with $' + s.mult.neg().tex() + '$ (minus the multiplier) in row ' + (s.row + 1) + ', column ' + (s.prow + 1) + '. Multiplying by it from the left does exactly this row operation.</p>');
      }
    });
    hh.push('<p>Staircase reached:</p>$$' + augTex(R.M, n) + '$$');
    if (elimMode) {
      var U = R.M.map(function (r) { return r.slice(0, n); });
      var EA = R.Et.map(function (r) { return A[0].map(function (_, j) { return r.reduce(function (sm, v, k) { return sm.add(v.mul(A[k][j])); }, ZERO); }); });
      var okE = EA.every(function (r, i) { return r.every(function (v, j) { return v.sub(U[i][j]).isZero(); }); });
      var stepNames = R.steps.filter(function (st) { return st.E; }).map(function (st) { return st.kind === "swap" ? "P_{" + (st.r1 + 1) + (st.r2 + 1) + "}" : "E_{" + (st.row + 1) + (st.prow + 1) + "}"; });
      hh.push('<div class="box theorem"><span class="label">All the steps as one matrix</span><p>Multiply the step matrices in order (the first step sits closest to $A$):</p>$$E = ' +
        (stepNames.length ? stepNames.slice().reverse().join("\\,") : "I") + ' = ' + matTex(R.Et) + '$$' +
        '<p><b>Check $EA = U$</b> (the staircase):</p>$$' + matTex(R.Et) + matTex(A) + ' = ' + matTex(EA) + (okE ? '\\;✓' : '') + '$$' +
        '<p>The same $E$ also turns the client column $b$ into the new right side: $Eb = ' + vecTex(R.M.map(function (r) { return r[n]; })) + '$.</p></div>');
    }

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
    if (invMode) { hh = hhMain; hh.push(invSections(A, tgt, L, n, vars, names, R, tradeTxt)); }
    if (luMode) { hh = hhMain; hh.push(luSections(A, tgt, L, n, vars, names, R, tradeTxt)); }
    if (tpvMode) { hh = hhMain; hh.push(tpvSections(A, tgt, L, n, vars, names, R, tradeTxt, P)); }
    if (csnMode) { hh = hhMain; hh.push(csnSections(A, tgt, L, n, vars, names, R, tradeTxt, P)); }
    if (ax0Mode) { hh = hhMain; hh.push(ax0Sections(A, tgt, L, n, vars, names, R, tradeTxt, P)); }
    if (axbMode) { hh = hhMain; hh.push(axbSections(A, tgt, L, n, vars, names, R, tradeTxt, P)); }
    if (msrMode) { hh = hhMain; hh.push(msrSections(A, tgt, L, n, vars, names, R, tradeTxt, P)); }
    if (fsMode) { hh = hhMain; hh.push(fsSections(A, tgt, L, n, vars, names, R, tradeTxt, P)); }
    if (ibdMode) { hh = hhMain; hh.push(ibdSections(A, tgt, L, n, vars, names, R, tradeTxt, P)); }

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

    if (!el("replab").hasAttribute("data-elim") && !invMode && !luMode && !tpvMode && !csnMode && !ax0Mode && !axbMode && !ibdMode && !fsMode && !msrMode) hh.push(planeGuide(A, tgt, L, n, vars, names, R));

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

    if (csnMode) hh = hh.map(function (t) { return t.replace('<h4>7. Row picture', '<h4>9. Row picture').replace('<h4>8. Price and arbitrage', '<h4>10. Price and arbitrage'); });
    if (msrMode) hh = hh.map(function (t) { return t.replace('<h4>7. Row picture', '<h4>10. Row picture').replace('<h4>8. Price and arbitrage', '<h4>11. Price and arbitrage'); });
    if (fsMode) hh = hh.map(function (t) { return t.replace('<h4>7. Row picture', '<h4>15. Row picture').replace('<h4>8. Price and arbitrage', '<h4>16. Price and arbitrage'); });
    if (ibdMode) hh = hh.map(function (t) { return t.replace('<h4>7. Row picture', '<h4>10. Row picture').replace('<h4>8. Price and arbitrage', '<h4>11. Price and arbitrage'); });
    if (axbMode) hh = hh.map(function (t) { return t.replace('<h4>7. Row picture', '<h4>13. Row picture').replace('<h4>8. Price and arbitrage', '<h4>14. Price and arbitrage'); });
    if (ax0Mode) hh = hh.map(function (t) { return t.replace('<h4>7. Row picture', '<h4>11. Row picture').replace('<h4>8. Price and arbitrage', '<h4>12. Price and arbitrage'); });
    if (luMode || tpvMode) hh = hh.map(function (t) { return t.replace('<h4>7. Row picture', '<h4>9. Row picture').replace('<h4>8. Price and arbitrage', '<h4>10. Price and arbitrage'); });
    if (invMode) {
      hh = hh.map(function (t) { return t.replace('<h4>7. Row picture', '<h4>10. Row picture').replace('<h4>8. Price and arbitrage', '<h4>11. Price and arbitrage'); });
      var GJ = gaussJordan(A), premI = P.map(function (pr) { return parseFr(pr.p); });
      if (!GJ.singular && !premI.some(function (p) { return p === null; })) hh.push(statePrices(GJ.inv, premI, tgt, L, names, P));
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
    if (!hidden && luMode && luPics && document.getElementById("lablu1")) drawLuPics(luPics);
    if (!hidden && tpvMode && tpvPics && document.getElementById("lab8a")) drawTpvPics(tpvPics);
    if (!hidden && csnMode && csnPics && document.getElementById("lab7cs")) { drawTpvPics(csnPics.cs); drawCsnNull(csnPics.ns); }
    if (!hidden && csnMode && csnSub && document.getElementById("lab7sub")) drawCsnSub(csnSub);
    if (!hidden && csnMode && csnAO && document.getElementById("lab7ao")) drawAndOr(csnAO);
    if (!hidden && ax0Mode && ax0Pics && document.getElementById("labax0")) drawCsnNull(ax0Pics);
    if (!hidden && fsMode && fsPics && document.getElementById("labfsL")) drawFs(fsPics);
    if (!hidden && ibdMode && ibdPics && document.getElementById("labibd")) { drawTpvPics(ibdPics.span); if (ibdPics.nul && document.getElementById("labibdn")) drawCsnNull(ibdPics.nul); if (document.getElementById("labibd2d")) drawIbd2d(); }
    if (!hidden && axbMode && axbPics && document.getElementById("labaxb")) drawCsnNull(axbPics);
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
