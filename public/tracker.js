// Asset Tracker — browse projects → assets → versions, inspect provenance.

const $ = (sel) => document.querySelector(sel);
const el = (tag, props = {}, ...kids) => {
  const n = Object.assign(document.createElement(tag), props);
  for (const k of kids) n.append(k?.nodeType ? k : document.createTextNode(k ?? ''));
  return n;
};
const api = (url, opts) => fetch(url, opts).then((r) => r.json());

const GLYPH = { image: '🖼️', video: '🎞️', '3d': '🧊', audio: '🎵' };

const state = { projects: [], activeProject: null, activeAsset: null };

// ── Header: config + scan ─────────────────────────────────────

async function loadConfig() {
  const cfg = await api('/api/config');
  $('#outdir').value = cfg.outputDir || '';
}

$('#btn-save-dir').addEventListener('click', async () => {
  await api('/api/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ outputDir: $('#outdir').value }),
  });
  flash('Saved output directory');
});

$('#btn-scan').addEventListener('click', async () => {
  const btn = $('#btn-scan');
  btn.disabled = true;
  btn.textContent = '⟳ Scanning…';
  try {
    await api('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ outputDir: $('#outdir').value }),
    });
    const res = await api('/api/ingest', { method: 'POST' });
    if (!res.ok) flash(res.error || 'Scan failed', true);
    else flash(`Scanned ${res.scanned} files · ${res.inserted} new`);
    await refresh();
  } finally {
    btn.disabled = false;
    btn.textContent = '⟳ Scan';
  }
});

let flashTimer;
function flash(msg, isError) {
  const s = $('#stat-line');
  s.textContent = msg;
  s.style.color = isError ? '#e06a6a' : '';
  clearTimeout(flashTimer);
  flashTimer = setTimeout(updateStats, 2500);
}

async function updateStats() {
  const s = await api('/api/stats');
  const line = $('#stat-line');
  line.style.color = '';
  line.innerHTML = `<b>${s.projects}</b> projects · <b>${s.assets}</b> assets · <b>${s.versions}</b> versions`;
}

// ── Sidebar: projects ─────────────────────────────────────────

async function loadProjects() {
  state.projects = await api('/api/projects');
  const wrap = $('#projects');
  wrap.innerHTML = '';
  if (!state.projects.length) {
    wrap.append(el('div', { className: 'empty', style: 'padding:20px;font-size:12px' }, 'No projects yet'));
    return;
  }
  for (const p of state.projects) {
    const row = el(
      'div',
      { className: 'proj' + (state.activeProject === p.id ? ' active' : '') },
      el('span', {}, p.name),
      el('span', { className: 'count' }, `${p.asset_count}`),
    );
    row.addEventListener('click', () => openProject(p.id));
    wrap.append(row);
  }
}

// ── Views ─────────────────────────────────────────────────────

function setCrumb(...parts) {
  const bc = $('#breadcrumb');
  bc.innerHTML = '';
  parts.forEach((part, i) => {
    if (i) bc.append(el('span', { className: 'sep' }, '/'));
    if (part.onClick) {
      const a = el('a', {}, part.label);
      a.addEventListener('click', part.onClick);
      bc.append(a);
    } else {
      bc.append(el('span', {}, part.label));
    }
  });
}

async function openHome() {
  state.activeProject = null;
  state.activeAsset = null;
  loadProjects();
  setCrumb({ label: 'Recent' });
  const recent = await api('/api/recent?limit=60');
  const content = $('#content');
  content.innerHTML = '';
  if (!recent.length) {
    content.append(
      el('div', { className: 'empty' },
        el('div', { style: 'font-size:40px' }, '🎬'),
        el('p', {}, 'No assets tracked yet.'),
        el('p', { style: 'font-size:13px' },
          'Point at your comfyui-canvas output directory above and hit Scan.')),
    );
    return;
  }
  const grid = el('div', { className: 'grid' });
  for (const v of recent) grid.append(versionCard(v, true));
  content.append(grid);
}

async function openProject(id) {
  state.activeProject = id;
  state.activeAsset = null;
  loadProjects();
  const proj = state.projects.find((p) => p.id === id);
  setCrumb({ label: 'Recent', onClick: openHome }, { label: proj?.name || 'Project' });
  const assets = await api(`/api/projects/${id}/assets`);
  const content = $('#content');
  content.innerHTML = '';
  const grid = el('div', { className: 'grid' });
  for (const a of assets) grid.append(assetCard(a));
  content.append(grid);
}

async function openAsset(id) {
  const { asset, versions } = await api(`/api/assets/${id}`);
  state.activeAsset = id;
  const proj = state.projects.find((p) => p.id === asset.project_id);
  setCrumb(
    { label: 'Recent', onClick: openHome },
    { label: proj?.name || 'Project', onClick: () => openProject(asset.project_id) },
    { label: asset.name },
  );
  const content = $('#content');
  content.innerHTML = '';
  content.append(el('div', { className: 'vstrip' },
    el('strong', {}, asset.name),
    el('span', { className: 'vno' }, `${versions.length} version${versions.length !== 1 ? 's' : ''}`)));
  const grid = el('div', { className: 'grid' });
  for (const v of versions) grid.append(versionCard({ ...v, asset_name: asset.name }, false));
  content.append(grid);
}

// ── Cards ─────────────────────────────────────────────────────

function thumbFor(v) {
  const t = el('div', { className: 'thumb' });
  t.append(el('span', { className: 'badge' }, v.media_type || '?'));
  if (v.media_type === 'image') {
    t.append(el('img', { src: `/api/media/${v.id}`, loading: 'lazy' }));
  } else {
    t.append(el('span', { className: 'glyph' }, GLYPH[v.media_type] || '📄'));
  }
  return t;
}

function assetCard(a) {
  const card = el('div', { className: 'card' });
  const t = el('div', { className: 'thumb' });
  t.append(el('span', { className: 'badge' }, a.latest_media_type || 'asset'));
  t.append(el('span', { className: 'vcount' }, `v${a.version_count}`));
  if (a.latest_media_type === 'image' && a.latest_version_id) {
    t.append(el('img', { src: `/api/media/${a.latest_version_id}`, loading: 'lazy' }));
  } else {
    t.append(el('span', { className: 'glyph' }, GLYPH[a.latest_media_type] || '📦'));
  }
  card.append(t, el('div', { className: 'meta' },
    el('div', { className: 'name', title: a.name }, a.name),
    el('div', { className: 'sub' }, `${a.version_count} version${a.version_count !== 1 ? 's' : ''}`)));
  card.addEventListener('click', () => openAsset(a.id));
  return card;
}

function versionCard(v, showAsset) {
  const card = el('div', { className: 'card' });
  card.append(thumbFor(v));
  const sub = showAsset ? (v.asset_name || '') : `v${v.number}`;
  card.append(el('div', { className: 'meta' },
    el('div', { className: 'name', title: v.asset_name || v.file_name }, showAsset ? (v.asset_name || v.file_name) : `v${v.number}`),
    el('div', { className: 'sub' }, v.model ? `${v.model}` : (sub || v.file_name))));
  card.addEventListener('click', () => openDetail(v.id));
  return card;
}

// ── Detail modal ──────────────────────────────────────────────

let disposePreview = null;

async function openDetail(id) {
  const v = await api(`/api/versions/${id}`);
  $('#detail-title').textContent = `${v.file_name} · v${v.number}`;
  const body = $('#detail-body');
  body.innerHTML = '';

  // Preview
  const preview = el('div', { className: 'preview' });
  body.append(preview);
  buildPreview(preview, v);

  // Status + basics
  const dl = el('dl', { className: 'prov' });
  const row = (label, node) => { dl.append(el('dt', {}, label), node.nodeType ? node : el('dd', {}, node)); };
  row('Status', el('dd', {}, el('span', { className: `status-pill ${v.status}` }, v.status)));
  if (v.model) row('Model', el('dd', {}, el('code', {}, v.model)));
  if (v.seed != null) row('Seed', el('dd', {}, el('code', {}, String(v.seed))));
  row('Created', v.created_at || '—');
  row('File', el('dd', {}, el('code', {}, v.file_name)));
  if (v.file_size) row('Size', `${(v.file_size / 1024).toFixed(0)} KB`);
  body.append(dl);

  // Prompt
  if (v.prompt) {
    body.append(el('div', { className: 'section-label' }, 'Prompt'));
    body.append(el('div', { className: 'prov' }, el('dt', {}, 'Positive'), el('dd', { className: 'prompt' }, v.prompt)));
  }
  if (v.negative) {
    body.append(el('div', { className: 'prov' }, el('dt', {}, 'Negative'), el('dd', { className: 'prompt' }, v.negative)));
  }

  // Params
  if (v.params && Object.keys(v.params).length) {
    body.append(el('div', { className: 'section-label' }, 'Parameters'));
    const chips = el('div', { className: 'chips' });
    for (const [k, val] of Object.entries(v.params)) {
      const disp = typeof val === 'object' ? JSON.stringify(val) : String(val);
      chips.append(el('span', { className: 'chip' }, el('b', {}, `${k}: `), disp.length > 60 ? disp.slice(0, 60) + '…' : disp));
    }
    body.append(chips);
  }

  // Lineage inputs
  if (v.inputs && v.inputs.length) {
    body.append(el('div', { className: 'section-label' }, 'Lineage — source inputs'));
    const list = el('div', { className: 'inputs-list' });
    for (const inp of v.inputs) {
      list.append(el('div', { className: 'row' }, el('span', { className: 'role' }, inp.role || 'input'), el('span', {}, inp.file)));
    }
    body.append(list);
  }

  // Raw sidecar
  if (v.meta) {
    const det = el('details');
    det.append(el('summary', { className: 'section-label', style: 'cursor:pointer' }, 'Raw sidecar metadata'));
    det.append(el('pre', { className: 'raw' }, JSON.stringify(v.meta, null, 2)));
    body.append(det);
  }

  $('#overlay').classList.add('open');
}

function buildPreview(container, v) {
  const url = `/api/media/${v.id}`;
  if (v.media_type === 'image') {
    container.append(el('img', { src: url }));
  } else if (v.media_type === 'video') {
    container.append(el('video', { src: url, controls: true }));
  } else if (v.media_type === 'audio') {
    container.append(el('audio', { src: url, controls: true }));
  } else if (v.media_type === '3d') {
    const canvas = el('canvas');
    container.append(canvas);
    render3D(canvas, url, v.file_name);
  } else {
    container.append(el('div', { className: 'empty' }, 'No preview'));
  }
}

// Embedded Three.js preview — reuses the viewer stack (three via importmap).
async function render3D(canvas, url, filename) {
  const THREE = await import('three');
  const { OrbitControls } = await import('three/addons/controls/OrbitControls.js');
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
  const { OBJLoader } = await import('three/addons/loaders/OBJLoader.js');
  const { FBXLoader } = await import('three/addons/loaders/FBXLoader.js');

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  const w = canvas.clientWidth || 640, h = 420;
  renderer.setSize(w, h, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x14141f);
  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  const dir = new THREE.DirectionalLight(0xffffff, 1.0);
  dir.position.set(3, 5, 4);
  scene.add(dir);

  const camera = new THREE.PerspectiveCamera(50, w / h, 0.01, 1000);
  camera.position.set(0, 1, 3);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;

  const ext = filename.split('.').pop().toLowerCase();
  const onLoad = (obj) => {
    const model = obj.scene || obj;
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const scale = 2 / Math.max(size.x, size.y, size.z, 0.0001);
    model.scale.setScalar(scale);
    model.position.sub(center.multiplyScalar(scale));
    if (!(obj.scene)) {
      model.traverse((c) => { if (c.isMesh && (!c.material || c.material.map == null)) c.material = new THREE.MeshStandardMaterial({ color: 0x999999, roughness: 0.6 }); });
    }
    scene.add(model);
    controls.target.set(0, 0, 0);
  };
  const onErr = () => container3DError(canvas);

  if (ext === 'obj') new OBJLoader().load(url, onLoad, undefined, onErr);
  else if (ext === 'fbx') new FBXLoader().load(url, onLoad, undefined, onErr);
  else new GLTFLoader().load(url, onLoad, undefined, onErr);

  let alive = true;
  (function loop() {
    if (!alive) return;
    requestAnimationFrame(loop);
    controls.update();
    renderer.render(scene, camera);
  })();
  disposePreview = () => { alive = false; renderer.dispose(); };
}

function container3DError(canvas) {
  const p = canvas.parentElement;
  p.innerHTML = '';
  p.append(el('div', { className: 'empty' }, 'Could not load 3D file'));
}

function closeDetail() {
  $('#overlay').classList.remove('open');
  if (disposePreview) { disposePreview(); disposePreview = null; }
}
$('#detail-close').addEventListener('click', closeDetail);
$('#overlay').addEventListener('click', (e) => { if (e.target.id === 'overlay') closeDetail(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDetail(); });

// ── Boot ──────────────────────────────────────────────────────

async function refresh() {
  await updateStats();
  await loadProjects();
  if (state.activeAsset) openAsset(state.activeAsset);
  else if (state.activeProject) openProject(state.activeProject);
  else openHome();
}

(async function init() {
  await loadConfig();
  await refresh();
})();
