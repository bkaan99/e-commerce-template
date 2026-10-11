import { tr } from "./messages/tr";

type Messages = typeof tr;

/** "grup.anahtar" biçimindeki tüm geçerli çeviri anahtarları. */
type MessageKey = {
  [Group in keyof Messages & string]: {
    [Key in keyof Messages[Group] & string]: `${Group}.${Key}`;
  }[keyof Messages[Group] & string];
}[keyof Messages & string];

type Params = Record<string, string | number>;

const catalogs = { tr } as const;

export type Locale = keyof typeof catalogs;
export const DEFAULT_LOCALE_KEY: Locale = "tr";

function lookup(messages: Messages, key: MessageKey): string {
  const [group, name] = key.split(".") as [keyof Messages, string];
  const entry = (messages[group] as Record<string, string>)[name];
  return entry ?? key;
}

/** Çeviri anahtarını metne çevirir; `{ad}` biçimindeki yer tutucuları doldurur. */
export function translate(
  key: MessageKey,
  params?: Params,
  locale: Locale = DEFAULT_LOCALE_KEY,
): string {
  const text = lookup(catalogs[locale], key);
  if (!params) return text;

  return text.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

export type { MessageKey };
