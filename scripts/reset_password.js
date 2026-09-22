const fs = require('fs');
const path = require('path');

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error('Usage: node reset_password.js <email>');
    process.exit(2);
  }

  const envPath = path.resolve(__dirname, '..', '.env.local');
  if (!fs.existsSync(envPath)) {
    console.error('.env.local not found');
    process.exit(1);
  }

  const env = fs.readFileSync(envPath, 'utf8').split(/\r?\n/).reduce((acc, line) => {
    const m = line.match(/^([^=]+)=(.*)$/);
    if (m) acc[m[1]] = m[2];
    return acc;
  }, {});

  const SUPA = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
  const SR = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPA || !SR) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
    process.exit(1);
  }

  const listRes = await fetch(`${SUPA.replace(/\/$/, '')}/auth/v1/admin/users`, {
    headers: { apikey: SR, Authorization: `Bearer ${SR}` },
  });
  if (!listRes.ok) {
    const text = await listRes.text().catch(() => null);
    console.error('Failed to list users', listRes.status, text);
    process.exit(1);
  }
  const users = await listRes.json();
  const user = (users.users || []).find(u => String(u.email).toLowerCase() === String(email).toLowerCase());
  if (!user) {
    console.error('NOT_FOUND');
    process.exit(1);
  }

  const id = user.id;
  const tmp = 'XophalTemp' + Math.floor(10000 + Math.random() * 90000);
  const patchRes = await fetch(`${SUPA.replace(/\/$/, '')}/auth/v1/admin/users/${id}`, {
    method: 'PUT',
    headers: { apikey: SR, Authorization: `Bearer ${SR}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: tmp, email_confirm: true }),
  });
  const patchText = await patchRes.text().catch(() => null);
  if (!patchRes.ok) {
    console.error('PATCH_FAILED', patchRes.status, patchText);
    process.exit(1);
  }

  console.log(JSON.stringify({ email, tmp, status: patchRes.status, response: patchText }, null, 2));
}

main().catch(e => { console.error(e); process.exit(1); });
