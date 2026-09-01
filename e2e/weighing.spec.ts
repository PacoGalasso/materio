import { expect, test, type Page } from "@playwright/test";

/** Reads the current stock (kg) of a material from the /stock table. */
async function readStockKg(page: Page, materialName: string): Promise<number> {
  await page.goto("/stock");
  const row = page.getByRole("row", { name: new RegExp(materialName) }).first();
  const text = await row.getByRole("cell").nth(2).innerText();
  return Number(text.replace(/['’\s]/g, ""));
}

async function selectComboboxOption(page: Page, label: string, query: string, optionName: RegExp) {
  const input = page.getByRole("combobox", { name: label });
  await input.fill(query);
  await page.getByRole("option", { name: optionName }).first().click();
  await expect(input).toHaveValue(optionName);
}

test.describe("Weighing workflow", () => {
  test("operator completes a weighing in one pass: stock and history are updated", async ({
    page,
  }) => {
    const stockBefore = await readStockKg(page, "Cuivre mêlé");

    await page.goto("/pesees/nouvelle");
    await expect(page.getByRole("heading", { name: "Nouvelle pesée" })).toBeVisible();

    await selectComboboxOption(page, "Fournisseur", "Favre", /Construction Favre SA/);
    await page.getByLabel("Immatriculation").fill("VD 777 888");
    await selectComboboxOption(page, "Matière", "Cuivre mêlé", /Cuivre mêlé/);
    await expect(page.getByLabel("Prix d'achat")).toHaveValue("6.15");

    await page.getByLabel("Poids brut (entrée)").fill("8420");
    await page.getByLabel("Tare (sortie)").fill("6870");

    const summary = page.getByRole("region", { name: "Récapitulatif de la pesée" });
    await expect(summary).toContainText("1'550 kg");
    await expect(summary).toContainText("CHF 9'532.50");

    await page.getByRole("button", { name: "Terminer la pesée" }).click();
    await expect(page).toHaveURL(/\/pesees\/[0-9a-f-]+\?enregistree=1/);

    const receipt = page.getByRole("article");
    await expect(receipt).toContainText("Terminée");
    await expect(receipt).toContainText("1'550 kg");
    await expect(receipt).toContainText("CHF 9'532.50");
    await expect(receipt).toContainText("VD 777 888");
    const reference = await page
      .getByRole("heading", { level: 2, name: /^P-\d{4}-\d{5}$/ })
      .innerText();

    const stockAfter = await readStockKg(page, "Cuivre mêlé");
    expect(stockAfter - stockBefore).toBe(1550);

    await page.goto("/pesees");
    const row = page.getByRole("row", { name: new RegExp(reference) });
    await expect(row).toContainText("Construction Favre SA");
    await expect(row).toContainText("9'532.50");
    await expect(row).toContainText("Terminée");
  });

  test("operator records the arrival, then the tare at departure", async ({ page }) => {
    await page.goto("/pesees/nouvelle");
    await selectComboboxOption(page, "Fournisseur", "Rochat", /Démolition Rochat/);
    await page.getByLabel("Immatriculation").fill("VD 356 789");
    await selectComboboxOption(page, "Matière", "Ferraille", /Ferraille/);
    await expect(page.getByLabel("Prix d'achat")).toHaveValue("185.00");
    await page.getByLabel("Poids brut (entrée)").fill("21050");

    await page.getByRole("button", { name: "Enregistrer la pesée d'entrée" }).click();
    await expect(page).toHaveURL(/\/pesees\/[0-9a-f-]+\?enregistree=1/);
    await expect(page.getByRole("article")).toContainText("En attente");
    await expect(page.getByRole("article")).toContainText("21'050 kg");

    const stockBefore = await readStockKg(page, "Ferraille");
    await page.goBack();

    await page.getByLabel("Tare (sortie)").fill("15470");
    await expect(page.getByRole("region", { name: "Récapitulatif de la pesée" })).toContainText(
      "5'580 kg",
    );
    await expect(page.getByRole("region", { name: "Récapitulatif de la pesée" })).toContainText(
      "CHF 1'032.30",
    );
    await page.getByRole("button", { name: "Terminer la pesée" }).click();
    await expect(page).toHaveURL(/terminee=1/);
    await expect(page.getByRole("article")).toContainText("Terminée");
    await expect(page.getByRole("article")).toContainText("5'580 kg");

    expect((await readStockKg(page, "Ferraille")) - stockBefore).toBe(5580);
  });

  test("impossible values are rejected before anything is saved", async ({ page }) => {
    await page.goto("/pesees/nouvelle");
    await selectComboboxOption(page, "Fournisseur", "Favre", /Construction Favre SA/);
    await page.getByLabel("Immatriculation").fill("VD 123 456");
    await selectComboboxOption(page, "Matière", "Laiton", /Laiton/);
    await page.getByLabel("Poids brut (entrée)").fill("3000");
    await page.getByLabel("Tare (sortie)").fill("3500");

    await expect(page.getByText("La tare ne peut pas dépasser le poids brut.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Terminer la pesée" })).toBeDisabled();
    await expect(page.getByLabel("Tare (sortie)")).toHaveAttribute("aria-invalid", "true");

    // Missing mandatory information is caught server-side as well.
    await page.getByLabel("Tare (sortie)").fill("");
    await page.getByLabel("Poids brut (entrée)").fill("");
    await page.getByRole("button", { name: "Enregistrer la pesée d'entrée" }).click();
    await expect(page.getByText("Indiquez un poids.")).toBeVisible();
    await expect(page).toHaveURL(/\/pesees\/nouvelle$/);
  });
});
