# Фронтенд

[Документация](../README.md) · [Проверки интерфейса](testing.md) · [Нативная часть](../native/README.md)

## Структура и сборка

React + TypeScript (strict), Vite, CSS Modules. Версии зависимостей зафиксированы в `frontend/package.json` и `package-lock.json`; установка — `npm ci --ignore-scripts`. Нет роутера, CSS-фреймворка и библиотеки глобального состояния. Полный бюджет production JS+CSS — 100 KiB gzip, проверяется `scripts/check-frontend-size.mjs`. Размер конкретной сборки печатается в CI.

- `frontend/src/components/Component/Component.tsx` — переиспользуемый компонент дизайн-системы.
- `frontend/src/screens/Screen/Screen.tsx` — экран приложения; его stories лежат в `Screen/stories/Screen.stories.tsx`.
- `frontend/src/components/Component/Component.module.css` — локальные стили, когда нужны.
- `frontend/src/components/Component/stories/Component.stories.tsx` — состояния компонента.
- `frontend/src/design/tokens.css` — единые семантические цвета, отступы, шрифты и радиусы.
- `frontend/src/design/global.css` — reset, нативные поля и клавиатурный фокус.
- `frontend/src/lib/bridge/types.ts` — JSON-контракт существующих методов Go. При изменении `Snapshot`, `Config`, `EngineState` в Go нужно синхронно обновить его.
- `frontend/src/lib/bridge/policy.ts` — UI-блокировки. Go остаётся источником проверки разрешений.
- `frontend/src/app/AppProvider/AppProvider.tsx` — состояние, последовательные операции, обновление Snapshot, ошибки, подтверждения и защита несохранённых форм.

Wails выполняет frontend install/build из `wails.json`. `assets.go` встраивает `all:frontend/dist`; `main.go` раздаёт только этот каталог через Wails asset server. `.gitkeep` нужен генератору bindings до первой сборки и заменяется содержимым Vite в CI. Исходники, node_modules и Storybook не встраиваются. Для прямого `go build` сначала нужна production-сборка фронтенда.

## Дизайн-система

Основа — системный шрифт, нейтральные серо-синие поверхности и один синий акцент. Статусы имеют отдельные семантические цвета. В тёмной теме глубина задаётся ступенями поверхностей. Анимации ограничены hover и переключателем; `prefers-reduced-motion` отключает переходы. Элементы управления сохраняют нативную клавиатуру, подписи и видимый фокус. Подтверждения используют `<dialog>` с фокусом на отмене и Escape.

Компоненты: Button (primary/secondary/danger/quiet/disabled), Badge, Notice, Card/Section, Field/Switch, ConfirmDialog, ConnectionCard, AppShell и шесть рабочих разделов. Каждая папка компонента содержит stories. Storybook переключает язык RU/EN и обе темы через toolbar. Формы сохраняют черновики при навигации и polling; при переключении файла списка с изменениями требуется подтверждение.

При оформлении использованы принципы [Stageshow](https://github.com/benjitaylor/skills/tree/main/stageshow) и его [Craft](https://github.com/benjitaylor/skills/blob/main/stageshow/references/craft.md): визуальная иерархия, системная типографика, согласованные отступы и ограниченная палитра. Это рабочее приложение, поэтому постановочные заглушки вместо текста и демонстрационный kit не используются. Иконки — Radix Icons; внешние шрифты и изображения отсутствуют.

## Инертные состояния

`Bridge` передаётся в `App` явно. В desktop он берётся из `window.go.main.App`. Без моста приложение показывает ссылку на сборки и не подставляет фиктивное управление.

`src/testing/fixtures.ts` реализует тот же интерфейс в памяти: idle, running, service, unsupported, empty, status-error и tool-session. Действия меняют только объект и записываются в историю; нет Go, HTTP, запуска процессов, драйвера и файловой системы. Storybook и Playwright используют одни фикстуры. Сценарий `bridge-error` проверяет ошибки и освобождение блокировки интерфейса; `gui-update` моделирует скачивание и подтверждение обновления GUI без установки.

Только `vite build --mode fixtures` создаёт отдельный `dist-fixtures` с выбором `?state=running`. Production-сборка удаляет ветку импорта фикстур; дополнительный контроль ищет маркеры тестового кода в JS/CSS. Параметры URL production-приложения не включают моки. Фиксированы данные, даты, размер окна, locale и timezone браузера.

## Проверки

Сборки, Playwright, визуальные эталоны, доступность и Storybook — в [проверках интерфейса](testing.md).

## Соглашения по структуре

- Тесты лежат рядом с владельцем: `src/screens/ScreenName/test/` или `src/components/ComponentName/test/`. Сквозные проверки всего приложения принадлежат AppShell: `src/screens/AppShell/test/AppShell.playwright.ts`; их PNG — в соседнем `test/__screenshots__/`.
- Суффикс Playwright-тестов — `.playwright.ts`/`.playwright.tsx`, Jest — `.jest.ts`/`.jest.tsx`. Jest сейчас не подключён: unit-тестов фронтенда нет. Playwright собирает только соответствующие файлы из папок `test`.
- Props каждого React-компонента описывает интерфейс `I<ComponentName>Props`, объявленный непосредственно перед компонентом. Контракт есть и у компонентов без входных параметров.
- Переиспользуемые функции и контракты находятся в `src/lib/`: `lib/bridge/` и `lib/keyboard/`. Стили и визуальные токены остаются в `src/design/`.

## Алиасы и ESLint

Алиасы `@lib/*`, `@components/*`, `@screens/*` настроены в TypeScript и общей runtime-конфигурации `aliases.ts`, используемой Vite и Storybook. Импорты между разными компонентами/экранами используют алиасы; файлы внутри одной папки компонента остаются относительными.

`npm run lint` проверяет порядок импортов и экспортов; `npm run lint:fix` автоматически его исправляет. Группы: side effects без стилей, `node:`, внешние пакеты, `@lib`, `@components`, `@screens`, относительные импорты, стили. Внутри групп — алфавитный порядок; последовательность CSS side effects сохраняется. CI запускает lint перед сборкой.

По решению пользователя проект остаётся на **TypeScript 7.0.2**, без ESLint-правила для `IProps`. Существующие интерфейсы `I<ComponentName>Props` сохраняются как соглашение проекта. ESLint использует синтаксический Babel parser с TypeScript/JSX plugins только для сортировки импортов; проверку типов выполняет `tsc`, зависимость от TypeScript compiler API для lint не нужна.

## Переводы

Язык интерфейса — `ru | en`, исходный и резервный — `ru`, без определения языка ОС. `Config.language` сохраняется в существующем `config.json`. Отдельное действие `language` меняет только это предпочтение, независимо от несохранённой формы и состояния движка. Настройки фильтров не перезаписывают язык. Переключение сохраняет дерево React, экран, черновики и фокус; `html.lang` меняется вместе с контекстом. При ошибке записи интерфейс показывает ошибку сохранения.

Добавляйте текст рядом с владельцем в `i18n/{ru,en,index}.ts`. `index.ts` содержит только реэкспорты `ru` и `en`; оба словаря экспортируют обычные объекты со строками, без `as const` и `satisfies`. Импортируйте `import * as keyset from "./i18n"`, затем `const i18n = useI18n(keyset)`, `i18n("ключ")`. `useI18n` проверяет точное совпадение ключей обоих словарей; отрицательные примеры компилируются в `lib/i18n/test/keysets.typecheck.ts` обычным CI typecheck. TypeScript проверяет словари `i18n`. ESLint и Prettier пропускают только словарные `i18n/{ru,en,index}.ts`; инфраструктура `lib/i18n` и её тесты продолжают проверяться.

Для динамических значений передавайте именованные параметры: `i18n("ports", { protocol: "TCP" })`. Счётчики сформулированы без склонения существительных («Стратегий: {count}»), поэтому отдельный plural framework не нужен. Даты используют выбранную локаль. Технические имена, пути, версии и upstream-стратегии остаются данными, без дублирующих ключей.

Для уведомлений и подтверждений используйте `i18n.message("ключ", params)`: это код, словарь и данные, переводимые при отображении, включая уже открытые сообщения. Go возвращает стабильные `Message{code, params}`; Wails сериализует ошибку как JSON-строку. Клиент валидирует конверт и переводит только известные коды. Коды `error001`–`error079` неизменяемы: новые добавляются с новым идентификатором, существующие не перенумеровываются. Системные ошибки и вывод upstream остаются техническими подробностями. Журнал хранит события приложения как JSON-коды, а произвольный вывод движка — исходным текстом; прежние строки app.log не преобразуются по текстовому совпадению.

Чтобы добавить язык, расширьте `Language`/`I18nSet`, словари всех владельцев, `normalizeLanguage` и Go `NormalizeLanguage`, варианты Settings и Storybook, локали дат и CI-матрицу проверок. Общий toolbar Storybook использует тот же `I18nProvider`; инертные fixtures не вызывают Go или сетевые утилиты. Их localStorage моделирует сохранение языка только в fixture-сборке, production использует Go.

Проверки i18n находятся рядом с AppShell (`test/i18n.playwright.ts`): RU по умолчанию, сохранение/восстановление/неизвестный язык, черновики настроек/списков/поиска, фокус, реактивные сообщения, динамические значения, accessible names, обе темы, компактная навигация и длинные английские диалоги. Запускать только на GitHub runners.


Общие стили select находятся в design/global.css: запас справа под стрелку — 36px, сама стрелка отстоит от края на 12px. @supports(appearance: base-select) оформляет native picker, option/checkmark/hover/focus через токены темы, сохраняя семантику select и текстовые option; unsupported WebView используют системный picker. Никакой JS-библиотеки селекта не добавлено. Ссылки имеют настоящие href/target/rel, в Wails явный клик передаётся runtime.BrowserOpenURL; browser preview использует обычный anchor.
