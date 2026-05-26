import React, { useState } from 'react';
import { Customer, InstallmentPlan, RepaymentInstallment, UserRole, ExtraFeeItem } from '../types';
import { formatRM } from '../utils/calc';
import { 
  CheckCircle, AlertTriangle, Receipt, DollarSign, Calendar, Clock, Lock, Plus, X, 
  Sparkles, CheckCircle2, ChevronRight, Coins, ShieldCheck, Ticket
} from 'lucide-react';

interface RepaymentScheduleProps {
  customer: Customer;
  plan: InstallmentPlan;
  evaluatedSchedule: RepaymentInstallment[];
  simulatedStats: {
    totalLateFees: number;
    hasOverdue: boolean;
    overallPenaltyApplied: boolean;
    overallPenaltyAmount: number;
    overallFinalAmount: number;
  };
  onUpdateInstallmentPaidAmount: (monthNumber: number, paidAmt: number) => void;
  onAddExtraFee: (amount: number, reason: string) => void;
  role: UserRole;
}

export const RepaymentScheduleTable: React.FC<RepaymentScheduleProps> = ({
  customer,
  plan,
  evaluatedSchedule,
  simulatedStats,
  onUpdateInstallmentPaidAmount,
  onAddExtraFee,
  role,
}) => {
  const isReadOnly = role === 'Viewer';
  const canModifyPayments = role !== 'Viewer';

  // Modal control states
  const [activePaymentModalMonth, setActivePaymentModalMonth] = useState<number | null>(null);
  const [depositAmountInput, setDepositAmountInput] = useState<string>('');
  const [isFullyPaidMarkOption, setIsFullyPaidMarkOption] = useState<boolean>(false);
  
  const [showExtraFeeModal, setShowExtraFeeModal] = useState<boolean>(false);
  const [extraFeeAmount, setExtraFeeAmount] = useState<string>('');
  const [extraFeeReason, setExtraFeeReason] = useState<string>('');

  const [errorText, setErrorText] = useState<string>('');

  // Total calculated amounts based on currently evaluated schedule
  const totalPaid = evaluatedSchedule.reduce((sum, inst) => sum + (inst.paidAmount || 0), 0);

  // Core base outstanding
  const totalOutstanding = evaluatedSchedule.reduce((sum, inst) => {
    const totalDue = inst.amount + inst.lateFeeCharged;
    const remaining = Math.max(0, totalDue - (inst.paidAmount || 0));
    return sum + remaining;
  }, 0);

  // Open portioned payment modal for a month
  const handleOpenPaymentModal = (monthNumber: number) => {
    const target = evaluatedSchedule.find(i => i.monthNumber === monthNumber);
    if (!target) return;
    setActivePaymentModalMonth(monthNumber);
    
    const remainingDue = (target.amount + target.lateFeeCharged) - (target.paidAmount || 0);
    setDepositAmountInput(remainingDue.toFixed(2));
    setIsFullyPaidMarkOption(true);
    setErrorText('');
  };

  const handleSavePayment = () => {
    if (activePaymentModalMonth === null) return;
    const amount = parseFloat(depositAmountInput);
    if (isNaN(amount) || amount < 0) {
      setErrorText('Please specify a positive numerical payment.');
      return;
    }

    onUpdateInstallmentPaidAmount(activePaymentModalMonth, amount);
    setActivePaymentModalMonth(null);
    setDepositAmountInput('');
  };

  const handleSaveExtraFee = () => {
    const amount = parseFloat(extraFeeAmount);
    if (isNaN(amount) || amount <= 0) {
      setErrorText('Please specify a positive extra fee amount.');
      return;
    }
    if (!extraFeeReason.trim()) {
      setErrorText('Please provide a reason or billing category.');
      return;
    }

    onAddExtraFee(amount, extraFeeReason.trim());
    setExtraFeeAmount('');
    setExtraFeeReason('');
    setShowExtraFeeModal(false);
    setErrorText('');
  };

  return (
    <div id="repayment-schedule" className="bg-white/80 backdrop-blur-md rounded-3xl border border-slate-200/50 p-6 soft-card-shadow relative">
      
      {/* Header Info */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-100 pb-5 mb-6">
        <div className="text-left">
          <h3 className="text-sm font-semibold text-slate-800 tracking-tight flex items-center gap-2">
            <Coins className="w-4 h-4 text-slate-400" />
            <span>Repayment Schedule Ledger</span>
          </h3>
          <p className="text-[11.5px] text-slate-500 mt-1 font-sans font-light">
            Real-time balance sheet updates for {customer.name} ({customer.code})
          </p>
        </div>

        {/* Action button row */}
        <div className="flex flex-wrap gap-2 mt-4 md:mt-0 font-sans">
          <button
            onClick={() => !isReadOnly && setShowExtraFeeModal(true)}
            disabled={isReadOnly}
            className={`px-4 py-2 rounded-xl text-xs font-medium border border-rose-200/85 bg-[#faf0f5]/85 hover:bg-rose-100/50 text-rose-700 cursor-pointer flex items-center gap-1.5 transition-all hover:-translate-y-0.5 ${
              isReadOnly ? 'opacity-50 cursor-not-allowed' : 'soft-button-pink-shadow'
            }`}
          >
            <Plus className="w-4 h-4" />
            <span>Add Extra Fee</span>
          </button>
        </div>
      </div>

      {/* Amortization Ledger Summary Panels */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-6">
        <div className="p-5 bg-teal-50/15 border border-teal-150/70 rounded-2xl text-left soft-button-shadow">
          <span className="text-[10px] text-teal-800 block uppercase font-medium tracking-wider">Total Paid so far</span>
          <span className="text-2xl font-semibold font-mono text-teal-900 mt-0.5 block">{formatRM(totalPaid)}</span>
          <p className="text-[9px] text-[#2dd4bf]/80 mt-1 uppercase font-semibold font-mono">Real-time Receipts</p>
        </div>
        <div className="p-5 bg-blue-50/15 border border-blue-150/70 rounded-2xl text-left soft-button-shadow">
          <span className="text-[10px] text-blue-800 block uppercase font-medium tracking-wider">Lease Outstanding</span>
          <span className="text-2xl font-semibold font-mono text-blue-900 mt-0.5 block">
            {formatRM(totalOutstanding)}
          </span>
          <p className="text-[9px] text-[#60a5fa]/80 mt-1 uppercase font-semibold font-mono">Net remaining due</p>
        </div>
        <div className="p-5 bg-rose-50/15 border border-rose-150/75 rounded-2xl text-left soft-button-shadow">
          <span className="text-[10px] text-rose-800 block uppercase font-medium tracking-wider">Late & Surcharges</span>
          <span className="text-2xl font-semibold font-mono text-rose-900 mt-0.5 block">
            {formatRM(simulatedStats.totalLateFees + simulatedStats.overallPenaltyAmount + (plan.extraFees?.reduce((sum, f) => sum + f.amount, 0) ?? 0))}
          </span>
          <p className="text-[9px] text-[#f43f5e]/80 mt-1 uppercase font-semibold font-mono">Breach & Extra items</p>
        </div>
      </div>

      {/* Dynamic Breach Penalty Alerts */}
      {simulatedStats.overallPenaltyApplied && (
        <div className="mb-6 p-4 bg-rose-100/35 border border-rose-200/55 text-rose-950 rounded-2xl text-xs leading-relaxed flex items-start gap-3 shadow-xs">
          <AlertTriangle className="w-5 h-5 shrink-0 text-rose-500 animate-pulse mt-0.5" />
          <div className="text-left">
            <p className="font-semibold uppercase tracking-wider text-[10px] text-rose-700">🚨 Standard Contract End-Date Breach Surcharge</p>
            <p className="mt-1 font-light text-[11.5px] leading-relaxed">
              Outstanding balances exist past contract resolution maturity (<strong>{customer.endDate}</strong>). 
              An immediate breach penalty of <strong>{formatRM(plan.input.penaltyFeeAmount)}</strong> is appended onto account.
            </p>
          </div>
        </div>
      )}

      {/* Extra Fees List if any exist */}
      {plan.extraFees && plan.extraFees.length > 0 && (
        <div className="mb-6 p-4 bg-amber-50/30 rounded-2xl border border-amber-200/50 text-left shadow-xs">
          <h4 className="text-xs font-semibold text-amber-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Ticket className="w-4 h-4" /> Custom Set Surcharges:
          </h4>
          <div className="space-y-1.5">
            {plan.extraFees.map((f) => (
              <div key={f.id} className="flex justify-between items-center text-xs font-mono py-1 border-b border-amber-100/40 last:border-0">
                <span className="text-gray-700 font-sans">
                  <strong>{f.reason}</strong> <span className="text-[9px] text-gray-400">({f.date})</span>
                </span>
                <span className="font-bold text-amber-800">+{formatRM(f.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Amortization Table */}
      <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-widest mb-3 font-mono text-left">III. Installments Amortization Matrix:</span>
      <div className="overflow-x-auto border border-slate-200 rounded-2xl bg-white soft-card-shadow mb-6">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50 text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
              <th className="py-3.5 px-4 text-center">Month</th>
              <th className="py-3.5 px-3">Due Date</th>
              <th className="py-3.5 px-4 text-right">Installment</th>
              <th className="py-3.5 px-4 text-right text-rose-600">Late Fine</th>
              <th className="py-3.5 px-4 text-right">Total Due</th>
              <th className="py-3.5 px-4 text-right text-teal-850">Paid Amount</th>
              <th className="py-3.5 px-4 text-right font-sans">Remaining</th>
              <th className="py-3.5 px-5 text-center">Ledger Controls</th>
            </tr>
          </thead>
          <tbody className="text-[11px] font-mono leading-relaxed divide-y divide-slate-150 text-slate-705 bg-white">
            {evaluatedSchedule.map((inst, index) => {
              const isPaid = inst.status === 'Paid';
              const isOverdue = inst.status === 'Overdue';
              const totalDue = inst.amount + inst.lateFeeCharged;
              const paidAmount = inst.paidAmount || 0;
              const remainingDue = Math.max(0, totalDue - paidAmount);

              let statusText = 'Unpaid';
              let badgeColor = 'bg-slate-55/70 text-slate-500 border-slate-200';
              if (isPaid) {
                statusText = 'Cleared';
                badgeColor = 'bg-teal-50 text-teal-600 border-teal-100';
              } else if (paidAmount > 0) {
                statusText = 'Partial';
                badgeColor = 'bg-amber-50 text-amber-600 border-amber-100 animate-pulse';
              } else if (isOverdue) {
                statusText = 'Overdue';
                badgeColor = 'bg-rose-50 text-rose-600 border-rose-100';
              }

              return (
                <tr
                  key={inst.monthNumber}
                  className={`transition-colors ${isPaid ? 'bg-slate-50/20' : 'hover:bg-slate-50/10'}`}
                >
                  {/* Month number */}
                  <td className={`py-3 px-4 text-center font-bold font-sans border-r border-slate-100/60 ${inst.monthNumber === 0 ? 'text-indigo-600 bg-indigo-50/20' : 'text-slate-400'}`}>
                    {inst.monthNumber === 0 ? 'Downpayment (头期)' : `#${inst.monthNumber}`}
                  </td>

                  {/* Due Date */}
                  <td className="py-3 px-3 text-slate-500 font-sans">
                    {inst.dueDate}
                  </td>

                  {/* Base Monthly Size */}
                  <td className="py-3 px-4 text-right text-slate-500 font-medium font-mono">
                    {formatRM(inst.amount)}
                  </td>

                  {/* Late Surcharges */}
                  <td className="py-3 px-4 text-right text-rose-600 font-bold font-mono">
                    {inst.lateFeeCharged > 0 ? `+${formatRM(inst.lateFeeCharged)}` : 'RM 0.00'}
                  </td>

                  {/* Combined total monthly due */}
                  <td className="py-3 px-4 text-right text-slate-800 font-bold font-mono">
                    {formatRM(totalDue)}
                  </td>

                  {/* Amount deposited so far */}
                  <td className="py-3 px-4 text-right text-teal-700 font-semibold font-mono">
                    {formatRM(paidAmount)}
                  </td>

                  {/* Balance left */}
                  <td className="py-3 px-4 text-right text-slate-900 font-bold border-r border-slate-100/60 font-mono">
                    {formatRM(remainingDue)}
                  </td>

                  {/* Payment controls popup launcher */}
                  <td className="py-3 px-4 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <span className={`text-[8px] px-2 py-0.5 rounded font-black border uppercase tracking-widest ${badgeColor}`}>
                        {statusText}
                      </span>
                      
                      <button
                        onClick={() => canModifyPayments && handleOpenPaymentModal(inst.monthNumber)}
                        disabled={!canModifyPayments}
                        className={`py-1.5 px-3 border border-slate-200 bg-white hover:bg-slate-50 text-slate-805 rounded-xl text-[9.5px] font-bold uppercase tracking-wider transition-all ${
                          canModifyPayments ? 'cursor-pointer soft-button-shadow hover:-translate-y-0.5' : 'opacity-40 cursor-not-allowed'
                        }`}
                      >
                        {isPaid ? 'Edit' : 'Deposit'}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Amortization descriptive box */}
      <div className="p-4 border-2 border-slate-900 rounded-2xl flex items-start gap-3 bg-[#E1EEFF]/40 text-left">
        <Receipt className="w-5 h-5 text-gray-700 shrink-0 mt-0.5" />
        <div className="leading-relaxed text-xs">
          <p className="font-extrabold text-slate-900 uppercase tracking-widest text-[10px]">Administrative Ledger Terms:</p>
          <p className="mt-1 text-slate-650 font-medium">
            Administrators and support agents can record variable partial payments corresponding to dynamic repayment cycles. Each logged payment instantly updates the outstanding balance, with late conditions re-evaluated against the system clock.
          </p>
        </div>
      </div>

      {/* MODAL 1: PORSTIONED REPAYMENT DEPOSIT MODAL */}
      {activePaymentModalMonth !== null && (
        <div className="fixed inset-0 bg-slate-950/35 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200/80 rounded-3xl p-6 w-full max-w-md text-left animate-fade-in relative z-50 soft-card-shadow">
            <div className="flex justify-between items-center border-b border-slate-100 pb-4 mb-5">
              <h3 className="font-semibold text-slate-850 tracking-tight font-sans text-sm flex items-center gap-1.5">
                <Coins className="w-4 h-4 text-emerald-500" />
                <span>Log Installment Payment #{activePaymentModalMonth}</span>
              </h3>
              <button 
                onClick={() => setActivePaymentModalMonth(null)} 
                className="text-slate-400 hover:text-slate-700 cursor-pointer p-1 rounded-full hover:bg-slate-50 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {(() => {
              const instr = evaluatedSchedule.find(i => i.monthNumber === activePaymentModalMonth);
              if (!instr) return null;
              const totalAmount = instr.amount + instr.lateFeeCharged;
              return (
                <div className="space-y-4 font-sans text-xs">
                  <div className="grid grid-cols-2 gap-4 p-3.5 bg-slate-50 rounded-xl border border-slate-200/60">
                    <div>
                      <span className="text-[9px] text-gray-400 block font-medium uppercase tracking-wider">Base Installment:</span>
                      <span className="font-mono font-semibold text-slate-800">{formatRM(instr.amount)}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-gray-400 block font-medium uppercase tracking-wider">Late Fine accrued:</span>
                      <span className="font-mono font-semibold text-rose-600">+{formatRM(instr.lateFeeCharged)}</span>
                    </div>
                    <div className="col-span-2 border-t border-slate-100 pt-2 flex justify-between">
                      <span className="text-[9px] text-slate-500 font-medium uppercase tracking-wider">Total Monthly Bill:</span>
                      <span className="font-mono font-semibold text-slate-900">{formatRM(totalAmount)}</span>
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] text-gray-400 block font-medium uppercase tracking-wider mb-1">Previously Repaid:</span>
                    <span className="font-mono text-sm font-semibold text-teal-800">{formatRM(instr.paidAmount || 0)}</span>
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                      New Total Paid Amount (累计已还款数额):
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-2.5 font-mono text-slate-400 font-semibold text-xs">RM</span>
                      <input
                        type="number"
                        step="0.01"
                        value={depositAmountInput}
                        onChange={(e) => setDepositAmountInput(e.target.value)}
                        placeholder="0.00"
                        className="w-full pl-10 pr-3 py-2.5 text-xs font-mono border border-slate-200 rounded-xl focus:outline-none focus:border-slate-400 bg-slate-50/50 focus:bg-white transition-all text-slate-800"
                      />
                    </div>
                    <p className="text-[9px] text-slate-400 mt-1.5 uppercase font-light">
                      Set this value to the current cumulative repayment amount. If it equals or exceeds {formatRM(totalAmount)}, the month will be marked cleared.
                    </p>
                  </div>

                  {errorText && (
                    <div className="p-3 bg-rose-50 border border-rose-150 text-rose-800 rounded-xl font-medium flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                      <span>{errorText}</span>
                    </div>
                  )}

                  <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setActivePaymentModalMonth(null)}
                      className="px-4 py-2 text-xs font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded-xl cursor-pointer transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSavePayment}
                      className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-medium rounded-xl text-xs transition-all shadow-sm hover:-translate-y-0.5 cursor-pointer"
                    >
                      Commit Payment
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* MODAL 2: ADD EXTRA FEES */}
      {showExtraFeeModal && (
        <div className="fixed inset-0 bg-slate-950/35 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200/80 rounded-3xl p-7 w-full max-w-md soft-card-shadow text-left animate-fade-in relative z-50 font-sans">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3.5 mb-4">
              <h3 className="font-semibold text-slate-850 tracking-tight text-sm flex items-center gap-1.5 font-sans">
                <Ticket className="w-4 h-4 text-amber-500" />
                <span>Add Extra Surcharge Surcharge</span>
              </h3>
              <button 
                onClick={() => setShowExtraFeeModal(false)} 
                className="text-slate-400 hover:text-slate-600 cursor-pointer p-1 rounded-full hover:bg-slate-50 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 font-sans text-xs">
              <div>
                <label className="block text-[10px] font-semibold uppercase text-slate-400 mb-1.5">
                  Fee Charge Amount (加收费用金额):
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 font-mono text-slate-400 font-semibold text-xs">RM</span>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="e.g. 150.00"
                    value={extraFeeAmount}
                    onChange={(e) => setExtraFeeAmount(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 text-xs font-mono border border-slate-205 rounded-xl focus:outline-none focus:border-slate-400 bg-slate-50/50 focus:bg-white transition-all text-slate-805 font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-semibold uppercase text-slate-400 mb-1.5">
                  Reason for Surcharge (加收费用原因/备注):
                </label>
                <input
                  type="text"
                  placeholder="e.g. Legal notification fee / Contract variation fee"
                  value={extraFeeReason}
                  onChange={(e) => setExtraFeeReason(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs font-sans border border-slate-205 rounded-xl focus:outline-none focus:border-slate-400 bg-slate-50/50 focus:bg-white transition-all text-slate-805 font-medium"
                />
              </div>

              {errorText && (
                <div className="p-3 bg-rose-50 border border-rose-150 text-rose-800 rounded-xl font-medium flex items-center gap-1.5 font-sans">
                  <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                  <span>{errorText}</span>
                </div>
              )}

              <div className="flex justify-end gap-2.5 pt-3.5 border-t border-slate-100 font-sans">
                <button
                  type="button"
                  onClick={() => setShowExtraFeeModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-slate-700 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveExtraFee}
                  className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl text-xs hover:-translate-y-0.5 transition-all shadow-sm cursor-pointer"
                >
                  Apply Surcharge
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
