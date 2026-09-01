import { expect, test } from "@playwright/test";

const amount = (text: string) => Number(text.replace(/['’\s]/g, "").replace("—", "0"));

test.describe("Ticket history", () => {
  test("filters, search, sorting and pagination are real controls", async ({ page }) => {
    await page.goto("/pesees");
    const rows = page.getByRole("table").getByRole("row");
    await expect(rows.nth(1)).toBeVisible();
    await expect(page.getByText(/page 1 sur \d+/)).toBeVisible();

    // Status filter through the GET form.
    await page.getByLabel("Statut", { exact: true }).selectOption("open");
    await page.getByRole("button", { name: "Filtrer" }).click();
    await expect(page).toHaveURL(/statut=open/);
    const openStatuses = await page.getByRole("table").locator("tbody tr").allInnerTexts();
    expect(openStatuses.length).toBeGreaterThan(0);
    for (const row of openStatuses) expect(row).toContain("En attente");

    // Search by plate (tolerant to spacing) keeps the status filter.
    const plate = await page
      .getByRole("table")
      .locator("tbody tr")
      .first()
      .locator("td")
      .nth(3)
      .innerText();
    const typedPlate = plate.replace(/\s/g, "").toLowerCase();
    await page.getByLabel("Rechercher").fill(typedPlate);
    await page.getByRole("button", { name: "Filtrer" }).click();
    await expect(page).toHaveURL(new RegExp(`q=${typedPlate}`));
    await expect(page).toHaveURL(/statut=open/);
    const plateRows = await page.getByRole("table").locator("tbody tr").allInnerTexts();
    expect(plateRows.length).toBeGreaterThan(0);
    for (const row of plateRows) {
      expect(row).toContain(plate);
      expect(row).toContain("En attente");
    }

    // Reset, then sort by total ascending via the column header link.
    await page.getByRole("link", { name: "Réinitialiser" }).click();
    await expect(page).toHaveURL(/\/pesees$/);
    await page.getByRole("link", { name: /Trier par total/ }).click();
    await expect(page).toHaveURL(/tri=total/);
    await page.getByRole("link", { name: /Trier par total/ }).click();
    await expect(page).toHaveURL(/sens=asc/);
    const totals = await page
      .getByRole("table")
      .locator("tbody tr td:nth-last-child(2)")
      .allInnerTexts();
    const numeric = totals.map(amount).filter((value) => value > 0);
    expect(numeric.length).toBeGreaterThan(1);
    for (let i = 1; i < numeric.length; i += 1)
      expect(numeric[i]).toBeGreaterThanOrEqual(numeric[i - 1] ?? 0);

    // Pagination keeps the sort.
    await page.getByRole("link", { name: "Suivant" }).click();
    await expect(page).toHaveURL(/page=2/);
    await expect(page).toHaveURL(/tri=total/);
    await expect(page.getByText(/page 2 sur \d+/)).toBeVisible();
    await expect(page.getByRole("table").locator("tbody tr").first()).toBeVisible();
  });

  test("the N shortcut opens a new weighing but not while typing", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Rechercher").count(); // no search field on the dashboard; ensures page is ready
    await page.keyboard.press("n");
    await expect(page).toHaveURL(/\/pesees\/nouvelle$/);

    await page.goto("/pesees");
    await page.getByLabel("Rechercher").fill("n");
    await expect(page).toHaveURL(/\/pesees$/);
    await expect(page.getByLabel("Rechercher")).toHaveValue("n");
  });
});
