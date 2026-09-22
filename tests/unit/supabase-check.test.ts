import { describe, it, expect } from 'vitest';
import { ensureSupabaseRegistrationConfig, isSupabasePlaceholder } from '@/lib/supabase/check';

describe('supabase check', () => {
  it('identifies placeholders', () => {
    expect(isSupabasePlaceholder(undefined)).toBe(true);
    expect(isSupabasePlaceholder('')).toBe(true);
    expect(isSupabasePlaceholder('YOUR_SUPABASE_PROJECT')).toBe(true);
    expect(isSupabasePlaceholder('placeholder-value')).toBe(true);
    expect(isSupabasePlaceholder('real-value')).toBe(false);
  });

  it('throws when service key missing', () => {
    const original = process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    try {
      expect(() => ensureSupabaseRegistrationConfig()).toThrow();
    } finally {
      process.env.SUPABASE_SERVICE_ROLE_KEY = original;
    }
  });
});
