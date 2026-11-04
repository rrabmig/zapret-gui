import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

async function section(page: Page, name: string, language = "ru") {
  await page
    .getByRole("navigation", {
      name: language === "ru" ? "Разделы" : "Sections",
    })
    .getByRole("button", { name: new RegExp(`^${name}`) })
    .click();
}
async function english(page: Page) {
  await section(page, "Настройки");
  const selector = page.getByRole("combobox", { name: "Язык", exact: true });
  await selector.focus();
  await selector.selectOption("en");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(
    page.getByRole("combobox", { name: "Language", exact: true }),
  ).toBeFocused();
}
async function clean(page: Page) {
  const text = await page.locator("body").innerText();
  if ((await page.locator("html").getAttribute("lang")) === "en")
    expect(text.replaceAll("Русский", "")).not.toMatch(/[А-Яа-яЁё]/);
  expect(text).not.toMatch(
    /undefined|\[object Object\]|\{value\d\}|error\d{3}|fixtureStartup|operationFailed/,
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const { violations } = await new AxeBuilder({ page })
    .include("#root")
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(
    violations.map(({ id, nodes }) => ({
      id,
      targets: nodes.map((n) => n.target),
    })),
  ).toEqual([]);
}

test("язык по умолчанию, черновики, фокус, выбранный экран и сохранение", async ({
  page,
}) => {
  page.on("dialog", (dialog) => void dialog.accept());
  await page.goto("http://127.0.0.1:4173/");
  await expect(page.locator("html")).toHaveAttribute("lang", "ru");
  await section(page, "Списки");
  const editor = page.getByRole("textbox", { name: "list-general-user.txt" });
  await expect(editor).toHaveValue(/example.org/);
  await editor.fill("unsaved.example\n");
  await section(page, "Стратегии");
  await page.getByRole("searchbox", { name: "Поиск стратегий" }).fill("ALT2");
  await section(page, "Настройки");
  await page.getByRole("textbox", { name: "Порты TCP" }).fill("443");
  await english(page);
  await expect(
    page.getByRole("heading", { name: "Settings", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("textbox", { name: "TCP ports" })).toHaveValue(
    "443",
  );
  await expect(
    page.getByText("You have unsaved changes.", { exact: true }),
  ).toBeVisible();
  await section(page, "Strategies", "en");
  await expect(
    page.getByRole("searchbox", { name: "Search strategies" }),
  ).toHaveValue("ALT2");
  await expect(page.getByRole("radio")).toHaveCount(1);
  await expect(
    page.getByText("Strategies in the official package: 4."),
  ).toBeVisible();
  await section(page, "Lists", "en");
  await expect(editor).toHaveValue("unsaved.example\n");
  await page
    .getByRole("navigation", { name: "List files" })
    .getByRole("button", { name: /^Excluded domains/ })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Discard changes?" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Cancel", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(editor).toHaveValue("unsaved.example\n");
  await clean(page);
  await expect
    .poll(() => page.evaluate(() => window.__uiCalls?.map((c) => c.action)))
    .toEqual(["language"]);
  await section(page, "Settings", "en");
  await page
    .getByRole("combobox", { name: "Language", exact: true })
    .selectOption("ru");
  await expect(page.locator("html")).toHaveAttribute("lang", "ru");
  await expect(page.getByRole("textbox", { name: "Порты TCP" })).toHaveValue(
    "443",
  );
  await page
    .getByRole("combobox", { name: "Язык", exact: true })
    .selectOption("en");
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("fixture-language")))
    .toBe("en");
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Overview", exact: true }),
  ).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  expect(await page.evaluate(() => window.__uiCalls)).toEqual([]);
  await page.evaluate(() =>
    localStorage.setItem("fixture-language", "unknown"),
  );
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Обзор", exact: true }),
  ).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "ru");
});

test("английские экраны, диалог, динамические статусы и ошибки", async ({
  page,
}) => {
  page.on("dialog", (dialog) => void dialog.accept());
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:4173/");
  await english(page);
  for (const name of [
    "Overview",
    "Strategies",
    "Lists",
    "Updates",
    "Settings",
    "Journal",
  ]) {
    await section(page, name, "en");
    await clean(page);
    await expect(page).toHaveScreenshot(`en-${name}.png`, { fullPage: true });
  }
  await section(page, "Overview", "en");
  await page.getByRole("button", { name: /^Diagnostics/ }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Done." }),
  ).toBeVisible();
  await section(page, "Settings", "en");
  await page
    .getByRole("combobox", { name: "Language", exact: true })
    .selectOption("ru");
  await expect(
    page.getByRole("status").filter({ hasText: "Готово." }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "Язык", exact: true })
    .selectOption("en");
  await page
    .getByRole("combobox", { name: "IPSet Filter" })
    .selectOption("any");
  await page
    .getByRole("button", { name: "Save settings", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Filter all IPs?" }),
  ).toBeVisible();
  await clean(page);
  await expect(page).toHaveScreenshot("en-dialog.png", { fullPage: true });
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 760, height: 790 });
  for (const name of ["Overview", "Lists", "Settings"]) {
    await section(page, name, "en");
    await clean(page);
    await expect(page).toHaveScreenshot(`en-compact-${name}.png`, {
      fullPage: true,
    });
  }
  await page.goto("http://127.0.0.1:4173/?state=bridge-error");
  await expect(
    page.getByRole("heading", { name: "Overview", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: /^Diagnostics/ }).click();
  await expect(page.getByRole("alert")).toContainText("Line fixture");
  await section(page, "Settings", "en");
  await page
    .getByRole("combobox", { name: "Language", exact: true })
    .selectOption("ru");
  await expect(page.getByRole("alert")).toContainText("Строка fixture");
  expect(errors).toEqual([]);
});

test("общий язык Storybook применяется к экранам и автономным компонентам", async ({
  page,
}) => {
  for (const language of ["ru", "en"]) {
    await page.goto(
      `http://127.0.0.1:6006/iframe.html?id=screens-appshell--default&viewMode=story&globals=language:${language}`,
    );
    await expect(
      page.getByRole("heading", {
        name: language === "ru" ? "Обзор" : "Overview",
        exact: true,
      }),
    ).toBeVisible();
    await page.goto(
      `http://127.0.0.1:6006/iframe.html?id=design-system-confirmdialog--default&viewMode=story&globals=language:${language}`,
    );
    await page.getByRole("button", { name: "Открыть подтверждение" }).click();
    await expect(
      page.getByRole("button", {
        name: language === "ru" ? "Отмена" : "Cancel",
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", language);
  }
});
