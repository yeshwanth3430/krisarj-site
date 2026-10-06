// System lab: edit a 2 × 2 or 3 × 3 system Ax = b and see the solution, the row picture and the column picture.
// Usage: SystemLab.mount(element, presets, { steps: true }) once Plotly has loaded; steps: true also lists the elimination steps.
// A preset: { label, cols: [names], rows: [names], A: [[...]], b: [...], meaning: [what each unknown is], neg: "what a negative means" }.
(function () {
  "use strict";
  var TOL = 1e-9;

  function css(v) { return getComputedStyle(document.documentElement).getPropertyValue(v).trim(); }
  function fmt(v) {
    var r = Math.round(v * 1e4) / 1e4;
    if (Object.is(r, -0) || Math.abs(r) < 1e-9) r = 0;
    return (r < 0 ? "−" : "") + Math.abs(r);
  }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function vec(v) { return "(" + v.map(fmt).join(", ") + ")"; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  // Gauss–Jordan on [A | b]: returns rank of A, rank of [A | b], and one solution (free unknowns set to 0) when there is one.
  function solve(A, b) {
    var n = A.length, m = A[0].length;
    var M = A.map(function (row, i) { return row.slice().concat([b[i]]); });
    var scale = Math.max(1, Math.max.apply(null, M.map(function (r) { return Math.max.apply(null, r.map(Math.abs)); })));
    var pivots = [], r = 0;
    for (var c = 0; c < m && r < n; c++) {
      var p = r;
      for (var i = r + 1; i < n; i++) if (Math.abs(M[i][c]) > Math.abs(M[p][c])) p = i;
      if (Math.abs(M[p][c]) < TOL * scale) continue;
      var t = M[p]; M[p] = M[r]; M[r] = t;
      var d = M[r][c];
      for (var k = c; k <= m; k++) M[r][k] /= d;
      for (i = 0; i < n; i++) if (i !== r) {
        var f = M[i][c];
        if (f) for (k = c; k <= m; k++) M[i][k] -= f * M[r][k];
      }
      pivots.push(c); r++;
    }
    var rankA = r, rankAb = r;
    for (i = r; i < n; i++) if (Math.abs(M[i][m]) > TOL * scale) { rankAb = r + 1; break; }
    var x = null;
    if (rankA === rankAb) {
      x = new Array(m).fill(0);
      pivots.forEach(function (c, i) { x[c] = M[i][m]; });
    }
    return { rankA: rankA, rankAb: rankAb, x: x, n: m };
  }


  // Elimination as taught in lecture 2: clear each column below its pivot; exchange rows only when the pivot position is 0.
  function eliminate(A, b) {
    var n = A.length, M = A.map(function (r, i) { return r.slice().concat([b[i]]); }), steps = [], pivots = [];
    var scale = Math.max(1, Math.max.apply(null, M.map(function (r) { return Math.max.apply(null, r.map(Math.abs)); })));
    var zero = function (v) { return Math.abs(v) < TOL * scale; };
    var snap = function () { return M.map(function (r) { return r.slice(); }); };
    for (var c = 0, r = 0; c < n && r < n; c++) {
      if (zero(M[r][c])) {
        var k = -1;
        for (var i = r + 1; i < n; i++) if (!zero(M[i][c])) { k = i; break; }
        if (k < 0) { steps.push({ kind: "stuck", col: c, row: r, M: snap(), piv: pivots.slice() }); continue; }
        var t = M[r]; M[r] = M[k]; M[k] = t;
        steps.push({ kind: "swap", a: r, b: k, M: snap(), piv: pivots.slice() });
      }
      pivots.push([r, c]);
      for (i = r + 1; i < n; i++) {
        var l = M[i][c] / M[r][c];
        if (zero(M[i][c])) continue;
        for (var j = c; j <= n; j++) M[i][j] -= l * M[r][j];
        M[i][c] = 0;
        steps.push({ kind: "elim", row: i, prow: r, l: l, M: snap(), piv: pivots.slice() });
      }
      r++;
    }
    return { M: M, steps: steps, pivots: pivots };
  }
  function tex(v) { var r = Math.round(v * 1e4) / 1e4; if (Math.abs(r) < 1e-9) r = 0; return String(r); }
  function coef(v) { var t = tex(v); return t === "1" ? "" : t === "-1" ? "-" : t; }
  function texAug(M, piv) {
    var n = M.length, isPiv = function (i, j) { return piv.some(function (p) { return p[0] === i && p[1] === j; }); };
    return "\\left[\\begin{array}{" + "c".repeat(n) + "|c}" + M.map(function (row, i) {
      return row.map(function (v, j) { return isPiv(i, j) ? "\\boxed{" + tex(v) + "}" : tex(v); }).join(" & ");
    }).join(" \\\\ ") + "\\end{array}\\right]";
  }

  // The part of the plane n·p = d inside the box, as a flat polygon.
  function planeInBox(n, d, box, color, name) {
    var f = function (p) { return n[0] * p[0] + n[1] * p[1] + n[2] * p[2] - d; };
    var pts = [];
    for (var mm = 0; mm < 8; mm++) {
      var p = [box[0][mm & 1], box[1][(mm >> 1) & 1], box[2][(mm >> 2) & 1]];
      for (var a = 0; a < 3; a++) {
        if ((mm >> a) & 1) continue;
        var q = p.slice(); q[a] = box[a][1];
        var fp = f(p), fq = f(q);
        if (fp === fq || fp * fq > 0) continue;
        var t = fp / (fp - fq), r = [p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1]), p[2] + t * (q[2] - p[2])];
        if (!pts.some(function (s) { return Math.abs(s[0] - r[0]) + Math.abs(s[1] - r[1]) + Math.abs(s[2] - r[2]) < 1e-9; })) pts.push(r);
      }
    }
    if (pts.length < 3) return null;
    var c = [0, 1, 2].map(function (k) { return pts.reduce(function (s, p) { return s + p[k]; }, 0) / pts.length; });
    var u = Math.abs(n[0]) < 0.9 * Math.hypot(n[0], n[1], n[2]) ? [0, -n[2], n[1]] : [-n[2], 0, n[0]];
    var v = [n[1] * u[2] - n[2] * u[1], n[2] * u[0] - n[0] * u[2], n[0] * u[1] - n[1] * u[0]];
    function dot(x, y) { return x[0] * y[0] + x[1] * y[1] + x[2] * y[2]; }
    pts.sort(function (p, q) {
      var dp = [p[0] - c[0], p[1] - c[1], p[2] - c[2]], dq = [q[0] - c[0], q[1] - c[1], q[2] - c[2]];
      return Math.atan2(dot(dp, v), dot(dp, u)) - Math.atan2(dot(dq, v), dot(dq, u));
    });
    var I = [], J = [], K = [];
    for (var k = 1; k < pts.length - 1; k++) { I.push(0); J.push(k); K.push(k + 1); }
    return { type: "mesh3d", name: name, showlegend: true, opacity: 0.45, color: color, flatshading: true, hoverinfo: "name",
      x: pts.map(function (p) { return p[0]; }), y: pts.map(function (p) { return p[1]; }), z: pts.map(function (p) { return p[2]; }), i: I, j: J, k: K };
  }

  function range(values, pad) {
    var lo = Math.min.apply(null, values.concat([0])), hi = Math.max.apply(null, values.concat([0]));
    var span = hi - lo || 1;
    return [lo - span * pad, hi + span * pad];
  }

  function mount(root, presets, opts) {
    opts = opts || {};
    if (!root || !window.Plotly) return;
    var colors = [css("--def-b"), css("--ex-b"), css("--int-b")], red = css("--warn-b"), ink = css("--ink"), soft = css("--ink-soft"), rule = css("--rule");
    var config = { responsive: true, displaylogo: false, modeBarButtonsToRemove: ["toImage"] };

    root.innerHTML =
      '<div class="lab-controls">' +
        '<div class="lab-row"><label>Example <select class="sl-pick">' +
          presets.map(function (p, i) { return '<option value="' + i + '">' + esc(p.label) + "</option>"; }).join("") +
        '</select></label><button type="button" class="lab-btn sl-reset">Reset numbers</button></div>' +
        '<div class="sl-grid"></div>' +
      "</div>" +
      '<div class="sl-out"></div>' +
      (opts.steps ? '<details class="check sl-steps-box" open><summary>Elimination, step by step</summary><div class="sl-steps"></div></details>' : "") +
      '<div class="figs sl-plots">' +
        '<figure class="fig"><div class="plot3d-box sl-row"></div><figcaption>Row picture: one line (or plane) per rule.</figcaption></figure>' +
        '<figure class="fig"><div class="plot3d-box sl-col"></div><figcaption>Column picture: mix the columns to reach b.</figcaption></figure>' +
      "</div>";
    var pick = root.querySelector(".sl-pick"), grid = root.querySelector(".sl-grid"), out = root.querySelector(".sl-out");
    var rowDiv = root.querySelector(".sl-row"), colDiv = root.querySelector(".sl-col"), stepsDiv = root.querySelector(".sl-steps");
    var P, lastN = 0;

    function build() {
      P = presets[+pick.value];
      var n = P.A.length, h = '<table class="lab-table sl-table"><tr><th></th>';
      P.cols.forEach(function (c, j) { h += '<th style="color:' + colors[j] + '">' + esc(c) + "</th>"; });
      h += "<th></th><th>target b</th></tr>";
      for (var i = 0; i < n; i++) {
        h += "<tr><th>" + esc(P.rows[i]) + "</th>";
        for (var j = 0; j < n; j++) h += '<td><input type="number" step="any" data-i="' + i + '" data-j="' + j + '" value="' + P.A[i][j] + '"></td>';
        h += '<td>=</td><td><input type="number" step="any" data-b="' + i + '" value="' + P.b[i] + '"></td></tr>';
      }
      grid.innerHTML = h + "</table>";
      update();
    }

    function read() {
      var n = P.A.length, A = [], b = [];
      for (var i = 0; i < n; i++) { A.push([]); for (var j = 0; j < n; j++) A[i].push(0); b.push(0); }
      grid.querySelectorAll("input").forEach(function (el) {
        var v = parseFloat(el.value); if (!isFinite(v)) v = 0;
        if (el.dataset.b !== undefined) b[+el.dataset.b] = v; else A[+el.dataset.i][+el.dataset.j] = v;
      });
      return { A: A, b: b };
    }

    function update() {
      var S = read(), A = S.A, b = S.b, n = A.length, R = solve(A, b);
      var col = function (j) { return A.map(function (r) { return r[j]; }); };
      var h = "";
      if (R.rankA === n) {
        h += '<p><b class="answer">One solution.</b> The columns point in ' + n + " different directions, so the matrix is invertible.</p><ul>";
        R.x.forEach(function (v, j) { h += "<li>" + esc(cap(P.meaning[j])) + ": <b>" + fmt(v) + "</b></li>"; });
        h += "</ul>";
        if (R.x.some(function (v) { return v < -1e-9; }) && P.neg) h += '<p class="note-soft">A negative amount means: ' + esc(P.neg) + ".</p>";
        h += "<p><b>Column check:</b> " + R.x.map(function (v, j) { return fmt(v) + " × " + vec(col(j)); }).join(" + ") + " = " + vec(b) + " ✓</p>";
      } else if (R.rankAb > R.rankA) {
        h += '<p class="lab-warn"><b>No solution.</b> The matrix is singular: its columns fill only a ' + (R.rankA === 0 ? "point" : R.rankA === 1 ? "line" : "plane") +
          ", and this target b is not on it. No mix of these columns reaches b.</p>";
      } else {
        h += '<p class="lab-warn"><b>Infinitely many solutions.</b> The matrix is singular, but this b happens to lie in its column space, so many different mixes work.</p>' +
          "<p>One of them: " + R.x.map(function (v, j) { return esc(P.meaning[j]) + " = " + fmt(v); }).join("; ") + ".</p>";
      }
      out.innerHTML = h;
      if (stepsDiv) {
        var E = eliminate(A, b), names = ["x", "y", "z"], sh = "<ol class=\"sl-steplist\">";
        sh += "<li>Start with the augmented matrix $[A \\mid b]$: $" + texAug(A.map(function (r, i) { return r.concat([b[i]]); }), []) + "$</li>";
        E.steps.forEach(function (st) {
          if (st.kind === "elim") sh += "<li>Row " + (st.row + 1) + " − (" + fmt(st.l) + ") × row " + (st.prow + 1) + ": multiplier $\\ell_{" + (st.row + 1) + (st.prow + 1) + "} = " + tex(st.l) + "$. $" + texAug(st.M, st.piv) + "$</li>";
          else if (st.kind === "swap") sh += "<li><b>Row exchange:</b> 0 in the pivot position, so swap rows " + (st.a + 1) + " and " + (st.b + 1) + ". $" + texAug(st.M, st.piv) + "$</li>";
          else sh += '<li class="lab-warn"><b>Stuck:</b> 0 in the pivot position of column ' + (st.col + 1) + " and no non-zero entry below it. No pivot here, so the matrix is singular.</li>";
        });
        if (E.pivots.length === n) {
          sh += "<li>Upper triangular: $Ux = c$ with pivots " + E.pivots.map(function (p) { return fmt(E.M[p[0]][p[1]]); }).join(", ") + ". <b>Back substitution</b>, from the bottom row up:<ul>";
          var x = new Array(n).fill(0);
          for (var i = n - 1; i >= 0; i--) {
            var rest = 0, terms = [];
            for (var j = i + 1; j < n; j++) { rest += E.M[i][j] * x[j]; if (Math.abs(E.M[i][j]) > 1e-12) terms.push(tex(E.M[i][j]) + "(" + tex(x[j]) + ")"); }
            x[i] = (E.M[i][n] - rest) / E.M[i][i];
            sh += "<li>$" + coef(E.M[i][i]) + names[i] + (terms.length ? " + " + terms.join(" + ") : "") + " = " + tex(E.M[i][n]) + " \\;\\Rightarrow\\; " + names[i] + " = " + tex(x[i]) + "$</li>";
          }
          sh += "</ul></li>";
        }
        stepsDiv.innerHTML = sh.replace(/\+ -/g, "- ") + "</ol>";
        if (window.renderMathInElement) renderMathInElement(stepsDiv, { delimiters: [{ left: "$", right: "$", display: false }], throwOnError: false });
      }
      if (n !== lastN) { Plotly.purge(rowDiv); Plotly.purge(colDiv); lastN = n; }   // 2D <-> 3D needs a fresh plot
      if (window.renderMathInElement) renderMathInElement(out, { delimiters: [{ left: "$", right: "$", display: false }], throwOnError: false });
      if (n === 2) draw2(A, b, R); else draw3(A, b, R);
    }

    var base2 = function (xt, yt) {
      return { margin: { l: 50, r: 10, t: 10, b: 50 }, paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(0,0,0,0)", showlegend: true,
        legend: { orientation: "h", x: 0, y: -0.2, font: { color: ink, size: 11 } }, font: { color: ink },
        xaxis: { title: { text: xt }, gridcolor: rule, zerolinecolor: soft, color: soft },
        yaxis: { title: { text: yt }, gridcolor: rule, zerolinecolor: soft, color: soft } };
    };

    function draw2(A, b, R) {
      // row picture: one line per rule, around the solution
      var c0 = R.x || [0, 0], hw = Math.max(4, 1.5 * Math.max(Math.abs(c0[0]), Math.abs(c0[1])));
      var xr = [c0[0] - hw, c0[0] + hw], yr = [c0[1] - hw, c0[1] + hw], traces = [];
      A.forEach(function (r, i) {
        var name = P.rows[i] + ": " + fmt(r[0]) + "x + " + fmt(r[1]) + "y = " + fmt(b[i]);
        if (Math.abs(r[1]) > TOL) traces.push({ x: xr, y: xr.map(function (x) { return (b[i] - r[0] * x) / r[1]; }), mode: "lines", name: name, line: { color: colors[i], width: 3 } });
        else if (Math.abs(r[0]) > TOL) traces.push({ x: [b[i] / r[0], b[i] / r[0]], y: yr, mode: "lines", name: name, line: { color: colors[i], width: 3 } });
      });
      if (R.rankA === 2) traces.push({ x: [R.x[0]], y: [R.x[1]], mode: "markers+text", name: "solution", marker: { color: red, size: 11 }, text: [vec(R.x)], textposition: "top right", textfont: { color: red } });
      var L = base2(P.cols[0], P.cols[1]); L.xaxis.range = xr; L.yaxis.range = yr;
      Plotly.react(rowDiv, traces, L, config);

      // column picture: walk the columns (or just show them when there is no single answer)
      var c1 = [A[0][0], A[1][0]], c2 = [A[0][1], A[1][1]], ct = [], anns = [], pts = [b];
      function leg(a, z, color, name, dash) {
        ct.push({ x: [a[0], z[0]], y: [a[1], z[1]], mode: "lines", name: name, line: { color: color, width: dash ? 2 : 4, dash: dash ? "dash" : "solid" } });
        if (!dash) anns.push({ x: z[0], y: z[1], ax: a[0], ay: a[1], xref: "x", yref: "y", axref: "x", ayref: "y", showarrow: true, arrowhead: 3, arrowsize: 1.2, arrowwidth: 3, arrowcolor: color, text: "" });
        pts.push(a, z);
      }
      if (R.rankA === 2) {
        var m1 = [R.x[0] * c1[0], R.x[0] * c1[1]];
        leg([0, 0], m1, colors[0], fmt(R.x[0]) + " × " + P.cols[0]);
        leg(m1, b, colors[1], "+ " + fmt(R.x[1]) + " × " + P.cols[1]);
        leg([0, 0], b, red, "target b", true);
      } else {
        leg([0, 0], c1, colors[0], P.cols[0] + " " + vec(c1));
        leg([0, 0], c2, colors[1], P.cols[1] + " " + vec(c2));
        var dir = Math.hypot(c1[0], c1[1]) > TOL ? c1 : c2;
        if (Math.hypot(dir[0], dir[1]) > TOL) {
          var big = 3 * Math.max(Math.hypot(b[0], b[1]), Math.hypot(dir[0], dir[1])) / Math.hypot(dir[0], dir[1]);
          ct.push({ x: [-big * dir[0], big * dir[0]], y: [-big * dir[1], big * dir[1]], mode: "lines", name: "everything reachable", line: { color: colors[0], width: 10 }, opacity: 0.18 });
        }
      }
      ct.push({ x: [b[0]], y: [b[1]], mode: "markers+text", name: "b = " + vec(b), marker: { color: red, size: 11 }, text: ["b"], textposition: "top right", textfont: { color: red } });
      var Lc = base2(P.rows[0], P.rows[1]);
      Lc.xaxis.range = range(pts.map(function (p) { return p[0]; }), 0.15); Lc.yaxis.range = range(pts.map(function (p) { return p[1]; }), 0.15);
      Lc.annotations = anns;
      Plotly.react(colDiv, ct, Lc, config);
    }

    function scene3(r, titles) {
      function ax(i) { return { title: { text: titles[i] }, range: r[i], autorange: false, gridcolor: rule, color: soft }; }
      return { xaxis: ax(0), yaxis: ax(1), zaxis: ax(2), dragmode: "turntable", camera: { eye: { x: 1.6, y: -1.6, z: 0.9 } } };
    }
    var base3 = function () {
      return { margin: { l: 0, r: 0, t: 0, b: 60 }, paper_bgcolor: "rgba(0,0,0,0)", showlegend: true, uirevision: "keep",
        legend: { orientation: "h", x: 0, y: -0.02, yanchor: "top", font: { color: ink, size: 11 } } };
    };

    function draw3(A, b, R) {
      // row picture: three planes in a box around the solution
      var traces = [];
      if (R.rankA === 3) {
        var hw = Math.max(2, 0.6 * Math.max.apply(null, R.x.map(Math.abs)));
        var box = R.x.map(function (v) { return [v - hw, v + hw]; });
        A.forEach(function (r, i) {
          var pl = planeInBox(r, b[i], box, colors[i], P.rows[i]);
          if (pl) traces.push(pl);
        });
        traces.push({ type: "scatter3d", mode: "markers+text", name: "solution " + vec(R.x), marker: { color: red, size: 6 }, x: [R.x[0]], y: [R.x[1]], z: [R.x[2]], text: [vec(R.x)], textposition: "top center", textfont: { color: red } });
        var L = base3(); L.scene = scene3(box, P.cols);
        Plotly.react(rowDiv, traces, L, config);
      } else {
        Plotly.react(rowDiv, [], { paper_bgcolor: "rgba(0,0,0,0)", xaxis: { visible: false }, yaxis: { visible: false }, meta: { noFrame: true },
          annotations: [{ text: "No single meeting point to draw: the planes don't meet in exactly one point.", showarrow: false, font: { color: soft, size: 13 }, xref: "paper", yref: "paper", x: 0.5, y: 0.5 }] }, config);
      }
      // column picture: walk the three columns to b
      var ct = [], pts = [[0, 0, 0], b];
      function leg(a, z, color, name, dash) {
        ct.push({ type: "scatter3d", mode: dash ? "lines" : "lines+markers", name: name, line: { color: color, width: dash ? 4 : 8, dash: dash ? "dash" : "solid" },
          marker: { size: [2, 5], color: color }, x: [a[0], z[0]], y: [a[1], z[1]], z: [a[2], z[2]] });
        pts.push(z);
      }
      var cols = [0, 1, 2].map(function (j) { return A.map(function (r) { return r[j]; }); });
      if (R.rankA === 3) {
        var at = [0, 0, 0];
        cols.forEach(function (c, j) {
          var nx = [at[0] + R.x[j] * c[0], at[1] + R.x[j] * c[1], at[2] + R.x[j] * c[2]];
          leg(at, nx, colors[j], (j ? "+ " : "") + fmt(R.x[j]) + " × " + P.cols[j]);
          at = nx;
        });
        leg([0, 0, 0], b, red, "target b", true);
      } else {
        cols.forEach(function (c, j) { leg([0, 0, 0], c, colors[j], P.cols[j] + " " + vec(c)); });
      }
      ct.push({ type: "scatter3d", mode: "markers+text", name: "b = " + vec(b), marker: { color: red, size: 6 }, x: [b[0]], y: [b[1]], z: [b[2]], text: ["b"], textposition: "top center", textfont: { color: red } });
      var r3 = [0, 1, 2].map(function (k) { return range(pts.map(function (p) { return p[k]; }), 0.1); });
      var Lc = base3(); Lc.scene = scene3(r3, P.rows);
      Plotly.react(colDiv, ct, Lc, config);
    }

    pick.addEventListener("change", build);
    root.querySelector(".sl-reset").addEventListener("click", build);
    grid.addEventListener("input", update);
    build();
  }

  window.SystemLab = { mount: mount, solve: solve, eliminate: eliminate };
})();
