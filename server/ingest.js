// Ingestion: scan a comfyui-canvas output directory, discover produced media
// files and their .json metadata sidecars, and upsert them as tracked versions.
//
// This is the "auto-scan" ingestion path. A curated "publish" path (an explicit
// push from the canvas Generate node into a chosen asset) can reuse
// deriveRecord()/db.insertVersion() later without changing this scanner.

const fs = require('fs');
const path = require('path');
const dbApi = require('./db');

const MEDIA_EXT = {
  image: ['.png', '.jpg', '.jpeg', '.webp', '.gif'],
  video: ['.mp4', '.webm', '.mov', '.m4v'],
  audio: ['.wav', '.mp3', '.flac', '.ogg', '.m4a'],
  '3d': ['.glb', '.gltf', '.obj', '.fbx'],
};

function mediaTypeFor(ext) {
  ext = ext.toLowerCase();
  for (const [type, exts] of Object.entries(MEDIA_EXT)) {
    if (exts.includes(ext)) return type;
  }
  return null;
}

// Strip trailing counters/seeds from a filename stem so that
// "hero_prop_00012_.png" and "hero_prop_00013_.png" collapse to one asset.
function assetNameFromFile(stem) {
  return (
    stem
      .replace(/[_-]?\d{3,}[_-]?$/, '') // ComfyUI's _00012_ suffix
      .replace(/[_-]?v?\d+$/i, '')      // trailing v3 / _7
      .replace(/[_-]+$/, '')
      .trim() || stem
  );
}

// Turn a discovered file + parsed sidecar into a version record for the DB.
function deriveRecord(rootDir, filePath, sidecar) {
  const rel = path.relative(rootDir, filePath);
  const segments = rel.split(path.sep);
  const projectName = segments.length > 1 ? segments[0] : 'Default';

  const ext = path.extname(filePath);
  const stem = path.basename(filePath, ext);
  const mediaType = mediaTypeFor(ext);

  let stat;
  try {
    stat = fs.statSync(filePath);
  } catch {
    stat = null;
  }
  const mtime = stat ? stat.mtime.toISOString() : null;

  const meta = sidecar || {};
  const assetName = meta.outputName || assetNameFromFile(stem);

  // Collect any *_image fields as lineage inputs.
  const inputs = [];
  for (const [k, val] of Object.entries(meta)) {
    if (/_image$/.test(k) && val) inputs.push({ role: k.replace(/_image$/, ''), file: val });
  }

  const created =
    (typeof meta.timestamp === 'string' && meta.timestamp) || mtime || new Date().toISOString();

  const seedRaw = meta.seed;
  const seed = seedRaw === undefined || seedRaw === null || seedRaw === '' ? null : Number(seedRaw);

  return {
    projectName,
    assetName,
    record: {
      media_type: mediaType,
      file_path: filePath,
      file_name: path.basename(filePath),
      file_size: stat ? stat.size : null,
      mtime,
      created_at: created,
      model: meta.template || meta.model || meta.backend || null,
      seed: Number.isFinite(seed) ? seed : null,
      prompt: meta.positive || meta.prompt || null,
      negative: meta.negative || null,
      params_json: meta.params ? JSON.stringify(meta.params) : null,
      inputs_json: inputs.length ? JSON.stringify(inputs) : null,
      meta_json: sidecar ? JSON.stringify(sidecar) : null,
    },
  };
}

function readSidecar(filePath) {
  const ext = path.extname(filePath);
  const sidecarPath = filePath.slice(0, -ext.length) + '.json';
  if (!fs.existsSync(sidecarPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(sidecarPath, 'utf8'));
  } catch {
    return null; // malformed sidecar — still ingest the media, just without provenance
  }
}

function walk(dir, out = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === '.git' || e.name === 'node_modules') continue;
      walk(full, out);
    } else if (e.isFile()) {
      if (mediaTypeFor(path.extname(e.name))) out.push(full);
    }
  }
  return out;
}

// Scan a directory tree and ingest everything new. Returns a summary.
function scan(rootDir) {
  if (!rootDir || !fs.existsSync(rootDir)) {
    return { ok: false, error: `Output directory not found: ${rootDir || '(unset)'}` };
  }
  const files = walk(rootDir);
  let inserted = 0;
  let skipped = 0;

  const runAll = dbApi.db.transaction(() => {
    for (const file of files) {
      const sidecar = readSidecar(file);
      const { projectName, assetName, record } = deriveRecord(rootDir, file, sidecar);
      if (!record.media_type) continue;
      const projectId = dbApi.upsertProject(projectName);
      const assetId = dbApi.upsertAsset(projectId, assetName);
      const result = dbApi.insertVersion({ asset_id: assetId, ...record });
      if (result === 'inserted') inserted += 1;
      else skipped += 1;
    }
  });
  runAll();

  return { ok: true, scanned: files.length, inserted, skipped, rootDir };
}

module.exports = { scan, deriveRecord, mediaTypeFor, MEDIA_EXT };
