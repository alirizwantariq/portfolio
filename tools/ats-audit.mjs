#!/usr/bin/env node
/**
 * ats-audit.mjs — score this portfolio the way a resume parser / recruiter
 * crawler would read it.
 *
 * Run:  node tools/ats-audit.mjs [path-to-index.html]
 *
 * The rubric follows publicly documented ATS parsing behaviour:
 *   - parsers extract raw text and sort it into Name / Contact / Experience /
 *     Education / Skills fields, so those fields must exist as plain text
 *   - they rely on *standard* section labels ("Work Experience", "Education",
 *     "Skills"); creative headings land content in the wrong field
 *   - single-column reading order parses reliably; multi-column, tables,
 *     text boxes and text-inside-images do not
 *   - match score is driven by keyword overlap with the job description
 *   - hidden/white text and repeated keyword stuffing are actively penalised
 *   - body text under ~10pt can be dropped as decorative metadata
 *
 * Sources are listed in README.md. This is a heuristic, not a specific
 * vendor's parser — treat it as a checklist with a number attached.
 */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const target = process.argv[2] || path.join(here, '..', 'index.html');
const html = await readFile(target, 'utf8');

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

const ENTITIES = {
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'",
  '&nbsp;': ' ', '&mdash;': '—', '&ndash;': '–', '&eacute;': 'é',
};

function decode(s) {
  return s.replace(/&[a-z#0-9]+;/gi, (m) => ENTITIES[m] ?? m);
}

/** Visible text, the way a parser that strips markup would see it. */
function visibleText(source) {
  return decode(
    source
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
  ).replace(/\s+/g, ' ').trim();
}

function tagText(source, tag) {
  const out = [];
  const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, 'gi');
  let m;
  while ((m = re.exec(source))) out.push(visibleText(m[1]));
  return out;
}

function attr(source, re) {
  const m = source.match(re);
  return m ? m[1] : null;
}

/* Relative luminance + WCAG contrast, for the legibility checks. */
function luminance(hex) {
  const n = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(n.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a, b) {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

/* ------------------------------------------------------------------ */
/* the report                                                          */
/* ------------------------------------------------------------------ */

const text = visibleText(html);
const lower = text.toLowerCase();
const headings = [...tagText(html, 'h1'), ...tagText(html, 'h2'), ...tagText(html, 'h3')];
const headingBlob = headings.join(' | ').toLowerCase();

const sections = [];
let earned = 0;
let possible = 0;

function group(name, max, checks) {
  const rows = checks.map(([label, ok, note]) => ({
    label,
    ok: !!ok,
    points: ok ? 1 : 0,
    note: note || '',
  }));
  const hit = rows.filter((r) => r.ok).length;
  const score = Math.round((hit / rows.length) * max * 10) / 10;
  earned += score;
  possible += max;
  sections.push({ name, max, score, rows });
}

/* --- 1. Contact block (parsers fill Name / Email / Phone / Location) --- */
const email = 'art.dev200@gmail.com';
group('Contact block', 15, [
  ['Name appears as plain text', /ali rizwan tariq/i.test(text)],
  ['Email present as readable text', lower.includes(email)],
  ['Email is a mailto: link', html.includes(`mailto:${email}`)],
  ['Phone present as readable text', /\+92\s?304\s?0003920/.test(text)],
  ['Phone is a tel: link', /href="tel:\+?\d+"/.test(html)],
  ['Location (city + country)', /lahore/i.test(text) && /pakistan/i.test(text)],
  ['LinkedIn profile URL', /linkedin\.com\/in\//i.test(html)],
  ['GitHub profile URL', /github\.com\//i.test(html)],
]);

/* --- 2. Standard section labels --- */
group('Standard section headings', 15, [
  ['"Work experience" heading', /work experience/.test(headingBlob)],
  ['"Education" heading', /education/.test(headingBlob)],
  ['"Skills" heading', /\bskills\b/.test(headingBlob)],
  ['"Professional summary" heading', /professional summary|summary/.test(headingBlob)],
  ['"Projects" heading', /projects?/.test(headingBlob)],
  ['"Contact" heading', /contact/.test(headingBlob)],
  ['Single <h1> on the page', tagText(html, 'h1').length === 1],
]);

/* --- 3. Work history structure --- */
const jobBlocks = [...html.matchAll(/<article class="job[\s\S]*?<\/article>/g)].map((m) => m[0]);
const dated = jobBlocks.filter((b) => /<time datetime="\d{4}-\d{2}"/.test(b));
const titled = jobBlocks.filter((b) => /class="job-title"/.test(b));
const companied = jobBlocks.filter((b) => /class="job-company"/.test(b));

const starts = jobBlocks.map((b) => {
  const m = b.match(/<time datetime="(\d{4}-\d{2})"/);
  return m ? m[1] : '';
});
const isReverseChron = starts.every((v, i, a) => i === 0 || a[i - 1] >= v);

group('Work history structure', 20, [
  [`Job entries found (${jobBlocks.length})`, jobBlocks.length >= 4],
  ['Every entry has a job title', titled.length === jobBlocks.length && jobBlocks.length > 0],
  ['Every entry has a company name', companied.length === jobBlocks.length && jobBlocks.length > 0],
  ['Every entry has machine-readable <time datetime>', dated.length === jobBlocks.length && jobBlocks.length > 0],
  ['Entries are in reverse-chronological order', isReverseChron],
  ['Achievements are bulleted <li>, not prose blobs', (html.match(/<li>/g) || []).length >= 15],
  ['Multiple roles at one employer are grouped', /class="role-list"/.test(html)],
  ['Education entry with dates', /class="edu-line"/.test(html) && /class="edu-dates"/.test(html)],
]);

/* --- 4. Text extractability --- */
const imgs = [...html.matchAll(/<img\b[^>]*>/g)].map((m) => m[0]);
const imgsWithAlt = imgs.filter((t) => /\balt="[^"]+"/.test(t));
const cssContent = [...html.matchAll(/content:\s*"[^"]{3,}"/g)];

group('Text extractability', 15, [
  ['Body copy is real text, not screenshots', text.length > 3000],
  [`Every <img> has alt text (${imgsWithAlt.length}/${imgs.length})`, imgs.length === imgsWithAlt.length],
  ['No meaningful copy locked inside CSS content:', cssContent.length === 0],
  ['Content present in HTML without running JS', !/document\.write|innerHTML\s*=/.test(html)],
  ['Single-column source order (no layout <table>)', !/<table/i.test(html)],
  ['Downloadable résumé file linked', /\.pdf"/.test(html)],
]);

/* --- 5. Keyword coverage against a full-stack + AI/ML JD corpus --- */
const KEYWORDS = {
  'Languages & runtimes': ['python', 'javascript', 'typescript', 'node.js', 'sql', 'html', 'css'],
  'Web frameworks': ['vue', 'nestjs', 'rest', 'api', 'mongodb', 'microservice', 'frontend', 'backend', 'full stack'],
  'ML & data': ['machine learning', 'computer vision', 'model training', 'model deployment',
    'data science', 'anomaly detection', 'yolo', 'vision transformer', 'rag',
    'data preprocessing', 'real-time', 'pipeline'],
  'Infrastructure': ['edge computing', 'jetson', 'raspberry pi', 'iot', 'deployment', 'monitoring', 'scalable'],
  'Security & domain': ['fraud detection', 'zero trust', 'authentication', 'kyc', 'kyb', 'aml',
    'compliance', 'vulnerabilit', 'security'],
  'Ways of working': ['agile', 'team', 'collaboration', 'leadership', 'problem solving',
    'testing', 'selenium', 'specification'],
};

const kwRows = [];
let kwHit = 0;
let kwTotal = 0;
for (const [bucket, words] of Object.entries(KEYWORDS)) {
  const hits = words.filter((w) => lower.includes(w));
  kwHit += hits.length;
  kwTotal += words.length;
  const missing = words.filter((w) => !lower.includes(w));
  kwRows.push([
    `${bucket} (${hits.length}/${words.length})${missing.length ? ` — missing: ${missing.join(', ')}` : ''}`,
    hits.length / words.length >= 0.7,
    missing.join(', '),
  ]);
}
group('Keyword coverage', 20, kwRows);
const kwCoverage = Math.round((kwHit / kwTotal) * 100);

/* --- 6. Machine-readable metadata --- */
const title = attr(html, /<title>([^<]+)<\/title>/);
const desc = attr(html, /<meta name="description" content="([^"]+)"/);
group('Machine-readable metadata', 10, [
  ['<title> contains name and role', !!title && /ali rizwan tariq/i.test(title) && /engineer/i.test(title)],
  [`Meta description present (${desc ? desc.length : 0} chars, ideal 120–165)`,
    !!desc && desc.length >= 120 && desc.length <= 170],
  ['JSON-LD Person schema', /"@type":\s*"Person"/.test(html)],
  ['Schema lists jobTitle, email and skills', /"jobTitle"/.test(html) && /"knowsAbout"/.test(html)],
  ['<html lang> set', /<html lang="[a-z-]+"/i.test(html)],
  ['Indexable (no noindex on the page)', !/name="robots" content="[^"]*noindex/i.test(html)],
]);

/* --- 7. Legibility (small text gets dropped; low contrast loses humans) --- */
let css = '';
try {
  css = await readFile(path.join(path.dirname(target), 'styles.css'), 'utf8');
} catch { /* optional */ }

const baseSize = parseFloat((css.match(/font-size:\s*([\d.]+)rem;\s*\/\* 1[0-9]px/) || [])[1] || '0');
const basePx = baseSize * 16;

/* Read the palette out of styles.css rather than hardcoding it, so this check
   can't silently drift the next time the colours are retuned. */
function tokens(blockRe) {
  const block = (css.match(blockRe) || [])[0] || '';
  const out = {};
  for (const m of block.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-f]{6})/gi)) out[m[1]] = m[2];
  return out;
}
const light = tokens(/:root\s*\{[\s\S]*?\}/);
const dark = tokens(/:root\[data-theme="dark"\]\s*\{[\s\S]*?\}/);

const pairs = [];
for (const [label, t] of [['light', light], ['dark', dark]]) {
  if (!t.bg) continue;
  pairs.push(
    [`body text (${label})`, t['ink-2'], t.bg],
    [`metadata (${label})`, t['ink-3'], t.bg],
    [`links (${label})`, t.accent, t.bg],
    [`metadata on band (${label})`, t['ink-3'], t['bg-alt']],
    [`body on card (${label})`, t['ink-2'], t.surface],
  );
}
const contrastRows = pairs.map(([label, fg, bg]) => {
  const ratio = contrast(fg, bg);
  return [`${label} contrast ${ratio.toFixed(2)}:1`, ratio >= 4.5, ratio >= 4.5 ? '' : 'below WCAG AA 4.5:1'];
});
group('Legibility', 5, [
  [`Base font size ${basePx || '?'}px (≥16px)`, basePx >= 16],
  ...contrastRows,
]);

/* --- Penalties: the things 2026 parsers actively punish --- */
const penalties = [];
const words = lower.match(/[a-z][a-z.+#-]{2,}/g) || [];
const freq = {};
for (const w of words) freq[w] = (freq[w] || 0) + 1;
const stuffed = Object.entries(freq)
  .filter(([w, n]) => n / words.length > 0.02 && !['the', 'and', 'that', 'for', 'with', 'from'].includes(w));
if (stuffed.length) penalties.push(`Possible keyword stuffing: ${stuffed.map(([w, n]) => `${w}×${n}`).join(', ')}`);
if (/color:\s*(#fff|#ffffff|white)[^}]*background[^}]*(#fff|#ffffff|white)/i.test(css))
  penalties.push('White-on-white text detected');
if (/font-size:\s*0\s*(px|rem|em|pt)?\s*[;}!]/.test(css)) penalties.push('Zero-size text detected');
const srOnlyCount = (html.match(/class="sr-only"/g) || []).length;
if (srOnlyCount > 3) penalties.push(`${srOnlyCount} visually-hidden text blocks — keep this low`);

/* ------------------------------------------------------------------ */
/* output                                                              */
/* ------------------------------------------------------------------ */

const total = Math.round(earned * 10) / 10;
const pct = Math.round((total / possible) * 100);
const grade = pct >= 90 ? 'Excellent' : pct >= 80 ? 'Strong' : pct >= 70 ? 'Good' : pct >= 60 ? 'Fair' : 'Needs work';

const bar = (s, m) => {
  const filled = Math.round((s / m) * 20);
  return '█'.repeat(filled) + '░'.repeat(20 - filled);
};

console.log(`\n  ATS & recruiter-parse audit — ${path.basename(target)}`);
console.log(`  ${'─'.repeat(64)}`);

for (const s of sections) {
  console.log(`\n  ${s.name}  ${bar(s.score, s.max)}  ${s.score}/${s.max}`);
  for (const r of s.rows) {
    console.log(`    ${r.ok ? '✓' : '✗'} ${r.label}${r.note && !r.ok ? `  → missing: ${r.note}` : ''}`);
  }
}

console.log(`\n  ${'─'.repeat(64)}`);
console.log(`  Keyword coverage: ${kwCoverage}%  (${kwHit}/${kwTotal} target terms present)`);
console.log(`  Word count: ${words.length}`);
if (penalties.length) {
  console.log(`\n  Penalties`);
  for (const p of penalties) console.log(`    ! ${p}`);
} else {
  console.log(`  Penalties: none detected`);
}
console.log(`\n  SCORE  ${total}/${possible}  →  ${pct}/100  (${grade})\n`);

process.exitCode = pct >= 70 ? 0 : 1;
