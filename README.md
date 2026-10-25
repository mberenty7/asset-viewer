# Asset Viewer

A web-based 3D model viewer built with Three.js. Supports GLB, GLTF, OBJ, and FBX formats with custom GLSL shaders, depth/normal map capture, and a 4-view depth export for ControlNet workflows.

![Three.js](https://img.shields.io/badge/Three.js-0.170-black?logo=threedotjs)
![Node](https://img.shields.io/badge/Node-20+-green?logo=nodedotjs)
![Docker](https://img.shields.io/badge/Docker-ready-blue?logo=docker)

## Features

- **Multi-format support** — GLB, GLTF, OBJ, FBX
- **Drag & drop** — Load models directly from your filesystem
- **Custom GLSL shaders** — Fresnel, Toon, Holographic presets with live editing
- **Depth map capture** — Tight near/far projection for maximum depth range
- **4-View depth export** — Front, back, left, right depth maps in one click (great for ControlNet)
- **Normal map capture** — Export camera-space normal maps
- **Color render capture** — Clean render export with white background
- **Configurable resolution** — 512², 896×1152, 1024², 2048²

## Quick Start

### Docker (recommended)

```bash
docker compose up -d
```

Then open `http://localhost:3000`.

Place 3D models in a `models/` directory (mounted as a volume) or drag & drop files into the viewer.

### Manual

```bash
npm install
node server.js
```

### Configuration

Edit `docker-compose.yml` to change the models volume mount:

```yaml
volumes:
  - /path/to/your/models:/models:ro
```

## RefBoard — infinite reference canvas (tablet friendly)

`public/refboard/` is a separate, dependency-free PureRef-style reference board built for touch tablets (tested at Galaxy Tab A8 size), with tools for watercolor painting.

- **Infinite canvas** — one finger pans, pinch zooms, double-tap fits everything / zooms to a photo
- **Arrange photos** — drag to move; select then pinch-twist (or drag the corner handle) to resize and rotate; flip, layer, duplicate, lock
- **Value studies** — per photo: Color → Gray → 3 values → 5 values (notan), based on perceptual lightness (CIE L\*)
- **Grid overlay** — 3×3, 4×4 or 6×6 for transferring a drawing
- **Squint mode** — blurs the board so you see the big shapes and masses
- **Color picker** — touch a photo to read its hex color and value %; picks collect in a palette tray
- **Painting mode** — locks every photo so a brushing hand can't move things; pan/zoom still work
- **Keep screen awake**, fullscreen, three background tones (dark, mid gray, paper)
- **Multiple boards**, saved on the device (IndexedDB); export/import a board as a single `.json` file for backup
- **Installable PWA** that works offline, and appears in Android's share sheet so you can share images from the gallery, Chrome or Pinterest straight onto the board
- Big photos are downscaled to 2048 px on import to stay light on tablet memory

### Getting it onto the tablet

**GitHub Pages (recommended):** in the repo's *Settings → Pages*, set *Source* to **GitHub Actions**. Every push to `main` that touches `public/refboard/` deploys it to `https://<user>.github.io/asset-viewer/`. On the tablet, open that URL in Chrome, then *⋮ → Add to Home screen → Install*.

**Local server:** `node server.js` serves it at `http://<computer-ip>:3000/refboard/`. It works over plain HTTP on your Wi-Fi, but installing, offline use, keep-awake, clipboard paste and the share sheet need HTTPS, so use Pages for the full experience.

## Usage

### Loading Models
- **Dropdown** — Select from models in the server's `/models` directory
- **Drag & drop** — Drop any `.glb`, `.gltf`, `.obj`, or `.fbx` file onto the viewer

### Shaders
Three built-in presets with adjustable base color, rim color, and fresnel power. Open the vertex/fragment editors to write custom GLSL.

### Capture
- **Depth Map** — Black (near) to white (far), tightly fitted to model bounds
- **Depth 4-View** — Four cardinal depth maps, useful for ControlNet depth conditioning
- **Normal Map** — Camera-space normals
- **Color Render** — Current shader on white background

## Tech Stack

- [Three.js](https://threejs.org/) 0.170 (via CDN)
- [Express](https://expressjs.com/) for model serving
- Vanilla JS, no build step

## License

MIT
