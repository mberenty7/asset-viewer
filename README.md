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
