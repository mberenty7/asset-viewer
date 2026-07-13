// SQLite datastore for the asset tracker.
//
// Model (ShotGrid-inspired, media-agnostic):
//   project ─┬─ asset ─┬─ version (a generated image / video / 3d / audio)
//            │         └─ ...        · provenance: prompt, model, seed, params
//            └─ ...                   · lineage:    source input files (the DAG)
//
// A "version" is one produced media file discovered by the ingest scanner,
// carrying the full generation provenance from its .json sidecar.

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'tracker.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS project (
    id          INTEGER PRIMARY KEY,
    name        TEXT NOT NULL UNIQUE,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS asset (
    id          INTEGER PRIMARY KEY,
    project_id  INTEGER NOT NULL REFERENCES project(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    kind        TEXT NOT NULL DEFAULT 'asset',   -- asset | shot
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (project_id, name)
  );

  CREATE TABLE IF NOT EXISTS version (
    id            INTEGER PRIMARY KEY,
    asset_id      INTEGER NOT NULL REFERENCES asset(id) ON DELETE CASCADE,
    number        INTEGER NOT NULL,              -- v1, v2, ... per asset
    media_type    TEXT NOT NULL,                 -- image | video | 3d | audio
    file_path     TEXT NOT NULL UNIQUE,          -- absolute path on disk
    file_name     TEXT NOT NULL,
    file_size     INTEGER,
    mtime         TEXT,                          -- source file mtime (ISO)
    created_at    TEXT NOT NULL,                 -- generation timestamp (from sidecar or mtime)
    status        TEXT NOT NULL DEFAULT 'wip',   -- wip | review | approved | final  (used from M2)
    -- provenance --------------------------------------------------
    model         TEXT,                          -- template / model / backend
    seed          INTEGER,
    prompt        TEXT,
    negative      TEXT,
    params_json   TEXT,                          -- JSON blob of workflow params
    inputs_json   TEXT,                          -- JSON array of source input files (lineage)
    meta_json     TEXT,                          -- the full raw sidecar, verbatim
    ingested_at   TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_asset_project  ON asset(project_id);
  CREATE INDEX IF NOT EXISTS idx_version_asset  ON version(asset_id);
  CREATE INDEX IF NOT EXISTS idx_version_mtype  ON version(media_type);
`);

// ── Upsert helpers ────────────────────────────────────────────

const _getProject = db.prepare('SELECT id FROM project WHERE name = ?');
const _insProject = db.prepare('INSERT INTO project (name) VALUES (?)');
function upsertProject(name) {
  const row = _getProject.get(name);
  if (row) return row.id;
  return _insProject.run(name).lastInsertRowid;
}

const _getAsset = db.prepare('SELECT id FROM asset WHERE project_id = ? AND name = ?');
const _insAsset = db.prepare('INSERT INTO asset (project_id, name, kind) VALUES (?, ?, ?)');
function upsertAsset(projectId, name, kind = 'asset') {
  const row = _getAsset.get(projectId, name);
  if (row) return row.id;
  return _insAsset.run(projectId, name, kind).lastInsertRowid;
}

const _versionExists = db.prepare('SELECT id FROM version WHERE file_path = ?');
const _maxVersionNo = db.prepare('SELECT COALESCE(MAX(number), 0) AS n FROM version WHERE asset_id = ?');
const _insVersion = db.prepare(`
  INSERT INTO version
    (asset_id, number, media_type, file_path, file_name, file_size, mtime, created_at,
     model, seed, prompt, negative, params_json, inputs_json, meta_json)
  VALUES
    (@asset_id, @number, @media_type, @file_path, @file_name, @file_size, @mtime, @created_at,
     @model, @seed, @prompt, @negative, @params_json, @inputs_json, @meta_json)
`);

// Insert a version if its file_path is new. Returns 'inserted' | 'exists'.
function insertVersion(v) {
  if (_versionExists.get(v.file_path)) return 'exists';
  const number = _maxVersionNo.get(v.asset_id).n + 1;
  _insVersion.run({ number, ...v });
  return 'inserted';
}

// ── Query helpers (for the API) ───────────────────────────────

const listProjects = db.prepare(`
  SELECT p.id, p.name, p.created_at,
         COUNT(DISTINCT a.id)   AS asset_count,
         COUNT(v.id)            AS version_count
  FROM project p
  LEFT JOIN asset   a ON a.project_id = p.id
  LEFT JOIN version v ON v.asset_id   = a.id
  GROUP BY p.id
  ORDER BY p.name
`);

const listAssets = db.prepare(`
  SELECT a.id, a.name, a.kind, a.project_id,
         COUNT(v.id)                        AS version_count,
         MAX(v.created_at)                  AS latest_at,
         (SELECT v2.id FROM version v2 WHERE v2.asset_id = a.id
            ORDER BY v2.number DESC LIMIT 1) AS latest_version_id,
         (SELECT v2.media_type FROM version v2 WHERE v2.asset_id = a.id
            ORDER BY v2.number DESC LIMIT 1) AS latest_media_type
  FROM asset a
  LEFT JOIN version v ON v.asset_id = a.id
  WHERE a.project_id = ?
  GROUP BY a.id
  ORDER BY latest_at DESC, a.name
`);

const listVersionsByAsset = db.prepare(`
  SELECT id, asset_id, number, media_type, file_name, file_size, created_at, status,
         model, seed, prompt
  FROM version
  WHERE asset_id = ?
  ORDER BY number DESC
`);

const getVersion = db.prepare('SELECT * FROM version WHERE id = ?');
const getAsset = db.prepare('SELECT * FROM asset WHERE id = ?');

const recentVersions = db.prepare(`
  SELECT v.id, v.asset_id, v.number, v.media_type, v.file_name, v.created_at,
         v.model, v.seed, v.prompt, a.name AS asset_name, a.project_id
  FROM version v JOIN asset a ON a.id = v.asset_id
  ORDER BY v.created_at DESC, v.id DESC
  LIMIT ?
`);

const stats = db.prepare(`
  SELECT
    (SELECT COUNT(*) FROM project)  AS projects,
    (SELECT COUNT(*) FROM asset)    AS assets,
    (SELECT COUNT(*) FROM version)  AS versions
`);

module.exports = {
  db,
  upsertProject,
  upsertAsset,
  insertVersion,
  listProjects: () => listProjects.all(),
  listAssets: (projectId) => listAssets.all(projectId),
  listVersionsByAsset: (assetId) => listVersionsByAsset.all(assetId),
  getVersion: (id) => getVersion.get(id),
  getAsset: (id) => getAsset.get(id),
  recentVersions: (limit = 60) => recentVersions.all(limit),
  stats: () => stats.get(),
};
