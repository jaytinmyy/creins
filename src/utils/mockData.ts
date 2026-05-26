import { Customer, InstallmentPlan, AuditLog } from '../types';
import { calculateInstallmentPlan } from './calc';

// Pre-generated mock imagery using elegant inline SVG representations or base64
export const mockICPlaceholder = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='320' height='200' viewBox='0 0 320 200'><rect width='320' height='200' rx='12' fill='%231e293b'/><rect x='15' y='15' width='290' height='170' rx='8' fill='%230f172a' stroke='%2338bdf8' stroke-width='2'/><circle cx='60' cy='100' r='35' fill='%23334155'/><path d='M35 150 C 35 115, 85 115, 85 150 Z' fill='%2364748b'/><rect x='120' y='50' width='160' height='15' rx='4' fill='%2338bdf8' opacity='0.8'/><rect x='120' y='80' width='120' height='10' rx='3' fill='%2364748b'/><rect x='120' y='100' width='140' height='10' rx='3' fill='%2364748b'/><rect x='120' y='120' width='100' height='10' rx='3' fill='%2364748b'/><text x='15' y='180' fill='%2338bdf8' font-family='monospace' font-size='10'>MALAYSIA IDENTITY CARD</text></svg>";

export const mockProofPlaceholder = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='320' height='200' viewBox='0 0 320 200'><rect width='320' height='200' rx='12' fill='%230f172a' stroke='%2322c55e' stroke-width='2'/><path d='M30 40 L290 40' stroke='%23334155' stroke-width='2'/><rect x='30' y='15' width='100' height='15' rx='3' fill='%2322c55e' opacity='0.3'/><rect x='30' y='60' width='200' height='10' rx='3' fill='%23475569'/><rect x='30' y='80' width='260' height='10' rx='3' fill='%23475569'/><rect x='30' y='100' width='240' height='10' rx='3' fill='%23475569'/><rect x='30' y='125' width='120' height='20' rx='4' fill='%2310b981' opacity='0.8'/><circle cx='250' cy='140' r='25' fill='%2322c55e' opacity='0.15'/><text x='250' y='145' fill='%2322c55e' font-family='sans-serif' font-weight='bold' font-size='12' text-anchor='middle'>VERIFIED</text></svg>";

const getPastFutureDate = (monthsOffset: number) => {
  const d = new Date();
  d.setMonth(d.getMonth() + monthsOffset);
  return d.toISOString().split('T')[0];
};

export const INITIAL_CUSTOMERS: Customer[] = [
  {
    id: 'cust-1',
    name: 'Nicholas Tan Hock Seng',
    icNumber: '890422-14-5339',
    phoneNumber: '+6012-3456789',
    code: 'CN-2026-0001',
    icImage: mockICPlaceholder,
    proofImage: mockProofPlaceholder,
    startDate: getPastFutureDate(-2), // Started 2 months ago
    endDate: getPastFutureDate(4),    // Ends in 4 months
    active: true,
    guarantorName: 'Tan Hock Lye',
    guarantorIcNumber: '610214-14-5117',
    guarantorPhoneNumber: '+6012-3488991',
    guarantorRelation: 'Father (父亲)',
  },
  {
    id: 'cust-2',
    name: 'Muhammad Farhan Bin Ali',
    icNumber: '921105-10-5221',
    phoneNumber: '+6017-9876543',
    code: 'CN-2026-0002',
    icImage: mockICPlaceholder,
    proofImage: mockProofPlaceholder,
    startDate: getPastFutureDate(-3), // Started 3 months ago
    endDate: getPastFutureDate(1),    // Ends in 1 month
    active: true,
    guarantorName: 'Fatimah Binti Hussein',
    guarantorIcNumber: '950815-10-6112',
    guarantorPhoneNumber: '+6019-2234551',
    guarantorRelation: 'Spouse (配偶)',
  },
  {
    id: 'cust-3',
    name: 'Saraswathy Pillay',
    icNumber: '950812-08-3342',
    phoneNumber: '+6016-5554321',
    code: 'CN-2026-0003',
    icImage: mockICPlaceholder,
    proofImage: mockProofPlaceholder,
    startDate: getPastFutureDate(-1),
    endDate: getPastFutureDate(11),
    active: false, // Inactive Customer
    guarantorName: 'Ramanathan Pillay',
    guarantorIcNumber: '680412-08-5113',
    guarantorPhoneNumber: '+6016-1123445',
    guarantorRelation: 'Brother (兄弟)',
  },
  {
    id: 'cust-4',
    name: 'Alvin Lim Kok Wah',
    icNumber: '900315-07-2911',
    phoneNumber: '+6011-2223344',
    code: 'CN-2026-0004',
    icImage: mockICPlaceholder,
    proofImage: mockProofPlaceholder,
    startDate: getPastFutureDate(-5),
    endDate: getPastFutureDate(-1), // Finished yesterday/last month
    active: true,
    guarantorName: 'Lim Kok Seng',
    guarantorIcNumber: '870412-07-5551',
    guarantorPhoneNumber: '+6011-3344556',
    guarantorRelation: 'Brother (兄弟)',
  },
];

// Seed initial plans
export const INITIAL_PLANS: InstallmentPlan[] = [
  // Nicholas Tan Hock Seng's 6-month installment
  {
    id: 'plan-1',
    customerId: 'cust-1',
    input: {
      principalAmount: 10000,
      months: 6,
      interestType: 'flat',
      interestRatePercent: 5, // 5% flat fee = RM 500
      serviceFeeType: 'percent',
      serviceFeeValue: 2, // 2% service fee = RM 200
      discountType: 'fixed',
      discountValue: 100, // RM 100 discount
      penaltyFeeAmount: 500,
      latePaymentFeeType: 'daily',
      latePaymentFeeValue: 10, // RM 10/day
      adjustmentMode: 'equal'
    },
    finalPayable: 10600, // 10000 + 500 (interest) + 200 (service) - 100 (discount)
    totalInterest: 500,
    totalServiceFee: 200,
    totalDiscount: 100,
    createdAt: new Date().toISOString(),
    schedule: [] // will build programmatically in State to match dates
  },
  // Muhammad Farhan's 4-month early heavy installment
  {
    id: 'plan-2',
    customerId: 'cust-2',
    input: {
      principalAmount: 5000,
      months: 4,
      interestType: 'monthly',
      interestRatePercent: 1.5, // 1.5% * 4 months = 6% = RM 300
      serviceFeeType: 'fixed',
      serviceFeeValue: 150, // RM 150 service fee
      discountType: 'percent',
      discountValue: 1, // 1% discount = RM 50
      penaltyFeeAmount: 300,
      latePaymentFeeType: 'fixed_percent',
      latePaymentFeeValue: 5, // 5% of installment amount per month late
      adjustmentMode: 'early_heavy'
    },
    finalPayable: 5400, // 5000 + 300 (interest) + 150 (service) - 50 (discount)
    totalInterest: 300,
    totalServiceFee: 150,
    totalDiscount: 50,
    createdAt: new Date().toISOString(),
    schedule: []
  },
  // Alvin Lim's completed installment
  {
    id: 'plan-4',
    customerId: 'cust-4',
    input: {
      principalAmount: 4000,
      months: 3,
      interestType: 'flat',
      interestRatePercent: 3, // RM 120
      serviceFeeType: 'fixed',
      serviceFeeValue: 50, // RM 50
      discountType: 'fixed',
      discountValue: 0,
      penaltyFeeAmount: 200,
      latePaymentFeeType: 'daily',
      latePaymentFeeValue: 10,
      adjustmentMode: 'equal'
    },
    finalPayable: 4170,
    totalInterest: 120,
    totalServiceFee: 50,
    totalDiscount: 0,
    createdAt: new Date().toISOString(),
    schedule: []
  }
];

export const INITIAL_AUDIT_LOGS: AuditLog[] = [
  {
    id: 'log-1',
    timestamp: '2026-05-20T08:30:00Z',
    userRole: 'Admin',
    userEmail: 'admin@finance.my',
    action: 'CREATE_CUSTOMER',
    details: 'Created customer Nicholas Tan Hock Seng (CN-2026-0001)'
  },
  {
    id: 'log-2',
    timestamp: '2026-05-20T08:35:00Z',
    userRole: 'Admin',
    userEmail: 'admin@finance.my',
    action: 'GENERATE_PLAN',
    details: 'Generated 6-Month installment schedule for CN-2026-0001 (Final Payable: RM 10,600.00)'
  },
  {
    id: 'log-3',
    timestamp: '2026-05-20T09:12:00Z',
    userRole: 'Staff',
    userEmail: 'farah.staff@finance.my',
    action: 'CREATE_CUSTOMER',
    details: 'Created customer Muhammad Farhan Bin Ali (CN-2026-0002)'
  },
  {
    id: 'log-4',
    timestamp: '2026-05-20T09:18:00Z',
    userRole: 'Staff',
    userEmail: 'farah.staff@finance.my',
    action: 'GENERATE_PLAN',
    details: 'Generated 4-Month (Early Heavy) schedule for CN-2026-0002 (Final Payable: RM 5,400.00)'
  },
  {
    id: 'log-5',
    timestamp: '2026-05-21T04:20:00Z',
    userRole: 'Staff',
    userEmail: 'farah.staff@finance.my',
    action: 'UPDATE_CUSTOMER_STATUS',
    details: 'Set Saraswathy Pillay (CN-2026-0003) as Inactive'
  }
];
