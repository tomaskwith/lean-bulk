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
