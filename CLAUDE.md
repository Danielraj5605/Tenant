# Project rules for Claude

These rules apply to every task in this project. Follow them before writing any code.

## 1. Before ANY implementation: sync check (mandatory)

Before starting a new section, a feature, or any code change:

1. Read `.project-log/status.json` to see where the project stands and what is planned next.
2. Read `.project-log/REQUESTS.md`. Every `- [ ]` item under `## New` is an unanswered request from the user.
3. If the status artifact is published (`artifact.slug` in `status.json`) and comment tools are available, read its unresolved comments too.
4. If there is anything new:
   - List each item in one line with its size (small / medium / large).
   - Ask the user which to implement now, later, or skip. **Wait for the answer.**
   - Never implement a request the user has not approved.
   - Move each item to `## Accepted`, `## Deferred` or `## Declined` with today's date, and update `last_sync` in `status.json`.
5. If nothing is new, say so in one line and continue.

Full procedure: the `section-sync-check` skill.

## 2. Work in sections

- Plan the work as a list of sections before coding (one reviewable chunk each: a page, a component set, a feature).
- Do one section at a time. Do not start the next one until the current one is verified and logged.
- For all UI design work, use the `design-taste-frontend` skill (taste-skill) as the main design guide. Use the `frontend-design` plugin skill only if taste-skill is not installed. Do not mix their art directions in one project: the direction chosen in section 1 is recorded in `status.json` decisions and kept for every later section.
- Whatever skill is used, every section must still have: all interactive states (hover, focus, disabled, loading, empty, error), WCAG AA contrast, and a working layout at 375 / 768 / 1440 px.

## 3. After every section: update the status page (mandatory)

1. Save screenshots at 375, 768 and 1440 px into `.project-log/shots/<section-id>/`. If design-taste-frontend already took them during its browser check, copy those instead of taking new ones.
2. Update `.project-log/status.json` (summary, changed files, decisions, open questions, next section).
3. Add an entry to `.project-log/CHANGELOG.md`.
4. Regenerate the page: `node .project-log/render.mjs` (if the script exists; otherwise follow the skill).
5. If artifact tools are available, republish the SAME artifact slug saved in `status.json`. Never create a second artifact for this project.
6. Tell the user in 2-3 lines what was finished and what open questions are waiting.

Full procedure: the `section-status-artifact` skill.

## 4. Always

- If `.project-log/` does not exist yet, set it up first with the `section-status-artifact` skill.
- Be honest in the status page: list known issues and anything not done.
- Never put secrets, API keys or `.env` values in the status page or the changelog.
- If the user says "continue", "next" or "go on", that means: run step 1 first.
