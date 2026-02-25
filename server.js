const express = require('express');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = 3000;

app.use(express.static('public'));

// List models
app.get('/api/models', async (req, res) => {
  try {
    const modelsDir = '/models';
    const files = await fs.readdir(modelsDir);
    const models = files.filter(f => /\.(glb|gltf|obj|fbx)$/i.test(f));
    res.json(models);
  } catch (err) {
    res.json([]);
  }
});

// Serve model file
app.get('/api/models/:filename', (req, res) => {
  const filePath = path.join('/models', path.basename(req.params.filename));
  res.sendFile(filePath);
});

// List shader presets
app.get('/api/shaders', async (req, res) => {
  try {
    const shaderDir = path.join(__dirname, 'public/shaders');
    const files = await fs.readdir(shaderDir);
    const names = [...new Set(files.map(f => f.replace(/\.(vert|frag)$/, '')))];
    res.json(names);
  } catch (err) {
    res.json([]);
  }
});

// Get shader source
app.get('/api/shaders/:name', async (req, res) => {
  try {
    const shaderDir = path.join(__dirname, 'public/shaders');
    const name = path.basename(req.params.name);
    const vert = await fs.readFile(path.join(shaderDir, `${name}.vert`), 'utf8');
    const frag = await fs.readFile(path.join(shaderDir, `${name}.frag`), 'utf8');
    res.json({ vertex: vert, fragment: frag });
  } catch (err) {
    res.status(404).json({ error: 'Shader not found' });
  }
});

app.listen(PORT, () => console.log(`Cake Topper Viewer running on port ${PORT}`));
