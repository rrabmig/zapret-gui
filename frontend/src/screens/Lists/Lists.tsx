import { useEffect, useRef, useState } from "react";
import { arrowNavigation } from "../../design/arrowNavigation";
import { useApp } from "../../app/AppProvider";
import { policy } from "../../bridge/policy";
import { Button } from "../../components/Button/Button";
import { Card, Section } from "../../components/Card/Card";
import styles from "./Lists.module.css";
import page from "../../design/Page.module.css";
const files = [
  ["list-general-user.txt", "Домены"],
  ["list-exclude-user.txt", "Исключения доменов"],
  ["ipset-extra-user.txt", "Дополнительные IP"],
  ["ipset-exclude-user.txt", "Исключения IP"],
  ["targets.txt", "Цели проверок"],
] as const;
export function Lists({ active = true }: { active?: boolean }) {
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
        title: "Отбросить изменения?",
        body: "В списке есть несохранённые изменения.",
        label: "Отбросить",
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
      notify(String(error), "danger");
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
      }, "Список сохранён.")
    ) {
      setEdited(false);
      dirty("lists", false);
    }
  }
  async function preview() {
    if (await act("preview-hosts", "", "Предпросмотр загружен.")) {
      try {
        setHosts(await bridge.ReadList("hosts-preview"));
      } catch (error) {
        notify(String(error), "danger");
      }
    }
  }
  return (
    <div className={page.stack}>
      <Section
        title="Ваши списки"
        description="Хранятся отдельно от upstream и сохраняются при обновлении."
        action={
          <Button disabled={!p.idle} onClick={() => void act("update-ipset")}>
            Обновить IPSet
          </Button>
        }
      >
        <div className={styles.layout}>
          <nav
            className={styles.menu}
            aria-label="Файлы списков"
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
                    ? "IP и CIDR, по одному на строку."
                    : name === "targets.txt"
                      ? "Домены для Standard tests."
                      : "ASCII-домены, без схемы и пути. Комментарии через #."}
                  {edited && " Есть изменения."}
                </p>
                <Button
                  variant="primary"
                  disabled={reading || !p.idle || !loaded}
                  onClick={() => void save()}
                >
                  Сохранить список
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </Section>
      <Section
        title="Hosts"
        description="Применение — отдельным действием с резервной копией."
        action={
          <Button onClick={() => void preview()}>Загрузить предпросмотр</Button>
        }
      >
        {hosts !== undefined ? (
          <Card>
            <div className={styles.editor}>
              <pre>{hosts}</pre>
              <div className={styles.footer}>
                <p>Меняется только блок ZapretDesktop.</p>
                <Button
                  variant="primary"
                  disabled={!p.allowed}
                  onClick={async () => {
                    if (
                      await confirm({
                        title: "Обновить системный hosts?",
                        body: "Показанные записи будут добавлены в отдельный блок ZapretDesktop. Остальное содержимое сохранится. Рядом с hosts появится резервная копия.",
                        label: "Применить записи",
                      })
                    )
                      await act("apply-hosts");
                  }}
                >
                  Применить к hosts
                </Button>
              </div>
            </div>
          </Card>
        ) : (
          <p className={page.footnote}>
            Сначала загрузите записи upstream и просмотрите изменения.
          </p>
        )}
      </Section>
    </div>
  );
}
