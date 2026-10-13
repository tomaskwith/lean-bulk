import { PEOPLE, ORDER, PROGRAM, VOLUME, MEALS, COOKS, DEFAULT_PLAN, RECIPES, SHOP } from './data.js';
import { shared, local, verifyPin, loadAll, saveRow, loadApp, saveRecipe, deleteRecipe, setPlan, saveSettings } from './store.js';

const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* ---------- dates (local time) ---------- */
const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const todayISO = () => iso(new Date());
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const mondayOf = (d) => addDays(d, -((d.getDay() + 6) % 7));
const fmtDay = (d) => `${d.getDate()} ${d.toLocaleString('en-GB', { month: 'short' })}`;

/* ---------- state ---------- */
let pin = local.get('lb.pin', '');
let who = local.get('lb.who', 'tom');
let entries = {};
// Recipes and settings come from the shared database, so coerce them into a known shape before rendering.
const toNum = (x) => (Number.isFinite(Number(x)) ? Number(x) : 0);
const strList = (a) => (Array.isArray(a) ? a.filter((x) => typeof x === 'string') : []);
const normRecipe = (r) => ({
  id: String(r.id), t: String(r.t ?? 'Untitled'), tubs: Math.max(1, Math.round(toNum(r.tubs)) || 1),
  m: [0, 1, 2, 3].map((i) => Math.round(toNum(Array.isArray(r.m) ? r.m[i] : 0))), ing: strList(r.ing), steps: strList(r.steps),
});
const normApp = (a) => ({
  recipes: (Array.isArray(a && a.recipes) ? a.recipes : []).filter((r) => r && r.id).map(normRecipe),
  plan: Array.isArray(a && a.plan) ? a.plan : [],
  settings: a && a.settings && typeof a.settings === 'object' ? a.settings : {},
});
let app = normApp(local.get('lb.appcache', null) || { recipes: RECIPES });
const key = (p, d) => `${p}_${d}`;
const trainedOn = (d) => !!(d && d.session && d.session !== 'rest' && d.sets && Object.keys(d.sets).length);
function target(p) {
  const o = ((app.settings.targets || {})[p]) || {}; const ok = (x) => Number.isFinite(Number(x)) && Number(x) > 0;
  return { ...PEOPLE[p], kcal: ok(o.kcal) ? Math.round(o.kcal) : PEOPLE[p].kcal, protein: ok(o.protein) ? Math.round(o.protein) : PEOPLE[p].protein };
}

function errText(e) {
  if (e.code === 'bad_pin' || e.code === 'locked') { local.del('lb.pin'); return 'The PIN has changed. Reload and enter the new one.'; }
  if (e.code === 'invalid') return "Something's out of range. Check the numbers.";
  return "Didn't save. Check your signal and try again.";
}

/* ---------- PIN gate ---------- */
function setGateWho(p) {
  who = p; local.set('lb.who', who);
  $$('[data-gate-who]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.gateWho === who)));
}
$$('[data-gate-who]').forEach((b) => b.addEventListener('click', () => setGateWho(b.dataset.gateWho)));
setGateWho(who);

$('#gateForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const p = $('#gatePin').value.trim();
  $('#gateBtn').disabled = true; $('#gateStatus').textContent = 'Checking…'; $('#gateStatus').className = 'status';
  try {
    await verifyPin(p);
    pin = p; local.set('lb.pin', pin);
    $('#gate').hidden = true; startApp();
  } catch (err) {
    $('#gateStatus').className = 'status err';
    $('#gateStatus').textContent = err.code === 'locked' ? 'Too many wrong guesses. Try again in 15 minutes.'
      : err.code === 'bad_pin' ? "That PIN isn't right." : "Couldn't reach the database. Check your signal and try again.";
  } finally { $('#gateBtn').disabled = false; }
});

$('#signOut').addEventListener('click', () => { local.del('lb.pin'); location.reload(); });

/* ---------- tabs ---------- */
const TABS = ['checkin', 'board', 'training', 'food', 'shop', 'settings'];
let curTab = 'checkin', prevTab = 'checkin';
function showTab(name) {
  if (name === 'why') name = 'training';
  if (!TABS.includes(name)) name = 'checkin';
  if (name !== curTab) { prevTab = curTab; curTab = name; }
  $$('nav.tabs button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === name)));
  $('#settingsBtn').setAttribute('aria-pressed', String(name === 'settings'));
  $$('section.panel').forEach((p) => { p.hidden = p.id !== 'tab-' + name; });
  local.set('lb.tab', name);
  window.scrollTo(0, 0);
}
$$('nav.tabs button').forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)));
$('#settingsBtn').addEventListener('click', () => showTab(curTab === 'settings' ? (prevTab === 'settings' ? 'checkin' : prevTab) : 'settings'));

/* ---------- training (static) ---------- */
function renderStatic() {
  $('#volTable').innerHTML = VOLUME.map((v) => `<tr><td>${v[0]}</td><td class="num">${v[1]}</td><td class="num">${v[2]}</td></tr>`).join('');
  $('#sessions').innerHTML = Object.entries(PROGRAM).map(([k, s]) => `
    <div class="card session" style="--plate:var(${s.plate})">
      <div class="sessionhead"><h3>${k} · ${esc(s.name)}</h3><span class="pill"><span class="plate" style="--plate:var(${s.plate})"></span>Session ${k}</span></div>
      <ol class="exlist">${s.ex.map((e) => `<li>
        <div class="exhead"><b>${esc(e.n)}</b><span class="mono small">2 × ${esc(e.r)}</span></div>
        <div class="chips"><span class="chip">${esc(e.e)}</span><span class="chip">rest ${esc(e.rest)}</span></div>
        <div class="small muted">${esc(e.kit)} · swap: ${esc(e.swap)}</div></li>`).join('')}
      </ol></div>`).join('');

  $('#ciSession').innerHTML = Object.entries(PROGRAM).map(([k, s]) => `<option value="${k}">${k} · ${s.name}</option>`).join('') + '<option value="rest">Rest day</option>';
  $('#liftPick').innerHTML = Object.entries(PROGRAM).map(([k, s]) => `<optgroup label="${k} · ${s.name}">${s.ex.map((e) => `<option value="${e.id}">${esc(e.n)}</option>`).join('')}</optgroup>`).join('');
  $('#liftPick').value = local.get('lb.lift', 'squat');
}

/* ---------- meal plan ---------- */
const SLOTS = ['lunch', 'dinner'];
const recipeById = (id) => app.recipes.find((r) => r.id === id) || null;
// Saturday and Sunday look ahead: that's when you shop and cook for the coming week.
const defaultPlanWeek = () => { const d = new Date(); return mondayOf((d.getDay() + 6) % 7 >= 5 ? addDays(d, 7) : d); };
let planWeek = defaultPlanWeek();

// Each cook/slot uses the latest pick made for this week or any week before it.
// A pick of null (its recipe was deleted) means "pick a meal".
function planFor(week) {
  const out = { sun: { ...DEFAULT_PLAN.sun }, wed: { ...DEFAULT_PLAN.wed } };
  for (const cook of Object.keys(COOKS)) for (const slot of SLOTS) {
    let best = null;
    for (const r of app.plan) if (r.cook === cook && r.slot === slot && r.week <= week && (!best || r.week > best.week)) best = r;
    if (best) out[cook][slot] = best.recipe_id;
  }
  return out;
}

const macroChips = (m) => `<span class="chip">${m[0]} kcal</span><span class="chip">P ${m[1]}</span><span class="chip">C ${m[2]}</span><span class="chip">F ${m[3]}</span>`;
const range = (lo, hi) => (lo === hi ? lo.toLocaleString('en-GB') : `${lo.toLocaleString('en-GB')}–${hi.toLocaleString('en-GB')}`);

function tubWarning(r, cook) {
  if (!r || !r.tubs || r.tubs === COOKS[cook].tubs) return '';
  const x = Math.round((COOKS[cook].tubs / r.tubs) * 100) / 100;
  return `<p class="hint">Makes ${r.tubs} tubs, this cook needs ${COOKS[cook].tubs}. Multiply the ingredients by ${x}.</p>`;
}

function renderPlan() {
  const wk = iso(planWeek); const plan = planFor(wk);
  $('#planLabel').textContent = `w/c ${fmtDay(planWeek)}`;
  const opts = (sel) => (recipeById(sel) ? '' : '<option value="">Pick a meal…</option>')
    + app.recipes.map((r) => `<option value="${esc(r.id)}" ${r.id === sel ? 'selected' : ''}>${esc(r.t)}</option>`).join('');
  $('#planCooks').innerHTML = Object.entries(COOKS).map(([cook, c]) => `
    <div class="cook">
      <div class="cookhead"><b>${c.name}</b><span class="muted small">eaten ${c.covers} · ${c.tubs} tubs each</span></div>
      ${SLOTS.map((slot) => `<label class="f">${slot === 'lunch' ? 'Lunch' : 'Dinner'}<select data-cook="${cook}" data-slot="${slot}">${opts(plan[cook][slot])}</select></label>${tubWarning(recipeById(plan[cook][slot]), cook)}`).join('')}
    </div>`).join('');
}
$('#planCooks').addEventListener('change', async (e) => {
  const sel = e.target.closest('select[data-cook]'); if (!sel || !sel.value) return;
  const row = { week: iso(planWeek), cook: sel.dataset.cook, slot: sel.dataset.slot, recipe_id: sel.value };
  const st = $('#planStatus'); st.className = 'status'; st.textContent = 'Saving…';
  sel.disabled = true;
  try {
    await setPlan(pin, row, RECIPES);
    app.plan = app.plan.filter((p) => !(p.week === row.week && p.cook === row.cook && p.slot === row.slot)).concat(row);
    noteWrite(); cacheApp(); st.className = 'status ok'; st.textContent = 'Saved.';
    renderFood(); renderShop();
  } catch (err) { st.className = 'status err'; st.textContent = errText(err); renderPlan(); }
  finally { sel.disabled = false; }
});
$('#planPrev').addEventListener('click', () => { planWeek = addDays(planWeek, -7); renderFood(); renderShop(); });
$('#planNext').addEventListener('click', () => { planWeek = addDays(planWeek, 7); renderFood(); renderShop(); });

/* ---------- daily template ---------- */
let mealWho = who;
function dayRows(p) {
  const plan = planFor(iso(planWeek));
  return MEALS[p].map(([when, what, ...m]) => {
    if (!SLOTS.includes(what)) return { when, name: what, lo: m, hi: m };
    const rs = Object.keys(COOKS).map((c) => recipeById(plan[c][what])).filter(Boolean);
    const label = what === 'lunch' ? 'Lunch tub' : 'Dinner tub';
    if (!rs.length) return { when, name: `${label}: pick a meal on the plan`, lo: [0, 0, 0, 0], hi: [0, 0, 0, 0] };
    const col = (i, f) => f(...rs.map((r) => Number(r.m[i]) || 0));
    return { when, name: `${label}: ${rs.map((r) => r.t).join(' / ')}`, lo: [0, 1, 2, 3].map((i) => col(i, Math.min)), hi: [0, 1, 2, 3].map((i) => col(i, Math.max)) };
  });
}
// A real day's lunch and dinner both come from the same cook, so total each cook's day and take the range of those.
function dayTotal(p) {
  const plan = planFor(iso(planWeek));
  const days = Object.keys(COOKS).map((c) => MEALS[p].reduce((acc, [, what, ...m]) => {
    const add = SLOTS.includes(what) ? (recipeById(plan[c][what]) || { m: [0, 0, 0, 0] }).m : m;
    return acc.map((x, i) => x + (Number(add[i]) || 0));
  }, [0, 0, 0, 0]));
  return { lo: [0, 1, 2, 3].map((i) => Math.min(...days.map((d) => d[i]))), hi: [0, 1, 2, 3].map((i) => Math.max(...days.map((d) => d[i]))) };
}
function renderMeals(p) {
  mealWho = p;
  $$('[data-meal-who]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mealWho === p)));
  const chips = (r) => `<span class="chip">${range(r.lo[0], r.hi[0])} kcal</span><span class="chip">P ${range(r.lo[1], r.hi[1])}</span><span class="chip">C ${range(r.lo[2], r.hi[2])}</span><span class="chip">F ${range(r.lo[3], r.hi[3])}</span>`;
  const t = dayTotal(p);
  $('#dayList').innerHTML = dayRows(p).map((r) => `<li><span class="when mono">${esc(r.when)}</span><div>${esc(r.name)}<div class="chips">${chips(r)}</div></div></li>`).join('')
    + `<li class="total"><span class="when mono">Total</span><div><b>${PEOPLE[p].name}'s day</b><div class="chips">${chips(t)}</div></div></li>`;
}
$$('[data-meal-who]').forEach((b) => b.addEventListener('click', () => renderMeals(b.dataset.mealWho)));

/* ---------- meal library ---------- */
function renderRecipes() {
  const plan = planFor(iso(planWeek));
  const usedIn = (id) => Object.entries(COOKS).flatMap(([c, cook]) => SLOTS.filter((s) => plan[c][s] === id).map((s) => `${cook.name.split(' ')[0]} ${s}`));
  $('#recipes').innerHTML = app.recipes.length ? app.recipes.map((r) => {
    const used = usedIn(r.id);
    return `<details><summary>${esc(r.t)}${used.length ? ` <span class="tag">${used.join(', ')}</span>` : ''}</summary>
      <div class="chips" style="margin-top:6px">${macroChips(r.m)}<span class="chip">per tub · makes ${r.tubs}</span></div>
      ${r.ing && r.ing.length ? `<ul class="list small">${r.ing.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
      ${r.steps && r.steps.length ? `<ol class="steps small">${r.steps.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>` : ''}
      <button class="btn ghost sm" type="button" data-edit="${esc(r.id)}" style="margin-top:10px">Edit</button></details>`;
  }).join('') : '<p class="muted">No meals yet. Add one.</p>';
}
$('#recipes').addEventListener('click', (e) => { const b = e.target.closest('[data-edit]'); if (b) openRecipe(recipeById(b.dataset.edit)); });
$('#addRecipe').addEventListener('click', () => openRecipe(null));

function renderTargets() {
  $('#targets').innerHTML = Object.keys(PEOPLE).map((id) => {
    const p = target(id); const t = dayTotal(id);
    return `<div class="card target"><span class="eyebrow">${p.name} · daily target</span><span class="big mono">${p.kcal.toLocaleString('en-GB')} kcal</span><span class="mono small">${p.protein}+ g protein · carbs fill the rest</span><span class="small muted">This week's template comes to ${range(t.lo[0], t.hi[0])} kcal, ${range(t.lo[1], t.hi[1])} g protein</span></div>`;
  }).join('');
}

function renderFood() { renderTargets(); renderPlan(); renderMeals(mealWho); renderRecipes(); }

/* ---------- add / edit meal dialog ---------- */
const dlg = $('#recipeDlg');
let editing = null;
function openRecipe(r) {
  editing = r;
  $('#rTitle').textContent = r ? 'Edit meal' : 'Add a meal';
  $('#rName').value = r ? r.t : '';
  $('#rTubs').value = r ? r.tubs : 6;
  [$('#rKcal'), $('#rP'), $('#rC'), $('#rF')].forEach((el, i) => { el.value = r && r.m[i] != null ? r.m[i] : ''; });
  $('#rIng').value = r ? (r.ing || []).join('\n') : '';
  $('#rSteps').value = r ? (r.steps || []).join('\n') : '';
  $('#rDelete').hidden = !r;
  $('#rStatus').textContent = ''; $('#rStatus').className = 'status';
  dlg.showModal();
  if (!r) $('#rName').focus();
}
const closeRecipe = () => { dlg.close(); editing = null; };
dlg.addEventListener('close', () => { editing = null; flushPending(); });
$('#rClose').addEventListener('click', closeRecipe);
$('#rCancel').addEventListener('click', closeRecipe);

const lines = (s, max, len) => s.split('\n').map((x) => x.trim()).filter(Boolean).slice(0, max).map((x) => x.slice(0, len));
const slug = (s) => (s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'meal') + '-' + Math.random().toString(36).slice(2, 6);

$('#recipeForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const st = $('#rStatus'); const bad = (t) => { st.className = 'status err'; st.textContent = t; };
  const t = $('#rName').value.trim();
  const n = (el, lo, hi, req) => { const v = el.value.trim(); if (v === '') return req ? NaN : 0; const x = Math.round(Number(v)); return x >= lo && x <= hi ? x : NaN; };
  const tubs = n($('#rTubs'), 1, 30, true);
  const m = [n($('#rKcal'), 0, 3000, true), n($('#rP'), 0, 300, true), n($('#rC'), 0, 500), n($('#rF'), 0, 500)];
  if (!t) return bad('Give it a name.');
  if (Number.isNaN(tubs)) return bad('Tubs should be between 1 and 30.');
  if (m.some(Number.isNaN)) return bad('Fill in kcal and protein per tub (carbs and fat are optional).');
  const recipe = { id: editing ? editing.id : slug(t), t, tubs, m, ing: lines($('#rIng').value, 40, 200), steps: lines($('#rSteps').value, 30, 400) };
  $('#rSave').disabled = true; st.className = 'status'; st.textContent = 'Saving…';
  try {
    await saveRecipe(pin, recipe, RECIPES);
    const i = app.recipes.findIndex((x) => x.id === recipe.id);
    // (recipe is already normalised: built from validated form fields)
    if (i >= 0) app.recipes[i] = recipe; else app.recipes.push(recipe);
    noteWrite(); cacheApp(); closeRecipe(); renderFood(); renderShop();
  } catch (err) { bad(err.code === 'invalid' ? "Couldn't save that. Check the numbers, and keep each line fairly short." : errText(err)); }
  finally { $('#rSave').disabled = false; }
});

$('#rDelete').addEventListener('click', async () => {
  if (!editing || !confirm(`Delete "${editing.t}"? It'll also come off any meal plan that uses it.`)) return;
  const id = editing.id;
  try {
    await deleteRecipe(pin, id, RECIPES);
    app.recipes = app.recipes.filter((r) => r.id !== id);
    app.plan = app.plan.map((p) => (p.recipe_id === id ? { ...p, recipe_id: null } : p));
    noteWrite(); cacheApp(); closeRecipe(); renderFood(); renderShop();
  } catch (err) { $('#rStatus').className = 'status err'; $('#rStatus').textContent = errText(err); }
});

/* ---------- shopping ---------- */
let ticks = local.get('lb.shop', {});
function renderShop() {
  const wk = iso(planWeek); const plan = planFor(wk);
  $('#shopWeek').textContent = `For the week starting ${fmtDay(planWeek)}.`;
  const item = (id, text) => `<li><label for="${id}"><input type="checkbox" id="${id}" data-k="${id}" ${ticks[id] ? 'checked' : ''}><span>${esc(text)}</span></label></li>`;
  const cooks = Object.entries(COOKS).map(([cook, c]) => {
    const rs = SLOTS.map((slot) => [slot, recipeById(plan[cook][slot])]).filter(([, r]) => r);
    const body = rs.length ? rs.map(([slot, r]) => `<h4>${esc(r.t)} <span class="muted small">(${slot})</span></h4>${tubWarning(r, cook)}<ul class="list shop">${r.ing.map((x, i) => item(`${wk}|${cook}|${slot}|${r.id}|${i}`, x)).join('') || '<li class="muted">No ingredients listed for this meal yet.</li>'}</ul>`).join('')
      : '<p class="muted small">No meals picked for this cook.</p>';
    return `<div class="card"><h3 style="margin-bottom:4px">${c.name}</h3><p class="small muted" style="margin:0">Eaten ${c.covers}, both of you</p>${body}</div>`;
  }).join('');
  const staples = SHOP.map((g, gi) => `<div class="card"><h3 style="margin-bottom:8px">${esc(g.t)}</h3><ul class="list shop">${g.items.map((it, ii) => item(`${wk}|staple|${gi}|${ii}`, it)).join('')}</ul></div>`).join('');
  $('#shopLists').innerHTML = cooks + staples;
}
$('#shopLists').addEventListener('change', (e) => { const k = e.target.dataset.k; if (!k) return; ticks[k] = e.target.checked; local.set('lb.shop', ticks); });
$('#shopReset').addEventListener('click', () => { ticks = {}; local.set('lb.shop', ticks); renderShop(); });

/* ---------- settings: targets ---------- */
function renderSettings() {
  $('#tgtFields').innerHTML = Object.keys(PEOPLE).map((p) => {
    const t = target(p);
    return `<fieldset class="tgt"><legend>${t.name}</legend><div class="fields">
      <label class="f">Calories<input type="number" inputmode="numeric" id="tk_${p}" min="1500" max="6000" value="${t.kcal}"></label>
      <label class="f">Protein (g)<input type="number" inputmode="numeric" id="tp_${p}" min="50" max="400" value="${t.protein}"></label></div></fieldset>`;
  }).join('');
}
$('#tgtForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const st = $('#tgtStatus'); const targets = {};
  for (const p of Object.keys(PEOPLE)) {
    const kcal = Math.round(Number($(`#tk_${p}`).value)), protein = Math.round(Number($(`#tp_${p}`).value));
    if (!(kcal >= 1500 && kcal <= 6000) || !(protein >= 50 && protein <= 400)) { st.className = 'status err'; st.textContent = `${PEOPLE[p].name}: calories 1500–6000, protein 50–400.`; return; }
    targets[p] = { kcal, protein };
  }
  const settings = { ...app.settings, targets };
  $('#tgtSave').disabled = true; st.className = 'status'; st.textContent = 'Saving…';
  try {
    await saveSettings(pin, settings, RECIPES);
    app.settings = settings; noteWrite(); cacheApp();
    st.className = 'status ok'; st.textContent = 'Saved.';
    renderTargetsLine(); renderFood(); renderLive();
  } catch (err) { st.className = 'status err'; st.textContent = errText(err); }
  finally { $('#tgtSave').disabled = false; }
});

/* ---------- flexible schedule ---------- */
function lastTraining(person, beforeDate) {
  let last = null;
  for (const d of Object.values(entries)) {
    if (d.person === person && d.date < beforeDate && trainedOn(d) && (!last || d.date > last.date)) last = d;
  }
  return last;
}
function nextSession(person, date) {
  const last = lastTraining(person, date);
  return last ? ORDER[(ORDER.indexOf(last.session) + 1) % ORDER.length] : 'A';
}
function streakBefore(person, date) {
  let n = 0, d = addDays(parse(date), -1);
  while (trainedOn(entries[key(person, iso(d))])) { n++; d = addDays(d, -1); }
  return n;
}
function updateRestHint() {
  const date = $('#ciDate').value, s = $('#ciSession').value;
  const n = date ? streakBefore(who, date) : 0;
  const h = $('#restHint');
  if (s !== 'rest' && n >= 3) { h.textContent = `That's ${n} days on the bounce. Take a rest day today and do this session tomorrow.`; h.hidden = false; }
  else h.hidden = true;
}

/* ---------- check-in form ---------- */
function lastSetsFor(person, exId, beforeDate) {
  let best = null;
  for (const d of Object.values(entries)) {
    if (d.person !== person || d.date >= beforeDate || !d.sets || !d.sets[exId]) continue;
    if (!d.sets[exId].some((x) => x && x.w != null)) continue;
    if (!best || d.date > best.date) best = { date: d.date, sets: d.sets[exId] };
  }
  return best;
}

let lastSets = {};
function renderExLog(existing) {
  const sess = $('#ciSession').value, date = $('#ciDate').value;
  updateRestHint();
  if (sess === 'rest') { $('#exBlock').hidden = true; $('#exLog').innerHTML = ''; return; }
  $('#exBlock').hidden = false;
  lastSets = {};
  $('#exLog').innerHTML = PROGRAM[sess].ex.map((e) => {
    const last = lastSetsFor(who, e.id, date); if (last) lastSets[e.id] = last.sets;
    const cur = (existing && existing.sets && existing.sets[e.id]) || [];
    const row = (i) => {
      const l = last && last.sets[i]; const c = cur[i] || {};
      return `<span class="setlabel">Set ${i + 1}</span><input id="w_${e.id}_${i}" type="number" inputmode="decimal" step="0.5" min="0" aria-label="${esc(e.n)} set ${i + 1} kg" placeholder="${l && l.w != null ? l.w : 'kg'}" value="${c.w ?? ''}"><span class="x">×</span><input id="r_${e.id}_${i}" type="number" inputmode="numeric" min="0" max="100" aria-label="${esc(e.n)} set ${i + 1} reps" placeholder="${l && l.r != null ? l.r : 'reps'}" value="${c.r ?? ''}">`;
    };
    return `<div class="exrow"><div class="exname"><div>${esc(e.n)}<small>2 × ${esc(e.r)} · ${esc(e.e)}${last ? ` · last ${last.date.slice(8)}/${last.date.slice(5, 7)}` : ''}</small></div>${last ? `<button type="button" class="btn ghost sm" data-fill="${e.id}">Same as last</button>` : ''}</div><div class="sets">${row(0)}${row(1)}</div></div>`;
  }).join('');
}
$('#exLog').addEventListener('click', (e) => {
  const b = e.target.closest('[data-fill]'); if (!b) return;
  const id = b.dataset.fill; const s = lastSets[id] || [];
  [0, 1].forEach((i) => {
    const w = $(`#w_${id}_${i}`), r = $(`#r_${id}_${i}`); const l = s[i] || {};
    if (w.value === '' && l.w != null) w.value = l.w;
    if (r.value === '' && l.r != null) r.value = l.r;
  });
});

function renderTargetsLine() { const p = target(who); $('#targetsLine').textContent = `${p.name}: ${p.kcal} kcal · ${p.protein} g P`; }

let formDirty = false;
$('#ciForm').addEventListener('input', () => { formDirty = true; });
function fillForm() {
  formDirty = false;
  const date = $('#ciDate').value; const d = entries[key(who, date)];
  $$('[data-who]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.who === who)));
  renderTargetsLine();
  $('#ciSession').value = d && d.session ? d.session : nextSession(who, date);
  $('#ciWeight').value = d && d.weight != null ? d.weight : '';
  $('#ciKcal').value = d && d.kcal != null ? d.kcal : '';
  $('#ciProtein').value = d && d.protein != null ? d.protein : '';
  $('#ciCreatine').checked = !!(d && d.creatine);
  $('#ciPrep').checked = !!(d && d.prep);
  $('#ciNotes').value = d && d.notes ? d.notes : '';
  renderExLog(d);
  status(d ? 'Already checked in. Saving updates it.' : '');
}

$$('[data-who]').forEach((b) => b.addEventListener('click', () => { who = b.dataset.who; local.set('lb.who', who); fillForm(); }));
$('#ciDate').addEventListener('change', fillForm);
$('#ciSession').addEventListener('change', () => renderExLog(entries[key(who, $('#ciDate').value)]));

const num = (v) => { if (v === '' || v == null) return null; const n = Number(v); return Number.isFinite(n) ? n : null; };
function status(t, cls) { const s = $('#ciStatus'); s.textContent = t; s.className = 'status' + (cls ? ' ' + cls : ''); }

$('#ciForm').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const date = $('#ciDate').value; if (!date) { status('Pick a date first.', 'err'); return; }
  const session = $('#ciSession').value;
  const sets = {};
  if (session !== 'rest') {
    PROGRAM[session].ex.forEach((e) => {
      const s = [0, 1].map((i) => ({ w: num($(`#w_${e.id}_${i}`).value), r: num($(`#r_${e.id}_${i}`).value) }));
      if (s.some((x) => x.w != null || x.r != null)) sets[e.id] = s;
    });
  }
  const kcal = num($('#ciKcal').value), protein = num($('#ciProtein').value);
  const body = {
    person: who, date, session, sets,
    weight: num($('#ciWeight').value),
    kcal: kcal == null ? null : Math.round(kcal),
    protein: protein == null ? null : Math.round(protein),
    creatine: $('#ciCreatine').checked, prep: $('#ciPrep').checked,
    notes: $('#ciNotes').value.slice(0, 500),
  };
  $('#ciSave').disabled = true; status('Saving…');
  try {
    await saveRow(pin, body);
    entries[key(who, date)] = body; noteWrite(); formDirty = false;
    const pts = dayPoints(body);
    status(`Saved. ${pts} point${pts === 1 ? '' : 's'} for ${PEOPLE[who].name} today.`, 'ok');
    renderLive();
  } catch (e) {
    status(e.code === 'invalid' ? "Something's out of range. Check the weight, calories and protein." : errText(e), 'err');
  } finally { $('#ciSave').disabled = false; }
});

/* ---------- scoring ---------- */
const kcalHit = (d, p) => d && d.kcal != null && d.kcal >= p.kcal - 150;
const protHit = (d, p) => d && d.protein != null && d.protein >= p.protein;
const dailyPoints = (d) => { if (!d) return 0; const p = target(d.person); return (kcalHit(d, p) ? 1 : 0) + (protHit(d, p) ? 1 : 0) + (d.creatine ? 1 : 0); };
const dayPoints = (d) => (trainedOn(d) ? 1 : 0) + dailyPoints(d);
function firstDate(person) {
  let f = null;
  for (const d of Object.values(entries)) if (d.person === person && (!f || d.date < f)) f = d.date;
  return f;
}
function marks(person, date, first) {
  const d = entries[key(person, date)]; const p = target(person);
  const counts = date < todayISO() && first && date >= first; // no misses before your first check-in
  const st = (hit) => (hit ? 'on' : counts ? 'miss' : '');
  return {
    gym: trainedOn(d) ? 'on' : d && d.session === 'rest' ? 'rest' : '',
    kcal: st(kcalHit(d, p)), prot: st(protHit(d, p)), cre: st(d && d.creatine),
  };
}
function weekScore(person, monday) {
  let sessions = 0, daily = 0;
  for (let i = 0; i < 7; i++) {
    const d = entries[key(person, iso(addDays(monday, i)))];
    if (trainedOn(d)) sessions++;
    daily += dailyPoints(d);
  }
  return { sessions: Math.min(sessions, 5), total: Math.min(sessions, 5) + daily };
}

/* ---------- board ---------- */
let weekStart = mondayOf(new Date());
function renderBoard() {
  const days = [...Array(7)].map((_, i) => addDays(weekStart, i));
  $('#wkLabel').textContent = `${fmtDay(days[0])} – ${fmtDay(days[6])}`;
  const t = todayISO();
  const [a, b] = Object.keys(PEOPLE); const sa = weekScore(a, weekStart), sb = weekScore(b, weekStart);
  const done = iso(days[6]) < t;
  const lead = sa.total === sb.total ? (done ? `Tied on ${sa.total}. Split the chicken.` : `Level on ${sa.total}.`)
    : (() => { const [w, l] = sa.total > sb.total ? [a, b] : [b, a]; const hi = Math.max(sa.total, sb.total), lo = Math.min(sa.total, sb.total);
      return done ? `${PEOPLE[w].name} won ${hi}–${lo}. ${PEOPLE[l].name} buys the chicken.` : `${PEOPLE[w].name} leads ${hi}–${lo}.`; })();
  $('#wkLead').textContent = lead;
  let html = '<div></div>' + ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((x) => `<div class="h">${x}</div>`).join('') + '<div class="h">Pts</div>';
  for (const person of Object.keys(PEOPLE)) {
    const first = firstDate(person); const sc = person === a ? sa : sb;
    html += `<div class="who">${PEOPLE[person].name}</div>`;
    days.forEach((d) => {
      const ds = iso(d); const m = marks(person, ds, first);
      const dot = (s) => `<span class="dot ${s === 'on' ? 'on' : s === 'miss' ? 'miss' : ''}" ${s === 'rest' ? 'style="opacity:.3"' : ''}></span>`;
      html += `<div class="day ${ds === t ? 'today' : ''}" title="${PEOPLE[person].name} ${ds}${m.gym === 'rest' ? ' · rest day' : ''}">${dot(m.gym)}${dot(m.kcal)}${dot(m.prot)}${dot(m.cre)}</div>`;
    });
    html += `<div class="score" title="${sc.sessions}/5 sessions">${sc.total}<div class="muted" style="font-size:11px;margin-top:3px">${sc.sessions}/5</div></div>`;
  }
  $('#board').innerHTML = html;
}
$('#wkPrev').addEventListener('click', () => { weekStart = addDays(weekStart, -7); renderBoard(); });
$('#wkNext').addEventListener('click', () => { weekStart = addDays(weekStart, 7); renderBoard(); });

function streak(person, test) {
  let d = new Date(); if (!test(entries[key(person, iso(d))])) d = addDays(d, -1); // today still counts if not done yet
  let n = 0;
  while (test(entries[key(person, iso(d))])) { n++; d = addDays(d, -1); }
  return n;
}
function renderStreaks() {
  $('#streaks').innerHTML = Object.keys(PEOPLE).map((p) => {
    const t = target(p);
    const ci = streak(p, (d) => !!d), pr = streak(p, (d) => protHit(d, t)), cr = streak(p, (d) => d && d.creatine);
    const s = (n) => `${n} day${n === 1 ? '' : 's'}`;
    return `<div class="streak"><span class="eyebrow">${PEOPLE[p].name}</span><span class="big mono">${ci}</span><span class="small">day check-in streak</span><span class="small muted">Protein ${s(pr)} · creatine ${s(cr)}</span></div>`;
  }).join('');
}

function renderLedger() {
  const [a, b] = Object.keys(PEOPLE);
  const firsts = [firstDate(a), firstDate(b)].filter(Boolean).sort();
  const thisMon = parse(iso(mondayOf(new Date()))); // midnight, so this week isn't counted as finished
  const rows = []; const wins = { [a]: 0, [b]: 0, tie: 0 };
  if (firsts.length) {
    for (let m = mondayOf(parse(firsts[0])); m < thisMon; m = addDays(m, 7)) {
      const sa = weekScore(a, m).total, sb = weekScore(b, m).total;
      const res = sa === sb ? 'tie' : sa > sb ? a : b; wins[res]++;
      rows.push({ m, sa, sb, res });
    }
  }
  $('#ledgerTally').textContent = rows.length
    ? `Weeks won: ${PEOPLE[a].name} ${wins[a]} · ${PEOPLE[b].name} ${wins[b]}${wins.tie ? ` · ${wins.tie} tied` : ''}`
    : 'The first result lands after your first full week. Loser buys the chicken.';
  $('#ledger').innerHTML = rows.reverse().slice(0, 12).map((r) => {
    const loser = r.res === 'tie' ? 'Split the chicken' : `${PEOPLE[r.res === a ? b : a].name} buys`;
    return `<li><span class="mono small">w/c ${fmtDay(r.m)}</span><span class="mono">${PEOPLE[a].name} ${r.sa} – ${r.sb} ${PEOPLE[b].name}</span><span class="small ${r.res === 'tie' ? 'muted' : ''}">${loser}</span></li>`;
  }).join('');
}

function sessionsThisWeek(person) { return weekScore(person, mondayOf(new Date())).sessions; }
function renderToday() {
  const t = todayISO();
  $('#todayStatus').innerHTML = Object.keys(PEOPLE).map((p) => {
    const d = entries[key(p, t)];
    const today = d ? `checked in · ${dayPoints(d)}/4` : "hasn't checked in";
    return `<b>${PEOPLE[p].name}</b> ${today} · ${sessionsThisWeek(p)}/5 sessions · next up ${nextSession(p, iso(addDays(new Date(), 1)))}`;
  }).join('<br>');
}
$('#nudgeBtn').addEventListener('click', async () => {
  const t = todayISO(); const them = who === 'tom' ? 'joe' : 'tom';
  const mine = entries[key(who, t)], theirs = entries[key(them, t)];
  const mp = mine ? dayPoints(mine) : 0;
  const text = theirs
    ? `${PEOPLE[them].name}, you're on ${dayPoints(theirs)}/4 today and ${sessionsThisWeek(them)}/5 sessions this week. I'm on ${mp}/4. Get the protein in.`
    : `${PEOPLE[them].name}, you haven't checked in today. I'm on ${mp}/4. Log it or you're buying the chicken.`;
  const btn = $('#nudgeBtn');
  try { await navigator.clipboard.writeText(text); btn.textContent = 'Copied, paste it in the chat'; }
  catch { btn.textContent = text; }
  setTimeout(() => { btn.textContent = 'Copy a nudge'; }, 4000);
});

/* ---------- bodyweight chart ---------- */
function renderBW() {
  const series = { tom: [], joe: [] };
  Object.values(entries).forEach((d) => { if (d.weight != null && series[d.person]) series[d.person].push([d.date, Number(d.weight)]); });
  const all = [...series.tom, ...series.joe];
  if (all.length < 2) { $('#bwChart').innerHTML = ''; return; }
  Object.values(series).forEach((s) => s.sort((a, b) => (a[0] < b[0] ? -1 : 1)));
  const dates = all.map((x) => parse(x[0]).getTime()), ws = all.map((x) => x[1]);
  const x0 = Math.min(...dates); let x1 = Math.max(...dates); if (x1 === x0) x1 = x0 + 864e5;
  const y0 = Math.floor(Math.min(...ws) - 1), y1 = Math.ceil(Math.max(...ws) + 1);
  const W = 640, H = 220, L = 40, R = 12, T = 12, B = 26;
  const X = (t) => L + ((t - x0) / (x1 - x0)) * (W - L - R), Y = (w) => T + ((y1 - w) / (y1 - y0)) * (H - T - B);
  let g = '';
  const step = Math.max(1, Math.ceil((y1 - y0) / 5));
  for (let v = y0; v <= y1; v += step) g += `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--line)" stroke-width="1"/><text x="${L - 6}" y="${Y(v) + 4}" text-anchor="end">${v}</text>`;
  const dl = (t) => new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  g += `<text x="${L}" y="${H - 6}">${dl(x0)}</text><text x="${W - R}" y="${H - 6}" text-anchor="end">${dl(x1)}</text>`;
  const col = { tom: 'var(--pA)', joe: 'var(--pB)' };
  const out = [];
  for (const p of Object.keys(series)) {
    const s = series[p]; if (!s.length) continue;
    g += `<polyline points="${s.map(([d, w]) => `${X(parse(d).getTime()).toFixed(1)},${Y(w).toFixed(1)}`).join(' ')}" fill="none" stroke="${col[p]}" stroke-width="2.5" stroke-linejoin="round"/>`;
    const [ld, lw] = s[s.length - 1];
    g += `<circle cx="${X(parse(ld).getTime())}" cy="${Y(lw)}" r="4.5" fill="${col[p]}"/>`;
    const avg = (from, to) => { const v = s.filter(([d]) => d > from && d <= to).map((x) => x[1]); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
    const t = todayISO(), w1 = iso(addDays(new Date(), -7)), w2 = iso(addDays(new Date(), -14));
    const a1 = avg(w1, t), a0 = avg(w2, w1);
    out.push(`<b style="color:${col[p]}">${PEOPLE[p].name}</b>: ${a1 != null ? a1.toFixed(1) + ' kg 7-day avg' : 'no weigh-ins this week'}${a1 != null && a0 != null ? ` (${a1 - a0 >= 0 ? '+' : ''}${(a1 - a0).toFixed(1)} vs last week)` : ''}`);
  }
  $('#bwChart').innerHTML = `<div class="table-wrap"><svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Bodyweight over time">${g}</svg></div>`;
  $('#bwSummary').innerHTML = out.join(' · ') + '. Target: +0.2 to +0.4 kg a week.';
}

/* ---------- lift history ---------- */
$('#liftPick').addEventListener('change', () => { local.set('lb.lift', $('#liftPick').value); renderLifts(); });
function renderLifts() {
  const id = $('#liftPick').value; const rows = {};
  Object.values(entries).forEach((d) => { const s = d.sets && d.sets[id]; if (!s) return; (rows[d.date] = rows[d.date] || {})[d.person] = s; });
  const dates = Object.keys(rows).sort().reverse().slice(0, 10);
  const fmt = (s) => (!s ? '<span class="muted">–</span>' : s.filter((x) => x && x.w != null).map((x) => `${x.w}×${x.r ?? '?'}`).join(', ') || '<span class="muted">–</span>');
  $('#liftTable').innerHTML = `<thead><tr><th>Date</th><th>Tom</th><th>Joe</th></tr></thead><tbody>${dates.length
    ? dates.map((d) => `<tr><td class="mono small">${parse(d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</td><td class="mono">${fmt(rows[d].tom)}</td><td class="mono">${fmt(rows[d].joe)}</td></tr>`).join('')
    : '<tr><td colspan="3" class="muted">No sets logged for this lift yet. Check in after your next session and it\'ll show here.</td></tr>'}</tbody>`;
}

function renderLive() { renderBoard(); renderStreaks(); renderLedger(); renderToday(); renderBW(); renderLifts(); updateRestHint(); }

/* ---------- boot ---------- */
function cacheApp() { if (shared) local.set('lb.appcache', app); }

// Key-order-independent comparison: the database returns JSON keys in its own order.
const canon = (v) => (Array.isArray(v) ? `[${v.map(canon).join(',')}]`
  : v && typeof v === 'object' ? `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canon(v[k])}`).join(',')}}` : JSON.stringify(v));

// A refresh that started before a save finished would bring back the old data, so ignore it.
let writes = 0;
const noteWrite = () => { writes++; };

// Don't redraw meals or settings under someone who's mid-edit; catch up when they finish.
let pending = false;
const editing_ = () => dlg.open || $('#planCooks').contains(document.activeElement) || $('#tgtForm').contains(document.activeElement);
function flushPending() { if (pending && !editing_()) { pending = false; renderFood(); renderShop(); renderSettings(); renderTargetsLine(); } }
$('#planCooks').addEventListener('focusout', () => setTimeout(flushPending, 0));
$('#tgtForm').addEventListener('focusout', () => setTimeout(flushPending, 0));

async function refresh(refill) {
  const startWrites = writes;
  const [e, a] = await Promise.allSettled([loadAll(pin), loadApp(pin, RECIPES)]);
  const stale = writes !== startWrites;
  if (e.status === 'fulfilled') { if (!stale) entries = e.value; $('#storeBanner').hidden = true; }
  else {
    if (e.reason && e.reason.code === 'bad_pin') { local.del('lb.pin'); location.reload(); return; }
    const b = $('#storeBanner'); b.textContent = "Can't reach the shared log right now. Showing what was last loaded."; b.hidden = false;
  }
  if (a.status === 'fulfilled' && !stale) {
    const next = normApp(a.value);
    if (canon(next) !== canon(app)) { app = next; cacheApp(); pending = true; }
    flushPending();
  }
  if (refill && !formDirty) fillForm();
  else renderTargetsLine();
  renderLive();
}

// An installed home-screen app can be resumed days later, so move "today" on when the date changes.
let bootDay = todayISO();
function rollDay() {
  const t = todayISO(); if (t === bootDay) return;
  const wasToday = $('#ciDate').value === bootDay; bootDay = t;
  if (wasToday && !formDirty) { $('#ciDate').value = t; fillForm(); }
  planWeek = defaultPlanWeek(); weekStart = mondayOf(new Date());
  renderFood(); renderShop(); renderLive();
}

let started = false;
function startApp() {
  if (started) return; started = true;
  $('#app').hidden = false;
  renderStatic(); renderFood(); renderShop(); renderSettings();
  const h = location.hash.slice(1);
  showTab(h || local.get('lb.tab', 'checkin'));
  $('#ciDate').value = todayISO();
  if (!shared) { const b = $('#storeBanner'); b.textContent = 'No database connected, so check-ins save on this phone only. See the README to hook up Supabase.'; b.hidden = false; }
  fillForm(); renderLive();
  refresh(true);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') rollDay(); });
  if (shared) {
    setInterval(() => { if (document.visibilityState === 'visible') { rollDay(); refresh(false); } }, 30000);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') refresh(false); });
  }
}

if (shared && !pin) $('#gate').hidden = false;
else startApp();
