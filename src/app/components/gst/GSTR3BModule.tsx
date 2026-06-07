import { useState, useMemo } from "react";
import { ReceiptText, Download, AlertTriangle, Lock } from "lucide-react";
import { gstComplianceService, COMPANY_GST_CONFIG } from "../../services/gstComplianceService";
import { showExportMenu } from "../../utils/gstExportUtils";
import { useCity } from "../../contexts/CityContext";

export function GSTR3BModule() {
  const { city } = useCity();
  const [selectedMonth, setSelectedMonth] = useState(4);
  const [selectedYear, setSelectedYear] = useState(2026);
  const [selectedGSTIN, setSelectedGSTIN] = useState(COMPANY_GST_CONFIG.gstin);
  const [status, setStatus] = useState<"Not Generated" | "Generated" | "Approved" | "Ready to File">("Not Generated");
  const [isApproved, setIsApproved] = useState(false);

  const transactions = gstComplianceService.getTransactions(city);
  const reconciliation = gstComplianceService.getReconciliation();

  const monthTransactions = useMemo(() =>
    transactions.filter(t =>
      t.month === selectedMonth &&
      t.year === selectedYear &&
      t.status === "Approved"
    ),
    [transactions, selectedMonth, selectedYear]
  );

  const salesTransactions = useMemo(() =>
    (monthTransactions || []).filter(t => t.transactionType === "Sale"),
    [monthTransactions]
  );

  const purchaseTransactions = useMemo(() =>
    (monthTransactions || []).filter(t => t.transactionType === "Purchase"),
    [monthTransactions]
  );

  const table31 = useMemo(() => {
    // Row (a): Outward taxable supplies (other than zero rated, nil rated, exempt)
    const taxableSupplies = (salesTransactions || []).filter(t =>
      t.supplyNature === "Taxable" || (!t.supplyNature && t.gstRate > 0)
    );
    const taxableValue = taxableSupplies.reduce((s, t) => s + t.taxableValue, 0);
    const taxableIGST = taxableSupplies.reduce((s, t) => s + t.igst, 0);
    const taxableCGST = taxableSupplies.reduce((s, t) => s + t.cgst, 0);
    const taxableSGST = taxableSupplies.reduce((s, t) => s + t.sgst, 0);

    // Row (b): Zero rated outward supplies
    const zeroRatedSupplies = (salesTransactions || []).filter(t => t.supplyNature === "ZeroRated");
    const zeroRatedValue = zeroRatedSupplies.reduce((s, t) => s + t.taxableValue, 0);

    // Row (c): Nil rated, exempt
    const nilExemptSupplies = (salesTransactions || []).filter(t =>
      t.supplyNature === "NilRated" || t.supplyNature === "Exempt"
    );
    const nilExemptValue = nilExemptSupplies.reduce((s, t) => s + t.taxableValue, 0);

    // Row (d): Inward supplies liable to Reverse Charge (from purchase transactions)
    const rcmSupplies = purchaseTransactions.filter(t => t.reverseCharge);
    const rcmValue = rcmSupplies.reduce((s, t) => s + t.taxableValue, 0);
    const rcmIGST = rcmSupplies.reduce((s, t) => s + t.igst, 0);
    const rcmCGST = rcmSupplies.reduce((s, t) => s + t.cgst, 0);
    const rcmSGST = rcmSupplies.reduce((s, t) => s + t.sgst, 0);

    // Row (e): Non-GST outward supplies
    const nonGSTSupplies = (salesTransactions || []).filter(t => t.supplyNature === "NonGST");
    const nonGSTValue = nonGSTSupplies.reduce((s, t) => s + t.taxableValue, 0);

    return {
      taxableValue, taxableIGST, taxableCGST, taxableSGST,
      zeroRatedValue,
      nilExemptValue,
      rcmValue, rcmIGST, rcmCGST, rcmSGST,
      nonGSTValue
    };
  }, [salesTransactions, purchaseTransactions]);

  // Table 3.2 — Inter-State Supplies (state-wise breakdown for inter-state B2C)
  const table32 = useMemo(() => {
    const interStateB2C = (salesTransactions || []).filter(t =>
      t.supplyType === "INTER_STATE" && !t.customerGSTIN
    );
    const stateWise = interStateB2C.reduce((acc, t) => {
      const state = t.customerState || "Unknown";
      if (!acc[state]) {
        acc[state] = { taxableValue: 0, igst: 0 };
      }
      acc[state].taxableValue += t.taxableValue;
      acc[state].igst += t.igst;
      return acc;
    }, {} as Record<string, { taxableValue: number; igst: number }>);
    return stateWise;
  }, [salesTransactions]);

  // Table 4 — Eligible ITC
  const itcData = useMemo(() => {
    // A(5) "All other ITC" — from purchase transactions itcEligible === true
    const allOtherITC = purchaseTransactions
      .filter(t => t.itcEligible && !t.reverseCharge)
      .reduce((s, t) => s + t.itcAmount, 0);

    // A(4) "Self-assessed tax on RCM" — from RCM transactions after payment tagged
    const rcmITC = purchaseTransactions
      .filter(t => t.reverseCharge && t.itcEligible)
      .reduce((s, t) => s + t.itcAmount, 0);

    // B "ITC Reversed" — manual entry field (placeholder for now)
    const itcReversed = 0;

    // C "Net ITC" — calculated
    const netITC = allOtherITC + rcmITC - itcReversed;

    // Reconciliation with GSTR-2B
    const itcFrom2B = reconciliation
      .filter(r => r.month === selectedMonth && r.year === selectedYear && r.itcClaimable)
      .reduce((s, r) => s + r.gstAmount, 0);
    const difference = netITC - itcFrom2B;

    return { allOtherITC, rcmITC, itcReversed, netITC, itcFrom2B, difference };
  }, [purchaseTransactions, reconciliation, selectedMonth, selectedYear]);

  const table6 = useMemo(() => {
    const outputTax = salesTransactions.reduce((s, t) => s + t.totalTax, 0);
    const itcCredit = itcData.netITCAvailable;
    const cashPayment = Math.max(0, outputTax - itcCredit);

    return { outputTax, itcCredit, cashPayment };
  }, [salesTransactions, itcData]);

  const handleApprove = () => {
    setIsApproved(true);
    setStatus("Ready to File");
  };

  const handleExport31 = (e: React.MouseEvent) => {
    const data = [
      {
        "Nature of Supply": "(a) Outward taxable supplies",
        "Taxable Value": table31.taxableValue,
        "IGST": table31.taxableIGST,
        "CGST": table31.taxableCGST,
        "SGST": table31.taxableSGST
      },
      {
        "Nature of Supply": "(b) Zero-rated supplies",
        "Taxable Value": table31.zeroRatedValue,
        "IGST": 0,
        "CGST": 0,
        "SGST": 0
      },
      {
        "Nature of Supply": "(c) Nil/Exempt supplies",
        "Taxable Value": table31.nilExemptValue,
        "IGST": 0,
        "CGST": 0,
        "SGST": 0
      },
      {
        "Nature of Supply": "(d) RCM supplies",
        "Taxable Value": table31.rcmValue,
        "IGST": table31.rcmIGST,
        "CGST": table31.rcmCGST,
        "SGST": table31.rcmSGST
      },
      {
        "Nature of Supply": "(e) Non-GST supplies",
        "Taxable Value": table31.nonGSTValue,
        "IGST": 0,
        "CGST": 0,
        "SGST": 0
      }
    ];
    showExportMenu(data, "gstr3b-table-3.1", e.currentTarget as HTMLElement);
  };

  const handleExportITC = (e: React.MouseEvent) => {
    const data = [
      {
        "Description": "A(5) All other ITC",
        "Amount": itcData.allOtherITC
      },
      {
        "Description": "A(4) Self-assessed RCM",
        "Amount": itcData.rcmITC
      },
      {
        "Description": "B ITC Reversed",
        "Amount": -itcData.itcReversed
      },
      {
        "Description": "C Net ITC",
        "Amount": itcData.netITC
      }
    ];
    showExportMenu(data, "gstr3b-table-4-itc", e.currentTarget as HTMLElement);
  };

  const handleExportTable6 = (e: React.MouseEvent) => {
    const data = [{
      "Output Tax": table6.outputTax,
      "ITC Credit": table6.itcCredit,
      "Cash Payment Required": table6.cashPayment
    }];
    showExportMenu(data, "gstr3b-table-6-net-tax", e.currentTarget as HTMLElement);
  };

  const handleDownloadFullGSTR3BCSV = () => {
    const rows: string[] = [];
    const BOM = "\uFEFF";

    const esc = (v: any) => {
      const s = String(v ?? "");
      return s.includes(",") || s.includes('"') || s.includes("\n")
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    };

    const buildSection = (title: string, headers: string[], dataRows: string[][]) => {
      rows.push(title);
      rows.push(headers.map(esc).join(","));
      dataRows.forEach(row => rows.push(row.map(esc).join(",")));
      rows.push("");
    };

    // Header
    rows.push(`GSTR-3B Summary Report`);
    rows.push(`GSTIN: ${selectedGSTIN}`);
    rows.push(`Period: ${selectedMonth} ${selectedYear}`);
    rows.push(`Status: ${status}`);
    rows.push(`Generated: ${new Date().toLocaleString()}`);
    rows.push("");
    rows.push("");

    // Table 3.1 — Outward Supplies
    buildSection(
      "Table 3.1 — Details of Outward Supplies",
      ["Nature of Supply", "Txbl. Value (₹)", "IGST (₹)", "CGST (₹)", "SGST (₹)", "Cess (₹)"],
      [
        ["(a) Outward taxable supplies", (table31?.taxableValue ?? 0).toFixed(2), (table31?.taxableIGST ?? 0).toFixed(2), (table31?.taxableCGST ?? 0).toFixed(2), (table31?.taxableSGST ?? 0).toFixed(2), "0.00"],
        ["(b) Zero-rated supplies", (table31?.zeroRatedValue ?? 0).toFixed(2), "0.00", "0.00", "0.00", "0.00"],
        ["(c) Nil/Exempt supplies", (table31?.nilExemptValue ?? 0).toFixed(2), "0.00", "0.00", "0.00", "0.00"],
        ["(d) RCM supplies", (table31?.rcmValue ?? 0).toFixed(2), (table31?.rcmIGST ?? 0).toFixed(2), (table31?.rcmCGST ?? 0).toFixed(2), (table31?.rcmSGST ?? 0).toFixed(2), "0.00"],
        ["(e) Non-GST supplies", (table31?.nonGSTValue ?? 0).toFixed(2), "0.00", "0.00", "0.00", "0.00"]
      ]
    );

    // Table 3.2 — Inter-State Supplies
    if (Object.entries(table32).length > 0) {
      const stateRows = Object.entries(table32).map(([state, data]) => [
        state,
        (data?.taxableValue ?? 0).toFixed(2),
        (data?.igst ?? 0).toFixed(2)
      ]);
      buildSection(
        "Table 3.2 — Inter-State Supplies",
        ["State", "Taxable Value (₹)", "IGST (₹)"],
        stateRows
      );
    }

    // Table 4 — Eligible ITC
    buildSection(
      "Table 4 — Eligible ITC",
      ["Description", "IGST (₹)", "CGST (₹)", "SGST (₹)", "Cess (₹)"],
      [
        ["A(5) All other ITC", (itcData.allOtherITC * 0.5).toFixed(2), (itcData.allOtherITC * 0.25).toFixed(2), (itcData.allOtherITC * 0.25).toFixed(2), "0.00"],
        ["A(4) Self-assessed RCM", (itcData.rcmITC * 0.5).toFixed(2), (itcData.rcmITC * 0.25).toFixed(2), (itcData.rcmITC * 0.25).toFixed(2), "0.00"],
        ["B ITC Reversed", (itcData?.itcReversed ?? 0).toFixed(2), "0.00", "0.00", "0.00"],
        ["C Net ITC", (itcData.netITC * 0.5).toFixed(2), (itcData.netITC * 0.25).toFixed(2), (itcData.netITC * 0.25).toFixed(2), "0.00"]
      ]
    );

    // Table 6 — Net Tax Payable
    buildSection(
      "Table 6 — Net Tax Payable",
      ["Description", "Amount (₹)"],
      [
        ["Output tax", (table6?.outputTax ?? 0).toFixed(2)],
        ["ITC credit", (table6?.itcCredit ?? 0).toFixed(2)],
        ["Cash payment required", (table6?.cashPayment ?? 0).toFixed(2)]
      ]
    );

    // Transaction Summary
    buildSection(
      "Transaction Summary",
      ["Type", "Count", "Total Taxable Value (₹)", "Total Tax (₹)"],
      [
        [
          "Sales",
          String(salesTransactions.length),
          salesTransactions.reduce((s, t) => s + t.taxableValue, 0).toFixed(2),
          salesTransactions.reduce((s, t) => s + t.totalTax, 0).toFixed(2)
        ],
        [
          "Purchases",
          String(purchaseTransactions.length),
          purchaseTransactions.reduce((s, t) => s + t.taxableValue, 0).toFixed(2),
          purchaseTransactions.reduce((s, t) => s + t.totalTax, 0).toFixed(2)
        ]
      ]
    );

    // ITC Reconciliation Status
    if (Math.abs(itcData.difference) > 0) {
      rows.push("ITC Reconciliation Alert");
      rows.push(`Difference between books and GSTR-2B: ₹${(itcData?.difference ?? 0).toFixed(2)}`);
      if (Math.abs(itcData.difference) > 1000) {
        rows.push("⚠️ Difference exceeds ₹1,000 - Reconciliation required before filing");
      }
      rows.push("");
    }

    // Footer
    rows.push("");
    rows.push("Note: This report is generated from approved transactions only.");
    rows.push("Please verify all amounts before filing with GSTN portal.");

    const csvContent = BOM + rows.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `GSTR3B_${selectedMonth}_${selectedYear}_${selectedGSTIN}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Not Generated": return "bg-gray-100 text-gray-700";
      case "Generated": return "bg-blue-100 text-blue-700";
      case "Approved": return "bg-green-100 text-green-700";
      case "Ready to File": return "bg-purple-100 text-purple-700";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between border-b pb-4">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <ReceiptText className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">GSTR-3B Summary</h1>
            <p className="text-sm text-gray-600">Monthly summary of outward and inward supplies</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <select
            value={selectedMonth}
            onChange={e => setSelectedMonth(Number(e.target.value))}
            disabled={isApproved}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm disabled:opacity-50"
          >
            <option value={4}>April</option>
            <option value={3}>March</option>
            <option value={2}>February</option>
          </select>
          <select
            value={selectedYear}
            onChange={e => setSelectedYear(Number(e.target.value))}
            disabled={isApproved}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm disabled:opacity-50"
          >
            <option>2026</option>
            <option>2025</option>
          </select>
          <div className="px-4 py-2 bg-gray-100 rounded-lg text-sm font-mono">{selectedGSTIN}</div>
          <span className={`px-3 py-2 rounded-lg text-sm font-medium ${getStatusColor(status)}`}>
            {status}
          </span>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Table 3.1 — Details of Outward Supplies</h3>
          <button
            onClick={handleExport31}
            className="flex items-center gap-2 px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>

        {isApproved && (
          <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg flex items-center gap-2">
            <Lock className="w-4 h-4 text-purple-600" />
            <span className="text-sm text-purple-900">Values are locked after approval</span>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-gray-300 text-left text-xs text-gray-600">
                <th className="pb-3 font-medium">Nature of Supply</th>
                <th className="pb-3 font-medium text-right">Txbl. Value (₹)</th>
                <th className="pb-3 font-medium text-right">IGST (₹)</th>
                <th className="pb-3 font-medium text-right">CGST (₹)</th>
                <th className="pb-3 font-medium text-right">State/UT Tax (₹)</th>
                <th className="pb-3 font-medium text-right">Cess (₹)</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-100">
                <td className="py-2 text-gray-900">(a) Outward taxable supplies (other than zero rated, nil rated, exempt)</td>
                <td className="py-2 text-right font-medium">₹{table31.taxableValue.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td className="py-2 text-right">₹{table31.taxableIGST.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td className="py-2 text-right">₹{table31.taxableCGST.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td className="py-2 text-right">₹{table31.taxableSGST.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td className="py-2 text-right text-gray-400">—</td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-2 text-gray-900">(b) Outward taxable supplies (zero rated)</td>
                <td className="py-2 text-right">₹{table31.zeroRatedValue.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td className="py-2 text-right text-gray-400">—</td>
                <td className="py-2 text-right text-gray-400">—</td>
                <td className="py-2 text-right text-gray-400">—</td>
                <td className="py-2 text-right text-gray-400">—</td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-2 text-gray-900">(c) Other outward supplies (nil rated, exempted)</td>
                <td className="py-2 text-right">₹{table31.nilExemptValue.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td className="py-2 text-right text-gray-400">—</td>
                <td className="py-2 text-right text-gray-400">—</td>
                <td className="py-2 text-right text-gray-400">—</td>
                <td className="py-2 text-right text-gray-400">—</td>
              </tr>
              <tr className="border-b border-gray-100 bg-amber-50">
                <td className="py-2 text-gray-900 font-medium">(d) Inward supplies (liable to reverse charge)</td>
                <td className="py-2 text-right font-medium">₹{table31.rcmValue.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td className="py-2 text-right">₹{table31.rcmIGST.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td className="py-2 text-right">₹{table31.rcmCGST.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td className="py-2 text-right">₹{table31.rcmSGST.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td className="py-2 text-right text-gray-400">—</td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-2 text-gray-900">(e) Non-GST outward supplies</td>
                <td className="py-2 text-right">₹{table31.nonGSTValue.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td className="py-2 text-right text-gray-400">—</td>
                <td className="py-2 text-right text-gray-400">—</td>
                <td className="py-2 text-right text-gray-400">—</td>
                <td className="py-2 text-right text-gray-400">—</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Table 3.1.1 — E-Commerce Operator Supplies */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
        <h3 className="font-semibold text-gray-900">Table 3.1.1 — E-Commerce Operator Supplies u/s 9(5)</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-gray-300 text-left text-xs text-gray-600">
                <th className="pb-3 font-medium">Description</th>
                <th className="pb-3 font-medium text-right">Txbl. Value (₹)</th>
                <th className="pb-3 font-medium text-right">IGST (₹)</th>
                <th className="pb-3 font-medium text-right">CGST (₹)</th>
                <th className="pb-3 font-medium text-right">State/UT Tax (₹)</th>
                <th className="pb-3 font-medium text-right">Cess (₹)</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-100">
                <td className="py-2 text-gray-500 text-xs">Not applicable for CleanCar</td>
                <td className="py-2 text-right text-gray-400">—</td>
                <td className="py-2 text-right text-gray-400">—</td>
                <td className="py-2 text-right text-gray-400">—</td>
                <td className="py-2 text-right text-gray-400">—</td>
                <td className="py-2 text-right text-gray-400">—</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Table 3.2 — Inter-State Supplies */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
        <h3 className="font-semibold text-gray-900">Table 3.2 — Inter-State Supplies</h3>
        <p className="text-sm text-gray-600">State-wise breakdown for inter-state B2C transactions</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-gray-300 text-left text-xs text-gray-600">
                <th className="pb-3 font-medium">State</th>
                <th className="pb-3 font-medium text-right">Taxable Value (₹)</th>
                <th className="pb-3 font-medium text-right">IGST (₹)</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(table32).length > 0 ? (
                Object.entries(table32).map(([state, data]) => (
                  <tr key={state} className="border-b border-gray-100">
                    <td className="py-2 text-gray-900">{state}</td>
                    <td className="py-2 text-right">₹{data.taxableValue.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="py-2 text-right">₹{data.igst.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="py-4 text-center text-gray-500 text-xs">No inter-state B2C transactions for this period</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Table 4 — Eligible ITC</h3>
          <button
            onClick={handleExportITC}
            className="flex items-center gap-2 px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>

        <div className="grid grid-cols-3 gap-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div>
            <p className="text-sm text-blue-900 mb-1">Net ITC</p>
            <p className="text-xl font-semibold text-blue-900">₹{itcData.netITC.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>
          <div>
            <p className="text-sm text-blue-900 mb-1">ITC as per 2B</p>
            <p className="text-xl font-semibold text-blue-900">₹{itcData.itcFrom2B.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>
          <div>
            <p className="text-sm text-blue-900 mb-1">Difference</p>
            <p className={`text-xl font-semibold ${Math.abs(itcData.difference) > 0 ? 'text-red-600' : 'text-green-600'}`}>
              ₹{itcData.difference.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        {Math.abs(itcData.difference) > 1000 && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-900">ITC Reconciliation Required</p>
              <p className="text-sm text-amber-700">Difference exceeds ₹1,000. Reconcile ITC before filing.</p>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-gray-300 text-left text-xs text-gray-600">
                <th className="pb-3 font-medium">Description</th>
                <th className="pb-3 font-medium text-right">IGST (₹)</th>
                <th className="pb-3 font-medium text-right">CGST (₹)</th>
                <th className="pb-3 font-medium text-right">State/UT Tax (₹)</th>
                <th className="pb-3 font-medium text-right">Cess (₹)</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-100">
                <td className="py-2 text-gray-900">A(5) All other ITC</td>
                <td className="py-2 text-right">₹{(itcData.allOtherITC * 0.5).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td className="py-2 text-right">₹{(itcData.allOtherITC * 0.25).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td className="py-2 text-right">₹{(itcData.allOtherITC * 0.25).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td className="py-2 text-right text-gray-400">—</td>
              </tr>
              <tr className="border-b border-gray-100 bg-amber-50">
                <td className="py-2 text-gray-900 font-medium">A(4) Self-assessed tax on RCM</td>
                <td className="py-2 text-right">₹{(itcData.rcmITC * 0.5).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td className="py-2 text-right">₹{(itcData.rcmITC * 0.25).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td className="py-2 text-right">₹{(itcData.rcmITC * 0.25).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td className="py-2 text-right text-gray-400">—</td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-2 text-gray-900">B ITC Reversed</td>
                <td className="py-2 text-right text-red-600">-₹{itcData.itcReversed.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td className="py-2 text-right text-red-600">—</td>
                <td className="py-2 text-right text-red-600">—</td>
                <td className="py-2 text-right text-gray-400">—</td>
              </tr>
              <tr className="bg-green-50 font-semibold">
                <td className="py-2 text-gray-900">C Net ITC Available</td>
                <td className="py-2 text-right text-green-700">₹{(itcData.netITC * 0.5).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td className="py-2 text-right text-green-700">₹{(itcData.netITC * 0.25).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td className="py-2 text-right text-green-700">₹{(itcData.netITC * 0.25).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td className="py-2 text-right text-gray-400">—</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* RCM ITC Register sub-section */}
        {itcData.rcmITC > 0 && (
          <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <h4 className="text-sm font-semibold text-gray-900 mb-2">RCM ITC (paid & eligible)</h4>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-gray-600">IGST:</span>
                <span className="ml-2 font-medium">₹{(itcData.rcmITC * 0.5).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div>
                <span className="text-gray-600">CGST:</span>
                <span className="ml-2 font-medium">₹{(itcData.rcmITC * 0.25).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div>
                <span className="text-gray-600">SGST:</span>
                <span className="ml-2 font-medium">₹{(itcData.rcmITC * 0.25).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            </div>
            <p className="text-xs text-amber-700 mt-2">Note: "Reverse Charge Tax Input not due" transfers to "Input Tax Credits" upon payment</p>
          </div>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Table 6 — Net Tax Payable</h3>
          <button
            onClick={handleExportTable6}
            className="flex items-center gap-2 px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 text-left text-sm text-gray-600">
                <th className="pb-3 font-medium">Description</th>
                <th className="pb-3 font-medium text-right">Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-100 text-sm">
                <td className="py-3 text-gray-900">Output tax</td>
                <td className="py-3 text-right text-gray-700">₹{(table6?.outputTax ?? 0).toLocaleString()}</td>
              </tr>
              <tr className="border-b border-gray-100 text-sm">
                <td className="py-3 text-gray-900">ITC credit</td>
                <td className="py-3 text-right text-green-600">-₹{(table6?.itcCredit ?? 0).toLocaleString()}</td>
              </tr>
              <tr className="text-sm bg-purple-50">
                <td className="py-3 font-semibold text-gray-900">Cash payment required</td>
                <td className="py-3 text-right font-semibold text-purple-600">₹{(table6?.cashPayment ?? 0).toLocaleString()}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Export Options</h3>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <button
            onClick={handleDownloadFullGSTR3BCSV}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
          >
            <Download className="w-4 h-4" />
            Download Full GSTR-3B Report (CSV)
          </button>
          <p className="text-sm text-gray-600">
            Comprehensive CSV export with all tables and reconciliation data
          </p>
        </div>
      </div>

      {!isApproved && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900 mb-1">Manager Approval Required</h3>
              <p className="text-sm text-gray-600">Once approved, all values will be locked and ready for filing.</p>
            </div>
            <button
              onClick={handleApprove}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
            >
              Approve GSTR-3B
            </button>
          </div>
        </div>
      )}

      {isApproved && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-green-600" />
            <div>
              <p className="font-semibold text-green-900">GSTR-3B Approved</p>
              <p className="text-sm text-green-700">All values are locked. This return is ready to file.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
