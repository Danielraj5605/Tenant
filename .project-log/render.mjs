// Renders .project-log/status.json (+ CHANGELOG.md, shots/) into .project-log/index.html.
// Screenshots are inlined as data URIs because the published artifact cannot load remote images.
// Usage: node .project-log/render.mjs
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));
const status = JSON.parse(readFileSync(join(dir, "status.json"), "utf8"));
const changelog = existsSync(join(dir, "CHANGELOG.md")) ? readFileSync(join(dir, "CHANGELOG.md"), "utf8") : "";

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const code = (s) => esc(s).replace(/`([^`]+)`/g, "<code>$1</code>");

// Screenshots are embedded as smaller WebP copies (max 560 px wide) so the page
// stays under the 16 MB artifact limit. Without sharp, the originals are used.
let sharp = null;
try {
  sharp = (await import("sharp")).default;
} catch {
  sharp = null;
}

async function embed(file) {
  if (sharp) {
    const buf = await sharp(file).resize({ width: 560, withoutEnlargement: true }).webp({ quality: 72 }).toBuffer();
    return `data:image/webp;base64,${buf.toString("base64")}`;
  }
  const ext = extname(file).slice(1).toLowerCase().replace("jpg", "jpeg");
  return `data:image/${ext};base64,${readFileSync(file).toString("base64")}`;
}

const shotCache = new Map();
for (const s of status.sections) {
  const d = join(dir, "shots", s.id);
  if (!existsSync(d)) continue;
  const files = readdirSync(d)
    .filter((f) => /\.(png|jpe?g|webp)$/i.test(f))
    .sort((a, b) => parseInt(a) - parseInt(b));
  shotCache.set(s.id, await Promise.all(files.map(async (f) => ({ name: f, src: await embed(join(d, f)) }))));
}

const shots = (sectionId) => shotCache.get(sectionId) ?? [];

const counts = status.sections.reduce((m, s) => ((m[s.status] = (m[s.status] || 0) + 1), m), {});

const sectionsHtml = status.sections
  .slice()
  .reverse()
  .map((s) => {
    const imgs = shots(s.id);
    const gallery = imgs.length
      ? `<div class="shots">${imgs
          .map((i) => `<figure><img src="${i.src}" alt="${esc(s.title)} at ${esc(i.name)}" loading="lazy"><figcaption>${esc(i.name)}</figcaption></figure>`)
          .join("")}</div>`
      : `<p class="muted small">No screenshots for this section.</p>`;
    return `<article class="card section" id="${esc(s.id)}">
      <header><h3>${esc(s.title)}</h3><span class="pill pill-${esc(s.status)}">${esc(s.status)}</span></header>
      <p>${code(s.summary)}</p>
      <p class="muted small">${esc(s.date)}${s.commits?.length ? " · " + s.commits.map((c) => `<code>${esc(c)}</code>`).join(" ") : ""}</p>
      ${gallery}
    </article>`;
  })
  .join("");

const list = (items, cls = "") => (items?.length ? `<ul class="${cls}">${items.map((i) => `<li>${code(i)}</li>`).join("")}</ul>` : `<p class="muted">None.</p>`);

const coverage = status.test_coverage?.length
  ? `<div class="table-wrap"><table><thead><tr><th scope="col">#</th><th scope="col">Case</th><th scope="col">Test</th></tr></thead><tbody>${status.test_coverage
      .map((t) => `<tr><td>${t.case}</td><td>${esc(t.text)}</td><td><code>${esc(t.test)}</code></td></tr>`)
      .join("")}</tbody></table></div>`
  : "";

const changelogHtml = changelog
  .split("\n")
  .map((l) => {
    if (l.startsWith("# ")) return "";
    if (l.startsWith("## ")) return `<h3>${code(l.slice(3))}</h3>`;
    if (l.startsWith("- ")) return `<li>${code(l.slice(2))}</li>`;
    return "";
  })
  .join("")
  .replace(/(<li>.*?<\/li>)+/g, (m) => `<ul>${m}</ul>`);

const next = status.next_section;

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(status.project)} — project status</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
  :root { --bg:#F5F4EF; --surface:#FFFFFF; --ink:#1C1B19; --muted:#5F5E58; --accent:#0F6E64; --accent-tint:#DCEDEA; --accent-dark:#0A4F48;
          --warn-bg:#FBEBD9; --warn:#6B3A0B; --info-bg:#E5EBFA; --info:#2E4A9E; --border:#E4E2DA; --border-2:#D6D4CB; }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--ink); font:400 16px/1.55 Manrope, system-ui, sans-serif; }
  main { max-width: 1040px; margin: 0 auto; padding: 32px 20px 64px; }
  h1 { font-size: clamp(28px, 4vw, 40px); font-weight: 800; letter-spacing: -0.02em; margin: 0 0 4px; }
  h2 { font-size: 20px; font-weight: 800; margin: 40px 0 12px; }
  h3 { font-size: 16px; font-weight: 700; margin: 0; }
  p { margin: 8px 0; }
  .muted { color: var(--muted); } .small { font-size: 14px; }
  code { font: 500 0.88em ui-monospace, SFMono-Regular, Consolas, monospace; background: var(--accent-tint); color: var(--accent-dark); padding: 1px 6px; border-radius: 6px; overflow-wrap: anywhere; }
  .card { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; padding: 20px; }
  .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin-top: 24px; }
  .stat b { display:block; font-size: 28px; font-weight: 800; }
  .stat span { color: var(--muted); font-size: 14px; }
  .next { border-color: var(--accent); background: var(--accent-tint); }
  .next .label { font-size: 13px; font-weight: 700; color: var(--accent-dark); text-transform: uppercase; letter-spacing: .06em; }
  .grid-2 { display: grid; grid-template-columns: 1fr; gap: 16px; }
  @media (min-width: 768px) { .grid-2 { grid-template-columns: 1fr 1fr; } }
  .sections { display: grid; gap: 12px; }
  .section header { display:flex; justify-content: space-between; align-items: center; gap: 12px; }
  .pill { font-size: 13px; font-weight: 700; padding: 4px 12px; border-radius: 999px; white-space: nowrap; }
  .pill-done { background: var(--accent-tint); color: var(--accent-dark); }
  .pill-in-progress { background: var(--info-bg); color: var(--info); }
  .pill-blocked { background: var(--warn-bg); color: var(--warn); }
  .warn { background: var(--warn-bg); border-color: #EBD3B6; } .warn h2, .warn li { color: var(--warn); }
  ul { margin: 8px 0; padding-left: 20px; } li { margin: 4px 0; }
  .shots { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin-top: 12px; }
  .shots img { width: 100%; border: 1px solid var(--border-2); border-radius: 12px; display:block; }
  figure { margin: 0; } figcaption { font-size: 13px; color: var(--muted); margin-top: 4px; }
  .table-wrap { overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  th, td { text-align: left; padding: 10px 8px; border-bottom: 1px solid var(--border); vertical-align: top; }
  th { color: var(--muted); font-weight: 700; }
  .changelog h3 { margin-top: 20px; } .changelog h3:first-child { margin-top: 0; }
  a { color: var(--accent); } a:hover { color: var(--accent-dark); }
  a:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; border-radius: 4px; }
</style>
</head>
<body>
<main>
  <h1>${esc(status.project)}</h1>
  <p class="muted">${esc(status.tagline)}</p>
  <p class="muted small">Updated ${esc(status.last_updated)} · last request sync ${esc(status.last_sync)}</p>

  <div class="stats">
    <div class="card stat"><b>${counts.done || 0}</b><span>sections done</span></div>
    <div class="card stat"><b>${status.test_coverage?.length || 0}</b><span>spec test cases covered</span></div>
    <div class="card stat"><b>${status.open_questions?.length || 0}</b><span>open questions</span></div>
    <div class="card stat"><b>${status.known_issues?.length || 0}</b><span>known issues</span></div>
  </div>

  ${next ? `<h2>Next</h2><div class="card next"><div class="label">Up next</div><h3>${esc(next.title)}</h3><p>${code(next.summary)}</p></div>` : ""}

  <div class="grid-2" style="margin-top:16px">
    <section class="card"><h2 style="margin-top:0">Open questions</h2>${list(status.open_questions)}</section>
    <section class="card warn"><h2 style="margin-top:0">Known issues</h2>${list(status.known_issues)}</section>
  </div>

  <h2>Sections</h2>
  <div class="sections">${sectionsHtml}</div>

  ${coverage ? `<h2>SPEC §12 test cases</h2><section class="card">${coverage}</section>` : ""}

  <h2>Decisions</h2>
  <section class="card">${list((status.decisions || []).map((d) => `${d.date} — ${d.text}`))}</section>

  <h2>Changelog</h2>
  <section class="card changelog">${changelogHtml}</section>
</main>
</body>
</html>
`;

writeFileSync(join(dir, "index.html"), html);
console.log(`Wrote ${join(dir, "index.html")} (${(html.length / 1024).toFixed(1)} KB)`);
