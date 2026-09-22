/**
 * Replace this stub with the database write that grants a user access to a test.
 * The payment verification route calls it only after signature verification.
 */
export async function unlockTestForUser(userId: string, testId: string) {
  return { userId, testId, unlocked: true };
}