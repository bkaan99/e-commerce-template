import Link from "next/link";
import {
  parseSimpleMarkdown,
  type Block,
  type Inline,
} from "@/modules/content/simple-markdown";

function Inlines({ items }: { items: Inline[] }) {
  return (
    <>
      {items.map((item, index) => {
        if (item.type === "bold")
          return <strong key={index}>{item.text}</strong>;
        if (item.type === "link") {
          const external = item.href.startsWith("http");
          return external ? (
            <a
              key={index}
              href={item.href}
              className="underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              {item.text}
            </a>
          ) : (
            <Link key={index} href={item.href} className="underline">
              {item.text}
            </Link>
          );
        }
        return <span key={index}>{item.text}</span>;
      })}
    </>
  );
}

function BlockView({ block }: { block: Block }) {
  switch (block.type) {
    case "heading":
      return block.level === 1 ? (
        <h2 className="mt-6 text-xl font-semibold">
          <Inlines items={block.inlines} />
        </h2>
      ) : (
        <h3 className="mt-4 text-lg font-semibold">
          <Inlines items={block.inlines} />
        </h3>
      );
    case "list":
      return (
        <ul className="list-disc pl-6">
          {block.items.map((item, index) => (
            <li key={index}>
              <Inlines items={item} />
            </li>
          ))}
        </ul>
      );
    case "paragraph":
      return (
        <p>
          <Inlines items={block.inlines} />
        </p>
      );
  }
}

/** Yönetim panelinden girilen metni güvenli biçimde (HTML basmadan) gösterir. */
export function RichText({ source }: { source: string }) {
  const blocks = parseSimpleMarkdown(source);

  return (
    <div className="flex flex-col gap-3 leading-7">
      {blocks.map((block, index) => (
        <BlockView key={index} block={block} />
      ))}
    </div>
  );
}
