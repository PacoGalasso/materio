import { expect, test } from "@playwright/test";

test.describe("Yard management", () => {
  test("manager updates a purchase price and the reference changes everywhere", async ({
    page,
  }) => {
    await page.goto("/matieres");
    await page.getByRole("link", { name: "Laiton" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Laiton");

    await page.getByRole("button", { name: "Modifier le prix" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Nouveau prix d'achat").fill("4,35");
    await dialog.getByLabel("Motif").fill("Accord fournisseur");
    await dialog.getByRole("button", { name: "Enregistrer le prix" }).click();

    await expect(dialog).toBeHidden();
    await expect(page.getByText("CHF 4.35/kg").first()).toBeVisible();
    await expect(page.getByRole("cell", { name: "Accord fournisseur" })).toBeVisible();

    await page.goto("/pesees/nouvelle");
    const material = page.getByRole("combobox", { name: "Matière" });
    await material.fill("Laiton");
    await page
      .getByRole("option", { name: /Laiton/ })
      .first()
      .click();
    await expect(page.getByLabel("Prix d'achat")).toHaveValue("4.35");
  });

  test("manager ships material and the stock decreases; over-shipping is refused", async ({
    page,
  }) => {
    await page.goto("/matieres");
    await page.getByRole("link", { name: "Zinc" }).click();
    const stockStat = page.getByText("Stock actuel").locator("..");
    const readStockKg = async () => {
      const match = /([\d'’]+(?:\.\d+)?) kg/.exec(await stockStat.innerText());
      if (!match?.[1]) throw new Error("Stock figure not found");
      return Number(match[1].replace(/['’]/g, ""));
    };
    const before = await readStockKg();
    expect(before).toBeGreaterThanOrEqual(150);

    await page.getByRole("button", { name: "Expédition" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Quantité").fill(String(before + 50));
    await dialog.getByLabel("Destinataire / bon de livraison").fill("Fonderie du Rhône SA");
    await dialog.getByRole("button", { name: "Enregistrer l'expédition" }).click();
    await expect(dialog.getByText("La quantité dépasse le stock disponible.")).toBeVisible();

    await dialog.getByLabel("Quantité").fill("150");
    await dialog.getByRole("button", { name: "Enregistrer l'expédition" }).click();
    await expect(dialog).toBeHidden();
    await expect
      .poll(readStockKg, { message: "stock should drop by the shipped quantity" })
      .toBe(before - 150);
    await expect(page.getByRole("row", { name: /Fonderie du Rhône SA/ })).toContainText("−150");
  });

  test("operator creates a supplier from the weighing form and cancels a ticket", async ({
    page,
  }) => {
    await page.goto("/pesees/nouvelle");
    const supplier = page.getByRole("combobox", { name: "Fournisseur" });
    await supplier.fill("Métaux Nyon");
    await page.getByRole("option", { name: /Créer le fournisseur/ }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByLabel("Nom de l'entreprise")).toHaveValue("Métaux Nyon");
    await dialog.getByLabel("Localité").fill("Nyon");
    await dialog.getByRole("button", { name: "Créer le fournisseur" }).click();
    await expect(dialog).toBeHidden();
    await expect(supplier).toHaveValue("Métaux Nyon");

    await page.getByLabel("Immatriculation").fill("VD 55 555");
    const material = page.getByRole("combobox", { name: "Matière" });
    await material.fill("Plomb");
    await page.getByRole("option", { name: /Plomb/ }).first().click();
    await page.getByLabel("Poids brut (entrée)").fill("2600");
    await page.getByRole("button", { name: "Enregistrer la pesée d'entrée" }).click();
    await expect(page).toHaveURL(/\/pesees\/[0-9a-f-]+\?enregistree=1/);

    await page.getByRole("button", { name: "Annuler la pesée" }).click();
    const cancel = page.getByRole("dialog");
    await cancel.getByLabel("Motif").fill("Chauffeur reparti sans décharger");
    await cancel.getByRole("button", { name: "Confirmer l'annulation" }).click();
    await expect(cancel).toBeHidden();
    await expect(page.getByRole("article")).toContainText("Annulée");
    await expect(page.getByRole("article")).toContainText("Chauffeur reparti sans décharger");
    await expect(page.getByRole("button", { name: "Annuler la pesée" })).toHaveCount(0);

    await page.goto("/fournisseurs");
    await expect(page.getByRole("link", { name: "Métaux Nyon" })).toBeVisible();
  });
});
