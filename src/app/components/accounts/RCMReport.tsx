import { useState, useMemo } from "react";
import { useCity } from "../../contexts/CityContext";
import { accountingEntryService } from "../../services/accountingEntryService";
import { showExportMenu } from "../../utils/gstExportUtils";
import { Download, AlertCircle } from "lucide-react";

export function RCMReport() {
  const { city } = useCity();
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Get RCM entries
  const rcmEntries = useMemo(() => {
    const from = dateFrom || "1900-01-01";
    const to = dateTo || "2099-12-31";
    const allEntries = accountingEntryService.getAllEntries(city);
    return allEntries.filter((e) => e.isRCM && e.date >= from && e.date <= to);
  }, [city, dateFrom, dateTo]);

  // Calculate this month's RCM
  const thisMonthRCM = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];
    return rcmEntries.filter((e) => e.date >= monthStart && e.date <= monthEnd);
  }, [rcmEntries]);

  // KPI calculations
  const totalRCMLiabilityThisMonth = thisMonthRCM.reduce(
    (sum, e) => sum + (e.rcmCgst || 0) + (e.rcmSgst || 0) + (e.rcmIgst || 0),
    0
  );
  // RCM must be paid in cash -- cannot be offset against ITC
  // Posted entries = liability raised; only entries with status Filed = actually paid
  const totalRCMPaid = thisMonthRCM
    .filter((e) => e.status === "Posted")
    .reduce((sum, e) => sum + (e.rcmCgst || 0) + (e.rcmSgst || 0) + (e.rcmIgst || 0), 0);
  const pendingRCM = Math.max(0, totalRCMLiabilityThisMonth - totalRCMPaid);

  // Total RCM liability (all entries)
  const totalRCMLiability = rcmEntries.reduce(
    (sum, e) => sum + (e.rcmCgst || 0) + (e.rcmSgst || 0) + (e.rcmIgst || 0),
    0
  );

  const handleExport = (e: React.MouseEvent) => {
    const data = rcmEntries.map((entry) => ({
      Date: entry.date,
      "Voucher No": entry.voucherNumber,
      Vendor: entry.vendorName || "-",
      GSTIN: entry.vendorGstin || "-",
      "Invoice No": entry.invoiceNumber,
      "Taxable Value": entry.taxableValue,
      "RCM CGST": entry.rcmCgst || 0,
      "RCM SGST": entry.rcmSgst || 0,
      "RCM IGST": entry.rcmIgst || 0,
      "Total RCM Liability": (entry.rcmCgst || 0) + (entry.rcmSgst || 0) + (entry.rcmIgst || 0),
      "Posted to Output Tax": "Yes",
      Status: entry.status,
    }));
    showExportMenu(data, "rcm-report", e.currentTarget as HTMLElement);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">RCM Report</h1>
          <p className="text-sm text-gray-600">Reverse Charge Mechanism report</p>
        </div>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 px-4 py-2 border rounded text-blue-600 hover:bg-blue-50"
        >
          <Download className="w-4 h-4" />
          Export
        </button>
      </div>

      {/* Info Banner */}
      <div className="p-4 bg-blue-50 border border-blue-400 rounded flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm text-blue-900 font-medium">
            RCM entries are automatically added to your output tax liability.
          </p>
          <p className="text-sm text-blue-800">Verify these in GSTR-3B Table 3.1(d).</p>
        </div>
      </div>

      {/* Date Filters */}
      <div className="flex gap-4 p-4 bg-gray-50 rounded">
        <div>
          <label className="block text-sm font-medium mb-1">Date From</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="border rounded px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Date To</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="border rounded px-3 py-2"
          />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border-l-4 border-amber-500 p-4 rounded shadow">
          <p className="text-sm text-gray-600">Total RCM Liability This Month</p>
          <p className="text-2xl font-bold text-amber-600">₹{totalRCMLiabilityThisMonth.toFixed(2)}</p>
          <p className="text-xs text-gray-500 mt-1">Current month</p>
        </div>
        <div className="bg-white border-l-4 border-green-500 p-4 rounded shadow">
          <p className="text-sm text-gray-600">Total RCM Paid</p>
          <p className="text-2xl font-bold text-green-600">₹{totalRCMPaid.toFixed(2)}</p>
          <p className="text-xs text-gray-500 mt-1">Posted entries</p>
        </div>
        <div className="bg-white border-l-4 border-red-500 p-4 rounded shadow">
          <p className="text-sm text-gray-600">Pending RCM</p>
          <p className="text-2xl font-bold text-red-600">₹{pendingRCM.toFixed(2)}</p>
          <p className="text-xs text-gray-500 mt-1">Awaiting payment</p>
        </div>
      </div>

      {/* Table */}
      <div className="border rounded overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Date</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Voucher No</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Vendor</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">GSTIN</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Invoice No</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">Taxable Value</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">RCM CGST</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">RCM SGST</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">RCM IGST</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">Total RCM Liability</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Posted to Output Tax</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rcmEntries.map((entry) => {
              const totalRCM = (entry.rcmCgst || 0) + (entry.rcmSgst || 0) + (entry.rcmIgst || 0);
              return (
                <tr key={entry.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm">{entry.date}</td>
                  <td className="px-4 py-3 text-sm font-mono">{entry.voucherNumber}</td>
                  <td className="px-4 py-3 text-sm">{entry.vendorName || "-"}</td>
                  <td className="px-4 py-3 text-sm font-mono">{entry.vendorGstin || "-"}</td>
                  <td className="px-4 py-3 text-sm">{entry.invoiceNumber}</td>
                  <td className="px-4 py-3 text-sm text-right">₹{(entry?.taxableValue ?? 0).toFixed(2)}</td>
                  <td className="px-4 py-3 text-sm text-right text-amber-600">₹{(entry.rcmCgst || 0).toFixed(2)}</td>
                  <td className="px-4 py-3 text-sm text-right text-amber-600">₹{(entry.rcmSgst || 0).toFixed(2)}</td>
                  <td className="px-4 py-3 text-sm text-right text-amber-600">₹{(entry.rcmIgst || 0).toFixed(2)}</td>
                  <td className="px-4 py-3 text-sm text-right font-bold text-red-600">₹{totalRCM.toFixed(2)}</td>
                  <td className="px-4 py-3 text-sm">
                    <span className="px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800">Yes</span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        entry.status === "Posted"
                          ? "bg-green-100 text-green-800"
                          : "bg-yellow-100 text-yellow-800"
                      }`}
                    >
                      {entry.status}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {rcmEntries.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <p>No RCM entries found for the selected period</p>
          </div>
        )}
      </div>
    </div>
  );
}
