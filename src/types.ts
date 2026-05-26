export interface Customer {
  id: string;
  name: string;
  icNumber: string;
  phoneNumber: string;
  code: string; // CN-2026-0001 format
  icImage: string; // URL or base64 data
  proofImage: string; // URL or base64 data
  startDate: string;
  endDate: string;
  active: boolean; // instead of deleting, toggle active/inactive
  guarantorName: string;
  guarantorIcNumber: string;
  guarantorPhoneNumber: string;
  guarantorRelation: string;
}

export type InterestType = 'flat' | 'monthly';
export type PaymentAdjustmentMode = 'equal' | 'early_heavy';

export interface InstallmentPlanInput {
  principalAmount: number;
  months: number;
  interestType: InterestType;
  interestRatePercent: number;
  serviceFeeType: 'percent' | 'fixed';
  serviceFeeValue: number;
  discountType: 'percent' | 'fixed';
  discountValue: number;
  penaltyFeeAmount: number; // Applied if not finished by end date
  latePaymentFeeType: 'daily' | 'fixed_percent';
  latePaymentFeeValue: number; // e.g., RM 5/day or 2% fixed
  adjustmentMode: PaymentAdjustmentMode;
  downpaymentPercent?: number;
}

export interface RepaymentInstallment {
  monthNumber: number;
  dueDate: string;
  amount: number;
  principalShare: number;
  interestShare: number;
  serviceFeeShare: number;
  balance: number;
  status: 'Paid' | 'Unpaid' | 'Overdue';
  overdueDays: number;
  lateFeeCharged: number;
  paidDate?: string;
  paidAmount?: number; // Repaid partially so far in that month
}

export interface ExtraFeeItem {
  id: string;
  amount: number;
  reason: string;
  date: string;
}

export interface InstallmentPlan {
  id: string;
  customerId: string;
  input: InstallmentPlanInput;
  finalPayable: number;
  totalInterest: number;
  totalServiceFee: number;
  totalDiscount: number;
  schedule: RepaymentInstallment[];
  createdAt: string;
  extraFees?: ExtraFeeItem[]; // Extra custom added fees
}

export interface AuditLog {
  id: string;
  timestamp: string;
  userRole: 'Admin' | 'Staff' | 'Viewer';
  userEmail: string;
  action: string;
  details: string;
}

export type UserRole = 'Admin' | 'Staff' | 'Viewer';
