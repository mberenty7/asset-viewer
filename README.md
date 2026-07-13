# Asset Tracker

A production asset tracker for generative-AI pipelines — think Autodesk ShotGrid
(Shotgun), but built for prompts, seeds, and models. It ingests the outputs of
[comfyui-canvas](https://github.com/mberenty7/comfyui-canvas) (or any tool that
writes media + a `.json` sidecar), organizes them into **projects → assets →
versions**, and preserves the full generation **provenance and lineage** of every
asset. Ships with an embedded Three.js viewer for 3D versions.

![Node](https://img.shields.io/badge/Node-20+-green?logo=nodedotjs)
![SQLite](https://img.shields.io/badge/SQLite-better--sqlite3-003B57?logo=sqlite)
![Docker](https://img.shields.io/badge/Docker-ready-blue?logo=docker)

## Why

Your node-based tool (comfyui-canvas) already generates images and 3D meshes and
writes a `.json` metadata sidecar next to every output — prompt, negative, model/
template, seed, params, and the input images that fed it. That sidecar *is* a
provenance record. This app turns those scattered files into a browsable,
versioned, review-ready asset library.

```
Project
 └─ Asset / Shot          (grouped by the generation's outputName)
     └─ Version            every produced image / video / 3d / audio file
          • provenance:    prompt · negative · model · seed · params
          • lineage:       the source input files it was generated from (the DAG)
          • status:        wip · review · approved · final   (review workflow: next milestone)
```

## Data model

- **Project** — the top-level subfolder of the output directory (or `Default`).
- **Asset** — grouped by the sidecar's `outputName` (falls back to the filename
  stem with ComfyUI's `_00012_` counter stripped). An image and its derived 3D
  mesh with the same `outputName` land under one asset as separate versions.
- **Version** — one produced media file, auto-numbered per asset, media-agnostic
  (`image` / `video` / `3d` / `audio`), carrying the full sidecar verbatim plus
  parsed provenance and lineage.

## Quick Start

```bash
npm install
npm start          # http://localhost:3000
```

1. Paste your **comfyui-canvas output directory** into the field in the header
   (or set the `OUTPUT_DIR` env var / `docker-compose.yml`).
2. Hit **⟳ Scan**. Every media file + sidecar is ingested as a version.
   Re-scanning is idempotent — only new files are added.
3. Browse projects → assets → versions; click any version for full provenance.

### Docker

```bash
docker compose up -d --build
```

Mount your output directory into the container and point `OUTPUT_DIR` at it
(see the commented volume in `docker-compose.yml`). The SQLite DB persists in
`./data`.

## Ingestion

Auto-scan reads a `.json` sidecar next to each media file. Recognized fields
(all optional — the comfyui-canvas format, but any subset works):

| Sidecar field        | Becomes                        |
|----------------------|--------------------------------|
| `outputName`         | asset name                     |
| `timestamp`          | version created-at             |
| `template` / `model` | model                          |
| `seed`               | seed                           |
| `positive`           | prompt                         |
| `negative`           | negative prompt                |
| `params`             | parameter chips                |
| `<role>_image`       | lineage source input           |

A curated **"Publish to Tracker"** action from the canvas Generate node is the
planned Phase-2 complement to auto-scan.

## API

| Method | Route                          | Purpose                          |
|--------|--------------------------------|----------------------------------|
| GET    | `/api/config`                  | current output directory         |
| POST   | `/api/config`                  | set output directory             |
| POST   | `/api/ingest`                  | scan + ingest                    |
| GET    | `/api/stats`                   | project/asset/version counts     |
| GET    | `/api/projects`                | projects with counts             |
| GET    | `/api/projects/:id/assets`     | assets in a project              |
| GET    | `/api/assets/:id`              | asset + its versions             |
| GET    | `/api/versions/:id`            | full provenance for a version    |
| GET    | `/api/recent`                  | most recent versions             |
| GET    | `/api/media/:id`               | serves a tracked media file      |

## 3D Viewer

The standalone Three.js viewer (GLSL shaders, depth/normal capture, 4-view depth
export for ControlNet) lives at **`/viewer.html`** and doubles as the embedded
3D preview for `3d` versions in the tracker. Depth/normal/color capture docs are
unchanged from the original viewer.

## Tech Stack

- [Express](https://expressjs.com/) + [better-sqlite3](https://github.com/WiseLibs/better-sqlite3)
- [Three.js](https://threejs.org/) 0.170 (via CDN) for 3D preview
- Vanilla JS front end, no build step

## Roadmap

- **M1 (done)** — ingest + browse + provenance & lineage
- **M2** — status/review workflow, notes, review playlists
- **M3** — visual lineage/DAG graph; round-trip "open lineage in canvas"
- **M4** — curated publish action in comfyui-canvas; video/audio generators

## License

MIT
