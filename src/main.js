import { PEOPLE, ORDER, PROGRAM, VOLUME, MEALS, RECIPES, SHOP } from './data.js';
import { shared, local, verifyPin, loadAll, saveRow } from './store.js';

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

/* ---------- state ---------- */
let pin = local.get('lb.pin', '');
let who = local.get('lb.who', 'tom');
let entries = {};
const key = (p, d) => `${p}_${d}`;
const trainedOn = (d) => !!(d && d.session && d.session !== 'rest' && d.sets && Object.keys(d.sets).length);

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
const TABS = ['checkin', 'board', 'training', 'food', 'shop', 'why'];
function showTab(name) {
  $$('nav.tabs button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === name)));
  $$('section.panel').forEach((p) => { p.hidden = p.id !== 'tab-' + name; });
  local.set('lb.tab', name);
}
$$('nav.tabs button').forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)));

/* ---------- static content ---------- */
function renderStatic() {
  $('#volTable').innerHTML = VOLUME.map((v) => `<tr><td>${v[0]}</td><td class="num">${v[1]}</td><td class="num">${v[2]}</td></tr>`).join('');
  $('#sessions').innerHTML = Object.entries(PROGRAM).map(([k, s]) => `
    <div class="card session" style="--plate:var(${s.plate})">
      <div class="sessionhead"><h3>${k} · ${esc(s.name)}</h3><span class="pill"><span class="plate" style="--plate:var(${s.plate})"></span>Session ${k}</span></div>
      <div class="table-wrap"><table class="extable"><thead><tr><th>Exercise</th><th>Reps</th><th>Effort</th><th>Rest</th><th>Swap if busy/missing</th></tr></thead><tbody>
      ${s.ex.map((e) => `<tr><td><b>${esc(e.n)}</b><br><span class="muted small">${esc(e.kit)}</span></td><td class="mono">2 × ${esc(e.r)}</td><td class="small">${esc(e.e)}</td><td class="mono small">${esc(e.rest)}</td><td class="small">${esc(e.swap)}</td></tr>`).join('')}
      </tbody></table></div></div>`).join('');

  $('#targets').innerHTML = Object.entries(PEOPLE).map(([id, p]) => `<div class="card target"><span class="eyebrow">${p.name} · daily target</span><span class="big mono">${p.kcal.toLocaleString('en-GB')} kcal</span><span class="mono small">${p.protein}+ g protein · carbs fill the rest</span><span class="small muted">Template day comes to ${MEALS[id].total[0]} kcal</span></div>`).join('');

  $('#recipes').innerHTML = RECIPES.map((r, i) => `<details ${i === 0 ? 'open' : ''}><summary>${esc(r.t)} <span class="muted small">· ${esc(r.when)}</span></summary>
    <div class="macro"><span class="pill">${r.m[0]} kcal</span><span class="pill">P ${r.m[1]}</span><span class="pill">C ${r.m[2]}</span><span class="pill">F ${r.m[3]}</span><span class="pill">per tub</span></div>
    <ul class="list small">${r.ing.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
    <ol class="steps small">${r.steps.map((x) => `<li>${esc(x)}</li>`).join('')}</ol></details>`).join('');

  renderMeals(who);
  renderShop();

  $('#ciSession').innerHTML = Object.entries(PROGRAM).map(([k, s]) => `<option value="${k}">${k} · ${s.name}</option>`).join('') + '<option value="rest">Rest day</option>';
  $('#liftPick').innerHTML = Object.entries(PROGRAM).map(([k, s]) => `<optgroup label="${k} · ${s.name}">${s.ex.map((e) => `<option value="${e.id}">${esc(e.n)}</option>`).join('')}</optgroup>`).join('');
  $('#liftPick').value = local.get('lb.lift', 'squat');
}

function renderMeals(p) {
  $$('[data-meal-who]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mealWho === p)));
  const m = MEALS[p];
  $('#dayTable').innerHTML = m.rows.map((r) => `<tr><td class="mono small">${r[0]}</td><td>${esc(r[1])}</td><td class="num">${r[2]}</td><td class="num">${r[3]}</td><td class="num">${r[4]}</td><td class="num">${r[5]}</td></tr>`).join('')
    + `<tr><td></td><td><b>${PEOPLE[p].name}'s total</b></td><td class="num"><b>${m.total[0]}</b></td><td class="num"><b>${m.total[1]}</b></td><td class="num">${m.total[2]}</td><td class="num">${m.total[3]}</td></tr>`;
}
$$('[data-meal-who]').forEach((b) => b.addEventListener('click', () => renderMeals(b.dataset.mealWho)));

let ticks = local.get('lb.shop', {});
function renderShop() {
  $('#shopLists').innerHTML = SHOP.map((g, gi) => `<div class="card"><h3 style="margin-bottom:8px">${esc(g.t)}</h3><ul class="list shop">${g.items.map((it, ii) => { const id = `s${gi}_${ii}`; return `<li><label for="${id}"><input type="checkbox" id="${id}" data-k="${id}" ${ticks[id] ? 'checked' : ''}><span>${esc(it)}</span></label></li>`; }).join('')}</ul></div>`).join('');
}
$('#shopLists').addEventListener('change', (e) => { const k = e.target.dataset.k; if (!k) return; ticks[k] = e.target.checked; local.set('lb.shop', ticks); });
$('#shopReset').addEventListener('click', () => { ticks = {}; local.set('lb.shop', ticks); renderShop(); });

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

function renderExLog(existing) {
  const sess = $('#ciSession').value, date = $('#ciDate').value;
  updateRestHint();
  if (sess === 'rest') { $('#exBlock').hidden = true; $('#exLog').innerHTML = ''; return; }
  $('#exBlock').hidden = false;
  $('#exLog').innerHTML = PROGRAM[sess].ex.map((e) => {
    const last = lastSetsFor(who, e.id, date);
    const cur = (existing && existing.sets && existing.sets[e.id]) || [];
    const row = (i) => {
      const l = last && last.sets[i]; const c = cur[i] || {};
      return `<span>S${i + 1}</span><input id="w_${e.id}_${i}" type="number" inputmode="decimal" step="0.5" min="0" aria-label="${esc(e.n)} set ${i + 1} kg" placeholder="${l && l.w != null ? l.w : 'kg'}" value="${c.w ?? ''}"><input id="r_${e.id}_${i}" type="number" inputmode="numeric" min="0" max="100" aria-label="${esc(e.n)} set ${i + 1} reps" placeholder="${l && l.r != null ? l.r : 'reps'}" value="${c.r ?? ''}">`;
    };
    return `<div class="exrow"><div class="exname">${esc(e.n)}<small>2 × ${esc(e.r)} · ${esc(e.e)}${last ? ` · last ${last.date.slice(5)}` : ''}</small></div><div class="sets">${row(0)}${row(1)}</div></div>`;
  }).join('');
}

function fillForm() {
  const date = $('#ciDate').value; const d = entries[key(who, date)];
  $$('[data-who]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.who === who)));
  const p = PEOPLE[who];
  $('#targetsLine').textContent = `${p.name}: ${p.kcal} kcal · ${p.protein} g P`;
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
    entries[key(who, date)] = body;
    const pts = dayPoints(body);
    status(`Saved. ${pts} point${pts === 1 ? '' : 's'} for ${PEOPLE[who].name} today.`, 'ok');
    renderLive();
  } catch (e) {
    if (e.code === 'bad_pin' || e.code === 'locked') { local.del('lb.pin'); status('The PIN has changed. Reload and enter the new one.', 'err'); }
    else if (e.code === 'invalid') status("Something's out of range. Check the weight, calories and protein.", 'err');
    else status("Didn't save. Check your signal and try again.", 'err');
  } finally { $('#ciSave').disabled = false; }
});

/* ---------- scoring ---------- */
const kcalHit = (d, p) => d && d.kcal != null && d.kcal >= p.kcal - 150;
const protHit = (d, p) => d && d.protein != null && d.protein >= p.protein;
function dayPoints(d) { const p = PEOPLE[d.person]; return (trainedOn(d) ? 1 : 0) + (kcalHit(d, p) ? 1 : 0) + (protHit(d, p) ? 1 : 0) + (d.creatine ? 1 : 0); }
function marks(person, date) {
  const d = entries[key(person, date)]; const p = PEOPLE[person];
  const past = date < todayISO();
  const st = (hit) => (hit ? 'on' : past ? 'miss' : '');
  return {
    gym: trainedOn(d) ? 'on' : d && d.session === 'rest' ? 'rest' : '',
    kcal: st(kcalHit(d, p)), prot: st(protHit(d, p)), cre: st(d && d.creatine),
    trained: trainedOn(d), daily: (kcalHit(d, p) ? 1 : 0) + (protHit(d, p) ? 1 : 0) + (d && d.creatine ? 1 : 0),
    checked: !!d,
  };
}

/* ---------- board ---------- */
let weekStart = mondayOf(new Date());
function renderBoard() {
  const days = [...Array(7)].map((_, i) => addDays(weekStart, i));
  const fmt = (d) => `${d.getDate()} ${d.toLocaleString('en-GB', { month: 'short' })}`;
  $('#wkLabel').textContent = `${fmt(days[0])} – ${fmt(days[6])}`;
  const t = todayISO();
  let html = '<div></div>' + ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((x) => `<div class="h">${x}</div>`).join('') + '<div class="h">Pts</div>';
  for (const person of Object.keys(PEOPLE)) {
    let sessions = 0, daily = 0;
    html += `<div class="who">${PEOPLE[person].name}</div>`;
    days.forEach((d) => {
      const ds = iso(d); const m = marks(person, ds);
      if (m.trained) sessions++; daily += m.daily;
      const dot = (s) => `<span class="dot ${s === 'on' ? 'on' : s === 'miss' ? 'miss' : ''}" ${s === 'rest' ? 'style="opacity:.3"' : ''}></span>`;
      html += `<div class="day ${ds === t ? 'today' : ''}" title="${PEOPLE[person].name} ${ds}${m.gym === 'rest' ? ' · rest day' : ''}">${dot(m.gym)}${dot(m.kcal)}${dot(m.prot)}${dot(m.cre)}</div>`;
    });
    html += `<div class="score" title="${sessions}/5 sessions">${Math.min(sessions, 5) + daily}<div class="muted" style="font-size:11px;margin-top:3px">${Math.min(sessions, 5)}/5</div></div>`;
  }
  $('#board').innerHTML = html;
}
$('#wkPrev').addEventListener('click', () => { weekStart = addDays(weekStart, -7); renderBoard(); });
$('#wkNext').addEventListener('click', () => { weekStart = addDays(weekStart, 7); renderBoard(); });

function sessionsThisWeek(person) {
  const mon = iso(mondayOf(new Date()));
  return Object.values(entries).filter((d) => d.person === person && d.date >= mon && trainedOn(d)).length;
}
function renderToday() {
  const t = todayISO();
  $('#todayStatus').innerHTML = Object.keys(PEOPLE).map((p) => {
    const m = marks(p, t); const n = Math.min(sessionsThisWeek(p), 5);
    const today = m.checked ? `checked in · ${dayPoints(entries[key(p, t)])}/4` : "hasn't checked in";
    return `<b>${PEOPLE[p].name}</b> ${today} · ${n}/5 sessions this week · next up ${nextSession(p, iso(addDays(new Date(), 1)))}`;
  }).join('<br>');
}
$('#nudgeBtn').addEventListener('click', async () => {
  const t = todayISO(); const them = who === 'tom' ? 'joe' : 'tom';
  const mine = entries[key(who, t)], theirs = entries[key(them, t)];
  const mp = mine ? dayPoints(mine) : 0;
  const text = theirs
    ? `${PEOPLE[them].name}, you're on ${dayPoints(theirs)}/4 today and ${Math.min(sessionsThisWeek(them), 5)}/5 sessions this week. I'm on ${mp}/4. Get the protein in.`
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
  const lines = [];
  for (const p of Object.keys(series)) {
    const s = series[p]; if (!s.length) continue;
    g += `<polyline points="${s.map(([d, w]) => `${X(parse(d).getTime()).toFixed(1)},${Y(w).toFixed(1)}`).join(' ')}" fill="none" stroke="${col[p]}" stroke-width="2.5" stroke-linejoin="round"/>`;
    const [ld, lw] = s[s.length - 1];
    g += `<circle cx="${X(parse(ld).getTime())}" cy="${Y(lw)}" r="4.5" fill="${col[p]}"/>`;
    const avg = (from, to) => { const v = s.filter(([d]) => d > from && d <= to).map((x) => x[1]); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
    const t = todayISO(), w1 = iso(addDays(new Date(), -7)), w2 = iso(addDays(new Date(), -14));
    const a1 = avg(w1, t), a0 = avg(w2, w1);
    lines.push(`<b style="color:${col[p]}">${PEOPLE[p].name}</b>: ${a1 != null ? a1.toFixed(1) + ' kg 7-day avg' : 'no weigh-ins this week'}${a1 != null && a0 != null ? ` (${a1 - a0 >= 0 ? '+' : ''}${(a1 - a0).toFixed(1)} vs last week)` : ''}`);
  }
  $('#bwChart').innerHTML = `<div class="table-wrap"><svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Bodyweight over time">${g}</svg></div>`;
  $('#bwSummary').innerHTML = lines.join(' · ') + '. Target: +0.2 to +0.4 kg a week.';
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

function renderLive() { renderBoard(); renderToday(); renderBW(); renderLifts(); updateRestHint(); }

/* ---------- boot ---------- */
async function refresh(refill) {
  try {
    entries = await loadAll(pin);
    $('#storeBanner').hidden = true;
  } catch (e) {
    if (e.code === 'bad_pin') { local.del('lb.pin'); location.reload(); return; }
    const b = $('#storeBanner'); b.textContent = "Can't reach the shared log right now. Showing what was last loaded."; b.hidden = false;
  }
  if (refill) fillForm();
  renderLive();
}

let started = false;
function startApp() {
  if (started) return; started = true;
  $('#app').hidden = false;
  renderStatic();
  const h = location.hash.slice(1);
  showTab(TABS.includes(h) ? h : local.get('lb.tab', 'checkin'));
  $('#ciDate').value = todayISO();
  if (!shared) { const b = $('#storeBanner'); b.textContent = 'No database connected, so check-ins save on this phone only. See the README to hook up Supabase.'; b.hidden = false; }
  fillForm(); renderLive();
  refresh(true);
  if (shared) {
    setInterval(() => { if (document.visibilityState === 'visible') refresh(false); }, 30000);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') refresh(false); });
  }
}

if (shared && !pin) $('#gate').hidden = false;
else startApp();
