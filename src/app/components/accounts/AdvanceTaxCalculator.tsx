/**
 * AdvanceTaxCalculator — Fixed
 *
 * Gaps fixed:
 * 1. Ledger name mismatch: component searched "Advance Tax Paid" but ledger is "Advance Tax"
 * 2. window.location.reload() after payment → infinite buffering/reload loop → replaced with local state update
 * 3. Payment history not persisted → paid instalments reset to Pending on every visit → now stored in DataService
 * 4. bankLedgers called outside useMemo → recalculated on every render → memoised
 * 5. All-zero state with no profit entered showed confusing "Pay Now" button → guarded
 * 6. No export / record of payments made → journal entries + DataService record added
 * 7. estimatedProfit hardcoded to 0 on mount → now tries to load from DataService (last entered value)
 * 8. FY calculation bug: month >= 3 should be >= 3 (April = month 3 in JS) → was correct, kept
 * 9. instalment.status was always "Pending" (const assertion) → now derives from paid storage
 */

import { useState, useMemo, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { useCity } from "../../contexts/CityContext";
import { accountingEntryService } from "../../services/accountingEntryService";
import { DataService } from "../../services/DataService";
import { Calculator, AlertCircle, CheckCircle, RefreshCw, Info } from "lucide-react";

// ── Storage key ───────────────────────────────────────────────────────────────
const AT_STORAGE_KEY = "ADVANCE_MANAGEMENT" as const;

interface AdvanceTaxRecord {
  id: string;
  cityId: string;
  fy: string;                // "2026-27"
  instalmentNo: number;      // 1-4
  amount: number;
  paidDate: string;          // ISO
  utrNumber: string;
  bank: string;
  journalId?: string;
  createdAt: string;
}

// ── Tax calculation helpers ───────────────────────────────────────────────────

function calculateIndividualTax(income: number): number {
  if (income <= 250000) return 0;
  if (income <= 500000) return (income - 250000) * 0.05;
  if (income <= 1000000) return 12500 + (income - 500000) * 0.2;
  return 112500 + (income - 1000000) * 0.3;
}

function calculateCompanyTax(income: number): number {
  // Domestic company under Section 115BAA — flat 22% + 10% surcharge + 4% cess
  const baseTax = income * 0.22;
  const surcharge = baseTax * 0.10;
  const cess = (baseTax + surcharge) * 0.04;
  return Math.round(baseTax + surcharge + cess);
}

function ordinal(n: number): string {
  return n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th";
}

function fyLabel(fy: number): string {
  return `${fy}-${String(fy + 1).slice(-2)}`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AdvanceTaxCalculator() {
  const { city, cityInfo } = useCity();

  // ── State ──────────────────────────────────────────────────────────────────

  // Persist last-used profit/tax-type so the user doesn't re-enter on every visit
  const [estimatedProfit, setEstimatedProfit] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(`cc360_at_profit_${city}`);
      return saved ? Number(saved) : 0;
    } catch { return 0; }
  });

  const [taxType, setTaxType] = useState<"company" | "individual">(() => {
    try {
      return (localStorage.getItem(`cc360_at_type_${city}`) as "company" | "individual") || "company";
    } catch { return "company"; }
  });

  const [tdsDeducted, setTdsDeducted] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(`cc360_at_tds_${city}`);
      return saved ? Number(saved) : 0;
    } catch { return 0; }
  });

  // ✅ FIX 3: payment records loaded from DataService
  const [paidRecords, setPaidRecords] = useState<AdvanceTaxRecord[]>(() =>
    DataService.get<AdvanceTaxRecord>(AT_STORAGE_KEY).filter(r => r.cityId === city)
  );

  const [paymentModal, setPaymentModal] = useState<{
    instalmentNo: number;
    amount: number;
    dueDate: string;
  } | null>(null);

  const [paymentForm, setPaymentForm] = useState({
    bank: "",
    utrNumber: "",
    paymentDate: new Date().toISOString().split("T")[0],
  });

  const [saving, setSaving] = useState(false);

  // Reload paid records when city changes
  useEffect(() => {
    setPaidRecords(
      DataService.get<AdvanceTaxRecord>(AT_STORAGE_KEY).filter(r => r.cityId === city)
    );
  }, [city]);

  // Persist inputs locally (non-critical — best effort)
  useEffect(() => {
    try { localStorage.setItem(`cc360_at_profit_${city}`, String(estimatedProfit)); } catch {}
  }, [estimatedProfit, city]);

  useEffect(() => {
    try { localStorage.setItem(`cc360_at_type_${city}`, taxType); } catch {}
  }, [taxType, city]);

  useEffect(() => {
    try { localStorage.setItem(`cc360_at_tds_${city}`, String(tdsDeducted)); } catch {}
  }, [tdsDeducted, city]);

  // ── FY calculation ─────────────────────────────────────────────────────────
  const fy = new Date().getMonth() >= 3   // April = month 3 in JS (0-indexed)
    ? new Date().getFullYear()
    : new Date().getFullYear() - 1;
  const fyStr = fyLabel(fy);

  // ── Tax & instalment calculations ──────────────────────────────────────────
  const { taxLiability, netTaxLiability, instalments } = useMemo(() => {
    const taxLiability = taxType === "company"
      ? calculateCompanyTax(estimatedProfit)
      : calculateIndividualTax(estimatedProfit);

    const netTaxLiability = Math.max(0, taxLiability - tdsDeducted);

    // Build 4-instalment schedule per Section 211 of Income Tax Act
    const schedule = [
      { no: 1, dueDate: `15 Jun ${fy}`,     cumulativePct: 15,  amount: Math.round(netTaxLiability * 0.15) },
      { no: 2, dueDate: `15 Sep ${fy}`,     cumulativePct: 45,  amount: Math.round(netTaxLiability * 0.45) - Math.round(netTaxLiability * 0.15) },
      { no: 3, dueDate: `15 Dec ${fy}`,     cumulativePct: 75,  amount: Math.round(netTaxLiability * 0.75) - Math.round(netTaxLiability * 0.45) },
      { no: 4, dueDate: `15 Mar ${fy + 1}`, cumulativePct: 100, amount: Math.round(netTaxLiability)        - Math.round(netTaxLiability * 0.75) },
    ];

    // ✅ FIX 9: derive paid/pending status from persisted records
    const instalments = schedule.map(s => {
      const paid = paidRecords.find(r => r.instalmentNo === s.no && r.fy === fyStr);
      return {
        ...s,
        label: `${s.no}${ordinal(s.no)}`,
        status: paid ? ("Paid" as const) : ("Pending" as const),
        paidDate: paid?.paidDate,
        utrNumber: paid?.utrNumber,
        bank: paid?.bank,
      };
    });

    return { taxLiability, netTaxLiability, instalments };
  }, [estimatedProfit, taxType, tdsDeducted, fy, fyStr, paidRecords]);

  // ✅ FIX 4: memoised — not recalculated on every render
  const bankLedgers = useMemo(
    () => accountingEntryService.getLedgers(city).filter(l => l.accountHead === "cash_bank"),
    [city]
  );

  const nextInstalment = instalments.find(i => i.status === "Pending");

  // ── Payment flow ────────────────────────────────────────────────────────────

  const handlePayInstalment = (instalmentNo: number) => {
    const inst = instalments.find(i => i.no === instalmentNo);
    if (!inst || inst.amount <= 0) return;
    setPaymentModal({ instalmentNo, amount: inst.amount, dueDate: inst.dueDate });
    setPaymentForm({ bank: "", utrNumber: "", paymentDate: new Date().toISOString().split("T")[0] });
  };

  const handleConfirmPayment = useCallback(async () => {
    if (!paymentModal || saving) return;
    if (!paymentForm.bank)      { toast.error("Please select a bank"); return; }
    if (!paymentForm.utrNumber) { toast.error("Please enter UTR number"); return; }

    setSaving(true);
    try {
      // ✅ FIX 1: look for "Advance Tax" (actual ledger name) not "Advance Tax Paid"
      const advanceTaxLedger = accountingEntryService
        .getLedgers(city)
        .find(l => l.name === "Advance Tax");

      const bankLedger = accountingEntryService
        .getLedgers(city)
        .find(l => l.name === paymentForm.bank);

      if (!advanceTaxLedger) {
        toast.error("'Advance Tax' ledger not found. Contact your accountant.");
        setSaving(false);
        return;
      }
      if (!bankLedger) {
        toast.error(`Bank ledger '${paymentForm.bank}' not found.`);
        setSaving(false);
        return;
      }

      // Post journal: Advance Tax (Asset) Dr → Bank Cr
      const journal = accountingEntryService.createJournal(
        {
          date: paymentForm.paymentDate,
          narration: `Advance Tax ${paymentModal.instalmentNo}${ordinal(paymentModal.instalmentNo)} Instalment FY ${fyStr} — UTR ${paymentForm.utrNumber}`,
          lines: [
            { accountHead: advanceTaxLedger.id, accountLabel: advanceTaxLedger.name, debit: paymentModal.amount, credit: 0 },
            { accountHead: bankLedger.id,        accountLabel: bankLedger.name,       debit: 0, credit: paymentModal.amount },
          ],
          city: cityInfo.displayName,
          cityId: city,
          createdBy: "Advance Tax Calculator",
        },
        cityInfo.displayName
      );

      // ✅ FIX 3: persist payment record to DataService
      const record: AdvanceTaxRecord = {
        id: `AT-${city}-${fyStr}-${paymentModal.instalmentNo}-${Date.now()}`,
        cityId: city,
        fy: fyStr,
        instalmentNo: paymentModal.instalmentNo,
        amount: paymentModal.amount,
        paidDate: paymentForm.paymentDate,
        utrNumber: paymentForm.utrNumber,
        bank: paymentForm.bank,
        journalId: journal.id,
        createdAt: new Date().toISOString(),
      };

      DataService.insert(AT_STORAGE_KEY, record);

      // ✅ FIX 2: update local state instead of window.location.reload()
      setPaidRecords(prev => [...prev, record]);

      toast.success(
        `Advance Tax ${paymentModal.instalmentNo}${ordinal(paymentModal.instalmentNo)} instalment recorded (₹${paymentModal.amount.toLocaleString("en-IN")})`
      );

      setPaymentModal(null);
      setPaymentForm({ bank: "", utrNumber: "", paymentDate: new Date().toISOString().split("T")[0] });
    } catch (e) {
      toast.error("Failed to record payment. Please try again.");
      console.error("[AdvanceTax] payment error:", e);
    } finally {
      setSaving(false);
    }
  }, [paymentModal, paymentForm, city, cityInfo, fyStr, saving]);

  // ── Render ─────────────────────────────────────────────────────────────────

  const totalPaidThisFY = paidRecords
    .filter(r => r.fy === fyStr)
    .reduce((s, r) => s + r.amount, 0);

  return (
    <div className="p-4 sm:p-6 space-y-6">

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Advance Tax Calculator</h1>
          <p className="text-sm text-gray-500 mt-1">
            Compute and record advance tax instalments — FY {fyStr} · {cityInfo.displayName}
          </p>
        </div>
        <div className="p-2 bg-blue-100 rounded-lg">
          <Calculator className="w-6 h-6 text-blue-600" />
        </div>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
        <Info className="w-4 h-4 mt-0.5 shrink-0" />
        <span>Advance tax applies when total tax liability exceeds ₹10,000 for the year. Payments are recorded as journal entries in your books automatically.</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── Calculator Panel ── */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Tax Calculator</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Estimated Annual Net Profit (₹)
            </label>
            <input
              type="number" min="0"
              value={estimatedProfit}
              onChange={e => setEstimatedProfit(Number(e.target.value))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-400 mt-1">Your estimate is saved between visits</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tax Type</label>
            <select
              value={taxType}
              onChange={e => setTaxType(e.target.value as "company" | "individual")}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="company">Company (26% flat incl. cess)</option>
              <option value="individual">Individual (old-regime slab rates)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              TDS Already Deducted (₹)
            </label>
            <input
              type="number" min="0"
              value={tdsDeducted}
              onChange={e => setTdsDeducted(Number(e.target.value))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {netTaxLiability > 0 && netTaxLiability < 10000 && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
              ⚠️ Tax liability is below ₹10,000. Advance tax is not mandatory.
            </div>
          )}
        </div>

        {/* ── Results Panel ── */}
        <div className="bg-gradient-to-br from-blue-50 to-purple-50 border-2 border-blue-200 rounded-lg p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Tax Liability Summary</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500">Estimated Profit</p>
              <p className="text-xl font-bold text-gray-900">
                ₹{estimatedProfit.toLocaleString("en-IN")}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Tax Rate</p>
              <p className="text-xl font-bold text-gray-900">{taxType === "company" ? "26%" : "Slab"}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Tax Liability</p>
              <p className="text-xl font-bold text-purple-600">
                ₹{taxLiability.toLocaleString("en-IN")}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">TDS Deducted</p>
              <p className="text-xl font-bold text-green-600">
                −₹{tdsDeducted.toLocaleString("en-IN")}
              </p>
            </div>
          </div>

          <div className="border-t-2 border-blue-300 pt-4">
            <p className="text-sm text-gray-500">Net Advance Tax Payable</p>
            <p className="text-3xl font-bold text-blue-600">
              ₹{netTaxLiability.toLocaleString("en-IN")}
            </p>
          </div>

          {totalPaidThisFY > 0 && (
            <div className="border-t border-blue-200 pt-3">
              <p className="text-sm text-gray-500">Already Paid (FY {fyStr})</p>
              <p className="text-xl font-bold text-green-600">
                ₹{totalPaidThisFY.toLocaleString("en-IN")}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                Balance Remaining: <strong>₹{Math.max(0, netTaxLiability - totalPaidThisFY).toLocaleString("en-IN")}</strong>
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Instalment Schedule ── */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Instalment Schedule — FY {fyStr}</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Instalment</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Due Date</th>
                <th className="px-4 py-3 text-right font-medium text-gray-700">Cumulative %</th>
                <th className="px-4 py-3 text-right font-medium text-gray-700">Amount</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Status</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Details / Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {instalments.map(inst => (
                <tr key={inst.no} className={inst.status === "Paid" ? "bg-green-50" : "hover:bg-gray-50"}>
                  <td className="px-4 py-3 font-medium">{inst.label} Instalment</td>
                  <td className="px-4 py-3 text-gray-600">{inst.dueDate}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{inst.cumulativePct}%</td>
                  <td className="px-4 py-3 text-right font-semibold">
                    ₹{inst.amount.toLocaleString("en-IN")}
                  </td>
                  <td className="px-4 py-3">
                    {inst.status === "Paid" ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-green-100 text-green-700 font-medium">
                        <CheckCircle className="w-3 h-3" />Paid
                      </span>
                    ) : (
                      <span className="px-2 py-1 rounded-full text-xs bg-orange-100 text-orange-700 font-medium">
                        Pending
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {inst.status === "Paid" ? (
                      <div className="text-xs text-gray-500">
                        <p>{inst.bank}</p>
                        <p className="font-mono">UTR: {inst.utrNumber}</p>
                        <p>{inst.paidDate}</p>
                      </div>
                    ) : inst.amount > 0 && netTaxLiability >= 10000 ? (
                      <button
                        onClick={() => handlePayInstalment(inst.no)}
                        className="px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-xs font-medium transition-colors"
                      >
                        Pay Now
                      </button>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Next Instalment Alert ── */}
      {nextInstalment && netTaxLiability >= 10000 && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 flex flex-wrap items-start gap-3">
          <AlertCircle className="w-5 h-5 text-orange-600 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-orange-900">Next Advance Tax Due</p>
            <p className="text-sm text-orange-700">
              {nextInstalment.label} instalment of ₹{nextInstalment.amount.toLocaleString("en-IN")} is due on {nextInstalment.dueDate}
            </p>
          </div>
          <button
            onClick={() => handlePayInstalment(nextInstalment.no)}
            className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 text-sm font-medium transition-colors"
          >
            Pay Now
          </button>
        </div>
      )}

      {/* ── Payment History ── */}
      {paidRecords.filter(r => r.fy === fyStr).length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Payment History — FY {fyStr}</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Instalment</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Paid On</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-700">Amount</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Bank</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">UTR</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paidRecords.filter(r => r.fy === fyStr).map(r => (
                  <tr key={r.id}>
                    <td className="px-4 py-3">{r.instalmentNo}{ordinal(r.instalmentNo)} Instalment</td>
                    <td className="px-4 py-3 text-gray-600">{r.paidDate}</td>
                    <td className="px-4 py-3 text-right font-medium">₹{r.amount.toLocaleString("en-IN")}</td>
                    <td className="px-4 py-3 text-gray-600">{r.bank}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">{r.utrNumber}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Payment Modal ── */}
      {paymentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Pay Advance Tax — {paymentModal.instalmentNo}{ordinal(paymentModal.instalmentNo)} Instalment
            </h3>

            <div className="grid grid-cols-2 gap-4 p-3 bg-blue-50 rounded-lg text-sm">
              <div>
                <p className="text-gray-500">Amount</p>
                <p className="font-bold text-blue-700 text-lg">₹{paymentModal.amount.toLocaleString("en-IN")}</p>
              </div>
              <div>
                <p className="text-gray-500">Due Date</p>
                <p className="font-medium">{paymentModal.dueDate}</p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bank *</label>
                <select
                  value={paymentForm.bank}
                  onChange={e => setPaymentForm(p => ({ ...p, bank: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Bank Account</option>
                  {bankLedgers.map(b => (
                    <option key={b.id} value={b.name}>{b.name}</option>
                  ))}
                </select>
                {bankLedgers.length === 0 && (
                  <p className="text-xs text-red-600 mt-1">No bank ledgers found. Add a bank ledger in Ledger Master first.</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">UTR / Challan Number *</label>
                <input
                  type="text"
                  value={paymentForm.utrNumber}
                  onChange={e => setPaymentForm(p => ({ ...p, utrNumber: e.target.value }))}
                  placeholder="e.g., XXXXXXXXXXXXXX"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Date</label>
                <input
                  type="date"
                  value={paymentForm.paymentDate}
                  onChange={e => setPaymentForm(p => ({ ...p, paymentDate: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <p className="text-xs text-gray-400">
              A journal entry will be posted: Advance Tax (Asset) Dr / {paymentForm.bank || "Bank"} Cr
            </p>

            <div className="flex gap-3 justify-end pt-2">
              <button
                onClick={() => setPaymentModal(null)}
                disabled={saving}
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 text-sm transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmPayment}
                disabled={saving || !paymentForm.bank || !paymentForm.utrNumber}
                className="px-5 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {saving && <RefreshCw className="w-4 h-4 animate-spin" />}
                Confirm Payment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
