// Trail Companion — UI controller.
import { SPECIES, NEGATIVES, CATEGORIES } from './species.js';
import { db } from './db.js';

const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);
const META = new Map([...SPECIES, ...NEGATIVES].map(s => [s.id, s]));

// ───────────────────────── State ─────────────────────────
const state = {
  model: 'none',            // none | loading | ready | error
  device: '—', labels: 0,
  custom: [],
  current: null,            // { blob, thumb, result, chosen }
  walk: null,               // { id, start, screenMs, visibleSince }
  geo: false,
  reqId: 0,
  camStream: null,
  facingMode: 'environment', // environment | user
  guideCat: 'all',
  guideQuery: '',
};

// ───────────────────────── Worker ─────────────────────────
const worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
const pending = new Map();

worker.onmessage = ({ data }) => {
  switch (data.type) {
    case 'progress': return onProgress(data);
    case 'ready':
      state.model = 'ready'; state.device = data.device; state.labels = data.labels;
      db.set('modelReady', true);
      $('#first-run').hidden = true; $('#progress-card').hidden = true;
      updatePill(); updateSpecs();
      return;
    case 'result': {
      const cb = pending.get(data.id); pending.delete(data.id); cb?.resolve(data); return;
    }
    case 'taught': return onTaught(data);
    case 'error':
      if (data.for === 'teach') { toast('Could not load the text encoder — are you online?'); $('#btn-teach').disabled = false; return; }
      state.model = 'error'; updatePill();
      $('#progress-card').hidden = true;
      $('#first-run').hidden = false;
      for (const [, cb] of pending) cb.reject(new Error(data.message));
      pending.clear();
      toast('Model failed to load. Connect once to download it.');
  }
};

function initModel() {
  if (state.model === 'loading' || state.model === 'ready') return;
  state.model = 'loading'; updatePill();
  $('#first-run').hidden = true;
  worker.postMessage({ type: 'init' });
}

function classify(blob) {
  initModel();
  const id = ++state.reqId;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    worker.postMessage({ type: 'classify', id, blob });
  });
}

function onProgress({ stage, loaded, total }) {
  const pct = total ? Math.min(100, Math.round((loaded / total) * 100)) : 0;
  if (stage === 'vision') {
    $('#progress-card').hidden = false;
    $('#progress-label').textContent = `Downloading open model · ${(loaded / 1e6).toFixed(0)} / ${(total / 1e6).toFixed(0)} MB`;
    $('#progress-pct').textContent = pct + '%';
    $('#progress-bar').style.width = pct + '%';
    $('#model-pill-text').textContent = `Downloading ${pct}%`;
    if (pct >= 100) $('#progress-label').textContent = 'Warming up the model…';
  } else if (stage === 'text') {
    $('#btn-teach').textContent = pct ? `${pct}%` : '…';
  }
}

function updatePill() {
  const pill = $('#model-pill');
  pill.className = 'pill ' + state.model;
  $('#model-pill-text').textContent = {
    none: 'Model not downloaded', loading: 'Loading model…',
    ready: navigator.onLine ? 'Offline-ready' : 'Offline · on-device', error: 'Model error',
  }[state.model];
}

function updateSpecs() {
  $('#spec-device').textContent = state.model === 'ready' ? `${state.device.toUpperCase()} (in this browser)` : 'Not loaded';
  $('#spec-labels').textContent = state.labels ? `${state.labels} labels (${state.custom.length} taught by you)` : `${SPECIES.length + state.custom.length} species`;
  $('#spec-net').textContent = navigator.onLine ? 'Online — but not used for inference' : 'Offline ✓';
}

// ───────────────────────── Audio Synthesizer (Sound of the Trail) ─────────────────────────
let audioCtx;
function getAudioContext() {
  audioCtx ??= new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function playNatureAudio(cat = 'bird', speciesId = '') {
  try {
    const ctx = getAudioContext();
    const t = ctx.currentTime;

    if (cat === 'bird') {
      // Synthesize realistic birdsong: cheerful frequency-swept chirps
      const notes = [
        { start: 0.0, dur: 0.12, f0: 2400, f1: 3200 },
        { start: 0.16, dur: 0.14, f0: 3100, f1: 2200 },
        { start: 0.35, dur: 0.18, f0: 2600, f1: 3400 },
        { start: 0.58, dur: 0.22, f0: 3200, f1: 1900 },
      ];
      notes.forEach(({ start, dur, f0, f1 }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f0, t + start);
        osc.frequency.exponentialRampToValueAtTime(f1, t + start + dur);

        gain.gain.setValueAtTime(0, t + start);
        gain.gain.linearRampToValueAtTime(0.25, t + start + dur * 0.2);
        gain.gain.exponentialRampToValueAtTime(0.001, t + start + dur);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t + start);
        osc.stop(t + start + dur);
      });
      toast('🎶 Playing bird call whistle');
    } else if (cat === 'tree') {
      // Wind whisper through autumn leaves
      const bufferSize = ctx.sampleRate * 1.5;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(450, t);
      filter.frequency.exponentialRampToValueAtTime(850, t + 0.8);
      filter.frequency.exponentialRampToValueAtTime(350, t + 1.4);
      filter.Q.value = 3.0;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.18, t + 0.4);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 1.5);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      noise.start(t);
      toast('🍃 Rustling autumn leaves');
    } else {
      // Gentle natural wood chime for flowers, fungi, and insects
      const freqs = [520, 650, 780];
      freqs.forEach((f, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(f, t + i * 0.12);

        gain.gain.setValueAtTime(0, t + i * 0.12);
        gain.gain.linearRampToValueAtTime(0.2, t + i * 0.12 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.12 + 0.6);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t + i * 0.12);
        osc.stop(t + i * 0.12 + 0.6);
      });
      toast('✨ Nature chime');
    }
    // Tactile confirmation
    if ('vibrate' in navigator) navigator.vibrate([30, 40, 30]);
  } catch (err) {
    console.warn('Audio not available:', err);
  }
}

// ───────────────────────── Live Camera Viewfinder ─────────────────────────
async function startLiveCamera() {
  try {
    stopLiveCamera();
    const constraints = {
      video: {
        facingMode: { ideal: state.facingMode },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: false,
    };
    state.camStream = await navigator.mediaDevices.getUserMedia(constraints);
    const video = $('#live-video');
    video.srcObject = state.camStream;
    await video.play();
    $('#live-cam-box').hidden = false;
    $('#shutter-row').hidden = true;
    $('#btn-toggle-cam').textContent = '✕ Switch to Upload Mode';
  } catch (err) {
    console.warn('Camera stream error:', err);
    toast('Could not access live camera. Using photo upload instead.');
    stopLiveCamera();
  }
}

function stopLiveCamera() {
  if (state.camStream) {
    state.camStream.getTracks().forEach(t => t.stop());
    state.camStream = null;
  }
  $('#live-cam-box').hidden = true;
  $('#shutter-row').hidden = false;
  $('#btn-toggle-cam').textContent = '📹 Open Live Viewfinder';
}

function flipLiveCamera() {
  state.facingMode = state.facingMode === 'environment' ? 'user' : 'environment';
  startLiveCamera();
}

async function captureLiveFrame() {
  const video = $('#live-video');
  if (!video.videoWidth) return;
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  canvas.toBlob(blob => {
    if (blob) {
      stopLiveCamera(); // save battery once captured
      handlePhoto(blob);
    }
  }, 'image/jpeg', 0.9);
}

// ───────────────────────── Identify ─────────────────────────
async function prepareImage(fileOrBlob) {
  const bmp = await createImageBitmap(fileOrBlob, { imageOrientation: 'from-image' });
  const draw = (max, type, q) => {
    const s = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    return { canvas: c, toBlob: () => new Promise(r => c.toBlob(r, type, q)) };
  };
  const full = await draw(768, 'image/jpeg', 0.9).toBlob();
  const thumb = draw(420, 'image/jpeg', 0.78).canvas.toDataURL('image/jpeg', 0.78);
  return { blob: full, thumb };
}

async function handlePhoto(fileOrBlob) {
  const card = $('#result');
  card.hidden = false; card.classList.remove('not-nature');
  $('#result-body').hidden = true;
  $('#scanning').hidden = false;
  card.scrollIntoView({ behavior: 'smooth', block: 'start' });

  try {
    const { blob, thumb } = await prepareImage(fileOrBlob);
    $('#result-img').src = thumb;
    const result = await classify(blob);
    state.current = { blob, thumb, result, chosen: result.top[0] };
    renderResult();
  } catch (err) {
    console.error(err);
    $('#scanning').hidden = true;
    card.hidden = true;
  }
}

function infoFor(label) {
  if (label.custom) {
    const c = state.custom.find(x => x.id === label.id);
    return { ...c, sci: 'Taught by you', fact: `You taught Trail Companion this one — that's the power of an open, zero-shot model.`,
      next: 'Look closely: what features make it different from its neighbours?' };
  }
  return META.get(label.id) || label;
}

function renderResult() {
  const { result, chosen } = state.current;
  const info = infoFor(chosen);
  const notNature = (result.categories.none || 0) > 0.5;
  const conf = chosen.prob;
  const cat = CATEGORIES[chosen.cat] || CATEGORIES.none;

  $('#scanning').hidden = true;
  $('#result-body').hidden = false;
  $('#result').classList.toggle('not-nature', notNature);
  $('#result-cat').textContent = `${cat.emoji} ${cat.label}`;
  $('#result-meta').textContent = `${result.ms} ms · on-device`;

  // Sound cue button configuration
  const btnSound = $('#btn-sound');
  btnSound.textContent = chosen.cat === 'bird' ? '🔊 Bird Call' : (chosen.cat === 'tree' ? '🍃 Wind Cue' : '✨ Nature Tone');

  if (notNature) {
    $('#result-name').textContent = 'That\'s not grass 📵';
    $('#result-sci').textContent = `Looks like: ${info.name.toLowerCase()}`;
    $('#result-fact').textContent = 'Trail Companion only knows living things. Step outside and point it at a leaf, bird, flower, mushroom or bug.';
    $('#result-next').textContent = 'Put the phone down, open a door, and find the nearest tree. We\'ll wait.';
    $('#result-warn').hidden = true;
    $('#btn-save').hidden = true;
  } else {
    $('#result-name').textContent = (conf < 0.25 ? 'Maybe ' : '') + info.name;
    $('#result-sci').textContent = info.sci || '';
    $('#result-fact').textContent = info.fact || '';
    $('#result-next').textContent = info.next || '';
    const warn = chosen.cat === 'fungi'
      ? `${info.toxic ? '☠️ Poisonous. ' : ''}Never eat a wild mushroom based on an app — many deadly species have edible look-alikes.`
      : (conf < 0.25 ? 'Low confidence — try filling the frame with a single leaf, flower or animal.' : '');
    $('#result-warn').textContent = warn;
    $('#result-warn').hidden = !warn;
    $('#btn-save').hidden = false;
    $('#btn-save').disabled = false;
    $('#btn-save').textContent = 'Save to journal';
  }

  const pct = Math.round(conf * 100);
  $('#result-conf').textContent = `${pct}%`;
  requestAnimationFrame(() => { $('#result-conf-bar').style.width = pct + '%'; });

  const alts = $('#result-alts'); alts.innerHTML = '';
  for (const t of result.top) {
    if (t.id === chosen.id) continue;
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.innerHTML = `<span>${(CATEGORIES[t.cat] || CATEGORIES.none).emoji} ${escapeHtml(t.name)}</span><span class="muted">${Math.round(t.prob * 100)}%</span>`;
    b.onclick = () => { state.current.chosen = t; renderResult(); };
    li.append(b); alts.append(li);
  }
}

async function saveFind() {
  const { thumb, chosen } = state.current;
  const info = infoFor(chosen);
  const btn = $('#btn-save'); btn.disabled = true;
  const find = {
    id: crypto.randomUUID(), ts: Date.now(), speciesId: chosen.id, name: info.name, sci: info.sci || '',
    cat: chosen.cat, conf: chosen.prob, thumb, walkId: state.walk?.id || null,
  };
  if (state.geo && 'geolocation' in navigator) {
    try {
      const pos = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }));
      find.lat = +pos.coords.latitude.toFixed(5); find.lon = +pos.coords.longitude.toFixed(5);
    } catch { /* GPS optional */ }
  }
  await db.put('finds', find);
  btn.textContent = 'Saved ✓';
  toast(`${info.name} added to your journal. Now pocket the phone 🌿`);
  await Promise.all([renderJournal(), renderBingo(), renderWalk(), checkBadges()]);
}

// ───────────────────────── Walk mode ─────────────────────────
async function toggleWalk() {
  if (state.walk) {
    const w = state.walk;
    if (!document.hidden) w.screenMs += Date.now() - w.visibleSince;
    const finds = (await db.all('finds')).filter(f => f.walkId === w.id).length;
    const walk = { id: w.id, start: w.start, end: Date.now(), screenMs: w.screenMs, finds };
    await db.put('walks', walk);
    await db.set('activeWalk', null);
    state.walk = null;
    const pctOff = offscreenPct(walk.end - walk.start, walk.screenMs);
    toast(`Walk saved: ${fmtDur(walk.end - walk.start)} outside, ${pctOff}% off-screen. Nice. 🥾`);
    await checkBadges();
  } else {
    state.walk = { id: crypto.randomUUID(), start: Date.now(), screenMs: 0, visibleSince: Date.now() };
    await persistWalk();
    toast('Walk started. Pocket your phone — we\'re counting screen-free time.');
  }
  renderWalk(); renderWalkList(); renderBingo();
}

const persistWalk = () => db.set('activeWalk', state.walk);
const offscreenPct = (total, screen) => total > 0 ? Math.max(0, Math.min(100, Math.round(100 * (1 - screen / total)))) : 0;

let visibleTimer;
document.addEventListener('visibilitychange', () => {
  const w = state.walk;
  if (w) {
    if (document.hidden) w.screenMs += Date.now() - w.visibleSince;
    else w.visibleSince = Date.now();
    persistWalk();
  }
  clearTimeout(visibleTimer);
  if (!document.hidden && w) visibleTimer = setTimeout(showNudge, 60_000);
  if (!document.hidden) renderWalk();
});

function showNudge() {
  if (!state.walk || document.hidden) return;
  const n = $('#nudge'); n.hidden = false;
  setTimeout(() => { n.hidden = true; }, 6000);
}

async function renderWalk() {
  const w = state.walk;
  const btn = $('#btn-walk');
  btn.textContent = w ? 'Finish walk' : 'Start walk';
  btn.classList.toggle('walking', !!w);
  let total = 0, screen = 0, finds = 0;
  if (w) {
    total = Date.now() - w.start;
    screen = w.screenMs + (document.hidden ? 0 : Date.now() - w.visibleSince);
    finds = (await db.all('finds')).filter(f => f.walkId === w.id).length;
  }
  $('#walk-time').textContent = fmtDur(total);
  $('#walk-screen').textContent = fmtDur(screen);
  $('#walk-finds').textContent = finds;
  const pct = w ? offscreenPct(total, screen) : null;
  $('#offscreen-pct').textContent = pct === null ? '—' : pct + '%';
  $('#offscreen-ring').style.strokeDashoffset = 326.7 * (1 - (pct || 0) / 100);
}

async function renderWalkList() {
  const walks = (await db.all('walks')).sort((a, b) => b.start - a.start).slice(0, 8);
  const ul = $('#walk-list');
  if (!walks.length) { ul.innerHTML = '<li class="muted">No walks yet. The trail is waiting.</li>'; return; }
  ul.innerHTML = walks.map(w => `<li><span>${new Date(w.start).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} · ${fmtDur(w.end - w.start)}</span>
    <span><b>${offscreenPct(w.end - w.start, w.screenMs)}%</b> off-screen · ${w.finds} finds</span></li>`).join('');
}

// ───────────────────────── Trail Badges System ─────────────────────────
const BADGES = [
  { id: 'first_find', name: 'First Step', icon: '🌱', desc: 'Identify your 1st wild species', test: (f) => f.length >= 1 },
  { id: 'tree_scout', name: 'Foliage Scout', icon: '🍁', desc: 'Find 2 autumn trees or leaves', test: (f) => f.filter(x => x.cat === 'tree').length >= 2 },
  { id: 'bird_watcher', name: 'Songbird Seeker', icon: '🐦', desc: 'Spot a bird on the trail', test: (f) => f.some(x => x.cat === 'bird') },
  { id: 'fungi_forager', name: 'Mushroom Hunter', icon: '🍄', desc: 'Identify a wild fungus', test: (f) => f.some(x => x.cat === 'fungi') },
  { id: 'bug_explorer', name: 'Pollinator Pal', icon: '🦋', desc: 'Spot a bug or butterfly', test: (f) => f.some(x => x.cat === 'insect') },
  { id: 'true_grass', name: 'True Grass Toucher', icon: '🥾', desc: 'Finish a walk with ≥80% off-screen', test: (_, w) => w.some(x => offscreenPct(x.end - x.start, x.screenMs) >= 80) },
  { id: 'gps_mapper', name: 'Trail Mapper', icon: '🧭', desc: 'Save a find tagged with GPS', test: (f) => f.some(x => x.lat != null) },
  { id: 'field_scientist', name: 'Field Naturalist', icon: '🔬', desc: 'Discover 5 distinct species', test: (f) => new Set(f.map(x => x.speciesId)).size >= 5 },
];

async function checkBadges() {
  const finds = await db.all('finds');
  const walks = await db.all('walks');
  const stored = (await db.get('badges')) || {};
  let newlyUnlocked = 0;

  for (const b of BADGES) {
    if (!stored[b.id] && b.test(finds, walks)) {
      stored[b.id] = Date.now();
      newlyUnlocked++;
      toast(`🏅 Badge Unlocked: ${b.name}!`);
    }
  }
  if (newlyUnlocked > 0) {
    await db.set('badges', stored);
  }
  renderBadges(stored);
}

async function renderBadges(unlockedMap) {
  const stored = unlockedMap || ((await db.get('badges')) || {});
  const container = $('#badge-grid');
  let count = 0;
  container.innerHTML = BADGES.map(b => {
    const isUnlocked = !!stored[b.id];
    if (isUnlocked) count++;
    return `
      <div class="badge-card ${isUnlocked ? 'unlocked' : ''}">
        <span class="badge-icon">${b.icon}</span>
        <div class="badge-info">
          <span class="badge-name">${escapeHtml(b.name)}</span>
          <span class="badge-desc">${escapeHtml(b.desc)}</span>
        </div>
      </div>
    `;
  }).join('');
  $('#badge-count').textContent = `${count} / ${BADGES.length} Unlocked`;
}

// ───────────────────────── Bingo ─────────────────────────
const BINGO = [
  { e: '🐦', t: 'A bird', test: f => f.some(x => x.cat === 'bird') },
  { e: '🍁', t: 'A tree or leaf', test: f => f.some(x => x.cat === 'tree') },
  { e: '🌼', t: 'A flower', test: f => f.some(x => x.cat === 'flower') },
  { e: '🍄', t: 'A fungus', test: f => f.some(x => x.cat === 'fungi') },
  { e: '🚪', t: 'Step outside', test: (_, walked) => walked },
  { e: '🐞', t: 'A bug', test: f => f.some(x => x.cat === 'insect') },
  { e: '❤️', t: 'Something red', test: f => f.some(x => META.get(x.speciesId)?.tags?.includes('red')) },
  { e: '💛', t: 'Something yellow', test: f => f.some(x => META.get(x.speciesId)?.tags?.includes('yellow')) },
  { e: '🖐️', t: '5 species', test: f => new Set(f.map(x => x.speciesId)).size >= 5 },
];

async function renderBingo() {
  const today = new Date().toDateString();
  const finds = (await db.all('finds')).filter(f => new Date(f.ts).toDateString() === today);
  const walked = !!state.walk || (await db.all('walks')).some(w => new Date(w.start).toDateString() === today);
  let n = 0;
  $('#bingo').innerHTML = BINGO.map(c => {
    const done = c.test(finds, walked); if (done) n++;
    return `<div class="cell ${done ? 'done' : ''}"><span class="e">${c.e}</span>${c.t}</div>`;
  }).join('');
  $('#bingo-count').textContent = `${n} / 9`;
}

// ───────────────────────── Field Guide View ─────────────────────────
function renderFieldGuide() {
  const query = state.guideQuery.toLowerCase().trim();
  const cat = state.guideCat;
  const list = $('#guide-list');

  const allItems = [...SPECIES, ...state.custom.map(c => ({
    ...c,
    sci: 'Taught on-device',
    fact: 'Custom zero-shot species added by you.',
    next: 'Notice unique shapes and color hues.',
  }))];

  const filtered = allItems.filter(s => {
    if (cat !== 'all' && s.cat !== cat) return false;
    if (query) {
      const matchName = s.name.toLowerCase().includes(query);
      const matchSci = (s.sci || '').toLowerCase().includes(query);
      const matchFact = (s.fact || '').toLowerCase().includes(query);
      return matchName || matchSci || matchFact;
    }
    return true;
  });

  $('#guide-count').textContent = `${filtered.length} of ${allItems.length} species`;

  if (!filtered.length) {
    list.innerHTML = '<p class="muted center">No species matched your search. You can teach a new one in settings!</p>';
    return;
  }

  list.innerHTML = filtered.map(s => {
    const categoryObj = CATEGORIES[s.cat] || { emoji: '🌿', label: s.cat };
    return `
      <article class="guide-card">
        <div class="guide-card-head">
          <div>
            <h3 class="guide-card-title">${categoryObj.emoji} ${escapeHtml(s.name)}</h3>
            <p class="guide-card-sci">${escapeHtml(s.sci || '')}</p>
          </div>
          ${s.cat === 'bird' ? `<button class="chip sound-btn guide-sound-btn" data-cat="bird" data-id="${s.id}" type="button">🔊 Call</button>` : ''}
        </div>
        <p class="guide-card-fact">${escapeHtml(s.fact || '')}</p>
        <p class="guide-card-tip"><b>Trail cue:</b> ${escapeHtml(s.next || '')}</p>
      </article>
    `;
  }).join('');

  $$('.guide-sound-btn').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      playNatureAudio('bird', btn.dataset.id);
    };
  });
}

// ───────────────────────── Journal ─────────────────────────
async function renderJournal() {
  const finds = (await db.all('finds')).sort((a, b) => b.ts - a.ts);
  $('#journal-empty').hidden = finds.length > 0;
  $('#j-finds').textContent = finds.length;
  $('#j-species').textContent = new Set(finds.map(f => f.speciesId)).size;
  $('#j-cats').textContent = `${new Set(finds.map(f => f.cat)).size}/5`;
  const grid = $('#journal-grid'); grid.innerHTML = '';
  finds.forEach((f, i) => {
    const el = document.createElement('figure');
    el.className = 'find'; el.style.animationDelay = `${Math.min(i, 12) * 40}ms`; el.style.margin = '0';
    el.innerHTML = `<img src="${f.thumb}" alt="${escapeHtml(f.name)}" loading="lazy" />
      <button class="del" type="button" aria-label="Delete ${escapeHtml(f.name)}">✕</button>
      <figcaption class="cap"><b>${CATEGORIES[f.cat]?.emoji || ''} ${escapeHtml(f.name)}</b>
      <span>${new Date(f.ts).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}${f.lat ? ' · 📍' : ''} · ${Math.round(f.conf * 100)}%</span></figcaption>`;
    el.querySelector('.del').onclick = async () => { await db.del('finds', f.id); renderJournal(); renderBingo(); checkBadges(); };
    grid.append(el);
  });
}

async function exportGeoJSON() {
  const finds = await db.all('finds');
  const fc = {
    type: 'FeatureCollection',
    features: finds.map(f => ({
      type: 'Feature',
      geometry: f.lat != null ? { type: 'Point', coordinates: [f.lon, f.lat] } : null,
      properties: { name: f.name, scientific_name: f.sci, category: f.cat, confidence: +f.conf.toFixed(3), observed_at: new Date(f.ts).toISOString(), identified_by: 'CLIP ViT-B/16 (on-device)' },
    })),
  };
  const url = URL.createObjectURL(new Blob([JSON.stringify(fc, null, 2)], { type: 'application/geo+json' }));
  Object.assign(document.createElement('a'), { href: url, download: `trail-journal-${new Date().toISOString().slice(0, 10)}.geojson` }).click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// ───────────────────────── Nature Passport Canvas ─────────────────────────
async function openPassportDialog() {
  const canvas = $('#passport-canvas');
  const ctx = canvas.getContext('2d');
  const finds = (await db.all('finds')).sort((a, b) => b.ts - a.ts);
  const walks = await db.all('walks');
  const badges = (await db.get('badges')) || {};

  // Background
  const grad = ctx.createLinearGradient(0, 0, 800, 1000);
  grad.addColorStop(0, '#0d2218');
  grad.addColorStop(0.5, '#07150f');
  grad.addColorStop(1, '#050c09');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 800, 1000);

  // Border frame
  ctx.strokeStyle = '#2f7551';
  ctx.lineWidth = 4;
  ctx.strokeRect(28, 28, 744, 944);
  ctx.strokeStyle = '#43a571';
  ctx.lineWidth = 1;
  ctx.strokeRect(36, 36, 728, 928);

  // Header Title
  ctx.fillStyle = '#6ee7a8';
  ctx.font = 'bold 36px Outfit, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('TRAIL COMPANION', 400, 95);

  ctx.fillStyle = '#fef08a';
  ctx.font = 'italic 22px Georgia, serif';
  ctx.fillText('Official Field Passport · Touch Grass 2026', 400, 130);

  // Date and location line
  ctx.fillStyle = '#9ca3af';
  ctx.font = '16px Outfit, sans-serif';
  ctx.fillText(`Recorded: ${new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`, 400, 165);

  // Stats Bar (3 boxes)
  const statBoxY = 195;
  const boxW = 210;
  const boxH = 90;
  const boxes = [
    { label: 'SPECIES FOUND', val: `${new Set(finds.map(f => f.speciesId)).size}`, x: 60 },
    { label: 'WALKS LOGGED', val: `${walks.length}`, x: 295 },
    { label: 'TRAIL BADGES', val: `${Object.keys(badges).length} / 8`, x: 530 },
  ];

  boxes.forEach(b => {
    ctx.fillStyle = 'rgba(20, 56, 40, 0.7)';
    ctx.strokeStyle = 'rgba(110, 231, 168, 0.25)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(b.x, statBoxY, boxW, boxH, 12);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 32px Outfit, sans-serif';
    ctx.fillText(b.val, b.x + boxW / 2, statBoxY + 45);

    ctx.fillStyle = '#86efac';
    ctx.font = '600 12px Outfit, sans-serif';
    ctx.fillText(b.label, b.x + boxW / 2, statBoxY + 72);
  });

  // Recent Wild Observations (up to 3 photos)
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 22px Outfit, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('RECENT NATURE FINDS', 60, 335);

  const photoY = 355;
  const thumbW = 210;
  const thumbH = 260;

  if (finds.length === 0) {
    ctx.fillStyle = '#6b7280';
    ctx.font = 'italic 18px Outfit, sans-serif';
    ctx.fillText('No finds recorded yet. Snap a leaf, bird, or flower on the trail!', 60, 420);
  } else {
    const topFinds = finds.slice(0, 3);
    for (let i = 0; i < topFinds.length; i++) {
      const f = topFinds[i];
      const posX = 60 + i * (thumbW + 25);

      // Card container
      ctx.fillStyle = '#0f291e';
      ctx.beginPath();
      ctx.roundRect(posX, photoY, thumbW, thumbH, 14);
      ctx.fill();

      // Load image
      try {
        const img = new Image();
        img.src = f.thumb;
        await new Promise((res) => { img.onload = res; img.onerror = res; });
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(posX, photoY, thumbW, thumbH - 60, 14);
        ctx.clip();
        ctx.drawImage(img, posX, photoY, thumbW, thumbH - 60);
        ctx.restore();
      } catch (e) {
        console.warn('Could not draw thumb', e);
      }

      // Label
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 15px Outfit, sans-serif';
      ctx.fillText(f.name.slice(0, 18), posX + 10, photoY + thumbH - 34);
      ctx.fillStyle = '#86efac';
      ctx.font = '12px Outfit, sans-serif';
      ctx.fillText(`${CATEGORIES[f.cat]?.emoji || ''} ${Math.round(f.conf * 100)}% match`, posX + 10, photoY + thumbH - 14);
    }
  }

  // Active Badges Row
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 22px Outfit, sans-serif';
  ctx.fillText('TRAIL BADGES EARNED', 60, 665);

  const badgeY = 690;
  const badgeCardW = 160;
  const activeBadges = BADGES.filter(b => badges[b.id]).slice(0, 4);

  if (activeBadges.length === 0) {
    ctx.fillStyle = '#6b7280';
    ctx.font = 'italic 16px Outfit, sans-serif';
    ctx.fillText('Complete walks and identify species to earn outdoor trail badges.', 60, 740);
  } else {
    activeBadges.forEach((b, i) => {
      const bX = 60 + i * (badgeCardW + 16);
      ctx.fillStyle = 'rgba(30, 80, 55, 0.4)';
      ctx.strokeStyle = '#4ade80';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(bX, badgeY, badgeCardW, 110, 12);
      ctx.fill();
      ctx.stroke();

      ctx.font = '36px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(b.icon, bX + badgeCardW / 2, badgeY + 48);

      ctx.fillStyle = '#f0fdf4';
      ctx.font = 'bold 13px Outfit, sans-serif';
      ctx.fillText(b.name, bX + badgeCardW / 2, badgeY + 82);
    });
  }

  // Footer & Watermark
  ctx.fillStyle = '#22c55e';
  ctx.textAlign = 'center';
  ctx.font = '600 14px Outfit, sans-serif';
  ctx.fillText('🌱 100% On-Device AI · Open-Weight CLIP ViT-B/16 · Zero Data Leaked to Servers', 400, 890);

  ctx.fillStyle = '#6b7280';
  ctx.font = '13px Outfit, sans-serif';
  ctx.fillText('Built with open-source Transformers.js for Hacktoberfest 2026', 400, 915);

  $('#passport-dialog').showModal();
}

function downloadPassport() {
  const canvas = $('#passport-canvas');
  const link = document.createElement('a');
  link.download = `trail-companion-passport-${new Date().toISOString().slice(0, 10)}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
  toast('Passport downloaded! 🎨');
}

// ───────────────────────── Teach a species ─────────────────────────
function teach() {
  const name = $('#teach-name').value.trim();
  if (!name) return $('#teach-name').focus();
  $('#btn-teach').disabled = true; $('#btn-teach').textContent = '…';
  worker.postMessage({ type: 'teach', name, cat: $('#teach-cat').value, id: 'custom-' + crypto.randomUUID().slice(0, 8) });
}

async function onTaught(c) {
  state.custom.push(c);
  await db.set('custom', state.custom);
  worker.postMessage({ type: 'setCustom', custom: state.custom });
  state.labels = state.labels ? state.labels + 1 : 0;
  $('#teach-name').value = '';
  $('#btn-teach').disabled = false; $('#btn-teach').textContent = 'Teach';
  renderCustom(); updateSpecs(); renderFieldGuide();
  await checkBadges();
  toast(`Learned "${c.name}" — no retraining needed.`);
}

function renderCustom() {
  const ul = $('#custom-list'); ul.innerHTML = '';
  for (const c of state.custom) {
    const li = document.createElement('li');
    li.innerHTML = `<span class="chip">${CATEGORIES[c.cat]?.emoji || ''} ${escapeHtml(c.name)} <button class="icon-btn" type="button" aria-label="Remove ${escapeHtml(c.name)}">✕</button></span>`;
    li.querySelector('button').onclick = async () => {
      state.custom = state.custom.filter(x => x.id !== c.id);
      await db.set('custom', state.custom);
      worker.postMessage({ type: 'setCustom', custom: state.custom });
      if (state.labels) state.labels--;
      renderCustom(); updateSpecs(); renderFieldGuide();
    };
    ul.append(li);
  }
}

// ───────────────────────── Routing & utils ─────────────────────────
function route() {
  const v = (location.hash || '#home').slice(1);
  const alias = (v === 'identify') ? 'scanner' : v;
  const valid = ['home', 'scanner', 'guide', 'walk', 'journal', 'settings'];
  const name = valid.includes(alias) ? alias : 'home';

  document.querySelectorAll('.view-section').forEach(el => {
    el.classList.toggle('active', el.id === `view-${name}`);
  });
  document.querySelectorAll('.nav-menu a').forEach(el => {
    el.classList.toggle('active', el.id === `nav-${name}`);
  });
  window.scrollTo({ top: 0 });
  if (name === 'guide') renderFieldGuide();
  if (name === 'settings') updateSpecs();
}

function fmtDur(ms) {
  const s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}
function escapeHtml(s = '') { return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
let toastTimer;
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 3500);
}

// ───────────────────────── Wire up ─────────────────────────
$('#photo-input').addEventListener('change', (e) => { const f = e.target.files?.[0]; if (f) handlePhoto(f); e.target.value = ''; });
$('#shutter').addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('#photo-input').click(); } });
document.querySelectorAll('.sample').forEach(b => b.addEventListener('click', async () => handlePhoto(await (await fetch(b.dataset.src)).blob())));
$('#btn-download').addEventListener('click', initModel);
$('#btn-save').addEventListener('click', saveFind);
$('#btn-again').addEventListener('click', () => $('#photo-input').click());
$('#btn-walk').addEventListener('click', toggleWalk);
$('#btn-export').addEventListener('click', exportGeoJSON);
$('#btn-teach').addEventListener('click', teach);
$('#teach-name').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); teach(); } });
$('#model-pill').addEventListener('click', () => { location.hash = '#settings'; });

// Live Camera buttons
$('#btn-toggle-cam').addEventListener('click', () => {
  if (state.camStream) stopLiveCamera(); else startLiveCamera();
});
$('#btn-snap-live').addEventListener('click', captureLiveFrame);
$('#btn-flip-cam').addEventListener('click', flipLiveCamera);
$('#btn-close-cam').addEventListener('click', stopLiveCamera);

// Audio Cue button in Result Card
$('#btn-sound').addEventListener('click', () => {
  if (state.current?.chosen) {
    playNatureAudio(state.current.chosen.cat, state.current.chosen.id);
  }
});

// Field Guide filters & search
$('#guide-search').addEventListener('input', (e) => {
  state.guideQuery = e.target.value;
  renderFieldGuide();
});
$$('.filter-chip').forEach(btn => {
  btn.addEventListener('click', () => {
    $$('.filter-chip').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.guideCat = btn.dataset.cat;
    renderFieldGuide();
  });
});

// Passport Modal buttons
$('#btn-passport').addEventListener('click', openPassportDialog);
$('#btn-close-passport').addEventListener('click', () => $('#passport-dialog').close());
$('#btn-download-passport').addEventListener('click', downloadPassport);

// Clear data
$('#btn-clear').addEventListener('click', async () => {
  if (!confirm('Delete all finds, walks, badges and taught species from this device?')) return;
  await db.clear(); state.custom = []; state.walk = null;
  worker.postMessage({ type: 'setCustom', custom: [] });
  renderCustom(); renderJournal(); renderBingo(); renderWalk(); renderWalkList(); renderBadges({}); renderFieldGuide();
  toast('All local data deleted.');
});

$('#geo-toggle').addEventListener('change', async (e) => {
  state.geo = e.target.checked; await db.set('geo', state.geo);
  if (state.geo) navigator.geolocation?.getCurrentPosition(() => {}, () => toast('Location permission denied.'));
});

window.addEventListener('hashchange', route);
window.addEventListener('online', () => { updatePill(); updateSpecs(); });
window.addEventListener('offline', () => { updatePill(); updateSpecs(); toast('You\'re offline. Identification still works. 🌲'); });
setInterval(() => { if (state.walk && !document.hidden) renderWalk(); }, 1000);

(async function boot() {
  route();
  const [ready, custom, walk, geo] = await Promise.all([db.get('modelReady'), db.get('custom'), db.get('activeWalk'), db.get('geo')]);
  state.custom = custom || [];
  state.geo = !!geo; $('#geo-toggle').checked = state.geo;
  if (walk) { state.walk = { ...walk, visibleSince: Date.now() }; }
  worker.postMessage({ type: 'setCustom', custom: state.custom });
  if (ready) initModel(); else $('#first-run').hidden = false;
  updatePill(); updateSpecs(); renderCustom();
  renderJournal(); renderBingo(); renderWalk(); renderWalkList();
  await checkBadges();
  renderFieldGuide();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(console.warn);
})();
