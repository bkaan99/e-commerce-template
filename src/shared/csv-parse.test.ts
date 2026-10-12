import { describe, expect, it } from "vitest";
import { toCsv } from "./csv";
import { parseCsv, parseCsvRecords } from "./csv-parse";

describe("parseCsv", () => {
  it("noktalı virgül ayracını ve BOM'u tanır", () => {
    expect(parseCsv("﻿a;b\r\n1;2\r\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("virgül ve sekme ayraçlarını tespit eder", () => {
    expect(parseCsv("a,b\n1,2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
    expect(parseCsv("a\tb\n1\t2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("tırnaklı alanlarda ayraç, satır sonu ve çift tırnak korunur", () => {
    expect(parseCsv('a;b\n"x;y";"satır\n2 ""q"""')).toEqual([
      ["a", "b"],
      ["x;y", 'satır\n2 "q"'],
    ]);
  });

  it("boş satırları atlar ve sonda satır sonu olmayan dosyayı okur", () => {
    expect(parseCsv("a;b\n\n1;2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("toCsv çıktısı geri okunabilir (gidiş-dönüş)", () => {
    const csv = toCsv(
      ["ad", "not"],
      [
        ["A;B", 'x "y"'],
        ["çay", ""],
      ],
    );
    expect(parseCsv(csv)).toEqual([
      ["ad", "not"],
      ["A;B", 'x "y"'],
      ["çay", ""],
    ]);
  });
});

describe("parseCsvRecords", () => {
  it("başlıklara göre kayıt üretir; eksik hücreler boş olur", () => {
    const { records } = parseCsvRecords("sku;fiyat\nA;10\nB", (h) =>
      h.toLowerCase(),
    );
    expect(records).toEqual([
      { sku: "A", fiyat: "10" },
      { sku: "B", fiyat: "" },
    ]);
  });
});
