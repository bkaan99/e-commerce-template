import Decimal from "decimal.js";
import { toDecimal } from "@/shared/money";

export interface PeriodTotals {
  revenue: Decimal;
  orderCount: number;
}

export interface TopProduct {
  name: string;
  quantity: number;
  revenue: string;
}

export interface LowStockItem {
  productName: string;
  sku: string;
  available: number;
}

export interface StockDemandItem {
  productName: string;
  sku: string;
  waiting: number;
}

export interface CustomerMetrics {
  /** Dönemde kayıt olan müşteri sayısı */
  newCustomers: number;
  /** Dönemde sipariş veren benzersiz üye sayısı */
  buyers: number;
  /** Bunlardan daha önce de sipariş vermiş olanlar */
  returningBuyers: number;
}

export interface DashboardData {
  periodDays: number;
  customers: CustomerMetrics & {
    newChangePercent: number | null;
    /** Tekrar alışveriş yapan üye oranı (%), alıcı yoksa null */
    returningRate: number | null;
  };
  revenue: { current: string; previous: string; changePercent: number | null };
  orders: { current: number; previous: number; changePercent: number | null };
  averageOrderValue: string;
  topProducts: TopProduct[];
  attention: {
    ordersToProcess: number;
    openReturnRequests: number;
    pendingDealers: number;
    lowStock: LowStockItem[];
  };
  stockDemand: StockDemandItem[];
}

export interface ReportingRepository {
  periodTotals(from: Date, to: Date): Promise<PeriodTotals>;
  topProducts(from: Date, to: Date, limit: number): Promise<TopProduct[]>;
  countOrdersToProcess(): Promise<number>;
  countOpenReturnRequests(): Promise<number>;
  countPendingDealers(): Promise<number>;
  lowStock(threshold: number, limit: number): Promise<LowStockItem[]>;
  stockDemand(limit: number): Promise<StockDemandItem[]>;
  customerMetrics(from: Date, to: Date): Promise<CustomerMetrics>;
}

/** Önceki döneme göre yüzde değişim; önceki dönem 0 ise karşılaştırılamaz (null). */
export function percentChange(
  current: Decimal.Value,
  previous: Decimal.Value,
): number | null {
  const prev = toDecimal(previous);
  if (prev.isZero()) return null;
  return toDecimal(current)
    .minus(prev)
    .dividedBy(prev)
    .times(100)
    .toDecimalPlaces(1)
    .toNumber();
}

const DAY_MS = 24 * 60 * 60 * 1000;

export class ReportingService {
  constructor(
    private readonly repository: ReportingRepository,
    private readonly lowStockThreshold: number,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async dashboard(periodDays = 30): Promise<DashboardData> {
    const end = this.now();
    const start = new Date(end.getTime() - periodDays * DAY_MS);
    const previousStart = new Date(start.getTime() - periodDays * DAY_MS);

    const [
      current,
      previous,
      topProducts,
      ordersToProcess,
      openReturnRequests,
      pendingDealers,
      lowStock,
      stockDemand,
      customers,
      previousCustomers,
    ] = await Promise.all([
      this.repository.periodTotals(start, end),
      this.repository.periodTotals(previousStart, start),
      this.repository.topProducts(start, end, 5),
      this.repository.countOrdersToProcess(),
      this.repository.countOpenReturnRequests(),
      this.repository.countPendingDealers(),
      this.repository.lowStock(this.lowStockThreshold, 10),
      this.repository.stockDemand(5),
      this.repository.customerMetrics(start, end),
      this.repository.customerMetrics(previousStart, start),
    ]);

    const average =
      current.orderCount === 0
        ? toDecimal(0)
        : current.revenue.dividedBy(current.orderCount);

    return {
      periodDays,
      customers: {
        ...customers,
        newChangePercent: percentChange(
          customers.newCustomers,
          previousCustomers.newCustomers,
        ),
        returningRate:
          customers.buyers === 0
            ? null
            : Math.round(
                (customers.returningBuyers / customers.buyers) * 1000,
              ) / 10,
      },
      revenue: {
        current: current.revenue.toFixed(2),
        previous: previous.revenue.toFixed(2),
        changePercent: percentChange(current.revenue, previous.revenue),
      },
      orders: {
        current: current.orderCount,
        previous: previous.orderCount,
        changePercent: percentChange(current.orderCount, previous.orderCount),
      },
      averageOrderValue: average.toFixed(2),
      topProducts,
      attention: {
        ordersToProcess,
        openReturnRequests,
        pendingDealers,
        lowStock,
      },
      stockDemand,
    };
  }
}

/** Panoda seçilebilen dönemler (gün). */
export const REPORT_PERIODS = [7, 30, 90, 365] as const;
export const DEFAULT_REPORT_PERIOD = 30;

/** Sorgu dizgesinden gelen değeri izinli dönemlerden birine çevirir. */
export function parseReportPeriod(value: string | undefined): number {
  const parsed = Number(value);
  return (REPORT_PERIODS as readonly number[]).includes(parsed)
    ? parsed
    : DEFAULT_REPORT_PERIOD;
}
