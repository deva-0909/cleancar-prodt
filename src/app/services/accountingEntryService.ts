import { DataService } from "./DataService";
// ─── Constants ────────────────────────────────────────────────────────────────

export const GST_STATES: Record<string, string> = {
  "01": "Jammu & Kashmir", "02": "Himachal Pradesh", "03": "Punjab",
  "04": "Chandigarh", "05": "Uttarakhand", "06": "Haryana",
  "07": "Delhi", "08": "Rajasthan", "09": "Uttar Pradesh",
  "10": "Bihar", "11": "Sikkim", "12": "Arunachal Pradesh",
  "13": "Nagaland", "14": "Manipur", "15": "Mizoram",
  "16": "Tripura", "17": "Meghalaya", "18": "Assam",
  "19": "West Bengal", "20": "Jharkhand", "21": "Odisha",
  "22": "Chhattisgarh", "23": "Madhya Pradesh", "24": "Gujarat",
  "25": "Daman & Diu", "26": "Dadra & Nagar Haveli", "27": "Maharashtra",
  "28": "Andhra Pradesh", "29": "Karnataka", "30": "Goa",
  "31": "Lakshadweep", "32": "Kerala", "33": "Tamil Nadu",
  "34": "Puducherry", "35": "Andaman & Nicobar Islands", "36": "Telangana",
  "37": "Andhra Pradesh (New)", "38": "Ladakh",
};

export const GST_STATE_OPTIONS = Object.entries(GST_STATES).map(([code, name]) => ({
  value: code,
  label: `${code} - ${name}`,
  code,
  name,
}));

export const CHART_OF_ACCOUNTS_HEADS = [
  // ASSETS
  { value: "fixed_assets",        label: "Fixed Assets",             nature: "asset" },
  { value: "cash_bank",           label: "Cash & Bank",              nature: "asset" },
  { value: "current_assets",      label: "Current Assets",           nature: "asset" },
  { value: "accounts_receivable", label: "Accounts Receivable",      nature: "asset" },
  { value: "gst_input",           label: "GST Input (ITC)",          nature: "asset" },
  // LIABILITIES
  { value: "equity",              label: "Capital & Equity",         nature: "liability" },
  { value: "duties_taxes",        label: "Duties & Taxes",           nature: "liability" },
  { value: "credit_cards",        label: "Credit Cards",             nature: "liability" },
  { value: "non_current_liab",    label: "Non-Current Liabilities",  nature: "liability" },
  { value: "other_liabilities",   label: "Other Liabilities",        nature: "liability" },
  { value: "accounts_payable",    label: "Accounts Payable",         nature: "liability" },
  // INCOME
  { value: "sales_subscription",  label: "Sales — Subscription",     nature: "income" },
  { value: "sales_service",       label: "Sales — Service",          nature: "income" },
  { value: "sales_renewal",       label: "Sales — Renewal",          nature: "income" },
  { value: "other_income",        label: "Other Income",             nature: "income" },
  // EXPENSES
  { value: "cogs",                label: "Cost of Goods Sold",       nature: "expense" },
  // FIX 8: "purchase" head maps to COGS so purchases appear in P&L
  { value: "purchase",            label: "Purchases",                nature: "expense" },
  { value: "direct_expenses",     label: "Direct Expenses",          nature: "expense" },
  { value: "indirect_expenses",   label: "Indirect Expenses",        nature: "expense" },
  { value: "depreciation",        label: "Depreciation",             nature: "expense" },
  { value: "tds_payable",         label: "TDS Payable",              nature: "liability" },
] as const;

export type EntryType =
  | "Expense" | "Purchase" | "PurchaseReturn"
  | "Sales" | "SalesReturn" | "AssetPurchase";

export type GSTEntryType = "B2B" | "Unregistered" | "RCM" | "NonGST";

export type PaymentMode = "Bank" | "Cash" | "PettyCash";

export type VendorType = "GSTRegistered" | "NonRegistered" | "SEZ" | "Import";

export interface AccountingEntry {
  id: string;
  voucherNumber: string;          // Auto-generated e.g. EXP/SURAT/25-26/0001
  entryType: EntryType;
  date: string;
  vendorId?: string;
  vendorName?: string;
  vendorGstin?: string;
  vendorStateCode?: string;
  invoiceNumber: string;
  hsnSacCode?: string;
  expenseAccount?: string;        // Chart of accounts head
  expenseAccountLabel?: string;
  taxableValue: number;
  gstRate: number;                // 0, 5, 12, 18, 28
  gstEntryType: GSTEntryType;
  cgst: number;
  sgst: number;
  igst: number;
  totalBillValue: number;
  paymentMode: PaymentMode;
  pettyCashBranch?: string;       // Only if paymentMode = PettyCash
  isRCM: boolean;
  rcmCgst?: number;
  rcmSgst?: number;
  rcmIgst?: number;
  debitAccount: string;
  creditAccount: string;
  narration?: string;
  city: string;
  cityId: string;
  financialYear: string;          // "25-26"
  createdBy: string;
  createdAt: string;
  updatedBy?: string;
  updatedAt?: string;
  changeHistory: ChangeLog[];
  status: "Draft" | "Posted" | "Cancelled";
}

export interface ChangeLog {
  timestamp: string;
  changedBy: string;
  field: string;
  previousValue: string;
  newValue: string;
}

export interface JournalEntry {
  id: string;
  voucherNumber: string;          // JV/CITY/FY/NNNN
  date: string;
  narration: string;
  lines: JournalLine[];
  city: string;
  cityId: string;
  financialYear: string;
  createdBy: string;
  createdAt: string;
  status: "Draft" | "Posted";
  changeHistory: ChangeLog[];
}

export interface JournalLine {
  accountHead: string;
  accountLabel: string;
  debit: number;
  credit: number;
  invoiceReference?: string;      // For adjustment against open invoice
}

export interface LedgerMaster {
  id: string;
  name: string;                        // "Axis Bank", "Razorpay", "Customer A1"
  accountHead: string;                 // value from CHART_OF_ACCOUNTS_HEADS
  accountHeadLabel: string;
  nature: "asset" | "liability" | "income" | "expense";
  type: "bank" | "customer" | "vendor" | "payment_gateway" | "sales" | "expense" | "other";
  openingBalance: number;
  openingBalanceType: "Dr" | "Cr";
  gstin?: string;                      // For vendor/customer ledgers
  mobile?: string;
  email?: string;
  city: string;
  cityId: string;
  isSystem: boolean;                   // System ledgers cannot be deleted
  createdAt: string;
  status: "Active" | "Inactive";

  // Subscription-package ledgers only
  packageCode?: string;               // "2W" | "4W" | "2W_WASH_SANITIZE" etc.

  // Customer-debtor ledgers only
  customerId?: string;
  customerName?: string;
  subscriptionPlan?: string;
}

export interface LedgerBalance {
  ledgerId: string;
  ledgerName: string;
  accountHead: string;
  totalDebit: number;
  totalCredit: number;
  balance: number;
  balanceType: "Dr" | "Cr";
}

export interface ItemMaster {
  id: string;
  itemName: string;
  hsnCode: string;
  defaultExpenseLedgerId: string;
  defaultExpenseLedgerName: string;
  defaultGSTRate: 0 | 5 | 12 | 18 | 28 | 40;
  unitOfMeasure?: string;
  description?: string;
  status: "Active" | "Inactive";
  createdAt: string;
}

export interface TDSConfig {
  section: string;       // "194J", "194C", etc.
  nature: string;        // "Professional Fees", "Contractor"
  rateIndividual: number;
  rateCompany: number;
  thresholdSingle?: number;
  thresholdAnnual?: number;
}

export const TDS_RATE_CHART: TDSConfig[] = [
  { section: "192",  nature: "Salary",                   rateIndividual: 0,   rateCompany: 0,   thresholdAnnual: 250000 },
  { section: "194A", nature: "Interest Payment",         rateIndividual: 10,  rateCompany: 10,  thresholdAnnual: 10000 },
  { section: "194C", nature: "Contractor",               rateIndividual: 1,   rateCompany: 2,   thresholdSingle: 30000, thresholdAnnual: 100000 },
  { section: "194I", nature: "Rent (Land/Building)",     rateIndividual: 10,  rateCompany: 10,  thresholdSingle: 50000, thresholdAnnual: 600000 },
  { section: "194I(a)", nature: "Rent (Plant/Machinery)",rateIndividual: 2,   rateCompany: 2,   thresholdSingle: 50000, thresholdAnnual: 600000 },
  { section: "194J", nature: "Professional Fees",        rateIndividual: 10,  rateCompany: 10,  thresholdSingle: 50000 },
  { section: "194J(b)", nature: "Technical Fees",        rateIndividual: 2,   rateCompany: 2,   thresholdSingle: 50000 },
  { section: "194H", nature: "Commission/Brokerage",     rateIndividual: 2,   rateCompany: 2,   thresholdAnnual: 20000 },
  { section: "194Q", nature: "Purchase of Goods",        rateIndividual: 0.1, rateCompany: 0.1, thresholdAnnual: 5000000 },
  { section: "194B", nature: "Lottery/Gambling",         rateIndividual: 30,  rateCompany: 30,  thresholdSingle: 10000 },
];

// ─── Voucher Number Generator ────────────────────────────────────────────────

const ENTRY_TYPE_CODES: Record<EntryType, string> = {
  Expense: "EXP", Purchase: "PUR", PurchaseReturn: "PRN",
  Sales: "SAL", SalesReturn: "SRN", AssetPurchase: "AST",
};

function getFinancialYear(): string {
  const now = new Date();
  const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return `${String(year).slice(-2)}-${String(year + 1).slice(-2)}`;
}

function generateVoucherNumber(
  entryType: EntryType, cityName: string, existingEntries: AccountingEntry[]
): string {
  const fy = getFinancialYear();
  const prefix = `${ENTRY_TYPE_CODES[entryType]}/${cityName.toUpperCase()}/${fy}`;
  // Use max existing sequence number + 1, not count (safe against deletions and concurrent writes)
  const maxSeq = existingEntries
    .filter(e => e.voucherNumber.startsWith(prefix))
    .map(e => parseInt(e.voucherNumber.split("/").pop() || "0", 10))
    .reduce((max, n) => Math.max(max, n), 0);
  return `${prefix}/${String(maxSeq + 1).padStart(4, "0")}`;
}

function generateJournalVoucherNumber(cityName: string, existing: JournalEntry[]): string {
  const fy = getFinancialYear();
  const prefix = `JV/${cityName.toUpperCase()}/${fy}`;
  const maxSeq = existing
    .filter(e => e.voucherNumber.startsWith(prefix))
    .map(e => parseInt(e.voucherNumber.split("/").pop() || "0", 10))
    .reduce((max, n) => Math.max(max, n), 0);
  return `${prefix}/${String(maxSeq + 1).padStart(4, "0")}`;
}

// ─── GST Calculation Engine ──────────────────────────────────────────────────

const CITY_STATE_CODES: Record<string, string> = {
  "CITY-SURAT":     "24", // Gujarat
  "CITY-MUMBAI":    "27", // Maharashtra
  "CITY-AHMEDABAD": "24", // Gujarat
};
const DEFAULT_STATE_CODE = "24";

export function calculateGST(
  taxableValue: number,
  gstRate: number,
  vendorStateCode: string,
  gstEntryType: GSTEntryType,
  companyCityId?: string
): { cgst: number; sgst: number; igst: number; totalBillValue: number } {
  if (gstEntryType === "NonGST" || gstRate === 0) {
    return { cgst: 0, sgst: 0, igst: 0, totalBillValue: taxableValue };
  }
  const companyStateCode = companyCityId
    ? (CITY_STATE_CODES[companyCityId] || DEFAULT_STATE_CODE)
    : DEFAULT_STATE_CODE;
  const totalTax = Math.round(taxableValue * gstRate) / 100;
  const isSameState = vendorStateCode === companyStateCode;
  if (isSameState) {
    const half = Math.round(totalTax * 50) / 100;
    return { cgst: half, sgst: half, igst: 0, totalBillValue: taxableValue + totalTax };
  }
  return { cgst: 0, sgst: 0, igst: totalTax, totalBillValue: taxableValue + totalTax };
}

export function validateGSTIN(gstin: string): { valid: boolean; stateCode: string; error?: string } {
  const pattern = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  if (!pattern.test(gstin.trim().toUpperCase()))
    return { valid: false, stateCode: "", error: "Invalid GSTIN format" };
  const stateCode = gstin.substring(0, 2);
  return { valid: true, stateCode };
}

export function autoPostLedger(entry: AccountingEntry): JournalLine[] {
  // FIX 9: AssetPurchase — split base value to fixed_assets, GST to gst_input
  // Credit Accounts Payable (not Bank) when paymentMode is Credit
  if (entry.entryType === "AssetPurchase") {
    const lines: JournalLine[] = [
      // Dr Fixed Asset — base taxable value only (NOT grandTotal)
      { accountHead: entry.debitAccount, accountLabel: "Fixed Asset", debit: entry.taxableValue, credit: 0 },
    ];
    // Dr Input GST ledgers separately (asset, not expense)
    if ((entry.cgst ?? 0) > 0) {
      lines.push({ accountHead: "gst_input", accountLabel: "Input CGST", debit: entry.cgst ?? 0, credit: 0 });
    }
    if ((entry.sgst ?? 0) > 0) {
      lines.push({ accountHead: "gst_input", accountLabel: "Input SGST", debit: entry.sgst ?? 0, credit: 0 });
    }
    if ((entry.igst ?? 0) > 0) {
      lines.push({ accountHead: "gst_input", accountLabel: "Input IGST", debit: entry.igst ?? 0, credit: 0 });
    }
    // FIX 9: Cr Accounts Payable (not Bank) when payment mode is credit
    const isCreditPayment = entry.paymentMode !== "Bank" && entry.paymentMode !== "Cash" && entry.paymentMode !== "PettyCash";
    const creditHead = isCreditPayment ? "accounts_payable" : entry.creditAccount;
    const creditLabel = isCreditPayment ? "Accounts Payable" : entry.creditAccount;
    lines.push({ accountHead: creditHead, accountLabel: creditLabel, debit: 0, credit: entry.totalBillValue });
    return lines;
  }

  // FIX 8: Expense/Purchase — split GST to gst_input (asset), not to expense ledger
  if (entry.entryType === "Expense" || entry.entryType === "Purchase") {
    const lines: JournalLine[] = [
      // Dr Expense — taxable value only
      { accountHead: entry.debitAccount, accountLabel: entry.debitAccount, debit: entry.taxableValue, credit: 0 },
    ];
    if ((entry.cgst ?? 0) > 0) {
      lines.push({ accountHead: "gst_input", accountLabel: "Input CGST", debit: entry.cgst ?? 0, credit: 0 });
    }
    if ((entry.sgst ?? 0) > 0) {
      lines.push({ accountHead: "gst_input", accountLabel: "Input SGST", debit: entry.sgst ?? 0, credit: 0 });
    }
    if ((entry.igst ?? 0) > 0) {
      lines.push({ accountHead: "gst_input", accountLabel: "Input IGST", debit: entry.igst ?? 0, credit: 0 });
    }
    // Cr vendor/bank for full invoice value
    lines.push({ accountHead: entry.creditAccount, accountLabel: entry.creditAccount, debit: 0, credit: entry.totalBillValue });
    return lines;
  }

  // Default: simple two-line entry for Sales, PurchaseReturn, SalesReturn
  return [
    { accountHead: entry.debitAccount,  accountLabel: entry.debitAccount,  debit: entry.totalBillValue, credit: 0 },
    { accountHead: entry.creditAccount, accountLabel: entry.creditAccount, debit: 0, credit: entry.totalBillValue },
  ];
}

// ─── Service Class ────────────────────────────────────────────────────────────

class AccountingEntryService {
  private readonly ENTRIES_KEY = "cleancar_accounting_entries";
  private readonly JOURNAL_KEY = "cleancar_journal_entries";
  private readonly LEDGER_KEY = "cleancar_ledger_masters";
  // ITEM_MASTER now uses DataService (was bare localStorage key - fixed)
  getItems(): ItemMaster[] {
    return DataService.get<ItemMaster>("INVENTORY_ITEMS");
  }

  saveItem(item: ItemMaster): void {
    const all = this.getItems().filter(i => i.id !== item.id);
    DataService.setAll("INVENTORY_ITEMS", [...all, item]);
  }

  deleteItem(id: string): void {
    DataService.setAll("INVENTORY_ITEMS", this.getItems().filter(i => i.id !== id));
  }

  private getEntries(): AccountingEntry[] {
    try { return JSON.parse(localStorage.getItem(this.ENTRIES_KEY) || "[]"); }
    catch { return []; }
  }
  private saveEntries(entries: AccountingEntry[]): void {
    localStorage.setItem(this.ENTRIES_KEY, JSON.stringify(entries));
  }
  private getJournals(): JournalEntry[] {
    try { return JSON.parse(localStorage.getItem(this.JOURNAL_KEY) || "[]"); }
    catch { return []; }
  }
  private saveJournals(journals: JournalEntry[]): void {
    localStorage.setItem(this.JOURNAL_KEY, JSON.stringify(journals));
  }

  createEntry(
    data: Omit<AccountingEntry, "id"|"voucherNumber"|"createdAt"|"status"|"changeHistory"|"financialYear">,
    cityName: string
  ): AccountingEntry {
    const all = this.getEntries();
    const entry: AccountingEntry = {
      ...data,
      id: `ACC-${Date.now()}`,
      voucherNumber: generateVoucherNumber(data.entryType, cityName, all),
      financialYear: getFinancialYear(),
      createdAt: new Date().toISOString(),
      status: "Posted",
      changeHistory: [],
    };
    this.saveEntries([...all, entry]);
    // Notify FinanceContext so expense entries reflect in analytics
    // Only for expense/purchase types that create payables
    if (["Expense", "Purchase", "AssetPurchase"].includes(entry.entryType) && entry.totalBillValue > 0) {
      try {
        window.dispatchEvent(new CustomEvent("cc360_accounting_entry_created", {
          detail: {
            entryType: entry.entryType,
            amount: entry.totalBillValue,
            taxableValue: entry.taxableValue,
            description: entry.narration || `${entry.entryType} — ${entry.vendorName || "Vendor"}`,
            vendorId: entry.vendorId,
            cityId: entry.cityId,
            date: entry.date,
          }
        }));
      } catch (_e) { /* non-critical — analytics will update on next load */ }
    }
    return entry;
  }

  updateEntry(id: string, changes: Partial<AccountingEntry>, changedBy: string): AccountingEntry | null {
    const all = this.getEntries();
    const idx = all.findIndex(e => e.id === id);
    if (idx < 0) return null;
    const old = all[idx];
    const log: ChangeLog[] = Object.keys(changes)
      .filter(k => (old as any)[k] !== (changes as any)[k])
      .map(field => ({
        timestamp: new Date().toISOString(), changedBy, field,
        previousValue: String((old as any)[field] ?? ""),
        newValue: String((changes as any)[field] ?? ""),
      }));
    const updated = { ...old, ...changes, updatedBy: changedBy, updatedAt: new Date().toISOString(), changeHistory: [...old.changeHistory, ...log] };
    all.splice(idx, 1, updated);
    this.saveEntries(all);
    return updated;
  }

  getAllEntries(cityId?: string): AccountingEntry[] {
    const all = this.getEntries();
    return cityId ? all.filter(e => e.cityId === cityId) : all;
  }
  getByType(type: EntryType, cityId?: string): AccountingEntry[] {
    return this.getAllEntries(cityId).filter(e => e.entryType === type);
  }
  getByDateRange(from: string, to: string, cityId?: string): AccountingEntry[] {
    return this.getAllEntries(cityId).filter(e => e.date >= from && e.date <= to);
  }
  // Get entries where a specific LEDGER ID appears as debit or credit.
  // Also resolves by name cross-reference so system ledger IDs (SYS-...) can
  // match entries that reference seeded ledger IDs (LM-...) for the same account.
  getLedgerEntries(ledgerId: string, cityId?: string): AccountingEntry[] {
    // Build a set of all IDs that refer to the same account name
    const ledger = this.getLedgers(cityId).find(l => l.id === ledgerId);
    const relatedIds = new Set<string>([ledgerId]);
    if (ledger) {
      // Find any other ledgers with the same name and city (e.g. seed ID + system ID)
      this.getLedgers(cityId)
        .filter(l => l.name.trim().toLowerCase() === ledger.name.trim().toLowerCase()
                  && l.cityId === ledger.cityId)
        .forEach(l => relatedIds.add(l.id));
    }
    return this.getAllEntries(cityId).filter(
      e => relatedIds.has(e.debitAccount) || relatedIds.has(e.creditAccount)
    );
  }

  // Get entries by account HEAD (for grouping/reporting)
  getLedgerEntriesByHead(accountHead: string, cityId?: string): AccountingEntry[] {
    const ledgers = this.getLedgers(cityId).filter(l => l.accountHead === accountHead);
    const ledgerIds = new Set(ledgers.map(l => l.id));
    return this.getAllEntries(cityId).filter(
      e => ledgerIds.has(e.debitAccount) || ledgerIds.has(e.creditAccount)
    );
  }
  createJournal(data: Omit<JournalEntry,"id"|"voucherNumber"|"createdAt"|"status"|"changeHistory"|"financialYear">, cityName: string): JournalEntry {
    const all = this.getJournals();
    const entry: JournalEntry = {
      ...data, id: `JV-${Date.now()}`,
      voucherNumber: generateJournalVoucherNumber(cityName, all),
      financialYear: getFinancialYear(),
      createdAt: new Date().toISOString(),
      status: "Posted",
      changeHistory: [],
    };
    this.saveJournals([...all, entry]);
    return entry;
  }
  getAllJournals(cityId?: string): JournalEntry[] {
    const all = this.getJournals();
    return cityId ? all.filter(j => j.cityId === cityId) : all;
  }

  // Returns ALL debit/credit movements: both AccountingEntry and JournalEntry lines
  getAllMovements(from: string, to: string, cityId?: string): Array<{
    date: string;
    debitLedgerId: string;   creditLedgerId: string;
    debitLedgerName: string; creditLedgerName: string;
    amount: number; voucherNumber: string; description: string;
  }> {
    // Build id→name + accountHead→name lookup once
    const allLedgers = this.getLedgers(cityId);
    const byId   = new Map(allLedgers.map(l => [l.id,          l.name]));
    const byHead = new Map(allLedgers.map(l => [l.accountHead, l.name]));
    const resolveName = (id: string): string =>
      byId.get(id) || byHead.get(id) || id;

    const accEntries = this.getByDateRange(from, to, cityId).map(e => ({
      date: e.date,
      debitLedgerId:    e.debitAccount,
      creditLedgerId:   e.creditAccount,
      debitLedgerName:  resolveName(e.debitAccount),
      creditLedgerName: resolveName(e.creditAccount),
      amount: e.totalBillValue,
      voucherNumber: e.voucherNumber,
      description: e.narration || e.invoiceNumber || "",
    }));

    const jvEntries = this.getAllJournals(cityId)
      .filter(j => j.date >= from && j.date <= to && j.status === "Posted")
      .flatMap(j =>
        j.lines.map(line => ({
          date: j.date,
          debitLedgerId:    line.debit  > 0 ? line.accountHead : "",
          creditLedgerId:   line.credit > 0 ? line.accountHead : "",
          debitLedgerName:  line.debit  > 0 ? (byId.get(line.accountHead) || byHead.get(line.accountHead) || line.accountLabel || line.accountHead) : "",
          creditLedgerName: line.credit > 0 ? (byId.get(line.accountHead) || byHead.get(line.accountHead) || line.accountLabel || line.accountHead) : "",
          amount: Math.max(line.debit, line.credit),
          voucherNumber: j.voucherNumber,
          description: j.narration,
        }))
      );

    return [...accEntries, ...jvEntries];
  }

  getLedgers(cityId?: string): LedgerMaster[] {
    const all: LedgerMaster[] = JSON.parse(localStorage.getItem(this.LEDGER_KEY) || "[]");
    // Ensure system ledgers always exist for the requested city
    const effectiveCityId = cityId || "CITY-SURAT";
    const withSystem = this.ensureSystemLedgers(all, effectiveCityId);
    // FIX: filter system ledgers by city too — prevents Mumbai ledgers bleeding into Surat view
    return cityId
      ? withSystem.filter(l => l.cityId === cityId)
      : withSystem;
  }

  private ensureSystemLedgers(existing: LedgerMaster[], cityId: string): LedgerMaster[] {
    const cityDisplayName = cityId === "CITY-MUMBAI" ? "Mumbai"
      : cityId === "CITY-AHMEDABAD" ? "Ahmedabad"
      : "Surat"; // default
    const systemLedgers: Omit<LedgerMaster, "id">[] = [
      // ASSETS - Cash & Bank
      { name: "Cash in Hand", accountHead: "cash_bank", accountHeadLabel: "Cash & Bank", nature: "asset", type: "other", openingBalance: 0, openingBalanceType: "Dr", city: cityDisplayName, cityId, isSystem: true, status: "Active", createdAt: "2026-01-01T00:00:00.000Z" },
      { name: "Petty Cash", accountHead: "cash_bank", accountHeadLabel: "Cash & Bank", nature: "asset", type: "other", openingBalance: 0, openingBalanceType: "Dr", city: cityDisplayName, cityId, isSystem: true, status: "Active", createdAt: "2026-01-01T00:00:00.000Z" },
      { name: "Undeposited Funds", accountHead: "cash_bank", accountHeadLabel: "Cash & Bank", nature: "asset", type: "other", openingBalance: 0, openingBalanceType: "Dr", city: cityDisplayName, cityId, isSystem: true, status: "Active", createdAt: "2026-01-01T00:00:00.000Z" },
      { name: "Axis Bank", accountHead: "cash_bank", accountHeadLabel: "Cash & Bank", nature: "asset", type: "bank", openingBalance: 0, openingBalanceType: "Dr", city: cityDisplayName, cityId, isSystem: true, status: "Active", createdAt: "2026-01-01T00:00:00.000Z" },
      { name: "HDFC - 906", accountHead: "cash_bank", accountHeadLabel: "Cash & Bank", nature: "asset", type: "bank", openingBalance: 0, openingBalanceType: "Dr", city: cityDisplayName, cityId, isSystem: true, status: "Active", createdAt: "2026-01-01T00:00:00.000Z" },

      // ASSETS - Current Assets
      { name: "Prepaid Expenses", accountHead: "current_assets", accountHeadLabel: "Current Assets", nature: "asset", type: "other", openingBalance: 0, openingBalanceType: "Dr", city: cityDisplayName, cityId, isSystem: true, status: "Active", createdAt: "2026-01-01T00:00:00.000Z" },
      { name: "TDS Receivable", accountHead: "current_assets", accountHeadLabel: "Current Assets", nature: "asset", type: "other", openingBalance: 0, openingBalanceType: "Dr", city: cityDisplayName, cityId, isSystem: true, status: "Active", createdAt: "2026-01-01T00:00:00.000Z" },
      { name: "Employee Advance", accountHead: "current_assets", accountHeadLabel: "Current Assets", nature: "asset", type: "other", openingBalance: 0, openingBalanceType: "Dr", city: cityDisplayName, cityId, isSystem: true, status: "Active", createdAt: "2026-01-01T00:00:00.000Z" },
      { name: "Advance Tax", accountHead: "current_assets", accountHeadLabel: "Current Assets", nature: "asset", type: "other", openingBalance: 0, openingBalanceType: "Dr", city: cityDisplayName, cityId, isSystem: true, status: "Active", createdAt: "2026-01-01T00:00:00.000Z" },
      // Alias kept for backward compatibility with any journal entries already posted
      { name: "Advance Tax Paid", accountHead: "current_assets", accountHeadLabel: "Current Assets", nature: "asset", type: "other", openingBalance: 0, openingBalanceType: "Dr", city: cityDisplayName, cityId, isSystem: true, status: "Active", createdAt: "2026-01-01T00:00:00.000Z" },

      // ASSETS - Accounts Receivable
      { name: "Accounts Receivable", accountHead: "accounts_receivable", accountHeadLabel: "Accounts Receivable", nature: "asset", type: "customer", openingBalance: 0, openingBalanceType: "Dr", city: cityDisplayName, cityId, isSystem: true, status: "Active", createdAt: "2026-01-01T00:00:00.000Z" },

      // ASSETS - Fixed Assets
      { name: "Furniture and Equipment", accountHead: "fixed_assets", accountHeadLabel: "Fixed Assets", nature: "asset", type: "other", openingBalance: 0, openingBalanceType: "Dr", city: cityDisplayName, cityId, isSystem: true, status: "Active", createdAt: "2026-01-01T00:00:00.000Z" },
      { name: "WFH Table", accountHead: "fixed_assets", accountHeadLabel: "Fixed Assets", nature: "asset", type: "other", openingBalance: 0, openingBalanceType: "Dr", city: cityDisplayName, cityId, isSystem: true, status: "Active", createdAt: "2026-01-01T00:00:00.000Z" },

      // ASSETS - GST Input (ITC)
      { name: "Input Tax Credits", accountHead: "gst_input", accountHeadLabel: "GST Input (ITC)", nature: "asset", type: "other", openingBalance: 0, openingBalanceType: "Dr", city: cityDisplayName, cityId, isSystem: true, status: "Active", createdAt: "2026-01-01T00:00:00.000Z" },
      { name: "Input IGST", accountHead: "gst_input", accountHeadLabel: "GST Input (ITC)", nature: "asset", type: "other", openingBalance: 0, openingBalanceType: "Dr", city: cityDisplayName, cityId, isSystem: true, status: "Active", createdAt: "2026-01-01T00:00:00.000Z" },
      { name: "Input CGST", accountHead: "gst_input", accountHeadLabel: "GST Input (ITC)", nature: "asset", type: "other", openingBalance: 0, openingBalanceType: "Dr", city: cityDisplayName, cityId, isSystem: true, status: "Active", createdAt: "2026-01-01T00:00:00.000Z" },
      { name: "Input SGST", accountHead: "gst_input", accountHeadLabel: "GST Input (ITC)", nature: "asset", type: "other", openingBalance: 0, openingBalanceType: "Dr", city: cityDisplayName, cityId, isSystem: true, status: "Active", createdAt: "2026-01-01T00:00:00.000Z" },
      { name: "Reverse Charge Tax Input not due", accountHead: "gst_input", accountHeadLabel: "GST Input (ITC)", nature: "asset", type: "other", openingBalance: 0, openingBalanceType: "Dr", city: cityDisplayName, cityId, isSystem: true, status: "Active", createdAt: "2026-01-01T00:00:00.000Z" },

      // LIABILITIES - TDS Payable
      { name: "TDS Payable", accountHead: "tds_payable", accountHeadLabel: "TDS Payable", nature: "liability", type: "other", openingBalance: 0, openingBalanceType: "Cr", city: cityDisplayName, cityId, isSystem: true, status: "Active", createdAt: "2026-01-01T00:00:00.000Z" },
      { name: "Intermediate TDS Payable", accountHead: "tds_payable", accountHeadLabel: "TDS Payable", nature: "liability", type: "other", openingBalance: 0, openingBalanceType: "Cr", city: cityDisplayName, cityId, isSystem: true, status: "Active", createdAt: "2026-01-01T00:00:00.000Z" },

      // LIABILITIES - Duties & Taxes
      { name: "GST Payable", accountHead: "duties_taxes", accountHeadLabel: "Duties & Taxes", nature: "liability", type: "other", openingBalance: 0, openingBalanceType: "Cr", city: cityDisplayName, cityId, isSystem: true, status: "Active", createdAt: "2026-01-01T00:00:00.000Z" },
      { name: "Output IGST", accountHead: "duties_taxes", accountHeadLabel: "Duties & Taxes", nature: "liability", type: "other", openingBalance: 0, openingBalanceType: "Cr", city: cityDisplayName, cityId, isSystem: true, status: "Active", createdAt: "2026-01-01T00:00:00.000Z" },
      { name: "Output CGST", accountHead: "duties_taxes", accountHeadLabel: "Duties & Taxes", nature: "liability", type: "other", openingBalance: 0, openingBalanceType: "Cr", city: cityDisplayName, cityId, isSystem: true, status: "Active", createdAt: "2026-01-01T00:00:00.000Z" },
      { name: "Output SGST", accountHead: "duties_taxes", accountHeadLabel: "Duties & Taxes", nature: "liability", type: "other", openingBalance: 0, openingBalanceType: "Cr", city: cityDisplayName, cityId, isSystem: true, status: "Active", createdAt: "2026-01-01T00:00:00.000Z" },
      { name: "CGST RCM Output", accountHead: "duties_taxes", accountHeadLabel: "Duties & Taxes", nature: "liability", type: "other", openingBalance: 0, openingBalanceType: "Cr", city: cityDisplayName, cityId, isSystem: true, status: "Active", createdAt: "2026-01-01T00:00:00.000Z" },
      { name: "SGST RCM Output", accountHead: "duties_taxes", accountHeadLabel: "Duties & Taxes", nature: "liability", type: "other", openingBalance: 0, openingBalanceType: "Cr", city: cityDisplayName, cityId, isSystem: true, status: "Active", createdAt: "2026-01-01T00:00:00.000Z" },
      { name: "Tax Payable", accountHead: "duties_taxes", accountHeadLabel: "Duties & Taxes", nature: "liability", type: "other", openingBalance: 0, openingBalanceType: "Cr", city: cityDisplayName, cityId, isSystem: true, status: "Active", createdAt: "2026-01-01T00:00:00.000Z" },

      // LIABILITIES - Credit Cards
      { name: "One Card 5447", accountHead: "credit_cards", accountHeadLabel: "Credit Cards", nature: "liability", type: "other", openingBalance: 0, openingBalanceType: "Cr", city: cityDisplayName, cityId, isSystem: true, status: "Active", createdAt: "2026-01-01T00:00:00.000Z" },
      { name: "ICICI 9004", accountHead: "credit_cards", accountHeadLabel: "Credit Cards", nature: "liability", type: "other", openingBalance: 0, openingBalanceType: "Cr", city: cityDisplayName, cityId, isSystem: true, status: "Active", createdAt: "2026-01-01T00:00:00.000Z" },
      { name: "ICICI 4002 (Rupay)", accountHead: "credit_cards", accountHeadLabel: "Credit Cards", nature: "liability", type: "other", openingBalance: 0, openingBalanceType: "Cr", city: cityDisplayName, cityId, isSystem: true, status: "Active", createdAt: "2026-01-01T00:00:00.000Z" },
      { name: "HDFC 6543", accountHead: "credit_cards", accountHeadLabel: "Credit Cards", nature: "liability", type: "other", openingBalance: 0, openingBalanceType: "Cr", city: cityDisplayName, cityId, isSystem: true, status: "Active", createdAt: "2026-01-01T00:00:00.000Z" },

      // LIABILITIES - Non-Current Liabilities
      { name: "Mortgages", accountHead: "non_current_liab", accountHeadLabel: "Non-Current Liabilities", nature: "liability", type: "other", openingBalance: 0, openingBalanceType: "Cr", city: cityDisplayName, cityId, isSystem: true, status: "Active", createdAt: "2026-01-01T00:00:00.000Z" },
      { name: "Construction Loans", accountHead: "non_current_liab", accountHeadLabel: "Non-Current Liabilities", nature: "liability", type: "other", openingBalance: 0, openingBalanceType: "Cr", city: cityDisplayName, cityId, isSystem: true, status: "Active", createdAt: "2026-01-01T00:00:00.000Z" },

      // LIABILITIES - Other Liabilities
      { name: "Employee Reimbursements", accountHead: "other_liabilities", accountHeadLabel: "Other Liabilities", nature: "liability", type: "other", openingBalance: 0, openingBalanceType: "Cr", city: cityDisplayName, cityId, isSystem: true, status: "Active", createdAt: "2026-01-01T00:00:00.000Z" },
      { name: "Unearned Revenue", accountHead: "other_liabilities", accountHeadLabel: "Other Liabilities", nature: "liability", type: "other", openingBalance: 0, openingBalanceType: "Cr", city: cityDisplayName, cityId, isSystem: true, status: "Active", createdAt: "2026-01-01T00:00:00.000Z" },

      // LIABILITIES - Accounts Payable
      { name: "Accounts Payable", accountHead: "accounts_payable", accountHeadLabel: "Accounts Payable", nature: "liability", type: "vendor", openingBalance: 0, openingBalanceType: "Cr", city: cityDisplayName, cityId, isSystem: true, status: "Active", createdAt: "2026-01-01T00:00:00.000Z" },

      // INCOME - Sales Subscription
      { name: "Subscription - 2W", accountHead: "sales_subscription", accountHeadLabel: "Sales — Subscription", nature: "income", type: "sales", packageCode: "2W", openingBalance: 0, openingBalanceType: "Cr", city: cityDisplayName, cityId, isSystem: true, status: "Active", createdAt: "2026-01-01T00:00:00.000Z" },
      { name: "Subscription - 4W", accountHead: "sales_subscription", accountHeadLabel: "Sales — Subscription", nature: "income", type: "sales", packageCode: "4W", openingBalance: 0, openingBalanceType: "Cr", city: cityDisplayName, cityId, isSystem: true, status: "Active", createdAt: "2026-01-01T00:00:00.000Z" },
      { name: "Subscription - 2W+W+S", accountHead: "sales_subscription", accountHeadLabel: "Sales — Subscription", nature: "income", type: "sales", packageCode: "2W_WASH_SANITIZE", openingBalance: 0, openingBalanceType: "Cr", city: cityDisplayName, cityId, isSystem: true, status: "Active", createdAt: "2026-01-01T00:00:00.000Z" },
      { name: "Subscription - 2W+W+W+S", accountHead: "sales_subscription", accountHeadLabel: "Sales — Subscription", nature: "income", type: "sales", packageCode: "2W_WASH_WASH_SANITIZE", openingBalance: 0, openingBalanceType: "Cr", city: cityDisplayName, cityId, isSystem: true, status: "Active", createdAt: "2026-01-01T00:00:00.000Z" },

      // INCOME - Sales Service
      { name: "One-time Service", accountHead: "sales_service", accountHeadLabel: "Sales — Service", nature: "income", type: "sales", openingBalance: 0, openingBalanceType: "Cr", city: cityDisplayName, cityId, isSystem: true, status: "Active", createdAt: "2026-01-01T00:00:00.000Z" },

      // INCOME - Sales Renewal
      { name: "Renewal Fees", accountHead: "sales_renewal", accountHeadLabel: "Sales — Renewal", nature: "income", type: "sales", openingBalance: 0, openingBalanceType: "Cr", city: cityDisplayName, cityId, isSystem: true, status: "Active", createdAt: "2026-01-01T00:00:00.000Z" },

      // INCOME - Other Income
      { name: "General Income", accountHead: "other_income", accountHeadLabel: "Other Income", nature: "income", type: "other", openingBalance: 0, openingBalanceType: "Cr", city: cityDisplayName, cityId, isSystem: true, status: "Active", createdAt: "2026-01-01T00:00:00.000Z" },
      { name: "Interest Income", accountHead: "other_income", accountHeadLabel: "Other Income", nature: "income", type: "other", openingBalance: 0, openingBalanceType: "Cr", city: cityDisplayName, cityId, isSystem: true, status: "Active", createdAt: "2026-01-01T00:00:00.000Z" },
      { name: "Late Fee", accountHead: "other_income", accountHeadLabel: "Other Income", nature: "income", type: "other", openingBalance: 0, openingBalanceType: "Cr", city: cityDisplayName, cityId, isSystem: true, status: "Active", createdAt: "2026-01-01T00:00:00.000Z" },
      { name: "Discount", accountHead: "other_income", accountHeadLabel: "Other Income", nature: "income", type: "other", openingBalance: 0, openingBalanceType: "Cr", city: cityDisplayName, cityId, isSystem: true, status: "Active", createdAt: "2026-01-01T00:00:00.000Z" },

      // EXPENSES - COGS
      { name: "Labor", accountHead: "cogs", accountHeadLabel: "Cost of Goods Sold", nature: "expense", type: "expense", openingBalance: 0, openingBalanceType: "Dr", city: cityDisplayName, cityId, isSystem: true, status: "Active", createdAt: "2026-01-01T00:00:00.000Z" },
      { name: "Materials", accountHead: "cogs", accountHeadLabel: "Cost of Goods Sold", nature: "expense", type: "expense", openingBalance: 0, openingBalanceType: "Dr", city: cityDisplayName, cityId, isSystem: true, status: "Active", createdAt: "2026-01-01T00:00:00.000Z" },
      { name: "Subcontractor", accountHead: "cogs", accountHeadLabel: "Cost of Goods Sold", nature: "expense", type: "expense", openingBalance: 0, openingBalanceType: "Dr", city: cityDisplayName, cityId, isSystem: true, status: "Active", createdAt: "2026-01-01T00:00:00.000Z" },

      // EXPENSES - Direct Expenses
      { name: "Salaries and Employee Wages", accountHead: "direct_expenses", accountHeadLabel: "Direct Expenses", nature: "expense", type: "expense", openingBalance: 0, openingBalanceType: "Dr", city: cityDisplayName, cityId, isSystem: true, status: "Active", createdAt: "2026-01-01T00:00:00.000Z" },
      { name: "Raw Materials And Consumables", accountHead: "direct_expenses", accountHeadLabel: "Direct Expenses", nature: "expense", type: "expense", openingBalance: 0, openingBalanceType: "Dr", city: cityDisplayName, cityId, isSystem: true, status: "Active", createdAt: "2026-01-01T00:00:00.000Z" },

      // EXPENSES - Indirect Expenses
      { name: "Transaction Charges (Razorpay)", accountHead: "indirect_expenses", accountHeadLabel: "Indirect Expenses", nature: "expense", type: "expense", openingBalance: 0, openingBalanceType: "Dr", city: cityDisplayName, cityId, isSystem: true, status: "Active", createdAt: "2026-01-01T00:00:00.000Z" },
      { name: "Bank Fees and Charges", accountHead: "indirect_expenses", accountHeadLabel: "Indirect Expenses", nature: "expense", type: "expense", openingBalance: 0, openingBalanceType: "Dr", city: cityDisplayName, cityId, isSystem: true, status: "Active", createdAt: "2026-01-01T00:00:00.000Z" },
      { name: "Consultant Expense", accountHead: "indirect_expenses", accountHeadLabel: "Indirect Expenses", nature: "expense", type: "expense", openingBalance: 0, openingBalanceType: "Dr", city: cityDisplayName, cityId, isSystem: true, status: "Active", createdAt: "2026-01-01T00:00:00.000Z" },
      { name: "Electricity Expense", accountHead: "indirect_expenses", accountHeadLabel: "Indirect Expenses", nature: "expense", type: "expense", openingBalance: 0, openingBalanceType: "Dr", city: cityDisplayName, cityId, isSystem: true, status: "Active", createdAt: "2026-01-01T00:00:00.000Z" },
      { name: "Rent Expense", accountHead: "indirect_expenses", accountHeadLabel: "Indirect Expenses", nature: "expense", type: "expense", openingBalance: 0, openingBalanceType: "Dr", city: cityDisplayName, cityId, isSystem: true, status: "Active", createdAt: "2026-01-01T00:00:00.000Z" },

      // EXPENSES - Depreciation
      { name: "Depreciation Expense", accountHead: "depreciation", accountHeadLabel: "Depreciation", nature: "expense", type: "expense", openingBalance: 0, openingBalanceType: "Dr", city: cityDisplayName, cityId, isSystem: true, status: "Active", createdAt: "2026-01-01T00:00:00.000Z" },
    ];

    let updated = [...existing];
    let changed = false;
    for (const sl of systemLedgers) {
      // Check by name + city regardless of isSystem flag.
      // This prevents creating a duplicate system ledger when the seed has already
      // created one with the same name but a different ID (e.g. LM-AXB-SUR vs SYS-Axis-Bank-CITY-SURAT).
      const exists = existing.find(e =>
        e.cityId === cityId &&
        e.name.trim().toLowerCase() === sl.name.trim().toLowerCase()
      );
      if (!exists) {
        // Use stable, predictable ID so entries can reference it
        const stableId = `SYS-${sl.name.replace(/[^a-zA-Z0-9]/g, "-").replace(/-+/g,"-")}-${cityId}`;
        updated.push({ ...sl, id: stableId });
        changed = true;
      }
    }
    if (changed) localStorage.setItem(this.LEDGER_KEY, JSON.stringify(updated));
    return updated;
  }

  saveLedger(ledger: LedgerMaster): void {
    const all = this.getLedgers();
    const idx = all.findIndex(l => l.id === ledger.id);
    idx >= 0 ? all.splice(idx, 1, ledger) : all.push(ledger);
    localStorage.setItem(this.LEDGER_KEY, JSON.stringify(all));
  }

  deleteLedger(id: string): boolean {
    const all = this.getLedgers();
    const ledger = all.find(l => l.id === id);
    if (!ledger || ledger.isSystem) return false;
    localStorage.setItem(this.LEDGER_KEY, JSON.stringify(all.filter(l => l.id !== id)));
    return true;
  }

  getLedgersByHead(accountHead: string, cityId?: string): LedgerMaster[] {
    return this.getLedgers(cityId).filter(l => l.accountHead === accountHead);
  }

  getLedgerBalance(ledgerId: string, cityId?: string): LedgerBalance {
    const ledger = this.getLedgers(cityId || "CITY-SURAT").find(l => l.id === ledgerId);

    // --- Accounting entries (direct debit/credit account IDs) ---
    const accEntries = this.getEntries().filter(e =>
      e.debitAccount === ledgerId || e.creditAccount === ledgerId
    );
    const accDebit  = accEntries.reduce((s, e) => s + (e.debitAccount  === ledgerId ? e.totalBillValue : 0), 0);
    const accCredit = accEntries.reduce((s, e) => s + (e.creditAccount === ledgerId ? e.totalBillValue : 0), 0);

    // --- Journal entry lines (accountHead stores the ledger ID on each line) ---
    const journals = this.getJournals();
    let jvDebit = 0;
    let jvCredit = 0;
    for (const jv of journals) {
      if (jv.status !== "Posted") continue;
      for (const line of jv.lines) {
        if (line.accountHead === ledgerId) {
          jvDebit  += line.debit  || 0;
          jvCredit += line.credit || 0;
        }
      }
    }

    const totalDebit  = accDebit  + jvDebit;
    const totalCredit = accCredit + jvCredit;
    const balance     = totalDebit - totalCredit;

    return {
      ledgerId,
      ledgerName:  ledger?.name || ledgerId,
      accountHead: ledger?.accountHead || "",
      totalDebit,
      totalCredit,
      balance:     Math.abs(balance),
      balanceType: balance >= 0 ? "Dr" : "Cr",
    };
  }

  // Auto-create customer debtor ledger when a new subscriber is added
  // ── TDS Payment Persistence ──────────────────────────────────────────────────
  getTDSPayments(cityId: string): Array<{
    id: string; cityId: string; section: string; amount: number;
    challanNumber: string; bank: string; paymentDate: string;
    journalVoucher?: string; createdAt: string;
  }> {
    try {
      const raw = localStorage.getItem(`cleancar_tds_payments_${cityId}`);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  }

  saveTDSPayment(payment: {
    id: string; cityId: string; section: string; amount: number;
    challanNumber: string; bank: string; paymentDate: string;
    journalVoucher?: string; createdAt: string;
  }): void {
    const all = this.getTDSPayments(payment.cityId);
    const updated = [...all.filter(p => p.id !== payment.id), payment];
    localStorage.setItem(`cleancar_tds_payments_${payment.cityId}`, JSON.stringify(updated));
  }

  createCustomerLedger(customerId: string, customerName: string,
      subscriptionPlan: string, cityId: string, city: string): LedgerMaster {
    const existing = this.getLedgers(cityId).find(l => l.customerId === customerId);
    if (existing) return existing;
    const ledger: LedgerMaster = {
      id: `CUST-LEDGER-${customerId}`,
      name: customerName,
      accountHead: "accounts_receivable",
      accountHeadLabel: "Accounts Receivable",
      nature: "asset", type: "customer",
      openingBalance: 0, openingBalanceType: "Dr",
      city, cityId, isSystem: false,
      status: "Active", createdAt: new Date().toISOString(),
      customerId, customerName, subscriptionPlan,
    };
    this.saveLedger(ledger);
    return ledger;
  }
}

export const accountingEntryService = new AccountingEntryService();
