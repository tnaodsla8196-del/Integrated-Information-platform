const { spawnSync } = require('child_process');
const fs = require('fs');

console.log("Searching for tsc...");
const paths = [
  'node_modules/typescript/lib/tsc.js',
  'node_modules/typescript/bin/tsc',
  'node_modules/.bin/tsc',
  'node_modules/.bin/tsc.cmd'
];

let tscPath = null;
for (const p of paths) {
  if (fs.existsSync(p)) {
    tscPath = p;
    break;
  }
}

if (!tscPath) {
  fs.writeFileSync('tsc_output.txt', 'tsc not found in paths');
  console.log('tsc not found');
  process.exit(1);
}

console.log("Running tsc from", tscPath);
const result = spawnSync('node', [tscPath, '--noEmit'], {
  cwd: __dirname,
  encoding: 'utf8'
});

fs.writeFileSync('tsc_output.txt', `STDOUT:\n${result.stdout}\n\nSTDERR:\n${result.stderr}\n\nCODE: ${result.status}`);
console.log("Done. Code:", result.status);
