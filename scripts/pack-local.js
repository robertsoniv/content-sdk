// Packs locally built packages into packages/<name>/package.tgz so they can be
// consumed by other local projects (e.g. "file:../content-sdk/packages/nextjs/package.tgz").
// Run after `yarn build`.
const { execSync } = require('child_process');
const path = require('path');

const packages = ['core', 'content', 'react', 'commerce', 'nextjs'];

for (const pkg of packages) {
  const cwd = path.resolve(__dirname, '..', 'packages', pkg);
  console.log(`Packing ${pkg}...`);
  execSync('yarn pack --out package.tgz', { cwd, stdio: 'inherit' });
}
