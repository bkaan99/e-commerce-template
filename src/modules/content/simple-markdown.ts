/**
 * Sayfa içeriği için güvenli, küçük bir işaretleme dili. HTML üretmez;
 * bloklar ve satır içi parçalar döndürür, bileşen bunları React öğesi olarak
 * çizer (XSS yüzeyi yoktur). Desteklenenler: # başlık, ## alt başlık, - liste,
 * boş satırla ayrılan paragraflar, **kalın**, [metin](adres).
 */
export type Inline =
  | { type: "text"; text: string }
  | { type: "bold"; text: string }
  | { type: "link"; text: string; href: string };

export type Block =
  | { type: "heading"; level: 1 | 2; inlines: Inline[] }
  | { type: "paragraph"; inlines: Inline[] }
  | { type: "list"; items: Inline[][] };

/** Yalnızca http(s) ve site içi (/) adreslere izin verir. */
export function isSafeHref(href: string): boolean {
  return /^(https?:\/\/|\/(?!\/))/.test(href);
}

const INLINE_PATTERN = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;

export function parseInline(text: string): Inline[] {
  const result: Inline[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(INLINE_PATTERN)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      result.push({ type: "text", text: text.slice(lastIndex, index) });
    }

    if (match[1] !== undefined) {
      result.push({ type: "bold", text: match[1] });
    } else if (match[2] !== undefined && match[3] !== undefined) {
      // Güvenli olmayan adres düz metin olarak bırakılır.
      result.push(
        isSafeHref(match[3])
          ? { type: "link", text: match[2], href: match[3] }
          : { type: "text", text: match[2] },
      );
    }

    lastIndex = index + match[0].length;
  }

  if (lastIndex < text.length) {
    result.push({ type: "text", text: text.slice(lastIndex) });
  }

  return result;
}

export function parseSimpleMarkdown(source: string): Block[] {
  const blocks: Block[] = [];
  const lines = source.replace(/\r\n?/g, "\n").split("\n");

  let paragraph: string[] = [];
  let list: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length > 0) {
      blocks.push({
        type: "paragraph",
        inlines: parseInline(paragraph.join(" ")),
      });
      paragraph = [];
    }
  };
  const flushList = () => {
    if (list.length > 0) {
      blocks.push({ type: "list", items: list.map(parseInline) });
      list = [];
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (line === "") {
      flushParagraph();
      flushList();
      continue;
    }

    const heading = /^(#{1,2})\s+(.+)$/.exec(line);
    if (heading) {
      flushParagraph();
      flushList();
      blocks.push({
        type: "heading",
        level: heading[1]!.length === 1 ? 1 : 2,
        inlines: parseInline(heading[2]!),
      });
      continue;
    }

    const item = /^[-*]\s+(.+)$/.exec(line);
    if (item) {
      flushParagraph();
      list.push(item[1]!);
      continue;
    }

    flushList();
    paragraph.push(line);
  }

  flushParagraph();
  flushList();
  return blocks;
}
