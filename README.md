# Ali Rizwan Tariq — portfolio

A single-page portfolio. Plain HTML, CSS and JavaScript — no framework, no build
step, no dependencies. Open `index.html` and it works.

**Live site:** _add the URL here after your first deploy_

---

## Why it's built this way

- **No build step.** Nothing to break, nothing to keep updated. Edit the HTML,
  push, done.
- **Readable without JavaScript.** All the content is in the HTML. `main.js`
  only adds the theme toggle, scroll reveals, active-nav highlighting and the
  copy-email button.
- **ATS-legible.** Section headings carry the standard terms a résumé parser
  expects (Work experience, Education, Skills, Professional summary, Projects),
  job entries use `<time datetime>`, and every claim is real text — never an
  image of text.
- **Accessible.** Skip link, landmarks, one `<h1>`, visible focus rings, WCAG AA
  contrast in both themes, `prefers-reduced-motion` and `prefers-contrast`
  respected, 44px+ touch targets.

## Files

```
index.html                     the whole page
styles.css                     all styling, light + dark themes
main.js                        progressive enhancement only
404.html                       not-found page
og.png                         social share card (1200×630)
favicon.svg
robots.txt
Ali-Rizwan-Tariq-Resume.pdf    linked from the hero and contact section
assets/                        put your portrait photo here (see assets/README.md)
tools/ats-audit.mjs            scores the page the way a parser reads it
netlify.toml / vercel.json     headers + caching for either host
```

## Local preview

Any static server works. The page uses root-relative paths (`/styles.css`), so
open it through a server rather than double-clicking the file:

```bash
npx serve .
```

Then visit the URL it prints (usually http://localhost:3000).

## Editing

Everything is in `index.html` in plain, commented sections. The common edits:

| What | Where |
| --- | --- |
| Elevator pitch | `<section class="hero">` |
| Impact numbers | `<ul class="stat-grid">` |
| Case studies | `<ol class="cases">` |
| Jobs | `<div class="timeline">` — keep newest first |
| Skills | `<div class="toolkit">` |
| Colours and type | the `:root` token block at the top of `styles.css` |

After editing, re-run the audit:

```bash
node tools/ats-audit.mjs
```

## The ATS audit

`tools/ats-audit.mjs` scores the page out of 100 across seven groups: contact
block, standard section headings, work-history structure, text extractability,
keyword coverage, machine-readable metadata, and legibility. It also flags the
things modern parsers actively penalise — hidden text, zero-size text and
keyword stuffing.

It is a heuristic built from published ATS guidance, not a particular vendor's
parser. Treat the number as a checklist with a score attached, not a guarantee.

Criteria drawn from:

- [Jobscan — Anatomy of an ATS friendly resume format (2026)](https://www.jobscan.co/blog/20-ats-friendly-resume-templates/)
- [JobShinobi — ATS-optimized resume section headings that parse](https://www.jobshinobi.com/blog/ats-optimized-resume-section-headings-that-parse)
- [Hireflow — Best resume section headings for ATS recognition](https://hireflow.net/blog/best-resume-section-headings-for-ats-recognition)
- [QuickCV — I tested 8 ATS systems to see how they actually parse resumes](https://quickcv.io/blog/i-tested-8-ats-systems-to-see-how-they-actually-parse-resumes)
- [Resume Optimizer Pro — ATS resume best practices 2026, and what now backfires](https://resumeoptimizerpro.com/blog/ats-friendly-resume-tips)

## After deploying

Two small things to update once you know your domain:

1. `robots.txt` — uncomment the `Sitemap:` line and set your domain.
2. `index.html` — change `og:image` and `twitter:image` from `/og.png` to the
   absolute URL (`https://yourdomain.com/og.png`). Some social scrapers
   won't resolve relative image paths.

## Licence

Content (copy, résumé, photo) © Ali Rizwan Tariq. Code is free to learn from.
