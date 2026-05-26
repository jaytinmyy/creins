import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import { Customer, InstallmentPlan, AuditLog, UserRole, InstallmentPlanInput, RepaymentInstallment, ExtraFeeItem } from './types';
import { INITIAL_CUSTOMERS, INITIAL_PLANS, INITIAL_AUDIT_LOGS } from './utils/mockData';
import { calculateInstallmentPlan, evaluateSchedulesWithFines, formatRM, generateCustomerCode } from './utils/calc';
import { DashboardStats } from './components/DashboardStats';
import { CustomerForm } from './components/CustomerForm';
import { InstallmentPlanCreator } from './components/InstallmentPlanCreator';
import { RepaymentScheduleTable } from './components/RepaymentScheduleTable';
import { PrintPDFContract } from './components/PrintPDFContract';
import { AuditLogView } from './components/AuditLogView';
import { 
  fetchCustomersFromDB, saveCustomerToDB, 
  fetchPlansFromDB, savePlanToDB, 
  fetchLogsFromDB, saveLogToDB, 
  fetchCompanyConfigFromDB, saveCompanyConfigToDB,
  googleSignIn, auth, googleProvider
} from './lib/firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { 
  Building2, Users, FileSpreadsheet, Landmark, CalendarRange, 
  UserSquare2, ArrowRightLeft, FileCheck, CircleUser, Calendar, 
  Clock2, ShieldAlert, BadgePlus, Power, FileText, CheckCircle2, AlertTriangle, Eye, ShieldCheck, ChevronRight, X, Edit, Settings, UploadCloud,
  Coins, ChevronLeft, PlusCircle, Printer, UserCheck
} from 'lucide-react';

export default function App() {
  // 1. Fixed Operator Role (Cancelled Role Selector / Locked as Admin)
  const role: UserRole = 'Admin' as UserRole;
  const [sessionDate, setSessionDate] = useState<string>(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }); // System Reference Date

  // 2. Core Databases State
  const [dbLoading, setDbLoading] = useState<boolean>(true);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [plans, setPlans] = useState<InstallmentPlan[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);

  // Google Sheets OAuth state
  const [isSheetsConnected, setIsSheetsConnected] = useState<boolean>(false);
  const [sheetsEmail, setSheetsEmail] = useState<string>('');

  // 3. Branded corporate config state
  const [companyProfile, setCompanyProfile] = useState({
    name: "CRE CREDIT & LEASING",
    logoUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150&auto=format&fit=crop&q=80", // beautiful premium pastel light blue / pink logo
    phoneNumber: "+6012-345 6789",
    terms: `1. Interest Guarantee: Under credit sales guidelines, interest rates apply to the collective tenure limit. Advanced settlements can request early adjustments subject to the creditor board rules.
2. Overdue Penalties: Delinquencies beyond contract payment periods incur late fees applied upon grace window expiration.
3. Contract Expiry Breach: If outstanding balances persist past maturity limits, an automated contract breach penalty fee is appended.
4. Malaysia Law Declaration: This printed receipt represents a valid transaction reference pursuant to Credit Hire Purchase sales procedures. Both parties acknowledge terms lists are legally binding.`
  });

  // 4. UI Workflow State (Only separate Dashboard, Customer Directory, and Managed Ledger)
  const [activeTab, setActiveTab] = useState<'dashboard' | 'customers' | 'ledger'>('dashboard');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('cust-1');
  
  // Custom modals controllers
  const [showAddCustomerModal, setShowAddCustomerModal] = useState<boolean>(false);
  const [customerToEdit, setCustomerToEdit] = useState<Customer | null>(null);
  
  const [showBrandingModal, setShowBrandingModal] = useState<boolean>(false);
  const [brandModelName, setBrandModelName] = useState<string>('');
  const [brandModelPhone, setBrandModelPhone] = useState<string>('');
  const [brandModelLogo, setBrandModelLogo] = useState<string>('');
  const [brandModelTerms, setBrandModelTerms] = useState<string>('');
  const [brandingLogoFileName, setBrandingLogoFileName] = useState<string>('');

  const [showCalculator, setShowCalculator] = useState<boolean>(false);
  const [showRepaymentModal, setShowRepaymentModal] = useState<boolean>(false);
  const [showPrintModal, setShowPrintModal] = useState<boolean>(false);
  const [masterModalTab, setMasterModalTab] = useState<'repayment' | 'calculator' | 'print' | 'profile'>('repayment');
  const [showImagePreview, setShowImagePreview] = useState<{ isOpen: boolean; title: string; url: string }>({
    isOpen: false,
    title: '',
    url: ''
  });

  // Bootstrap & load real Firestore values on mount
  useEffect(() => {
    async function loadDatabase() {
      try {
        setDbLoading(true);
        // Fetch values
        let dbCustomers = await fetchCustomersFromDB();
        let dbPlans = await fetchPlansFromDB();
        let dbLogs = await fetchLogsFromDB();
        let dbConfig = await fetchCompanyConfigFromDB();

        // Apply fallback profiles
        if (dbConfig) {
          setCompanyProfile({
            name: dbConfig.name,
            logoUrl: dbConfig.logoUrl,
            phoneNumber: dbConfig.phoneNumber || "+6012-345 6789",
            terms: dbConfig.terms || companyProfile.terms
          });
        } else {
          // Initialize DB config Info
          await saveCompanyConfigToDB(companyProfile);
        }

        setCustomers(dbCustomers);
        setPlans(dbPlans);
        setLogs(dbLogs);

        // Auto-select first customer
        if (dbCustomers.length > 0) {
          setSelectedCustomerId(dbCustomers[0].id);
        }
      } catch (err) {
        console.error("Firestore loading failure:", err);
      } finally {
        setDbLoading(false);
      }
    }
    loadDatabase();
  }, []);

  // Listen to Google authentication states for Sheet Appending loggers
  useEffect(() => {
    return onAuthStateChanged(auth, (usr) => {
      if (usr) {
        setIsSheetsConnected(true);
        setSheetsEmail(usr.email || 'linked-profile@google.com');
      } else {
        setIsSheetsConnected(false);
        setSheetsEmail('');
      }
    });
  }, []);

  const handleConnectSheets = async () => {
    try {
      const result = await googleSignIn();
      if (result) {
        setIsSheetsConnected(true);
        setSheetsEmail(result.user.email || 'linked-profile@google.com');

        const audit: AuditLog = {
          id: `log-${Date.now()}`,
          timestamp: new Date().toISOString(),
          userRole: role,
          userEmail: getEmailForRole(),
          action: 'SHEETS_CONNECTED',
          details: `Connected transaction logs workspace to Google Spreadsheet. Google User: ${result.user.email}`
        };
        await saveLogToDB(audit);
        setLogs(prev => [audit, ...prev]);
      }
    } catch (err) {
      console.error("Google Sheets OAuth link failed:", err);
    }
  };

  // Helper properties
  const currentCustomer = customers.find((c) => c.id === selectedCustomerId);
  const currentPlan = plans.find((p) => p.customerId === selectedCustomerId);

  // Generate simulated dynamic metrics based on the current simulation date clock
  const getSimulatedMetricsForCurrentPlan = (planItem?: InstallmentPlan, customerItem?: Customer) => {
    if (!planItem || !customerItem) {
      return {
        updatedSchedule: [],
        hasOverdueInstallments: false,
        totalLateFees: 0,
        overallPenaltyApplied: false,
        overallPenaltyAmount: 0,
        overallFinalAmount: 0,
      };
    }
    return evaluateSchedulesWithFines(planItem, customerItem, sessionDate);
  };

  // Compile total simulated aggregate info across entire portfolio
  const getSimulationAggregateStats = () => {
    let totalLateFees = 0;
    let overallPenaltyAmount = 0;
    let hasOverdue = false;

    plans.forEach((p) => {
      const c = customers.find((cust) => cust.id === p.customerId);
      if (c && c.active) {
        const stats = evaluateSchedulesWithFines(p, c, sessionDate);
        totalLateFees += stats.totalLateFees;
        overallPenaltyAmount += stats.overallPenaltyAmount;
        if (stats.hasOverdueInstallments) {
          hasOverdue = true;
        }
      }
    });

    return { totalLateFees, overallPenaltyAmount, hasOverdue };
  };

  const simulatedStats = getSimulatedMetricsForCurrentPlan(currentPlan, currentCustomer);
  const simulatedPortfolioStats = getSimulationAggregateStats();

  // 4. Action Handlers

  // Change simulated role executor email
  const getEmailForRole = () => {
    if (role === 'Admin') return 'admin@finance.my';
    if (role === 'Staff') return 'cs.agent@finance.my';
    return 'auditor.read@finance.my';
  };

  // Add new customer
  const handleAddCustomer = async (formData: Omit<Customer, 'id' | 'code' | 'active'>) => {
    const nextIndex = customers.length + 1;
    const newCode = generateCustomerCode(nextIndex);
    const newId = `cust-${Date.now()}`;

    const newCustomer: Customer = {
      ...formData,
      id: newId,
      code: newCode,
      active: true,
    };

    const newLog: AuditLog = {
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString(),
      userRole: role,
      userEmail: getEmailForRole(),
      action: 'CREATE_CUSTOMER',
      details: `Created customer profile ${newCustomer.name} (${newCustomer.code}). Term: ${newCustomer.startDate} to ${newCustomer.endDate}`,
    };

    setCustomers((prev) => [...prev, newCustomer]);
    await saveCustomerToDB(newCustomer);

    setLogs((prev) => [newLog, ...prev]);
    await saveLogToDB(newLog);

    setSelectedCustomerId(newId);
    setShowAddCustomerModal(false);

    Swal.fire({
      title: 'Customer Added!',
      text: `Customer profile ${newCustomer.name} (${newCustomer.code}) has been created successfully.`,
      icon: 'success',
      confirmButtonText: 'Understood',
      confirmButtonColor: '#0f172a',
      background: '#ffffff',
      customClass: {
        popup: 'rounded-[24px]'
      }
    });
  };

  // Edit customer profile info
  const handleEditCustomer = async (updatedCustomer: Customer) => {
    const editLog: AuditLog = {
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString(),
      userRole: role,
      userEmail: getEmailForRole(),
      action: 'EDIT_CUSTOMER',
      details: `Edited customer profile for ${updatedCustomer.name} (${updatedCustomer.code}). Term updated: ${updatedCustomer.startDate} to ${updatedCustomer.endDate}`,
    };

    setCustomers((prev) => prev.map(c => c.id === updatedCustomer.id ? updatedCustomer : c));
    await saveCustomerToDB(updatedCustomer);

    setLogs((prev) => [editLog, ...prev]);
    await saveLogToDB(editLog);

    setCustomerToEdit(null);
    setShowAddCustomerModal(false);

    Swal.fire({
      title: 'Dossier Updated!',
      text: `Dossier registry for ${updatedCustomer.name} (${updatedCustomer.code}) updated successfully.`,
      icon: 'success',
      confirmButtonText: 'Agree',
      confirmButtonColor: '#0f172a',
      background: '#ffffff',
      customClass: {
        popup: 'rounded-[24px]'
      }
    });
  };

  // Toggle customer active/inactive status
  const handleToggleCustomerActive = async (customerId: string) => {
    const updatedCustomers = customers.map((c) => {
      if (c.id === customerId) {
        const updatedActive = !c.active;
        
        const audit: AuditLog = {
          id: `log-${Date.now()}`,
          timestamp: new Date().toISOString(),
          userRole: role,
          userEmail: getEmailForRole(),
          action: 'UPDATE_CUSTOMER_STATUS',
          details: `Set customer ${c.name} (${c.code}) active status to: ${updatedActive ? 'ACTIVE' : 'INACTIVE'}`,
        };
        saveLogToDB(audit).catch(console.error);
        setLogs((logs) => [audit, ...logs]);
        
        const nextProfile = { ...c, active: updatedActive };
        saveCustomerToDB(nextProfile).catch(console.error);
        return nextProfile;
      }
      return c;
    });
    setCustomers(updatedCustomers);
  };

  // Setup/Activate new installment plan
  const handleSavePlan = async (inputs: InstallmentPlanInput, customSchedule?: RepaymentInstallment[]) => {
    if (!currentCustomer) return;

    const calc = calculateInstallmentPlan(currentCustomer.id, inputs, currentCustomer.startDate);
    const finalSchedule = customSchedule && customSchedule.length > 0 ? customSchedule : calc.schedule;
    const finalPayableTotal = customSchedule && customSchedule.length > 0
      ? customSchedule.reduce((sum, s) => sum + s.amount, 0)
      : calc.finalPayable;

    const refreshedPlan: InstallmentPlan = {
      id: currentPlan?.id ?? `plan-${Date.now()}`,
      customerId: currentCustomer.id,
      input: inputs,
      finalPayable: Math.round(finalPayableTotal * 100) / 100,
      totalInterest: calc.totalInterest,
      totalServiceFee: calc.totalServiceFee,
      totalDiscount: calc.totalDiscount,
      schedule: finalSchedule, // preserve custom baseline or fresh uncollected baseline
      createdAt: currentPlan?.createdAt ?? new Date().toISOString(),
      extraFees: currentPlan?.extraFees || []
    };

    const actionText = currentPlan ? 'MODIFIED_PLAN' : 'ESTABLISHED_PLAN';
    const audit: AuditLog = {
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString(),
      userRole: role,
      userEmail: getEmailForRole(),
      action: actionText,
      details: `${currentPlan ? 'Redefined' : 'Established'} installment matrices for ${currentCustomer.name} (${currentCustomer.code}). Core Financing: RM ${inputs.principalAmount.toFixed(2)}, Tenure: ${inputs.months} months, Adjustment: ${inputs.adjustmentMode}`,
    };

    setPlans((prev) => {
      const filtered = prev.filter((p) => p.customerId !== currentCustomer.id);
      return [...filtered, refreshedPlan];
    });
    await savePlanToDB(refreshedPlan);

    setLogs((prev) => [audit, ...prev]);
    await saveLogToDB(audit);

    setShowCalculator(false);
    setMasterModalTab('repayment');
    setActiveTab('ledger');

    Swal.fire({
      title: 'Plan Configured!',
      text: `Calculated repayment schedule has been recorded for ${currentCustomer.name}.`,
      icon: 'success',
      confirmButtonText: 'View Schedule',
      confirmButtonColor: '#0f172a',
      background: '#ffffff',
      customClass: {
        popup: 'rounded-[24px]'
      }
    });
  };

  // Portioned Payment / Deposit logging helper
  const handleUpdateInstallmentPaidAmount = async (monthNumber: number, paidAmt: number) => {
    if (!currentPlan || !currentCustomer) return;

    const updatedSchedule = currentPlan.schedule.map((inst) => {
      if (inst.monthNumber === monthNumber) {
        const totalDueForMonth = inst.amount + inst.lateFeeCharged;
        // Mark full paid if the input deposit equals or exceeds dynamic totalDueForMonth
        const isSettled = paidAmt >= totalDueForMonth;
        
        return {
          ...inst,
          paidAmount: paidAmt,
          status: isSettled ? ('Paid' as const) : ('Unpaid' as const),
          paidDate: isSettled ? sessionDate : undefined
        };
      }
      return inst;
    });

    const refreshedPlan: InstallmentPlan = {
      ...currentPlan,
      schedule: updatedSchedule
    };

    const audit: AuditLog = {
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString(),
      userRole: role,
      userEmail: getEmailForRole(),
      action: 'LOG_PAYMENT_DEPOSIT',
      details: `Logged custom cumulative payment RM ${paidAmt.toFixed(2)} on installment #${monthNumber} for ${currentCustomer.name} (${currentCustomer.code})`
    };

    setPlans(prev => prev.map(p => p.customerId === currentCustomer.id ? refreshedPlan : p));
    await savePlanToDB(refreshedPlan);

    setLogs(prev => [audit, ...prev]);
    await saveLogToDB(audit);

    Swal.fire({
      title: 'Payment Logged!',
      text: `Cumulative payment of RM ${paidAmt.toFixed(2)} on installment #${monthNumber} is successfully tracked.`,
      icon: 'success',
      confirmButtonText: 'Done',
      confirmButtonColor: '#0f172a',
      background: '#ffffff',
      customClass: {
        popup: 'rounded-[24px]'
      }
    });
  };

  // Adding Custom Extra Fees
  const handleAddExtraFee = async (amount: number, reason: string) => {
    if (!currentPlan || !currentCustomer) return;

    const extraFeeItem: ExtraFeeItem = {
      id: `fee-${Date.now()}`,
      amount,
      reason,
      date: sessionDate
    };

    const refreshedPlan: InstallmentPlan = {
      ...currentPlan,
      extraFees: [...(currentPlan.extraFees || []), extraFeeItem]
    };

    const audit: AuditLog = {
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString(),
      userRole: role,
      userEmail: getEmailForRole(),
      action: 'ADD_SURCHARGE',
      details: `Appended custom extra fee of +RM ${amount.toFixed(2)} to ${currentCustomer.name} (${currentCustomer.code}). Cause: ${reason}`
    };

    setPlans(prev => prev.map(p => p.customerId === currentCustomer.id ? refreshedPlan : p));
    await savePlanToDB(refreshedPlan);

    setLogs(prev => [audit, ...prev]);
    await saveLogToDB(audit);

    Swal.fire({
      title: 'Surcharge Appended!',
      text: `Surcharge of +RM ${amount.toFixed(2)} for "${reason}" has been successfully logged.`,
      icon: 'success',
      confirmButtonText: 'Done',
      confirmButtonColor: '#0f172a',
      background: '#ffffff',
      customClass: {
        popup: 'rounded-[24px]'
      }
    });
  };

  // Trigger corporate edit modal opening
  const handleOpenBrandingModal = () => {
    setBrandModelName(companyProfile.name);
    setBrandModelPhone(companyProfile.phoneNumber);
    setBrandModelLogo(companyProfile.logoUrl);
    setBrandModelTerms(companyProfile.terms || '');
    setBrandingLogoFileName('Current_Company_Logo.png');
    setShowBrandingModal(true);
  };

  // Save branding settings
  const handleSaveBranding = async () => {
    if (!brandModelName.trim()) return;

    const updatedProfile = {
      name: brandModelName.trim(),
      logoUrl: brandModelLogo,
      phoneNumber: brandModelPhone.trim(),
      terms: brandModelTerms.trim()
    };

    setCompanyProfile(updatedProfile);
    await saveCompanyConfigToDB({
      name: updatedProfile.name,
      logoUrl: updatedProfile.logoUrl,
      phoneNumber: updatedProfile.phoneNumber,
      terms: updatedProfile.terms
    });

    const audit: AuditLog = {
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString(),
      userRole: role,
      userEmail: getEmailForRole(),
      action: 'UPDATE_COMPANY_BRANDING',
      details: `Updated company branding details & contract covenants. Corporate Name: ${updatedProfile.name}`
    };
    setLogs(prev => [audit, ...prev]);
    await saveLogToDB(audit);
    setShowBrandingModal(false);
  };

  // Adjust contractual repayment schedule amount directly (Admin option)
  const handleUpdateInstallmentAmount = async (monthNumber: number, newAmount: number) => {
    if (!currentPlan || !currentCustomer) return;

    const oldInst = currentPlan.schedule.find(i => i.monthNumber === monthNumber);
    if (!oldInst) return;
    const oldAmount = oldInst.amount;
    const diff = newAmount - oldAmount;

    // Find all future unpaid installments after this month to redistribute the difference
    const futureUnpaid = currentPlan.schedule.filter(
      (inst) => inst.monthNumber > monthNumber && inst.status !== 'Paid'
    );

    let updatedSchedule = currentPlan.schedule.map((inst) => {
      if (inst.monthNumber === monthNumber) {
        return {
          ...inst,
          amount: newAmount,
        };
      }
      return { ...inst };
    });

    if (futureUnpaid.length > 0 && diff !== 0) {
      // Redistribute diff across future unpaid installments
      const adjustmentPerMonth = diff / futureUnpaid.length;
      updatedSchedule = updatedSchedule.map((inst) => {
        if (inst.monthNumber > monthNumber && inst.status !== 'Paid') {
          const rawNewAmount = inst.amount - adjustmentPerMonth;
          return {
            ...inst,
            amount: Math.max(0, Math.round(rawNewAmount * 100) / 100),
          };
        }
        return inst;
      });
    }

    // Recalculate remaining balances based on recalculated expected amounts
    let cumulativeAmounts = 0;
    const totalPayable = updatedSchedule.reduce((sum, s) => sum + s.amount, 0);
    const recalculatedSchedule = updatedSchedule.map((inst) => {
      cumulativeAmounts += inst.amount;
      return {
        ...inst,
        balance: Math.max(0, Math.round((totalPayable - cumulativeAmounts) * 100) / 100)
      };
    });

    const refreshedPlan: InstallmentPlan = {
      ...currentPlan,
      finalPayable: totalPayable,
      schedule: recalculatedSchedule
    };

    const audit: AuditLog = {
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString(),
      userRole: role,
      userEmail: getEmailForRole(),
      action: 'MODIFY_INSTALLMENT_AMOUNT',
      details: `Modified expected monthly installment #${monthNumber} amount to RM ${newAmount.toFixed(2)} (subsequent months auto-balanced) for ${currentCustomer.name} (${currentCustomer.code})`
    };

    setPlans(prev => prev.map(p => p.customerId === currentCustomer.id ? refreshedPlan : p));
    await savePlanToDB(refreshedPlan);

    setLogs(prev => [audit, ...prev]);
    await saveLogToDB(audit);
  };

  // Seed with starting mock records manually
  const handleLoadDemoData = async () => {
    try {
      setDbLoading(true);
      
      // Clean delete existing first to prevent collision
      setCustomers([]);
      setPlans([]);
      
      // Seed customers
      for (const c of INITIAL_CUSTOMERS) {
        await saveCustomerToDB(c);
      }
      // Seed plans
      const initializedPlans = INITIAL_PLANS.map((seed) => {
        const parentCustomer = INITIAL_CUSTOMERS.find((c) => c.id === seed.customerId);
        const startDate = parentCustomer ? parentCustomer.startDate : new Date().toISOString().split('T')[0];
        const result = calculateInstallmentPlan(seed.customerId, seed.input, startDate);
        
        let statusOverrideSchedule = result.schedule;
        if (seed.customerId === 'cust-4') {
          statusOverrideSchedule = result.schedule.map(inst => ({
            ...inst,
            status: 'Paid' as const,
            paidDate: inst.dueDate,
            paidAmount: inst.amount
          }));
        } else if (seed.customerId === 'cust-1') {
          statusOverrideSchedule = result.schedule.map((inst, idx) => {
            if (idx < 2) {
              return { ...inst, status: 'Paid' as const, paidDate: inst.dueDate, paidAmount: inst.amount };
            }
            return inst;
          });
        }
        
        return {
          ...seed,
          schedule: statusOverrideSchedule,
          finalPayable: result.finalPayable,
          totalInterest: result.totalInterest,
          totalServiceFee: result.totalServiceFee,
          totalDiscount: result.totalDiscount
        };
      });

      for (const p of initializedPlans) {
        await savePlanToDB(p);
      }

      // Seed default logs
      for (const l of INITIAL_AUDIT_LOGS) {
        await saveLogToDB(l);
      }

      // Refresh DB data
      const dbCusts = await fetchCustomersFromDB();
      const dbPls = await fetchPlansFromDB();
      const dbLgs = await fetchLogsFromDB();

      setCustomers(dbCusts);
      setPlans(dbPls);
      setLogs(dbLgs);
      if (dbCusts.length > 0) {
        setSelectedCustomerId(dbCusts[0].id);
      }

      const audit: AuditLog = {
        id: `log-${Date.now()}`,
        timestamp: new Date().toISOString(),
        userRole: role,
        userEmail: getEmailForRole(),
        action: 'LOAD_DEMO_DATA',
        details: "Initialized secure database with optional system demonstration data pack."
      };
      await saveLogToDB(audit);
      setLogs(prev => [audit, ...prev]);

    } catch (err) {
      console.error("Failed to load demo data:", err);
    } finally {
      setDbLoading(false);
    }
  };

  // Drag & drop reader for Branded Logo uploading
  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setBrandModelLogo(reader.result);
          setBrandingLogoFileName(file.name);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Loading Splash Screen aligned to CRE creamy pastel guidelines
  if (dbLoading) {
    return (
      <div className="min-h-screen bg-[#EBFAFF] text-slate-900 flex flex-col items-center justify-center font-sans">
        <div className="p-8 bg-white border-2 border-slate-900 rounded-3xl shadow-[6px_6px_0px_0px_#0f172a] text-center max-w-sm">
          <div className="flex justify-center space-x-2.5 mb-5">
            <span className="w-5 h-5 rounded-full bg-[#D0FAFB] border-2 border-slate-900 animate-bounce delay-75 shadow-xs" />
            <span className="w-5 h-5 rounded-full bg-[#FBE2ED] border-2 border-slate-900 animate-bounce delay-150 shadow-xs" />
            <span className="w-5 h-5 rounded-full bg-[#E1EEFF] border-2 border-slate-900 animate-bounce delay-300 shadow-xs" />
          </div>
          <h2 className="text-xs font-black tracking-widest uppercase text-slate-900">Connecting CRE Secured Database...</h2>
          <p className="text-[9px] text-slate-505 mt-2.5 font-mono">Initializing Firestore Client Services</p>
        </div>
      </div>
    );
  }

  return (
    <div id="fintech-container" className="min-h-screen relative bg-gradient-to-tr from-[#FAF9F5] via-[#FFF5F8]/60 to-[#F1FCFD] text-slate-800 font-sans flex flex-col justify-start select-none pb-12 tracking-wide overflow-x-hidden">
      
      {/* BACKGROUND AMBIENT DECORATIVE LAYER (FUTURISTIC KOREAN-PACKAGING DELIGHT) */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0 no-print opacity-75">
        {/* Soft Dreamy Aurora Lighting */}
        <div className="absolute -top-[10%] -left-[10%] w-[55%] h-[55%] rounded-full bg-[#E1EEFF]/45 mix-blend-multiply blur-[120px] animate-rotate-glow pointer-events-none" />
        <div className="absolute top-[35%] -right-[15%] w-[65%] h-[65%] rounded-full bg-[#FBE2ED]/50 mix-blend-multiply blur-[140px] animate-glow-pulse-slow pointer-events-none" />
        <div className="absolute top-[65%] -left-[10%] w-[50%] h-[50%] rounded-full bg-[#D0FAFB]/40 mix-blend-multiply blur-[110px] animate-glow-pulse-slow pointer-events-none" />
        <div className="absolute -bottom-[5%] right-[10%] w-[45%] h-[45%] rounded-full bg-[#FAF9F5]/80 blur-[90px] pointer-events-none" />

        {/* Floating Cute 3D-like Packaging Clouds */}
        <div className="absolute text-slate-800/10 select-none pointer-events-none text-9xl animate-float-cloud-1 opacity-20 filter blur-xs" style={{ top: '6%' }}>☁️</div>
        <div className="absolute text-slate-800/15 select-none pointer-events-none text-7xl animate-float-cloud-2 opacity-25 filter blur-xs" style={{ top: '42%' }}>☁️</div>
        <div className="absolute text-slate-800/10 select-none pointer-events-none text-8xl animate-float-cloud-3 opacity-15 filter blur-xs" style={{ top: '78%' }}>☁️</div>
        
        {/* Sparkles / Twinkling Stars (Micro-luminescent elements) */}
        <div className="absolute animate-twinkle-1 text-[#ea580c]/35 font-bold text-xl" style={{ top: '14%', left: '8%' }}>✦</div>
        <div className="absolute animate-twinkle-2 text-[#2f4f4f]/25 font-bold text-2xl" style={{ top: '22%', left: '82%' }}>✦</div>
        <div className="absolute animate-twinkle-3 text-pink-400/40 font-bold text-base" style={{ top: '56%', left: '88%' }}>✦</div>
        <div className="absolute animate-twinkle-1 text-cyan-400/35 text-sm" style={{ top: '68%', left: '16%' }}>✦</div>
        <div className="absolute animate-twinkle-2 text-indigo-400/30 text-xl" style={{ top: '82%', left: '38%' }}>✦</div>
        <div className="absolute animate-twinkle-3 text-purple-400/30 font-bold text-2xl" style={{ top: '4%', left: '52%' }}>✦</div>
        <div className="absolute animate-twinkle-1 text-rose-400/35 text-base" style={{ top: '38%', left: '4%' }}>✦</div>
        
        {/* Soft floating glow particles */}
        <div className="absolute w-2.5 h-2.5 rounded-full bg-[#D0FAFB] border-2 border-slate-900/15 shadow-sm animate-float-slow" style={{ top: '16%', left: '32%', animationDelay: '0.4s' }} />
        <div className="absolute w-3.5 h-3.5 rounded-full bg-[#FBE2ED] border-2 border-slate-900/15 shadow-sm animate-float-slow" style={{ top: '62%', left: '72%', animationDelay: '2.1s' }} />
        <div className="absolute w-3 h-3 rounded-full bg-[#E1EEFF] border-2 border-slate-900/15 shadow-sm animate-float-slow" style={{ top: '76%', left: '12%', animationDelay: '1.1s' }} />
        <div className="absolute w-2 h-2 rounded-full bg-amber-100/70 border-2 border-slate-900/15 shadow-sm animate-float-slow" style={{ top: '90%', left: '78%', animationDelay: '3.3s' }} />
      </div>

      {/* 1. TOP NAV WORKSPACE INDICATOR BANNER */}
      <header className="no-print relative z-10 bg-white/70 backdrop-blur-md border-b border-slate-205 text-slate-850 sticky top-0 z-40 shadow-sm">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-col md:flex-row items-center justify-between gap-4">
          
          {/* Logo Brand with custom Company Config logo details */}
          <div className="flex items-center space-x-3 self-start md:self-center">
            <div className="flex items-center space-x-1 p-1 bg-white rounded-xl border border-slate-100 shrink-0 soft-button-shadow">
              {companyProfile.logoUrl ? (
                <img 
                  src={companyProfile.logoUrl} 
                  alt="Corporate branding" 
                  className="w-10 h-10 object-contain rounded-lg border border-slate-100"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="flex items-center space-x-1">
                  <span className="w-8 h-8 rounded-lg border border-transparent flex items-center justify-center font-sans text-xs font-semibold bg-sky-50 text-sky-600">C</span>
                  <span className="w-8 h-8 rounded-lg border border-transparent flex items-center justify-center font-sans text-xs font-semibold bg-rose-50 text-rose-600">R</span>
                  <span className="w-8 h-8 rounded-lg border border-transparent flex items-center justify-center font-sans text-xs font-semibold bg-indigo-50 text-indigo-600">E</span>
                </div>
              )}
            </div>
            <div className="text-left">
              <h1 className="text-xs font-semibold tracking-wider font-sans flex items-center gap-1.5 text-slate-900">
                <span>{companyProfile.name}</span>
                <span className="text-[8.5px] bg-[#999999]/15 text-slate-600 py-0.5 px-2 rounded font-mono uppercase tracking-wider font-medium border border-slate-200/55">
                  ESTABLISHED
                </span>
              </h1>
              <p className="text-[9px] text-slate-400 uppercase tracking-widest font-mono mt-0.5 font-light">Internal Amortization Ledger Panel</p>
            </div>
          </div>

          {/* SANDBOX CONTROLS PANEL */}
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto font-sans">
            
            {/* BRAND DETAILS EDIT ICON POPUP TRIGGER */}
            <button
              onClick={handleOpenBrandingModal}
              disabled={role === 'Viewer'}
              className="bg-white hover:bg-slate-50 border border-slate-200 px-3.5 py-2 rounded-xl flex items-center gap-2 font-medium text-xs shrink-0 cursor-pointer soft-button-shadow hover:-translate-y-0.5 transition-all disabled:opacity-55 disabled:cursor-not-allowed"
            >
              <Settings className="w-4 h-4 text-slate-405" />
              <span>Settings</span>
            </button>

            {/* Clock Slider */}
            <div className="bg-white border border-slate-100 px-3 py-1.5 rounded-xl flex items-center gap-2.5 shrink-0 flex-1 sm:flex-initial soft-button-shadow">
              <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
              <div className="text-left font-mono">
                <span className="text-[7.5px] text-slate-400 block font-sans font-medium uppercase tracking-wider">📅 Calculation Reference Date</span>
                <input
                  type="date"
                  value={sessionDate}
                  onChange={(e) => {
                    const todayStr = new Date().toISOString().split('T')[0];
                    const newDate = e.target.value || todayStr;
                    setSessionDate(newDate);
                    // Log date shift
                    const audit: AuditLog = {
                      id: `log-${Date.now()}`,
                      timestamp: new Date().toISOString(),
                      userRole: role,
                      userEmail: getEmailForRole(),
                      action: 'CLOCK_SHIFT',
                      details: `Accounting calculation reference date updated to: ${newDate}`,
                    };
                    saveLogToDB(audit).catch(console.error);
                    setLogs((prev) => [audit, ...prev]);
                  }}
                  className="bg-transparent text-xs text-slate-700 font-medium focus:outline-none border-b border-dashed border-slate-200 pb-0.5 select-all text-center w-[105px]"
                />
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1">

        {/* CONTROLS HUB TABS */}
        <div className="no-print relative z-10 flex p-1.5 bg-white/80 backdrop-blur-md border border-slate-200/50 rounded-2xl mb-7 font-sans overflow-x-auto whitespace-nowrap gap-1 px-2.5 soft-card-shadow">
          <button
            onClick={() => { setActiveTab('dashboard'); setShowCalculator(false); }}
            className={`py-2 px-4.5 rounded-xl font-medium text-xs cursor-pointer transition-all flex items-center gap-1.5 ${
              activeTab === 'dashboard'
                ? 'bg-slate-900 text-white shadow-sm font-semibold'
                : 'bg-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100/55'
            }`}
          >
            <Building2 className="w-4 h-4 shrink-0" />
            <span>Executive Dashboard (数据主页)</span>
          </button>

          <button
            onClick={() => { setActiveTab('customers'); setShowCalculator(false); }}
            className={`py-2 px-4.5 rounded-xl font-medium text-xs cursor-pointer transition-all flex items-center gap-1.5 ${
              activeTab === 'customers' && !showCalculator
                ? 'bg-slate-900 text-white shadow-sm font-semibold'
                : 'bg-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100/55'
            }`}
          >
            <Users className="w-4 h-4 shrink-0" />
            <span>Debtor Profile Dir (客户档案)</span>
          </button>

          {activeTab === 'ledger' && currentCustomer && (
            <button
              onClick={() => setActiveTab('ledger')}
              className={`py-2 px-4.5 rounded-xl font-medium text-xs cursor-pointer transition-all flex items-center gap-1.5 ${
                activeTab === 'ledger'
                  ? 'bg-slate-900 text-white shadow-sm font-semibold'
                  : 'bg-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100/55'
              }`}
            >
              <Landmark className="w-4 h-4 shrink-0 text-pink-400 animate-pulse" />
              <span>Ledger: {currentCustomer.name} ({currentCustomer.code})</span>
            </button>
          )}
        </div>

        {/* WORKSPACE SECTIONS GRID */}
        <div className="grid grid-cols-1 gap-6">

          {/* 1. VIEWING IMAGES POPUP PREVIEW */}
          {showImagePreview.isOpen && (
            <div className="fixed inset-0 bg-slate-950/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm no-print">
              <div className="bg-white border border-slate-200/80 rounded-3xl max-w-lg w-full overflow-hidden soft-card-shadow text-left">
                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/40 text-slate-800">
                  <h3 className="text-xs font-semibold uppercase font-sans tracking-wider">{showImagePreview.title}</h3>
                  <button
                    onClick={() => setShowImagePreview({ isOpen: false, title: '', url: '' })}
                    className="p-1 hover:bg-slate-100 rounded text-slate-400 cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="p-6 flex justify-center bg-transparent">
                  <img src={showImagePreview.url} alt="Compliance document" className="max-h-[350px] object-contain rounded border border-slate-150" referrerPolicy="no-referrer" />
                </div>
                <div className="p-3 bg-slate-50/50 text-center border-t border-slate-100">
                  <span className="text-[9px] text-slate-400 font-mono tracking-wider uppercase font-medium">Secure Verification Vault</span>
                </div>
              </div>
            </div>
          )}

          {/* 2. CALCULATION TERMINAL WORKSPACE POPUP */}
          {showCalculator && currentCustomer && (
            <div className="no-print mb-6">
              <InstallmentPlanCreator
                customer={currentCustomer}
                onSavePlan={handleSavePlan}
                role={role}
                onClose={() => setShowCalculator(false)}
                existingInput={currentPlan?.input}
              />
            </div>
          )}

          {/* 3. ADD / EDIT CUSTOMER DIALOG SLIDEOVER MODAL */}
          {showAddCustomerModal && (
            <div className="fixed inset-0 bg-slate-950/35 z-50 flex items-center justify-center p-4 backdrop-blur-sm no-print">
              <div className="max-w-2xl w-full">
                <CustomerForm
                  onAddCustomer={handleAddCustomer}
                  onEditCustomer={handleEditCustomer}
                  customerToEdit={customerToEdit}
                  nextIndex={customers.length + 1}
                  role={role}
                  onClose={() => {
                    setShowAddCustomerModal(false);
                    setCustomerToEdit(null);
                  }}
                />
              </div>
            </div>
          )}

          {/* 4. BRANDING MANAGEMENT LOGO & NAME EDIT INDIVIDUAL DIALOG MODAL */}
          {showBrandingModal && (
            <div className="fixed inset-0 bg-slate-950/35 z-50 flex items-center justify-center p-4 backdrop-blur-sm no-print">
              <div className="bg-white border border-slate-200 rounded-3xl p-6 w-full max-w-md soft-card-shadow text-left">
                <div className="flex justify-between items-center border-b border-slate-100 pb-3.5 mb-5">
                  <h3 className="font-semibold text-slate-800 text-sm tracking-tight font-sans">
                    Corporate Branding Profile
                  </h3>
                  <button 
                    onClick={() => setShowBrandingModal(false)}
                    className="text-slate-400 hover:text-slate-700 cursor-pointer p-1 rounded-full hover:bg-slate-50 transition-all"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-4 font-sans text-xs">
                  <div>
                    <label className="block text-[10px] font-semibold uppercase text-slate-500 mb-1.5">Company Profile Name:</label>
                    <input
                      type="text"
                      value={brandModelName}
                      onChange={(e) => setBrandModelName(e.target.value)}
                      placeholder="e.g. CRE CREDIT & LEASING"
                      className="w-full border border-slate-200 bg-white text-slate-800 px-3 py-2 rounded-xl focus:border-slate-400 focus:outline-none transition-all text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold uppercase text-slate-500 mb-1.5">Contact Phone Suffix:</label>
                    <input
                      type="text"
                      value={brandModelPhone}
                      onChange={(e) => setBrandModelPhone(e.target.value)}
                      placeholder="e.g. +6012-345 6789"
                      className="w-full border border-slate-200 bg-white text-slate-800 px-3 py-2 rounded-xl font-mono focus:border-slate-400 focus:outline-none transition-all text-xs"
                    />
                  </div>

                  {/* Logo Base64 attachment trigger */}
                  <div>
                    <label className="block text-[10px] font-semibold uppercase text-slate-500 mb-1.5">Custom Corporate Logo (标志上传):</label>
                    <div 
                      onClick={() => document.getElementById('company-logo-file-input')?.click()}
                      className="border border-dashed border-slate-200 rounded-xl p-4.5 text-center cursor-pointer bg-slate-50 hover:bg-slate-100/50 transition-all"
                    >
                      <input 
                        type="file" 
                        id="company-logo-file-input" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={handleLogoFileChange}
                      />
                      <UploadCloud className="w-5 h-5 mx-auto text-slate-400" />
                      <p className="text-[10px] font-medium text-slate-500 mt-1.5">
                        {brandingLogoFileName ? brandingLogoFileName : 'Tap to upload Custom Seal/Logo'}
                      </p>
                    </div>

                    {brandModelLogo && (
                      <div className="mt-2.5 border border-slate-100 p-2 max-h-24 bg-slate-50/50 flex justify-center rounded-xl overflow-hidden">
                        <img src={brandModelLogo} alt="Logo preview" className="object-contain max-h-16" referrerPolicy="no-referrer" />
                      </div>
                    )}
                  </div>

                  {/* CUSTOM T&C CLAUSE SETTINGS (条规调整) */}
                  <div className="pt-2">
                    <label className="block text-[10px] font-extrabold uppercase text-slate-500 mb-1.5">
                      Document Terms & Covenants (打印合同条款设定):
                    </label>
                    <p className="text-[10px] text-slate-400 mb-1.5 leading-relaxed font-light">
                      Customize standard credit/hire-purchase clauses printed at the bottom of customer statements. Use numbers for multiple lines.
                    </p>
                    <textarea
                      rows={5}
                      value={brandModelTerms}
                      onChange={(e) => setBrandModelTerms(e.target.value)}
                      placeholder="e.g. 1. Interest Guarantee ... 2. Overdue Penalties ..."
                      className="w-full border border-slate-200 bg-white text-slate-800 px-3 py-2 rounded-xl focus:border-pink-300 focus:ring-1 focus:ring-pink-300 focus:outline-none transition-all text-xs font-mono leading-relaxed"
                    />
                  </div>

                  <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setShowBrandingModal(false)}
                      className="px-4 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-50 hover:text-slate-705 rounded-xl cursor-pointer transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveBranding}
                      className="px-5 py-2.5 bg-gradient-to-r from-pink-500 to-indigo-600 hover:from-pink-600 hover:to-indigo-705 text-white font-extrabold rounded-xl text-xs transition-all shadow-md scale-102 hover:scale-[1.03] active:scale-95 cursor-pointer"
                    >
                      Save Customizations
                    </button>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* TAB 1: CUSTOMERS DIRECTORY */}
          {activeTab === 'customers' && !showCalculator && (
            <div className="space-y-6 no-print">
              {/* Directory controls */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/70 backdrop-blur-md border border-slate-200/50 p-6 rounded-2xl shadow-sm">
                <div className="text-left animate-fade-in font-sans">
                  <h3 className="text-sm font-semibold text-slate-800 tracking-tight">
                    Debtor Registrars Index (客户档案索引)
                  </h3>
                  <p className="text-[11.5px] text-slate-400 mt-0.5 font-light">
                    Verify client metadata, active lease status files, and identity cards
                  </p>
                </div>
                
                <button
                  onClick={() => {
                    setCustomerToEdit(null);
                    setShowAddCustomerModal(true);
                  }}
                  disabled={role === 'Viewer'}
                  className={`flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold cursor-pointer shadow-sm transition-all hover:-translate-y-0.5 ${
                    role === 'Viewer' ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  <BadgePlus className="w-4 h-4" />
                  <span>Register Client Customer</span>
                </button>
              </div>

              {/* Main Directory Table */}
              <div className="bg-white/80 backdrop-blur-md rounded-[24px] border border-slate-200/55 overflow-hidden soft-card-shadow">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100 text-[10px] text-slate-500 uppercase tracking-wider font-semibold font-sans">
                        <th className="py-3.5 px-5">Cli Code / Status</th>
                        <th className="py-3.5 px-5">Full Name</th>
                        <th className="py-3.5 px-5">National IC / Phone</th>
                        <th className="py-3.5 px-5">Guarantor (担保人)</th>
                        <th className="py-3.5 px-5">Tenure Timeline</th>
                        <th className="py-3.5 px-5">Financial Plan Status</th>
                        <th className="py-3.5 px-5 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="text-xs leading-relaxed divide-y divide-slate-100 bg-white">
                      {customers.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-12 px-4 text-center font-sans">
                            <div className="flex flex-col items-center justify-center max-w-sm mx-auto">
                              <Users className="w-10 h-10 text-slate-300 mb-3 animate-pulse" />
                              <h4 className="font-semibold text-slate-800 tracking-tight text-xs uppercase">No Registered Core Debtor Profiles</h4>
                              <p className="text-slate-400 text-[11px] mt-1 text-center leading-relaxed font-light">
                                This secure database environment is currently clean and empty. Register a real debtor profile using the button above to begin generating custom financing contracts.
                              </p>
                              <button
                                type="button"
                                onClick={handleLoadDemoData}
                                className="mt-4 py-2.5 px-5 bg-slate-100 hover:bg-slate-205/65 text-slate-700 text-[10px] font-medium uppercase tracking-wider rounded-xl transition-all cursor-pointer hover:-translate-y-0.5 shadow-2xs"
                              >
                                Load System Demonstration Data
                              </button>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        customers.map((c) => {
                          const hasPlan = plans.some((p) => p.customerId === c.id);
                          const isSelected = selectedCustomerId === c.id;

                          return (
                            <tr
                                key={c.id}
                                className={`transition-all hover:bg-slate-50/40 ${
                                  isSelected ? 'bg-slate-50/70 font-medium' : ''
                                }`}
                            >
                              {/* Code & Active status */}
                              <td className="py-4 px-5 font-mono font-medium border-r border-slate-50">
                                <div className="space-y-1 text-left">
                                  <span 
                                    onClick={() => {
                                      setSelectedCustomerId(c.id);
                                      setMasterModalTab(hasPlan ? 'repayment' : 'calculator');
                                      setActiveTab('ledger');
                                    }} 
                                    className="text-slate-900 font-extrabold cursor-pointer hover:underline text-xs"
                                  >
                                    {c.code}
                                  </span>
                                  <div className="flex items-center gap-1.5">
                                    <span className={`w-1.5 h-1.5 rounded-full ${c.active ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                                    <span className={`text-[8.5px] uppercase font-bold tracking-wider ${c.active ? 'text-emerald-600' : 'text-rose-500'}`}>
                                      {c.active ? 'Active' : 'Inactive'}
                                    </span>
                                  </div>
                                </div>
                              </td>

                              {/* Full Name */}
                              <td className="py-4 px-5 text-left border-r border-slate-50">
                                <div className="font-extrabold text-slate-900 font-sans text-xs">
                                  {c.name}
                                </div>
                              </td>

                              {/* IC / Phone */}
                              <td className="py-4 px-5 text-left border-r border-slate-50">
                                <div className="font-mono text-slate-700 text-xs font-bold">{c.icNumber}</div>
                                <div className="text-slate-400 font-sans text-[10.5px] mt-0.5">{c.phoneNumber}</div>
                              </td>

                              {/* Guarantor Info */}
                              <td className="py-4 px-5 text-left border-r border-slate-50">
                                <div className="font-extrabold text-slate-900 font-sans text-xs">
                                  {c.guarantorName || 'N/A'}
                                </div>
                                <div className="text-slate-400 font-sans text-[10px] mt-0.5">
                                  {c.guarantorRelation ? `(${c.guarantorRelation})` : ''} {c.guarantorPhoneNumber || ''}
                                </div>
                              </td>

                              {/* Active Period */}
                              <td className="py-4 px-5 text-left text-slate-600 font-mono text-xs border-r border-slate-50">
                                <div className="font-semibold">{c.startDate}</div>
                                <div className="text-slate-400 text-[10px] mt-0.5">to {c.endDate}</div>
                              </td>

                              {/* Plan connection */}
                              <td className="py-4 px-5 text-left border-r border-slate-50">
                                {hasPlan ? (
                                  <span className="inline-flex items-center gap-1.5 text-blue-600 font-extrabold uppercase font-sans text-[9px] bg-blue-50 border border-blue-100/60 px-2.5 py-1 rounded-full">
                                    <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
                                    <span>Verified Plan</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1.5 text-rose-500 font-extrabold uppercase font-sans text-[9px] bg-rose-50 border border-rose-100/60 px-2.5 py-1 rounded-full">
                                    <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                                    <span>No Active Plan</span>
                                  </span>
                                )}
                              </td>

                              {/* Master Action Trigger (Unifies ALL client management tabs securely) */}
                              <td className="py-4 px-5 text-center whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedCustomerId(c.id);
                                    setMasterModalTab(hasPlan ? 'repayment' : 'calculator');
                                    setActiveTab('ledger');
                                  }}
                                  className="relative inline-flex items-center justify-between gap-2 px-3.5 py-2 border border-slate-205 hover:border-pink-200 text-xs font-bold text-slate-800 bg-white hover:bg-slate-50 rounded-2xl cursor-pointer transition-all duration-200 active:scale-95 group font-sans text-left overflow-hidden shadow-xs min-w-[135px]"
                                >
                                  {/* CRE Pastel Brand vertical strip indicator */}
                                  <span className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-[#D0FAFB] via-[#FFF0F7] to-[#E1EEFF]" />
                                  
                                  <div className="flex items-center gap-1.5 pl-1.5">
                                    <Landmark className="w-3.5 h-3.5 text-slate-450 group-hover:text-pink-500 transition-colors" />
                                    <span>{hasPlan ? 'Manage Ledger' : 'Create Plan'}</span>
                                  </div>
                                  <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 0: DASHBOARD EXECUTIVE MAIN */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6 animate-fade-in text-left no-print">
              <div className="bg-white/70 backdrop-blur-md border border-slate-200/50 p-6 rounded-3xl soft-card-shadow flex justify-between items-center flex-wrap gap-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
                    <Landmark className="w-5 h-5 text-indigo-500" />
                    <span>Executive Credit Dashboard (数据主页)</span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-1 font-light">
                    Overview of active financing performance, total collections, outstanding amounts, and simulated overdue metrics.
                  </p>
                </div>
                <div className="text-[11px] font-mono bg-slate-50 border border-slate-200 px-3 py-1 bg-white rounded-xl text-slate-500 flex items-center gap-1.5 font-semibold">
                  <Clock2 className="w-3.5 h-3.5 text-indigo-505" />
                  <span>Real-Time Matrix Refreshed</span>
                </div>
              </div>

              <DashboardStats
                customers={customers}
                plans={plans}
                simulatedStats={simulatedPortfolioStats}
              />

              {/* Additional beautiful summary elements */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white border border-slate-200/60 p-5 rounded-3xl soft-card-shadow text-left">
                  <h3 className="text-xs font-semibold text-slate-800 uppercase tracking-wider mb-3">Portfolio Highlights</h3>
                  <div className="space-y-3 font-sans text-xs">
                    <div className="flex justify-between items-center py-2 border-b border-slate-100">
                      <span className="text-slate-400">Registered Debtors</span>
                      <span className="font-semibold text-slate-800">{customers.length} client files</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-slate-100">
                      <span className="text-slate-400">Active Installment Plans</span>
                      <span className="font-semibold text-slate-800">{plans.length} active leases</span>
                    </div>
                    <div className="flex justify-between items-center py-2">
                      <span className="text-slate-400">Active Customer Ratio</span>
                      <span className="font-semibold text-slate-805">
                        {customers.length > 0 ? `${Math.round((customers.filter(c => c.active).length / customers.length) * 100)}%` : '0%'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-slate-200/60 p-5 rounded-3xl soft-card-shadow text-left">
                  <h3 className="text-xs font-semibold text-slate-800 uppercase tracking-wider mb-3">Reference Calendar Sync</h3>
                  <p className="text-xs text-slate-500 leading-relaxed font-light mb-3">
                    Calculations adapt to the 📅 <strong>Calculation Reference Date</strong> set in the header. Adjusting that date will re-evaluate overdue status, penalties, and daily interest trailing rates.
                  </p>
                  <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 flex justify-between items-center">
                    <span className="text-slate-400 text-xs">Current Reference:</span>
                    <span className="font-mono text-xs font-semibold text-slate-800 bg-white px-2.5 py-1 rounded-full border border-slate-200">{sessionDate}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: INLINE UNIFIED MASTER LEDGER WORKSPACE */}
          {activeTab === 'ledger' && currentCustomer && (
            <div className="bg-white border border-slate-200/50 rounded-3xl w-full flex flex-col overflow-hidden shadow-sm text-left relative animate-fade-in no-print">
              
              {/* CRE Brand Gradient Header line */}
              <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-[#D0FAFB] via-[#FFF0F7] to-[#E1EEFF]" />
              
              {/* Master Header */}
              <div className="p-6 pt-7 border-b border-slate-100 bg-slate-50/25 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="text-left flex items-center gap-4 font-sans">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#D0FAFB] via-[#FFF0F7] to-[#E1EEFF] p-0.5 flex items-center justify-center border border-slate-200 shadow-xs shrink-0 font-extrabold text-slate-800 text-lg">
                    {currentCustomer.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-extrabold text-[#030712] tracking-tight">
                        {currentCustomer.name}
                      </h3>
                      <span className="text-[10px] font-mono tracking-wider text-slate-500 bg-slate-100 border border-slate-200/50 px-2 py-0.5 rounded-full font-bold">
                        {currentCustomer.code}
                      </span>
                      <div className="flex items-center gap-1 bg-slate-100/50 border border-slate-205/40 px-2 py-0.5 rounded-full">
                        <span className={`w-1.5 h-1.5 rounded-full ${currentCustomer.active ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                        <span className={`text-[9px] font-extrabold uppercase ${currentCustomer.active ? 'text-emerald-600' : 'text-rose-500'}`}>
                          {currentCustomer.active ? 'Active Profile' : 'Inactive'}
                        </span>
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1 font-light">
                      National ID / Passport: <strong className="font-mono text-slate-700 font-bold">{currentCustomer.icNumber}</strong> | Primary Phone: <strong className="font-mono text-slate-700 font-bold">{currentCustomer.phoneNumber}</strong>
                    </p>
                  </div>
                </div>
                
                {/* Back button with subtle brand hover */}
                <button
                  type="button"
                  onClick={() => setActiveTab('customers')}
                  className="px-4 py-2 hover:bg-rose-50 hover:text-rose-600 rounded-2xl text-slate-500 cursor-pointer border border-slate-200 hover:border-rose-150 transition-all text-xs font-bold font-sans flex items-center gap-1 shadow-2xs"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Back to Profile List</span>
                </button>
              </div>

              {/* APPLE SEGMENT CONTROLS PILLS BAR */}
              <div className="bg-slate-50/70 p-2 border-b border-[#f1f5f9] flex flex-wrap gap-1.5 font-sans">
                <button
                  type="button"
                  onClick={() => setMasterModalTab('repayment')}
                  className={`px-5 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                    masterModalTab === 'repayment'
                      ? 'bg-gradient-to-r from-[#D0FAFB]/30 via-[#FFF0F7]/40 to-[#E1EEFF]/30 text-slate-950 shadow-sm border border-[#FFF0F7] scale-102'
                      : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/50'
                  }`}
                >
                  <Coins className="w-4 h-4" />
                  <span>Repayments Tracker (收款登记)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMasterModalTab('calculator')}
                  className={`px-5 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                    masterModalTab === 'calculator'
                      ? 'bg-gradient-to-r from-[#D0FAFB]/30 via-[#FFF0F7]/40 to-[#E1EEFF]/30 text-slate-950 shadow-sm border border-[#FFF0F7] scale-102'
                      : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/50'
                  }`}
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Installment Plan Creator (创建合约)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMasterModalTab('print')}
                  className={`px-5 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                    masterModalTab === 'print'
                      ? 'bg-gradient-to-r from-[#D0FAFB]/30 via-[#FFF0F7]/40 to-[#E1EEFF]/30 text-slate-950 shadow-sm border border-[#FFF0F7] scale-102'
                      : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/50'
                  }`}
                >
                  <Printer className="w-4 h-4" />
                  <span>Contract PDF Receipt (打印合同及收据)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMasterModalTab('profile')}
                  className={`px-5 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                    masterModalTab === 'profile'
                      ? 'bg-gradient-to-r from-[#D0FAFB]/30 via-[#FFF0F7]/40 to-[#E1EEFF]/30 text-slate-950 shadow-sm border border-[#FFF0F7] scale-102'
                      : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/50'
                  }`}
                >
                  <UserCheck className="w-4 h-4" />
                  <span>Client Compliance Dossier (核实背景)</span>
                </button>
              </div>

              {/* Master Ledger Workspace Content Panel */}
              <div className="flex-1 overflow-y-auto p-6 font-sans">
                {masterModalTab === 'repayment' && (
                  <div className="space-y-6">
                    {currentPlan ? (
                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                        {/* Repayment Action Form Table */}
                        <div className="lg:col-span-12">
                          <RepaymentScheduleTable
                            customer={currentCustomer}
                            plan={currentPlan}
                            evaluatedSchedule={simulatedStats.updatedSchedule}
                            simulatedStats={simulatedStats}
                            onUpdateInstallmentPaidAmount={handleUpdateInstallmentPaidAmount}
                            onAddExtraFee={handleAddExtraFee}
                            role={role}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-10 border border-slate-150 rounded-2xl bg-slate-50/50">
                        <Coins className="w-10 h-10 text-slate-400 mx-auto mb-3 slide-in" />
                        <h4 className="text-sm font-semibold text-slate-800">No Active Installment Plan Detected</h4>
                        <p className="text-xs text-slate-500 mt-1 mb-4">You need to configure an installment structure first before managing payments.</p>
                        <button
                          type="button"
                          onClick={() => setMasterModalTab('calculator')}
                          className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                        >
                          Configure Plan Options
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {masterModalTab === 'calculator' && (
                  <div className="bg-slate-50/30 border border-slate-150 rounded-3xl p-6 shadow-2xs">
                    <InstallmentPlanCreator 
                      customer={currentCustomer} 
                      onSavePlan={handleSavePlan} 
                      existingInput={currentPlan?.input}
                      role={role}
                      onClose={() => setMasterModalTab('repayment')}
                    />
                  </div>
                )}

                {masterModalTab === 'print' && currentPlan ? (
                  <div className="bg-slate-50/30 border border-slate-150 rounded-3xl p-6 shadow-2xs">
                    <PrintPDFContract 
                      customer={currentCustomer} 
                      plan={currentPlan}
                      evaluatedSchedule={simulatedStats.updatedSchedule}
                      simulatedStats={simulatedStats}
                      headerCompanyName={companyProfile.name}
                      headerCompanyPhone={companyProfile.phoneNumber}
                      logoUrl={companyProfile.logoUrl}
                      customTerms={companyProfile.terms}
                      onClose={() => setMasterModalTab('repayment')}
                    />
                  </div>
                ) : masterModalTab === 'print' && (
                  <div className="text-center py-10 border border-slate-150 rounded-2xl bg-slate-50/50">
                    <Coins className="w-10 h-10 text-slate-400 mx-auto mb-3" />
                    <h4 className="text-sm font-semibold text-slate-800">No Active Installment Plan Detected</h4>
                    <p className="text-xs text-slate-500 mt-1 mb-4">You need to configure an installment structure first before generating print references.</p>
                    <button
                      type="button"
                      onClick={() => setMasterModalTab('calculator')}
                      className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                    >
                      Configure Plan Options
                    </button>
                  </div>
                )}

                {masterModalTab === 'profile' && (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start font-sans">
                    {/* Compliance Profile details */}
                    <div className="lg:col-span-7 bg-white border border-slate-200/50 rounded-3xl p-6 shadow-2xs space-y-5">
                      <h4 className="text-xs font-bold text-slate-900 uppercase tracking-widest border-b border-slate-100 pb-3 flex items-center gap-1.5">
                        <Users className="w-4 h-4 text-pink-500" />
                        <span>Profile Registry Dossier</span>
                      </h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-3.5 bg-slate-50/60 rounded-xl border border-slate-100">
                          <span className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Debtor Reference ID</span>
                          <span className="font-mono text-xs font-semibold text-slate-800">{currentCustomer.id}</span>
                        </div>
                        <div className="p-3.5 bg-slate-50/60 rounded-xl border border-slate-100">
                          <span className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Profile Creation Code</span>
                          <span className="font-mono text-xs font-semibold text-slate-800">{currentCustomer.code}</span>
                        </div>
                        <div className="p-3.5 bg-slate-50/60 rounded-xl border border-slate-100">
                          <span className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Contract Commencement</span>
                          <span className="font-mono text-xs font-semibold text-slate-800">{currentCustomer.startDate}</span>
                        </div>
                        <div className="p-3.5 bg-slate-50/60 rounded-xl border border-slate-100">
                          <span className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Contract Expiration Limits</span>
                          <span className="font-mono text-xs font-semibold text-slate-800">{currentCustomer.endDate}</span>
                        </div>
                      </div>
                      <div className="p-4 bg-teal-50/15 border border-teal-100 rounded-2xl flex gap-3 text-left">
                        <ShieldCheck className="w-5 h-5 text-teal-600 shrink-0 mt-0.5" />
                        <div>
                          <h5 className="text-xs font-bold text-teal-950">Background Screening Resolved</h5>
                          <p className="text-[11px] text-[#0d9488] leading-relaxed mt-1">This profile complies with operational guidelines. Multi-image Identity Verification is stored in the secure compliant dossier panel on the right.</p>
                        </div>
                      </div>
                    </div>

                    {/* Compliance Vault File Cards previews */}
                    <div className="lg:col-span-5 bg-white border border-slate-200/55 rounded-3xl p-6 shadow-2xs space-y-5">
                      <h4 className="text-xs font-bold text-slate-900 uppercase tracking-widest border-b border-slate-100 pb-3 flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-[#0d9488]" />
                        <span>Client Compliance Secure Vault</span>
                      </h4>

                      <div className="space-y-4">
                        {/* 1. Identity Preview */}
                        <div className="space-y-2">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">National Identification ({currentCustomer.icImages && currentCustomer.icImages.length > 0 ? `${currentCustomer.icImages.length}/2` : '1'} IC Card Proof)</span>
                          <div className="grid grid-cols-2 gap-2">
                            {(currentCustomer.icImages && currentCustomer.icImages.length > 0 ? currentCustomer.icImages : [currentCustomer.icImage]).map((img, idx) => (
                              <div 
                                key={idx}
                                onClick={() => setShowImagePreview({ isOpen: true, title: `IC Dossier Vault [${idx+1}]: ${currentCustomer.name}`, url: img })}
                                className="group relative h-20 border border-slate-150 rounded-xl overflow-hidden cursor-pointer bg-slate-50 flex items-center justify-center transition-all hover:border-pink-200 hover:shadow-2xs"
                              >
                                <img 
                                  src={img} 
                                  alt="IC Doc thumbnail" 
                                  className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:opacity-85 transition-opacity" 
                                  referrerPolicy="no-referrer"
                                />
                                <div className="relative bg-slate-900/65 text-white p-1 text-[8px] font-bold rounded flex items-center gap-1 group-hover:scale-105 transition-all">
                                  <Eye className="w-2.5 h-2.5 text-[#D0FAFB]" />
                                  <span>Expand</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* 2. Business Address Proof */}
                        <div className="space-y-2">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Evidence / Rental Lease ({currentCustomer.proofImages && currentCustomer.proofImages.length > 0 ? `${currentCustomer.proofImages.length}/5` : '1'} Documents)</span>
                          <div className="grid grid-cols-3 gap-1.5 font-sans">
                            {(currentCustomer.proofImages && currentCustomer.proofImages.length > 0 ? currentCustomer.proofImages : [currentCustomer.proofImage]).map((img, idx) => (
                              <div 
                                key={idx}
                                onClick={() => setShowImagePreview({ isOpen: true, title: `Evidence [${idx+1}]: ${currentCustomer.name}`, url: img })}
                                className="group relative h-16 border border-slate-150 rounded-xl overflow-hidden cursor-pointer bg-slate-50 flex items-center justify-center transition-all hover:border-pink-200 hover:shadow-2xs"
                              >
                                <img 
                                  src={img} 
                                  alt="Proof Doc thumbnail" 
                                  className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:opacity-85 transition-opacity" 
                                  referrerPolicy="no-referrer"
                                />
                                <div className="relative bg-slate-900/65 text-white p-1 text-[8px] font-bold rounded flex items-center gap-1 group-hover:scale-105 transition-all">
                                  <Eye className="w-2.5 h-2.5 text-[#D0FAFB]" />
                                  <span>Expand</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                  </div>
                )}
              </div>
              
              {/* Master Modal Footer */}
              <div className="p-4 bg-slate-50/70 border-t border-slate-100 flex justify-end gap-3.5">
                <button
                  type="button"
                  onClick={() => setActiveTab('customers')}
                  className="px-5 py-2.5 bg-gradient-to-r from-[#D0FAFB]/60 via-[#FFF0F7]/60 to-[#E1EEFF]/60 hover:from-[#D0FAFB] hover:to-[#E1EEFF] border border-slate-250 text-slate-800 font-extrabold rounded-2xl text-[11px] uppercase tracking-wider transition-all shadow-3xs cursor-pointer hover:scale-[1.02] active:scale-95"
                >
                  Exit Master Ledger
                </button>
              </div>

            </div>
          )}

          {/* DYNAMIC MODAL LAYER 1: DIRECT REPAYMENT SCHEDULE MODAL POPUP */}
          {showRepaymentModal && currentCustomer && currentPlan && (
            <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden soft-card-shadow no-print text-left">
                {/* Modal Header */}
                <div className="p-4.5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                  <div className="text-left font-sans">
                    <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
                      <Coins className="w-4.5 h-4.5 text-blue-600" />
                      <span>Client Payment Ledger Track (还款管理及实收记录)</span>
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Client: <strong className="text-slate-800">{currentCustomer.name}</strong> ({currentCustomer.code}) | Active Amortization Overview
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowRepaymentModal(false)}
                    className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-700 transition-colors cursor-pointer border-0 outline-none"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                {/* Modal Body */}
                <div className="p-6 overflow-y-auto flex-1 bg-[#FAF9F5]/40 select-none">
                  <RepaymentScheduleTable
                    customer={currentCustomer}
                    plan={currentPlan}
                    evaluatedSchedule={simulatedStats.updatedSchedule}
                    simulatedStats={simulatedStats}
                    onUpdateInstallmentPaidAmount={handleUpdateInstallmentPaidAmount}
                    onAddExtraFee={handleAddExtraFee}
                    role={role}
                  />
                </div>
                {/* Modal Footer */}
                <div className="p-3 border-t border-slate-101 bg-slate-50 flex justify-end gap-3.5">
                  <button
                    type="button"
                    onClick={() => setShowRepaymentModal(false)}
                    className="px-5 py-2bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl text-xs transition-all shadow-sm cursor-pointer"
                  >
                    Close Matrix
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* DYNAMIC MODAL LAYER 2: DIRECT A4 PRINT STATEMENT MODAL POPUP */}
          {showPrintModal && currentCustomer && currentPlan && (
            <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden soft-card-shadow text-left">
                {/* Modal Header */}
                <div className="p-4.5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center no-print border-t-[3px] border-t-[#D0FAFB]">
                  <div className="text-left font-sans">
                    <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
                      <FileText className="w-4.5 h-4.5 text-amber-605" />
                      <span>Corporate Sales Purchase Agreement Statement & Printable Slip (合同打印/收据)</span>
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Client Ref: <strong className="text-slate-800">{currentCustomer.name}</strong> ({currentCustomer.code}) | High Density A4 Format
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowPrintModal(false)}
                    className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-700 cursor-pointer border-0 outline-none"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                {/* Modal Body */}
                <div className="p-6 overflow-y-auto flex-1 bg-slate-110">
                  <PrintPDFContract
                    customer={currentCustomer}
                    plan={currentPlan}
                    evaluatedSchedule={simulatedStats.updatedSchedule}
                    simulatedStats={simulatedStats}
                    headerCompanyName={companyProfile.name}
                    headerCompanyPhone={companyProfile.phoneNumber}
                    logoUrl={companyProfile.logoUrl}
                    customTerms={companyProfile.terms}
                    onClose={() => setShowPrintModal(false)}
                  />
                </div>
                {/* Modal Footer */}
                <div className="p-3 border-t border-slate-101 bg-slate-50 flex justify-end gap-3.5 no-print">
                  <button
                    type="button"
                    onClick={() => setShowPrintModal(false)}
                    className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl text-xs transition-all shadow-sm cursor-pointer"
                  >
                    Done Statement
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* DYNAMIC MODAL LAYER 3: DETACHED POPUP COVER NOT ACTIVE */}
          {false && currentCustomer && (
            <div className="fixed inset-0 bg-slate-950/45 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto font-sans no-print">
              <div className="bg-white/95 backdrop-blur-lg border border-slate-200/80 rounded-[32px] w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl text-left animate-fade-in relative">
                
                {/* CRE Brand Gradient Header line */}
                <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-[#D0FAFB] via-[#FFF0F7] to-[#E1EEFF]" />
                
                {/* Master Header */}
                <div className="p-6 pt-7 border-b border-slate-100 bg-slate-50/25 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div className="text-left flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#D0FAFB] via-[#FFF0F7] to-[#E1EEFF] p-0.5 flex items-center justify-center border border-slate-200 shadow-xs shrink-0 font-extrabold text-slate-800 text-lg">
                      {currentCustomer.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-extrabold text-slate-950 tracking-tight">
                          {currentCustomer.name}
                        </h3>
                        <span className="text-[10px] font-mono tracking-wider text-slate-500 bg-slate-100 border border-slate-200/50 px-2 py-0.5 rounded-full font-bold">
                          {currentCustomer.code}
                        </span>
                        <div className="flex items-center gap-1 bg-slate-100/50 border border-slate-205/40 px-2 py-0.5 rounded-full">
                          <span className={`w-1.5 h-1.5 rounded-full ${currentCustomer.active ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                          <span className={`text-[9px] font-extrabold uppercase ${currentCustomer.active ? 'text-emerald-600' : 'text-rose-500'}`}>
                            {currentCustomer.active ? 'Active Profile' : 'Inactive'}
                          </span>
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1 font-light">
                        National ID / Passport: <strong className="font-mono text-slate-700 font-bold">{currentCustomer.icNumber}</strong> | Primary Phone: <strong className="font-mono text-slate-700 font-bold">{currentCustomer.phoneNumber}</strong>
                      </p>
                    </div>
                  </div>
                  
                  {/* Close button with subtle brand hover */}
                  <button
                    type="button"
                    onClick={() => setActiveTab('customers')}
                    className="p-2 hover:bg-rose-50 hover:text-rose-600 rounded-2xl text-slate-400 cursor-pointer border border-transparent hover:border-rose-100/40 absolute top-5 right-5 transition-all"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* APPLE SEGMENT CONTROLS PILLS BAR */}
                <div className="bg-slate-50/70 p-2 border-b border-slate-100 flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setMasterModalTab('repayment')}
                    className={`px-5 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                      masterModalTab === 'repayment'
                        ? 'bg-gradient-to-r from-[#D0FAFB]/30 via-[#FFF0F7]/40 to-[#E1EEFF]/30 text-slate-950 shadow-sm border border-[#FFF0F7] scale-102'
                        : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/50'
                    }`}
                  >
                    <Coins className="w-4 h-4 text-emerald-600" />
                    <span>Statement Ledger (账单实收)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMasterModalTab('calculator')}
                    className={`px-5 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                      masterModalTab === 'calculator'
                        ? 'bg-gradient-to-r from-[#D0FAFB]/30 via-[#FFF0F7]/40 to-[#E1EEFF]/30 text-slate-950 shadow-sm border border-[#FFF0F7] scale-102'
                        : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/50'
                    }`}
                  >
                    <Landmark className="w-4 h-4 text-slate-600" />
                    <span>Amortization Plan (计算设定)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMasterModalTab('print')}
                    className={`px-5 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                      masterModalTab === 'print'
                        ? 'bg-gradient-to-r from-[#D0FAFB]/30 via-[#FFF0F7]/40 to-[#E1EEFF]/30 text-slate-950 shadow-sm border border-[#FFF0F7] scale-102'
                        : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/50'
                    }`}
                  >
                    <FileText className="w-4 h-4 text-amber-550" />
                    <span>Print Contract Slips (打印合同/收据)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMasterModalTab('profile')}
                    className={`px-5 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                      masterModalTab === 'profile'
                        ? 'bg-gradient-to-r from-[#D0FAFB]/30 via-[#FFF0F7]/40 to-[#E1EEFF]/30 text-slate-950 shadow-sm border border-[#FFF0F7] scale-102'
                        : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/50'
                    }`}
                  >
                    <CircleUser className="w-4 h-4 text-indigo-500" />
                    <span>Client Profile & Safe (客户档案资料)</span>
                  </button>
                </div>

                {/* Unified Master Panel Viewport */}
                <div className="flex-1 overflow-y-auto p-6 bg-[#FAF9F5]/25">
                  
                  {/* TAB 1: Ledger Statement collections */}
                  {masterModalTab === 'repayment' && (
                    <div className="space-y-4 animate-fade-in text-left">
                      {currentPlan ? (
                        <RepaymentScheduleTable
                          customer={currentCustomer}
                          plan={currentPlan}
                          evaluatedSchedule={simulatedStats.updatedSchedule}
                          simulatedStats={simulatedStats}
                          onUpdateInstallmentPaidAmount={handleUpdateInstallmentPaidAmount}
                          onAddExtraFee={handleAddExtraFee}
                          role={role}
                        />
                      ) : (
                        <div className="bg-white border border-slate-200/55 rounded-3xl p-12 text-center flex flex-col items-center justify-center">
                          <AlertTriangle className="w-10 h-10 text-slate-350 mb-4 animate-pulse" />
                          <h4 className="text-xs font-bold text-slate-900 tracking-wider uppercase">No Active Amortization Found</h4>
                          <p className="text-xs text-slate-400 mt-1.5 max-w-sm leading-relaxed font-light">
                            To trace installments, setup the core financial formulas for {currentCustomer.name} first under the "Amortization Plan" tab.
                          </p>
                          <button
                            type="button"
                            onClick={() => setMasterModalTab('calculator')}
                            className="mt-5 px-5 py-2.5 rounded-xl text-xs font-bold uppercase bg-slate-900 hover:bg-slate-800 text-white transition-all cursor-pointer shadow-sm hover:-translate-y-0.5"
                          >
                            Configure Lease Formula Now
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 2: Calculator Plan Creation */}
                  {masterModalTab === 'calculator' && (
                    <div className="animate-fade-in text-left">
                      <InstallmentPlanCreator
                        customer={currentCustomer}
                        onSavePlan={handleSavePlan}
                        role={role}
                        onClose={() => setMasterModalTab('repayment')}
                        existingInput={currentPlan?.input}
                      />
                    </div>
                  )}

                  {/* TAB 3: Print contracts and slip templates */}
                  {masterModalTab === 'print' && (
                    <div className="animate-fade-in text-left bg-transparent">
                      {currentPlan ? (
                        <PrintPDFContract
                          customer={currentCustomer}
                          plan={currentPlan}
                          evaluatedSchedule={simulatedStats.updatedSchedule}
                          simulatedStats={simulatedStats}
                          headerCompanyName={companyProfile.name}
                          headerCompanyPhone={companyProfile.phoneNumber}
                          logoUrl={companyProfile.logoUrl}
                          customTerms={companyProfile.terms}
                          onClose={() => setMasterModalTab('repayment')}
                        />
                      ) : (
                        <div className="bg-white border border-slate-200/60 rounded-3xl p-12 text-center flex flex-col items-center justify-center">
                          <FileText className="w-10 h-10 text-slate-350 mb-4 animate-pulse" />
                          <h4 className="text-xs font-bold text-slate-900 tracking-wider uppercase">Active Lease Required</h4>
                          <p className="text-xs text-slate-400 mt-1.5 max-w-sm leading-relaxed font-light">
                            Cannot construct printable contract covenants because {currentCustomer.name} has no established payment configuration.
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 4: Client Profile details and compliance images safe */}
                  {masterModalTab === 'profile' && (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start text-left animate-fade-in">
                      
                      {/* Personal File fields */}
                      <div className="lg:col-span-7 bg-white border border-slate-200/55 rounded-3xl p-6 shadow-2xs space-y-5">
                        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-widest flex items-center gap-2">
                            <UserSquare2 className="w-4 h-4 text-indigo-500" />
                            <span>Dossier Core Profile Details</span>
                          </h4>
                          <button
                            type="button"
                            onClick={() => {
                              setCustomerToEdit(currentCustomer);
                              setShowAddCustomerModal(true);
                            }}
                            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-[10px] font-bold tracking-wider uppercase flex items-center gap-1 cursor-pointer transition-all hover:scale-102"
                          >
                            <Edit className="w-3.5 h-3.5" />
                            <span>Edit Profile</span>
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-4 text-xs font-sans">
                          <div>
                            <span className="text-[10px] uppercase text-slate-400 block font-bold mb-0.5">Debtor Full Name</span>
                            <p className="font-extrabold text-slate-900 text-sm">{currentCustomer.name}</p>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase text-slate-400 block font-bold mb-0.5">IC Document ID</span>
                            <p className="font-bold text-slate-700 font-mono">{currentCustomer.icNumber}</p>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase text-slate-400 block font-bold mb-0.5">Primary Contact No</span>
                            <p className="font-semibold text-slate-700 font-mono">{currentCustomer.phoneNumber}</p>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase text-slate-400 block font-bold mb-0.5">Contract Term Timeline</span>
                            <p className="font-medium text-slate-700">
                              <span className="font-semibold">{currentCustomer.startDate}</span> to <span className="font-semibold">{currentCustomer.endDate}</span>
                            </p>
                          </div>
                          <div className="col-span-2">
                            <span className="text-[10px] uppercase text-slate-400 block font-bold mb-0.5">Home / Office Address</span>
                            <p className="font-medium text-slate-600 bg-slate-50/50 border border-slate-150 p-3 rounded-xl leading-relaxed">
                              {currentCustomer.homeAddress || 'No Address Logged'}
                            </p>
                          </div>
                        </div>

                        {/* Status Switcher trigger */}
                        <div className="pt-4 border-t border-slate-100 flex items-center justify-between flex-wrap gap-3">
                          <div>
                            <h5 className="text-[11px] font-bold text-slate-900">Toggle Profile Ingress Status</h5>
                            <p className="text-[10px] text-slate-400 mt-0.5 leading-relaxed max-w-md">
                              Deactivated records freeze daily schedules recalculations and lock payment inputs.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleToggleCustomerActive(currentCustomer.id)}
                            className={`px-4 py-2 border rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer shadow-3xs ${
                              currentCustomer.active
                                ? 'bg-rose-50 border-rose-100 text-rose-600 hover:bg-rose-100'
                                : 'bg-emerald-50 border-emerald-100 text-emerald-600 hover:bg-emerald-100'
                            }`}
                          >
                            <Power className="w-3.5 h-3.5" />
                            <span>{currentCustomer.active ? 'Disable Debtor' : 'Enable Debtor'}</span>
                          </button>
                        </div>
                      </div>

                      {/* Compliance Vault File Cards previews */}
                      <div className="lg:col-span-5 bg-white border border-slate-200/55 rounded-3xl p-6 shadow-2xs space-y-5">
                        <h4 className="text-xs font-bold text-slate-900 uppercase tracking-widest border-b border-slate-100 pb-3 flex items-center gap-1.5">
                          <ShieldCheck className="w-4 h-4 text-emerald-500" />
                          <span>Client Compliance Secure Vault</span>
                        </h4>

                        <div className="space-y-4">
                          {/* 1. Identity Preview */}
                          <div className="space-y-2">
                            <span className="text-[10px] uppercase font-bold text-slate-400 block">National Identification ({currentCustomer.icImages && currentCustomer.icImages.length > 0 ? `${currentCustomer.icImages.length}/2` : '1'} IC Card Proof)</span>
                            <div className="grid grid-cols-2 gap-2">
                              {(currentCustomer.icImages && currentCustomer.icImages.length > 0 ? currentCustomer.icImages : [currentCustomer.icImage]).map((img, idx) => (
                                <div 
                                  key={idx}
                                  onClick={() => setShowImagePreview({ isOpen: true, title: `IC Dossier Vault [${idx+1}]: ${currentCustomer.name}`, url: img })}
                                  className="group relative h-20 border border-slate-150 rounded-xl overflow-hidden cursor-pointer bg-slate-50 flex items-center justify-center transition-all hover:border-pink-200 hover:shadow-2xs"
                                >
                                  <img 
                                    src={img} 
                                    alt="IC Doc thumbnail" 
                                    className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:opacity-85 transition-opacity" 
                                    referrerPolicy="no-referrer"
                                  />
                                  <div className="relative bg-slate-900/65 text-white p-1 text-[8px] font-bold rounded flex items-center gap-1 group-hover:scale-105 transition-all">
                                    <Eye className="w-2.5 h-2.5 text-[#D0FAFB]" />
                                    <span>Expand</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* 2. Business Address Proof */}
                          <div className="space-y-2">
                            <span className="text-[10px] uppercase font-bold text-slate-400 block">Evidence / Rental Lease ({currentCustomer.proofImages && currentCustomer.proofImages.length > 0 ? `${currentCustomer.proofImages.length}/5` : '1'} Documents)</span>
                            <div className="grid grid-cols-3 gap-1.5 font-sans">
                              {(currentCustomer.proofImages && currentCustomer.proofImages.length > 0 ? currentCustomer.proofImages : [currentCustomer.proofImage]).map((img, idx) => (
                                <div 
                                  key={idx}
                                  onClick={() => setShowImagePreview({ isOpen: true, title: `Evidence [${idx+1}]: ${currentCustomer.name}`, url: img })}
                                  className="group relative h-16 border border-slate-150 rounded-xl overflow-hidden cursor-pointer bg-slate-50 flex items-center justify-center transition-all hover:border-pink-200 hover:shadow-2xs"
                                >
                                  <img 
                                    src={img} 
                                    alt="Proof Doc thumbnail" 
                                    className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:opacity-85 transition-opacity" 
                                    referrerPolicy="no-referrer"
                                  />
                                  <div className="relative bg-slate-900/65 text-white p-1 text-[8px] font-bold rounded flex items-center gap-1 group-hover:scale-105 transition-all">
                                    <Eye className="w-2.5 h-2.5 text-[#D0FAFB]" />
                                    <span>Expand</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>

                    </div>
                  )}

                </div>
                
                {/* Master Modal Footer */}
                <div className="p-4 bg-slate-50/70 border-t border-slate-100 flex justify-end gap-3.5">
                  <button
                    type="button"
                    onClick={() => setActiveTab('customers')}
                    className="px-5 py-2.5 bg-gradient-to-r from-[#D0FAFB]/60 via-[#FFF0F7]/60 to-[#E1EEFF]/60 hover:from-[#D0FAFB] hover:to-[#E1EEFF] border border-slate-205 text-slate-800 font-extrabold rounded-2xl text-[11px] uppercase tracking-wider transition-all shadow-3xs cursor-pointer hover:scale-[1.02] active:scale-95"
                  >
                    Close Master Ledger
                  </button>
                </div>

              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
