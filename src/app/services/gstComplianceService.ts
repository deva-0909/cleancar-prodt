import { upsertGSTTransaction, upsertGSTVendor } from "./supabaseFinanceAdapter";
// Single source of truth for company GST configuration
// Update this object for each deployment, never hardcode in components
export const COMPANY_GST_CONFIG = {
  stateCode:    "24",
  stateName:    "Gujarat",
  gstin:        "24GAOPS5676E1Z3",
  companyName:  "24/9 Car Washing Private Limited",
} as const;

export type VendorRiskLevel = "Clean" | "Medium" | "High" | "Critical";
export type TransactionStatus = "Draft" | "Validated" | "Flagged" | "Approved" | "Filed";
export type GSTType = "B2B" | "B2C" | "B2CL" | "EXPORT";
export type SupplyType = "Regular" | "RCM" | "SEZ" | "Deemed Export";

// Legal entity types — determine TDS applicability
export type LegalEntityType =
  | "Proprietorship"
  | "Partnership"
  | "LLP"
  | "Pvt Ltd"
  | "Public Ltd"
  | "OPC"
  | "Trust / NGO"
  | "HUF"
  | "Government"
  | "Not Applicable";

// TDS configuration per entity type
export interface TDSEntityConfig {
  entityType: LegalEntityType;
  // TDS rate applies to individuals/non-companies (proprietorship, partnership, HUF) vs companies (Pvt Ltd, LLP etc.)
  isCompany: boolean;
  // Whether TDS is generally applicable on vendor payments
  tdsApplicable: boolean;
}

export const TDS_ENTITY_CONFIG: TDSEntityConfig[] = [
  { entityType: "Proprietorship",  isCompany: false, tdsApplicable: true  },
  { entityType: "Partnership",     isCompany: false, tdsApplicable: true  },
  { entityType: "LLP",             isCompany: true,  tdsApplicable: true  },
  { entityType: "Pvt Ltd",         isCompany: true,  tdsApplicable: true  },
  { entityType: "Public Ltd",      isCompany: true,  tdsApplicable: true  },
  { entityType: "OPC",             isCompany: true,  tdsApplicable: true  },
  { entityType: "Trust / NGO",     isCompany: false, tdsApplicable: true  },
  { entityType: "HUF",             isCompany: false, tdsApplicable: true  },
  { entityType: "Government",      isCompany: true,  tdsApplicable: false }, // Govt depts exempt
  { entityType: "Not Applicable",  isCompany: false, tdsApplicable: false },
];

// TDS override record — applies during validFrom..validTill period
export interface TDSOverride {
  id: string;
  overrideRate: number;           // e.g. 0 for nil deduction certificate
  tdsSection: string;             // e.g. "194C", "194J"
  reason: string;                 // e.g. "Lower deduction certificate u/s 197"
  certificateNumber: string;
  supportingDocumentBase64: string; // uploaded doc
  supportingDocumentName: string;
  validFrom: string;              // ISO date
  validTill: string;              // ISO date
  approvedBy?: string;
  approvedAt?: string;
  createdBy: string;
  createdAt: string;
  status: "Pending Approval" | "Approved" | "Rejected" | "Expired";
}

// Mandatory compliance documents
export interface VendorDocument {
  id: string;
  type: "GST Certificate" | "PAN Certificate" | "TDS Override" | "Other";
  fileName: string;
  fileBase64: string;
  uploadedBy: string;
  uploadedAt: string;
  verifiedBy?: string;
  verifiedAt?: string;
  status: "Pending Verification" | "Verified" | "Rejected";
}

export interface GSTVendor {
  id: string;
  name: string;
  gstin: string;
  pan: string;
  state: string;
  stateCode: string;
  address: string;
  contactPerson: string;
  contactPhone: string;
  contactEmail: string;
  vendorType: "Goods" | "Services" | "Both";
  supplyType: SupplyType;
  paymentTerms: string;
  bankAccountNumber: string;
  ifscCode: string;
  gstinValidated: boolean;
  gstinValidatedOn?: string;
  riskScore: number;
  riskLevel: VendorRiskLevel;
  filingStatus: "Regular Filer" | "Non-Filer" | "Irregular" | "Unknown";
  lastFiledMonth?: string;
  createdBy: string;
  createdAt: string;
  approvedBy?: string;
  approvedAt?: string;
  status: "Active" | "Inactive" | "Blacklisted";
  notes: string;

  // ── NEW: Legal entity & TDS fields ─────────────────────────────────────
  legalEntityType?: LegalEntityType;    // Proprietorship / Pvt Ltd / LLP etc.
  tdsApplicable?: boolean;              // computed from entityType
  tdsDefaultSection?: string;           // default TDS section for this vendor
  tdsDefaultRate?: number;              // rate derived from entity type (company vs individual)
  tdsOverrides?: TDSOverride[];         // time-bound overrides with supporting docs

  // ── NEW: Mandatory compliance documents ───────────────────────────────
  gstCertificate?: VendorDocument;      // MANDATORY — GST registration certificate
  panCertificate?: VendorDocument;      // MANDATORY — PAN card copy

  // ── NEW: Approval workflow ─────────────────────────────────────────────
  approvalStatus?: "Pending" | "Approved" | "Rejected";
  approvalNotes?: string;
  submittedBy?: string;
  submittedAt?: string;
  approvalRequiredBy?: string;          // role that must approve
}

export interface GSTCustomer {
  id: string;
  name: string;
  gstin?: string;
  pan?: string;
  state: string;
  stateCode: string;
  address: string;
  contactPerson: string;
  contactPhone: string;
  contactEmail: string;
  customerType: GSTType;
  registrationType: "Regular" | "Composition" | "SEZ" | "Unregistered";
  creditLimit: number;
  creditDays: number;
  createdBy: string;
  createdAt: string;
  status: "Active" | "Inactive";
  cityId: string;
  city: string;
}

export interface GSTTransaction {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  transactionType: "Sale" | "Purchase" | "Expense" | "Credit Note" | "Debit Note";
  transactionSubType?: string;     // e.g. "Capital Goods", "Rent", "Consumable"
  transactionCategory?: string;    // e.g. "PURCHASE_CAPITAL", "EXPENSE_RENT"
  gstType: GSTType;
  partyId: string;
  partyName: string;
  partyGstin: string;
  partyState: string;
  placeOfSupply: string;
  placeOfSupplyCode: string;
  hsnSacCode: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  taxableValue: number;
  gstRate: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  totalTax: number;
  invoiceTotal: number;
  itcEligible: boolean;
  itcAmount: number;
  reverseCharge: boolean;
  status: TransactionStatus;
  validationErrors: string[];
  riskScore: number;
  riskLevel: VendorRiskLevel;
  createdBy: string;
  createdAt: string;
  approvedBy?: string;
  approvedAt?: string;
  filedInReturn?: string;
  gstr1GeneratedAt?: string;
  month: number;          // Store as integer 1–12. Never locale string.
  year: number;
  cityId: string;
  city: string;
  supplyNature: "Taxable" | "ZeroRated" | "NilRated" | "Exempt" | "NonGST";
  changeHistory: GSTChangeLog[];
}

export interface GSTChangeLog {
  timestamp: string;
  changedBy: string;
  action: string;         // "Submitted" | "Approved" | "Rejected" | "Filed" | "AI Correction Applied" | "Override"
  previousStatus?: string;
  newStatus?: string;
  note?: string;
}

export interface GSTReconciliationRecord {
  id: string;
  vendorId: string;
  vendorName: string;
  vendorGstin: string;
  invoiceNumber: string;
  invoiceDate: string;
  taxableValue: number;
  gstAmount: number;
  inSystemBooks: boolean;
  inGSTR2B: boolean;
  matchStatus: "Matched" | "In Books Only" | "In 2B Only" | "Amount Mismatch" | "Date Mismatch";
  differenceAmount: number;
  itcClaimable: boolean;
  itcStatus: "Claimed" | "Provisional" | "Blocked" | "Not Claimed";
  vendorFilingStatus: "Filed" | "Not Filed" | "Delayed";
  notes: string;
  month: string;
  year: number;
}

class GSTComplianceService {
  private cityId: string = "CITY-SURAT";

  setCityId(cityId: string): void {
    this.cityId = cityId;
  }

  private get VENDOR_KEY()   { return `cleancar_${this.cityId}_gst_vendors`; }
  private get CUSTOMER_KEY() { return `cleancar_${this.cityId}_gst_customers`; }
  private get TXN_KEY()      { return `cleancar_${this.cityId}_gst_transactions`; }
  private get RECON_KEY()    { return `cleancar_${this.cityId}_gst_reconciliation`; }

  validateGSTIN(gstin: string): { valid: boolean; stateCode: string; error?: string } {
    const pattern = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    if (!pattern.test(gstin)) return { valid: false, stateCode: "", error: "Invalid GSTIN format" };
    const stateCode = gstin.substring(0, 2);
    return { valid: true, stateCode };
  }

  deriveGSTType(gstin?: string): GSTType {
    return gstin && gstin.trim().length === 15 ? "B2B" : "B2C";
  }

  calculateGST(
    taxableValue: number,
    gstRate: number,
    supplyType: "INTRA_STATE" | "INTER_STATE" | "EXPORT" | "RCM_INTRA" | "RCM_INTER"
  ): { cgst: number; sgst: number; igst: number; totalTax: number; invoiceTotal: number } {
    if (gstRate === 0 || supplyType === "EXPORT") {
      return { cgst: 0, sgst: 0, igst: 0, totalTax: 0, invoiceTotal: taxableValue };
    }
    const rate = gstRate / 100;
    const isIntra = supplyType === "INTRA_STATE" || supplyType === "RCM_INTRA";
    const cgst   = isIntra ? Math.round(taxableValue * rate / 2 * 100) / 100 : 0;
    const sgst   = isIntra ? Math.round(taxableValue * rate / 2 * 100) / 100 : 0;
    const igst   = !isIntra ? Math.round(taxableValue * rate * 100) / 100 : 0;
    const totalTax = cgst + sgst + igst;
    return { cgst, sgst, igst, totalTax, invoiceTotal: taxableValue + totalTax };
  }

  initVendorRisk(gstin: string): number {
    const validation = this.validateGSTIN(gstin);
    if (!validation.valid) return 100;
    return 40;
  }

  private getList<T>(key: string): T[] {
    const d = localStorage.getItem(key);
    return d ? JSON.parse(d) : [];
  }
  private saveList<T>(key: string, list: T[]): void {
    localStorage.setItem(key, JSON.stringify(list));
    if (key === this.TXN_KEY) {
      (list as unknown as GSTTransaction[]).forEach(t =>
        upsertGSTTransaction(t as unknown as Record<string, unknown>).catch(console.warn));
    }
    if (key === this.VENDOR_KEY) {
      (list as unknown as GSTVendor[]).forEach(v =>
        upsertGSTVendor(v as unknown as Record<string, unknown>).catch(console.warn));
    }
  }

  getVendors(): GSTVendor[]       { return this.getList<GSTVendor>(this.VENDOR_KEY); }
  getCustomers(cityId?: string): GSTCustomer[] {
    const all = this.getList<GSTCustomer>(this.CUSTOMER_KEY);
    return cityId ? all.filter(c => c.cityId === cityId) : all;
  }
  getTransactions(cityId?: string): GSTTransaction[] {
    const all = this.getList<GSTTransaction>(this.TXN_KEY);
    return cityId ? all.filter(t => t.cityId === cityId) : all;
  }
  getReconciliation(): GSTReconciliationRecord[] { return this.getList<GSTReconciliationRecord>(this.RECON_KEY); }

  saveVendor(v: GSTVendor): void {
    const list = this.getVendors();
    const idx  = list.findIndex(x => x.id === v.id);
    idx >= 0 ? list.splice(idx, 1, v) : list.push(v);
    this.saveList(this.VENDOR_KEY, list);
  }
  saveCustomer(c: GSTCustomer): void {
    const list = this.getCustomers();
    const idx  = list.findIndex(x => x.id === c.id);
    idx >= 0 ? list.splice(idx, 1, c) : list.push(c);
    this.saveList(this.CUSTOMER_KEY, list);
  }
  saveTransaction(t: GSTTransaction): void {
    const list = this.getTransactions();
    const idx  = list.findIndex(x => x.id === t.id);
    idx >= 0 ? list.splice(idx, 1, t) : list.push(t);
    this.saveList(this.TXN_KEY, list);
  }
  saveReconciliationRecord(r: GSTReconciliationRecord): void {
    const list = this.getReconciliation();
    const idx  = list.findIndex(x => x.id === r.id);
    idx >= 0 ? list.splice(idx, 1, r) : list.push(r);
    this.saveList(this.RECON_KEY, list);
  }

  getTransactionsByMonth(month: number, year: number, cityId?: string): GSTTransaction[] {
    return this.getTransactions(cityId).filter(t => t.month === month && t.year === year);
  }
  getPendingApproval(cityId?: string): GSTTransaction[] {
    return this.getTransactions(cityId).filter(t => t.status === "Validated" || t.status === "Flagged");
  }

  appendChangeLog(txnId: string, entry: GSTChangeLog): void {
    const all = this.getTransactions();
    const idx = all.findIndex(t => t.id === txnId);
    if (idx < 0) return;
    const updated = { ...all[idx], changeHistory: [...(all[idx].changeHistory || []), entry] };
    all.splice(idx, 1, updated);
    this.saveList(this.TXN_KEY, all);
  }
}

export const gstComplianceService = new GSTComplianceService();
