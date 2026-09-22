const { spawnSync } = require("node:child_process");

const projectRef = process.env.SUPABASE_PROJECT_REF || process.env.NEXT_PUBLIC_SUPABASE_PROJECT_REF;

if (!projectRef) {
  console.log("Supabase project ref not configured. Skipping remote migration push in beta mode.");
  console.log("Set SUPABASE_PROJECT_REF to enable remote DB pushes.");
  process.exit(0);
}

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
