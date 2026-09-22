import fs from "fs";

const raw = fs.readFileSync("npm-audit.json");
let parsed;
try {
  parsed = JSON.parse(raw.toString("utf8"));
} catch {
  parsed = JSON.parse(raw.toString("utf16le"));
}
const vulns = parsed.vulnerabilities || {};
const out = {
  total: Object.keys(vulns).length,
  severities: Object.values(vulns).reduce((acc, v) => { acc[v.severity] = (acc[v.severity] || 0) + 1; return acc; }, {}),
  names: Object.entries(vulns).slice(0, 20).map(([n, v]) => ({ name: n, severity: v.severity, title: v.title }))
};
console.log(JSON.stringify(out, null, 2));
