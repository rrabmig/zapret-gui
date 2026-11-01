"use strict";

const $ = (id) => document.getElementById(id);
const api = () => window.go?.main?.App;
let state = null;
let busy = false;
let currentTab = "overview";
let listName = "list-general-user.txt";
let listDirty = false;
let settingsDirty = false;
let listLoaded = false;
let settingsLoaded = false;

function el(tag, className, content) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (content !== undefined) node.textContent = content;
  return node;
}

function message(text, tone = "") {
  const node = $("message");
  node.textContent = text;
  node.className = `notice ${tone}`;
  node.hidden = !text;
}

async function confirmAction(title, body, label = "Продолжить") {
  const dialog = $("confirm-dialog");
  if (dialog.open) return false;
  $("dialog-title").textContent = title;
  $("dialog-body").textContent = body;
  $("dialog-confirm").textContent = label;
  dialog.returnValue = "cancel";
  return new Promise((resolve) => {
    dialog.addEventListener("close", () => resolve(dialog.returnValue === "confirm"), { once: true });
    dialog.showModal();
  });
}

function setBusy(value) {
  busy = value;
  document.body.classList.toggle("busy", value);
  document.querySelector("main").setAttribute("aria-busy", String(value));
  if (value) {
    document.querySelectorAll("main button,main input,main select,main textarea").forEach((node) => {
      node.dataset.wasDisabled = String(node.disabled);
      node.disabled = true;
    });
  } else {
    document.querySelectorAll("main button,main input,main select,main textarea").forEach((node) => {
      if (node.dataset.wasDisabled !== undefined) node.disabled = node.dataset.wasDisabled === "true";
      delete node.dataset.wasDisabled;
    });
    if (state) render();
  }
}

async function act(action, payload = "", success = "") {
  if (busy || !api()) return false;
  setBusy(true);
  message(action === "install-update" ? "Скачивание и проверка официального пакета…" : "Выполняется…");
  try {
    state = await api().Action(action, payload);
    message(success);
    return true;
  } catch (error) {
    message(String(error), "error");
    try { state = await api().Snapshot(); } catch { /* Keep the last known snapshot. */ }
    return false;
  } finally { setBusy(false); }
}

function render() {
  if (!state || busy) return;
  const { config: c, engine: e } = state;
  const idle = !e.running && !e.serviceInstalled && !e.externalRunning && !e.foreignServiceInstalled && !state.toolSession && !e.statusError;
  const allowed = e.supported && c.engineAllowed && !e.statusError;
  $("app-version").textContent = state.version;
  $("upstream-version").textContent = c.active || "не установлен";
  $("platform").textContent = `${state.os} / ${state.arch}`;
  $("unsupported").hidden = e.supported;
  $("tools-active").hidden = !state.toolSession;
  $("status").textContent = e.statusError ? "Статус неизвестен" : e.running || e.serviceRunning ? "Работает" : !e.supported ? "Только оболочка" : c.engineAllowed ? "Остановлен" : "Режим просмотра";
  $("status").className = `badge ${e.statusError ? "warning" : e.running || e.serviceRunning ? "positive" : "muted"}`;
  $("current-strategy").textContent = c.strategy.replace(/\.bat$/i, "");
  $("connection-title").textContent = e.running || e.serviceRunning ? "Движок работает" : "Движок не запущен";
  $("connection-description").textContent = e.statusError || (!e.supported ? e.message : !c.active ? "Установите официальный пакет во вкладке «Обновления»." : !c.engineAllowed ? "Запуск выключен. Разрешите его в настройках." : e.foreignServiceInstalled ? "Найдена служба zapret из другой установки. Управляйте ею через оригинальную установку." : e.externalRunning && !e.serviceRunning ? "Обнаружен сторонний winws. Завершите его перед запуском." : e.running || e.serviceRunning ? `Flowseal ${c.active} · ${c.strategy}` : !e.elevated ? "Для запуска запросите права администратора в настройках." : "Готов к ручному запуску.");
  $("connection-dot").classList.toggle("running", e.running || e.serviceRunning);
  const start = $("start-stop");
  start.textContent = e.running || e.serviceRunning ? "Остановить" : "Запустить";
  start.disabled = e.running ? false : e.serviceRunning ? !allowed : !allowed || !c.active || !idle;
  $("service-status").textContent = e.serviceRunning ? "Работает" : e.serviceInstalled ? "Установлена" : "Не установлена";
  $("service-status").className = `badge ${e.serviceRunning ? "positive" : "muted"}`;
  document.querySelectorAll("[data-engine]").forEach((node) => { node.disabled = !allowed; });
  document.querySelectorAll("[data-package]").forEach((node) => { node.disabled ||= !c.active; });
  document.querySelectorAll('[data-action="service-install"]').forEach((node) => { node.disabled ||= !idle; });
  document.querySelectorAll('[data-action="service-start"]').forEach((node) => { node.disabled ||= !e.serviceInstalled || e.serviceRunning || e.running || e.externalRunning || e.foreignServiceInstalled || state.toolSession; });
  document.querySelectorAll('[data-action="service-stop"]').forEach((node) => { node.disabled ||= !e.serviceRunning || state.toolSession; });
  document.querySelectorAll('[data-action="service-remove"]').forEach((node) => { node.disabled ||= !e.serviceInstalled || state.toolSession; });
  $("upstream-menu").disabled ||= !idle;
  $("run-tests").disabled ||= !idle;
  $("elevate").disabled ||= e.elevated || e.running || state.toolSession;
  $("footer-mode").textContent = !c.engineAllowed ? "Запуск движка выключен" : "Запуск движка разрешён вручную";
  $("strategy-count").textContent = state.strategies.length;
  renderStrategies(idle);
  renderPackages(idle);
  renderChecks();
  $("installed-tag").textContent = c.active || "Не установлен";
  $("latest-tag").textContent = state.latest?.tag_name || "Не проверен";
  $("last-check").textContent = state.lastCheck ? new Date(state.lastCheck).toLocaleString("ru-RU") : "Ещё не выполнялась";
  $("install-update").disabled = !idle || state.latest?.tag_name === c.active;
  $("install-update").textContent = c.active ? "Скачать и обновить" : "Скачать и установить";
  $("rollback").disabled = !c.previous || !idle;
  $("save-list").disabled = !idle;
  $("update-ipset").disabled = !idle;
  $("data-dir").textContent = state.dataDir;
  $("log-content").textContent = state.logs.join("\n") || "Пока нет записей.";
  if (!settingsLoaded || !settingsDirty) fillSettings();
}

function renderStrategies(idle) {
  const container = $("strategy-list");
  container.replaceChildren(el("legend", "sr-only", "Активная стратегия"));
  const query = $("strategy-search").value.toLowerCase();
  let shown = 0;
  for (const strategy of state.strategies) {
    if (!strategy.name.toLowerCase().includes(query)) continue;
    shown++;
    const selected = state.config.strategy === strategy.name;
    const row = el("label", `strategy-row ${selected ? "selected" : ""} ${strategy.compatible ? "" : "unavailable"}`);
    const radio = el("input");
    radio.type = "radio";
    radio.name = "strategy";
    radio.value = strategy.name;
    radio.checked = selected;
    radio.disabled = !strategy.compatible || !idle;
    radio.addEventListener("change", () => act("settings", JSON.stringify({ ...state.config, strategy: strategy.name }), "Стратегия выбрана. Движок не запущен."));
    row.append(radio, el("span", "strategy-name", strategy.label));
    if (!strategy.compatible) row.append(el("span", "caption", strategy.problem));
    else if (selected) row.append(el("span", "badge muted", "Выбрана"));
    container.append(row);
  }
  $("strategies-empty").hidden = shown > 0;
  $("strategies-empty").textContent = state.strategies.length ? "По запросу ничего не найдено." : "Сначала установите пакет во вкладке «Обновления».";
}

function renderPackages(idle) {
  const container = $("packages");
  container.replaceChildren();
  if (!state.packages.length) { container.append(el("p", "empty", "Пакеты ещё не установлены.")); return; }
  for (const tag of state.packages) {
    const row = el("div", "package-row");
    row.append(el("span", "mono", tag));
    if (state.config.active === tag) row.append(el("span", "badge positive", "Активна"));
    else {
      if (state.config.previous === tag) row.append(el("span", "caption", "Предыдущая"));
      const button = el("button", "", "Использовать");
      button.disabled = !idle;
      button.addEventListener("click", () => act("activate", tag, "Версия переключена. Движок не запущен."));
      row.append(button);
    }
    container.append(row);
  }
}

function renderChecks() {
  $("checks").replaceChildren();
  for (const check of state.checks) {
    const item = el("details", "check");
    const summary = el("summary");
    const tone = check.state === "ok" ? "positive" : check.state === "error" ? "error" : check.state === "warning" ? "warning" : "muted";
    summary.append(el("span", `badge ${tone}`, check.state), el("strong", "", check.name));
    item.append(summary, el("pre", "", check.detail));
    $("checks").append(item);
  }
}

function fillSettings() {
  const c = state.config;
  $("engine-allowed").checked = c.engineAllowed;
  $("engine-allowed").disabled = !state.engine.supported;
  $("auto-check").checked = c.autoCheck;
  for (const [id, value] of Object.entries({ theme: c.theme, "game-mode": c.gameMode, "game-tcp": c.gameTCP, "game-udp": c.gameUDP, ipset: c.ipset })) $(id).value = value;
  for (const [id, selected] of [["discord-fake", c.discordFake], ["game-fake", c.gameFake]]) {
    const select = $(id);
    select.replaceChildren(new Option("Как в upstream", ""));
    for (const fake of state.fakes) select.add(new Option(fake, fake));
    select.value = selected;
  }
  settingsLoaded = true;
  document.documentElement.dataset.theme = c.theme;
  updateIPSetNote();
}

function updateIPSetNote() {
  $("ipset-note").textContent = $("ipset").value === "any" ? "any затрагивает все IP и может нарушать доступ к другим ресурсам." : $("ipset").value === "none" ? "none отключает фильтрацию по списку IP." : "loaded — только IP из списка.";
}

async function loadList(name) {
  if (busy || !api()) return;
  if (listDirty && !await confirmAction("Отбросить изменения?", "В списке есть несохранённые изменения.", "Отбросить")) return;
  try {
    const content = await api().ReadList(name);
    listName = name;
    listLoaded = true;
    $("list-content").value = content;
    $("list-label").textContent = name;
    $("list-note").textContent = name.startsWith("ipset") ? "IP-адреса и CIDR, по одному на строку." : name === "targets.txt" ? "Домены для Standard tests. Пустой список целей не запускает проверки." : "ASCII-домены, без схемы и пути. Комментарии через #.";
    document.querySelectorAll("[data-list]").forEach((node) => node.classList.toggle("is-on", node.dataset.list === name));
    listDirty = false;
  } catch (error) { message(String(error), "error"); }
}

async function refresh() {
  if (busy || !api()) return;
  try { state = await api().Snapshot(); render(); }
  catch (error) { message(String(error), "error"); }
}

document.querySelectorAll("[data-tab]").forEach((button) => button.addEventListener("click", () => {
  currentTab = button.dataset.tab;
  document.querySelectorAll(".panel").forEach((panel) => { panel.hidden = panel.id !== currentTab; });
  document.querySelectorAll("[data-tab]").forEach((tab) => {
    tab.classList.toggle("is-on", tab === button);
    if (tab === button) tab.setAttribute("aria-current", "page"); else tab.removeAttribute("aria-current");
  });
  if (currentTab === "lists" && !listLoaded) loadList(listName);
}));

document.querySelectorAll("[data-list]").forEach((button) => button.addEventListener("click", () => loadList(button.dataset.list)));
document.querySelectorAll("[data-action]").forEach((button) => button.addEventListener("click", async () => {
  const action = button.dataset.action;
  if (action === "service-install" && !await confirmAction("Включить автозапуск?", "Будет создана и запущена системная служба ZapretDesktop с текущей стратегией. Она останется активной после закрытия GUI.", "Установить службу")) return;
  if (action === "service-remove" && !await confirmAction("Удалить службу?", "Служба ZapretDesktop будет остановлена и удалена. Другие службы zapret и WinDivert оболочка не удаляет.", "Удалить")) return;
  await act(action);
}));

$("start-stop").addEventListener("click", () => act(state.engine.running ? "stop" : state.engine.serviceRunning ? "service-stop" : "start"));
$("check-updates").addEventListener("click", () => act("check-updates", "", "Метаданные релиза обновлены."));
$("install-update").addEventListener("click", () => act("install-update", "", "Официальный пакет установлен. Движок не запущен."));
$("rollback").addEventListener("click", () => act("rollback", "", "Версия переключена. Пользовательские списки сохранены."));
$("update-ipset").addEventListener("click", () => act("update-ipset", "", "IPSet обновлён. Ваши дополнительные IP сохранены."));
$("diagnostics").addEventListener("click", () => act("diagnostics"));
$("strategy-search").addEventListener("input", () => { if (state) render(); });
$("refresh-log").addEventListener("click", refresh);
$("list-content").addEventListener("input", () => { listDirty = true; });
$("settings-form").addEventListener("input", () => { settingsDirty = true; });
$("settings-form").addEventListener("change", () => { settingsDirty = true; updateIPSetNote(); });

$("save-list").addEventListener("click", async () => {
  if (busy || !api()) return;
  setBusy(true);
  try { await api().SaveList(listName, $("list-content").value); listDirty = false; message("Список сохранён."); }
  catch (error) { message(String(error), "error"); }
  finally { setBusy(false); }
});

$("settings-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const c = { ...state.config, engineAllowed: $("engine-allowed").checked, autoCheck: $("auto-check").checked, theme: $("theme").value, gameMode: $("game-mode").value, gameTCP: $("game-tcp").value.trim(), gameUDP: $("game-udp").value.trim(), ipset: $("ipset").value, discordFake: $("discord-fake").value, gameFake: $("game-fake").value };
  if (c.ipset === "any" && state.config.ipset !== "any" && !await confirmAction("Фильтровать все IP?", "Режим any может затронуть сайты, игры и приложения, которые работают без zapret.", "Выбрать any")) return;
  if (await act("settings", JSON.stringify(c), "Настройки сохранены. Движок не запущен автоматически.")) { settingsDirty = false; fillSettings(); }
});

$("run-tests").addEventListener("click", async () => {
  if (await confirmAction("Запустить сетевые проверки?", "Откроется оригинальная утилита Flowseal: Standard tests и DPI checkers. Она запускает стратегии и обращается к внешним ресурсам. Используйте её на личном устройстве и в подходящей сети.", "Открыть утилиту")) await act("tests");
});
$("upstream-menu").addEventListener("click", async () => {
  if (await confirmAction("Открыть оригинальное меню?", "service.bat работает с правами администратора и может менять сеть, службы и файлы. Все возможности upstream доступны без изменения его кода. Настройки из этого окна действуют в рабочей копии; GUI использует свои сохранённые настройки при следующем запуске.", "Открыть service.bat")) await act("menu");
});
$("clear-cache").addEventListener("click", async () => {
  if (await confirmAction("Сбросить кэш Discord?", "Сначала закройте Discord. Папки Cache, Code Cache и GPUCache будут переименованы в резервные, для Stable, PTB, Canary и Development.", "Сохранить резервные копии")) await act("clear-discord-cache", "", "Кэш обработан. Пути резервных копий — в журнале.");
});
$("preview-hosts").addEventListener("click", async () => {
  if (await act("preview-hosts")) {
    try { $("hosts-content").textContent = await api().ReadList("hosts-preview"); $("hosts-box").hidden = false; }
    catch (error) { message(String(error), "error"); }
  }
});
$("apply-hosts").addEventListener("click", async () => {
  if (await confirmAction("Обновить системный hosts?", "Показанные записи будут добавлены в отдельный блок ZapretDesktop. Остальное содержимое файла сохранится. Резервная копия появится рядом с hosts.", "Применить записи")) await act("apply-hosts", "", "Блок hosts обновлён. Резервная копия сохранена рядом с исходным файлом.");
});
$("elevate").addEventListener("click", async () => {
  if (settingsDirty || listDirty) { message("Сохраните изменения перед перезапуском с правами администратора.", "warning"); return; }
  await act("elevate");
});

window.addEventListener("beforeunload", (event) => {
  if (listDirty || settingsDirty) { event.preventDefault(); event.returnValue = ""; }
});

// Keep downloads available in the HTML preview. In the desktop app, open
// GitHub in the user's browser so their private-repository login is available.
document.querySelectorAll("a[data-external]").forEach((link) => {
  link.addEventListener("click", (event) => {
    if (typeof window.runtime?.BrowserOpenURL === "function") {
      event.preventDefault();
      window.runtime.BrowserOpenURL(link.href);
    }
  });
});

if (!api()) {
  $("downloads").open = true;
  message("Это HTML-превью. Скачайте приложение по ссылкам выше. Управление движком доступно в собранном приложении.");
  document.querySelectorAll("button,input,textarea,select").forEach((node) => { node.disabled = true; });
} else {
  refresh();
  window.setInterval(() => {
    if (!document.hidden && !busy && !$("confirm-dialog").open && (currentTab === "overview" || currentTab === "journal")) refresh();
  }, 5000);
}
