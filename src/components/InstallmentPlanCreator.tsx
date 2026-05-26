import React, { useState, useEffect } from 'react';
import { Customer, InstallmentPlanInput, UserRole, RepaymentInstallment } from '../types';
import { calculateInstallmentPlan, formatRM } from '../utils/calc';
import { Percent, DollarSign, Calendar, Eye, Compass, Save, RefreshCw, Sparkles, ShieldAlert } from 'lucide-react';

interface InstallmentPlanCreatorProps {
  customer: Customer;
  onSavePlan: (input: InstallmentPlanInput, customSchedule?: RepaymentInstallment[]) => void;
  role: UserRole;
  onClose: () => void;
  existingInput?: InstallmentPlanInput;
}

export const InstallmentPlanCreator: React.FC<InstallmentPlanCreatorProps> = ({
  customer,
  onSavePlan,
  role,
  onClose,
  existingInput,
}) => {
  const isReadOnly = role === 'Viewer';

  // State initialized with existing inputs if we are updating, or premium default presets
  const [inputs, setInputs] = useState<InstallmentPlanInput>({
    principalAmount: existingInput?.principalAmount ?? 5000,
    months: existingInput?.months ?? 6,
    interestType: existingInput?.interestType ?? 'flat',
    interestRatePercent: existingInput?.interestRatePercent ?? 5,
    serviceFeeType: existingInput?.serviceFeeType ?? 'percent',
    serviceFeeValue: existingInput?.serviceFeeValue ?? 2,
    discountType: existingInput?.discountType ?? 'fixed',
    discountValue: existingInput?.discountValue ?? 50,
    penaltyFeeAmount: existingInput?.penaltyFeeAmount ?? 350,
    latePaymentFeeType: existingInput?.latePaymentFeeType ?? 'daily',
    latePaymentFeeValue: existingInput?.latePaymentFeeValue ?? 10,
    adjustmentMode: existingInput?.adjustmentMode ?? 'equal',
    downpaymentPercent: existingInput?.downpaymentPercent ?? 10,
  });

  // Keep a local calculated result for live projection display
  const [projection, setProjection] = useState<{
    finalPayable: number;
    totalInterest: number;
    totalServiceFee: number;
    totalDiscount: number;
    schedule: RepaymentInstallment[];
  } | null>(null);

  // Local schedule state to allow customized amounts and auto-balancing overrides
  const [schedule, setSchedule] = useState<RepaymentInstallment[]>([]);

  // Auto-recalculate whenever inputs change
  useEffect(() => {
    const calc = calculateInstallmentPlan(customer.id, inputs, customer.startDate);
    setProjection({
      finalPayable: calc.finalPayable,
      totalInterest: calc.totalInterest,
      totalServiceFee: calc.totalServiceFee,
      totalDiscount: calc.totalDiscount,
      schedule: calc.schedule,
    });
    setSchedule(calc.schedule);
  }, [inputs, customer]);

  const handleUpdateProjectionInstallmentAmount = (monthNumber: number, newAmount: number) => {
    // 1. Calculate baseline target total we must match from the coefficients
    const calc = calculateInstallmentPlan(customer.id, inputs, customer.startDate);
    const targetTotal = calc.finalPayable;

    // 2. Put the manually requested newAmount into the schedule map
    const updatedBase = schedule.map((inst) => {
      if (inst.monthNumber === monthNumber) {
        return {
          ...inst,
          amount: newAmount,
        };
      }
      return { ...inst };
    });

    // 3. Find subsequent installments to absorb the difference
    const futureInstallments = updatedBase.filter((inst) => inst.monthNumber > monthNumber);

    let updatedSchedule = [...updatedBase];
    if (futureInstallments.length > 0) {
      // Sum everything up to and including the updated monthNumber
      const allocatedSum = updatedBase
        .filter((inst) => inst.monthNumber <= monthNumber)
        .reduce((sum, inst) => sum + inst.amount, 0);

      const remainingToDistribute = Math.max(0, targetTotal - allocatedSum);

      let distributedSum = 0;
      const numFuture = futureInstallments.length;

      updatedSchedule = updatedBase.map((inst) => {
        if (inst.monthNumber > monthNumber) {
          const isLastMonth = inst.monthNumber === updatedBase[updatedBase.length - 1].monthNumber;
          if (isLastMonth) {
            // The last month absorbs whatever is left to guarantee that targetTotal matches exactly
            return {
              ...inst,
              amount: Math.max(0, Math.round((remainingToDistribute - distributedSum) * 100) / 100),
            };
          } else {
            const rawAmount = remainingToDistribute / numFuture;
            const approxAmount = Math.max(0, Math.round(rawAmount * 100) / 100);
            distributedSum += approxAmount;
            return {
              ...inst,
              amount: approxAmount,
            };
          }
        }
        return inst;
      });
    }

    // 4. Recalculate remaining balances based on recalculated expected amounts
    let cumulativeAmounts = 0;
    const finalTotalPayable = updatedSchedule.reduce((sum, s) => sum + s.amount, 0);
    const recalculatedSchedule = updatedSchedule.map((inst) => {
      cumulativeAmounts += inst.amount;
      return {
        ...inst,
        balance: Math.max(0, Math.round((finalTotalPayable - cumulativeAmounts) * 100) / 100)
      };
    });

    setSchedule(recalculatedSchedule);

    // Also update projection's finalPayable and schedule so the summaries keep in perfect sync!
    if (projection) {
      setProjection({
        ...projection,
        finalPayable: finalTotalPayable,
        schedule: recalculatedSchedule
      });
    }
  };

  const handleNumericChange = (field: keyof InstallmentPlanInput, value: number) => {
    setInputs((prev) => ({
      ...prev,
      [field]: Math.max(0, value),
    }));
  };

  const handleSelectChange = (
    field: keyof InstallmentPlanInput,
    value: string
  ) => {
    setInputs((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) return;
    onSavePlan(inputs, schedule);
  };

  return (
    <div id="plan-creator-panel" className="relative z-10 bg-white/95 backdrop-blur-xl rounded-3xl border border-slate-200/70 p-7 shadow-2xl shadow-slate-100/30">
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-100 pb-5 mb-6">
        <div>
          <span className="text-[10px] font-semibold text-slate-400 tracking-wider uppercase block font-mono">
            {customer.code} SECURED ACCOUNT PROFILE
          </span>
          <h2 className="text-sm font-semibold text-slate-900 tracking-tight uppercase mt-0.5">
            Plan Amortization Terminal: <span className="font-semibold text-slate-600">{customer.name}</span>
          </h2>
        </div>
        <button
          onClick={onClose}
          className="text-[10px] font-medium border border-slate-200 rounded-xl px-4 py-2 bg-white text-slate-600 hover:text-slate-800 hover:bg-slate-50 transition-all cursor-pointer self-start md:self-center mt-3 md:mt-0 font-sans shadow-xs"
        >
          Close Calculator
        </button>
      </div>

      {isReadOnly ? (
        <div className="flex items-center gap-3 p-4 bg-[#fdf0f5] border border-rose-100 text-rose-900 rounded-xl text-xs leading-relaxed mb-6 font-light shadow-xs">
          <ShieldAlert className="w-5 h-5 shrink-0 text-rose-500" />
          <p>
            <strong className="font-semibold">Viewer Role Restriction:</strong> You are authorized to dry-run calculate plan structures, but you cannot commit or establish contracts into the database.
          </p>
        </div>
      ) : null}

      <form onSubmit={handleFormSubmit} className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* LEFT COLUMN: PARAMETERS EDITOR */}
        <div className="xl:col-span-5 space-y-5">
          <h3 className="text-[10px] font-bold text-gray-450 uppercase tracking-widest border-b border-white/45 pb-2 flex items-center justify-between">
            <span>Core Coefficients</span>
            <Sparkles className="w-3.5 h-3.5 text-[#c5a880]" />
          </h3>

          {/* Principal Amount */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                Principal Investment Amount
              </label>
              <span className="text-[10px] text-slate-400 font-mono font-medium">RM</span>
            </div>
            <div className="relative">
              <span className="absolute left-3.5 top-3 text-slate-400 font-semibold font-mono text-xs">RM</span>
              <input
                type="number"
                value={inputs.principalAmount || ''}
                onChange={(e) => handleNumericChange('principalAmount', parseFloat(e.target.value) || 0)}
                disabled={isReadOnly}
                className="w-full bg-slate-50/60 border border-slate-200/80 rounded-xl py-2.5 pl-10 pr-4 text-xs font-medium font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-300 focus:border-slate-300 focus:bg-white"
              />
            </div>
          </div>

          {/* Downpayment Sizer */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                Downpayment / Initial Deposit (首付 / 头期款)
              </label>
              <span className="text-[10px] text-indigo-600 font-semibold bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100 font-mono">
                {inputs.downpaymentPercent || 0}% (RM {((inputs.principalAmount * (inputs.downpaymentPercent || 0)) / 100).toFixed(2)})
              </span>
            </div>
            <div className="grid grid-cols-4 gap-2 mb-2">
              {[0, 10, 15, 20].map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => handleNumericChange('downpaymentPercent', pct)}
                  disabled={isReadOnly}
                  className={`py-1.5 px-2 text-[11px] font-bold rounded-xl text-center cursor-pointer transition-all border ${
                    (inputs.downpaymentPercent ?? 0) === pct
                      ? 'bg-slate-900 border-slate-950 text-white shadow-sm'
                      : 'bg-white border-slate-200 text-slate-600 hover:text-slate-800 hover:bg-slate-50'
                  }`}
                >
                  {pct === 0 ? '0% (No Down)' : `${pct}%`}
                </button>
              ))}
            </div>
            <div className="relative">
              <span className="absolute right-3.5 top-2.5 text-[8px] text-slate-400 font-extrabold uppercase font-mono tracking-wider">Custom Downpayment %</span>
              <input
                type="number"
                min="0"
                max="100"
                value={inputs.downpaymentPercent ?? 0}
                onChange={(e) => handleNumericChange('downpaymentPercent', parseFloat(e.target.value) || 0)}
                disabled={isReadOnly}
                className="w-full bg-slate-50/60 border border-slate-200/80 rounded-xl py-2 pl-3.5 pr-32 text-xs font-medium font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-300 focus:border-slate-300 focus:bg-white"
                placeholder="Custom downpayment %"
              />
            </div>
          </div>

          {/* Duration Months */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                Term Tenure Duration
              </label>
              <span className="text-[10px] text-slate-500 font-sans font-semibold bg-slate-100/85 px-2.5 py-0.5 rounded-full border border-slate-100">{inputs.months} Months</span>
            </div>
            <input
              type="range"
              min="1"
              max="24"
              value={inputs.months}
              onChange={(e) => handleNumericChange('months', parseInt(e.target.value) || 1)}
              disabled={isReadOnly}
              className="w-full justify-center h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-slate-800"
            />
            <div className="flex justify-between text-[8px] text-slate-400 font-medium font-mono px-1 mt-1">
              <span>1 Month</span>
              <span>6 Mo</span>
              <span>12 Mo</span>
              <span>18 Mo</span>
              <span>24 Months</span>
            </div>
          </div>

          {/* Interest Controls */}
          <div className="grid grid-cols-2 gap-3 bg-slate-50/50 p-3.5 rounded-2xl border border-slate-100">
            <div>
              <label className="block text-[9px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Interest Method
              </label>
              <select
                value={inputs.interestType}
                onChange={(e) => handleSelectChange('interestType', e.target.value)}
                disabled={isReadOnly}
                className="w-full bg-white border border-slate-200/70 rounded-lg py-1.5 px-2 text-xs focus:ring-1 focus:ring-slate-300 focus:outline-none font-medium text-slate-700"
              >
                <option value="flat">Flat Lease (%)</option>
                <option value="monthly">Monthly Comp (%)</option>
              </select>
            </div>
            <div>
              <label className="block text-[9px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Rate Percent (%)
              </label>
              <input
                type="number"
                step="0.1"
                value={inputs.interestRatePercent}
                onChange={(e) => handleNumericChange('interestRatePercent', parseFloat(e.target.value) || 0)}
                disabled={isReadOnly}
                className="w-full bg-white border border-slate-200/70 rounded-lg py-1.5 px-2 text-xs font-mono font-medium text-slate-800 focus:outline-none"
              />
            </div>
          </div>

          {/* Service Fee Controls */}
          <div className="grid grid-cols-2 gap-3 bg-slate-50/50 p-3.5 rounded-2xl border border-slate-100">
            <div>
              <label className="block text-[9px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Service Fee Type
              </label>
              <select
                value={inputs.serviceFeeType}
                onChange={(e) => handleSelectChange('serviceFeeType', e.target.value)}
                disabled={isReadOnly}
                className="w-full bg-white border border-slate-200/70 rounded-lg py-1.5 px-2 text-xs focus:ring-1 focus:ring-slate-300 focus:outline-none font-medium text-slate-700"
              >
                <option value="percent">Percentage (%)</option>
                <option value="fixed">Fixed Flat (RM)</option>
              </select>
            </div>
            <div>
              <label className="block text-[9px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Fee Scale Value
              </label>
              <input
                type="number"
                step="0.1"
                value={inputs.serviceFeeValue}
                onChange={(e) => handleNumericChange('serviceFeeValue', parseFloat(e.target.value) || 0)}
                disabled={isReadOnly}
                className="w-full bg-white border border-slate-200/70 rounded-lg py-1.5 px-2 text-xs font-mono font-medium text-slate-800 focus:outline-none"
              />
            </div>
          </div>

          {/* Discount Controls */}
          <div className="grid grid-cols-2 gap-3 bg-slate-50/50 p-3.5 rounded-2xl border border-slate-100">
            <div>
              <label className="block text-[9px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Discount Type
              </label>
              <select
                value={inputs.discountType}
                onChange={(e) => handleSelectChange('discountType', e.target.value)}
                disabled={isReadOnly}
                className="w-full bg-white border border-slate-200/70 rounded-lg py-1.5 px-2 text-xs focus:ring-1 focus:ring-slate-300 focus:outline-none font-medium text-slate-700"
              >
                <option value="fixed">Flat RM</option>
                <option value="percent">Percentage (%)</option>
              </select>
            </div>
            <div>
              <label className="block text-[9px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Discount Value
              </label>
              <input
                type="number"
                step="0.1"
                value={inputs.discountValue}
                onChange={(e) => handleNumericChange('discountValue', parseFloat(e.target.value) || 0)}
                disabled={isReadOnly}
                className="w-full bg-white border border-slate-200/70 rounded-lg py-1.5 px-2 text-xs font-mono font-medium text-slate-800 focus:outline-none"
              />
            </div>
          </div>

          {/* Late Policy Settings */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-150 space-y-3">
            <span className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider block">
              Late Payment Penalty Policy
            </span>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[8px] font-medium uppercase tracking-wider text-slate-450 mb-1">
                  Breach Penalty
                </label>
                <input
                  type="number"
                  value={inputs.penaltyFeeAmount}
                  onChange={(e) => handleNumericChange('penaltyFeeAmount', parseFloat(e.target.value) || 0)}
                  disabled={isReadOnly}
                  className="w-full bg-white border border-slate-200/60 rounded-lg py-1 px-2 text-xs font-mono font-medium text-slate-800 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[8px] font-medium uppercase tracking-wider text-slate-450 mb-1">
                  Late Fee Type
                </label>
                <select
                  value={inputs.latePaymentFeeType}
                  onChange={(e) => handleSelectChange('latePaymentFeeType', e.target.value)}
                  disabled={isReadOnly}
                  className="w-full bg-white border border-slate-200/60 rounded-lg py-1 px-2 text-[10px] font-medium text-slate-650 focus:outline-none"
                >
                  <option value="daily">RM per day</option>
                  <option value="fixed_percent">% per Month</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-[8px] font-medium uppercase tracking-wider text-slate-450 mb-1">
                Late Fee Multiplier ({inputs.latePaymentFeeType === 'daily' ? 'RM' : '%'})
              </label>
              <input
                type="number"
                value={inputs.latePaymentFeeValue}
                onChange={(e) => handleNumericChange('latePaymentFeeValue', parseFloat(e.target.value) || 0)}
                disabled={isReadOnly}
                className="w-full bg-white border border-slate-200/60 rounded-lg py-1 px-2 text-xs font-mono font-medium text-slate-800 focus:outline-none"
              />
            </div>
          </div>

          {/* Distribution Mode */}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5 col-span-2">
              Amortization Curve Line Form
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleSelectChange('adjustmentMode', 'equal')}
                className={`py-2 px-3 text-xs font-semibold rounded-xl text-center cursor-pointer transition-all ${
                  inputs.adjustmentMode === 'equal'
                    ? 'bg-slate-900 border border-slate-950 text-white shadow-sm'
                    : 'bg-white border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                }`}
              >
                Equal (平均分期)
              </button>
              <button
                type="button"
                onClick={() => handleSelectChange('adjustmentMode', 'early_heavy')}
                className={`py-2 px-3 text-xs font-semibold rounded-xl text-center cursor-pointer transition-all ${
                  inputs.adjustmentMode === 'early_heavy'
                    ? 'bg-slate-900 border border-slate-950 text-white shadow-sm'
                    : 'bg-white border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                }`}
              >
                Early Heavy (前期高)
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: PROJECTION SUMMARY */}
        <div className="xl:col-span-7 bg-white/70 border border-slate-200/60 rounded-3xl p-5.5 flex flex-col justify-between soft-card-shadow font-sans">
          <div>
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-4">
              Real-Time Projection Ledger
            </span>

            {/* Computation Ledger */}
            {projection && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 bg-slate-50/70 p-3.5 rounded-xl border border-slate-100 shadow-3xs">
                  <div>
                    <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider block">Principal</span>
                    <span className="text-xs font-semibold font-mono text-slate-800">
                      {formatRM(inputs.principalAmount)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider block">Interest</span>
                    <span className="text-xs font-semibold font-mono text-slate-800">
                      +{formatRM(projection.totalInterest)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider block">Service Fee</span>
                    <span className="text-xs font-semibold font-mono text-slate-800">
                      +{formatRM(projection.totalServiceFee)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider block">Discount</span>
                    <span className="text-xs font-semibold font-mono text-blue-600">
                      -{formatRM(projection.totalDiscount)}
                    </span>
                  </div>
                </div>

                <div className="flex justify-between items-center bg-slate-900 text-white p-4.5 rounded-2xl shadow-sm">
                  <div>
                    <span className="text-[9.5px] text-slate-450 block uppercase font-semibold tracking-wider">
                      Estimated Final Amortization Total
                    </span>
                    <span className="text-xl font-semibold font-mono text-white">
                      {formatRM(projection.finalPayable)}
                    </span>
                  </div>
                  <span className="text-[9px] bg-slate-800 border border-slate-700/50 text-slate-300 rounded px-2.5 py-1 font-mono uppercase font-semibold">
                    COMPUTED LIVE
                  </span>
                </div>

                {/* Simulated Schedule Grid */}
                <div className="space-y-2 mt-4 max-h-[220px] overflow-y-auto pr-1">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <span className="text-[9px] text-slate-400 font-semibold uppercase tracking-wider block">
                      Forecast Installment Schedule ({inputs.months} Installments)
                    </span>
                    {!isReadOnly && (
                      <span className="text-[8px] sm:text-[8.5px] text-emerald-600 font-semibold tracking-tight uppercase bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                        ⚡ Tip: Edit any month's RM to auto-balance subsequent ones!
                      </span>
                    )}
                  </div>
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 text-[9px] text-slate-400 uppercase tracking-wider font-semibold pb-1">
                        <th className="py-2 font-semibold">Month</th>
                        <th className="py-2 text-right font-semibold pr-2">Payment Size</th>
                        <th className="py-2 text-right font-semibold">Principal</th>
                        <th className="py-2 text-right font-semibold">Interest</th>
                        <th className="py-2 text-right font-semibold">Fees Share</th>
                      </tr>
                    </thead>
                    <tbody className="text-[11px] font-mono leading-relaxed divide-y divide-slate-50">
                      {schedule.map((inst) => (
                        <tr
                          key={inst.monthNumber}
                          className="hover:bg-slate-50/50 transition-colors"
                        >
                          <td className="py-1.5 text-slate-450 font-sans">
                            {inst.monthNumber === 0 ? 'Downpayment (m.0)' : `m.${inst.monthNumber}`}
                          </td>
                          <td className="py-1 text-right">
                            {isReadOnly ? (
                              <span className="font-semibold text-slate-800">{formatRM(inst.amount)}</span>
                            ) : (
                              <div className="inline-flex items-center gap-1 justify-end">
                                <span className="text-[8.5px] text-slate-400/80 font-semibold">RM</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={inst.amount === 0 ? '' : inst.amount}
                                  onChange={(e) => handleUpdateProjectionInstallmentAmount(inst.monthNumber, parseFloat(e.target.value) || 0)}
                                  className="w-20 bg-emerald-50/5 hover:bg-emerald-50/25 text-right font-extrabold text-emerald-700 border border-emerald-200/50 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-400 rounded-lg px-2 py-0.5 text-[10.5px] transition-all"
                                  title="Enter custom amount, subsequent months will auto-adjust"
                                />
                              </div>
                            )}
                          </td>
                          <td className="py-1.5 text-right text-slate-500">{formatRM(inst.principalShare)}</td>
                          <td className="py-1.5 text-right text-slate-500">{formatRM(inst.interestShare)}</td>
                          <td className="py-1.5 text-right text-slate-400">{formatRM(inst.serviceFeeShare)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="text-[8px] text-slate-400 leading-normal italic pt-2">
                    * Modifying any installment automatically acts on outstanding allocations. Final month adjusts trailing cents.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Confirmation panel */}
          <div className="pt-5 border-t border-slate-100 flex justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 text-xs font-medium text-slate-500 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl shadow-xs cursor-pointer transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isReadOnly}
              className={`px-5 py-2.5 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer ${
                isReadOnly
                  ? 'bg-slate-100 text-slate-400 border border-slate-200/50 cursor-not-allowed'
                  : 'bg-slate-900 hover:bg-slate-800 text-white hover:-translate-y-0.5'
              }`}
            >
              <Save className="w-3.5 h-3.5" />
              <span>Establish Installment Plan</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
