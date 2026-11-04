import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { scenarios } from "../../../testing/fixtures";
async function open(page: Page, state = "idle") {
  await page.goto(`http://127.0.0.1:4173/?state=${state}`);
  await expect(
    page.getByRole("heading", { name: "Обзор", exact: true }),
  ).toBeVisible();
}
async function section(page: Page, name: string) {
  await page
    .getByRole("navigation", { name: "Разделы" })
    .getByRole("button", { name, exact: true })
    .click();
}
async function calls(page: Page) {
  return page.evaluate(() => window.__uiCalls ?? []);
}

async function accessible(page: Page) {
  const { violations } = await new AxeBuilder({ page })
    .include("#root")
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(
    violations.map(({ id, nodes }) => ({
      id,
      nodes: nodes.map((node) => ({
        target: node.target,
        reason: node.failureSummary,
      })),
    })),
  ).toEqual([]);
}

test("визуальные состояния приложения и все разделы", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (const state of scenarios) {
    await open(page, state);
    if (state === "running" || state === "service")
      await expect(
        page.getByRole("button", { name: "Остановить", exact: true }),
      ).toBeEnabled();
    else
      await expect(
        page.getByRole("button", { name: "Запустить", exact: true }),
      ).toBeDisabled();
    await accessible(page);
    await expect(page).toHaveScreenshot(`overview-${state}.png`, {
      fullPage: true,
    });
    expect(await calls(page)).toEqual([]);
  }
  await open(page);
  for (const name of [
    "Стратегии",
    "Списки",
    "Обновления",
    "Настройки",
    "Журнал",
  ]) {
    // Strategy nav includes the catalog count in its accessible name.
    const nav = page.getByRole("navigation", { name: "Разделы" });
    await nav.getByRole("button", { name: new RegExp(`^${name}`) }).click();
    if (name === "Списки")
      await expect(
        page.getByRole("textbox", { name: "list-general-user.txt" }),
      ).toHaveValue(/example.org/);
    await accessible(page);
    await expect(page).toHaveScreenshot(`page-${name}.png`, { fullPage: true });
  }
  await page.setViewportSize({ width: 760, height: 790 });
  for (const name of ["Обзор", "Списки", "Настройки"]) {
    await section(page, name);
    await accessible(page);
    await expect(page).toHaveScreenshot(`compact-${name}.png`, {
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  expect(errors).toEqual([]);
});

test("действия через инертный мост, ошибки и каталог компонентов", async ({
  page,
  request,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await open(page);
  expect(await calls(page)).toEqual([]);
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Перейти к содержимому" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("main", { name: "Обзор" })).toBeFocused();
  const appNav = page.getByRole("navigation", { name: "Разделы" });
  await appNav.getByRole("button", { name: "Обзор", exact: true }).focus();
  await page.keyboard.press("ArrowDown");
  await expect(
    page.getByRole("heading", { name: "Стратегии", exact: true }),
  ).toBeVisible();
  await expect(
    appNav.getByRole("button", { name: /^Стратегии/ }),
  ).toBeFocused();
  await page.keyboard.press("End");
  await expect(
    page.getByRole("heading", { name: "Журнал", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Home");
  await expect(
    page.getByRole("heading", { name: "Обзор", exact: true }),
  ).toBeVisible();
  await section(page, "Настройки");
  await page.getByRole("switch", { name: "Разрешить запуск движка" }).check();
  await page
    .getByRole("button", { name: "Сохранить настройки", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Настройки сохранены" }),
  ).toBeVisible();
  expect((await calls(page)).map((call) => call.action)).toEqual(["settings"]);
  await section(page, "Обзор");
  await expect(
    page.getByRole("button", { name: "Запустить", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Проверка стратегий" }).press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Отмена", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("button", { name: "Открыть утилиту", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(
    page.getByRole("button", { name: "Отмена", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  expect((await calls(page)).length).toBe(1);
  await page.getByRole("button", { name: "Проверка стратегий" }).click();
  await page
    .getByRole("button", { name: "Открыть утилиту", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Сеанс завершён" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Проверка стратегий" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Сеанс завершён" }).click();
  await expect(
    page.getByRole("button", { name: "Сеанс завершён" }),
  ).not.toBeVisible();
  await page.getByRole("button", { name: "Запустить", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Остановить", exact: true }),
  ).toBeEnabled();
  await section(page, "Списки");
  await expect(
    page.getByRole("textbox", { name: "list-general-user.txt" }),
  ).toBeDisabled();
  await section(page, "Обзор");
  await page.getByRole("button", { name: "Остановить", exact: true }).click();
  await section(page, "Списки");
  const editor = page.getByRole("textbox", { name: "list-general-user.txt" });
  const listNav = page.getByRole("navigation", { name: "Файлы списков" });
  await listNav.getByRole("button", { name: /^Домены/ }).focus();
  await page.keyboard.press("ArrowDown");
  await expect(
    listNav.getByRole("button", { name: /^Исключения доменов/ }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("textbox", { name: "list-exclude-user.txt" }),
  ).toHaveValue(/example.org/);
  await page.keyboard.press("Home");
  await page.keyboard.press("Space");
  await expect(editor).toHaveValue(/example.org/);
  await editor.fill("example.com\n");
  await page.getByRole("button", { name: "Исключения доменов" }).click();
  await page.getByRole("button", { name: "Отмена", exact: true }).click();
  await expect(editor).toHaveValue("example.com\n");
  await page
    .getByRole("button", { name: "Сохранить список", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Список сохранён" }),
  ).toBeVisible();
  await page
    .getByRole("navigation", { name: "Разделы" })
    .getByRole("button", { name: /^Стратегии/ })
    .click();
  await page.getByRole("searchbox").fill("ALT2");
  await expect(page.getByRole("radio")).toHaveCount(1);
  await page.getByRole("radio").check();
  await expect(
    page.getByRole("status").filter({ hasText: "Стратегия выбрана" }),
  ).toBeVisible();
  await section(page, "Настройки");
  await page
    .getByRole("combobox", { name: "IPSet Filter" })
    .selectOption("any");
  await page
    .getByRole("button", { name: "Сохранить настройки", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Фильтровать все IP?" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Отмена", exact: true }).click();
  await page
    .getByRole("button", { name: "Отменить изменения", exact: true })
    .click();
  await page.getByRole("textbox", { name: "Порты TCP" }).fill("443");
  await section(page, "Обзор");
  await section(page, "Настройки");
  await expect(page.getByRole("textbox", { name: "Порты TCP" })).toHaveValue(
    "443",
  );
  await page
    .getByRole("button", { name: "Отменить изменения", exact: true })
    .click();
  await open(page, "bridge-error");
  await page.getByRole("button", { name: "Диагностика" }).click();
  await expect(page.getByRole("alert")).toContainText("тестовая ошибка моста");
  await expect(page.getByRole("button", { name: "Диагностика" })).toBeEnabled();
  // The production build must fail closed without Wails, even with fixture URL parameters.
  await page.goto("http://127.0.0.1:4174/?state=running");
  await expect(page.getByRole("status")).toContainText("Go-мост недоступен");
  expect(await page.evaluate(() => window.__uiCalls)).toBeUndefined();
  // Render every colocated story in the actual compiled Storybook.
  const index = (await (
    await request.get("http://127.0.0.1:6006/index.json")
  ).json()) as { entries: Record<string, { id: string; type: string }> };
  const stories = Object.values(index.entries).filter(
    (entry) => entry.type === "story",
  );
  expect(stories.length).toBeGreaterThan(40);
  for (const story of stories) {
    await page.goto(
      `http://127.0.0.1:6006/iframe.html?id=${story.id}&viewMode=story&globals=theme:${testInfo.project.name}`,
    );
    await expect(page.locator("#storybook-root")).not.toBeEmpty();
    await expect(page.locator(".sb-errordisplay")).not.toBeVisible();
  }
  await page.goto(
    "http://127.0.0.1:6006/?path=/story/design-system-button--secondary",
  );
  await expect(
    page.getByRole("tab", { name: "Accessibility", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /CSS pseudo states/ }),
  ).toBeVisible();
  await page.keyboard.press("ControlOrMeta+k");
  await expect(page.locator("#storybook-explorer-searchfield")).toBeFocused();
  await page.keyboard.press("Escape");
  expect(errors).toEqual([]);
});
