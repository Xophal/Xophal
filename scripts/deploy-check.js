const fs = process.getBuiltinModule('node:fs');
const path = process.getBuiltinModule('node:path');

const required = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_APP_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
  'RESEND_API_KEY',
  'RESEND_FROM',
  'MAIN_ADMIN_EMAILS',
  'RAZORPAY_KEY_ID',
  'RAZORPAY_KEY_SECRET',
  'RAZORPAY_WEBHOOK_SECRET',
];

function hasValue(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function looksLikePlaceholder(value) {
  return /placeholder|your[_-]|example(?:\.|$)|changeme|replace.?me/i.test(value);
}

function getProductionUrlIssue(value) {
  if (!hasValue(value)) return null;

  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    if (url.protocol !== 'https:') return 'must use HTTPS';
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0' || hostname.endsWith('.local')) {
      return 'must not point to a local host';
    }
    return null;
  } catch {
    return 'must be a valid URL';
  }
}

const envFiles = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '.env.local'),
];
const env = {};

for (const envFile of envFiles) {
  if (!fs.existsSync(envFile)) continue;
  const lines = fs.readFileSync(envFile, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    if (!line || line.startsWith('#')) continue;
    const match = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match && !Object.hasOwn(env, match[1]) && !Object.hasOwn(process.env, match[1])) {
      env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
    }
  }
}

Object.assign(env, process.env);
const envFileExists = envFiles.some((file) => fs.existsSync(file));

const missingRequired = required.filter((key) => !hasValue(env[key]) || looksLikePlaceholder(env[key]));
const routePayoutsEnabled = String(env.RAZORPAY_ROUTE_ENABLED ?? '').trim().toLowerCase() === 'true';
const missingRouteWebhookSecret = routePayoutsEnabled &&
  (!hasValue(env.RAZORPAY_ROUTE_WEBHOOK_SECRET) || looksLikePlaceholder(env.RAZORPAY_ROUTE_WEBHOOK_SECRET));
const productionUrls = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_APP_URL',
  'UPSTASH_REDIS_REST_URL',
];
const invalidUrls = productionUrls
  .map((key) => ({ key, issue: getProductionUrlIssue(env[key]) }))
  .filter(({ issue }) => issue);
const localAuthEnabled = ['true', '1'].includes(String(env.LOCAL_DEV_SKIP_AUTH ?? '').trim().toLowerCase());
const mainAdminEmails = String(env.MAIN_ADMIN_EMAILS ?? '')
  .split(',')
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);
const hasValidMainAdminEmails =
  mainAdminEmails.length === 2 &&
  new Set(mainAdminEmails).size === 2 &&
  mainAdminEmails.every((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
const invalidMainAdminEmails = hasValue(env.MAIN_ADMIN_EMAILS) && !hasValidMainAdminEmails;
const invalidResendFrom = hasValue(env.RESEND_FROM) && !env.RESEND_FROM.includes('@');

if (
  missingRequired.length > 0 ||
  missingRouteWebhookSecret ||
  invalidUrls.length > 0 ||
  localAuthEnabled ||
  invalidMainAdminEmails ||
  invalidResendFrom
) {
  console.error('Production deployment configuration is incomplete or unsafe:');
  for (const key of missingRequired) {
    console.error(` - ${key}`);
  }
  if (missingRouteWebhookSecret) {
    console.error(' - RAZORPAY_ROUTE_WEBHOOK_SECRET is required when RAZORPAY_ROUTE_ENABLED=true');
  }
  for (const { key, issue } of invalidUrls) {
    console.error(` - ${key} ${issue}`);
  }
  if (localAuthEnabled) {
    console.error(' - LOCAL_DEV_SKIP_AUTH must not be enabled');
  }
  if (invalidMainAdminEmails) {
    console.error(' - MAIN_ADMIN_EMAILS must contain exactly two distinct valid email addresses');
  }
  if (invalidResendFrom) {
    console.error(' - RESEND_FROM must contain a valid sender email address');
  }
  console.error('\nConfigure these values in the deployment platform before going live.');
  process.exit(1);
}

console.log('✅ Required production environment variables are present and valid.');

if (!envFileExists) {
  console.warn('\nWarning: .env.local not found. This is expected in Vercel/production, but local deployment checks may be incomplete.');
}
