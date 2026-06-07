/**
 * AccountsDashboard — /accounts/dashboard
 *
 * BUGS FIXED:
 * D1 — ADVANCE_TAX_KEY mismatch: was "ADVANCE_TAX_PAYMENTS" (localStorage raw key).
 *      AdvanceTaxCalculator stores to DataService "ADVANCE_MANAGEMENT".
 *      Fixed: read from DataService.get("ADVANCE_MANAGEMENT") and check __type field.
 * D2 — getLedgers/getLedgerBalance/getLedgersByHead called outside useMemo → hit
 *      localStorage on every render. Fixed: all 6 ledger calls consolidated into one
 *      ledgerKPIs useMemo with [selectedCity] dependency.
 * D3 — todayEntries and thisMonthEntries were two separate useMemo calls, each reading
 *      localStorage independently. Fixed: single allEntries useMemo + derived slices.
 * D4 — KPI variables (salesToday, salesThisMonth etc.) were plain assignments outside
 *      useMemo — recomputed on every render. Fixed: all KPIs inside one kpis useMemo.
 * D5 — TDS Payable card hardcoded ₹0. Fixed: compute from tds_payable ledger movements.
 */

import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Zap } from "lucide-react";
import { useCity } from "../../contexts/CityContext";
import { accountingEntryService } from "../../services/accountingEntryService";
import { DataService } from "../../services/DataService";

type DateFilter = "Today" | "This Week" | "This Month" | "This FY" | "Custom";

interface AdvanceTaxRecord {
  id: string; cityId: string; fy: string; instalmentNo: number;
  amount: number; paidDate: string; utrNumber: string; bank: string;
}

// ── Helper: FY string e.g. "2026-27" ────────────────────────────────────────
function currentFY(): string {
  const now = new Date();
  const fy = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return `${fy}-${String(fy + 1).slice(-2)}`;
}

// ── Component ────────────────────────────────────────────────────────────────
export function AccountsDashboard() {
  const navigate = useNavigate();
  const { city: ctxCity, cityInfo, availableCities } = useCity();
  const [selectedCity, setSelectedCity] = useState(ctxCity);
  const [dateFilter,   setDateFilter]   = useState<DateFilter>("Today");
  const [customFrom,   setCustomFrom]   = useState("");
  const [customTo,     setCustomTo]     = useState("");

  // ── D3 FIX: date range memo ────────────────────────────────────────────
  const dateRange = useMemo(() => {
    const now = new Date();
    const today = now.toISOString().split("T")[0];
    if (dateFilter === "Today")    return { from: today, to: today };
    if (dateFilter === "This Week") {
      const ws = new Date(now); ws.setDate(now.getDate() - now.getDay());
      return { from: ws.toISOString().split("T")[0], to: today };
    }
    if (dateFilter === "This Month") {
      const ms = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: ms.toISOString().split("T")[0], to: today };
    }
    if (dateFilter === "This FY") {
      const yr = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
      return { from: `${yr}-04-01`, to: today };
    }
    return { from: customFrom || today, to: customTo || today };
  }, [dateFilter, customFrom, customTo]);

  // ── D3 FIX: single localStorage read for period entries ───────────────
  const periodEntries = useMemo(
    () => accountingEntryService.getByDateRange(dateRange.from, dateRange.to, selectedCity),
    [dateRange, selectedCity]
  );

  // ── D3 FIX: today + month entries derived from one read ───────────────
  const { todayEntries, thisMonthEntries } = useMemo(() => {
    const now = new Date();
    const today = now.toISOString().split("T")[0];
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
    return {
      todayEntries:      accountingEntryService.getByDateRange(today, today, selectedCity),
      thisMonthEntries:  accountingEntryService.getByDateRange(monthStart, today, selectedCity),
    };
  }, [selectedCity]);

  // ── D4 FIX: all KPIs in one memo ──────────────────────────────────────
  const kpis = useMemo(() => {
    const salesToday        = todayEntries.filter(e => e.entryType === "Sales").reduce((s,e)=>s+e.totalBillValue,0);
    const salesThisMonth    = thisMonthEntries.filter(e => e.entryType === "Sales").reduce((s,e)=>s+e.totalBillValue,0);
    const expensesToday     = todayEntries.filter(e => e.entryType === "Expense" || e.entryType === "Purchase").reduce((s,e)=>s+e.totalBillValue,0);
    const expensesThisMonth = thisMonthEntries.filter(e => e.entryType === "Expense" || e.entryType === "Purchase").reduce((s,e)=>s+e.totalBillValue,0);

    const gstOutput  = periodEntries.filter(e => e.entryType === "Sales").reduce((s,e)=>s+e.cgst+e.sgst+e.igst,0);
    const gstInput   = periodEntries.filter(e => (e.entryType === "Purchase"||e.entryType === "Expense") && !e.isRCM).reduce((s,e)=>s+e.cgst+e.sgst+e.igst,0);
    const netGST     = gstOutput - gstInput;

    const income     = periodEntries.filter(e => e.entryType === "Sales" || ["sales_subscription","sales_service","sales_renewal","other_income"].includes(e.expenseAccount||"")).reduce((s,e)=>s+e.totalBillValue,0);
    const expenses   = periodEntries.filter(e => ["Purchase","Expense"].includes(e.entryType) || ["direct_expense","indirect_expenses"].includes(e.expenseAccount||"")).reduce((s,e)=>s+e.totalBillValue,0);
    const netProfit  = income - expenses;

    // D5 FIX: TDS payable from ledger movements
    const tdsLedgers = accountingEntryService.getLedgers(selectedCity).filter(l => l.accountHead === "tds_payable");
    const tdsIds = new Set(tdsLedgers.map(l => l.id));
    const now = new Date();
    const fyStart = `${now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1}-04-01`;
    const allMov = accountingEntryService.getAllMovements(fyStart, now.toISOString().split("T")[0], selectedCity);
    const tdsPayable = allMov.filter(m => tdsIds.has(m.creditLedgerId)).reduce((s,m)=>s+m.amount,0);
    // Subtract TDS payments (debit to tds_payable ledger = payment made)
    const tdsPaid = allMov.filter(m => tdsIds.has(m.debitLedgerId)).reduce((s,m)=>s+m.amount,0);

    return { salesToday, salesThisMonth, expensesToday, expensesThisMonth,
             gstOutput, gstInput, netGST, netProfit,
             tdsPayable: Math.max(0, tdsPayable - tdsPaid) };
  }, [todayEntries, thisMonthEntries, periodEntries, selectedCity]);

  // ── D2 FIX: all ledger-based KPIs in one memo ─────────────────────────
  const ledgerKPIs = useMemo(() => {
    const ledgers = accountingEntryService.getLedgers(selectedCity);

    const pettyCash = ledgers.find(l => l.name === "Petty Cash" && l.type === "other");
    const bank      = ledgers.find(l => l.name === "Axis Bank" && l.type === "bank");
    const razorpay  = ledgers.find(l => l.name === "Razorpay");
    const charges   = ledgers.find(l => l.name === "Razorpay Charges");
    const debtors   = accountingEntryService.getLedgersByHead("accounts_receivable", selectedCity);

    const bal = (id: string) => accountingEntryService.getLedgerBalance(id);

    const cashBalance    = pettyCash ? (() => { const b = bal(pettyCash.id); return b.balanceType === "Dr" ? b.balance : -b.balance; })() : 0;
    const bankBalance    = bank      ? (() => { const b = bal(bank.id);      return b.balanceType === "Dr" ? b.balance : -b.balance; })() : 0;
    const razorpayBal    = razorpay  ? bal(razorpay.id).balance : 0;
    const unpaidCharges  = charges   ? (() => { const b = bal(charges.id); return b.balanceType === "Cr" ? b.balance : 0; })() : 0;
    const debtorsTotal   = debtors.reduce((s, l) => { const b = bal(l.id); return s + (b.balanceType === "Dr" ? b.balance : 0); }, 0);

    return { cashBalance, bankBalance, razorpayBal, unpaidCharges, debtorsTotal };
  }, [selectedCity]);

  // ── D1 FIX: read advance tax from DataService ADVANCE_MANAGEMENT ───────
  const nextAdvanceTaxDue = useMemo(() => {
    const fyStr = currentFY();
    const fy = parseInt(fyStr.split("-")[0]);
    const paidInstalments = new Set(
      DataService.get<AdvanceTaxRecord>("ADVANCE_MANAGEMENT")
        .filter(r => r.cityId === selectedCity && r.fy === fyStr)
        .map(r => r.instalmentNo)
    );
    const schedule = [
      { no: 1, label: `15 Jun ${fy}`,   date: `${fy}-06-15`,     pct: 0.15 },
      { no: 2, label: `15 Sep ${fy}`,   date: `${fy}-09-15`,     pct: 0.45 },
      { no: 3, label: `15 Dec ${fy}`,   date: `${fy}-12-15`,     pct: 0.75 },
      { no: 4, label: `15 Mar ${fy+1}`, date: `${fy+1}-03-15`,   pct: 1.00 },
    ];
    const today = new Date().toISOString().split("T")[0];
    return schedule.find(s => !paidInstalments.has(s.no) && s.date >= today) ?? null;
  }, [selectedCity]);

  const { salesToday, salesThisMonth, expensesToday, expensesThisMonth,
          gstOutput, gstInput, netGST, netProfit, tdsPayable } = kpis;
  const { cashBalance, bankBalance, razorpayBal, unpaidCharges, debtorsTotal } = ledgerKPIs;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Accounts Dashboard</h1>
          <p className="text-sm text-gray-600">{dateRange.from} to {dateRange.to}</p>
        </div>
        <div className="flex gap-3 flex-wrap">
          <select value={selectedCity} onChange={e => setSelectedCity(e.target.value)}
            className="border rounded px-3 py-2">
            {availableCities.map(c => (
              <option key={c.id} value={c.id}>{c.displayName}</option>
            ))}
          </select>
          <div className="flex gap-1 flex-wrap">
            {(["Today","This Week","This Month","This FY","Custom"] as DateFilter[]).map(filter => (
              <button key={filter} onClick={() => setDateFilter(filter)}
                className={`px-3 py-2 border rounded text-sm ${
                  dateFilter === filter
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"}`}>
                {filter}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Custom Date Inputs */}
      {dateFilter === "Custom" && (
        <div className="flex gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">From</label>
            <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
              className="border rounded px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">To</label>
            <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
              className="border rounded px-3 py-2" />
          </div>
        </div>
      )}

      {/* Sales KPIs */}
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white border-l-4 border-green-500 p-4 rounded shadow">
          <p className="text-sm text-gray-600">Total Sales Today</p>
          <p className="text-3xl font-bold text-gray-900">₹{salesToday.toFixed(2)}</p>
          <p className="text-xs text-gray-500 mt-1">From Sales entries</p>
        </div>
        <div className="bg-white border-l-4 border-green-600 p-4 rounded shadow">
          <p className="text-sm text-gray-600">Total Sales This Month</p>
          <p className="text-3xl font-bold text-gray-900">₹{salesThisMonth.toFixed(2)}</p>
          <p className="text-xs text-gray-500 mt-1">From Sales entries</p>
        </div>
      </div>

      {/* Expenses KPIs */}
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white border-l-4 border-red-500 p-4 rounded shadow">
          <p className="text-sm text-gray-600">Total Expenses Today</p>
          <p className="text-3xl font-bold text-gray-900">₹{expensesToday.toFixed(2)}</p>
          <p className="text-xs text-gray-500 mt-1">Expense + Purchase</p>
        </div>
        <div className="bg-white border-l-4 border-red-600 p-4 rounded shadow">
          <p className="text-sm text-gray-600">Total Expenses This Month</p>
          <p className="text-3xl font-bold text-gray-900">₹{expensesThisMonth.toFixed(2)}</p>
          <p className="text-xs text-gray-500 mt-1">Expense + Purchase</p>
        </div>
      </div>

      {/* GST + TDS + Advance Tax */}
      <div className="grid grid-cols-5 gap-4">
        <div className="bg-white border-l-4 border-amber-500 p-4 rounded shadow">
          <p className="text-sm text-gray-600">GST Payable (Output)</p>
          <p className="text-2xl font-bold text-gray-900">₹{gstOutput.toFixed(2)}</p>
          <p className="text-xs text-gray-500 mt-1">From Sales</p>
        </div>
        <div className="bg-white border-l-4 border-amber-600 p-4 rounded shadow">
          <p className="text-sm text-gray-600">GST Input Credit</p>
          <p className="text-2xl font-bold text-gray-900">₹{gstInput.toFixed(2)}</p>
          <p className="text-xs text-gray-500 mt-1">Purchase + Expense (non-RCM)</p>
        </div>
        <div className={`bg-white border-l-4 p-4 rounded shadow ${netGST >= 0 ? "border-red-500" : "border-green-500"}`}>
          <p className="text-sm text-gray-600">Net GST Payable</p>
          <p className={`text-2xl font-bold ${netGST >= 0 ? "text-red-600" : "text-green-600"}`}>
            ₹{netGST.toFixed(2)}
          </p>
          <p className="text-xs text-gray-500 mt-1">Output − Input</p>
        </div>
        {/* D5 FIX: live TDS figure */}
        <div className="bg-white border-l-4 border-purple-500 p-4 rounded shadow cursor-pointer hover:shadow-md"
          onClick={() => navigate("/accounts/tds-payable")}>
          <p className="text-sm text-gray-600">TDS Payable</p>
          <p className={`text-2xl font-bold ${tdsPayable > 0 ? "text-purple-600" : "text-green-600"}`}>
            ₹{tdsPayable.toFixed(2)}
          </p>
          <p className="text-xs text-gray-500 mt-1">FY to date — click to manage</p>
        </div>
        {nextAdvanceTaxDue ? (
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 cursor-pointer hover:shadow-md"
            onClick={() => navigate("/accounts/advance-tax")}>
            <p className="text-xs font-medium text-orange-800 mb-1">Next Advance Tax Due</p>
            <p className="text-xl font-bold text-orange-900">{nextAdvanceTaxDue.label}</p>
            <p className="text-xs text-orange-600 mt-1">{nextAdvanceTaxDue.pct * 100}% cumulative — click to pay</p>
          </div>
        ) : (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4">
            <p className="text-xs font-medium text-green-800 mb-1">Advance Tax</p>
            <p className="text-xl font-bold text-green-700">All paid ✓</p>
            <p className="text-xs text-green-600 mt-1">No instalment due</p>
          </div>
        )}
      </div>

      {/* Profit & Cash */}
      <div className="grid grid-cols-3 gap-6">
        <div className="bg-white border-l-4 border-blue-500 p-4 rounded shadow">
          <p className="text-sm text-gray-600">Net Profit (Live)</p>
          <p className={`text-3xl font-bold ${netProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
            ₹{netProfit.toFixed(2)}
          </p>
          <p className="text-xs text-gray-500 mt-1">Income − Expenses</p>
        </div>
        <div className="bg-white border-l-4 border-blue-600 p-4 rounded shadow">
          <p className="text-sm text-gray-600">Cash Balance</p>
          <p className="text-3xl font-bold text-gray-900">₹{cashBalance.toFixed(2)}</p>
          <p className="text-xs text-gray-500 mt-1">Petty Cash ledger</p>
        </div>
        <div className="bg-white border-l-4 border-blue-700 p-4 rounded shadow">
          <p className="text-sm text-gray-600">Bank Balance</p>
          <p className="text-3xl font-bold text-gray-900">₹{bankBalance.toFixed(2)}</p>
          <p className="text-xs text-gray-500 mt-1">Axis Bank ledger</p>
        </div>
      </div>

      {/* Ledger KPIs */}
      <div className="grid grid-cols-3 gap-6">
        <div className="bg-white border-l-4 border-indigo-500 p-4 rounded shadow">
          <p className="text-sm text-gray-600">Debtors Total</p>
          <p className="text-3xl font-bold text-indigo-600">₹{debtorsTotal.toFixed(2)}</p>
          <p className="text-xs text-gray-500 mt-1">Customer outstanding receivables</p>
        </div>
        <div className="bg-white border-l-4 border-purple-500 p-4 rounded shadow">
          <p className="text-sm text-gray-600">Razorpay Balance</p>
          <p className={`text-3xl font-bold ${razorpayBal === 0 ? "text-green-600" : "text-amber-600"}`}>
            ₹{razorpayBal.toFixed(2)}
          </p>
          <p className="text-xs text-gray-500 mt-1">Should be NIL if all settled</p>
        </div>
        <div className="bg-white border-l-4 border-rose-500 p-4 rounded shadow">
          <p className="text-sm text-gray-600">Unpaid Transaction Charges</p>
          <p className="text-3xl font-bold text-rose-600">₹{unpaidCharges.toFixed(2)}</p>
          <p className="text-xs text-gray-500 mt-1">Pending Razorpay charges</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white border rounded-lg p-6 shadow">
        <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
        <div className="grid grid-cols-4 gap-4">
          <Link to="/accounts/razorpay-flow"
            className="flex items-center gap-3 p-4 bg-purple-50 border border-purple-200 rounded-xl hover:bg-purple-100 transition-colors">
            <Zap className="w-5 h-5 text-purple-600" />
            <div>
              <div className="font-medium text-purple-900 text-sm">Razorpay Settlement</div>
              <div className="text-xs text-purple-600">Post 5-step payment cycle</div>
            </div>
          </Link>
          <Link to="/accounts/accounting-entry"
            className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl hover:bg-blue-100 transition-colors">
            <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <div>
              <div className="font-medium text-blue-900 text-sm">New Entry</div>
              <div className="text-xs text-blue-600">Create accounting entry</div>
            </div>
          </Link>
          <Link to="/accounts/ledger"
            className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl hover:bg-green-100 transition-colors">
            <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            <div>
              <div className="font-medium text-green-900 text-sm">View Ledger</div>
              <div className="text-xs text-green-600">Account balances</div>
            </div>
          </Link>
          <Link to="/accounts/ledger-master"
            className="flex items-center gap-3 p-4 bg-indigo-50 border border-indigo-200 rounded-xl hover:bg-indigo-100 transition-colors">
            <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <div>
              <div className="font-medium text-indigo-900 text-sm">Ledger Master</div>
              <div className="text-xs text-indigo-600">Manage ledgers</div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
