import React, { useState, useMemo } from "react";
import { useCity } from "../../contexts/CityContext";
import { accountingEntryService, CHART_OF_ACCOUNTS_HEADS, type LedgerMaster } from "../../services/accountingEntryService";
import { Download, AlertTriangle } from "lucide-react";

interface LedgerBalance {
  ledgerId: string;
  ledgerName: string;
  accountHead: string;
  accountHeadLabel: string;
  nature: string;
  openingDr: number;
  openingCr: number;
  periodDr: number;
  periodCr: number;
  closingDr: number;
  closingCr: number;
}

export function TrialBalance() {
  const { city } = useCity();
  const [selectedFY, setSelectedFY] = useState(() => {
    const now = new Date();
    const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    return `${String(year).slice(-2)}-${String(year + 1).slice(-2)}`;
  });
  const [asOnDate, setAsOnDate] = useState(new Date().toISOString().split("T")[0]);

  // FIX 10: wrapped in try/catch + city null guard to prevent blank page crash
  const trialBalance = useMemo((): LedgerBalance[] => {
    try {
      if (!city) return []; // guard: city context not loaded yet

      const allLedgers = accountingEntryService.getLedgers(city) || [];
      const allMovements = accountingEntryService.getAllMovements("1900-01-01", asOnDate, city) || [];

      const balances: Record<string, LedgerBalance> = {};

      // Initialise all ledgers with opening balances
      allLedgers.forEach((ledger) => {
        balances[ledger.id] = {
          ledgerId: ledger.id,
          ledgerName: ledger.name,
          accountHead: ledger.accountHead,
          accountHeadLabel: ledger.accountHeadLabel,
          nature: ledger.nature,
          openingDr: ledger.openingBalanceType === "Dr" ? (ledger.openingBalance || 0) : 0,
          openingCr: ledger.openingBalanceType === "Cr" ? (ledger.openingBalance || 0) : 0,
          periodDr: 0,
          periodCr: 0,
          closingDr: 0,
          closingCr: 0,
        };
      });

      // Accumulate period movements
      allMovements.forEach((mov) => {
        if (mov.debitLedgerId && balances[mov.debitLedgerId]) {
          balances[mov.debitLedgerId].periodDr += mov.amount || 0;
        }
        if (mov.creditLedgerId && balances[mov.creditLedgerId]) {
          balances[mov.creditLedgerId].periodCr += mov.amount || 0;
        }
      });

      // Compute closing balances
      Object.values(balances).forEach((bal) => {
        const netDr = bal.openingDr + bal.periodDr;
        const netCr = bal.openingCr + bal.periodCr;
        if (netDr > netCr) {
          bal.closingDr = netDr - netCr;
          bal.closingCr = 0;
        } else {
          bal.closingCr = netCr - netDr;
          bal.closingDr = 0;
        }
      });

      // Return only ledgers with any activity or opening balance
      return Object.values(balances).filter(
        (b) => b.openingDr > 0 || b.openingCr > 0 || b.periodDr > 0 || b.periodCr > 0
      );
    } catch (err) {
      console.error("TrialBalance calculation failed:", err);
      return [];
    }
  }, [asOnDate, city]);

  // Group by account head
  const groupedByHead = useMemo(() => {
    const headGroups: Record<string, LedgerBalance[]> = {};
    trialBalance.forEach((bal) => {
      if (!headGroups[bal.accountHead]) headGroups[bal.accountHead] = [];
      headGroups[bal.accountHead].push(bal);
    });
    return headGroups;
  }, [trialBalance]);

  // Subtotals per head
  const headSubtotals = useMemo(() => {
    const subtotals: Record<string, Omit<LedgerBalance, "ledgerId" | "ledgerName">> = {};
    Object.entries(groupedByHead).forEach(([head, ledgers]) => {
      const headInfo = CHART_OF_ACCOUNTS_HEADS.find((h) => h.value === head);
      subtotals[head] = ledgers.reduce(
        (acc, ledger) => ({
          accountHead: head,
          accountHeadLabel: headInfo?.label || head,
          nature: ledger.nature,
          openingDr: acc.openingDr + ledger.openingDr,
          openingCr: acc.openingCr + ledger.openingCr,
          periodDr: acc.periodDr + ledger.periodDr,
          periodCr: acc.periodCr + ledger.periodCr,
          closingDr: acc.closingDr + ledger.closingDr,
          closingCr: acc.closingCr + ledger.closingCr,
        }),
        {
          accountHead: head,
          accountHeadLabel: headInfo?.label || head,
          nature: ledgers[0].nature,
          openingDr: 0, openingCr: 0,
          periodDr: 0, periodCr: 0,
          closingDr: 0, closingCr: 0,
        }
      );
    });
    return subtotals;
  }, [groupedByHead]);

  // Grand totals
  const totals = useMemo(
    () =>
      trialBalance.reduce(
        (acc, bal) => ({
          openingDr: acc.openingDr + bal.openingDr,
          openingCr: acc.openingCr + bal.openingCr,
          periodDr: acc.periodDr + bal.periodDr,
          periodCr: acc.periodCr + bal.periodCr,
          closingDr: acc.closingDr + bal.closingDr,
          closingCr: acc.closingCr + bal.closingCr,
        }),
        { openingDr: 0, openingCr: 0, periodDr: 0, periodCr: 0, closingDr: 0, closingCr: 0 }
      ),
    [trialBalance]
  );

  const imbalance = Math.abs(totals.closingDr - totals.closingCr);
  const isBalanced = imbalance < 0.01;

  const exportCSV = () => {
    const headers = ["Ledger Name", "Account Head", "Opening Dr", "Opening Cr", "Period Dr", "Period Cr", "Closing Dr", "Closing Cr"];
    const rows = trialBalance.map((b) => [
      b.ledgerName, b.accountHeadLabel,
      (b.openingDr ?? 0).toFixed(2), (b.openingCr ?? 0).toFixed(2),
      (b.periodDr  ?? 0).toFixed(2), (b.periodCr  ?? 0).toFixed(2),
      (b.closingDr ?? 0).toFixed(2), (b.closingCr ?? 0).toFixed(2),
    ]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `trial-balance-${asOnDate}.csv`;
    a.click();
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Trial Balance</h1>
          <p className="text-sm text-gray-600">Six-column trial balance</p>
        </div>
        <button
          onClick={exportCSV}
          className="flex items-center gap-2 px-4 py-2 border rounded text-blue-600 hover:bg-blue-50"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded">
        <div>
          <label className="block text-sm font-medium mb-1">Financial Year</label>
          <select
            value={selectedFY}
            onChange={(e) => setSelectedFY(e.target.value)}
            className="w-full border rounded px-3 py-2"
          >
            <option value="24-25">2024-25</option>
            <option value="25-26">2025-26</option>
            <option value="26-27">2026-27</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">As on Date</label>
          <input
            type="date"
            value={asOnDate}
            onChange={(e) => setAsOnDate(e.target.value)}
            className="w-full border rounded px-3 py-2"
          />
        </div>
      </div>

      {/* Imbalance warning */}
      {!isBalanced && (
        <div className="p-4 bg-red-100 border border-red-400 rounded text-red-900 flex items-start gap-2">
          <AlertTriangle className="w-5 h-5 mt-0.5 shrink-0" />
          <div>
            <p className="font-bold">Trial Balance is out of balance by ₹{imbalance.toFixed(2)}</p>
            <p className="text-sm">Check all entries in the selected period.</p>
          </div>
        </div>
      )}

      {/* FIX 10: empty state instead of blank page */}
      {trialBalance.length === 0 ? (
        <div className="border rounded p-12 text-center text-gray-500">
          <p className="text-lg font-medium">No entries found</p>
          <p className="text-sm mt-1">There are no ledger movements up to {asOnDate}.</p>
          <p className="text-sm">Post expense, purchase or journal vouchers to see data here.</p>
        </div>
      ) : (
        <div className="border rounded overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Ledger Name</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">Opening Dr</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">Opening Cr</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">Period Dr</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">Period Cr</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">Closing Dr</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">Closing Cr</th>
              </tr>
            </thead>
            <tbody>
              {CHART_OF_ACCOUNTS_HEADS.map((head) => {
                const ledgersInHead = groupedByHead[head.value];
                if (!ledgersInHead || ledgersInHead.length === 0) return null;
                const subtotal = headSubtotals[head.value];
                const bgColor =
                  head.nature === "asset"     ? "bg-blue-50"  :
                  head.nature === "liability" ? "bg-red-50"   :
                  head.nature === "income"    ? "bg-green-50" : "bg-amber-50";
                return (
                  <React.Fragment key={head.value}>
                    <tr className={`${bgColor} border-t-2 border-gray-300`}>
                      <td className="px-4 py-2 font-bold text-sm" colSpan={7}>
                        {head.label.toUpperCase()}
                      </td>
                    </tr>
                    {ledgersInHead.map((ledger) => (
                      <tr key={ledger.ledgerId} className="hover:bg-gray-50">
                        <td className="px-4 py-2 text-sm pl-8">{ledger.ledgerName}</td>
                        <td className="px-4 py-2 text-sm text-right">₹{(ledger.openingDr ?? 0).toFixed(2)}</td>
                        <td className="px-4 py-2 text-sm text-right">₹{(ledger.openingCr ?? 0).toFixed(2)}</td>
                        <td className="px-4 py-2 text-sm text-right">₹{(ledger.periodDr  ?? 0).toFixed(2)}</td>
                        <td className="px-4 py-2 text-sm text-right">₹{(ledger.periodCr  ?? 0).toFixed(2)}</td>
                        <td className="px-4 py-2 text-sm text-right font-medium">₹{(ledger.closingDr ?? 0).toFixed(2)}</td>
                        <td className="px-4 py-2 text-sm text-right font-medium">₹{(ledger.closingCr ?? 0).toFixed(2)}</td>
                      </tr>
                    ))}
                    <tr className={`${bgColor} border-b border-gray-300 font-semibold`}>
                      <td className="px-4 py-2 text-sm">Subtotal — {head.label}</td>
                      <td className="px-4 py-2 text-sm text-right">₹{(subtotal?.openingDr ?? 0).toFixed(2)}</td>
                      <td className="px-4 py-2 text-sm text-right">₹{(subtotal?.openingCr ?? 0).toFixed(2)}</td>
                      <td className="px-4 py-2 text-sm text-right">₹{(subtotal?.periodDr  ?? 0).toFixed(2)}</td>
                      <td className="px-4 py-2 text-sm text-right">₹{(subtotal?.periodCr  ?? 0).toFixed(2)}</td>
                      <td className="px-4 py-2 text-sm text-right">₹{(subtotal?.closingDr ?? 0).toFixed(2)}</td>
                      <td className="px-4 py-2 text-sm text-right">₹{(subtotal?.closingCr ?? 0).toFixed(2)}</td>
                    </tr>
                  </React.Fragment>
                );
              })}
              <tr className="bg-gray-900 text-white font-bold">
                <td className="px-4 py-3">GRAND TOTAL</td>
                <td className="px-4 py-3 text-right">₹{(totals.openingDr ?? 0).toFixed(2)}</td>
                <td className="px-4 py-3 text-right">₹{(totals.openingCr ?? 0).toFixed(2)}</td>
                <td className="px-4 py-3 text-right">₹{(totals.periodDr  ?? 0).toFixed(2)}</td>
                <td className="px-4 py-3 text-right">₹{(totals.periodCr  ?? 0).toFixed(2)}</td>
                <td className={`px-4 py-3 text-right ${isBalanced ? "text-green-400" : "text-red-400"}`}>
                  ₹{(totals.closingDr ?? 0).toFixed(2)}
                </td>
                <td className={`px-4 py-3 text-right ${isBalanced ? "text-green-400" : "text-red-400"}`}>
                  ₹{(totals.closingCr ?? 0).toFixed(2)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
