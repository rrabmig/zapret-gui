import { useEffect, useRef, useState } from "react";

import { bridgeError } from "@lib/bridge/messages";
import { policy } from "@lib/bridge/policy";
import { useI18n } from "@lib/i18n";
import { arrowNavigation } from "@lib/keyboard/arrowNavigation";

import { Button } from "@components/Button/Button";
import { Card, Section } from "@components/Card/Card";

import { useApp } from "../../app/AppProvider";
import * as keyset from "./i18n";

import page from "../../design/Page.module.css";
import styles from "./Lists.module.css";

export interface IListsProps {
  active?: boolean;
}
export function Lists({ active = true }: IListsProps) {
  const i18n = useI18n(keyset);
  const files = [
    ["list-general-user.txt", i18n("Домены")],
    ["list-exclude-user.txt", i18n("Исключения доменов")],
    ["ipset-extra-user.txt", i18n("Дополнительные IP")],
    ["ipset-exclude-user.txt", i18n("Исключения IP")],
    ["targets.txt", i18n("Цели проверок")],
  ] as const;
  const { state, bridge, act, task, confirm, dirty, notify } = useApp();
  const p = policy(state);
  const [name, setName] = useState<string>(files[0][0]);
  const [content, setContent] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [edited, setEdited] = useState(false);
  const [hosts, setHosts] = useState<string>();
  const loading = useRef(false);
  const [reading, setReading] = useState(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  async function load(next: string) {
    if (loading.current) return;
    if (
      edited &&
      !(await confirm({
        title: i18n.message("Отбросить изменения?"),
        body: i18n.message("В списке есть несохранённые изменения."),
        label: i18n.message("Отбросить"),
      }))
    )
      return;
    loading.current = true;
    setReading(true);
    try {
      const value = await bridge.ReadList(next);
      if (mounted.current) {
        setName(next);
        setContent(value);
        setLoaded(true);
        setEdited(false);
        dirty("lists", false);
      }
    } catch (error) {
      notify(bridgeError(error), "danger");
    } finally {
      loading.current = false;
      if (mounted.current) setReading(false);
    }
  }
  useEffect(() => {
    if (active && !loaded && !loading.current) void load(name);
  }, [active, loaded]);
  async function save() {
    if (
      await task(async () => {
        await bridge.SaveList(name, content);
        return true;
      }, i18n.message("Список сохранён."))
    ) {
      setEdited(false);
      dirty("lists", false);
    }
  }
  async function preview() {
    if (
      await act("preview-hosts", "", i18n.message("Предпросмотр загружен."))
    ) {
      try {
        setHosts(await bridge.ReadList("hosts-preview"));
      } catch (error) {
        notify(bridgeError(error), "danger");
      }
    }
  }
  return (
    <div className={page.stack}>
      <Section
        title={i18n("Ваши списки")}
        description={i18n(
          "Хранятся отдельно от upstream и сохраняются при обновлении.",
        )}
        action={
          <Button disabled={!p.idle} onClick={() => void act("update-ipset")}>
            {i18n("Обновить IPSet")}
          </Button>
        }
      >
        <div className={styles.layout}>
          <nav
            className={styles.menu}
            aria-label={i18n("Файлы списков")}
            onKeyDown={(event) => arrowNavigation(event)}
          >
            {files.map(([file, label]) => (
              <button
                key={file}
                aria-disabled={reading}
                aria-current={file === name ? "page" : undefined}
                onClick={() => void load(file)}
              >
                {label}
                <small>{file}</small>
              </button>
            ))}
          </nav>
          <Card>
            <div className={styles.editor}>
              <label htmlFor="list-content">{name}</label>
              <textarea
                id="list-content"
                aria-describedby="list-note"
                value={content}
                disabled={reading || !loaded || !p.idle}
                spellCheck={false}
                onChange={(e) => {
                  setContent(e.target.value);
                  setEdited(true);
                  dirty("lists", true);
                }}
              />
              <div className={styles.footer}>
                <p id="list-note">
                  {name.startsWith("ipset")
                    ? i18n("IP и CIDR, по одному на строку.")
                    : name === "targets.txt"
                      ? i18n("Домены для Standard tests.")
                      : i18n(
                          "ASCII-домены, без схемы и пути. Комментарии через #.",
                        )}
                  {edited && <span> {i18n("Есть изменения.")}</span>}
                </p>
                <Button
                  variant="primary"
                  disabled={reading || !p.idle || !loaded}
                  onClick={() => void save()}
                >
                  {i18n("Сохранить список")}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </Section>
      <Section
        title="Hosts"
        description={i18n(
          "Применение — отдельным действием с резервной копией.",
        )}
        action={
          <Button onClick={() => void preview()}>
            {i18n("Загрузить предпросмотр")}
          </Button>
        }
      >
        {hosts !== undefined ? (
          <Card>
            <div className={styles.editor}>
              <pre>{hosts}</pre>
              <div className={styles.footer}>
                <p>{i18n("Меняется только блок ZapretDesktop.")}</p>
                <Button
                  variant="primary"
                  disabled={!p.allowed}
                  onClick={async () => {
                    if (
                      await confirm({
                        title: i18n.message("Обновить системный hosts?"),
                        body: i18n.message(
                          "Показанные записи будут добавлены в отдельный блок ZapretDesktop. Остальное содержимое сохранится. Рядом с hosts появится резервная копия.",
                        ),
                        label: i18n.message("Применить записи"),
                      })
                    )
                      await act("apply-hosts");
                  }}
                >
                  {i18n("Применить к hosts")}
                </Button>
              </div>
            </div>
          </Card>
        ) : (
          <p className={page.footnote}>
            {i18n("Сначала загрузите записи upstream и просмотрите изменения.")}
          </p>
        )}
      </Section>
    </div>
  );
}
