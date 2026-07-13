// Persisted tracker configuration (config.json, gitignored).
// `outputDir` points at the comfyui-canvas output directory that the ingest
// scanner watches. Falls back to the OUTPUT_DIR env var.

const fs = require('fs');
const path = require('path');

const CONFIG_FILE = path.join(__dirname, '..', 'config.json');

const defaults = {
  outputDir: process.env.OUTPUT_DIR || '',
};

function load() {
  try {
    return { ...defaults, ...JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')) };
  } catch {
    return { ...defaults };
  }
}

let config = load();

function get() {
  return config;
}

function update(patch) {
  config = { ...config, ...patch };
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
  return config;
}

module.exports = { get, update };
