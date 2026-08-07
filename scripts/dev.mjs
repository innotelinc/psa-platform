// Dev runner: boots the Express API and the Vite dev server together.
import { spawn } from 'node:child_process';

const children = [
  spawn('npm', ['--prefix', 'server', 'run', 'dev'], { stdio: 'inherit', shell: process.platform === 'win32' }),
  spawn('npm', ['--prefix', 'client', 'run', 'dev'], { stdio: 'inherit', shell: process.platform === 'win32' }),
];

function kill() {
  for (const c of children) {
    try { c.kill('SIGTERM'); } catch {}
  }
  process.exit(0);
}
process.on('SIGINT', kill);
process.on('SIGTERM', kill);
