/**
 * SupabaseFinanceAdapter
 * Thin adapter layer between app services and Supabase v2 typed tables.
 * Drop-in replacement for localStorage reads/writes in gstComplianceService
 * and accountingEntryService once Supabase is fully wired.
 *
 * Usage:
 *   Import and call instead of DataService.get/insert/update
 *   All methods are async — wrap call sites in useEffect or React Query
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── GST Transactions ─────────────────────────────────────────

export async function getGSTTransactions(cityId: string, month?: number, year?: number) {
  let query = supabase
    .from("gst_transactions_v2")
    .select("*")
    .eq("city_id", cityId)
    .order("invoice_date", { ascending: false });

  if (month) query = query.eq("month", month);
  if (year)  query = query.eq("year",  year);

  const { data, error } = await query;
  if (error) { console.error("[GST] getTransactions failed:", error.message); return []; }
  return data ?? [];
}

export async function upsertGSTTransaction(txn: Record<string, unknown>) {
  const row = {
    id:               txn.id,
    city_id:          txn.cityId ?? "CITY-SURAT",
    invoice_number:   txn.invoiceNumber,
    invoice_date:     txn.invoiceDate,
    month:            txn.month,
    year:             txn.year,
    transaction_type: txn.transactionType,
    sub_type:         txn.subType,
    party_name:       txn.partyName,
    party_gstin:      txn.partyGstin,
    place_of_supply:  txn.placeOfSupply,
    supply_type:      txn.supplyType,
    supply_nature:    txn.supplyNature,
    gst_type:         txn.gstType,
    hsn_sac_code:     txn.hsnSacCode,
    description:      txn.description,
    quantity:         txn.quantity ?? 1,
    taxable_value:    txn.taxableValue ?? 0,
    gst_rate:         txn.gstRate ?? 0,
    cgst:             txn.cgst ?? 0,
    sgst:             txn.sgst ?? 0,
    igst:             txn.igst ?? 0,
    total_tax:        txn.totalTax ?? 0,
    invoice_total:    txn.invoiceTotal ?? 0,
    itc_eligible:     txn.itcEligible ?? false,
    itc_amount:       txn.itcAmount ?? 0,
    reverse_charge:   txn.reverseCharge ?? false,
    risk_score:       txn.riskScore ?? 0,
    risk_level:       txn.riskLevel ?? "Clean",
    status:           txn.status ?? "Draft",
    filed_in_return:  txn.filedInReturn,
    created_by:       txn.createdBy,
  };

  const { error } = await supabase
    .from("gst_transactions_v2")
    .upsert(row, { onConflict: "id" });

  if (error) console.error("[GST] upsertTransaction failed:", error.message);
}

export async function deleteGSTTransaction(id: string) {
  const { error } = await supabase.from("gst_transactions_v2").delete().eq("id", id);
  if (error) console.error("[GST] deleteTransaction failed:", error.message);
}

// ── GST Vendors ──────────────────────────────────────────────

export async function getGSTVendors(cityId: string) {
  const { data, error } = await supabase
    .from("gst_vendors_v2")
    .select("*")
    .eq("city_id", cityId)
    .order("name");
  if (error) { console.error("[GST] getVendors failed:", error.message); return []; }
  return data ?? [];
}

export async function upsertGSTVendor(vendor: Record<string, unknown>) {
  const row = {
    id:                   vendor.id,
    city_id:              vendor.cityId ?? "CITY-SURAT",
    name:                 vendor.name,
    gstin:                vendor.gstin,
    pan:                  vendor.pan,
    state:                vendor.state,
    state_code:           vendor.stateCode,
    address:              vendor.address,
    contact_person:       vendor.contactPerson,
    contact_phone:        vendor.contactPhone,
    contact_email:        vendor.contactEmail,
    vendor_type:          vendor.vendorType,
    supply_type:          vendor.supplyType,
    registration_type:    vendor.registrationType,
    payment_terms:        vendor.paymentTerms,
    bank_account_number:  vendor.bankAccountNumber,
    ifsc_code:            vendor.ifscCode,
    gstin_validated:      vendor.gstinValidated ?? false,
    risk_score:           vendor.riskScore ?? 0,
    risk_level:           vendor.riskLevel ?? "Clean",
    filing_status:        vendor.filingStatus ?? "Unknown",
    legal_entity_type:    vendor.legalEntityType,
    tds_applicable:       vendor.tdsApplicable ?? false,
    tds_default_section:  vendor.tdsDefaultSection,
    tds_default_rate:     vendor.tdsDefaultRate,
    approval_status:      vendor.approvalStatus ?? "Pending",
    status:               vendor.status ?? "Active",
    notes:                vendor.notes,
    created_by:           vendor.createdBy,
  };

  const { error } = await supabase
    .from("gst_vendors_v2")
    .upsert(row, { onConflict: "id" });

  if (error) console.error("[GST] upsertVendor failed:", error.message);
}

// ── Finance Ledger Entries ───────────────────────────────────

export async function getFinanceLedgerEntries(cityId: string, fromDate?: string, toDate?: string) {
  let query = supabase
    .from("finance_ledger_v2")
    .select("*")
    .eq("city_id", cityId)
    .order("entry_date", { ascending: false });

  if (fromDate) query = query.gte("entry_date", fromDate);
  if (toDate)   query = query.lte("entry_date", toDate);

  const { data, error } = await query;
  if (error) { console.error("[Finance] getLedgerEntries failed:", error.message); return []; }
  return data ?? [];
}

export async function upsertFinanceLedgerEntry(entry: Record<string, unknown>) {
  const row = {
    id:                     entry.id,
    city_id:                entry.cityId ?? "CITY-SURAT",
    voucher_number:         entry.voucherNumber,
    entry_type:             entry.entryType,
    entry_date:             entry.date,
    vendor_id:              entry.vendorId,
    vendor_name:            entry.vendorName,
    vendor_gstin:           entry.vendorGstin,
    vendor_state_code:      entry.vendorStateCode,
    invoice_number:         entry.invoiceNumber,
    hsn_sac_code:           entry.hsnSacCode,
    expense_account:        entry.expenseAccount,
    expense_account_label:  entry.expenseAccountLabel,
    taxable_value:          entry.taxableValue ?? 0,
    gst_rate:               entry.gstRate ?? 0,
    gst_entry_type:         entry.gstEntryType,
    cgst:                   entry.cgst ?? 0,
    sgst:                   entry.sgst ?? 0,
    igst:                   entry.igst ?? 0,
    total_bill_value:       entry.totalBillValue ?? 0,
    payment_mode:           entry.paymentMode,
    petty_cash_branch:      entry.pettyCashBranch,
    is_rcm:                 entry.isRCM ?? false,
    rcm_cgst:               entry.rcmCgst ?? 0,
    rcm_sgst:               entry.rcmSgst ?? 0,
    rcm_igst:               entry.rcmIgst ?? 0,
    debit_account:          entry.debitAccount,
    credit_account:         entry.creditAccount,
    narration:              entry.narration,
    financial_year:         entry.financialYear,
    created_by:             entry.createdBy,
    status:                 entry.status ?? "Draft",
  };

  const { error } = await supabase
    .from("finance_ledger_v2")
    .upsert(row, { onConflict: "id" });

  if (error) console.error("[Finance] upsertLedgerEntry failed:", error.message);
}

// ── Finance Revenues ─────────────────────────────────────────

export async function getFinanceRevenues(cityId: string) {
  const { data, error } = await supabase
    .from("finance_revenues_v2")
    .select("*")
    .eq("city_id", cityId)
    .order("received_date", { ascending: false });
  if (error) { console.error("[Finance] getRevenues failed:", error.message); return []; }
  return data ?? [];
}

export async function upsertFinanceRevenue(revenue: Record<string, unknown>) {
  const row = {
    id:               revenue.revenueId ?? revenue.id,
    city_id:          revenue.cityId ?? "CITY-SURAT",
    customer_id:      revenue.customerId,
    subscription_id:  revenue.subscriptionId,
    job_id:           revenue.jobId,
    revenue_type:     revenue.type,
    amount:           revenue.amount ?? 0,
    received_date:    revenue.receivedDate,
    payment_method:   revenue.paymentMethod,
    invoice_number:   revenue.invoiceNumber,
    status:           revenue.status ?? "Received",
    customer_name:    revenue.customerName,
    package_name:     revenue.packageName,
    source:           revenue.source,
  };

  const { error } = await supabase
    .from("finance_revenues_v2")
    .upsert(row, { onConflict: "id" });

  if (error) console.error("[Finance] upsertRevenue failed:", error.message);
}

// ── Finance Payables ─────────────────────────────────────────

export async function getFinancePayables(cityId: string) {
  const { data, error } = await supabase
    .from("finance_payables_v2")
    .select("*")
    .eq("city_id", cityId)
    .order("due_date", { ascending: true });
  if (error) { console.error("[Finance] getPayables failed:", error.message); return []; }
  return data ?? [];
}

export async function upsertFinancePayable(payable: Record<string, unknown>) {
  const row = {
    id:                payable.payableId ?? payable.id,
    city_id:           payable.cityId ?? "CITY-SURAT",
    payable_type:      payable.type,
    employee_id:       payable.employeeId,
    payroll_id:        payable.payrollId,
    vendor_id:         payable.vendorId,
    vendor_name:       payable.vendorName,
    invoice_number:    payable.invoiceNumber,
    statutory_type:    payable.statutoryType,
    amount:            payable.amount ?? 0,
    due_date:          payable.dueDate,
    status:            payable.status ?? "Pending",
    description:       payable.description,
    paid_at:           payable.paidAt,
    payment_reference: payable.paymentReference,
    payment_method:    payable.paymentMethod,
    approved_by:       payable.approvedBy,
    approved_at:       payable.approvedAt,
  };

  const { error } = await supabase
    .from("finance_payables_v2")
    .upsert(row, { onConflict: "id" });

  if (error) console.error("[Finance] upsertPayable failed:", error.message);
}