const fs = require('fs');
const path = require('path');

const required = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_APP_URL',
];

const optional = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
  'RESEND_API_KEY',
  'RAZORPAY_KEY_ID',
  'RAZORPAY_KEY_SECRET',
  'RAZORPAY_WEBHOOK_SECRET',
  'MAIN_ADMIN_EMAILS',
];

function hasValue(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

const envFiles = [
  path.resolve(process.cwd(), '.env.local'),
  path.resolve(process.cwd(), '.env'),
];
const env = { ...process.env };

for (const envFile of envFiles) {
  if (!fs.existsSync(envFile)) continue;
  const lines = fs.readFileSync(envFile, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    if (!line || line.startsWith('#')) continue;
    const match = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match) {
      env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
    }
  }
}

const envFileExists = envFiles.some((file) => fs.existsSync(file));

const missingRequired = required.filter((key) => !hasValue(env[key]));
const warnings = optional.filter((key) => !hasValue(env[key]));

if (missingRequired.length > 0) {
  console.error('Missing required deployment environment variables:');
  for (const key of missingRequired) {
    console.error(` - ${key}`);
  }
  console.error('\nAdd them to .env.local or your deployment platform before going live.');
  process.exit(1);
}

console.log('✅ Required deployment env vars are present.');
if (warnings.length > 0) {
  console.warn('\nOptional production variables are missing; some features may be disabled until configured:');
  for (const key of warnings) {
    console.warn(` - ${key}`);
  }
} else {
  console.log('✅ Recommended production secrets are configured.');
}

if (!envFileExists) {
  console.warn('\nWarning: .env.local not found. This is expected in Vercel/production, but local deployment checks may be incomplete.');
}
