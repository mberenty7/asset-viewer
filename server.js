const express = require('express');
const fs = require('fs').promises;
const path = require('path');

const db = require('./server/db');
const ingest = require('./server/ingest');
const config = require('./server/config');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

// ── Tracker: config ──────────────────────────────────────────

app.get('/api/config', (req, res) => res.json(config.get()));

app.post('/api/config', (req, res) => {
  const patch = {};
  if (typeof req.body.outputDir === 'string') patch.outputDir = req.body.outputDir.trim();
  res.json(config.update(patch));
});

// ── Tracker: ingestion ───────────────────────────────────────

app.post('/api/ingest', (req, res) => {
  const rootDir = (req.body && req.body.outputDir) || config.get().outputDir;
  const result = ingest.scan(rootDir);
  res.status(result.ok ? 200 : 400).json(result);
});

// ── Tracker: browse ──────────────────────────────────────────

app.get('/api/stats', (req, res) => res.json(db.stats()));

app.get('/api/projects', (req, res) => res.json(db.listProjects()));

app.get('/api/projects/:id/assets', (req, res) => {
  res.json(db.listAssets(Number(req.params.id)));
});

app.get('/api/assets/:id', (req, res) => {
  const asset = db.getAsset(Number(req.params.id));
  if (!asset) return res.status(404).json({ error: 'asset not found' });
  res.json({ asset, versions: db.listVersionsByAsset(asset.id) });
});

app.get('/api/versions/:id', (req, res) => {
  const v = db.getVersion(Number(req.params.id));
  if (!v) return res.status(404).json({ error: 'version not found' });
  // Expand JSON blobs for the client.
  const expand = (s) => {
    try {
      return s ? JSON.parse(s) : null;
    } catch {
      return null;
    }
  };
  res.json({
    ...v,
    params: expand(v.params_json),
    inputs: expand(v.inputs_json),
    meta: expand(v.meta_json),
  });
});

app.get('/api/recent', (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 60, 500);
  res.json(db.recentVersions(limit));
});

// ── Tracker: media serving (only files known to the DB) ──────

app.get('/api/media/:id', (req, res) => {
  const v = db.getVersion(Number(req.params.id));
  if (!v) return res.status(404).end();
  res.sendFile(v.file_path, (err) => {
    if (err && !res.headersSent) res.status(404).end();
  });
});

// ── Standalone 3D viewer (legacy) — models + shaders ─────────

app.get('/api/models', async (req, res) => {
  try {
    const files = await fs.readdir('/models');
    res.json(files.filter((f) => /\.(glb|gltf|obj|fbx)$/i.test(f)));
  } catch {
    res.json([]);
  }
});

app.get('/api/models/:filename', (req, res) => {
  res.sendFile(path.join('/models', path.basename(req.params.filename)));
});

app.get('/api/shaders', async (req, res) => {
  try {
    const shaderDir = path.join(__dirname, 'public/shaders');
    const files = await fs.readdir(shaderDir);
    res.json([...new Set(files.map((f) => f.replace(/\.(vert|frag)$/, '')))]);
  } catch {
    res.json([]);
  }
});

app.get('/api/shaders/:name', async (req, res) => {
  try {
    const shaderDir = path.join(__dirname, 'public/shaders');
    const name = path.basename(req.params.name);
    const vert = await fs.readFile(path.join(shaderDir, `${name}.vert`), 'utf8');
    const frag = await fs.readFile(path.join(shaderDir, `${name}.frag`), 'utf8');
    res.json({ vertex: vert, fragment: frag });
  } catch {
    res.status(404).json({ error: 'Shader not found' });
  }
});

app.listen(PORT, () => console.log(`Asset Tracker running on http://localhost:${PORT}`));
