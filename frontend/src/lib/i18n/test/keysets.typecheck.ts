import { type I18nSet, useI18n } from "..";

// Compiled by the normal strict TypeScript job; never executed.
export function keysetContract() {
  const valid = { ru: { hello: "Привет" }, en: { hello: "Hello" } };
  const i18n = useI18n(valid);
  i18n("hello");
  i18n.message("hello");
  // @ts-expect-error Unknown key.
  i18n("unknown");
  // @ts-expect-error Unknown deferred key.
  i18n.message("unknown");
  const missing = { ru: { hello: "Привет" }, en: {} };
  // @ts-expect-error English is missing a source key.
  useI18n(missing);
  const extra = {
    ru: { hello: "Привет" },
    en: { hello: "Hello", extra: "Extra" },
  };
  // @ts-expect-error Extra English key, even through an inferred variable.
  useI18n(extra);
  const missingRussian = { ru: {}, en: { hello: "Hello" } };
  // @ts-expect-error A key cannot exist only in English.
  useI18n(missingRussian);
  const extraRussian = {
    ru: { hello: "Привет", extra: "Лишний" },
    en: { hello: "Hello" },
  };
  // @ts-expect-error Additional source key requires an English translation.
  useI18n(extraRussian);
  // @ts-expect-error Dictionary values must be ordinary strings.
  useI18n({ ru: { count: 1 }, en: { count: "One" } });
  // @ts-expect-error Every supported language is required.
  useI18n({ ru: { hello: "Привет" } });
  const set: I18nSet<"hello"> = valid;
  return set;
}
