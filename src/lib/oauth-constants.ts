/** Name of the short-lived cookie that carries the post-OAuth destination. */
export const OAUTH_NEXT_COOKIE = "xophol_oauth_next";

/**
 * Bare callback path. This MUST stay query-free so the full redirectTo URL
 * continues to match the Supabase redirect allowlist, which is configured
 * with exact entries such as `https://site/auth/callback`.
 */
export const OAUTH_CALLBACK_PATH = "/auth/callback";
