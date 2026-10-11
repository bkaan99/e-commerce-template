/** Yapılandırılmış veri (schema.org) çıktısı. `<` karakteri kaçırılarak XSS önlenir. */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}
