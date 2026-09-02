import { expect, test as setup } from "@playwright/test";

import { E2E_USER } from "../playwright.config";

const STORAGE_STATE = "e2e/.auth/user.json";

setup("authenticate", async ({ page }) => {
  await page.goto("/connexion");
  await page.getByLabel("Adresse e-mail").fill(E2E_USER.email);
  await page.getByLabel("Mot de passe").fill(E2E_USER.password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL("/");
  await page.context().storageState({ path: STORAGE_STATE });
});

export { STORAGE_STATE };
