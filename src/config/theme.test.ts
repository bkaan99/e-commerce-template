import { describe, expect, it } from "vitest";
import { theme, themeToCss } from "./theme";

describe("themeToCss", () => {
  it("renkleri kebab-case CSS değişkenlerine çevirir", () => {
    const css = themeToCss(theme);
    expect(css).toContain("--primary-foreground: #ffffff;");
    expect(css).toContain("--muted-foreground:");
    expect(css).toContain("--radius: 0.5rem;");
    expect(css.startsWith(":root{")).toBe(true);
  });
});
