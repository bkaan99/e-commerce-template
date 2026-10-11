import { describe, expect, it } from "vitest";
import { escapeCsvCell, toCsv } from "./csv";

describe("escapeCsvCell", () => {
  it("özel karakter içeren hücreyi tırnaklar ve tırnağı çiftler", () => {
    expect(escapeCsvCell("a;b")).toBe('"a;b"');
    expect(escapeCsvCell('"x"')).toBe('"""x"""');
    expect(escapeCsvCell("satır\nsonu")).toBe('"satır\nsonu"');
  });

  it("formül başlangıcını etkisizleştirir", () => {
    expect(escapeCsvCell("=1+1")).toBe("'=1+1");
    expect(escapeCsvCell("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(escapeCsvCell("-5")).toBe("'-5");
  });

  it("sayı ve boş değerleri doğru yazar", () => {
    expect(escapeCsvCell(12.5)).toBe("12.5");
    expect(escapeCsvCell(null)).toBe("");
    expect(escapeCsvCell(undefined)).toBe("");
  });

  it("tarihi ISO biçiminde yazar", () => {
    expect(escapeCsvCell(new Date("2026-01-02T03:04:05Z"))).toBe(
      "2026-01-02T03:04:05.000Z",
    );
  });
});

describe("toCsv", () => {
  it("BOM, başlık ve satırları üretir", () => {
    const csv = toCsv(["Ad", "Adet"], [["Tişört", 2]]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toBe("﻿Ad;Adet\r\nTişört;2\r\n");
  });
});
