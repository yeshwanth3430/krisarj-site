// Learner tracker for learn.krisarj.com
// - every visitor gets a random ID (no name, email or password)
// - lesson pages record progress automatically; progress is kept in this browser
//   and synced to /api/progress so the same ID works on any device
// - the "My tracker" page (tracker.html) shows the progress for an ID
(function () {
  "use strict";

  // ---------------- catalog: what can be tracked ----------------
  var SUBJECTS = [
    { id: "la", name: "Linear Algebra", topics: 15 },
    { id: "svc", name: "Single Variable Calculus", topics: 8 },
    { id: "mvc", name: "Multivariable Calculus", topics: 8 },
    { id: "pr", name: "Probability", topics: 9 },
    { id: "de", name: "Differential Equations", topics: 6 },
    { id: "fin", name: "Maths for Finance", topics: 7 }
  ];
  // key: subject-topic-lesson ; url relative to the site root
  var LESSONS = [
    { key: "la-01-1", subject: "la", topic: 1, topicName: "Vectors & linear equations", title: "The Geometry of Linear Equations", url: "linear-algebra/01_geometry-of-linear-equations.html" },
    { key: "la-02-1", subject: "la", topic: 2, topicName: "Elimination, A = LU & permutations", title: "Elimination with Matrices", url: "linear-algebra/02_elimination-with-matrices.html" },
    { key: "la-02-2", subject: "la", topic: 2, topicName: "Elimination, A = LU & permutations", title: "Factorization into A = LU", url: "linear-algebra/04_factorization-into-a-lu.html" },
    { key: "la-03-1", subject: "la", topic: 3, topicName: "Inverses & transposes", title: "Multiplication and Inverse Matrices", url: "linear-algebra/03_multiplication-and-inverse-matrices.html" }
  ];
  var DONE_AFTER_MS = 2 * 60 * 1000;   // auto-complete: reached the end of the notes and spent 2+ minutes

  // ---------------- small helpers ----------------
  var ALPHA = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  var ID_RE = /^QF-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}$/;
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function newId() {
    var a = new Uint8Array(8), s = "";
    (window.crypto || window.msCrypto).getRandomValues(a);
    for (var i = 0; i < 8; i++) s += ALPHA[a[i] % ALPHA.length];
    return "QF-" + s.slice(0, 4) + "-" + s.slice(4);
  }
  function empty() { return { v: 1, lessons: {}, last: null }; }
  function merge(a, b) {
    var out = empty(), keys = {};
    Object.keys(a.lessons || {}).forEach(function (k) { keys[k] = 1; });
    Object.keys(b.lessons || {}).forEach(function (k) { keys[k] = 1; });
    Object.keys(keys).forEach(function (k) {
      var x = (a.lessons || {})[k], y = (b.lessons || {})[k];
      out.lessons[k] = !x ? y : !y ? x : ((y.u || 0) >= (x.u || 0) ? y : x);
    });
    out.last = !a.last ? b.last : !b.last ? a.last : (b.last.t >= a.last.t ? b.last : a.last);
    return out;
  }
  function fmtDate(t) {
    if (!t) return "";
    var d = new Date(t);
    return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  }
  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;"); }

  // site root, worked out from this script's own URL (works on the live site and from local files)
  var me = document.currentScript && document.currentScript.src;
  var ROOT = me ? me.replace(/assets\/tracker\.js.*$/, "") : "/";
  var API = /^https?:/.test(location.protocol) ? ROOT + "api/progress" : null;

  // ---------------- state ----------------
  var id = lsGet("qf-id");
  if (!ID_RE.test(id || "")) { id = newId(); lsSet("qf-id", id); }
  var state;
  try { state = JSON.parse(lsGet("qf-progress") || "null") || empty(); } catch (e) { state = empty(); }
  if (!state.lessons) state = empty();
  function save() { lsSet("qf-progress", JSON.stringify(state)); }

  var syncTimer = null, syncing = false, statusCb = null;
  function setStatus(s) { if (statusCb) statusCb(s); }
  function pushSoon() { clearTimeout(syncTimer); syncTimer = setTimeout(push, 1200); }
  function push() {
    if (!API) { setStatus("local"); return; }
    syncing = true; setStatus("saving");
    fetch(API, { method: "PUT", keepalive: true, headers: { "content-type": "application/json" }, body: JSON.stringify({ id: id, data: state }) })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
      .then(function (j) { state = merge(state, j.data || empty()); save(); syncing = false; setStatus("saved"); })
      .catch(function () { syncing = false; setStatus("offline"); });
  }
  function pull(forId) {
    if (!API) return Promise.resolve(null);
    return fetch(API + "?id=" + encodeURIComponent(forId), { cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { return j && j.data ? j.data : null; })
      .catch(function () { return null; });
  }

  // record an event for a lesson
  function mark(key, field, value) {
    var l = state.lessons[key] || (state.lessons[key] = {});
    var now = Date.now();
    if (field === "done") l.done = value;            // timestamp, or null after "undo"
    else if (!l[field]) l[field] = now;              // first time only
    else if (field !== "opened") return;             // nothing new to save
    l.u = now;
    state.last = { key: key, t: now };
    save(); pushSoon();
  }

  // ---------------- top bar link (every page) ----------------
  function addTopLink() {
    var bar = document.querySelector(".topbar"); if (!bar || bar.querySelector(".qf-toplink")) return;
    var a = document.createElement("a");
    a.className = "qf-toplink"; a.href = ROOT + "tracker.html"; a.textContent = "My tracker";
    var btn = bar.querySelector(".theme-btn");
    bar.insertBefore(a, btn || null);
  }

  // ---------------- lesson pages ----------------
  function lessonPage(key) {
    var lesson = LESSONS.filter(function (l) { return l.key === key; })[0]; if (!lesson) return;
    mark(key, "opened");
    var t0 = Date.now();

    // lab used: any input change inside the Examples tab
    var ex = document.querySelector('.tab-panel[data-panel="examples"]');
    if (ex) {
      var onLab = function () { mark(key, "lab"); ex.removeEventListener("input", onLab, true); ex.removeEventListener("change", onLab, true); };
      ex.addEventListener("input", onLab, true); ex.addEventListener("change", onLab, true);
    }
    // practice: opening any folded answer
    document.querySelectorAll("details.proof").forEach(function (d) {
      d.addEventListener("toggle", function () { if (d.open) mark(key, "practice"); });
    });

    // completion bar just before the page's prev/next links
    var pager = document.querySelector(".pager");
    var bar = document.createElement("div");
    bar.className = "qf-done";
    function draw() {
      var l = state.lessons[key] || {}, done = !!l.done;
      bar.classList.toggle("is-done", done);
      bar.innerHTML = done
        ? '<span class="qf-tick">✓</span><span class="qf-msg"><b>Lesson completed</b> on ' + fmtDate(l.done) + '. It is saved in your tracker.</span><button type="button" class="qf-btn qf-ghost" data-act="undo">Undo</button><a class="qf-btn" href="' + ROOT + 'tracker.html">My tracker</a>'
        : '<span class="qf-tick qf-open">○</span><span class="qf-msg"><b>Finished this lesson?</b> It is marked automatically when you reach the end, or mark it now.</span><button type="button" class="qf-btn" data-act="done">Mark complete</button><a class="qf-btn qf-ghost" href="' + ROOT + 'tracker.html">My tracker</a>';
    }
    bar.addEventListener("click", function (e) {
      var act = e.target.getAttribute && e.target.getAttribute("data-act"); if (!act) return;
      mark(key, "done", act === "done" ? Date.now() : null); draw();
    });
    draw();
    if (pager) pager.parentNode.insertBefore(bar, pager); else document.querySelector("main").appendChild(bar);

    // auto-complete once the reader reaches the end of the Notes after 2+ minutes
    var notesEnd = document.querySelector('.tab-panel[data-panel="notes"] .summary, .tab-panel[data-panel="notes"] dl.vocab') || bar;
    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (en) {
          if (!en.isIntersecting) return;
          var l = state.lessons[key] || {};
          if (l.done || l.done === null) { io.disconnect(); return; }   // already done, or the reader chose "undo"
          var wait = Math.max(0, DONE_AFTER_MS - (Date.now() - t0));
          setTimeout(function () {
            var l2 = state.lessons[key] || {};
            if (!l2.done && l2.done !== null) { mark(key, "done", Date.now()); draw(); }
          }, wait);
          io.disconnect();
        });
      });
      io.observe(notesEnd);
    }
  }

  // ---------------- tracker page ----------------
  function trackerPage(box) {
    var viewId = id, banner = "";
    var hashId = (location.hash || "").slice(1).toUpperCase();
    var localHasProgress = Object.keys(state.lessons).length > 0;

    function link(forId) { return (ROOT.replace(/\/$/, "") + "/tracker.html#" + forId).replace(/^file:\/\/\/?/, "file:///"); }

    function render(data, note) {
      data = data || empty();
      var L = data.lessons || {};
      var doneCount = LESSONS.filter(function (l) { return L[l.key] && L[l.key].done; }).length;
      var subjRows = SUBJECTS.map(function (s) {
        var lessons = LESSONS.filter(function (l) { return l.subject === s.id; });
        var topics = {};
        lessons.forEach(function (l) { (topics[l.topic] = topics[l.topic] || []).push(l); });
        var topicsDone = Object.keys(topics).filter(function (t) { return topics[t].every(function (l) { return L[l.key] && L[l.key].done; }); }).length;
        var pct = Math.round(100 * topicsDone / s.topics);
        var live = lessons.length;
        return '<div class="qf-subj' + (live ? '' : ' qf-later') + '"><div class="qf-subj-top"><b>' + esc(s.name) + '</b><span>' + topicsDone + ' / ' + s.topics + ' topics · ' + pct + '%</span></div>' +
          '<div class="qf-bar"><i style="width:' + Math.max(pct, topicsDone ? 3 : 0) + '%"></i></div>' +
          (live ? '' : '<div class="qf-sub-note">Not published yet</div>') + '</div>';
      }).join("");
      var rows = LESSONS.map(function (l) {
        var p = L[l.key] || {};
        function c(on, label) { return '<span class="qf-chip' + (on ? ' on' : '') + '">' + (on ? '✓ ' : '') + label + '</span>'; }
        return '<tr><td><a href="' + ROOT + l.url + '">' + esc(l.title) + '</a><div class="qf-small">Topic ' + l.topic + ': ' + esc(l.topicName) + '</div></td>' +
          '<td>' + c(p.opened, "Opened") + c(p.lab, "Lab used") + c(p.practice, "Practice") + c(p.done, "Completed") + '</td>' +
          '<td class="qf-small">' + (p.u ? fmtDate(p.u) : '—') + '</td></tr>';
      }).join("");
      var last = data.last && LESSONS.filter(function (l) { return l.key === data.last.key; })[0];
      var next = LESSONS.filter(function (l) { return !(L[l.key] && L[l.key].done); })[0];
      var cont = last && !(L[last.key] && L[last.key].done) ? last : next;

      box.innerHTML = banner +
        '<div class="qf-idcard">' +
          '<div><div class="qf-k">Your learner ID</div><div class="qf-id">' + esc(viewId) + '</div>' +
          '<div class="qf-small" id="qf-sync">' + (note || "") + '</div></div>' +
          '<div class="qf-actions"><button type="button" class="qf-btn" id="qf-copy">Copy my tracker link</button>' +
          '<button type="button" class="qf-btn qf-ghost" id="qf-use">Use another ID</button></div>' +
          '<form id="qf-useform" class="qf-useform" hidden><input id="qf-useinput" placeholder="QF-XXXX-XXXX" maxlength="12" autocomplete="off"><button class="qf-btn" type="submit">Load</button><span class="qf-small" id="qf-usemsg"></span></form>' +
        '</div>' +
        (cont ? '<a class="qf-continue" href="' + ROOT + cont.url + '"><span class="qf-k">' + (last && cont === last ? 'Continue where you left off' : 'Start here') + '</span><b>' + esc(cont.title) + '</b><span class="qf-small">Topic ' + cont.topic + ': ' + esc(cont.topicName) + '</span></a>'
              : '<div class="qf-continue qf-all"><b>All published lessons completed. New topics are added regularly.</b></div>') +
        '<h2>Overall</h2><p class="qf-small">' + doneCount + ' of ' + LESSONS.length + ' published lessons completed.</p>' +
        '<div class="qf-subjs">' + subjRows + '</div>' +
        '<h2>Lessons</h2><table class="qf-table"><tr><th>Lesson</th><th>Progress</th><th>Last studied</th></tr>' + rows + '</table>' +
        '<div class="box pitfall"><span class="label">Keep your link private</span><p>There is no password. Anyone with your tracker link or ID can see and change this progress, so treat it like a private bookmark. Nothing else is stored: no name, email or phone number.</p></div>';

      document.getElementById("qf-copy").onclick = function () {
        var url = link(viewId), btn = this;
        function ok() { btn.textContent = "Link copied ✓"; setTimeout(function () { btn.textContent = "Copy my tracker link"; }, 1800); }
        if (navigator.clipboard) navigator.clipboard.writeText(url).then(ok, function () { prompt("Copy your link:", url); });
        else prompt("Copy your link:", url);
      };
      var form = document.getElementById("qf-useform");
      document.getElementById("qf-use").onclick = function () { form.hidden = !form.hidden; if (!form.hidden) document.getElementById("qf-useinput").focus(); };
      form.onsubmit = function (e) {
        e.preventDefault();
        var v = document.getElementById("qf-useinput").value.trim().toUpperCase();
        if (!ID_RE.test(v)) { document.getElementById("qf-usemsg").textContent = "That doesn't look like an ID (QF-XXXX-XXXX)."; return; }
        location.hash = v; location.reload();
      };
      if (banner) {
        var y = document.getElementById("qf-adopt");
        if (y) y.onclick = function () { adopt(hashId, true); };
      }
    }

    // switch this device to another ID, carrying this device's progress over
    function adopt(newIdValue, carry) {
      pull(newIdValue).then(function (remote) {
        state = carry ? merge(remote || empty(), state) : (remote || empty());
        id = newIdValue; lsSet("qf-id", id); save(); push();
        viewId = id; banner = "";
        history.replaceState(null, "", "#" + id);
        render(state, "Saved");
      });
    }

    statusCb = function (s) {
      var el = document.getElementById("qf-sync"); if (!el) return;
      el.textContent = { saving: "Saving…", saved: "Saved", offline: "Saved on this device (will sync when online)", local: "Saved on this device" }[s] || "";
    };

    if (ID_RE.test(hashId) && hashId !== id) {
      if (!localHasProgress) { adopt(hashId, false); render(empty(), "Loading…"); return; }
      // this device already has progress under another ID: ask first
      viewId = hashId;
      banner = '<div class="qf-banner">You opened the tracker for <b>' + esc(hashId) + '</b>. This device is using <b>' + esc(id) + '</b>. ' +
        '<button type="button" class="qf-btn" id="qf-adopt">Use ' + esc(hashId) + ' on this device</button>' +
        '<span class="qf-small"> Progress on this device is added to it, nothing is lost.</span></div>';
      render(empty(), "Loading…");
      pull(hashId).then(function (d) { render(d || empty(), d ? "Read only until you switch" : "No progress saved for this ID yet"); });
      return;
    }
    render(state, API ? "Checking…" : "Saved on this device");
    pull(id).then(function (remote) {
      if (remote) { state = merge(state, remote); save(); }
      render(state, API ? "Saved" : "Saved on this device");
      if (Object.keys(state.lessons).length) push();
    });
  }

  // ---------------- start ----------------
  function start() {
    addTopLink();
    var key = document.body.getAttribute("data-lesson");
    if (key) {
      lessonPage(key);
      // bring in progress from other devices for this ID (quietly)
      pull(id).then(function (remote) { if (remote) { state = merge(state, remote); save(); } });
    }
    var box = document.getElementById("qf-tracker");
    if (box) trackerPage(box);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
  window.addEventListener("pagehide", function () { if (syncTimer) { clearTimeout(syncTimer); syncTimer = null; push(); } });
})();
