#!/usr/bin/env node
/**
 * Run `npm install` on the default registry; if it fails, retry once against npmmirror.
 * Extra args are forwarded (e.g. `npm run install:retry -- --no-fund`).
 */
import { spawnSync } from 'node:child_process';

const NPM_MIRROR = 'https://registry.npmmirror.com';
const extra = process.argv.slice(2);

function npmInstall(registry) {
  const args = ['install', ...extra];
  if (registry) {
    args.push('--registry', registry);
  }
  return spawnSync('npm', args, { stdio: 'inherit' });
}

const first = npmInstall(undefined);
if (first.status === 0) {
  process.exit(0);
}

console.error('\nnpm install failed; retrying with npmmirror…\n');
const second = npmInstall(NPM_MIRROR);
process.exit(second.status ?? 1);
