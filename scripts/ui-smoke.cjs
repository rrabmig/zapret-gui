// Runs only on a hosted CI runner. The Go bridge is an inert fixture: no engine,
// driver, shell command, or external network probe can be invoked by this test.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1100, height: 850 } });
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  await page.addInitScript(() => {
    window.__calls = [];
    window.__fixture = {
      version: '0.1.0 · UI fixture', os: 'windows', arch: 'amd64', dataDir: 'C:\\Users\\Personal\\AppData\\Roaming\\ZapretDesktop',
      config: { schema: 1, active: '1.10.4', previous: '1.10.3', strategy: 'general.bat', engineAllowed: false, autoCheck: false, theme: 'system', gameMode: 'disabled', gameTCP: '1024-65535', gameUDP: '1024-65535', ipset: 'loaded', discordFake: '', gameFake: '' },
      engine: { supported: true, elevated: true, running: false, serviceInstalled: false, serviceRunning: false, externalRunning: false, foreignServiceInstalled: false, message: 'Готов к запуску' },
      strategies: [{ name: 'general.bat', label: 'general', compatible: true }, { name: 'general (ALT2).bat', label: 'general (ALT2)', compatible: true }],
      packages: ['1.10.4', '1.10.3'], fakes: ['quic_initial_www_google_com.bin'], logs: ['UI fixture · no engine connected'], checks: [], latest: null, lastCheck: '', toolSession: false,
    };
    window.go = { main: { App: {
      Snapshot: async () => structuredClone(window.__fixture),
      Action: async (action, payload) => {
        window.__calls.push({ action, payload });
        if (action === 'settings') window.__fixture.config = JSON.parse(payload);
        if (action === 'tests' || action === 'menu') window.__fixture.toolSession = true;
        if (action === 'tools-finished') window.__fixture.toolSession = false;
        return structuredClone(window.__fixture);
      },
      ReadList: async () => '# UI fixture\nexample.org\n',
      SaveList: async () => {},
    } } };
  });
  await page.goto(pathToFileURL(path.resolve('frontend/index.html')).href);
  await page.waitForFunction(() => document.getElementById('status').textContent === 'Режим просмотра');
  assert.equal(await page.locator('#start-stop').isDisabled(), true);
  assert.equal(await page.evaluate(() => window.__calls.length), 0, 'startup must not invoke actions');
  await page.getByRole('button', { name: 'Настройки', exact: true }).click();
  await page.locator('#engine-allowed').check();
  await page.getByRole('button', { name: 'Сохранить настройки', exact: true }).click();
  await page.waitForFunction(() => window.__calls.length === 1 && !document.body.classList.contains('busy'));
  assert.equal(await page.evaluate(() => window.__calls[0].action), 'settings');
  await page.getByRole('button', { name: 'Обзор', exact: true }).click();
  assert.equal(await page.locator('#start-stop').isDisabled(), false);
  await page.locator('#run-tests').click();
  await page.locator('#confirm-dialog').waitFor({ state: 'visible' });
  await page.getByRole('button', { name: 'Отмена', exact: true }).click();
  assert.equal(await page.evaluate(() => window.__calls.length), 1, 'cancelling probes must not invoke the bridge');
  await page.locator('#run-tests').click();
  await page.getByRole('button', { name: 'Открыть утилиту', exact: true }).click();
  await page.locator('#tools-active').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#run-tests').isDisabled(), true);
  await page.locator('[data-action="tools-finished"]').click();
  await page.locator('#tools-active').waitFor({ state: 'hidden' });
  await page.getByRole('button', { name: /^Стратегии/ }).click();
  await page.locator('#strategy-search').fill('ALT2');
  assert.equal(await page.locator('.strategy-row').count(), 1);
  await page.getByRole('button', { name: 'Списки', exact: true }).click();
  await page.waitForFunction(() => document.getElementById('list-content').value.includes('example.org'));
  await page.getByRole('button', { name: 'Обзор', exact: true }).click();
  const out = process.env.UI_SCREENSHOT_DIR || 'ui-screenshots';
  fs.mkdirSync(out, { recursive: true });
  for (const theme of ['light', 'dark']) {
    await page.evaluate(value => { document.documentElement.dataset.theme = value; }, theme);
    await page.screenshot({ path: path.join(out, `overview-${theme}.png`), fullPage: true, animations: 'disabled' });
  }
  await page.evaluate(() => { window.__fixture.engine.supported = false; window.__fixture.os = 'darwin'; });
  await page.getByRole('button', { name: 'Журнал', exact: true }).click();
  await page.locator('#refresh-log').click();
  await page.locator('#unsupported').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#start-stop').isDisabled(), true, 'unsupported OS must not start the Windows engine');
  assert.deepEqual(errors, [], 'frontend must not emit unhandled exceptions');
  await browser.close();
  console.log('UI smoke passed: opt-in, probe confirmation, upstream interlock, filtering, lists, unsupported OS. No engine was connected.');
})().catch(error => { console.error(error); process.exitCode = 1; });
