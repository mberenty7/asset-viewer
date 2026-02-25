import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

// ── Scene Setup ──────────────────────────────────────────────

const canvas = document.getElementById('viewer');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a2e);

const camera = new THREE.PerspectiveCamera(50, 1, 0.01, 100);
camera.position.set(0, 1, 3);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.autoRotate = false;
controls.autoRotateSpeed = 1.5;
controls.target.set(0, 0.5, 0);

// ── Lighting ─────────────────────────────────────────────────

const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
dirLight.position.set(3, 5, 4);
scene.add(dirLight);

const fillLight = new THREE.DirectionalLight(0x8888ff, 0.3);
fillLight.position.set(-3, 2, -2);
scene.add(fillLight);

// ── Grid helper ──────────────────────────────────────────────

const grid = new THREE.GridHelper(4, 20, 0x333355, 0x222244);
grid.visible = false;
scene.add(grid);

// ── State ────────────────────────────────────────────────────

let currentModel = null;
let currentMaterial = null;
let shaderSources = { vertex: '', fragment: '' };
const clock = new THREE.Clock();

const uniforms = {
  uColor: { value: new THREE.Color(0x808080) },
  uRimColor: { value: new THREE.Color(0xffffff) },
  uFresnelPower: { value: 2.0 },
  uTime: { value: 0 },
};

// ── Model Loading ────────────────────────────────────────────

const gltfLoader = new GLTFLoader();
const objLoader = new OBJLoader();
const fbxLoader = new FBXLoader();

function loadModel(url) {
  if (currentModel) {
    scene.remove(currentModel);
    currentModel.traverse(c => {
      if (c.geometry) c.geometry.dispose();
      if (c.material) {
        if (Array.isArray(c.material)) c.material.forEach(m => m.dispose());
        else c.material.dispose();
      }
    });
  }

  document.getElementById('model-info').textContent = 'Loading...';

  const ext = url.split('.').pop().split('?')[0].toLowerCase();

  const onLoaded = (object) => {
    // GLTF wraps in .scene, OBJ/FBX return the object directly
    currentModel = object.scene || object;

    // Auto-scale and center
    const box = new THREE.Box3().setFromObject(currentModel);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = 2 / maxDim;
    currentModel.scale.setScalar(scale);
    currentModel.position.sub(center.multiplyScalar(scale));

    // Debug: log mesh info
    currentModel.traverse(child => {
      if (child.isMesh) {
        const geo = child.geometry;
        console.log(`Mesh: ${child.name}`, {
          vertices: geo.attributes.position?.count,
          hasNormals: !!geo.attributes.normal,
          hasUVs: !!geo.attributes.uv,
          hasSkinning: !!geo.attributes.skinIndex,
        });
      }
    });

    scene.add(currentModel);
    applyCurrentShader();

    const info = `${size.x.toFixed(2)} × ${size.y.toFixed(2)} × ${size.z.toFixed(2)}`;
    document.getElementById('model-info').textContent = info;
  };

  const onError = (err) => {
    document.getElementById('model-info').textContent = 'Failed to load model';
    console.error(err);
  };

  if (ext === 'obj') {
    objLoader.load(url, onLoaded, undefined, onError);
  } else if (ext === 'fbx') {
    fbxLoader.load(url, onLoaded, undefined, onError);
  } else {
    gltfLoader.load(url, onLoaded, undefined, onError);
  }
}

// ── Shader System ────────────────────────────────────────────

async function loadShaderPreset(name) {
  try {
    console.log(`Loading shader preset: ${name}`);
    const res = await fetch(`/api/shaders/${name}`);
    const data = await res.json();
    shaderSources = data;
    document.getElementById('vert-editor').value = data.vertex;
    document.getElementById('frag-editor').value = data.fragment;
    console.log(`Shader loaded, vert length: ${data.vertex.length}, frag length: ${data.fragment.length}`);
    applyCurrentShader();
  } catch (err) {
    console.error('Failed to load shader:', err);
  }
}

function applyCurrentShader() {
  const vertSrc = document.getElementById('vert-editor').value;
  const fragSrc = document.getElementById('frag-editor').value;
  const errorEl = document.getElementById('shader-error');

  console.log(`applyCurrentShader: vert=${vertSrc.length} chars, frag=${fragSrc.length} chars, model=${!!currentModel}`);
  if (!vertSrc || !fragSrc) { console.log('No shader source, skipping'); return; }

  try {
    // Check if any mesh in the model is skinned
    let needsSkinning = false;
    if (currentModel) {
      currentModel.traverse(child => {
        if (child.isSkinnedMesh) needsSkinning = true;
      });
    }

    const mat = new THREE.ShaderMaterial({
      vertexShader: vertSrc,
      fragmentShader: fragSrc,
      uniforms,
      transparent: true,
      skinning: needsSkinning,
    });

    if (currentModel) {
      let applied = 0;
      currentModel.traverse(child => {
        if (child.isMesh || child.isSkinnedMesh) {
          child.material = mat;
          applied++;
        }
      });
      console.log(`Shader applied to ${applied} meshes`);
    }

    if (currentMaterial) currentMaterial.dispose();
    currentMaterial = mat;
    errorEl.textContent = '';
  } catch (err) {
    errorEl.textContent = err.message;
    console.error('Shader error:', err);
  }
}

// ── Drag & Drop ──────────────────────────────────────────────

document.addEventListener('dragover', (e) => {
  e.preventDefault();
  document.body.classList.add('dragover');
});

document.addEventListener('dragleave', (e) => {
  if (e.relatedTarget === null) document.body.classList.remove('dragover');
});

document.addEventListener('drop', (e) => {
  e.preventDefault();
  document.body.classList.remove('dragover');
  const file = e.dataTransfer.files[0];
  if (!file) return;
  if (!/\.(glb|gltf|obj|fbx)$/i.test(file.name)) {
    document.getElementById('model-info').textContent = 'Unsupported format (use .glb, .obj, .fbx)';
    return;
  }
  const url = URL.createObjectURL(file);
  loadModel(url);
  document.getElementById('model-info').textContent = file.name;
});

// ── UI Bindings ──────────────────────────────────────────────

document.getElementById('shader-select').addEventListener('change', (e) => {
  loadShaderPreset(e.target.value);
});

document.getElementById('apply-shader').addEventListener('click', applyCurrentShader);

document.getElementById('ctrl-color').addEventListener('input', (e) => {
  uniforms.uColor.value.set(e.target.value);
});

document.getElementById('ctrl-rim').addEventListener('input', (e) => {
  uniforms.uRimColor.value.set(e.target.value);
});

document.getElementById('ctrl-fresnel').addEventListener('input', (e) => {
  uniforms.uFresnelPower.value = parseFloat(e.target.value);
});

document.getElementById('ctrl-bg').addEventListener('input', (e) => {
  scene.background.set(e.target.value);
});

document.getElementById('ctrl-rotate').addEventListener('change', (e) => {
  controls.autoRotate = e.target.checked;
});

document.getElementById('ctrl-grid').addEventListener('change', (e) => {
  grid.visible = e.target.checked;
});

// ── Model List ───────────────────────────────────────────────

async function loadModelList() {
  const select = document.getElementById('model-select');
  try {
    const res = await fetch('/api/models');
    const models = await res.json();
    select.innerHTML = '';
    if (models.length === 0) {
      select.innerHTML = '<option value="">No models found — drag & drop a .glb</option>';
    } else {
      models.forEach(m => {
        const opt = document.createElement('option');
        opt.value = `/api/models/${m}`;
        opt.textContent = m;
        select.appendChild(opt);
      });
      loadModel(select.value);
    }
  } catch {
    select.innerHTML = '<option value="">Drop a .glb file to view</option>';
  }
}

document.getElementById('model-select').addEventListener('change', (e) => {
  if (e.target.value) loadModel(e.target.value);
});

// ── Resize ───────────────────────────────────────────────────

function resize() {
  const container = document.getElementById('viewer-container');
  const w = container.clientWidth;
  const h = container.clientHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

window.addEventListener('resize', resize);

// ── Render Loop ──────────────────────────────────────────────

function animate() {
  requestAnimationFrame(animate);
  uniforms.uTime.value = clock.getElapsedTime();
  controls.update();
  renderer.render(scene, camera);
}

// ── Capture System ───────────────────────────────────────────

function captureRender(mode) {
  if (!currentModel) return;

  const resSelect = document.getElementById('capture-res');
  const resVal = resSelect.value;
  let w, h;
  if (resVal === '896') {
    w = 896; h = 1152;
  } else {
    w = parseInt(resVal); h = w;
  }

  // Create offscreen renderer
  const offRenderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  offRenderer.setSize(w, h);
  offRenderer.outputColorSpace = THREE.SRGBColorSpace;

  // Clone camera with correct aspect
  const offCamera = camera.clone();
  offCamera.aspect = w / h;
  offCamera.updateProjectionMatrix();

  // Save original materials
  const savedMaterials = new Map();
  const savedBackground = scene.background.clone();

  const gridWasVisible = grid.visible;
    grid.visible = false;

  if (mode === 'depth') {
    // Normalize depth to tight bounding box in camera space
    const box = new THREE.Box3().setFromObject(currentModel);
    const corners = [
      new THREE.Vector3(box.min.x, box.min.y, box.min.z),
      new THREE.Vector3(box.min.x, box.min.y, box.max.z),
      new THREE.Vector3(box.min.x, box.max.y, box.min.z),
      new THREE.Vector3(box.min.x, box.max.y, box.max.z),
      new THREE.Vector3(box.max.x, box.min.y, box.min.z),
      new THREE.Vector3(box.max.x, box.min.y, box.max.z),
      new THREE.Vector3(box.max.x, box.max.y, box.min.z),
      new THREE.Vector3(box.max.x, box.max.y, box.max.z),
    ];
    let nearDist = Infinity, farDist = -Infinity;
    const viewMatrix = offCamera.matrixWorldInverse;
    for (const c of corners) {
      const z = -c.clone().applyMatrix4(viewMatrix).z;
      if (z < nearDist) nearDist = z;
      if (z > farDist) farDist = z;
    }
    nearDist = Math.max(0.001, nearDist);
    // Small padding to avoid clipping at edges
    const padding = (farDist - nearDist) * 0.02;
    nearDist = Math.max(0.001, nearDist - padding);
    farDist = farDist + padding;

    scene.background = new THREE.Color(0x000000);
    currentModel.traverse(child => {
      if (child.isMesh || child.isSkinnedMesh) {
        savedMaterials.set(child, child.material);
        child.material = new THREE.MeshDepthMaterial({
          depthPacking: THREE.BasicDepthPacking,
        });
      }
    });
    offCamera.near = nearDist;
    offCamera.far = farDist;
    offCamera.updateProjectionMatrix();
  } else if (mode === 'normal') {
    scene.background = new THREE.Color(0x8080ff);
    currentModel.traverse(child => {
      if (child.isMesh || child.isSkinnedMesh) {
        savedMaterials.set(child, child.material);
        child.material = new THREE.MeshNormalMaterial();
      }
    });
  } else {
    // Color render — keep current materials, white background
    scene.background = new THREE.Color(0xffffff);
  }

  // Render
  offRenderer.render(scene, offCamera);

  // Export PNG
  const dataURL = offRenderer.domElement.toDataURL('image/png');
  const link = document.createElement('a');
  const modelName = document.getElementById('model-select').selectedOptions[0]?.textContent || 'model';
  link.download = `${modelName}_${mode}_${w}x${h}.png`;
  link.href = dataURL;
  link.click();

  // Restore
  scene.background = savedBackground;
  savedMaterials.forEach((mat, child) => { child.material = mat; });

  grid.visible = gridWasVisible;

  offRenderer.dispose();
}


function captureDepth4View() {
  if (!currentModel) return;

  const resSelect = document.getElementById('capture-res');
  const resVal = resSelect.value;
  let w, h;
  if (resVal === '896') { w = 896; h = 1152; }
  else { w = parseInt(resVal); h = w; }

  const offRenderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  offRenderer.setSize(w, h);
  offRenderer.outputColorSpace = THREE.SRGBColorSpace;

  const box = new THREE.Box3().setFromObject(currentModel);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  const dist = maxDim * 1.8;

  const savedBackground = scene.background.clone();
  const savedMaterials = new Map();
  const gridWasVisible = grid.visible;
  grid.visible = false;

  scene.background = new THREE.Color(0x000000);
  currentModel.traverse(child => {
    if (child.isMesh || child.isSkinnedMesh) {
      savedMaterials.set(child, child.material);
      child.material = new THREE.MeshDepthMaterial({ depthPacking: THREE.BasicDepthPacking });
    }
  });

  const views = [
    { name: 'front', dir: new THREE.Vector3(0, 0, 1) },
    { name: 'back',  dir: new THREE.Vector3(0, 0, -1) },
    { name: 'left',  dir: new THREE.Vector3(-1, 0, 0) },
    { name: 'right', dir: new THREE.Vector3(1, 0, 0) },
  ];

  const offCamera = new THREE.PerspectiveCamera(50, w / h, 0.001, 100);
  const modelName = document.getElementById('model-select').selectedOptions[0]?.textContent || 'model';

  for (const view of views) {
    const pos = center.clone().add(view.dir.clone().multiplyScalar(dist));
    offCamera.position.copy(pos);
    offCamera.lookAt(center);
    offCamera.updateMatrixWorld();

    // Tight near/far from bounding box corners
    const corners = [
      new THREE.Vector3(box.min.x, box.min.y, box.min.z),
      new THREE.Vector3(box.min.x, box.min.y, box.max.z),
      new THREE.Vector3(box.min.x, box.max.y, box.min.z),
      new THREE.Vector3(box.min.x, box.max.y, box.max.z),
      new THREE.Vector3(box.max.x, box.min.y, box.min.z),
      new THREE.Vector3(box.max.x, box.min.y, box.max.z),
      new THREE.Vector3(box.max.x, box.max.y, box.min.z),
      new THREE.Vector3(box.max.x, box.max.y, box.max.z),
    ];
    let nearZ = Infinity, farZ = -Infinity;
    for (const c of corners) {
      const z = -c.clone().applyMatrix4(offCamera.matrixWorldInverse).z;
      if (z < nearZ) nearZ = z;
      if (z > farZ) farZ = z;
    }
    const padding = (farZ - nearZ) * 0.02;
    offCamera.near = Math.max(0.001, nearZ - padding);
    offCamera.far = farZ + padding;
    offCamera.updateProjectionMatrix();

    offRenderer.render(scene, offCamera);

    const dataURL = offRenderer.domElement.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = modelName + '_depth_' + view.name + '_' + w + 'x' + h + '.png';
    link.href = dataURL;
    link.click();
  }

  // Restore
  scene.background = savedBackground;
  savedMaterials.forEach((mat, child) => { child.material = mat; });
  grid.visible = gridWasVisible;
  offRenderer.dispose();
}

document.getElementById('capture-depth').addEventListener('click', () => captureRender('depth'));
document.getElementById('capture-normal').addEventListener('click', () => captureRender('normal'));
document.getElementById('capture-color').addEventListener('click', () => captureRender('color'));
document.getElementById('capture-depth4').addEventListener('click', captureDepth4View);

// ── Init ─────────────────────────────────────────────────────

resize();
// Load shader first, then models (shader must be ready before applying to models)
loadShaderPreset('fresnel').then(() => loadModelList());
animate();
