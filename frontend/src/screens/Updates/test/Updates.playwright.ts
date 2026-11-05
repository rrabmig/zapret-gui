import { expect, test } from "@playwright/test";

test("download, apply, rollback and delete are separate operations", async ({
  page,
}) => {
  await page.goto("http://127.0.0.1:4173/");
  await page
    .getByRole("navigation", { name: "Разделы" })
    .getByRole("button", { name: "Сборки Flowseal", exact: true })
    .click();
  const selector = page.getByRole("combobox", {
    name: "Сборка Flowseal",
    exact: true,
  });
  await expect(selector).toHaveValue("1.10.4");
  await page
    .getByRole("button", { name: "Скачать сборку Flowseal", exact: true })
    .click();
  await expect(selector.locator("option[value='1.10.5']")).toHaveCount(1);
  await expect(selector).toHaveValue("1.10.4");
  await selector.selectOption("1.10.5");
  await page.getByRole("button", { name: "Применить", exact: true }).click();
  await expect(selector).toHaveValue("1.10.5");
  await expect(
    page.getByRole("button", { name: "Удалить версию 1.10.5", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Вернуться к предыдущей", exact: true })
    .click();
  await expect(selector).toHaveValue("1.10.4");
  await page
    .getByRole("button", { name: "Удалить версию 1.10.5", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Отмена", exact: true })
    .click();
  await expect(selector.locator("option[value='1.10.5']")).toHaveCount(1);
  await page
    .getByRole("button", { name: "Удалить версию 1.10.5", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Удалить", exact: true })
    .click();
  await expect(selector.locator("option[value='1.10.5']")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Открыть папку", exact: true })
    .click();
  const calls = await page.evaluate(() => window.__uiCalls ?? []);
  expect(calls.map((c) => c.action)).toEqual([
    "download-version",
    "activate",
    "activate",
    "delete-version",
    "open-versions",
  ]);
});

test("version changes are blocked by the service and an upstream session", async ({
  page,
}) => {
  for (const scenario of [
    "running",
    "service",
    "tool-session",
    "status-error",
  ]) {
    await page.goto(`http://127.0.0.1:4173/?state=${scenario}`);
    await page
      .getByRole("navigation", { name: "Разделы" })
      .getByRole("button", { name: "Сборки Flowseal", exact: true })
      .click();
    await expect(
      page.getByRole("combobox", { name: "Сборка Flowseal", exact: true }),
    ).toBeDisabled();
    await expect(
      page.getByRole("button", {
        name: "Скачать сборку Flowseal",
        exact: true,
      }),
    ).toBeDisabled();
    expect(await page.evaluate(() => window.__uiCalls ?? [])).toEqual([]);
  }
});

test("GUI update requires a download and an explicit restart confirmation", async ({
  page,
}) => {
  await page.goto("http://127.0.0.1:4173/?state=gui-update");
  await page
    .getByRole("navigation", { name: "Разделы" })
    .getByRole("button", { name: "Сборки Flowseal", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Проверить обновление GUI", exact: true })
    .click();
  await expect(page.getByText("v0.3.0", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Скачать обновление GUI", exact: true })
    .click();
  const restart = page.getByRole("button", {
    name: "Обновить и перезапустить",
    exact: true,
  });
  await restart.click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Отмена", exact: true })
    .click();
  expect(
    (await page.evaluate(() => window.__uiCalls ?? [])).map((c) => c.action),
  ).toEqual(["check-gui-update", "download-gui-update"]);
  await restart.click();
  await expect(page.getByRole("dialog")).toHaveScreenshot(
    "gui-update-confirm.png",
  );
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Обновить и перезапустить", exact: true })
    .click();
  expect(
    (await page.evaluate(() => window.__uiCalls ?? [])).map((c) => c.action),
  ).toEqual(["check-gui-update", "download-gui-update", "apply-gui-update"]);
});
