const fs = require('fs');
const path = require('path');

function makeTmpDir(name) {
  const dir = path.join(__dirname, 'tmp', name);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function readDecisions(dir, featureId) {
  const file = path.join(dir, `feature-${featureId}-decisions.md`);
  if (!fs.existsSync(file)) return '';
  return fs.readFileSync(file, 'utf8');
}

module.exports = { makeTmpDir, readDecisions };
