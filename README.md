# Tom & Joe Lean Bulk

Our gym accountability app: a 5-session training plan for PureGym Leicester Walnut Street, fakeaway meal prep, a shopping list, and a shared daily check-in board so we can see who's slacking.

- **Check in** – log each set (kg × reps, last session's numbers shown greyed out), morning weight, calories, protein, creatine.
- **Flexible rest days** – sessions run A → E on whatever days suit. The app suggests the next one and warns after 3 days in a row.
- **Board** – weekly score out of 26 (5 sessions + calories, protein and creatine every day), bodyweight chart, lift history.
- Works as a home-screen app on iPhone/Android (Share → Add to Home Screen).

Plain HTML/CSS/JS built with Vite. Check-ins are stored in Supabase and protected by a shared PIN.

## Setup (one time, ~10 minutes)

### 1. Supabase (database)

1. Create a free project at [supabase.com](https://supabase.com). Pick the London region.
2. Go to **SQL Editor → New query**, paste everything in [`supabase/schema.sql`](supabase/schema.sql) and press **Run**.
3. Set the crew PIN. In a new query, run this with your own PIN (use 6+ characters, something like a phrase):

   ```sql
   insert into app_pin (id, pin_hash)
   values (1, extensions.crypt('YOUR-PIN-HERE', extensions.gen_salt('bf')))
   on conflict (id) do update set pin_hash = excluded.pin_hash;
   ```

   Only a hash is stored. Run it again any time to change the PIN. **Never put the PIN in this repo.**
4. Go to **Project Settings → API** and copy the **Project URL** and the **anon public** key.

### 2. Vercel (hosting)

1. On [vercel.com](https://vercel.com), **Add New → Project** and import this GitHub repo. It detects Vite on its own.
2. Before deploying, open **Environment Variables** and add:
   - `VITE_SUPABASE_URL` = the Project URL
   - `VITE_SUPABASE_ANON_KEY` = the anon public key
3. Deploy. Every push to `main` redeploys automatically.

If you add or change the variables later, redeploy (Deployments → ⋯ → Redeploy) so they're baked into the build.

## Run it locally

```bash
npm install
cp .env.example .env.local   # fill in the two values
npm run dev
```

Without the `.env.local` values the app still runs, but check-ins only save in that browser.

## Changing the plan

Everything (targets, exercises, meals, shopping list) is in [`src/data.js`](src/data.js). Edit, commit, push, and Vercel redeploys.

## Security

- The site and the anon key are public by design. The tables have row-level security turned on with no policies, so the anon key can't read or write them directly.
- All reads and writes go through `verify_pin`, `get_checkins` and `save_checkin`, which check the PIN against a bcrypt hash. 15 wrong guesses in 15 minutes locks it for everyone for 15 minutes.
- The PIN is remembered on each phone after the first unlock. "Lock this phone" at the bottom of the Why tab forgets it.
