import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import {
  ReportingService,
  parseReportPeriod,
  percentChange,
  type ReportingRepository,
} from "./reporting.service";

describe("percentChange", () => {
  it("artışı ve azalışı hesaplar", () => {
    expect(percentChange(150, 100)).toBe(50);
    expect(percentChange(50, 100)).toBe(-50);
  });

  it("önceki dönem sıfırsa karşılaştırılamaz", () => {
    expect(percentChange(100, 0)).toBeNull();
  });

  it("tek ondalığa yuvarlar", () => {
    expect(percentChange(133.33, 100)).toBe(33.3);
  });
});

describe("ReportingService.dashboard", () => {
  const repo = (
    current: [string, number],
    previous: [string, number],
  ): ReportingRepository => {
    const calls: { from: Date; to: Date }[] = [];
    return {
      periodTotals: async (from, to) => {
        calls.push({ from, to });
        const [revenue, orderCount] = calls.length === 1 ? current : previous;
        return { revenue: new Decimal(revenue), orderCount };
      },
      topProducts: async () => [
        { name: "Tişört", quantity: 3, revenue: "900.00" },
      ],
      countOrdersToProcess: async () => 4,
      countOpenReturnRequests: async () => 1,
      countPendingDealers: async () => 2,
      lowStock: async () => [
        { productName: "Cüzdan", sku: "C-1", available: 2 },
      ],
      stockDemand: async () => [],
      customerMetrics: async () => ({
        newCustomers: 6,
        buyers: 8,
        returningBuyers: 3,
      }),
    };
  };

  it("dönemleri karşılaştırır ve ortalama sepet tutarını hesaplar", async () => {
    const service = new ReportingService(
      repo(["3000.00", 6], ["2000.00", 4]),
      5,
      () => new Date("2026-06-30T00:00:00Z"),
    );

    const data = await service.dashboard(30);

    expect(data.revenue).toEqual({
      current: "3000.00",
      previous: "2000.00",
      changePercent: 50,
    });
    expect(data.orders).toEqual({ current: 6, previous: 4, changePercent: 50 });
    expect(data.averageOrderValue).toBe("500.00");
    expect(data.attention).toMatchObject({
      ordersToProcess: 4,
      openReturnRequests: 1,
      pendingDealers: 2,
    });
  });

  it("siparişsiz dönemde ortalama sıfırdır", async () => {
    const service = new ReportingService(repo(["0", 0], ["0", 0]), 5);
    expect((await service.dashboard()).averageOrderValue).toBe("0.00");
  });
});

describe("parseReportPeriod", () => {
  it("izinli dönemleri kabul eder, diğerlerini varsayılana çevirir", () => {
    expect(parseReportPeriod("7")).toBe(7);
    expect(parseReportPeriod("365")).toBe(365);
    expect(parseReportPeriod("15")).toBe(30);
    expect(parseReportPeriod(undefined)).toBe(30);
    expect(parseReportPeriod("abc")).toBe(30);
  });
});
