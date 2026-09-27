#!/usr/bin/env node
/**
 * manage_design.js — 360 DESIGNER storage & history manager.
 *
 * Bundles the composed PNG + PDF into a ZIP and records the ORIGINAL request
 * (prompt + spec) into design_history.json so later edits can recall what was
 * asked for the first time and adjust instead of starting over.
 *
 * Usage:
 *   node manage_design.js --output-dir "<dir>" --image-name "360_standee_bni" \
 *        --prompt "Thiết kế standee cho BNI" --spec-file "/tmp/spec.json"
 *
 * --output-dir   defaults to resources/defaults.json -> output_dir
 * --image-name   base filename used for .png/.pdf/.zip (required)
 * --prompt       the user's original short request (stored for edit memory)
 * --spec-file    optional path to the spec json used (stored for reproducibility)
 * --test         run a self-check and exit
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Accept both "--key=value" and "--key value" forms.
const args = {};
const argv = process.argv.slice(2);
for (let n = 0; n < argv.length; n++) {
  const a = argv[n];
  if (!a.startsWith('--')) continue;
  const i = a.indexOf('=');
  if (i > -1) {
    args[a.slice(2, i)] = a.slice(i + 1);
  } else {
    const key = a.slice(2);
    const next = argv[n + 1];
    if (next !== undefined && !next.startsWith('--')) { args[key] = next; n++; }
    else { args[key] = true; }
  }
}

const defaultsPath = path.join(__dirname, '..', 'resources', 'defaults.json');

if (args.test) {
  const ok = fs.existsSync(defaultsPath);
  console.log(ok ? '[SUCCESS] manage_design.js test ok (defaults found)'
                 : '[ERROR] defaults.json missing');
  process.exit(ok ? 0 : 1);
}

let outputDir = args['output-dir'];
if (!outputDir && fs.existsSync(defaultsPath)) {
  outputDir = JSON.parse(fs.readFileSync(defaultsPath, 'utf8')).output_dir;
}
const imageName = args['image-name'];
const prompt = args['prompt'] || '';
const specFile = args['spec-file'];

if (!outputDir || !imageName) {
  console.error('[ERROR] --output-dir and --image-name are required.');
  process.exit(1);
}

try {
  fs.mkdirSync(outputDir, { recursive: true });

  const png = path.join(outputDir, `${imageName}.png`);
  const pdf = path.join(outputDir, `${imageName}.pdf`);
  const zip = path.join(outputDir, `${imageName}.zip`);

  if (!fs.existsSync(png)) throw new Error(`PNG not found: ${png}`);

  // Build ZIP (PNG + PDF if present)
  let files = `"${imageName}.png"`;
  if (fs.existsSync(pdf)) files += ` "${imageName}.pdf"`;
  execSync(`zip -j "${imageName}.zip" ${files}`, { cwd: outputDir });
  console.log(`[SUCCESS] ZIP: ${zip}`);

  // History (edit memory)
  const histPath = path.join(outputDir, 'design_history.json');
  let hist = { designs: {} };
  if (fs.existsSync(histPath)) {
    try { hist = JSON.parse(fs.readFileSync(histPath, 'utf8')); hist.designs = hist.designs || {}; }
    catch (e) { console.warn(`[WARN] resetting history: ${e.message}`); }
  }

  const key = imageName.replace(/^360_/, '');
  let spec = null;
  if (specFile && fs.existsSync(specFile)) {
    try { spec = JSON.parse(fs.readFileSync(specFile, 'utf8')); } catch (_) {}
  }

  if (!hist.designs[key]) {
    hist.designs[key] = { original_prompt: prompt, original_spec: spec, history: [] };
  }
  hist.designs[key].history.push({
    timestamp: new Date().toISOString(),
    version: hist.designs[key].history.length + 1,
    prompt: prompt,
    spec: spec,
    files: { png, pdf: fs.existsSync(pdf) ? pdf : null, zip }
  });

  fs.writeFileSync(histPath, JSON.stringify(hist, null, 2), 'utf8');
  console.log(`[SUCCESS] history updated: ${histPath}`);
  console.log(JSON.stringify({ png, pdf: fs.existsSync(pdf) ? pdf : null, zip }));
} catch (e) {
  console.error(`[ERROR] ${e.message}`);
  process.exit(1);
}
