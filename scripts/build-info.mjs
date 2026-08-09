// Generates server/version.json from git metadata.
// The running app reads this file to report which commit it was built from,
// so stale Docker deployments (e.g. OAuth config drift) are easy to spot.
//
// Run automatically by `npm run build`; the Dockerfile bakes the same shape
// from --build-arg values when building inside a container (where .git is
// excluded from the build context).
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'server', 'version.json');

const git = (args) => {
  try {
    return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
};

const commit = git(['rev-parse', '--short', 'HEAD']);
const info = {
  commit: commit || 'unknown',
  date: git(['log', '-1', '--format=%cI']),
  describe: git(['describe', '--tags', '--always', '--dirty']),
  buildTime: new Date().toISOString(),
  source: commit ? 'git' : 'unknown',
};

writeFileSync(out, JSON.stringify(info, null, 2) + '\n');
console.log(`📦 Build info → server/version.json (${info.commit}${info.describe ? ' · ' + info.describe : ''})`);
