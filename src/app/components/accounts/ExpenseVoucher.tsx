import { useState, useEffect } from "react";
import { Receipt, Save, Plus } from "lucide-react";
import { accountingEntryService, TDS_RATE_CHART, type ItemMaster, type LedgerMaster } from "../../services/accountingEntryService";
import { gstComplianceService, COMPANY_GST_CONFIG } from "../../services/gstComplianceService";
import { useCity } from "../../contexts/CityContext";
import { useRole } from "../../contexts/RoleContext";
import { toast } from "sonner";

type PaymentMode = "Cash" | "Bank" | "Credit (Partial)" | "Credit (Full)";

// ── FIX 1: inline item creation state ────────────────────────────────────────
interface NewItemForm {
  itemName: string;
  hsnCode: string;
  defaultGSTRate: 0 | 5 | 12 | 18 | 28 | 40;
  unitOfMeasure: string;
  description: string;
}

export function ExpenseVoucher() {
  const { city, cityId } = useCity();
  const { currentUser } = useRole();

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split("T")[0],
    vendorId: "",
    itemId: "",
    hsnCode: "",
    expenseLedgerId: "",
    quantity: 1,
    unitPrice: 0,
    totalAmount: 0,
    gstRate: 18 as 0 | 5 | 12 | 18 | 28 | 40,
    supplyType: "" as "INTRA_STATE" | "INTER_STATE" | "",
    cgst: 0,
    sgst: 0,
    igst: 0,
    grandTotal: 0,
    tdsSection: "",
    tdsAmount: 0,
    // FIX 4: all four payment modes available
    paymentMode: "Cash" as PaymentMode,
    amountPaidNow: 0,
    creditorLedgerId: "",
    dueDate: "",
    narration: "",
  });

  const [vendors, setVendors] = useState<LedgerMaster[]>([]);
  const [items, setItems] = useState<ItemMaster[]>([]);
  const [expenseLedgers, setExpenseLedgers] = useState<LedgerMaster[]>([]);
  const [creditors, setCreditors] = useState<LedgerMaster[]>([]);
  const [selectedVendor, setSelectedVendor] = useState<LedgerMaster | null>(null);
  const [selectedItem, setSelectedItem] = useState<ItemMaster | null>(null);

  // FIX 7: inline item creation
  const [showCreateItem, setShowCreateItem] = useState(false);
  const [newItemForm, setNewItemForm] = useState<NewItemForm>({
    itemName: "",
    hsnCode: "",
    defaultGSTRate: 18,
    unitOfMeasure: "Nos",
    description: "",
  });

  useEffect(() => {
    const allLedgers = accountingEntryService.getLedgers(cityId);

    // FIX 6: vendor dropdown shows vendor NAME — filter out generic system "Accounts Payable" ledger
    setVendors(
      allLedgers.filter(
        (l) =>
          (l.accountHead === "accounts_payable" || l.type === "vendor") &&
          !l.isSystem // exclude the generic system "Accounts Payable" default ledger
      )
    );

    // FIX 3 + FIX 5: expense ledger shows l.name (e.g. "Professional Fees")
    setExpenseLedgers(allLedgers.filter((l) => l.nature === "expense"));

    setCreditors(
      allLedgers.filter(
        (l) =>
          l.accountHead === "accounts_payable" ||
          l.accountHead === "other_liabilities" ||
          l.accountHead === "credit_cards"
      )
    );
    setItems(accountingEntryService.getItems());
  }, [cityId]);

  useEffect(() => {
    if (formData.quantity && formData.unitPrice) {
      setFormData((prev) => ({ ...prev, totalAmount: prev.quantity * prev.unitPrice }));
    }
  }, [formData.quantity, formData.unitPrice]);

  useEffect(() => {
    if (formData.totalAmount && formData.gstRate !== undefined && formData.supplyType) {
      const gst = gstComplianceService.calculateGST(
        formData.totalAmount,
        formData.gstRate,
        formData.supplyType as "INTRA_STATE" | "INTER_STATE" | "EXPORT" | "RCM_INTRA" | "RCM_INTER"
      );
      setFormData((prev) => ({
        ...prev,
        cgst: gst.cgst,
        sgst: gst.sgst,
        igst: gst.igst,
        grandTotal: gst.invoiceTotal,
      }));
    }
  }, [formData.totalAmount, formData.gstRate, formData.supplyType]);

  useEffect(() => {
    // FIX 1: TDS rate uses rateIndividual for Individual/HUF, rateCompany for others
    if (formData.tdsSection && formData.totalAmount) {
      const tdsConfig = TDS_RATE_CHART.find((t) => t.section === formData.tdsSection);
      if (tdsConfig) {
        const isIndividualOrHUF = ["Individual", "HUF"].includes(
          (selectedVendor as any)?.legalEntityType || ""
        );
        const tdsRate = isIndividualOrHUF ? tdsConfig.rateIndividual : tdsConfig.rateCompany;
        const tdsAmount = Math.round(formData.totalAmount * tdsRate) / 100;
        setFormData((prev) => ({ ...prev, tdsAmount }));
      }
    } else {
      setFormData((prev) => ({ ...prev, tdsAmount: 0 }));
    }
  }, [formData.tdsSection, formData.totalAmount, selectedVendor]);

  useEffect(() => {
    if (formData.paymentMode === "Cash" || formData.paymentMode === "Bank") {
      setFormData((prev) => ({ ...prev, amountPaidNow: prev.grandTotal }));
    }
  }, [formData.paymentMode, formData.grandTotal]);

  const handleVendorChange = (vendorId: string) => {
    const vendor = vendors.find((v) => v.id === vendorId);
    if (vendor) {
      setSelectedVendor(vendor);
      let vendorStateCode = COMPANY_GST_CONFIG.stateCode;
      if (vendor.gstin && vendor.gstin.length >= 2) {
        vendorStateCode = vendor.gstin.substring(0, 2);
      }
      const supplyType =
        vendorStateCode === COMPANY_GST_CONFIG.stateCode ? "INTRA_STATE" : "INTER_STATE";
      setFormData((prev) => ({ ...prev, vendorId, supplyType }));
    }
  };

  const handleItemChange = (itemId: string) => {
    // FIX 7: handle inline create trigger
    if (itemId === "__create_new__") {
      setShowCreateItem(true);
      return;
    }
    const item = items.find((i) => i.id === itemId);
    if (item) {
      setSelectedItem(item);
      setFormData((prev) => ({
        ...prev,
        itemId,
        hsnCode: item.hsnCode,
        expenseLedgerId: item.defaultExpenseLedgerId,
        gstRate: item.defaultGSTRate,
      }));
    }
  };

  // FIX 7: save inline-created item
  const handleCreateItem = () => {
    if (!newItemForm.itemName) {
      toast.error("Item name is required");
      return;
    }
    const newItem: ItemMaster = {
      id: `ITEM-${Date.now()}`,
      itemName: newItemForm.itemName,
      hsnCode: newItemForm.hsnCode,
      defaultExpenseLedgerId: "",
      defaultExpenseLedgerName: "",
      defaultGSTRate: newItemForm.defaultGSTRate,
      unitOfMeasure: newItemForm.unitOfMeasure,
      description: newItemForm.description,
      status: "Active",
      createdAt: new Date().toISOString(),
    };
    accountingEntryService.saveItem(newItem);
    setItems(accountingEntryService.getItems());
    setSelectedItem(newItem);
    setFormData((prev) => ({
      ...prev,
      itemId: newItem.id,
      hsnCode: newItem.hsnCode,
      gstRate: newItem.defaultGSTRate,
    }));
    setShowCreateItem(false);
    setNewItemForm({ itemName: "", hsnCode: "", defaultGSTRate: 18, unitOfMeasure: "Nos", description: "" });
    toast.success(`Item "${newItem.itemName}" created`);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.vendorId || !formData.itemId || !formData.expenseLedgerId) {
      toast.error("Please fill all required fields");
      return;
    }

    const vendor = vendors.find((v) => v.id === formData.vendorId);
    const expenseLedger = expenseLedgers.find((l) => l.id === formData.expenseLedgerId);
    const allLedgers = accountingEntryService.getLedgers(cityId);
    const inputCGSTLedger = allLedgers.find((l) => l.name === "Input CGST");
    const inputSGSTLedger = allLedgers.find((l) => l.name === "Input SGST");
    const inputIGSTLedger = allLedgers.find((l) => l.name === "Input IGST");
    const axisBankLedger = allLedgers.find((l) => l.name === "Axis Bank");

    if (!vendor || !expenseLedger) {
      toast.error("Invalid vendor or expense ledger");
      return;
    }

    // FIX 4: validate credit modes
    if (formData.paymentMode === "Credit (Partial)") {
      if (formData.amountPaidNow <= 0) {
        toast.error("Amount paid now must be greater than 0 for partial payment");
        return;
      }
      if (formData.amountPaidNow >= formData.grandTotal) {
        toast.error("For full payment use 'Bank' mode instead of partial credit.");
        return;
      }
      if (!formData.creditorLedgerId) {
        toast.error("Creditor ledger is required for partial payment");
        return;
      }
      if (!formData.dueDate) {
        toast.error("Due date is required for partial payment");
        return;
      }
    }
    if (formData.paymentMode === "Credit (Full)") {
      if (!formData.creditorLedgerId) {
        toast.error("Creditor ledger is required for credit purchase");
        return;
      }
      if (!formData.dueDate) {
        toast.error("Due date is required for credit purchase");
        return;
      }
    }

    if (
      (formData.paymentMode === "Cash" ||
        formData.paymentMode === "Bank" ||
        formData.paymentMode === "Credit (Partial)") &&
      !axisBankLedger
    ) {
      toast.error("Axis Bank ledger not found. Please initialize system ledgers in Ledger Master.");
      return;
    }
    if (formData.cgst > 0 && !inputCGSTLedger) {
      toast.error("Input CGST ledger not found. Please initialize system ledgers.");
      return;
    }
    if (formData.sgst > 0 && !inputSGSTLedger) {
      toast.error("Input SGST ledger not found. Please initialize system ledgers.");
      return;
    }
    if (formData.igst > 0 && !inputIGSTLedger) {
      toast.error("Input IGST ledger not found. Please initialize system ledgers.");
      return;
    }

    // Build voucher number
    const existingEntries = accountingEntryService.getAllEntries(cityId);
    const fy =
      new Date().getMonth() >= 3
        ? `${new Date().getFullYear()}-${String(new Date().getFullYear() + 1).slice(-2)}`
        : `${new Date().getFullYear() - 1}-${String(new Date().getFullYear()).slice(-2)}`;
    const prefix = `EXP/${city.toUpperCase()}/${fy}`;
    const maxSeq = existingEntries
      .filter((e) => e.voucherNumber?.startsWith(prefix))
      .map((e) => parseInt(e.voucherNumber.split("/").pop() || "0", 10))
      .reduce((max, n) => Math.max(max, n), 0);
    const voucherNumber = `${prefix}/${String(maxSeq + 1).padStart(4, "0")}`;

    // ── FIX 8 + FIX 4: Correct journal entries ─────────────────────────────
    // Entry 1: Expense Dr / GST Dr / Vendor Cr
    accountingEntryService.createJournal(
      {
        date: formData.date,
        narration: `Purchase from ${vendor.name} — ${formData.narration || selectedItem?.itemName || ""}  [${voucherNumber}]`,
        lines: [
          // FIX 8: expense ledger gets net amount only (not grandTotal)
          { accountHead: expenseLedger.id, accountLabel: expenseLedger.name, debit: formData.totalAmount, credit: 0 },
          // FIX 8 + FIX 9: GST goes to Input ITC ledgers (asset), not to expense
          ...(formData.cgst > 0
            ? [{ accountHead: inputCGSTLedger!.id, accountLabel: "Input CGST", debit: formData.cgst, credit: 0 }]
            : []),
          ...(formData.sgst > 0
            ? [{ accountHead: inputSGSTLedger!.id, accountLabel: "Input SGST", debit: formData.sgst, credit: 0 }]
            : []),
          ...(formData.igst > 0
            ? [{ accountHead: inputIGSTLedger!.id, accountLabel: "Input IGST", debit: formData.igst, credit: 0 }]
            : []),
          // Credit vendor full grandTotal
          { accountHead: vendor.id, accountLabel: vendor.name, debit: 0, credit: formData.grandTotal },
        ],
        city,
        cityId,
        createdBy: currentUser.name,
      },
      city
    );

    // Entry 2: Payment (only for Cash/Bank/Partial)
    if (formData.paymentMode === "Cash" || formData.paymentMode === "Bank") {
      accountingEntryService.createJournal(
        {
          date: formData.date,
          narration: `Payment to ${vendor.name} via ${formData.paymentMode}`,
          lines: [
            { accountHead: vendor.id, accountLabel: vendor.name, debit: formData.grandTotal, credit: 0 },
            { accountHead: axisBankLedger!.id, accountLabel: "Axis Bank", debit: 0, credit: formData.grandTotal },
          ],
          city,
          cityId,
          createdBy: currentUser.name,
        },
        city
      );
    } else if (formData.paymentMode === "Credit (Partial)") {
      const balance = formData.grandTotal - formData.amountPaidNow;
      // partial payment now via bank
      accountingEntryService.createJournal(
        {
          date: formData.date,
          narration: `Partial payment to ${vendor.name} — ₹${formData.amountPaidNow} paid, ₹${balance} outstanding`,
          lines: [
            { accountHead: vendor.id, accountLabel: vendor.name, debit: formData.amountPaidNow, credit: 0 },
            { accountHead: axisBankLedger!.id, accountLabel: "Axis Bank", debit: 0, credit: formData.amountPaidNow },
          ],
          city,
          cityId,
          createdBy: currentUser.name,
        },
        city
      );
    }
    // Credit (Full): no payment entry yet — vendor ledger carries the balance until paid

    // FIX 1 (TDS): Entry 3 — TDS deducted at source
    // Vendor Dr (reduce payable by TDS amount) / TDS Payable Cr
    if (formData.tdsAmount > 0 && formData.tdsSection) {
      const tdsLedger = accountingEntryService.getLedgers(cityId).find((l) => l.name === "TDS Payable");
      if (tdsLedger) {
        accountingEntryService.createJournal(
          {
            date: formData.date,
            narration: `TDS u/s ${formData.tdsSection} on payment to ${vendor.name} — ₹${formData.tdsAmount.toFixed(2)} deducted`,
            lines: [
              // Dr Vendor Payable (we owe them less — TDS deducted from their payment)
              { accountHead: vendor.id, accountLabel: vendor.name, debit: formData.tdsAmount, credit: 0 },
              // Cr TDS Payable (our liability to deposit with IT dept)
              { accountHead: tdsLedger.id, accountLabel: "TDS Payable", debit: 0, credit: formData.tdsAmount },
            ],
            city,
            cityId,
            createdBy: currentUser.name,
          },
          city
        );
      } else {
        toast.warning("TDS Payable ledger not found — TDS adjustment skipped. Please initialize system ledgers.");
      }
    }

    toast.success(`Expense voucher ${voucherNumber} posted successfully!`);

    // Reset
    setFormData({
      date: new Date().toISOString().split("T")[0],
      vendorId: "",
      itemId: "",
      hsnCode: "",
      expenseLedgerId: "",
      quantity: 1,
      unitPrice: 0,
      totalAmount: 0,
      gstRate: 18,
      supplyType: "",
      cgst: 0,
      sgst: 0,
      igst: 0,
      grandTotal: 0,
      tdsSection: "",
      tdsAmount: 0,
      paymentMode: "Cash",
      amountPaidNow: 0,
      creditorLedgerId: "",
      dueDate: "",
      narration: "",
    });
    setSelectedVendor(null);
    setSelectedItem(null);
  };

  // Journal preview for right column
  const getJournalPreview = () => {
    if (!formData.vendorId || !formData.expenseLedgerId) return null;
    const vendor = vendors.find((v) => v.id === formData.vendorId);
    const expenseLedger = expenseLedgers.find((l) => l.id === formData.expenseLedgerId);
    if (!vendor || !expenseLedger) return null;

    const lines: string[] = [];
    lines.push(`[${expenseLedger.name}]  Dr  ₹${formData.totalAmount.toLocaleString()}`);
    if (formData.cgst > 0) lines.push(`Input CGST           Dr  ₹${formData.cgst.toLocaleString()}`);
    if (formData.sgst > 0) lines.push(`Input SGST           Dr  ₹${formData.sgst.toLocaleString()}`);
    if (formData.igst > 0) lines.push(`Input IGST           Dr  ₹${formData.igst.toLocaleString()}`);
    lines.push(`  To [${vendor.name}]  Cr  ₹${formData.grandTotal.toLocaleString()}`);

    if (formData.paymentMode === "Cash" || formData.paymentMode === "Bank") {
      lines.push("── 2nd entry (payment) ──");
      lines.push(`[${vendor.name}]  Dr  ₹${formData.grandTotal.toLocaleString()}`);
      lines.push(`  To Axis Bank  Cr  ₹${formData.grandTotal.toLocaleString()}`);
    } else if (formData.paymentMode === "Credit (Partial)") {
      const bal = formData.grandTotal - formData.amountPaidNow;
      lines.push(`── 2nd entry (part payment ₹${formData.amountPaidNow.toLocaleString()}) ──`);
      lines.push(`[${vendor.name}]  Dr  ₹${formData.amountPaidNow.toLocaleString()}`);
      lines.push(`  To Axis Bank  Cr  ₹${formData.amountPaidNow.toLocaleString()}`);
      lines.push(`  (₹${bal.toLocaleString()} outstanding on vendor ledger)`);
    } else if (formData.paymentMode === "Credit (Full)") {
      lines.push(`  (Full credit — no payment entry yet. Due: ${formData.dueDate || "—"})`);
    }

    if (formData.tdsAmount > 0) {
      lines.push("── TDS entry ──");
      lines.push(`[${vendor.name}]  Dr  ₹${formData.tdsAmount.toLocaleString()}`);
      lines.push(`  To TDS Payable (${formData.tdsSection})  Cr  ₹${formData.tdsAmount.toLocaleString()}`);
    }
    return lines;
  };

  const journalPreview = getJournalPreview();

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between border-b pb-4">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="p-2 bg-orange-100 rounded-lg">
            <Receipt className="w-6 h-6 text-orange-600" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Expense Voucher</h1>
            <p className="text-sm text-gray-600">Record expense with items and GST</p>
          </div>
        </div>
      </div>

      {/* FIX 7: Inline item creation panel */}
      {showCreateItem && (
        <div className="border-2 border-blue-300 rounded-lg p-4 bg-blue-50 space-y-3">
          <h3 className="font-semibold text-blue-800">Create New Item</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Item Name *</label>
              <input
                type="text"
                value={newItemForm.itemName}
                onChange={(e) => setNewItemForm((p) => ({ ...p, itemName: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg text-sm"
                placeholder="e.g. Professional Consulting"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">HSN/SAC Code</label>
              <input
                type="text"
                value={newItemForm.hsnCode}
                onChange={(e) => setNewItemForm((p) => ({ ...p, hsnCode: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg text-sm"
                placeholder="e.g. 9983"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Default GST Rate</label>
              <select
                value={newItemForm.defaultGSTRate}
                onChange={(e) =>
                  setNewItemForm((p) => ({ ...p, defaultGSTRate: Number(e.target.value) as any }))
                }
                className="w-full px-3 py-2 border rounded-lg text-sm"
              >
                {[0, 5, 12, 18, 28].map((r) => (
                  <option key={r} value={r}>{r}%</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCreateItem}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
            >
              Save Item
            </button>
            <button
              type="button"
              onClick={() => setShowCreateItem(false)}
              className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Form */}
        <div className="lg:col-span-2 bg-white border rounded-lg p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>

            {/* FIX 6: Vendor — shows vendor NAME */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Vendor <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={formData.vendorId}
                onChange={(e) => handleVendorChange(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="">Select vendor...</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
              {vendors.length === 0 && (
                <p className="text-xs text-amber-600 mt-1">
                  No vendors found. Add a vendor in Ledger Master (Account Head: Accounts Payable, Type: vendor).
                </p>
              )}
            </div>

            {/* FIX 7: Item — with Create New option */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Item <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                <select
                  required
                  value={formData.itemId}
                  onChange={(e) => handleItemChange(e.target.value)}
                  className="flex-1 px-3 py-2 border rounded-lg"
                >
                  <option value="">Select item...</option>
                  {items
                    .filter((i) => i.status === "Active")
                    .map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.itemName}
                      </option>
                    ))}
                </select>
                <button
                  type="button"
                  onClick={() => setShowCreateItem(true)}
                  className="px-3 py-2 border rounded-lg hover:bg-gray-50 text-gray-600"
                  title="Create new item"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* HSN */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">HSN Code</label>
              <input
                type="text"
                readOnly
                value={formData.hsnCode}
                className="w-full px-3 py-2 border rounded-lg bg-gray-50"
              />
            </div>

            {/* FIX 3 + FIX 5: Expense Ledger — shows account NAME not head code */}
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Expense Ledger (Account Name) <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={formData.expenseLedgerId}
                onChange={(e) => setFormData({ ...formData, expenseLedgerId: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="">Select account...</option>
                {expenseLedgers.map((l) => (
                  // FIX 3: show l.name ("Professional Fees"), not l.accountHead ("indirect_expenses")
                  <option key={l.id} value={l.id}>
                    {l.name}{" "}
                    {l.accountHeadLabel ? `— ${l.accountHeadLabel}` : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Qty / Unit Price */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) })}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Unit Price (₹)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.unitPrice}
                onChange={(e) => setFormData({ ...formData, unitPrice: Number(e.target.value) })}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Total Amount</label>
              <input
                type="text"
                readOnly
                value={`₹${(formData.totalAmount ?? 0).toLocaleString()}`}
                className="w-full px-3 py-2 border rounded-lg bg-gray-50 font-semibold"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">GST Rate</label>
              <select
                value={formData.gstRate}
                onChange={(e) => setFormData({ ...formData, gstRate: Number(e.target.value) as any })}
                className="w-full px-3 py-2 border rounded-lg"
              >
                {[0, 5, 12, 18, 28, 40].map((r) => (
                  <option key={r} value={r}>{r}%</option>
                ))}
              </select>
            </div>

            {formData.supplyType && (
              <div className="sm:col-span-2">
                <div
                  className={`inline-flex items-center px-3 py-2 rounded text-sm font-medium ${
                    formData.supplyType === "INTRA_STATE"
                      ? "bg-green-100 text-green-700"
                      : "bg-blue-100 text-blue-700"
                  }`}
                >
                  {formData.supplyType === "INTRA_STATE"
                    ? "Intra-State — CGST + SGST"
                    : "Inter-State — IGST only"}
                </div>
              </div>
            )}

            <div className="sm:col-span-2 grid grid-cols-4 gap-3 bg-gray-50 p-4 rounded-lg">
              <div>
                <label className="block text-xs text-gray-600 mb-1">CGST</label>
                <p className="font-semibold">₹{(formData.cgst ?? 0).toLocaleString()}</p>
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">SGST</label>
                <p className="font-semibold">₹{(formData.sgst ?? 0).toLocaleString()}</p>
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">IGST</label>
                <p className="font-semibold">₹{(formData.igst ?? 0).toLocaleString()}</p>
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Grand Total</label>
                <p className="font-bold text-lg">₹{(formData.grandTotal ?? 0).toLocaleString()}</p>
              </div>
            </div>

            {/* FIX 1: TDS section shows rate based on entity type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">TDS Section</label>
              <select
                value={formData.tdsSection}
                onChange={(e) => setFormData({ ...formData, tdsSection: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="">None</option>
                {TDS_RATE_CHART.map((t) => {
                  const isIndHUF = ["Individual", "HUF"].includes(
                    (selectedVendor as any)?.legalEntityType || ""
                  );
                  const displayRate = isIndHUF ? t.rateIndividual : t.rateCompany;
                  return (
                    <option key={t.section} value={t.section}>
                      {t.section} — {t.nature} ({displayRate}%)
                    </option>
                  );
                })}
              </select>
              {selectedVendor && (
                <p className="text-xs text-gray-500 mt-1">
                  Entity type:{" "}
                  <span className="font-medium">
                    {(selectedVendor as any).legalEntityType || "Not specified"}
                  </span>
                  {["Individual", "HUF"].includes((selectedVendor as any)?.legalEntityType || "")
                    ? " — using Individual rate"
                    : " — using Company rate"}
                </p>
              )}
            </div>

            {formData.tdsSection && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">TDS Amount</label>
                <input
                  type="text"
                  readOnly
                  value={`₹${(formData.tdsAmount ?? 0).toLocaleString()}`}
                  className="w-full px-3 py-2 border rounded-lg bg-gray-50"
                />
              </div>
            )}

            {/* FIX 4: All four payment modes available */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Payment Mode</label>
              <select
                value={formData.paymentMode}
                onChange={(e) =>
                  setFormData({ ...formData, paymentMode: e.target.value as PaymentMode })
                }
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="Cash">Cash</option>
                <option value="Bank">Bank</option>
                <option value="Credit (Full)">Credit — Full (Accounts Payable)</option>
                <option value="Credit (Partial)">Credit — Partial Payment</option>
              </select>
            </div>

            {(formData.paymentMode === "Cash" ||
              formData.paymentMode === "Bank" ||
              formData.paymentMode === "Credit (Partial)") && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount Paid Now</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.amountPaidNow}
                  onChange={(e) =>
                    setFormData({ ...formData, amountPaidNow: Number(e.target.value) })
                  }
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
            )}

            {/* FIX 4: creditor ledger + due date shown for credit modes */}
            {(formData.paymentMode === "Credit (Full)" ||
              formData.paymentMode === "Credit (Partial)") && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Creditor Ledger <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={formData.creditorLedgerId}
                    onChange={(e) => setFormData({ ...formData, creditorLedgerId: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="">Select creditor...</option>
                    {creditors.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Due Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.dueDate}
                    onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </>
            )}

            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Narration</label>
              <input
                type="text"
                value={formData.narration}
                onChange={(e) => setFormData({ ...formData, narration: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
                placeholder="Optional notes..."
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 border rounded-lg hover:bg-gray-50"
            >
              Reset
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
            >
              <Save className="w-4 h-4" />
              Submit Voucher
            </button>
          </div>
        </div>

        {/* Right: Journal Preview */}
        <div className="bg-white border rounded-lg p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Auto Journal Entry Preview</h3>
          {journalPreview ? (
            <div className="space-y-1 font-mono text-xs">
              {journalPreview.map((line, idx) => (
                <div
                  key={idx}
                  className={
                    line.startsWith("──") ? "text-gray-500 mt-2 mb-1 border-t pt-1" : ""
                  }
                >
                  {line}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">Fill the form to see journal preview</p>
          )}
          {formData.tdsAmount > 0 && (
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800">
              <p className="font-semibold">TDS ({formData.tdsSection}) — 3-entry treatment:</p>
              <p className="mt-1">1. Expense + GST → Vendor Payable (full invoice)</p>
              <p>2. Vendor Payable Dr → Bank Cr (payment net of TDS)</p>
              <p>3. Vendor Payable Dr → TDS Payable Cr (TDS deducted)</p>
            </div>
          )}
        </div>
      </form>
    </div>
  );
}
