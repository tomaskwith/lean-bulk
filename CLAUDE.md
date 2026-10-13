# Lean Bulk – project notes for Claude Code

Gym accountability app for Tom and Joe (PureGym Leicester Walnut Street). Public GitHub repo, deployed on Vercel.

## Stack
- Vite + plain HTML/CSS/JS (no framework). Entry: `index.html` → `src/main.js`.
- All plan content (targets, exercises A–E, meals, recipes, shopping) lives in `src/data.js`.
- `src/store.js`: Supabase via `@supabase/supabase-js` when `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` are set; otherwise localStorage-only.
- `supabase/schema.sql`: tables have RLS on with no policies. All access goes through PIN-checked RPCs `verify_pin`, `get_checkins`, `save_checkin` (bcrypt hash in `app_pin`, lockout after 15 bad guesses / 15 min). Never commit the PIN.
- PWA basics: `public/manifest.webmanifest`, icons in `public/`.

## Decisions already made
- Shared PIN login (not per-user auth). Person (tom/joe) is chosen in the app.
- Flexible rest days: sessions run A→E in order on any days; app suggests the next one and warns after 3 training days in a row. Board scores max 5 sessions/week + daily calories, protein, creatine (max 26). Rest days never count as a miss.
- Targets: Tom 3500 kcal / 170 g protein; Joe 3150 kcal / 165 g protein.
- Joe doesn't eat bananas or oats: his breakfast is bacon baps + orange juice. No peppers in any recipe.
- Session B uses the chest fly machine (id kept as `cablefly` so logged history stays linked). Don't rename exercise ids once data exists.
- Keep body stats (heights/weights) out of the repo; it's public.

## Status / next steps
- Not yet on GitHub or deployed. To do: git init + push to a public GitHub repo, create Supabase project (run schema.sql, set PIN), import repo in Vercel with the two env vars, test a check-in.

## Commands
- `npm install`, `npm run dev`, `npm run build`
