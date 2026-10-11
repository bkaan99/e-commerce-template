import { projectConfig } from "./project-config";

/** Tema belirteçleri (design tokens). Müşteriye göre bu dosya değiştirilir. */
export interface Theme {
  colors: {
    primary: string;
    primaryForeground: string;
    background: string;
    foreground: string;
    muted: string;
    mutedForeground: string;
    border: string;
    accent: string;
  };
  radius: string;
}

const defaultTheme: Theme = {
  colors: {
    primary: "#111827",
    primaryForeground: "#ffffff",
    background: "#ffffff",
    foreground: "#171717",
    muted: "#f4f4f5",
    mutedForeground: "#71717a",
    border: "#e4e4e7",
    accent: "#2563eb",
  },
  radius: "0.5rem",
};

export const theme: Theme = {
  ...defaultTheme,
  colors: { ...defaultTheme.colors, ...projectConfig.theme?.colors },
};

function toKebabCase(value: string): string {
  return value.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

/** Temayı `:root` CSS değişkenlerine çevirir. */
export function themeToCss(source: Theme = theme): string {
  const colorVars = Object.entries(source.colors).map(
    ([name, value]) => `--${toKebabCase(name)}: ${value};`,
  );

  return `:root{${colorVars.join("")}--radius: ${source.radius};}`;
}
