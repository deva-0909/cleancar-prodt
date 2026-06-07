import { useState, useMemo } from "react";
import { toast } from "sonner";
import { GitCompare, Upload, Download } from "lucide-react";
import { gstComplianceService, type GSTReconciliationRecord } from "../../services/gstComplianceService";
import { showExportMenu } from "../../utils/gstExportUtils";
import { useCity } from "../../contexts/CityContext";

export function GSTReconciliation() {
  const { city } = useCity();
  const [activeTab, setActiveTab] = useState<"upload" | "results" | "itc">("upload");
  const [records, setRecords] = useState<GSTReconciliationRecord[]>(gstComplianceService.getReconciliation());
  const [filterMatch, setFilterMatch] = useState("");
  const [searchVendor, setSearchVendor] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      const matchStatus = !filterMatch || r.matchStatus === filterMatch;
      const matchVendor = !searchVendor || r.vendorName.toLowerCase().includes(searchVendor.toLowerCase());
      return matchStatus && matchVendor;
    });
  }, [records, filterMatch, searchVendor]);

  const transactions = gstComplianceService.getTransactions().filter(t => t.transactionType === "Purchase");

  const itcSummary = useMemo(() => {
    const total = transactions.reduce((sum, t) => sum + (t.itcEligible ? t.itcAmount : 0), 0);
    const claimed = transactions.filter(t => t.status === "Filed" && t.itcEligible).reduce((sum, t) => sum + t.itcAmount, 0);
    const provisional = transactions.filter(t => t.status === "Approved" && t.itcEligible).reduce((sum, t) => sum + t.itcAmount, 0);
    const blocked = 0;
    const claimable = total - claimed - blocked;
    return { total, claimed, provisional, blocked, claimable };
  }, [transactions]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const rawText = event.target?.result as string;
      const text = rawText.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
      const parseCSVLine = (line: string): string[] => {
        const result: string[] = []; let cur = "", inQuotes = false;
        for (const ch of line) {
          if (ch === "\"" && !inQuotes) { inQuotes = true; }
          else if (ch === "\"" && inQuotes) { inQuotes = false; }
          else if (ch === "," && !inQuotes) { result.push(cur.trim()); cur = ""; }
          else { cur += ch; }
        }
        result.push(cur.trim()); return result;
      };
      const lines = text.split('\n').filter(l => l.trim());
      const headers = parseCSVLine(lines[0]);

      const newRecords: GSTReconciliationRecord[] = lines.slice(1).map((line, idx) => {
        const values = parseCSVLine(line);
        return {
          id: crypto.randomUUID(),
          vendorId: `vendor-${idx}`,
          vendorName: values[0] || "Unknown Vendor",
          vendorGstin: values[1] || "",
          invoiceNumber: values[2] || "",
          invoiceDate: values[3] || "",
          taxableValue: parseFloat(values[4]) || 0,
          gstAmount: parseFloat(values[5]) || 0,
          inSystemBooks: false,
          inGSTR2B: true,
          matchStatus: "In 2B Only",
          differenceAmount: 0,
          itcClaimable: true,
          itcStatus: "Not Claimed",
          vendorFilingStatus: values[6] || "Filed",
          notes: "",
          month: selectedMonth,
          year: selectedYear
        };
      });

      // Auto-match each 2B record against existing system transactions
      const systemTransactions = gstComplianceService.getTransactions(city);

      const matchedRecords = newRecords.map(rec => {
        const match = systemTransactions.find(t =>
          t.transactionType === "Purchase" &&
          t.invoiceNumber?.trim().toLowerCase() === rec.invoiceNumber?.trim().toLowerCase() &&
          t.partyGstin?.trim().toUpperCase() === rec.vendorGstin?.trim().toUpperCase()
        );

        if (!match) return rec; // stays "In 2B Only"

        const systemGST = match.cgst + match.sgst + match.igst;
        const diff = Math.abs(systemGST - rec.gstAmount);

        return {
          ...rec,
          vendorId: match.partyId,
          inSystemBooks: true,
          matchStatus: diff < 1
            ? "Matched" as const
            : diff < 10
            ? "Amount Mismatch" as const
            : "Amount Mismatch" as const,
          differenceAmount: diff,
          itcClaimable: match.itcEligible,
          itcStatus: match.itcEligible ? "Provisional" as const : "Blocked" as const,
        };
      });

      matchedRecords.forEach(rec => gstComplianceService.saveReconciliationRecord(rec));
      setRecords(gstComplianceService.getReconciliation());

      const matched   = matchedRecords.filter(r => r.matchStatus === "Matched").length;
      const unmatched = matchedRecords.filter(r => r.matchStatus !== "Matched").length;
      toast.info(`Upload complete. ${matched} matched, ${unmatched} unmatched. Review the Results tab.`);
      setActiveTab("results");
    };
    reader.readAsText(file);
  };

  const handleExport = (e: React.MouseEvent) => {
    const data = filteredRecords.map(r => ({
      Vendor: r.vendorName,
      GSTIN: r.vendorGstin,
      "Invoice No": r.invoiceNumber,
      "System Amount": r.inSystemBooks ? r.taxableValue : 0,
      "2B Amount": r.inGSTR2B ? r.taxableValue : 0,
      "Difference": r.differenceAmount,
      "Match Status": r.matchStatus,
      "ITC Status": r.itcStatus,
      "Filing Status": r.vendorFilingStatus
    }));
    showExportMenu(data, "gst-reconciliation", e.currentTarget as HTMLElement);
  };

  const getMatchColor = (status: string) => {
    switch (status) {
      case "Matched": return "text-green-700 bg-green-100";
      case "In Books Only": return "text-blue-700 bg-blue-100";
      case "In 2B Only": return "text-orange-700 bg-orange-100";
      case "Amount Mismatch": return "text-red-700 bg-red-100";
      case "Date Mismatch": return "text-amber-700 bg-amber-100";
      default: return "text-gray-700 bg-gray-100";
    }
  };

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between border-b pb-4">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="p-2 bg-teal-100 rounded-lg">
            <GitCompare className="w-6 h-6 text-teal-600" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">GST Reconciliation</h1>
            <p className="text-sm text-gray-600">Match purchase invoices with GSTR-2B data</p>
          </div>
        </div>
      </div>

      <div className="flex gap-2 border-b">
        <button
          onClick={() => setActiveTab("upload")}
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
            activeTab === "upload"
              ? "border-teal-600 text-teal-600"
              : "border-transparent text-gray-600 hover:text-gray-900"
          }`}
        >
          Upload 2B Data
        </button>
        <button
          onClick={() => setActiveTab("results")}
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
            activeTab === "results"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-600 hover:text-gray-900"
          }`}
        >
          Reconciliation Results
        </button>
        <button
          onClick={() => setActiveTab("itc")}
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
            activeTab === "itc"
              ? "border-purple-600 text-purple-600"
              : "border-transparent text-gray-600 hover:text-gray-900"
          }`}
        >
          ITC Summary
        </button>
      </div>

      {activeTab === "upload" && (
        <div className="bg-white border border-gray-200 rounded-lg p-8">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-teal-100 rounded-full flex items-center justify-center mx-auto">
              <Upload className="w-8 h-8 text-teal-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-1">Upload GSTR-2B Data</h3>
              <p className="text-sm text-gray-600">Upload CSV or Excel file with vendor invoice data</p>
            </div>

            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 hover:border-teal-500 transition-colors">
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileUpload}
                className="hidden"
                id="file-upload"
              />
              <label
                htmlFor="file-upload"
                className="cursor-pointer flex flex-col items-center gap-2"
              >
                <div className="p-3 bg-teal-50 rounded-lg">
                  <Upload className="w-6 h-6 text-teal-600" />
                </div>
                <div className="text-sm">
                  <span className="text-teal-600 font-medium">Click to upload</span>
                  <span className="text-gray-600"> or drag and drop</span>
                </div>
                <p className="text-xs text-gray-500">CSV or Excel (MAX. 10MB)</p>
              </label>
            </div>

            <div className="text-left bg-gray-50 border border-gray-200 rounded-lg p-4">
              <p className="text-sm font-medium text-gray-900 mb-2">Expected Columns:</p>
              <ul className="text-xs text-gray-600 space-y-1">
                <li>• Vendor GSTIN</li>
                <li>• Invoice Number</li>
                <li>• Invoice Date</li>
                <li>• Taxable Value</li>
                <li>• GST Amount</li>
                <li>• Filing Status</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {activeTab === "results" && (
        <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex gap-4">
              <input
                type="text"
                placeholder="Search vendor..."
                value={searchVendor}
                onChange={e => setSearchVendor(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
              <select
                value={filterMatch}
                onChange={e => setFilterMatch(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="">All Match Status</option>
                <option value="Matched">Matched</option>
                <option value="In Books Only">In Books Only</option>
                <option value="In 2B Only">In 2B Only</option>
                <option value="Amount Mismatch">Amount Mismatch</option>
                <option value="Date Mismatch">Date Mismatch</option>
              </select>
            </div>
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 text-left text-sm text-gray-600">
                  <th className="pb-3 font-medium">Vendor</th>
                  <th className="pb-3 font-medium">GSTIN</th>
                  <th className="pb-3 font-medium">Invoice No.</th>
                  <th className="pb-3 font-medium">System Amount</th>
                  <th className="pb-3 font-medium">2B Amount</th>
                  <th className="pb-3 font-medium">Difference</th>
                  <th className="pb-3 font-medium">Match Status</th>
                  <th className="pb-3 font-medium">ITC Status</th>
                  <th className="pb-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map(rec => (
                  <tr key={rec.id} className="border-b border-gray-100 text-sm">
                    <td className="py-3 font-medium text-gray-900">{rec.vendorName}</td>
                    <td className="py-3 text-gray-700 font-mono text-xs">{rec.vendorGstin}</td>
                    <td className="py-3 text-gray-700">{rec.invoiceNumber}</td>
                    <td className="py-3 text-gray-900">₹{rec.inSystemBooks ? (rec?.taxableValue ?? 0).toLocaleString() : 0}</td>
                    <td className="py-3 text-gray-900">₹{rec.inGSTR2B ? (rec?.taxableValue ?? 0).toLocaleString() : 0}</td>
                    <td className="py-3 text-gray-900">₹{(rec?.differenceAmount ?? 0).toLocaleString()}</td>
                    <td className="py-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getMatchColor(rec.matchStatus)}`}>
                        {rec.matchStatus}
                      </span>
                    </td>
                    <td className="py-3">
                      <span className="px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-700">
                        {rec.itcStatus}
                      </span>
                    </td>
                    <td className="py-3">
                      <button className="text-blue-600 hover:text-blue-700 text-xs font-medium">
                        Review
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredRecords.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-gray-500">
                      No reconciliation records found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "itc" && (
        <div className="space-y-6">
          <div className="grid grid-cols-5 gap-4">
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="text-sm text-gray-600 mb-1">Total ITC Available</div>
              <div className="text-2xl font-semibold text-gray-900">₹{(itcSummary?.total ?? 0).toLocaleString()}</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="text-sm text-gray-600 mb-1">ITC Claimed</div>
              <div className="text-2xl font-semibold text-green-600">₹{(itcSummary?.claimed ?? 0).toLocaleString()}</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="text-sm text-gray-600 mb-1">Provisional ITC</div>
              <div className="text-2xl font-semibold text-blue-600">₹{(itcSummary?.provisional ?? 0).toLocaleString()}</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="text-sm text-gray-600 mb-1">Blocked ITC</div>
              <div className="text-2xl font-semibold text-red-600">₹{(itcSummary?.blocked ?? 0).toLocaleString()}</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="text-sm text-gray-600 mb-1">Net ITC Claimable</div>
              <div className="text-2xl font-semibold text-purple-600">₹{(itcSummary?.claimable ?? 0).toLocaleString()}</div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="font-semibold text-gray-900 mb-4">ITC Entries by Vendor</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-sm text-gray-600">
                    <th className="pb-3 font-medium">Vendor</th>
                    <th className="pb-3 font-medium">GSTIN</th>
                    <th className="pb-3 font-medium">ITC Amount</th>
                    <th className="pb-3 font-medium">Status</th>
                    <th className="pb-3 font-medium">Filing Status</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.filter(t => t.itcEligible).map(txn => (
                    <tr key={txn.id} className="border-b border-gray-100 text-sm">
                      <td className="py-3 font-medium text-gray-900">{txn.partyName}</td>
                      <td className="py-3 text-gray-700 font-mono text-xs">{txn.partyGstin}</td>
                      <td className="py-3 text-gray-900">₹{(txn?.itcAmount ?? 0).toLocaleString()}</td>
                      <td className="py-3">
                        <span className="px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-700">
                          {txn.status === "Filed" ? "Claimed" : txn.status === "Approved" ? "Provisional" : "Not Claimed"}
                        </span>
                      </td>
                      <td className="py-3">
                        <span className="px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-700">
                          Regular Filer
                        </span>
                      </td>
                    </tr>
                  ))}
                  {transactions.filter(t => t.itcEligible).length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-gray-500">
                        No ITC entries found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
