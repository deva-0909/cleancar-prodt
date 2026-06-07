import { useState, useMemo } from "react";
import { FileText, Download, AlertTriangle, CheckCircle } from "lucide-react";
import { gstComplianceService } from "../../services/gstComplianceService";
import { showExportMenu } from "../../utils/gstExportUtils";
import { useCity } from "../../contexts/CityContext";

export function GSTR9Module() {
  const { city } = useCity();
  const [selectedFY, setSelectedFY] = useState(() => {
    const now = new Date();
    const fy = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    return `${fy}-${String(fy + 1).slice(-2)}`;
  });
  const [status, setStatus] = useState<"Not Generated" | "Generated" | "Filed">("Not Generated");

  const FY_OPTIONS = ["2023-24", "2024-25", "2025-26"];

  const allTransactions = gstComplianceService.getTransactions(city);

  const fyTransactions = useMemo(() => {
    const [startYear] = selectedFY.split("-").map(Number);
    const fyStart = new Date(`${startYear}-04-01`);
    const fyEnd   = new Date(`${startYear + 1}-03-31`);
    return allTransactions.filter(t => {
      const d = new Date(t.invoiceDate);
      return d >= fyStart && d <= fyEnd && t.status === "Filed";
    });
  }, [allTransactions, selectedFY]);

  const salesTxns    = useMemo(() => fyTransactions.filter(t => t.transactionType === "Sale"),    [fyTransactions]);
  const purchaseTxns = useMemo(() => fyTransactions.filter(t => t.transactionType === "Purchase"), [fyTransactions]);

  // Table 4 — Details of advances, inward and outward supplies
  const table4 = useMemo(() => {
    const taxable    = salesTxns.filter(t => t.gstRate > 0);
    const nilRated   = salesTxns.filter(t => t.gstRate === 0);
    const taxableVal = taxable.reduce((s, t)  => s + t.taxableValue, 0);
    const igst       = taxable.reduce((s, t)  => s + t.igst, 0);
    const cgst       = taxable.reduce((s, t)  => s + t.cgst, 0);
    const sgst       = taxable.reduce((s, t)  => s + t.sgst, 0);
    const nilVal     = nilRated.reduce((s, t) => s + t.taxableValue, 0);
    return { taxableVal, igst, cgst, sgst, nilVal, totalTax: igst + cgst + sgst };
  }, [salesTxns]);

  // Table 6 — ITC availed
  const table6 = useMemo(() => {
    const eligible   = purchaseTxns.filter(t => t.itcEligible);
    const igst       = eligible.reduce((s, t) => s + t.igst, 0);
    const cgst       = eligible.reduce((s, t) => s + t.cgst, 0);
    const sgst       = eligible.reduce((s, t) => s + t.sgst, 0);
    const totalITC   = eligible.reduce((s, t) => s + t.itcAmount, 0);
    const rcmITC     = purchaseTxns.filter(t => t.reverseCharge).reduce((s, t) => s + t.itcAmount, 0);
    return { igst, cgst, sgst, totalITC, rcmITC };
  }, [purchaseTxns]);

  // Table 9 — Tax payable vs paid
  const table9 = useMemo(() => {
    const outputTax  = table4.totalTax;
    const itcClaimed = table6.totalITC;
    const netPayable = Math.max(0, outputTax - itcClaimed);
    return { outputTax, itcClaimed, netPayable };
  }, [table4, table6]);

  const validationChecks = useMemo(() => ({
    hasFiled:       fyTransactions.length > 0,
    allSalesHaveHSN: salesTxns.every(t => t.hsnSacCode && t.hsnSacCode.length >= 4),
    noUnfiled:      allTransactions.filter(t => {
                      const [startYear] = selectedFY.split("-").map(Number);
                      const d = new Date(t.invoiceDate);
                      return d >= new Date(`${startYear}-04-01`) && d <= new Date(`${startYear + 1}-03-31`) && t.status === "Approved";
                    }).length === 0,
  }), [fyTransactions, salesTxns, allTransactions, selectedFY]);

  const allValid = Object.values(validationChecks).every(v => v);

  const handleExport = (e: React.MouseEvent) => {
    const data = [
      { Table: "4A", Description: "Outward taxable supplies",        TaxableValue: table4.taxableVal, IGST: table4.igst, CGST: table4.cgst, SGST: table4.sgst },
      { Table: "4B", Description: "Nil/Exempt outward supplies",     TaxableValue: table4.nilVal,     IGST: 0,           CGST: 0,           SGST: 0 },
      { Table: "6A", Description: "ITC availed — all other",         TaxableValue: "",                IGST: table6.igst, CGST: table6.cgst, SGST: table6.sgst },
      { Table: "6C", Description: "ITC availed — RCM",               TaxableValue: "",                IGST: table6.rcmITC, CGST: 0,         SGST: 0 },
      { Table: "9",  Description: "Net tax payable after ITC",        TaxableValue: "",                IGST: table9.netPayable, CGST: "",    SGST: "" },
    ];
    showExportMenu(data, `GSTR9-${selectedFY}`, e.currentTarget as HTMLElement);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">GSTR-9 Annual Return</h1>
          <p className="text-sm text-gray-500 mt-1">Consolidated annual summary of all GST returns filed during the year</p>
        </div>
        <div className="flex gap-3">
          <select
            value={selectedFY}
            onChange={e => { setSelectedFY(e.target.value); setStatus("Not Generated"); }}
            className="border rounded-lg px-3 py-2 text-sm"
          >
            {FY_OPTIONS.map(fy => <option key={fy} value={fy}>FY {fy}</option>)}
          </select>
          {status === "Generated" && (
            <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">
              <Download className="w-4 h-4" /> Export
            </button>
          )}
        </div>
      </div>

      {/* Validation */}
      <div className="bg-white border rounded-xl p-4 space-y-2">
        <h2 className="font-semibold text-gray-800 mb-3">Pre-generation checks</h2>
        {[
          { key: "hasFiled",        label: "At least one filed transaction exists for this FY" },
          { key: "allSalesHaveHSN", label: "All sales transactions have HSN/SAC codes" },
          { key: "noUnfiled",       label: "No approved-but-unfiled transactions pending" },
        ].map(({ key, label }) => (
          <div key={key} className="flex items-center gap-3">
            {validationChecks[key as keyof typeof validationChecks]
              ? <CheckCircle className="w-4 h-4 text-green-500" />
              : <AlertTriangle className="w-4 h-4 text-amber-500" />}
            <span className="text-sm text-gray-700">{label}</span>
          </div>
        ))}
      </div>

      {/* Table 4 */}
      <div className="bg-white border rounded-xl p-4">
        <h2 className="font-semibold text-gray-800 mb-3">Table 4 — Outward supplies (sales)</h2>
        <table className="w-full text-sm">
          <thead><tr className="text-left text-gray-500 border-b">
            <th className="pb-2">Description</th><th className="pb-2 text-right">Taxable value</th>
            <th className="pb-2 text-right">IGST</th><th className="pb-2 text-right">CGST</th><th className="pb-2 text-right">SGST</th>
          </tr></thead>
          <tbody>
            <tr className="border-b py-2">
              <td className="py-2">4A — Taxable outward supplies</td>
              <td className="py-2 text-right">₹{table4.taxableVal.toLocaleString()}</td>
              <td className="py-2 text-right">₹{table4.igst.toLocaleString()}</td>
              <td className="py-2 text-right">₹{table4.cgst.toLocaleString()}</td>
              <td className="py-2 text-right">₹{table4.sgst.toLocaleString()}</td>
            </tr>
            <tr>
              <td className="py-2">4B — Nil/exempt outward supplies</td>
              <td className="py-2 text-right">₹{table4.nilVal.toLocaleString()}</td>
              <td className="py-2 text-right">—</td><td className="py-2 text-right">—</td><td className="py-2 text-right">—</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Table 6 */}
      <div className="bg-white border rounded-xl p-4">
        <h2 className="font-semibold text-gray-800 mb-3">Table 6 — ITC availed</h2>
        <table className="w-full text-sm">
          <thead><tr className="text-left text-gray-500 border-b">
            <th className="pb-2">Description</th><th className="pb-2 text-right">IGST</th>
            <th className="pb-2 text-right">CGST</th><th className="pb-2 text-right">SGST</th>
          </tr></thead>
          <tbody>
            <tr className="border-b">
              <td className="py-2">6A — All other ITC (inputs, services)</td>
              <td className="py-2 text-right">₹{table6.igst.toLocaleString()}</td>
              <td className="py-2 text-right">₹{table6.cgst.toLocaleString()}</td>
              <td className="py-2 text-right">₹{table6.sgst.toLocaleString()}</td>
            </tr>
            <tr>
              <td className="py-2">6C — ITC on RCM inward supplies</td>
              <td className="py-2 text-right">₹{table6.rcmITC.toLocaleString()}</td>
              <td className="py-2 text-right">—</td><td className="py-2 text-right">—</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Table 9 */}
      <div className="bg-white border rounded-xl p-4">
        <h2 className="font-semibold text-gray-800 mb-3">Table 9 — Tax payable vs paid</h2>
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Output tax liability", value: table9.outputTax  },
            { label: "ITC claimed",          value: table9.itcClaimed },
            { label: "Net tax payable",      value: table9.netPayable },
          ].map(({ label, value }) => (
            <div key={label} className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500">{label}</p>
              <p className="text-lg font-semibold text-gray-900 mt-1">₹{value.toLocaleString()}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Generate button */}
      {status === "Not Generated" && (
        <button
          onClick={() => allValid && setStatus("Generated")}
          disabled={!allValid}
          className={`w-full py-3 rounded-xl font-medium text-sm flex items-center justify-center gap-2 ${allValid ? "bg-blue-600 text-white hover:bg-blue-700" : "bg-gray-100 text-gray-400 cursor-not-allowed"}`}
        >
          <FileText className="w-4 h-4" />
          Generate GSTR-9 for FY {selectedFY}
        </button>
      )}
      {status === "Generated" && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-green-600" />
          <div>
            <p className="font-medium text-green-800">GSTR-9 generated for FY {selectedFY}</p>
            <p className="text-sm text-green-600">Download the export and upload to GST portal</p>
          </div>
        </div>
      )}
    </div>
  );
}