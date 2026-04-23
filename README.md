# Scifair Live — voting console

Live QR-code voting for a science fair. React + Vite + Tailwind. Deploys as a static SPA to Vercel, Netlify, or any static host. Optional Supabase backend for real cross-device live voting.

---

## Features

- **Four views**, all routed by URL hash (`/#/display`, `/#/vote`, `/#/qr`, `/#/admin`)
- **Big-screen leaderboard** with animated rank bars, rank flashes on new votes, "tight races" panel, and a vote stream
- **Per-project QR codes** that deep-link to `/#/vote?p=<project_id>` and auto-open the confirm dialog for that project
- **One vote per device** enforced via a voter ID in `localStorage`
- **Ambient animations**: drifting atoms with orbiting electrons, periodically launching rockets, twinkling sparkles — all subtle, all respect `prefers-reduced-motion`
- **Storage abstraction**: falls back to `localStorage` if no backend configured; flips to Supabase realtime the moment you add env vars

---

## 1. Local development

```bash
npm install
npm run dev
```

Dev server runs on `http://localhost:5173`. It also listens on your LAN (Vite is configured with `host: true`) so you can point a phone at `http://<your-machine-ip>:5173` and test QR scanning from another device — but **read section 4 first** about the sync limitation in local mode.

Build a production bundle:

```bash
npm run build
npm run preview   # serves dist/ on port 4173
```

---

## 2. Deploy to Vercel

### Option A — CLI

```bash
npm i -g vercel
vercel          # first deploy: preview
vercel --prod   # production deploy
```

### Option B — GitHub connect

1. Push this folder to a GitHub repo.
2. Go to [vercel.com/new](https://vercel.com/new), import the repo.
3. Vercel auto-detects Vite. No config changes needed — `vercel.json` handles the SPA rewrite.

### Env vars on Vercel (for live sync — see section 4)

Project Settings → Environment Variables, add:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Then redeploy.

---

## 3. Deploy to Netlify

### Option A — CLI

```bash
npm i -g netlify-cli
netlify init        # first time — connect or create site
netlify deploy --build              # preview
netlify deploy --build --prod       # production
```

### Option B — drag & drop

```bash
npm run build
```

Drag the `dist/` folder onto [app.netlify.com/drop](https://app.netlify.com/drop).

### Option C — GitHub connect

1. Push to GitHub.
2. [app.netlify.com](https://app.netlify.com) → Add new site → Import from Git.
3. Build settings are picked up from `netlify.toml`. No manual config needed.

### Env vars on Netlify

Site settings → Environment variables → add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, then redeploy.

---

## 4. ⚠️ CRITICAL — the cross-device sync limitation

**Without a backend, this app is single-device only.** Each browser has its own copy of `localStorage`. If you deploy to Vercel/Netlify with no env vars set:

- Attendee A votes on their phone → only A's phone sees that vote
- Attendee B votes on their phone → only B's phone sees that vote
- Your big display (likely on a laptop) sees **zero votes from anyone else**

This is useless for an actual science fair. For any real event, set up Supabase (section 5) or swap in a different backend.

The admin view shows a yellow **"LOCAL mode"** warning when running without a backend, so you'll know.

---

## 5. Set up Supabase (free, ~10 minutes)

### 5a. Create a project

1. Go to [supabase.com](https://supabase.com), sign up (free tier is enough).
2. Create a new project. Pick a region close to your event.
3. Wait ~2 minutes for it to provision.

### 5b. Create the `kv` table

In the Supabase dashboard → SQL Editor → New query, paste and run:

```sql
-- Simple key-value table for the voting app
create table if not exists public.kv (
  key   text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

-- Allow anyone to read/write (fine for an anonymous voting demo;
-- tighten with RLS policies for production if needed).
alter table public.kv enable row level security;

create policy "read kv for all" on public.kv
  for select using (true);

create policy "write kv for all" on public.kv
  for insert with check (true);

create policy "update kv for all" on public.kv
  for update using (true) with check (true);

-- Enable Postgres realtime for live updates
alter publication supabase_realtime add table public.kv;
```

### 5c. Copy your keys

Project Settings → API → copy:

- **Project URL** → this is your `VITE_SUPABASE_URL`
- **anon public** key → this is your `VITE_SUPABASE_ANON_KEY`

The `anon` key is safe to embed in the frontend; it's what the RLS policies above are designed around.

### 5d. Add to your environment

Local dev:

```bash
cp .env.example .env
# then edit .env and fill in the two values
```

Vercel / Netlify: add them in project env var settings (see sections 2 and 3), then redeploy.

### 5e. Verify

Open the deployed site on two different devices. Vote on one — the other should update within a second or two. The nav bar indicator should read **`LIVE`** (green) instead of **`LOCAL`** (yellow).

---

## 6. How QR codes work

- The `QR Codes` view builds a URL from `window.location.origin` + `#/vote?p=<project_id>`.
- The QR image is generated by the public `api.qrserver.com` endpoint — no API key, no cost, no dependency.
- Scanning the QR opens the voting page and pre-selects the right project's confirm dialog.
- When you deploy to a public domain, the URL in the QR updates automatically. No code changes needed.

---

## 7. Known limitations (read before your event)

| Limitation | What it means | How to fix for production |
|---|---|---|
| One vote per device via `localStorage` | Attendees can clear storage / use another phone / use incognito to vote again | Issue pre-printed unique attendee tokens (each QR ticket encodes `?token=xyz`); validate the token server-side and mark it used. Requires real backend logic. |
| Last-write-wins on concurrent votes | If two votes arrive in the same ~100ms window, one may be lost | Use a proper append-only `votes` table with a `(project_id, voter_id)` unique constraint instead of the current JSON-blob-in-`kv` pattern |
| `api.qrserver.com` is a third-party service | If it goes down the night of your fair, QR codes break | Pre-generate and save QR PNGs ahead of time, or use a JS QR library (e.g. `qrcode`) to generate locally |
| Public `anon` key + permissive RLS | Anyone with the URL can stuff the ballot box from the dev console | For a serious event, proxy writes through a Supabase Edge Function that rate-limits per IP and validates attendee tokens |

---

## 8. Project structure

```
scifair-live/
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── vercel.json                   # SPA rewrites for Vercel
├── netlify.toml                  # SPA rewrites + build config for Netlify
├── .env.example                  # copy to .env and fill in to enable Supabase
├── .gitignore
├── README.md
└── src/
    ├── main.jsx                  # React entry
    ├── App.jsx                   # the whole app
    ├── index.css                 # Tailwind + reduced-motion + scrollbar
    └── storage.js                # pluggable storage adapter (localStorage ↔ Supabase)
```

---

## 9. The single-vote enforcement — exactly what it does and doesn't do

The current implementation:

1. On first load, generates a random `voterId` and stashes it in `localStorage`.
2. Every vote includes this `voterId`.
3. The vote UI checks `votes.some(v => v.voterId === myId)` before allowing a new vote.

What this **catches**: a voter tapping "vote" twice in the same browser.

What it **does not catch**:
- Same voter on a second phone
- Same voter in a private/incognito window
- Same voter after clearing site data
- A savvy voter editing localStorage or directly writing to Supabase from the console

If your fair is casual (school event, honor system), this is fine. If there's a prize or politics involved, you need pre-printed unique attendee tokens — there is no way around this without authentication.
