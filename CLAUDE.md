# Lean Bulk – project notes for Claude Code

Gym accountability app for Tom and Joe (PureGym Leicester Walnut Street). Public GitHub repo, deployed on Vercel.

## Stack
- Vite + plain HTML/CSS/JS (no framework). Entry: `index.html` → `src/main.js`.
- `src/data.js`: default targets, exercises A–E, daily meal template, cook definitions, starter recipes (only used without a database) and weekly staples.
- Meal library, weekly meal plan and target overrides live in Supabase (`recipes`, `meal_plan`, `app_settings`) and are edited in the app. A week with no plan rows inherits the latest earlier pick, else `DEFAULT_PLAN`.
- `src/store.js`: Supabase via `@supabase/supabase-js` when `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` are set; otherwise localStorage-only.
- `supabase/schema.sql`: tables have RLS on with no policies. All access goes through PIN-checked RPCs (`verify_pin`, `get_checkins`, `save_checkin`, `get_app_data`, `save_recipe`, `delete_recipe`, `set_plan`, `save_settings`). schema.sql is idempotent; re-run it after schema changes (bcrypt hash in `app_pin`, lockout after 15 bad guesses / 15 min). Never commit the PIN.
- Mobile-first: bottom tab bar (Check in, Board, Training, Food, Shopping), settings behind the cog. Sticky save bar on check-in.
- PWA basics: `public/manifest.webmanifest`, icons in `public/`.

## Decisions already made
- Shared PIN login (not per-user auth). Person (tom/joe) is chosen in the app.
- Flexible rest days: sessions run A→E in order on any days; app suggests the next one and warns after 3 training days in a row. Board scores max 5 sessions/week + daily calories, protein, creatine (max 26). Rest days never count as a miss, and nor do days before a person's first check-in. Loser of the week buys the chicken (ledger on the Board).
- Default targets: Tom 3500 kcal / 170 g protein; Joe 3150 kcal / 165 g protein. Can be overridden in Settings (stored in `app_settings`); past days are re-scored.
- Joe doesn't eat bananas or oats: his breakfast is bacon baps + orange juice. No peppers in any recipe.
- Session B uses the chest fly machine (id kept as `cablefly` so logged history stays linked). Don't rename exercise ids once data exists.
- Keep body stats (heights/weights) out of the repo; it's public.

## Status / next steps
- Live: GitHub tomaskwith/lean-bulk (public), Vercel https://lean-bulk-ruby.vercel.app, Supabase project in eu-west-1. Every push to main redeploys.

## Commands
- `npm install`, `npm run dev`, `npm run build`
