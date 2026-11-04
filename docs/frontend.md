# Фронтенд

## Структура и сборка

React + TypeScript (strict), Vite, CSS Modules. Версии зависимостей зафиксированы в `frontend/package.json` и `package-lock.json`; установка — `npm ci --ignore-scripts`. Нет роутера, CSS-фреймворка и библиотеки глобального состояния. Полный бюджет production JS+CSS — 100 KiB gzip, проверяется `scripts/check-frontend-size.mjs`. Размер конкретной сборки печатается в CI.

- `frontend/src/components/Component/Component.tsx` — компонент или экран.
- `frontend/src/components/Component/Component.module.css` — локальные стили, когда нужны.
- `frontend/src/components/Component/stories/Component.stories.tsx` — состояния компонента.
- `frontend/src/design/tokens.css` — единые семантические цвета, отступы, шрифты и радиусы.
- `frontend/src/design/global.css` — reset, нативные поля и клавиатурный фокус.
- `frontend/src/bridge/types.ts` — JSON-контракт существующих методов Go. При изменении `Snapshot`, `Config`, `EngineState` в Go нужно синхронно обновить его.
- `frontend/src/bridge/policy.ts` — UI-блокировки. Go остаётся источником проверки разрешений.
- `frontend/src/app/AppProvider.tsx` — состояние, последовательные операции, обновление Snapshot, ошибки, подтверждения и защита несохранённых форм.

Wails выполняет frontend install/build из `wails.json`. `assets.go` встраивает `all:frontend/dist`; `main.go` раздаёт только этот каталог через Wails asset server. `.gitkeep` нужен генератору bindings до первой сборки и заменяется содержимым Vite в CI. Исходники, node_modules и Storybook не встраиваются. Для прямого `go build` сначала нужна production-сборка фронтенда.

## Дизайн-система

Основа — системный шрифт, нейтральные серо-синие поверхности и один синий акцент. Статусы имеют отдельные семантические цвета. В тёмной теме глубина задаётся ступенями поверхностей. Анимации ограничены hover и переключателем; `prefers-reduced-motion` отключает переходы. Элементы управления сохраняют нативную клавиатуру, подписи и видимый фокус. Подтверждения используют `<dialog>` с фокусом на отмене и Escape.

Компоненты: Button (primary/secondary/danger/quiet/disabled), Badge, Notice, Card/Section, Field/Switch, ConfirmDialog, ConnectionCard, AppShell и шесть рабочих разделов. Каждая папка компонента содержит stories. Storybook переключает обе темы через toolbar. Формы сохраняют черновики при навигации и polling; при переключении файла списка с изменениями требуется подтверждение.

При оформлении использованы принципы [Stageshow](https://github.com/benjitaylor/skills/tree/main/stageshow) и его [Craft](https://github.com/benjitaylor/skills/blob/main/stageshow/references/craft.md): визуальная иерархия, системная типографика, согласованные отступы и ограниченная палитра. Это рабочее приложение, поэтому постановочные заглушки вместо текста и демонстрационный kit не используются. Иконки — Radix Icons; внешние шрифты и изображения отсутствуют.

## Инертные состояния

`Bridge` передаётся в `App` явно. В desktop он берётся из `window.go.main.App`. Без моста приложение показывает ссылку на сборки и не подставляет фиктивное управление.

`src/testing/fixtures.ts` реализует тот же интерфейс в памяти: idle, running, service, unsupported, empty, status-error и tool-session. Действия меняют только объект и записываются в историю; нет Go, HTTP, запуска процессов, драйвера и файловой системы. Storybook и Playwright используют одни фикстуры. Сценарий `bridge-error` проверяет ошибки и освобождение блокировки интерфейса.

Только `vite build --mode fixtures` создаёт отдельный `dist-fixtures` с выбором `?state=running`. Production-сборка удаляет ветку импорта фикстур; дополнительный контроль ищет маркеры тестового кода в JS/CSS. Параметры URL production-приложения не включают моки. Фиксированы данные, даты, размер окна, locale и timezone браузера.

## Проверки и просмотр

На корпоративной машине не запускать сборку, приложение, тесты или dev-server. Локальный Storybook с инертным мостом запускается только по отдельному явному запросу пользователя. Все следующие команды предназначены для GitHub runner либо другого разрешённого устройства:

```sh
cd frontend
npm ci --ignore-scripts
npm run build
npm run build-storybook
npm run build:fixtures
npx playwright install --with-deps chromium
npm run test:ui
```

Два теста выполняются в светлой и тёмной теме: визуальный проход по состояниям и разделам; сквозное взаимодействие через mock Bridge, ошибки, production без моста и рендер каждой story. Эталоны лежат в `frontend/tests/__screenshots__/{light,dark}`. Playwright сравнивает изображения, а не просто сохраняет новые; допустимое отличие — 0.2% пикселей. В CI загружается `frontend-review` с HTML-отчётом, traces при ошибках, PNG и статическим Storybook. Скачанный каталог Storybook можно открыть через HTTP-сервер на разрешённом устройстве.

Для намеренного обновления дизайна запустить **Build desktop → Run workflow** на ветке PR с `update_visual_baselines: true`. Скачать `frontend-review`, просмотреть PNG из `tests/__screenshots__`, перенести их в репозиторий и закоммитить. Обычный PR-run не обновляет эталоны. Сборка desktop начинается после core и interface checks и создаёт пакеты Windows/macOS/Linux. Автоматического merge нет.

Chromium и инертный мост не подтверждают работу WinDivert, UAC, Windows-службы и системного WebView. Реальный запуск проверяется отдельно на личном Windows-устройстве.

### Accessibility и клавиатура в Storybook

- **Accessibility** (`@storybook/addon-a11y`): в нижней панели нажать **Run accessibility scan** для axe-аудита текущей story. Анализ ограничен `#storybook-root`; автоматический запуск при переключении stories выключен, проверки запускаются по команде. В панели доступны найденные проблемы и подсветка элементов, в toolbar — симуляция особенностей зрения.
- **Pseudo States** (`storybook-addon-pseudo-states`): в toolbar можно включить `hover`, `focus`, `focus-visible`, `active` и другие CSS-состояния. У Button есть отдельные stories Hover и KeyboardFocus. Это визуализация CSS, а не перемещение настоящего клавиатурного фокуса.
- Штатные горячие клавиши Storybook включены. `Ctrl/Cmd+K` — поиск компонента; `Alt+←/→` — предыдущая/следующая story; `Alt+↑/↓` — компонент; `1`, `2`, `3` — фокус на дереве, preview и панели; `F6` / `Shift+F6` — переход между областями; `Alt+A` — показать/скрыть панель; `Alt+F` — полный экран. Комбинации можно менять в **Settings → Keyboard shortcuts** (`Ctrl/Cmd+Shift+,`).
- Внутри preview работают нативные `Tab`, `Shift+Tab`, `Enter`, `Space`, стрелки для select/radio и `Escape` для диалога. Для просторного просмотра доступен **Open in isolation mode**.

Оба addon — только devDependencies. Они не входят в production-бандл и не подключаются к Go.
