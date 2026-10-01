const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

// Node does not load .env files on its own, so without this the script would
// skip the push even though the project is configured and linked.
function loadEnvFile(relativePath) {
  const file = path.join(__dirname, "..", relativePath);
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) continue;
    process.env[key] = rawValue.replace(/^(['"])([\s\S]*)\1$/, "$2");
  }
}

for (const file of [".env.local", ".env"]) loadEnvFile(file);

const projectRef = process.env.SUPABASE_PROJECT_REF || process.env.NEXT_PUBLIC_SUPABASE_PROJECT_REF;

if (!projectRef) {
  console.log("Supabase project ref not configured. Skipping remote migration push in beta mode.");
  console.log("Set SUPABASE_PROJECT_REF to enable remote DB pushes.");
  process.exit(0);
}

console.log(`Pushing migrations to Supabase project ${projectRef}...`);

const result = spawnSync("npx", ["supabase", "db", "push"], {
  stdio: "inherit",
  shell: true,
  env: process.env,
});

if (result.error) {
  console.error(result.error);
  process.exit(1);
}

process.exit(result.status ?? 0);
