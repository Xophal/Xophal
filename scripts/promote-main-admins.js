#!/usr/bin/env node
// Backfill: raise every configured main administrator (MAIN_ADMIN_EMAILS) to the
// super_admin role. Handles profiles that already exist as "student" (and skips
// those that are already an admin role). Safe to run repeatedly.
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
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    });
  } catch (err) {
    // ignore
  }
}

function mainAdminEmails() {
  return (process.env.MAIN_ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

async function main() {
  loadEnvLocal();

  const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

  if (!URL || !SERVICE_ROLE_KEY) {
    console.error("Please set NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY in your environment or .env.local file.");
    process.exit(1);
  }

  const emails = mainAdminEmails();
  if (emails.length === 0) {
    console.error("MAIN_ADMIN_EMAILS is not set. Add it to .env.local before running this script.");
    process.exit(1);
  }
  console.log(`Promoting ${emails.length} configured main administrator(s): ${emails.join(", ")}`);

  const admin = createClient(URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const { data: superAdminRole } = await admin
      .from("roles")
      .select("id, code")
      .eq("code", "super_admin")
      .maybeSingle();
    if (!superAdminRole?.id) {
      console.error("super_admin role not found in the roles table. Has the seed migration run?");
      process.exit(1);
    }

    const { data: profiles, error: profilesError } = await admin
      .from("profiles")
      .select("id, email, role_id")
      .in("email", emails);

    if (profilesError) {
      console.error("Failed to load profiles:", profilesError);
      process.exit(1);
    }

    let updated = 0;
    let alreadyAdmin = 0;
    let missing = 0;
    const found = new Set();

    for (const profile of profiles || []) {
      found.add(profile.email.toLowerCase());
      if (profile.role_id === superAdminRole.id) {
        alreadyAdmin++;
        continue;
      }
      const { error } = await admin
        .from("profiles")
        .update({ role_id: superAdminRole.id })
        .eq("id", profile.id);
      if (error) {
        console.error(`Failed to update ${profile.email}:`, error);
        continue;
      }
      updated++;
      console.log(`  - ${profile.email} -> super_admin (id=${profile.id})`);
    }

    for (const email of emails) {
      if (!found.has(email)) {
        missing++;
        console.log(`  - ${email} has no profile yet (user not registered). Sign in once to create it.`);
      }
    }

    console.log(`\nDone. Updated: ${updated}, already super_admin: ${alreadyAdmin}, no profile found: ${missing}`);
    process.exit(0);
  } catch (err) {
    console.error("Unexpected error:", err);
    process.exit(1);
  }
}

main();