const { test, expect } = require("@playwright/test");

test("pending log transitions to completed in the client", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
  await page.goto("/");
  const initialPendingCount = await page.getByText("Pending").count();
  const initialAnalyzingCount = await page.getByText("Analyzing meal...").count();

  await page.getByLabel("Log meal").click();
  await page.getByLabel("Use test image").click();
  await page.getByPlaceholder("Describe your meal...").fill("E2E salmon bowl");
  await page.getByLabel("Confirm log meal").click();

  await expect.poll(async () => page.getByText("Pending").count()).toBeGreaterThan(initialPendingCount);
  await expect
    .poll(async () => page.getByText("Analyzing meal...").count())
    .toBeGreaterThan(initialAnalyzingCount);

  await expect
    .poll(async () => page.getByText("Pending").count(), { timeout: 20_000 })
    .toBe(initialPendingCount);
  await expect
    .poll(async () => page.getByText("Analyzing meal...").count(), { timeout: 20_000 })
    .toBe(initialAnalyzingCount);
});
