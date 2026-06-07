import { BackButton } from "../ui/back-button";
import { useState, useMemo } from "react";
import { FileOutput, Download, CheckCircle, XCircle, AlertTriangle, Copy, Check } from "lucide-react";
import { gstComplianceService, type GSTTransaction } from "../../services/gstComplianceService";
import { showExportMenu } from "../../utils/gstExportUtils";
import { useCity } from "../../contexts/CityContext";

export function GSTR1Module() {
  const { city } = useCity();
  const [selectedMonth, setSelectedMonth] = useState(4);
  const [selectedYear, setSelectedYear] = useState(2026);
  const [selectedGSTIN, setSelectedGSTIN] = useState("24GAOPS5676E1Z3");
  const [status, setStatus] = useState<"Not Generated" | "Generated" | "Filed">("Not Generated");
  const [showGenerated, setShowGenerated] = useState(false);
  const [showJSONPreview, setShowJSONPreview] = useState(false);
  const [jsonCopied, setJsonCopied] = useState(false);

  const transactions = gstComplianceService.getTransactions(city);

  const monthTransactions = useMemo(() =>
    transactions.filter(t =>
      t.month === selectedMonth &&
      t.year === selectedYear &&
      t.transactionType === "Sale"
    ),
    [transactions, selectedMonth, selectedYear]
  );

  const validationChecks = useMemo(() => {
    const allApproved = monthTransactions.every(t => t.status === "Approved");
    const noCriticalRisk = monthTransactions.every(t => t.riskLevel !== "Critical");
    const hasHSN = monthTransactions.every(t => t.hsnSacCode && t.hsnSacCode.length >= 4);
    const hasPlaceOfSupply = monthTransactions.every(t => t.placeOfSupply);
    const uniqueInvoices = new Set((monthTransactions || []).map(t => t.invoiceNumber)).size === monthTransactions.length;

    return {
      allApproved,
      noCriticalRisk,
      hasHSN,
      hasPlaceOfSupply,
      uniqueInvoices,
      allPassed: allApproved && noCriticalRisk && hasHSN && hasPlaceOfSupply && uniqueInvoices
    };
  }, [monthTransactions]);

  const b2bInvoices = useMemo(() =>
    (monthTransactions || []).filter(t => t.gstType === "B2B"),
    [monthTransactions]
  );

  const b2cLarge = useMemo(() =>
    (monthTransactions || []).filter(t => t.gstType === "B2C" && t.invoiceTotal > 250000),
    [monthTransactions]
  );

  const b2cSmallSummary = useMemo(() => {
    const small = (monthTransactions || []).filter(t => t.gstType === "B2C" && t.invoiceTotal <= 250000);
    const byState: Record<string, { count: number; taxable: number; cgst: number; sgst: number; igst: number }> = {};

    small.forEach(t => {
      if (!byState[t.placeOfSupply]) {
        byState[t.placeOfSupply] = { count: 0, taxable: 0, cgst: 0, sgst: 0, igst: 0 };
      }
      byState[t.placeOfSupply].count++;
      byState[t.placeOfSupply].taxable += t.taxableValue;
      byState[t.placeOfSupply].cgst += t.cgst;
      byState[t.placeOfSupply].sgst += t.sgst;
      byState[t.placeOfSupply].igst += t.igst;
    });

    return Object.entries(byState).map(([state, data]) => ({ state, ...data }));
  }, [monthTransactions]);

  const hsnSummary = useMemo(() => {
    const byHSN: Record<string, { description: string; quantity: number; taxable: number; cgst: number; sgst: number; igst: number }> = {};

    monthTransactions.forEach(t => {
      const hsn = t.hsnSacCode || "Unknown";
      if (!byHSN[hsn]) {
        byHSN[hsn] = { description: t.description, quantity: 0, taxable: 0, cgst: 0, sgst: 0, igst: 0 };
      }
      byHSN[hsn].quantity += t.quantity;
      byHSN[hsn].taxable += t.taxableValue;
      byHSN[hsn].cgst += t.cgst;
      byHSN[hsn].sgst += t.sgst;
      byHSN[hsn].igst += t.igst;
    });

    return Object.entries(byHSN).map(([hsn, data]) => ({ hsn, ...data }));
  }, [monthTransactions]);

  const previousMonthData = useMemo(() => {
    const MONTH_ORDER = ["April","May","June","July","August","September","October","November","December","January","February","March"];
    const prevIdx = MONTH_ORDER.indexOf(selectedMonth);
    const prevMonth = prevIdx > 0 ? MONTH_ORDER[prevIdx - 1] : "March";
    const prevYear = (selectedMonth === "January" || selectedMonth === "February" || selectedMonth === "March") ? selectedYear - 1 : selectedYear;
    const prevTransactions = transactions.filter(t =>
      t.month === prevMonth &&
      t.year === prevYear &&
      t.transactionType === "Sale" &&
      t.status === "Approved"
    );

    return {
      count: prevTransactions.length,
      taxable: prevTransactions.reduce((s, t) => s + t.taxableValue, 0),
      totalTax: prevTransactions.reduce((s, t) => s + t.totalTax, 0)
    };
  }, [transactions, selectedMonth, selectedYear]);

  const currentMonthData = useMemo(() => ({
    count: monthTransactions.length,
    taxable: (monthTransactions || []).reduce((s, t) => s + t.taxableValue, 0),
    totalTax: (monthTransactions || []).reduce((s, t) => s + t.totalTax, 0)
  }), [monthTransactions]);

  const handleGenerate = () => {
    if (!validationChecks.allPassed) return;

    // Mark all approved transactions as included in this GSTR-1 generation
    const generatedAt = new Date().toISOString();
    monthTransactions
      .filter(t => t.status === "Approved")
      .forEach(t => {
        gstComplianceService.saveTransaction({
          ...t,
          gstr1GeneratedAt: generatedAt,
          changeHistory: [...(t.changeHistory || []), {
            timestamp: generatedAt,
            changedBy: "Accounts",
            action: "GSTR-1 Generated",
            note: `GSTR-1 generated for ${selectedMonth} ${selectedYear}`,
          }],
        });
      });

    setShowGenerated(true);
    setStatus("Generated");
  };

  const handleExportB2B = (e: React.MouseEvent) => {
    const data = b2bInvoices.map(t => ({
      GSTIN: t.partyGstin,
      "Invoice No": t.invoiceNumber,
      "Invoice Date": t.invoiceDate,
      "Taxable Value": t.taxableValue,
      CGST: t.cgst,
      SGST: t.sgst,
      IGST: t.igst,
      Total: t.invoiceTotal,
      "Place of Supply": t.placeOfSupply
    }));
    showExportMenu(data, "gstr1-b2b", e.currentTarget as HTMLElement);
  };

  const handleExportHSN = (e: React.MouseEvent) => {
    const data = hsnSummary.map(h => ({
      "HSN Code": h.hsn,
      Description: h.description,
      UOM: "Nos",
      "Total Quantity": h.quantity,
      "Taxable Value": h.taxable,
      CGST: h.cgst,
      SGST: h.sgst,
      IGST: h.igst
    }));
    showExportMenu(data, "gstr1-hsn-summary", e.currentTarget as HTMLElement);
  };

  const generateGSTR1JSON = () => {
    const json = {
      gstin: selectedGSTIN,
      fp: `${selectedMonth.substring(0, 2)}${selectedYear}`,
      b2b: b2bInvoices.map(t => ({
        ctin: t.partyGstin,
        inv: [{
          inum: t.invoiceNumber,
          idt: t.invoiceDate,
          val: t.invoiceTotal,
          pos: t.placeOfSupplyCode,
          rchrg: t.reverseCharge ? "Y" : "N",
          itms: [{
            num: 1,
            itm_det: {
              txval: t.taxableValue,
              rt: t.gstRate,
              csamt: t.cess,
              camt: t.cgst,
              samt: t.sgst,
              iamt: t.igst
            }
          }]
        }]
      })),
      b2cl: b2cLarge.map(t => ({
        pos: t.placeOfSupplyCode,
        inv: [{
          inum: t.invoiceNumber,
          idt: t.invoiceDate,
          val: t.invoiceTotal,
          itms: [{
            num: 1,
            itm_det: {
              txval: t.taxableValue,
              rt: t.gstRate,
              csamt: t.cess,
              iamt: t.igst
            }
          }]
        }]
      })),
      b2cs: b2cSmallSummary.map(s => ({
        pos: s.state,
        typ: "OE",
        txval: s.taxable,
        iamt: s.igst,
        camt: s.cgst,
        samt: s.sgst,
        csamt: 0
      })),
      hsn: {
        data: hsnSummary.map(h => ({
          hsn_sc: h.hsn,
          desc: h.description,
          uqc: "NOS",
          qty: h.quantity,
          txval: h.taxable,
          iamt: h.igst,
          camt: h.cgst,
          samt: h.sgst,
          csamt: 0
        }))
      }
    };
    return JSON.stringify(json, null, 2);
  };

  const handleCopyJSON = () => {
    navigator.clipboard.writeText(generateGSTR1JSON());
    setJsonCopied(true);
    setTimeout(() => setJsonCopied(false), 2000);
  };

  const handleDownloadJSON = () => {
    const json = generateGSTR1JSON();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `GSTR1-${selectedGSTIN}-${selectedMonth}-${selectedYear}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadFullCSV = () => {
    // Sheet 1 — B2B Invoices
    const b2bData = b2bInvoices.map(t => ({
      "GSTIN/UIN of Recipient": t.partyGstin,
      "Receiver Name": t.partyName,
      "Invoice Number": t.invoiceNumber,
      "Invoice date": t.invoiceDate,
      "Invoice Value": t.invoiceTotal,
      "Place Of Supply": t.placeOfSupply,
      "Reverse Charge": t.reverseCharge ? "Y" : "N",
      "Applicable % of Tax Rate": "",
      "Invoice Type": "Regular",
      "E-Commerce GSTIN": "",
      "Rate": t.gstRate,
      "Taxable Value": t.taxableValue,
      "Cess Amount": t.cess,
    }));

    // Sheet 2 — B2C Large Invoices (> ₹2.5L)
    const b2clData = b2cLarge.map(t => ({
      "Invoice Number": t.invoiceNumber,
      "Invoice date": t.invoiceDate,
      "Invoice Value": t.invoiceTotal,
      "Place Of Supply": t.placeOfSupply,
      "Applicable % of Tax Rate": "",
      "Rate": t.gstRate,
      "Taxable Value": t.taxableValue,
      "Cess Amount": t.cess,
      "E-Commerce GSTIN": "",
    }));

    // Sheet 3 — B2C Small Summary (State-wise)
    const b2csData = b2cSmallSummary.map(s => ({
      "Type": "OE",
      "Place Of Supply": s.state,
      "Applicable % of Tax Rate": "",
      "Rate": 18,
      "Taxable Value": s.taxable,
      "Cess Amount": 0,
      "E-Commerce GSTIN": "",
    }));

    // Sheet 4 — HSN Summary (B2B)
    const hsnB2BData = hsnSummary.map(h => ({
      "HSN": h.hsn,
      "Description": h.description,
      "UQC": "NOS",
      "Total Quantity": h.quantity,
      "Total Value": h.taxable + h.cgst + h.sgst + h.igst,
      "Taxable Value": h.taxable,
      "Rate": 18,
      "Integrated Tax Amount": h.igst,
      "Central Tax Amount": h.cgst,
      "State/UT Tax Amount": h.sgst,
      "Cess Amount": 0,
    }));

    // Sheet 5 — Document Summary
    const allInvoiceNos = (monthTransactions || []).map(t => t.invoiceNumber);
    const docsData = [
      {
        "Nature of Document": "Invoices for outward supply",
        "Sr. No. From": allInvoiceNos[0] || "",
        "Sr. No. To": allInvoiceNos[allInvoiceNos.length - 1] || "",
        "Total Number": monthTransactions.length,
        "Cancelled": 0,
      }
    ];

    // Build a multi-section CSV with section headers as separators
    const buildSection = (title: string, rows: Record<string, any>[]) => {
      if (!rows.length) return `${title}\n(No data)\n\n`;
      const headers = Object.keys(rows[0]);
      const dataRows = rows.map(row =>
        headers.map(h => {
          const val = row[h] ?? "";
          const str = String(val).replace(/"/g, '""');
          return str.includes(",") || str.includes("\n") ? `"${str}"` : str;
        }).join(",")
      );
      return `${title}\n${headers.join(",")}\n${dataRows.join("\n")}\n\n`;
    };

    const csv = [
      `GSTR-1 Report — ${selectedMonth} ${selectedYear}`,
      `GSTIN: ${selectedGSTIN}`,
      `Generated on: ${new Date().toLocaleDateString("en-IN")}`,
      ``,
      buildSection("4A — B2B Invoices", b2bData),
      buildSection("5 — B2C Large Invoices (> Rs.2.5L)", b2clData),
      buildSection("7 — B2C Small (State-wise Summary)", b2csData),
      buildSection("12 — HSN Summary", hsnB2BData),
      buildSection("13 — Document Summary", docsData),
    ].join("\n");

    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `GSTR1-${selectedGSTIN}-${selectedMonth}-${selectedYear}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Not Generated": return "bg-gray-100 text-gray-700";
      case "Generated": return "bg-blue-100 text-blue-700";
      case "Filed": return "bg-green-100 text-green-700";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  const variance = (current: number, previous: number) => {
    if (previous === 0) return "0.0";
    return ((current - previous) / previous * 100).toFixed(1);
  };

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6">
      <BackButton />
      <div className="flex items-center justify-between border-b pb-4">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="p-2 bg-indigo-100 rounded-lg">
            <FileOutput className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">GSTR-1 Generation</h1>
            <p className="text-sm text-gray-600">Generate GSTR-1 return for outward supplies</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <select
            value={selectedMonth}
            onChange={e => setSelectedMonth(Number(e.target.value))}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value={4}>April</option>
            <option value={3}>March</option>
            <option value={2}>February</option>
          </select>
          <select
            value={selectedYear}
            onChange={e => setSelectedYear(Number(e.target.value))}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
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
        <h3 className="font-semibold text-gray-900">Pre-Generation Validation</h3>
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {validationChecks.allApproved ?
              <CheckCircle className="w-5 h-5 text-green-600" /> :
              <XCircle className="w-5 h-5 text-red-600" />
            }
            <span className="text-sm text-gray-700">All transactions for the month are in "Approved" status</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {validationChecks.noCriticalRisk ?
              <CheckCircle className="w-5 h-5 text-green-600" /> :
              <XCircle className="w-5 h-5 text-red-600" />
            }
            <span className="text-sm text-gray-700">No Critical risk score transactions remain unresolved</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {validationChecks.hasHSN ?
              <CheckCircle className="w-5 h-5 text-green-600" /> :
              <XCircle className="w-5 h-5 text-red-600" />
            }
            <span className="text-sm text-gray-700">HSN codes present on all line items</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {validationChecks.hasPlaceOfSupply ?
              <CheckCircle className="w-5 h-5 text-green-600" /> :
              <XCircle className="w-5 h-5 text-red-600" />
            }
            <span className="text-sm text-gray-700">Place of supply filled on all transactions</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {validationChecks.uniqueInvoices ?
              <CheckCircle className="w-5 h-5 text-green-600" /> :
              <XCircle className="w-5 h-5 text-red-600" />
            }
            <span className="text-sm text-gray-700">No duplicate invoice numbers</span>
          </div>
        </div>

        {!validationChecks.allPassed && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-900">Cannot Generate GSTR-1</p>
              <p className="text-sm text-red-700">Resolve all blocking errors before generating GSTR-1.</p>
            </div>
          </div>
        )}

        <div className="flex gap-3 pt-4 border-t">
          <button
            onClick={handleGenerate}
            disabled={!validationChecks.allPassed || status !== "Not Generated"}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            Generate GSTR-1
          </button>
        </div>
      </div>

      {showGenerated && (
        <>
          <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Historical Comparison</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-sm text-gray-600">
                    <th className="pb-3 font-medium">Metric</th>
                    <th className="pb-3 font-medium">Previous Month</th>
                    <th className="pb-3 font-medium">Current Month</th>
                    <th className="pb-3 font-medium">Variance %</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-100 text-sm">
                    <td className="py-3 font-medium text-gray-900">Transaction Count</td>
                    <td className="py-3 text-gray-700">{previousMonthData.count}</td>
                    <td className="py-3 text-gray-700">{currentMonthData.count}</td>
                    <td className="py-3">
                      <span className={variance(currentMonthData.count, previousMonthData.count).startsWith('-') ? "text-red-600" : "text-green-600"}>
                        {variance(currentMonthData.count, previousMonthData.count)}%
                      </span>
                    </td>
                  </tr>
                  <tr className="border-b border-gray-100 text-sm">
                    <td className="py-3 font-medium text-gray-900">Taxable Value</td>
                    <td className="py-3 text-gray-700">₹{(previousMonthData?.taxable ?? 0).toLocaleString()}</td>
                    <td className="py-3 text-gray-700">₹{(currentMonthData?.taxable ?? 0).toLocaleString()}</td>
                    <td className="py-3">
                      <span className={variance(currentMonthData.taxable, previousMonthData.taxable).startsWith('-') ? "text-red-600" : "text-green-600"}>
                        {variance(currentMonthData.taxable, previousMonthData.taxable)}%
                      </span>
                    </td>
                  </tr>
                  <tr className="text-sm">
                    <td className="py-3 font-medium text-gray-900">Total Tax</td>
                    <td className="py-3 text-gray-700">₹{(previousMonthData?.totalTax ?? 0).toLocaleString()}</td>
                    <td className="py-3 text-gray-700">₹{(currentMonthData?.totalTax ?? 0).toLocaleString()}</td>
                    <td className="py-3">
                      <span className={variance(currentMonthData.totalTax, previousMonthData.totalTax).startsWith('-') ? "text-red-600" : "text-green-600"}>
                        {variance(currentMonthData.totalTax, previousMonthData.totalTax)}%
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">B2B Invoices</h3>
              <button
                onClick={handleExportB2B}
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
                    <th className="pb-3 font-medium">GSTIN</th>
                    <th className="pb-3 font-medium">Invoice No.</th>
                    <th className="pb-3 font-medium">Invoice Date</th>
                    <th className="pb-3 font-medium">Taxable Value</th>
                    <th className="pb-3 font-medium">CGST</th>
                    <th className="pb-3 font-medium">SGST</th>
                    <th className="pb-3 font-medium">IGST</th>
                    <th className="pb-3 font-medium">Total</th>
                    <th className="pb-3 font-medium">Place of Supply</th>
                  </tr>
                </thead>
                <tbody>
                  {b2bInvoices.map(txn => (
                    <tr key={txn.id} className="border-b border-gray-100 text-sm">
                      <td className="py-3 font-mono text-xs">{txn.partyGstin}</td>
                      <td className="py-3 text-gray-900">{txn.invoiceNumber}</td>
                      <td className="py-3 text-gray-700">{txn.invoiceDate}</td>
                      <td className="py-3 text-gray-900">₹{(txn?.taxableValue ?? 0).toLocaleString()}</td>
                      <td className="py-3 text-gray-700">₹{(txn?.cgst ?? 0).toLocaleString()}</td>
                      <td className="py-3 text-gray-700">₹{(txn?.sgst ?? 0).toLocaleString()}</td>
                      <td className="py-3 text-gray-700">₹{(txn?.igst ?? 0).toLocaleString()}</td>
                      <td className="py-3 font-medium text-gray-900">₹{(txn?.invoiceTotal ?? 0).toLocaleString()}</td>
                      <td className="py-3 text-gray-700">{txn.placeOfSupply}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">B2C Large Invoices (&gt; ₹2.5L)</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-sm text-gray-600">
                    <th className="pb-3 font-medium">Invoice No.</th>
                    <th className="pb-3 font-medium">Invoice Date</th>
                    <th className="pb-3 font-medium">Taxable Value</th>
                    <th className="pb-3 font-medium">IGST</th>
                    <th className="pb-3 font-medium">Total</th>
                    <th className="pb-3 font-medium">Place of Supply</th>
                  </tr>
                </thead>
                <tbody>
                  {b2cLarge.map(txn => (
                    <tr key={txn.id} className="border-b border-gray-100 text-sm">
                      <td className="py-3 text-gray-900">{txn.invoiceNumber}</td>
                      <td className="py-3 text-gray-700">{txn.invoiceDate}</td>
                      <td className="py-3 text-gray-900">₹{(txn?.taxableValue ?? 0).toLocaleString()}</td>
                      <td className="py-3 text-gray-700">₹{(txn?.igst ?? 0).toLocaleString()}</td>
                      <td className="py-3 font-medium text-gray-900">₹{(txn?.invoiceTotal ?? 0).toLocaleString()}</td>
                      <td className="py-3 text-gray-700">{txn.placeOfSupply}</td>
                    </tr>
                  ))}
                  {b2cLarge.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-4 text-center text-gray-500 text-sm">No B2C large invoices</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">B2C Small (State-wise Summary)</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-sm text-gray-600">
                    <th className="pb-3 font-medium">State</th>
                    <th className="pb-3 font-medium">Count</th>
                    <th className="pb-3 font-medium">Taxable Value</th>
                    <th className="pb-3 font-medium">CGST</th>
                    <th className="pb-3 font-medium">SGST</th>
                    <th className="pb-3 font-medium">IGST</th>
                  </tr>
                </thead>
                <tbody>
                  {b2cSmallSummary.map(s => (
                    <tr key={s.state} className="border-b border-gray-100 text-sm">
                      <td className="py-3 font-medium text-gray-900">{s.state}</td>
                      <td className="py-3 text-gray-700">{s.count}</td>
                      <td className="py-3 text-gray-900">₹{(s?.taxable ?? 0).toLocaleString()}</td>
                      <td className="py-3 text-gray-700">₹{(s?.cgst ?? 0).toLocaleString()}</td>
                      <td className="py-3 text-gray-700">₹{(s?.sgst ?? 0).toLocaleString()}</td>
                      <td className="py-3 text-gray-700">₹{(s?.igst ?? 0).toLocaleString()}</td>
                    </tr>
                  ))}
                  {b2cSmallSummary.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-4 text-center text-gray-500 text-sm">No B2C small invoices</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">HSN Summary</h3>
              <button
                onClick={handleExportHSN}
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
                    <th className="pb-3 font-medium">HSN Code</th>
                    <th className="pb-3 font-medium">Description</th>
                    <th className="pb-3 font-medium">UOM</th>
                    <th className="pb-3 font-medium">Total Quantity</th>
                    <th className="pb-3 font-medium">Taxable Value</th>
                    <th className="pb-3 font-medium">CGST</th>
                    <th className="pb-3 font-medium">SGST</th>
                    <th className="pb-3 font-medium">IGST</th>
                  </tr>
                </thead>
                <tbody>
                  {hsnSummary.map(h => (
                    <tr key={h.hsn} className="border-b border-gray-100 text-sm">
                      <td className="py-3 font-mono text-gray-900">{h.hsn}</td>
                      <td className="py-3 text-gray-700">{h.description}</td>
                      <td className="py-3 text-gray-700">Nos</td>
                      <td className="py-3 text-gray-700">{(h?.quantity ?? 0).toLocaleString()}</td>
                      <td className="py-3 text-gray-900">₹{(h?.taxable ?? 0).toLocaleString()}</td>
                      <td className="py-3 text-gray-700">₹{(h?.cgst ?? 0).toLocaleString()}</td>
                      <td className="py-3 text-gray-700">₹{(h?.sgst ?? 0).toLocaleString()}</td>
                      <td className="py-3 text-gray-700">₹{(h?.igst ?? 0).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
            <h3 className="font-semibold text-gray-900">Export Options</h3>
            <div className="flex flex-wrap gap-2 sm:gap-3">
              <button
                onClick={() => setShowJSONPreview(true)}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm"
              >
                Prepare JSON for Portal
              </button>
              <button
                onClick={handleDownloadJSON}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm"
              >
                <Download className="w-4 h-4" />
                Download JSON for GST Portal
              </button>
              <button
                onClick={handleDownloadFullCSV}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
              >
                <Download className="w-4 h-4" />
                Download Full Report (CSV)
              </button>
            </div>
          </div>
        </>
      )}

      {showJSONPreview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-6">
          <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">JSON Preview for GST Portal</h2>
              <button onClick={() => setShowJSONPreview(false)} className="p-1 hover:bg-gray-100 rounded">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 sm:p-4 md:p-6 space-y-3 sm:space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <p className="text-sm text-amber-900">
                  This JSON is formatted according to the GST Portal schema. Copy this content and paste it into the GST Portal upload interface.
                </p>
              </div>

              <div className="relative">
                <textarea
                  readOnly
                  value={generateGSTR1JSON()}
                  className="w-full h-96 px-3 py-2 border border-gray-300 rounded-lg text-xs font-mono bg-gray-50"
                />
                <button
                  onClick={handleCopyJSON}
                  className="absolute top-2 right-2 flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-300 rounded hover:bg-gray-50 text-sm"
                >
                  {jsonCopied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                  {jsonCopied ? "Copied!" : "Copy"}
                </button>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  onClick={() => setShowJSONPreview(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
