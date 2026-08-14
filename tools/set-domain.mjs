#!/usr/bin/env node
/**
 * set-domain.mjs — repoint every absolute URL in the site at a new domain.
 *
 *   node tools/set-domain.mjs alirizwantariq.vercel.app
 *   node tools/set-domain.mjs alirizwantariq.com --dry-run
 *
 * Absolute URLs are unavoidable in a few places: social scrapers won't resolve
 * a relative og:image, and rel=canonical / sitemap <loc> must be absolute. So
 * the domain is pinned in several files at once, and this keeps them in sync.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const raw = args.find((a) => !a.startsWith('--'));

if (!raw) {
  console.error('usage: node tools/set-domain.mjs <domain> [--dry-run]');
  console.error('   eg: node tools/set-domain.mjs alirizwantariq.vercel.app');
  process.exit(1);
}

// Accept "example.com", "https://example.com", or "https://example.com/"
const host = raw.replace(/^https?:\/\//, '').replace(/\/+$/, '');
if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(host)) {
  console.error(`"${raw}" doesn't look like a hostname.`);
  process.exit(1);
}
const base = `https://${host}`;

const FILES = ['index.html', 'robots.txt', 'sitemap.xml', 'README.md'];

// Any https:// origin we previously pinned. Deliberately narrow so it never
// touches linkedin.com, github.com, fonts.googleapis.com, schema.org, etc.
const PINNED = /https:\/\/((?:[a-z0-9-]+\.)*vercel\.app|alirizwantariq\.[a-z]+|ali-rizwan-tariq\.[a-z]+)/gi;

let totalEdits = 0;
const summary = [];

for (const file of FILES) {
  const full = path.join(root, file);
  let text;
  try {
    text = await readFile(full, 'utf8');
  } catch {
    summary.push([file, 'skipped (not found)']);
    continue;
  }

  const found = text.match(PINNED) || [];
  const distinct = [...new Set(found)];
  const updated = text.replace(PINNED, base);

  if (updated === text) {
    summary.push([file, found.length ? 'already current' : 'no pinned URLs']);
    continue;
  }

  totalEdits += found.length;
  summary.push([file, `${found.length} URL${found.length === 1 ? '' : 's'} → ${base}`
    + (distinct.length ? `  (was: ${distinct.join(', ')})` : '')]);

  if (!dryRun) await writeFile(full, updated, 'utf8');
}

console.log(`\n  ${dryRun ? 'Dry run — nothing written' : 'Updated'}: ${base}\n`);
for (const [file, note] of summary) {
  console.log(`    ${file.padEnd(14)} ${note}`);
}
console.log(`\n  ${totalEdits} URL${totalEdits === 1 ? '' : 's'} ${dryRun ? 'would change' : 'changed'}.`);

if (!dryRun && totalEdits) {
  console.log(`
  Next:
    node tools/ats-audit.mjs
    git commit -am "Point absolute URLs at ${host}" && git push

  Then refresh the LinkedIn preview cache:
    https://www.linkedin.com/post-inspector/
`);
}
