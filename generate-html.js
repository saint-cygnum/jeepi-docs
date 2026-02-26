#!/usr/bin/env node
/**
 * Converts a markdown file to a colorful, self-contained HTML document.
 * Usage: node generate-html.js <input.md> <output.html> [title]
 */
const fs = require('fs');
const { marked } = require('marked');

const [,, inputPath, outputPath, title] = process.argv;
if (!inputPath || !outputPath) {
    console.error('Usage: node generate-html.js <input.md> <output.html> [title]');
    process.exit(1);
}

const md = fs.readFileSync(inputPath, 'utf8');

// Collect headings for sidebar TOC
const headings = [];
const renderer = new marked.Renderer();

// Override heading renderer to add IDs and collect for TOC
renderer.heading = function ({ text, depth }) {
    // Strip HTML tags for ID generation
    const rawText = text.replace(/<[^>]+>/g, '');
    const id = rawText.toLowerCase().replace(/[^\w]+/g, '-').replace(/^-|-$/g, '');
    headings.push({ depth, text: rawText, id });

    const tag = `h${depth}`;
    // Add status badges
    let badge = '';
    if (rawText.includes('✅')) badge = '<span class="badge badge-completed">Completed</span>';
    else if (rawText.includes('⏳')) badge = '<span class="badge badge-pending">Pending</span>';

    return `<${tag} id="${id}">${text} ${badge}</${tag}>\n`;
};

// Style tables
renderer.table = function ({ header, rows }) {
    let headerHtml = '<thead><tr>';
    for (const cell of header) {
        headerHtml += `<th${cell.align ? ` style="text-align:${cell.align}"` : ''}>${cell.text}</th>`;
    }
    headerHtml += '</tr></thead>';

    let bodyHtml = '<tbody>';
    for (const row of rows) {
        bodyHtml += '<tr>';
        for (const cell of row) {
            bodyHtml += `<td${cell.align ? ` style="text-align:${cell.align}"` : ''}>${cell.text}</td>`;
        }
        bodyHtml += '</tr>';
    }
    bodyHtml += '</tbody>';

    return `<table>${headerHtml}${bodyHtml}</table>\n`;
};

// Style code blocks
renderer.code = function ({ text, lang }) {
    const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `<pre><code class="lang-${lang || 'text'}">${escaped}</code></pre>\n`;
};

// Style blockquotes (callouts)
renderer.blockquote = function ({ text }) {
    let cls = 'callout callout-note';
    if (text.includes('[!IMPORTANT]') || text.includes('[!WARNING]')) cls = 'callout callout-important';
    const cleaned = text.replace(/\[!(IMPORTANT|NOTE|WARNING|TIP)\]\s*/g, '');
    return `<div class="${cls}">${cleaned}</div>\n`;
};

marked.use({ renderer, gfm: true, breaks: false });

const bodyHtml = marked.parse(md);

// Generate sidebar nav from headings
let navHtml = '';
let currentGroup = '';
for (const h of headings) {
    if (h.depth === 1) {
        navHtml += `<span class="nav-group-label">${h.text.substring(0, 40)}</span>\n`;
        currentGroup = h.text;
    } else if (h.depth === 2) {
        const short = h.text.replace(/✅\s*/g, '').replace(/⏳\s*/g, '').substring(0, 35);
        const badge = h.text.includes('✅') ? '<span class="badge-sm badge-green">done</span>'
            : h.text.includes('⏳') ? '<span class="badge-sm badge-amber">wip</span>' : '';
        navHtml += `<a href="#${h.id}">${short}${badge}</a>\n`;
    }
}

const docTitle = title || inputPath.replace(/\.md$/, '').replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Jeepi — ${docTitle}</title>
<style>
/* ============ RESET & BASE ============ */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { scroll-behavior: smooth; font-size: 16px; }
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  background: #f8fafc; color: #1e293b; line-height: 1.7;
  display: flex; min-height: 100vh;
}

/* ============ COLOR PALETTE ============ */
:root {
  --primary: #2563eb; --primary-light: #dbeafe; --primary-dark: #1d4ed8;
  --success: #16a34a; --success-light: #dcfce7; --success-dark: #15803d;
  --warning: #d97706; --warning-light: #fef3c7; --warning-dark: #b45309;
  --danger: #dc2626; --danger-light: #fee2e2; --danger-dark: #b91c1c;
  --info: #0ea5e9; --info-light: #e0f2fe;
  --bg: #f8fafc; --card: #ffffff; --border: #e2e8f0;
  --text: #1e293b; --text-muted: #64748b; --text-light: #94a3b8;
  --sidebar-bg: #0f172a; --sidebar-text: #cbd5e1; --sidebar-active: #2563eb;
  --code-bg: #1e293b; --code-text: #e2e8f0;
  --shadow: 0 1px 3px rgba(0,0,0,.1), 0 1px 2px rgba(0,0,0,.06);
  --shadow-lg: 0 10px 15px -3px rgba(0,0,0,.1), 0 4px 6px -4px rgba(0,0,0,.1);
}

/* ============ SIDEBAR NAV ============ */
.sidebar {
  position: fixed; top: 0; left: 0; width: 280px; height: 100vh;
  background: var(--sidebar-bg); color: var(--sidebar-text);
  overflow-y: auto; z-index: 100; padding: 1.5rem 0;
  transition: transform .3s ease;
}
.sidebar::-webkit-scrollbar { width: 6px; }
.sidebar::-webkit-scrollbar-thumb { background: #334155; border-radius: 3px; }
.sidebar-brand {
  padding: 0 1.25rem 1.25rem; border-bottom: 1px solid #1e293b;
  margin-bottom: 1rem;
}
.sidebar-brand h2 { color: #fff; font-size: 1.25rem; font-weight: 700; }
.sidebar-brand p { color: var(--text-light); font-size: .8rem; margin-top: .25rem; }
.sidebar nav { padding: 0 .75rem; }
.sidebar nav a {
  display: block; padding: .5rem .75rem; margin-bottom: 2px;
  color: var(--sidebar-text); text-decoration: none; font-size: .82rem;
  border-radius: 6px; transition: background .15s, color .15s;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.sidebar nav a:hover { background: #1e293b; color: #fff; }
.sidebar nav a .badge-sm {
  display: inline-block; font-size: .65rem; padding: 1px 6px;
  border-radius: 999px; margin-left: 6px; vertical-align: middle;
  font-weight: 600;
}
.badge-green { background: var(--success); color: #fff; }
.badge-amber { background: var(--warning); color: #fff; }
.sidebar nav .nav-group-label {
  display: block; padding: .6rem .75rem .25rem; color: var(--text-light);
  font-size: .7rem; font-weight: 700; text-transform: uppercase; letter-spacing: .05em;
}

/* ============ HAMBURGER (mobile) ============ */
.hamburger {
  display: none; position: fixed; top: 12px; left: 12px; z-index: 200;
  background: var(--primary); color: #fff; border: none; border-radius: 8px;
  width: 40px; height: 40px; font-size: 1.4rem; cursor: pointer;
  box-shadow: var(--shadow);
}
.overlay {
  display: none; position: fixed; inset: 0; background: rgba(0,0,0,.5);
  z-index: 99;
}

/* ============ MAIN CONTENT ============ */
.main { margin-left: 280px; flex: 1; padding: 2.5rem 3rem 4rem; max-width: 960px; }

/* ============ TYPOGRAPHY ============ */
h1 { font-size: 2rem; font-weight: 800; color: var(--primary-dark); margin: 2.5rem 0 1rem; padding-bottom: .5rem; border-bottom: 3px solid var(--primary); }
h2 { font-size: 1.45rem; font-weight: 700; color: var(--text); margin: 2rem 0 .75rem; }
h3 { font-size: 1.15rem; font-weight: 600; color: #334155; margin: 1.5rem 0 .5rem; }
h4 { font-size: 1rem; font-weight: 600; color: var(--text-muted); margin: 1rem 0 .4rem; }
p, li { font-size: .95rem; }
p { margin-bottom: .75rem; }
a { color: var(--primary); }
hr { border: none; border-top: 1px solid var(--border); margin: 2rem 0; }

/* ============ BADGES ============ */
.badge {
  display: inline-block; padding: 3px 12px; border-radius: 999px;
  font-size: .78rem; font-weight: 700; vertical-align: middle;
}
.badge-completed { background: var(--success-light); color: var(--success-dark); }
.badge-pending   { background: var(--warning-light); color: var(--warning-dark); }
.badge-progress  { background: var(--info-light); color: #0369a1; }

/* ============ CALLOUT BOXES ============ */
.callout {
  border-left: 4px solid; border-radius: 6px; padding: 1rem 1.25rem;
  margin: 1rem 0; font-size: .9rem;
}
.callout-important { border-color: var(--warning); background: var(--warning-light); }
.callout-note      { border-color: var(--info); background: var(--info-light); }

/* ============ TABLES ============ */
table {
  width: 100%; border-collapse: collapse; margin: 1rem 0;
  font-size: .88rem; background: var(--card); border-radius: 8px;
  overflow: hidden; box-shadow: var(--shadow);
}
thead th {
  background: var(--primary); color: #fff; padding: .75rem 1rem;
  text-align: left; font-weight: 600; font-size: .82rem;
  text-transform: uppercase; letter-spacing: .03em;
}
tbody td { padding: .65rem 1rem; border-bottom: 1px solid var(--border); }
tbody tr:nth-child(even) { background: #f8fafc; }
tbody tr:hover { background: var(--primary-light); }

/* ============ CODE BLOCKS ============ */
pre {
  background: var(--code-bg); color: var(--code-text); border-radius: 8px;
  padding: 1.25rem 1.5rem; overflow-x: auto; margin: 1rem 0;
  font-size: .85rem; line-height: 1.6; box-shadow: var(--shadow);
}
code {
  font-family: 'Cascadia Code', 'Fira Code', 'JetBrains Mono', 'Consolas', monospace;
  font-size: .85em;
}
:not(pre) > code {
  background: #f1f5f9; color: #be185d; padding: 2px 6px; border-radius: 4px;
}

/* ============ LISTS ============ */
ul, ol { margin: .5rem 0 .75rem 1.5rem; }
li { margin-bottom: .35rem; }
li > ul, li > ol { margin-top: .25rem; }

/* ============ RESPONSIVE ============ */
@media (max-width: 900px) {
  .sidebar { transform: translateX(-100%); }
  .sidebar.open { transform: translateX(0); }
  .overlay.open { display: block; }
  .hamburger { display: flex; align-items: center; justify-content: center; }
  .main { margin-left: 0; padding: 1.25rem 1rem 3rem; }
  table { font-size: .8rem; }
  thead th, tbody td { padding: .5rem .6rem; }
  h1 { font-size: 1.5rem; }
}

/* ============ PRINT ============ */
@media print {
  .sidebar, .hamburger, .overlay { display: none !important; }
  .main { margin-left: 0; padding: 0; max-width: 100%; }
  pre { white-space: pre-wrap; word-break: break-all; }
  body { font-size: 11pt; }
}
</style>
</head>
<body>

<!-- Hamburger (mobile) -->
<button class="hamburger" onclick="document.querySelector('.sidebar').classList.toggle('open');document.querySelector('.overlay').classList.toggle('open');">&#9776;</button>
<div class="overlay" onclick="document.querySelector('.sidebar').classList.remove('open');this.classList.remove('open');"></div>

<!-- Sidebar -->
<aside class="sidebar">
  <div class="sidebar-brand">
    <h2>Jeepi Docs</h2>
    <p>${docTitle}</p>
  </div>
  <nav>
    ${navHtml}
  </nav>
</aside>

<!-- Main Content -->
<main class="main">
${bodyHtml}
</main>

</body>
</html>`;

fs.writeFileSync(outputPath, html);
console.log(`Generated: ${outputPath} (${Math.round(html.length / 1024)}KB)`);
