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

## Documentation Sync

This is the **single source of truth** for all Jeepi project documentation. The main [jeepi](https://github.com/saint-cygnum/jeepi) repo does NOT have a `docs/` folder — everything lives here.

After ANY of these changes in the jeepi codebase, update the relevant docs here before marking the task complete:
- **Schema changes** → update `api_versioning_and_db_strategy.md` (models, migrations)
- **New/changed API endpoints** → update `walkthrough.md` (API reference)
- **Infrastructure changes** (Dockerfile, CI/CD, env vars) → update `production_rollout_strategy.md`
- **New features or phases** → update `implementation_plan.md` (status, completion)
- **Cost or timeline changes** → update `dev_estimates.md`
- **GPS, location, or fare changes** → update `gps_plan.md` (schema, endpoints, flows)
- **Testing or code structure changes** → update `code_review_and_testing_strategy.md`
- **Phase completion or milestone changes** → update `gantt-chart.html` (timeline, test counts, status)
- **Fare discount changes** → update `fare_discounts.md` (regulations, calculation, schema)

If multiple docs need updating, batch them at the end of the task. Do NOT skip this step.

When committing, cross-reference code changes against ALL relevant docs to ensure consistency. Docs must reflect actual code behaviour, not aspirational design.
