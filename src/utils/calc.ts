import { Customer, InstallmentPlan, InstallmentPlanInput, RepaymentInstallment } from '../types';

// Helper to format currency
export function formatRM(amount: number): string {
  return `RM ${amount.toFixed(2)}`;
}

// Generate unique code in format CRE-[6 random alphanumeric]-jaytin
export function generateCustomerCode(index?: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let rand = '';
  for (let i = 0; i < 6; i++) {
    rand += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `CRE-${rand}-jaytin`;
}

// Calculate the installment breakdown
export function calculateInstallmentPlan(
  customerId: string,
  input: InstallmentPlanInput,
  startDateStr: string
): Omit<InstallmentPlan, 'id' | 'createdAt'> {
  const {
    principalAmount,
    months,
    interestType,
    interestRatePercent,
    serviceFeeType,
    serviceFeeValue,
    discountType,
    discountValue,
    penaltyFeeAmount,
    latePaymentFeeType,
    latePaymentFeeValue,
    adjustmentMode,
    downpaymentPercent = 0,
  } = input;

  const pct = downpaymentPercent || 0;
  const downpaymentAmount = principalAmount * (pct / 100);
  const financedPrincipal = principalAmount - downpaymentAmount;

  // 1. Calculate Interest based on financedPrincipal
  let totalInterest = 0;
  if (interestType === 'flat') {
    totalInterest = financedPrincipal * (interestRatePercent / 100);
  } else {
    // Monthly Interest (accumulative simple rate for duration)
    totalInterest = financedPrincipal * (interestRatePercent / 100) * months;
  }

  // 2. Calculate Service Fee based on financedPrincipal
  let totalServiceFee = 0;
  if (serviceFeeType === 'fixed') {
    totalServiceFee = serviceFeeValue;
  } else {
    totalServiceFee = financedPrincipal * (serviceFeeValue / 100);
  }

  // 3. Calculate Discount based on financedPrincipal
  let totalDiscount = 0;
  if (discountType === 'fixed') {
    totalDiscount = discountValue;
  } else {
    totalDiscount = financedPrincipal * (discountValue / 100);
  }

  // Final Financed portion before conditional fines
  const finalPayableFinanced = Math.max(0, financedPrincipal + totalInterest + totalServiceFee - totalDiscount);
  const aggregatePayable = downpaymentAmount + finalPayableFinanced;

  // Generate monthly schedules
  const schedule: RepaymentInstallment[] = [];
  const baseDate = new Date(startDateStr || new Date().toISOString().split('T')[0]);

  let currentCumulativeBill = 0;

  // Month 0 Downpayment (if any)
  if (downpaymentAmount > 0) {
    currentCumulativeBill += downpaymentAmount;
    schedule.push({
      monthNumber: 0,
      dueDate: startDateStr || new Date().toISOString().split('T')[0],
      amount: Math.round(downpaymentAmount * 100) / 100,
      principalShare: Math.round(downpaymentAmount * 100) / 100,
      interestShare: 0,
      serviceFeeShare: 0,
      balance: Math.round((aggregatePayable - downpaymentAmount) * 100) / 100,
      status: 'Unpaid',
      overdueDays: 0,
      lateFeeCharged: 0,
    });
  }

  // Determine monthly weights for linear distribution
  const weights: number[] = [];
  if (adjustmentMode === 'early_heavy' && months > 1) {
    for (let i = 1; i <= months; i++) {
      // Linear slope from 1.5 down to 0.5
      const weight = 1.6 - ((i - 1) / (months - 1)) * 1.2;
      weights.push(weight);
    }
  } else {
    for (let i = 1; i <= months; i++) {
      weights.push(1.0);
    }
  }

  const sumWeights = weights.reduce((sum, w) => sum + w, 0);

  let accumulatedPrincipal = 0;
  let accumulatedInterest = 0;
  let accumulatedServiceFee = 0;
  let accumulatedAmount = 0;

  for (let i = 1; i <= months; i++) {
    const weight = weights[i - 1];
    const weightRatio = weight / sumWeights;

    // Due date (add i months)
    const dueDate = new Date(baseDate);
    dueDate.setMonth(baseDate.getMonth() + i);
    const dueDateStr = dueDate.toISOString().split('T')[0];

    // Compute monthly shares with preliminary rounding
    // For interest and service fee, distribute evenly (fixed every month as requested)
    let monthlyInterestShare = Math.round((totalInterest / months) * 100) / 100;
    let monthlyServiceFeeShare = Math.round((totalServiceFee / months) * 100) / 100;

    // Principal portion remains distributed by dynamic weighting
    let monthlyPrincipalShare = Math.round(financedPrincipal * weightRatio * 100) / 100;

    // Direct monthly installment is the sum of components
    let monthlyAmount = Math.round((monthlyPrincipalShare + monthlyInterestShare + monthlyServiceFeeShare) * 100) / 100;

    // Adjust in final month to eliminate rounding errors
    if (i === months) {
      monthlyPrincipalShare = Math.max(0, Math.round((financedPrincipal - accumulatedPrincipal) * 100) / 100);
      monthlyInterestShare = Math.max(0, Math.round((totalInterest - accumulatedInterest) * 100) / 100);
      monthlyServiceFeeShare = Math.max(0, Math.round((totalServiceFee - accumulatedServiceFee) * 100) / 100);
      monthlyAmount = Math.max(0, Math.round((finalPayableFinanced - accumulatedAmount) * 100) / 100);
    } else {
      accumulatedAmount += monthlyAmount;
      accumulatedPrincipal += monthlyPrincipalShare;
      accumulatedInterest += monthlyInterestShare;
      accumulatedServiceFee += monthlyServiceFeeShare;
    }

    currentCumulativeBill += monthlyAmount;
    let balance = aggregatePayable - currentCumulativeBill;
    if (i === months) {
      balance = 0;
    }

    schedule.push({
      monthNumber: i,
      dueDate: dueDateStr,
      amount: monthlyAmount,
      principalShare: monthlyPrincipalShare,
      interestShare: monthlyInterestShare,
      serviceFeeShare: monthlyServiceFeeShare,
      balance: Math.max(0, Math.round(balance * 100) / 100),
      status: 'Unpaid',
      overdueDays: 0,
      lateFeeCharged: 0,
    });
  }

  return {
    customerId,
    input,
    finalPayable: aggregatePayable,
    totalInterest,
    totalServiceFee,
    totalDiscount,
    schedule,
  };
}

// Compute late fees and overall penalty status based on a given simulation date (default = today)
export function evaluateSchedulesWithFines(
  plan: InstallmentPlan,
  customer: Customer,
  simulationDateStr: string
): {
  updatedSchedule: RepaymentInstallment[];
  hasOverdueInstallments: boolean;
  totalLateFees: number;
  overallPenaltyApplied: boolean;
  overallPenaltyAmount: number;
  overallFinalAmount: number;
} {
  const simDate = new Date(simulationDateStr);
  const endDate = new Date(customer.endDate);
  let hasOverdueInstallments = false;
  let totalLateFees = 0;

  // 1. Process installments late fees
  const updatedSchedule = plan.schedule.map((installment) => {
    const isCurrentlyPaid = installment.status === 'Paid';
    const dueAmount = installment.amount;
    
    const dueDate = new Date(installment.dueDate);
    let overdueDays = 0;
    let lateFeeCharged = 0;

    if (simDate > dueDate) {
      // calculate difference in days
      const diffTime = Math.abs(simDate.getTime() - dueDate.getTime());
      overdueDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      // Calculate Late Fee based on policy
      if (plan.input.latePaymentFeeType === 'daily') {
        lateFeeCharged = overdueDays * plan.input.latePaymentFeeValue;
      } else {
        // fixed percent of installment amount
        lateFeeCharged = installment.amount * (plan.input.latePaymentFeeValue / 100);
      }
    }

    const currentPaidAmount = installment.paidAmount !== undefined 
      ? installment.paidAmount 
      : (isCurrentlyPaid ? (dueAmount + lateFeeCharged) : 0);

    const totalDue = dueAmount + lateFeeCharged;
    let status: 'Paid' | 'Unpaid' | 'Overdue' = 'Unpaid';

    if (currentPaidAmount >= totalDue) {
      status = 'Paid';
    } else if (simDate > dueDate) {
      status = 'Overdue';
      hasOverdueInstallments = true;
      totalLateFees += lateFeeCharged;
    } else {
      status = 'Unpaid';
    }

    return {
      ...installment,
      status,
      overdueDays,
      lateFeeCharged: Math.round(lateFeeCharged * 100) / 100,
      paidAmount: Math.round(currentPaidAmount * 100) / 100,
    };
  });

  // 2. Process overall contract end-date breach penalty
  let overallPenaltyApplied = false;
  let overallPenaltyAmount = 0;

  const isFullyPaid = updatedSchedule.every((inst) => inst.status === 'Paid');

  if (simDate > endDate && !isFullyPaid) {
    overallPenaltyApplied = true;
    overallPenaltyAmount = plan.input.penaltyFeeAmount;
  }

  const basePayable = plan.finalPayable;
  const extraFeesTotal = plan.extraFees?.reduce((sum, f) => sum + f.amount, 0) ?? 0;
  const overallFinalAmount = basePayable + totalLateFees + overallPenaltyAmount + extraFeesTotal;

  return {
    updatedSchedule,
    hasOverdueInstallments,
    totalLateFees: Math.round(totalLateFees * 100) / 100,
    overallPenaltyApplied,
    overallPenaltyAmount,
    overallFinalAmount: Math.round(overallFinalAmount * 100) / 100,
  };
}
