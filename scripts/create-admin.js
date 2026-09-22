#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { createClient } = require("@supabase/supabase-js");

function loadEnvLocal() {
  try {
    const envPath = path.resolve(__dirname, '..', '.env.local');
    if (!fs.existsSync(envPath)) return;
    const content = fs.readFileSync(envPath, 'utf8');
    content.split(/\r?\n/).forEach((line) => {
      const m = line.match(/^([^=]+)=(.*)$/);
      if (!m) return;
      const key = m[1];
      let val = m[2] || '';
      // strip surrounding quotes if present
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    });
  } catch (err) {
    // ignore
  }
}

function parseArgs() {
  const args = {};
  const raw = process.argv.slice(2);
  for (let i = 0; i < raw.length; i++) {
    const arg = raw[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = raw[i + 1];
      if (next && !next.startsWith("--")) {
        args[key] = next;
        i++;
      } else {
        args[key] = true;
      }
    }
  }
  return args;
}

async function main() {
  loadEnvLocal();

  const { email, password, role = "super_admin", fullName = "Admin User", boardId, classId } = parseArgs();

  if (!email || !password) {
    console.error("Usage: node scripts/create-admin.js --email admin@example.com --password secret [--role super_admin] [--fullName 'Name']");
    process.exit(1);
  }

  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Please set NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY in your environment or .env.local file.");
    process.exit(1);
  }

  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const { data: userData, error: createUserError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });

    if (createUserError || !userData?.user) {
      console.error("Error creating user:", createUserError || userData);
      process.exit(1);
    }

    // lookup role id by code
    const { data: roleRow } = await adminClient.from("roles").select("id").eq("code", role).maybeSingle();

    const profilePayload = {
      id: userData.user.id,
      email,
      full_name: fullName,
      board_id: boardId || null,
      class_id: classId || null,
      role_id: roleRow?.id ?? null,
      email_verified: Boolean(userData.user.email_confirmed_at),
    };

    const { error: profileError } = await adminClient.from("profiles").upsert(profilePayload, { onConflict: "id" });
    if (profileError) {
      console.error("Failed to upsert profile:", profileError);
      process.exit(1);
    }

    console.log(`Admin user created: ${email} (id=${userData.user.id}, role=${role})`);
    process.exit(0);
  } catch (err) {
    console.error("Unexpected error:", err);
    process.exit(1);
  }
}

main();
