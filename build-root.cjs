const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('[Poach Deploy] Building frontend assets in ./frontend ...');
execSync('npm install --include=dev && npm run build', {
  cwd: path.join(__dirname, 'frontend'),
  stdio: 'inherit'
});

const srcDist = path.join(__dirname, 'frontend', 'dist');
const destDist = path.join(__dirname, 'dist');

if (fs.existsSync(srcDist)) {
  fs.cpSync(srcDist, destDist, { recursive: true });
  console.log('[Poach Deploy] Successfully mirrored build artifacts from frontend/dist -> ./dist');
}
