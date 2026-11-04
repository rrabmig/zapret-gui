import type { Snapshot } from "./types";
export function policy(s: Snapshot) {
  const e = s.engine;
  const idle =
    !e.running &&
    !e.serviceRunning &&
    !e.serviceInstalled &&
    !e.externalRunning &&
    !e.foreignServiceInstalled &&
    !s.toolSession &&
    !e.statusError;
  const allowed = e.supported && s.config.engineAllowed && !e.statusError;
  const running = e.running || e.serviceRunning;
  return {
    idle,
    allowed,
    running,
    packaged: !!s.config.active,
    canToggle:
      e.running ||
      (e.serviceRunning
        ? allowed && !s.toolSession
        : allowed && !!s.config.active && idle),
    status: e.statusError
      ? "Статус неизвестен"
      : running
        ? "Работает"
        : !e.supported
          ? "Только оболочка"
          : s.config.engineAllowed
            ? "Остановлен"
            : "Режим просмотра",
    description:
      e.statusError ||
      (!e.supported
        ? e.message
        : !s.config.active
          ? "Установите официальный пакет в разделе «Обновления»."
          : !s.config.engineAllowed
            ? "Разрешите запуск движка в настройках, когда будете готовы."
            : e.foreignServiceInstalled
              ? "Найдена служба другой установки zapret. Управляйте ею через оригинальную установку."
              : e.externalRunning && !e.serviceRunning
                ? "Обнаружен сторонний winws. Завершите его перед запуском."
                : s.toolSession
                  ? "Сначала завершите сеанс оригинальной утилиты."
                  : running
                    ? `Flowseal ${s.config.active} · ${s.config.strategy}`
                    : !e.elevated
                      ? "Для запуска запросите права администратора в настройках."
                      : "Всё готово. Запуск — только по вашей команде."),
  };
}
