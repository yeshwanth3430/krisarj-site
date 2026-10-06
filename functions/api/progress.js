// /api/progress: save and read one learner's study progress, keyed by their random ID.
// No names, emails or passwords are stored: only the ID and lesson progress.
//
//   GET /api/progress?id=QF-XXXX-XXXX   -> { id, data, updated_at }  (data = null if unknown)
//   PUT /api/progress  { id, data }     -> { id, data, updated_at }  (merged with what is stored)

const ALPHA = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const ID_RE = new RegExp("^QF-[" + ALPHA + "]{4}-[" + ALPHA + "]{4}$");
const KEY_RE = /^[a-z0-9-]{1,40}$/;
const FIELDS = ["opened", "lab", "practice", "done", "u"];
const MAX_BODY = 20000;
const MAX_LESSONS = 400;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

// keep only known fields with numeric timestamps (or null for "done" after an undo)
function clean(data) {
  const out = { v: 1, lessons: {}, last: null };
  if (!data || typeof data !== "object") return out;
  const lessons = data.lessons && typeof data.lessons === "object" ? data.lessons : {};
  let n = 0;
  for (const k of Object.keys(lessons)) {
    if (!KEY_RE.test(k) || ++n > MAX_LESSONS) continue;
    const src = lessons[k] || {}, l = {};
    for (const f of FIELDS) {
      const v = src[f];
      if (typeof v === "number" && isFinite(v) && v > 0 && v < 4e12) l[f] = Math.floor(v);
      else if (f === "done" && v === null) l[f] = null;
    }
    if (typeof l.u !== "number") l.u = 0;
    out.lessons[k] = l;
  }
  const last = data.last;
  if (last && typeof last === "object" && KEY_RE.test(last.key || "") && typeof last.t === "number") {
    out.last = { key: last.key, t: Math.floor(last.t) };
  }
  return out;
}

// per lesson, the copy changed most recently wins; "last studied" keeps the newest
function merge(a, b) {
  const out = { v: 1, lessons: {}, last: null };
  const keys = new Set([...Object.keys(a.lessons), ...Object.keys(b.lessons)]);
  for (const k of keys) {
    const x = a.lessons[k], y = b.lessons[k];
    out.lessons[k] = !x ? y : !y ? x : (y.u || 0) >= (x.u || 0) ? y : x;
  }
  out.last = !a.last ? b.last : !b.last ? a.last : (b.last.t >= a.last.t ? b.last : a.last);
  return out;
}

export async function onRequestGet({ request, env }) {
  const id = (new URL(request.url).searchParams.get("id") || "").toUpperCase();
  if (!ID_RE.test(id)) return json({ error: "bad id" }, 400);
  const row = await env.DB.prepare("SELECT data, updated_at FROM progress WHERE id = ?").bind(id).first();
  return json({ id, data: row ? JSON.parse(row.data) : null, updated_at: row ? row.updated_at : null });
}

export async function onRequestPut({ request, env }) {
  const text = await request.text();
  if (text.length > MAX_BODY) return json({ error: "too large" }, 413);
  let body;
  try { body = JSON.parse(text); } catch (e) { return json({ error: "bad json" }, 400); }
  const id = String((body && body.id) || "").toUpperCase();
  if (!ID_RE.test(id)) return json({ error: "bad id" }, 400);

  const incoming = clean(body.data);
  const row = await env.DB.prepare("SELECT data FROM progress WHERE id = ?").bind(id).first();
  const merged = row ? merge(clean(JSON.parse(row.data)), incoming) : incoming;
  const now = Date.now();
  await env.DB.prepare(
    "INSERT INTO progress (id, data, created_at, updated_at) VALUES (?1, ?2, ?3, ?3) " +
    "ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at"
  ).bind(id, JSON.stringify(merged), now).run();
  return json({ id, data: merged, updated_at: now });
}

export async function onRequest() {
  return json({ error: "method not allowed" }, 405);
}
