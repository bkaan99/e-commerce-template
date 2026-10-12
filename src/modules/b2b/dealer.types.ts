export type DealerStatus = "NONE" | "PENDING" | "APPROVED" | "REJECTED";

export interface DealerProfile {
  userId: string;
  status: DealerStatus;
  groupId: string | null;
  groupName: string | null;
  companyName: string | null;
  taxNumber: string | null;
  taxOffice: string | null;
  /** Vadeli ödeme kredi limiti; null ise vadeli ödeme kapalıdır */
  creditLimit: string | null;
  minOrderAmount: string | null;
  note: string | null;
  approvedAt: Date | null;
}

export interface DealerApplicationRow {
  userId: string;
  name: string;
  email: string;
  phone: string | null;
  status: DealerStatus;
  companyName: string | null;
  taxNumber: string | null;
  taxOffice: string | null;
  groupId: string | null;
  groupName: string | null;
  creditLimit: string | null;
  minOrderAmount: string | null;
  note: string | null;
  createdAt: Date;
}

export interface DealerApplicationInput {
  companyName: string;
  taxNumber: string;
  taxOffice: string;
}

export interface DealerApprovalInput {
  groupId: string;
  creditLimit: number | null;
  minOrderAmount: number | null;
}
