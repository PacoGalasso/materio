import { expect, test } from "@playwright/test";

import { E2E_USER } from "../playwright.config";

test.describe("Authentication", () => {
  test("unauthenticated visitors are redirected to sign in, and back afterwards", async ({
    page,
  }) => {
    await page.goto("/stock");
    await expect(page).toHaveURL(/\/connexion\?suivant=%2Fstock/);

    await page.getByLabel("Adresse e-mail").fill(E2E_USER.email);
    await page.getByLabel("Mot de passe").fill(E2E_USER.password);
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(page).toHaveURL("/stock");
  });

  test("a wrong password shows one generic message, never revealing whether the account exists", async ({
    page,
  }) => {
    await page.goto("/connexion");
    await page.getByLabel("Adresse e-mail").fill(E2E_USER.email);
    await page.getByLabel("Mot de passe").fill("definitely-the-wrong-password");
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(page.getByText("Adresse e-mail ou mot de passe incorrect.")).toBeVisible();

    await page.getByLabel("Adresse e-mail").fill("no-such-account@matiere.test");
    await page.getByLabel("Mot de passe").fill("whatever-password-123");
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(page.getByText("Adresse e-mail ou mot de passe incorrect.")).toBeVisible();
  });

  test("sign out ends the session: the workspace is no longer reachable afterwards", async ({
    page,
  }) => {
    await page.goto("/connexion");
    await page.getByLabel("Adresse e-mail").fill(E2E_USER.email);
    await page.getByLabel("Mot de passe").fill(E2E_USER.password);
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(page).toHaveURL("/");

    await page.getByRole("button", { name: "Se déconnecter" }).click();
    await expect(page).toHaveURL(/\/connexion/);

    await page.goto("/");
    await expect(page).toHaveURL(/\/connexion/);
  });
});
