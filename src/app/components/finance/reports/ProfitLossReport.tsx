import { useState, useMemo } from "react";
import { accountingEntryService } from "../../../services/accountingEntryService";
import { useCity } from "../../../contexts/CityContext";
import { Download, FileText, ChevronRight, ChevronDown } from "lucide-react";
import { ReportFilters } from "../FinancialReportsModule";

interface ProfitLossReportProps {
  filters: ReportFilters;
}

export function ProfitLossReport({ filters }: ProfitLossReportProps) {
  const { city } = useCity();
  const [fromDate, setFromDate] = useState(filters.startDate || "2026-04-01");
  const [toDate, setToDate] = useState(filters.endDate || new Date().toISOString().split("T")[0]);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const { incomeGroups, expenseGroups, grossIncome, grossExpenditure, netProfit } = useMemo(() => {
    const movements = accountingEntryService.getAllMovements(fromDate, toDate, city);
    const ledgers   = accountingEntryService.getLedgers(city);

    const INCOME_GROUPS = [
      { key: "sales",        label: "Sales",        heads: ["sales_subscription", "sales_service", "sales_renewal"] },
      { key: "other_income", label: "Other Income", heads: ["other_income"] },
    ];

    // FIX 8 Part A: "purchase" / "cogs" both map to COGS group so purchases appear in P&L
    const EXPENSE_GROUPS = [
      {
        key: "cogs",
        label: "Cost of Goods Sold / Purchases",
        // FIX: include both "cogs" and "purchase" account heads
        heads: ["cogs", "purchase"],
      },
      { key: "direct",      label: "Direct Expenses",   heads: ["direct_expenses"] },
      { key: "indirect",    label: "Indirect Expenses", heads: ["indirect_expenses"] },
      { key: "depreciation",label: "Depreciation",      heads: ["depreciation"] },
    ];

    const groupTotals = (groups: typeof INCOME_GROUPS, isIncome: boolean) =>
      groups.map((g) => {
        const groupLedgers = ledgers.filter((l) => g.heads.includes(l.accountHead));
        const ledgerRows = groupLedgers
          .map((ldr) => {
            const cr = movements.filter((m) => m.creditLedgerId === ldr.id).reduce((s, m) => s + m.amount, 0);
            const dr = movements.filter((m) => m.debitLedgerId  === ldr.id).reduce((s, m) => s + m.amount, 0);
            // FIX 8 Part B: expense ledger only accumulates net expense (dr-cr)
            // GST (Input CGST/SGST) goes to gst_input account head (asset), NOT to expense ledger
            // so it naturally won't appear here — provided journal entries are split correctly
            const amount = isIncome ? cr - dr : dr - cr;
            return { name: ldr.name, amount };
          })
          .filter((r) => r.amount > 0.01);
        const total = ledgerRows.reduce((s, r) => s + r.amount, 0);
        return { ...g, ledgerRows, total };
      });

    const incomeGroups  = groupTotals(INCOME_GROUPS, true);
    const expenseGroups = groupTotals(EXPENSE_GROUPS, false);
    const grossIncome       = incomeGroups.reduce((s, g) => s + g.total, 0);
    const grossExpenditure  = expenseGroups.reduce((s, g) => s + g.total, 0);
    const netProfit = grossIncome - grossExpenditure;
    return { incomeGroups, expenseGroups, grossIncome, grossExpenditure, netProfit };
  }, [fromDate, toDate, city]);

  const exportExcel = () => {
    const rows: string[][] = [
      ["PROFIT & LOSS ACCOUNT"],
      [`For the period: ${fromDate} to ${toDate}`],
      [""],
      ["INCOME", "Amount (₹)"],
    ];
    incomeGroups.forEach((g) => {
      rows.push([g.label, g.total.toFixed(2)]);
      g.ledgerRows.forEach((r) => rows.push([`  ${r.name}`, r.amount.toFixed(2)]));
    });
    rows.push(["GROSS INCOME", grossIncome.toFixed(2)], [""], ["EXPENDITURE", "Amount (₹)"]);
    expenseGroups.forEach((g) => {
      rows.push([g.label, g.total.toFixed(2)]);
      g.ledgerRows.forEach((r) => rows.push([`  ${r.name}`, r.amount.toFixed(2)]));
    });
    rows.push(["GROSS EXPENDITURE", grossExpenditure.toFixed(2)], [""]);
    rows.push([netProfit >= 0 ? "NET PROFIT" : "NET LOSS", Math.abs(netProfit).toFixed(2)]);
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `profit-loss-${fromDate}-to-${toDate}.csv`;
    a.click();
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b pb-4">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="w-6 h-6 text-blue-600" />
            <h1 className="text-2xl font-bold">Profit & Loss Account</h1>
          </div>
          <p className="text-sm text-gray-600 mt-1">Tally-format vertical report</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 border rounded text-gray-700 hover:bg-gray-50"
          >
            <Download className="w-4 h-4" />
            Print / PDF
          </button>
          <button
            onClick={exportExcel}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-full px-3 py-2 border rounded" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-full px-3 py-2 border rounded" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
          <div className="px-3 py-2 border rounded bg-white text-gray-700">{city}</div>
        </div>
      </div>

      {/* Note about GST treatment */}
      <div className="p-3 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800">
        <strong>GST note:</strong> Input GST (CGST/SGST/IGST) on expenses appears as an Asset (GST Input ITC) on the Balance Sheet, not as an expense here.
        The expense amount shown below is the <em>net taxable value only</em>.
      </div>

      {/* Tally Format Report */}
      <div className="font-mono text-sm bg-white border-2 border-gray-800 rounded-xl p-6">
        <div className="text-center font-bold text-base mb-1">PROFIT & LOSS ACCOUNT</div>
        <div className="text-center text-gray-500 text-xs mb-4">
          For the period: {fromDate} to {toDate}
        </div>
        <div className="border-t-2 border-gray-800 pt-3">
          {/* INCOME */}
          <div className="flex justify-between font-bold text-gray-700 mb-2">
            <span>INCOME</span><span className="mr-16">₹</span>
          </div>
          {incomeGroups.map((group) => (
            <div key={group.key} className="mb-1">
              <button
                className="w-full flex items-center justify-between hover:bg-gray-50 px-1 py-0.5 rounded"
                onClick={() => toggleGroup(group.key)}
              >
                <span className="flex items-center gap-1 font-medium">
                  {expandedGroups.has(group.key) ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                  {group.label}
                </span>
                <span className="mr-16">₹{group.total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
              </button>
              {expandedGroups.has(group.key) && group.ledgerRows.map((row) => (
                <div key={row.name} className="flex justify-between pl-8 text-gray-600 text-xs py-0.5">
                  <span>{row.name}</span>
                  <span className="mr-16">₹{row.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                </div>
              ))}
            </div>
          ))}
          <div className="border-t border-gray-400 mt-2 pt-1 flex justify-between font-bold">
            <span>GROSS INCOME</span>
            <span className="mr-16">₹{grossIncome.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
          </div>

          {/* EXPENDITURE */}
          <div className="flex justify-between font-bold text-gray-700 mb-2 mt-6">
            <span>EXPENDITURE</span><span className="mr-16">₹</span>
          </div>
          {expenseGroups.map((group) => (
            <div key={group.key} className="mb-1">
              <button
                className="w-full flex items-center justify-between hover:bg-gray-50 px-1 py-0.5 rounded"
                onClick={() => toggleGroup(group.key)}
              >
                <span className="flex items-center gap-1 font-medium">
                  {expandedGroups.has(group.key) ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                  {group.label}
                </span>
                <span className="mr-16">₹{group.total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
              </button>
              {expandedGroups.has(group.key) && group.ledgerRows.map((row) => (
                <div key={row.name} className="flex justify-between pl-8 text-gray-600 text-xs py-0.5">
                  <span>{row.name}</span>
                  <span className="mr-16">₹{row.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                </div>
              ))}
            </div>
          ))}
          <div className="border-t border-gray-400 mt-2 pt-1 flex justify-between font-bold">
            <span>GROSS EXPENDITURE</span>
            <span className="mr-16">₹{grossExpenditure.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
          </div>

          {/* Net Profit/Loss */}
          <div className={`border-t-2 border-gray-800 mt-4 pt-2 flex justify-between text-base font-bold ${netProfit >= 0 ? "text-green-700" : "text-red-700"}`}>
            <span>{netProfit >= 0 ? "NET PROFIT" : "NET LOSS"}</span>
            <span className="mr-16">₹{Math.abs(netProfit).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
