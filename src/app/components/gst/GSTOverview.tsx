import { BackButton } from "../ui/back-button";
import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, RefreshCw, LayoutDashboard, ShieldCheck, AlertCircle, CheckCircle2, TrendingUp, FileText } from "lucide-react";
import { gstComplianceService, type GSTTransaction, type TransactionStatus } from "../../services/gstComplianceService";
import { useCity } from "../../contexts/CityContext";

export function GSTOverview() {
  const navigate = useNavigate();
  const { city } = useCity();
  const [selectedGSTIN, setSelectedGSTIN] = useState(COMPANY_GST_CONFIG.gstin);
  const [selectedMonth, setSelectedMonth] = useState("April 2026");

  const transactions = useMemo(() => gstComplianceService.getTransactions(city), [city]);
  const monthTransactions = useMemo(() =>
    transactions.filter(t => t.month === selectedMonth),
    [transactions, selectedMonth]
  );

  const kpis = useMemo(() => {
    const totalCount = monthTransactions.length;
    const pendingApproval = monthTransactions.filter(t => t.status === "Validated").length;
    const flagged = monthTransactions.filter(t => t.status === "Flagged").length;
    const outputTax = monthTransactions
      .filter(t => t.transactionType === "Sale")
      .reduce((sum, t) => sum + t.totalTax, 0);
    const itcAvailable = monthTransactions
      .filter(t => t.transactionType === "Purchase" && t.itcEligible)
      .reduce((sum, t) => sum + t.itcAmount, 0);
    const netPayable = outputTax - itcAvailable;

    return { totalCount, pendingApproval, flagged, outputTax, itcAvailable, netPayable };
  }, [monthTransactions]);

  const statusCounts = useMemo(() => {
    const counts: Record<TransactionStatus, number> = {
      Draft: 0, Validated: 0, Flagged: 0, Approved: 0, Filed: 0
    };
    monthTransactions.forEach(t => counts[t.status]++);
    return counts;
  }, [monthTransactions]);

  const riskCounts = useMemo(() => {
    const counts = { Clean: 0, Medium: 0, High: 0, Critical: 0 };
    monthTransactions.forEach(t => counts[t.riskLevel]++);
    return counts;
  }, [monthTransactions]);

  const recentActivity = useMemo(() =>
    transactions
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10),
    [transactions]
  );

  const handleRefresh = () => {
    window.location.reload();
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case "Clean": return "text-green-600 bg-green-50";
      case "Medium": return "text-amber-600 bg-amber-50";
      case "High": return "text-orange-600 bg-orange-50";
      case "Critical": return "text-red-600 bg-red-50";
      default: return "text-gray-600 bg-gray-50";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Draft": return "text-gray-600 bg-gray-100";
      case "Validated": return "text-blue-600 bg-blue-100";
      case "Flagged": return "text-orange-600 bg-orange-100";
      case "Approved": return "text-green-600 bg-green-100";
      case "Filed": return "text-purple-600 bg-purple-100";
      default: return "text-gray-600 bg-gray-100";
    }
  };

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6">
      <BackButton />
      <div className="flex items-center justify-between border-b pb-4">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <ShieldCheck className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">GST Compliance Overview</h1>
            <p className="text-sm text-gray-600">Monitor GST compliance and transaction status</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="relative">
            <select
              value={selectedGSTIN}
              onChange={e => setSelectedGSTIN(e.target.value)}
              className="appearance-none bg-white border border-gray-300 rounded-lg px-4 py-2 pr-10 text-sm"
            >
              <option>{COMPANY_GST_CONFIG.gstin}</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
          </div>
          <div className="relative">
            <select
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              className="appearance-none bg-white border border-gray-300 rounded-lg px-4 py-2 pr-10 text-sm"
            >
              <option>April 2026</option>
              <option>March 2026</option>
              <option>February 2026</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
          </div>
          <button
            onClick={handleRefresh}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <RefreshCw className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-6 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-sm text-gray-600 mb-1">Total Transactions</div>
          <div className="text-2xl font-semibold text-gray-900">{kpis.totalCount}</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-sm text-gray-600 mb-1">Pending Approval</div>
          <div className="text-2xl font-semibold text-blue-600">{kpis.pendingApproval}</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-sm text-gray-600 mb-1">Flagged</div>
          <div className="text-2xl font-semibold text-orange-600">{kpis.flagged}</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-sm text-gray-600 mb-1">Output Tax</div>
          <div className="text-2xl font-semibold text-gray-900">₹{(kpis?.outputTax ?? 0).toLocaleString()}</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-sm text-gray-600 mb-1">ITC Available</div>
          <div className="text-2xl font-semibold text-green-600">₹{(kpis?.itcAvailable ?? 0).toLocaleString()}</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-sm text-gray-600 mb-1">Net GST Payable</div>
          <div className="text-2xl font-semibold text-purple-600">₹{(kpis?.netPayable ?? 0).toLocaleString()}</div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Transaction Pipeline</h3>
        <div className="flex flex-wrap items-center gap-2 sm:gap-4">
          {Object.entries(statusCounts).map(([status, count]) => (
            <div
              key={status}
              onClick={() => navigate(status === "Flagged" ? "/gst/validation" : status === "Validated" ? "/gst/review" : "/gst/transactions")}
              className="flex-1 bg-gray-50 border border-gray-200 rounded-lg p-4 cursor-pointer hover:bg-gray-100 transition-colors"
            >
              <div className="text-sm text-gray-600 mb-1">{status}</div>
              <div className="text-xl font-semibold text-gray-900">{count}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Risk Distribution</h3>
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <div className="flex-1 bg-gray-200 rounded-full h-8 flex overflow-hidden">
              {riskCounts.Clean > 0 && (
                <div style={{ width: `${(riskCounts.Clean / monthTransactions.length) * 100}%` }} className="bg-green-500 flex items-center justify-center text-white text-xs font-medium">
                  {riskCounts.Clean}
                </div>
              )}
              {riskCounts.Medium > 0 && (
                <div style={{ width: `${(riskCounts.Medium / monthTransactions.length) * 100}%` }} className="bg-amber-500 flex items-center justify-center text-white text-xs font-medium">
                  {riskCounts.Medium}
                </div>
              )}
              {riskCounts.High > 0 && (
                <div style={{ width: `${(riskCounts.High / monthTransactions.length) * 100}%` }} className="bg-orange-500 flex items-center justify-center text-white text-xs font-medium">
                  {riskCounts.High}
                </div>
              )}
              {riskCounts.Critical > 0 && (
                <div style={{ width: `${(riskCounts.Critical / monthTransactions.length) * 100}%` }} className="bg-red-500 flex items-center justify-center text-white text-xs font-medium">
                  {riskCounts.Critical}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded"></div>
              <span className="text-gray-600">Clean: {riskCounts.Clean}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-amber-500 rounded"></div>
              <span className="text-gray-600">Medium: {riskCounts.Medium}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-orange-500 rounded"></div>
              <span className="text-gray-600">High: {riskCounts.High}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-500 rounded"></div>
              <span className="text-gray-600">Critical: {riskCounts.Critical}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Recent Activity</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 text-left text-sm text-gray-600">
                <th className="pb-3 font-medium">Invoice No.</th>
                <th className="pb-3 font-medium">Party</th>
                <th className="pb-3 font-medium">Type</th>
                <th className="pb-3 font-medium">Taxable Value</th>
                <th className="pb-3 font-medium">GST</th>
                <th className="pb-3 font-medium">Status</th>
                <th className="pb-3 font-medium">Risk Level</th>
                <th className="pb-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {recentActivity.map(txn => (
                <tr key={txn.id} className="border-b border-gray-100 text-sm">
                  <td className="py-3 font-medium text-gray-900">{txn.invoiceNumber}</td>
                  <td className="py-3 text-gray-700">{txn.partyName}</td>
                  <td className="py-3 text-gray-700">{txn.transactionType}</td>
                  <td className="py-3 text-gray-900">₹{(txn?.taxableValue ?? 0).toLocaleString()}</td>
                  <td className="py-3 text-gray-900">₹{(txn?.totalTax ?? 0).toLocaleString()}</td>
                  <td className="py-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(txn.status)}`}>
                      {txn.status}
                    </span>
                  </td>
                  <td className="py-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getRiskColor(txn.riskLevel)}`}>
                      {txn.riskLevel}
                    </span>
                  </td>
                  <td className="py-3">
                    <button
                      onClick={() => navigate("/gst/transactions")}
                      className="text-blue-600 hover:text-blue-700 text-xs font-medium"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
              {recentActivity.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-gray-500">
                    No transactions found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <button
            onClick={() => navigate("/gst/transactions")}
            className="flex flex-col items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <FileText className="w-8 h-8 text-blue-600" />
            <span className="text-sm font-medium text-gray-900">Add Transaction</span>
          </button>
          <button
            onClick={() => navigate("/gst/review")}
            className="flex flex-col items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <CheckCircle2 className="w-8 h-8 text-green-600" />
            <span className="text-sm font-medium text-gray-900">Pending Approvals</span>
          </button>
          <button
            onClick={() => navigate("/gst/reconciliation")}
            className="flex flex-col items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <TrendingUp className="w-8 h-8 text-purple-600" />
            <span className="text-sm font-medium text-gray-900">Run Reconciliation</span>
          </button>
          <button
            onClick={() => navigate("/gst/reports")}
            className="flex flex-col items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <LayoutDashboard className="w-8 h-8 text-orange-600" />
            <span className="text-sm font-medium text-gray-900">Generate Reports</span>
          </button>
        </div>
      </div>
    </div>
  );
}
