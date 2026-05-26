import React, { useState } from 'react';
import { Customer, InstallmentPlan } from '../types';
import { formatRM } from '../utils/calc';
import { 
  Landmark, Users, ClipboardCheck, AlertTriangle, Coins, 
  TrendingUp, ShieldAlert, ArrowUpRight, ArrowDownRight, 
  Calendar, Award, CreditCard, Activity, Search
} from 'lucide-react';

interface DashboardStatsProps {
  customers: Customer[];
  plans: InstallmentPlan[];
  simulatedStats: {
    totalLateFees: number;
    hasOverdue: boolean;
    overallPenaltyAmount: number;
  };
}

export const DashboardStats: React.FC<DashboardStatsProps> = ({
  customers,
  plans,
  simulatedStats,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  // 1. Basic Counts & Analytics
  const activeCustomersCount = customers.filter((c) => c.active).length;
  const inactiveCustomersCount = customers.length - activeCustomersCount;
  
  const totalLeasePortfolio = plans.reduce((sum, p) => sum + p.finalPayable, 0);
  const totalLeaseInterest = plans.reduce((sum, p) => sum + p.totalInterest, 0);
  const totalLeaseServiceFee = plans.reduce((sum, p) => sum + p.totalServiceFee, 0);

  let totalCollected = 0;
  let totalOutstanding = 0;
  let totalInstallmentCount = 0;
  let paidCount = 0;
  let unpaidCount = 0;
  let overdueCount = 0;
  let overdueOutstandingAmount = 0;

  plans.forEach((p) => {
    p.schedule.forEach((inst) => {
      totalInstallmentCount++;
      const actualPaid = inst.paidAmount || (inst.status === 'Paid' ? inst.amount : 0);
      totalCollected += actualPaid;
      totalOutstanding += Math.max(0, inst.amount - actualPaid);

      if (inst.status === 'Paid') {
        paidCount++;
      } else {
        unpaidCount++;
        if (inst.status === 'Overdue') {
          overdueCount++;
          overdueOutstandingAmount += Math.max(0, inst.amount - actualPaid);
        }
      }
    });
  });

  const completionRate = totalInstallmentCount > 0 
    ? Math.round((paidCount / totalInstallmentCount) * 100) 
    : 0;

  const avgContractSize = plans.length > 0 
    ? totalLeasePortfolio / plans.length 
    : 0;

  // 2. Generate Monthly Amortization cash flow aggregation (Real Data)
  const monthlyMap: Record<string, { expected: number; collected: number }> = {};
  
  plans.forEach((p) => {
    p.schedule.forEach((inst) => {
      // Group by year-month (YYYY-MM)
      const key = inst.dueDate ? inst.dueDate.substring(0, 7) : '2026-05';
      if (!monthlyMap[key]) {
        monthlyMap[key] = { expected: 0, collected: 0 };
      }
      monthlyMap[key].expected += inst.amount;
      monthlyMap[key].collected += inst.paidAmount || (inst.status === 'Paid' ? inst.amount : 0);
    });
  });

  // Convert monthlyMap to sorted list
  const getMonthLabel = (key: string) => {
    const [year, month] = key.split('-');
    if (!year || !month) return key;
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const idx = parseInt(month, 10) - 1;
    return `${monthNames[idx] || month} '${year.slice(-2)}`;
  };

  const sortedMonthKeys = Object.keys(monthlyMap).sort();
  // If no dynamic months exist, supply safe fallbacks
  const chartData = sortedMonthKeys.length > 0 
    ? sortedMonthKeys.slice(0, 6).map(key => ({
        key,
        label: getMonthLabel(key),
        expected: monthlyMap[key].expected,
        collected: monthlyMap[key].collected,
        uncollected: Math.max(0, monthlyMap[key].expected - monthlyMap[key].collected),
      }))
    : [
        { key: '2026-01', label: "Jan '26", expected: 5000, collected: 4800, uncollected: 200 },
        { key: '2026-02', label: "Feb '26", expected: 6500, collected: 6000, uncollected: 500 },
        { key: '2026-03', label: "Mar '26", expected: 7000, collected: 5500, uncollected: 1500 },
        { key: '2026-04', label: "Apr '26", expected: 8500, collected: 4000, uncollected: 4500 },
        { key: '2026-05', label: "May '26", expected: 9000, collected: 2000, uncollected: 7000 },
      ];

  // 3. Customer Risk Analysis & Top Exposure Leaderboard
  const customerDebtorList = customers.map(cust => {
    const custPlan = plans.find(p => p.customerId === cust.id);
    let totalPlanPayable = 0;
    let balanceOutstanding = 0;
    let paidAmt = 0;
    let planOverdueCount = 0;

    if (custPlan) {
      totalPlanPayable = custPlan.finalPayable;
      custPlan.schedule.forEach(inst => {
        const pAmt = inst.paidAmount || (inst.status === 'Paid' ? inst.amount : 0);
        paidAmt += pAmt;
        balanceOutstanding += Math.max(0, inst.amount - pAmt);
        if (inst.status === 'Overdue') {
          planOverdueCount++;
        }
      });
    }

    const payRatio = totalPlanPayable > 0 ? (paidAmt / totalPlanPayable) * 100 : 0;
    
    // Determine Risk Level
    let riskLevel: 'Safe' | 'Attention' | 'Critical' = 'Safe';
    if (planOverdueCount > 2 || balanceOutstanding > 10000) {
      riskLevel = 'Critical';
    } else if (planOverdueCount > 0 || !cust.active) {
      riskLevel = 'Attention';
    }

    return {
      id: cust.id,
      name: cust.name,
      code: cust.code,
      active: cust.active,
      outstanding: balanceOutstanding,
      paid: paidAmt,
      total: totalPlanPayable,
      overdueMonths: planOverdueCount,
      payRatio,
      riskLevel,
    };
  })
  .filter(c => c.total > 0) // Only focus on those with active leasing plans
  .sort((a, b) => b.outstanding - a.outstanding); // Highlight highest outstanding debts first

  // Filter debtors on search input
  const filteredDebtors = customerDebtorList.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // 4. Future Amortization Queue (Approaching Payments)
  interface PipelineItem {
    clientCode: string;
    clientName: string;
    month: number;
    amount: number;
    dueDate: string;
    status: 'Paid' | 'Unpaid' | 'Overdue';
  }

  const pipelineItems: PipelineItem[] = [];
  plans.forEach(p => {
    const cust = customers.find(c => c.id === p.customerId);
    if (cust) {
      p.schedule.forEach(inst => {
        if (inst.status !== 'Paid') {
          pipelineItems.push({
            clientCode: cust.code,
            clientName: cust.name,
            month: inst.monthNumber,
            amount: inst.amount,
            dueDate: inst.dueDate,
            status: inst.status
          });
        }
      });
    }
  });
  // Sort by earliest approaching dueDate
  const approachingQueue = pipelineItems
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
    .slice(0, 4);

  // 5. Expand Summary Statistic Card Items
  const statsOverview = [
    {
      id: "stat-portfolio",
      title: "Total Portfolio Value",
      subtitle: "合同总融资包规模",
      value: formatRM(totalLeasePortfolio),
      desc: `${plans.length} credit financing contract lines`,
      icon: Landmark,
      color: "text-indigo-900 bg-indigo-50 border-indigo-100",
      trend: { text: "Average size " + formatRM(avgContractSize), isUp: true }
    },
    {
      id: "stat-collected",
      title: "Realized Collection",
      subtitle: "已收回资金总额",
      value: formatRM(totalCollected),
      desc: `${completionRate}% global repayment clearance`,
      icon: ClipboardCheck,
      color: "text-emerald-900 bg-emerald-50 border-emerald-100",
      trend: { text: `${paidCount} / ${totalInstallmentCount} cleared inst.`, isUp: true }
    },
    {
      id: "stat-outstanding",
      title: "Outstanding Principal",
      subtitle: "未收回期供余值",
      value: formatRM(totalOutstanding),
      desc: "Simulated credit line active balance",
      icon: Coins,
      color: "text-amber-950 bg-amber-50 border-amber-100",
      trend: { text: `${unpaidCount} installments remaining`, isUp: false }
    },
    {
      id: "stat-overdue",
      title: "Direct Overdue Portfolio",
      subtitle: "直属逾期应付未付金额",
      value: formatRM(overdueOutstandingAmount),
      desc: `${overdueCount} penalty installments currently delayed`,
      icon: ShieldAlert,
      color: overdueCount > 0 
        ? "text-rose-900 bg-rose-50 border-rose-200 animate-pulse-subtle" 
        : "text-slate-600 bg-slate-50 border-slate-100",
      trend: { text: "Requires manual debt reminder", isUp: false }
    },
    {
      id: "stat-revenue",
      title: "Accumulated Late Fees",
      subtitle: "累计逾期滞纳与罚息",
      value: formatRM(simulatedStats.totalLateFees + simulatedStats.overallPenaltyAmount),
      desc: "Contractual compounding trailing fines",
      icon: AlertTriangle,
      color: "text-amber-900 bg-yellow-50/50 border-yellow-100",
      trend: { text: "Pending settlement collections", isUp: false }
    },
    {
      id: "stat-borrowers",
      title: "Debtor Client Files",
      subtitle: "信用融资登记账户",
      value: `${customers.length}`,
      desc: `${activeCustomersCount} Active / ${inactiveCustomersCount} Inactive`,
      icon: Users,
      color: "text-cyan-900 bg-cyan-50 border-cyan-100",
      trend: { text: `${Math.round((activeCustomersCount / Math.max(1, customers.length)) * 100)}% utilization`, isUp: true }
    }
  ];

  // SVG Chart Dimensions & Computations
  const maxExpected = Math.max(...chartData.map(d => d.expected), 1000);
  const chartHeight = 140;
  const chartWidth = 500;
  const paddingLeft = 45;
  const paddingRight = 15;
  const paddingTop = 15;
  const paddingBottom = 25;
  const graphHeight = chartHeight - paddingTop - paddingBottom;
  const graphWidth = chartWidth - paddingLeft - paddingRight;

  return (
    <div className="space-y-6">
      {/* 1. Extended High-Fidelity Stats Grid */}
      <div id="extended-stats-grid" className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {statsOverview.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div
              key={card.id}
              className="p-5.5 rounded-3xl bg-white border border-slate-150/80 soft-card-shadow flex flex-col justify-between transition-all duration-300 hover:-translate-y-1 hover:shadow-md relative overflow-hidden text-left group"
              style={{ animationDelay: `${idx * 0.08}s` }}
            >
              {/* Subtle background glow effect on hover */}
              <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-slate-50 rounded-full group-hover:scale-125 transition-all duration-500 opacity-60 pointer-events-none" />
              
              <div className="flex items-start justify-between relative z-10">
                <div className="space-y-1">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                    {card.title}
                  </span>
                  <span className="text-[8.5px] font-semibold text-slate-400 block -mt-0.5">
                    {card.subtitle}
                  </span>
                  <h3 className="text-2xl font-black tracking-tight text-slate-905 font-mono pt-1">
                    {card.value}
                  </h3>
                </div>
                <div className={`p-2.5 rounded-xl border ${card.color} shrink-0 shadow-3xs`}>
                  <Icon className="w-4 h-4 shrink-0" />
                </div>
              </div>

              <div className="mt-4.5 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] relative z-10">
                <span className="text-slate-450 truncate font-light block pr-2">
                  {card.desc}
                </span>
                <span className={`font-semibold shrink-0 flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[9.5px] ${
                  card.trend.isUp 
                    ? "text-emerald-600 bg-emerald-50" 
                    : "text-amber-600 bg-amber-50"
                }`}>
                  {card.trend.isUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                  <span>{card.trend.text}</span>
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* 2. Visual Performance Mix & Monthly Cash Flow Trends (Analytics Row) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Expected vs Collected Monthly Line/Bar Flow Chart (Dynamic SVG) */}
        <div className="col-span-12 lg:col-span-8 bg-white border border-slate-150/80 p-6 rounded-3xl soft-card-shadow text-left flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3 mb-4.5">
              <div>
                <h3 className="text-xs font-black text-slate-805 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-2 h-2 bg-indigo-500 rounded-full"></span>
                  <span>Credit Amortization & Cash Flow Timeline</span>
                </h3>
                <p className="text-[10.5px] text-slate-400 font-light">
                  Active lease-line collection performance against scheduled deadlines
                </p>
              </div>
              <div className="flex gap-4.5 text-[10px] items-center text-slate-500 font-bold bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-150 font-sans">
                <div className="flex items-center gap-1.5">
                  <span className="inline-block w-2.5 h-2.5 bg-indigo-500 rounded-sm"></span>
                  <span>Contractual Due (期供)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="inline-block w-2.5 h-2.5 bg-emerald-500 rounded-sm"></span>
                  <span>Realized Rev (实收)</span>
                </div>
              </div>
            </div>

            {/* Render gorgeous interactive multi-series responsive SVG chart */}
            <div className="w-full relative h-[150px] overflow-hidden select-none">
              <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-full">
                {/* Horizontal Grid Lines */}
                {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
                  const y = paddingTop + graphHeight * (1 - pct);
                  const val = val => formatRM(val);
                  return (
                    <g key={i} className="opacity-45">
                      <line 
                        x1={paddingLeft} 
                        y1={y} 
                        x2={chartWidth - paddingRight} 
                        y2={y} 
                        stroke="#e2e8f0" 
                        strokeWidth="0.8" 
                        strokeDasharray="3 3" 
                      />
                      <text 
                        x={paddingLeft - 8} 
                        y={y + 3} 
                        textAnchor="end" 
                        className="fill-slate-400 font-mono text-[8px]"
                      >
                        {formatRM(maxExpected * pct).replace("RM ", "")}
                      </text>
                    </g>
                  );
                })}

                {/* Plot Months Bar & Line points */}
                {chartData.map((d, i) => {
                  const step = graphWidth / Math.max(1, chartData.length - 1);
                  const x = paddingLeft + i * step;

                  const expectedHeight = (d.expected / maxExpected) * graphHeight;
                  const collectedHeight = (d.collected / maxExpected) * graphHeight;
                  
                  const yExpected = chartHeight - paddingBottom - expectedHeight;
                  const yCollected = chartHeight - paddingBottom - collectedHeight;

                  const barWidth = 14;

                  return (
                    <g key={d.key} className="group/item">
                      {/* Expected Bar (Slate outline background) */}
                      <rect 
                        x={x - barWidth / 2} 
                        y={yExpected} 
                        width={barWidth} 
                        height={expectedHeight} 
                        fill="#cbd5e1" 
                        opacity="0.35" 
                        rx="1.5"
                      />

                      {/* Overdue/Outstanding Bar (Indigo gradient fill) */}
                      <rect 
                        x={x - barWidth / 2} 
                        y={yExpected} 
                        width={barWidth} 
                        height={Math.max(0, expectedHeight - collectedHeight)} 
                        fill="url(#indigoGrad)"
                        rx="1.5"
                      />

                      {/* Collected Solid fill (Emerald) */}
                      <rect 
                        x={x - barWidth / 2} 
                        y={yCollected} 
                        width={barWidth} 
                        height={collectedHeight} 
                        fill="#10b981" 
                        rx="1.5"
                        className="transition-all duration-300 hover:fill-emerald-400"
                      />

                      {/* Dynamic hover indicator line */}
                      <line 
                        x1={x} 
                        y1={paddingTop} 
                        x2={x} 
                        y2={chartHeight - paddingBottom} 
                        stroke="#818cf8" 
                        strokeWidth="1" 
                        strokeDasharray="2 2" 
                        className="opacity-0 group-hover/item:opacity-30 pointer-events-none" 
                      />

                      {/* X Axis Labels */}
                      <text 
                        x={x} 
                        y={chartHeight - paddingBottom + 12} 
                        textAnchor="middle" 
                        className="fill-slate-500 font-semibold text-[8.5px]"
                      >
                        {d.label}
                      </text>

                      {/* Hover Tooltip Value (Micro size in SVG text) */}
                      <g className="opacity-0 group-hover/item:opacity-100 pointer-events-none transition-all duration-200">
                        <rect 
                          x={Math.max(10, x - 55)} 
                          y={Math.max(2, yExpected - 25)} 
                          width="110" 
                          height="20" 
                          fill="#1e293b" 
                          rx="3" 
                        />
                        <text 
                          x={Math.max(10, x - 55) + 55} 
                          y={Math.max(2, yExpected - 25) + 12} 
                          textAnchor="middle" 
                          className="fill-white font-mono text-[7.5px] font-black"
                        >
                          Due {formatRM(d.expected)} | Rec {formatRM(d.collected)}
                        </text>
                      </g>
                    </g>
                  );
                })}

                {/* Definitions for gradients */}
                <defs>
                  <linearGradient id="indigoGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" />
                    <stop offset="100%" stopColor="#4f46e5" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
          </div>
          <div className="mt-3.5 bg-slate-50 rounded-2xl p-3 border border-slate-150 flex flex-col md:flex-row md:items-center justify-between gap-2.5">
            <span className="text-[10px] text-slate-500 font-medium">
              💡 **Active Flow Analysis**: Portfolio collection maintains a healthy clearance. Keep overdue recovery rates supervised.
            </span>
            <div className="flex gap-3 text-[10px] shrink-0">
              <span className="text-slate-400 font-bold">Cumulative expected: <span className="text-indigo-600 font-black">{formatRM(totalLeasePortfolio)}</span></span>
              <span className="text-slate-400 font-bold">Collected: <span className="text-emerald-600 font-black">{formatRM(totalCollected)}</span></span>
            </div>
          </div>
        </div>

        {/* Portfolio Status Distribution (Circular/Donut visualization) */}
        <div className="col-span-12 lg:col-span-4 bg-white border border-slate-150/80 p-6 rounded-3xl soft-card-shadow text-left flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-black text-slate-805 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
              <span>Amortization Mix Breakdown</span>
            </h3>
            <p className="text-[10.5px] text-slate-400 font-light mb-4">
              Repayment allocation statuses across all contracts
            </p>

            {/* Custom SVG Donut Chart */}
            <div className="flex items-center justify-center py-2">
              <div className="relative w-30 h-30 flex items-center justify-center">
                <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                  {/* Background Base Ring */}
                  <circle cx="50" cy="50" r="40" fill="transparent" stroke="#f1f5f9" strokeWidth="12" />
                  
                  {/* Dynamic Ring Slices */}
                  {(() => {
                    const totalCount = Math.max(1, totalInstallmentCount);
                    const paidPct = paidCount / totalCount;
                    const overduePct = overdueCount / totalCount;
                    const upcomingPct = Math.max(0, 1 - paidPct - overduePct);

                    const paidLength = paidPct * 251.2;
                    const overdueLength = overduePct * 251.2;
                    const upcomingLength = upcomingPct * 251.2;

                    // Compute accumulated offsets
                    let offset = 0;
                    const slicePaid = { length: paidLength, offset: offset };
                    offset += paidLength;
                    const sliceUpcoming = { length: upcomingLength, offset: offset };
                    offset += upcomingLength;
                    const sliceOverdue = { length: overdueLength, offset: offset };

                    return (
                      <>
                        {/* Slice 1: Paid (Emerald) */}
                        {paidLength > 0 && (
                          <circle 
                            cx="50" cy="50" r="40" 
                            fill="transparent" 
                            stroke="#10b981" 
                            strokeWidth="12" 
                            strokeDasharray={`${slicePaid.length} 251.2`} 
                            strokeDashoffset={-slicePaid.offset}
                            strokeLinecap="round"
                            className="transition-all duration-300"
                          />
                        )}
                        {/* Slice 2: Upcoming (Slate/Indigo-Light) */}
                        {upcomingLength > 0 && (
                          <circle 
                            cx="50" cy="50" r="40" 
                            fill="transparent" 
                            stroke="#818cf8" 
                            strokeWidth="12" 
                            strokeDasharray={`${sliceUpcoming.length} 251.2`} 
                            strokeDashoffset={-sliceUpcoming.offset}
                            strokeLinecap="round"
                            className="transition-all duration-300"
                          />
                        )}
                        {/* Slice 3: Overdue (Rose/Red) */}
                        {overdueLength > 0 && (
                          <circle 
                            cx="50" cy="50" r="40" 
                            fill="transparent" 
                            stroke="#f43f5e" 
                            strokeWidth="12" 
                            strokeDasharray={`${sliceOverdue.length} 251.2`} 
                            strokeDashoffset={-sliceOverdue.offset}
                            strokeLinecap="round"
                            className="transition-all duration-300"
                          />
                        )}
                      </>
                    );
                  })()}
                </svg>

                {/* Center text displaying the global completion rate */}
                <div className="absolute inset-0 flex flex-col items-center justify-center space-y-0.5">
                  <span className="text-[21px] font-black text-slate-800 font-mono tracking-tight">{completionRate}%</span>
                  <span className="text-[8px] font-extrabold text-slate-400 uppercase tracking-widest">Cleared</span>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-1.5 text-[10.5px] border-t border-slate-100 pt-3">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-1.5 text-slate-500 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span>Paid (已清还期数)</span>
              </div>
              <span className="font-mono font-extrabold text-slate-700">{paidCount} ({Math.round((paidCount / Math.max(1, totalInstallmentCount)) * 100)}%)</span>
            </div>
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-1.5 text-slate-500 font-medium">
                <span className="w-2 h-2 rounded-full bg-indigo-400"></span>
                <span>Upcoming (待还期数)</span>
              </div>
              <span className="font-mono font-extrabold text-slate-700">{totalInstallmentCount - paidCount - overdueCount} ({Math.round(((totalInstallmentCount - paidCount - overdueCount) / Math.max(1, totalInstallmentCount)) * 100)}%)</span>
            </div>
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-1.5 text-slate-500 font-medium font-bold">
                <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                <span className="text-rose-600">Overdue (逾期坏账)</span>
              </div>
              <span className="font-mono font-extrabold text-rose-600">{overdueCount} ({Math.round((overdueCount / Math.max(1, totalInstallmentCount)) * 100)}%)</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Operational Risk Analysis & Active Credit Pipelines */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Left Side: Top Debtors Exposure Tracker */}
        <div className="bg-white border border-slate-150/80 p-5 rounded-3xl soft-card-shadow text-left flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3 mb-3.5">
              <div>
                <h3 className="text-xs font-black text-slate-805 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-2 h-2 bg-[#D12440] rounded-full"></span>
                  <span>Portfolio Risk Exposure Ledgers</span>
                </h3>
                <p className="text-[10.5px] text-slate-400 font-light">
                  Debtors evaluated by outstanding balance and delayed periods
                </p>
              </div>
              
              {/* Search Mini Filter */}
              <div className="relative shrink-0">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
                <input
                  type="text"
                  placeholder="Filter client..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-2 py-1 border border-slate-200 focus:border-indigo-400 focus:outline-none rounded-lg text-[9.5px] w-36 bg-slate-50/50 focus:bg-white font-medium transition-all"
                />
              </div>
            </div>

            <div className="space-y-3.5 max-h-[200px] overflow-y-auto pr-1">
              {filteredDebtors.length > 0 ? (
                filteredDebtors.map((debtor) => (
                  <div key={debtor.id} className="p-3 bg-slate-50/65 hover:bg-slate-50 border border-slate-150 rounded-2xl flex flex-col gap-2 transition-all">
                    <div className="flex justify-between items-center text-[11px]">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[9px] font-black text-indigo-700 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded-md">
                          {debtor.code}
                        </span>
                        <span className="font-bold text-slate-800">{debtor.name}</span>
                        {!debtor.active && (
                          <span className="text-[7.5px] text-slate-400 border border-slate-200 px-1 rounded-sm uppercase tracking-wide">Inactive</span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {debtor.riskLevel === 'Critical' ? (
                          <span className="text-[8px] font-extrabold text-rose-600 bg-rose-50 border border-rose-100 px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse-subtle">Critical</span>
                        ) : debtor.riskLevel === 'Attention' ? (
                          <span className="text-[8px] font-extrabold text-amber-600 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-full uppercase tracking-wider">Attention</span>
                        ) : (
                          <span className="text-[8px] font-extrabold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full uppercase tracking-wider">On Track</span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-[10px]">
                      <div>
                        <span className="text-[8px] text-slate-400 uppercase font-semibold">Allocated Debt</span>
                        <p className="font-mono font-black text-slate-750">{formatRM(debtor.outstanding)}</p>
                      </div>
                      <div>
                        <span className="text-[8px] text-slate-400 uppercase font-semibold">Total Obligation</span>
                        <p className="font-mono text-slate-500 font-bold">{formatRM(debtor.total)}</p>
                      </div>
                      <div>
                        <span className="text-[8px] text-slate-400 uppercase font-semibold">Overdue Periods</span>
                        <p className="font-bold text-rose-600 font-mono">{debtor.overdueMonths} months</p>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[8px] text-slate-400 font-bold">
                        <span>Clearance Rate</span>
                        <span>{Math.round(debtor.payRatio)}%</span>
                      </div>
                      <div className="w-full bg-slate-200/60 h-1.5 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-500 ${
                            debtor.riskLevel === 'Critical' ? 'bg-rose-500' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${debtor.payRatio}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-[11px] text-slate-400 font-light">
                  No active financing client found.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Side: Next 3 Approaching Installment Pipeline */}
        <div className="bg-white border border-slate-150/80 p-5 rounded-3xl soft-card-shadow text-left flex flex-col justify-between">
          <div>
            <div className="border-b border-slate-100 pb-3 mb-3.5">
              <h3 className="text-xs font-black text-slate-805 uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2 h-2 bg-indigo-500 rounded-full"></span>
                <span>Refinance Collections Pipeline</span>
              </h3>
              <p className="text-[10.5px] text-slate-400 font-light">
                Chronological schedule queue approaching standard contract deadlines
              </p>
            </div>

            <div className="space-y-3 text-xs">
              {approachingQueue.length > 0 ? (
                approachingQueue.map((item, index) => {
                  const isOverdue = item.status === 'Overdue';
                  return (
                    <div 
                      key={`${item.clientCode}-${index}`}
                      className="p-3 border rounded-2xl flex items-center justify-between text-[11px] hover:bg-slate-50 transition-colors duration-200"
                      style={{
                        borderColor: isOverdue ? '#fecdd3' : '#e2e8f0',
                        backgroundColor: isOverdue ? '#fff1f2/40' : 'transparent',
                      }}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[8px] font-black text-slate-500 bg-slate-100 border border-slate-200 px-1 py-0.5 rounded">
                            {item.clientCode}
                          </span>
                          <span className="font-extrabold text-slate-800">{item.clientName}</span>
                        </div>
                        <div className="flex items-center gap-1 text-[9.5px] text-slate-450 font-light">
                          <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>Due on {item.dueDate} (Month #{item.month})</span>
                        </div>
                      </div>

                      <div className="text-right space-y-1">
                        <p className="font-mono font-black text-slate-900">{formatRM(item.amount)}</p>
                        {isOverdue ? (
                          <span className="text-[7.5px] font-black text-rose-600 bg-rose-50 border border-rose-100 px-1.5 py-0.5 rounded uppercase tracking-wider animate-pulse">OVERDUE</span>
                        ) : (
                          <span className="text-[7.5px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded uppercase tracking-wider">UPCOMING</span>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-8 text-center text-slate-400 font-light">
                  Perfect! No outstanding or upcoming collection cycles registered.
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 font-medium">
            <span>Amortization intervals are structured cleanly. Override is restricted to contractual revisions.</span>
            <Activity className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
          </div>
        </div>

      </div>
    </div>
  );
};
