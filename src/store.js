// Data layer: Supabase (shared, PIN-protected) when configured, otherwise this device only.
import { createClient } from '@supabase/supabase-js';

const URL = import.meta.env.VITE_SUPABASE_URL;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const sb = URL && KEY ? createClient(URL, KEY, { auth: { persistSession: false } }) : null;

export const shared = !!sb;

export const local = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage blocked */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* storage blocked */ } },
};

const LOCAL_KEY = 'lb.entries';

async function rpc(fn, args) {
  const { data, error } = await sb.rpc(fn, args);
  if (error) throw { code: 'network', message: error.message };
  if (!data || !data.ok) throw { code: (data && data.error) || 'unknown' };
  return data;
}

export async function verifyPin(pin) {
  if (!sb) return true;
  await rpc('verify_pin', { p_pin: pin });
  return true;
}

// Returns { "<person>_<date>": row }
export async function loadAll(pin) {
  if (!sb) return local.get(LOCAL_KEY, {});
  const data = await rpc('get_checkins', { p_pin: pin });
  const out = {};
  for (const r of data.rows) out[r.person + '_' + r.date] = r;
  return out;
}

export async function saveRow(pin, row) {
  if (!sb) {
    const all = local.get(LOCAL_KEY, {});
    all[row.person + '_' + row.date] = row;
    local.set(LOCAL_KEY, all);
    return;
  }
  await rpc('save_checkin', { p_pin: pin, p_row: row });
}

/* ---------- meal library, weekly plan, shared settings ---------- */
const LOCAL_APP = 'lb.appdata';

function localApp(defaults) {
  const a = local.get(LOCAL_APP, null);
  return a || { recipes: defaults, plan: [], settings: {} };
}

// Returns { recipes: [{id, t, tubs, m, ing, steps}], plan: [{week, cook, slot, recipe_id}], settings: {} }
export async function loadApp(pin, defaults) {
  if (!sb) return localApp(defaults);
  const data = await rpc('get_app_data', { p_pin: pin });
  return { recipes: data.recipes, plan: data.plan, settings: data.settings || {} };
}

function editLocal(defaults, fn) { const a = localApp(defaults); fn(a); local.set(LOCAL_APP, a); }

export async function saveRecipe(pin, recipe, defaults) {
  if (!sb) {
    editLocal(defaults, (a) => { const i = a.recipes.findIndex((r) => r.id === recipe.id); if (i >= 0) a.recipes[i] = recipe; else a.recipes.push(recipe); });
    return;
  }
  const { id, ...data } = recipe;
  await rpc('save_recipe', { p_pin: pin, p_id: id, p_data: data });
}

export async function deleteRecipe(pin, id, defaults) {
  if (!sb) {
    editLocal(defaults, (a) => { a.recipes = a.recipes.filter((r) => r.id !== id); a.plan = a.plan.filter((p) => p.recipe_id !== id); });
    return;
  }
  await rpc('delete_recipe', { p_pin: pin, p_id: id });
}

export async function setPlan(pin, row, defaults) {
  if (!sb) {
    editLocal(defaults, (a) => { a.plan = a.plan.filter((p) => !(p.week === row.week && p.cook === row.cook && p.slot === row.slot)); a.plan.push(row); });
    return;
  }
  await rpc('set_plan', { p_pin: pin, p_week: row.week, p_cook: row.cook, p_slot: row.slot, p_recipe_id: row.recipe_id });
}

export async function saveSettings(pin, settings, defaults) {
  if (!sb) { editLocal(defaults, (a) => { a.settings = settings; }); return; }
  await rpc('save_settings', { p_pin: pin, p_data: settings });
}
