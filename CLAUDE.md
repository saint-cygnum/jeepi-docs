# Jeepi Docs Project Rules

## HTML Generation (ON-DEMAND ONLY)

Do NOT regenerate HTML files automatically when markdown changes. Only regenerate when the user explicitly asks.

| Markdown Source | HTML Output |
|----------------|-------------|
| `implementation_plan.md` | `implementation_plan.html` |
| `production_rollout_strategy.md` | `production_rollout_strategy.html` |

### HTML Generation Requirements (when asked)
- Self-contained HTML with ALL CSS embedded (no external dependencies)
- Professional, colorful design with modern feel
- Color-coded phase statuses: completed = green, in-progress = blue, planned/pending = amber
- Tables with alternating row colors and nice borders
- Code blocks with dark background and colored text
- Collapsible sections using `<details>` + `<summary>`
- Responsive layout (mobile-friendly)
- Floating table of contents sidebar
- Color palette: primary blue (#2563eb), success green (#16a34a), warning amber (#d97706), danger red (#dc2626), background (#f8fafc), card (#ffffff)
- Print-friendly (hide nav on print)
- Preserve ALL content from the markdown — nothing skipped

## Origin
This repo contains documentation extracted from the main [jeepi](https://github.com/saint-cygnum/jeepi) project. The markdown files are the source of truth — HTML files are generated artifacts.
