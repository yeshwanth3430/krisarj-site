# Quant from First Principles (learn.krisarj.com)

The maths behind the markets, explained from zero, with interactive Nifty options labs and a personal progress tracker.

## Layout
- `public/`: the website (published as-is)
  - `index.html`: home (Roadmap + Subjects tabs)
  - `tracker.html`: "My tracker" page
  - `linear-algebra/`: topic pages and lessons (`<body data-lesson="la-01-1">` marks a tracked lesson)
  - `assets/`: notebook.css, site.css, notebook.js, roadmap.js, tracker.js, labs
- `functions/api/progress.js`: GET/PUT `/api/progress` (Cloudflare Pages Function)
- `schema.sql`: D1 table (`progress`: id, data JSON, created_at, updated_at)
- `wrangler.toml`: Pages project + D1 binding `DB` (database `krisarj-learn`)

## Deploy
```
npx wrangler pages deploy --project-name krisarj-site --branch main --commit-dirty=true
```

## Adding a lesson to the tracker
1. Add `data-lesson="<subject>-<topic>-<lesson>"` to the lesson page's `<body>` and include `assets/tracker.js`.
2. Add the lesson to `LESSONS` in `public/assets/tracker.js`.
3. Flip its status in `public/assets/roadmap.js`.

The Linear Algebra notes follow MIT OpenCourseWare 18.06 (Prof. Gilbert Strang), used under CC BY-NC-SA 4.0; this site's content is shared under the same licence. Educational only, not investment advice. The tracker stores only a random ID and lesson progress: no names, emails or passwords.
