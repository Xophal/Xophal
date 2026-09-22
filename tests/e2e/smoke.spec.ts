import { expect, test } from "@playwright/test";

test("homepage is reachable and guides visitors to registration", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: /Master Your Exams with Xophal/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /Start Free/i })).toHaveAttribute("href", "/register");
});

test("login page displays the sign-in form and validates empty submission", async ({ page }) => {
  await page.goto("/login");

  await expect(page.getByRole("heading", { name: /Welcome back/i })).toBeVisible();
  await page.getByRole("button", { name: /Sign in|Login/i }).click();
  // Submitting an empty login form should keep the user on the login page
  await expect(page).toHaveURL(/\/login/);
});

test("registration page displays account fields and validates empty submission", async ({ page }) => {
  await page.goto("/register");

  await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
  await expect(page.getByLabel("Class")).toBeDisabled();
  await page.getByRole("button", { name: "Create account" }).click();
  // Submitting an empty registration form should keep the user on the register page
  await expect(page).toHaveURL(/\/register/);
});

test("dashboard redirects unauthenticated visitors to login", async ({ page }) => {
  await page.goto("/dashboard");

  // Allow `/login` with optional query params (redirect=...)
  await expect(page).toHaveURL(/\/login($|\?)/);
  await expect(page.getByRole("heading", { name: /Welcome back/i })).toBeVisible();
});

test.skip("logout ends the authenticated session", async () => {
  // The app currently has no logout control or logout route. Enable this test
  // when that behavior exists, using a dedicated authenticated test account.
});
