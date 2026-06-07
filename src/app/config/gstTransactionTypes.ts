/**
 * GST Transaction Types Configuration
 *
 * Single source of truth for all transaction types and their sub-types.
 * Includes system defaults + custom user-defined sub-types.
 *
 * IMPORTANT: This determines ITC eligibility, accounting heads, and HSN/SAC hints.
 */

import { DataService } from "../services/DataService";

export interface TransactionSubType {
  id: string;               // e.g. "PURCHASE_CAPITAL"
  parentType: string;       // "Purchase" | "Expense" | "Sale" | "Credit Note" | "Debit Note"
  label: string;            // Display name: "Capital Goods"
  description: string;      // Brief description for tooltip
  itcEligible: boolean;     // Does this sub-type allow ITC claim?
  itcRule: string;          // GST rule reference e.g. "Section 17(5)" or "Fully eligible"
  hsnHint?: string;         // Suggested HSN/SAC code range for this category
  accountHead: string;      // Accounting head e.g. "Fixed Assets", "Office Expenses"
  isCustom: boolean;        // false = system default, true = user-created
  isActive: boolean;
  createdAt?: string;
  createdBy?: string;
}

export const SYSTEM_TRANSACTION_SUB_TYPES: TransactionSubType[] = [

  // ── PURCHASE SUB-TYPES ──────────────────────────────────────────
  {
    id: "PURCHASE_CAPITAL",
    parentType: "Purchase",
    label: "Capital Goods",
    description: "Machinery, equipment, vehicles, computers — assets used for more than 1 year",
    itcEligible: true,
    itcRule: "ITC available over 5 years — Section 16 read with Rule 43",
    hsnHint: "8400–8700 series (machinery), 8700 (vehicles)",
    accountHead: "Fixed Assets",
    isCustom: false,
    isActive: true,
  },
  {
    id: "PURCHASE_CONSUMABLE",
    parentType: "Purchase",
    label: "Consumables / Stores",
    description: "Microfiber cloths, shampoo, chemicals, cleaning agents, gloves — items consumed in operations",
    itcEligible: true,
    itcRule: "Fully eligible ITC — Section 16",
    hsnHint: "3400 (soap/detergent), 6307 (cloths), 3824 (cleaning agents)",
    accountHead: "Consumables",
    isCustom: false,
    isActive: true,
  },
  {
    id: "PURCHASE_SPARE_PARTS",
    parentType: "Purchase",
    label: "Spare Parts & Tools",
    description: "Tools, spare parts used for maintenance and repair of equipment",
    itcEligible: true,
    itcRule: "Fully eligible ITC — Section 16",
    hsnHint: "8203–8205 (hand tools), 8466 (parts for machines)",
    accountHead: "Repairs & Maintenance",
    isCustom: false,
    isActive: true,
  },
  {
    id: "PURCHASE_UNIFORM",
    parentType: "Purchase",
    label: "Uniform & Workwear",
    description: "Staff uniforms, protective gear, safety equipment for washers and supervisors",
    itcEligible: false,
    itcRule: "Blocked credit — Section 17(5)(b) — personal use items",
    hsnHint: "6101–6217 (clothing), 6401–6405 (footwear)",
    accountHead: "Staff Welfare",
    isCustom: false,
    isActive: true,
  },
  {
    id: "PURCHASE_IT",
    parentType: "Purchase",
    label: "IT & Software",
    description: "Computers, tablets, phones, software licenses, ERP subscriptions",
    itcEligible: true,
    itcRule: "Fully eligible ITC — Section 16",
    hsnHint: "8471 (computers), 8517 (phones), 9983 (IT services SAC)",
    accountHead: "IT & Technology",
    isCustom: false,
    isActive: true,
  },
  {
    id: "PURCHASE_OFFICE",
    parentType: "Purchase",
    label: "Office Supplies",
    description: "Stationery, printer cartridges, office furniture, small equipment",
    itcEligible: true,
    itcRule: "Eligible if used for business — Section 16",
    hsnHint: "4800–4900 (stationery), 9403 (furniture)",
    accountHead: "Office Expenses",
    isCustom: false,
    isActive: true,
  },
  {
    id: "PURCHASE_VEHICLE",
    parentType: "Purchase",
    label: "Vehicle Purchase",
    description: "Pickup vans, bikes used for operations or delivery",
    itcEligible: false,
    itcRule: "Blocked credit — Section 17(5)(a) — motor vehicles (unless used for transportation of goods/passengers as core business)",
    hsnHint: "8703 (cars), 8711 (motorcycles)",
    accountHead: "Fixed Assets — Vehicles",
    isCustom: false,
    isActive: true,
  },

  // ── EXPENSE SUB-TYPES ──────────────────────────────────────────
  {
    id: "EXPENSE_RENT",
    parentType: "Expense",
    label: "Rent",
    description: "Office rent, godown rent, parking space rent",
    itcEligible: true,
    itcRule: "Eligible ITC if GST charged by landlord (registered) — Section 16",
    hsnHint: "9972 (real estate services SAC)",
    accountHead: "Rent",
    isCustom: false,
    isActive: true,
  },
  {
    id: "EXPENSE_ELECTRICITY",
    parentType: "Expense",
    label: "Electricity Bill",
    description: "Electricity charges for office or operations",
    itcEligible: false,
    itcRule: "No ITC — electricity is exempt/nil-rated supply. No GST charged on electricity bills.",
    hsnHint: "2716 (electrical energy) — exempt",
    accountHead: "Utilities",
    isCustom: false,
    isActive: true,
  },
  {
    id: "EXPENSE_PHONE",
    parentType: "Expense",
    label: "Phone & Internet",
    description: "Mobile recharges, broadband, office landline, internet connection for operations",
    itcEligible: true,
    itcRule: "Eligible ITC if GST billed — Section 16. Mobile used for personal = blocked.",
    hsnHint: "9984 (telecom services SAC)",
    accountHead: "Communication Expenses",
    isCustom: false,
    isActive: true,
  },
  {
    id: "EXPENSE_PROFESSIONAL",
    parentType: "Expense",
    label: "Professional Fees",
    description: "CA fees, legal fees, consultant fees, audit charges",
    itcEligible: true,
    itcRule: "Eligible ITC if vendor is GST registered — Section 16",
    hsnHint: "9982 (legal services SAC), 9984 (accounting SAC)",
    accountHead: "Professional Fees",
    isCustom: false,
    isActive: true,
  },
  {
    id: "EXPENSE_MARKETING",
    parentType: "Expense",
    label: "Marketing & Advertising",
    description: "Meta ads, Google ads, printing, banners, pamphlets, agency fees",
    itcEligible: true,
    itcRule: "Eligible ITC if GST charged — Section 16",
    hsnHint: "9983 (advertising SAC), 4901–4911 (printed material)",
    accountHead: "Marketing Expenses",
    isCustom: false,
    isActive: true,
  },
  {
    id: "EXPENSE_TRANSPORT",
    parentType: "Expense",
    label: "Transport / Freight",
    description: "Courier charges, goods transport, logistics for supply delivery",
    itcEligible: true,
    itcRule: "ITC available — GTA under RCM or forward charge — Section 16",
    hsnHint: "9965 (freight transport SAC)",
    accountHead: "Freight & Carriage",
    isCustom: false,
    isActive: true,
  },
  {
    id: "EXPENSE_INSURANCE",
    parentType: "Expense",
    label: "Insurance",
    description: "Vehicle insurance, office insurance, health/workmen insurance",
    itcEligible: false,
    itcRule: "ITC blocked on life/health insurance per Section 17(5). General business insurance may be eligible.",
    hsnHint: "9971 (financial/insurance services SAC)",
    accountHead: "Insurance",
    isCustom: false,
    isActive: true,
  },
  {
    id: "EXPENSE_REPAIRS",
    parentType: "Expense",
    label: "Repairs & Maintenance",
    description: "Equipment servicing, office repairs, vehicle servicing",
    itcEligible: true,
    itcRule: "Eligible ITC on business repairs — Section 16",
    hsnHint: "9987 (maintenance services SAC)",
    accountHead: "Repairs & Maintenance",
    isCustom: false,
    isActive: true,
  },
  {
    id: "EXPENSE_FUEL",
    parentType: "Expense",
    label: "Fuel",
    description: "Petrol, diesel for operations vehicles. Note: no GST input on fuel currently.",
    itcEligible: false,
    itcRule: "No ITC — petrol and diesel are outside GST scope currently (not notified under Section 9)",
    hsnHint: "2710 (petroleum products) — outside GST",
    accountHead: "Fuel & Conveyance",
    isCustom: false,
    isActive: true,
  },
  {
    id: "EXPENSE_BANK",
    parentType: "Expense",
    label: "Bank Charges",
    description: "Bank processing fees, cheque book, NEFT charges, locker charges",
    itcEligible: false,
    itcRule: "Bank charges may or may not have GST. If GST charged, ITC eligible — Section 16.",
    hsnHint: "9971 (financial services SAC)",
    accountHead: "Bank Charges",
    isCustom: false,
    isActive: true,
  },
  {
    id: "EXPENSE_STAFF_WELFARE",
    parentType: "Expense",
    label: "Staff Welfare",
    description: "Tea, refreshments, staff events, canteen expenses for employees",
    itcEligible: false,
    itcRule: "Blocked credit — Section 17(5)(b) — food and beverages for personal consumption",
    hsnHint: "9963 (food services SAC)",
    accountHead: "Staff Welfare",
    isCustom: false,
    isActive: true,
  },
  {
    id: "EXPENSE_OTHER",
    parentType: "Expense",
    label: "Other Expense",
    description: "Miscellaneous expense not covered by other categories",
    itcEligible: false,
    itcRule: "Evaluate case by case",
    hsnHint: "",
    accountHead: "Miscellaneous",
    isCustom: false,
    isActive: true,
  },

  // ── SALE SUB-TYPES ──────────────────────────────────────────────
  {
    id: "SALE_SUBSCRIPTION",
    parentType: "Sale",
    label: "Subscription (Car Wash Plan)",
    description: "Monthly/quarterly/annual subscription plans for car washing service",
    itcEligible: false,
    itcRule: "Output supply — not applicable for ITC",
    hsnHint: "998531 (car/vehicle washing and cleaning services — correct SAC under 9985 group)",
    accountHead: "Service Revenue",
    isCustom: false,
    isActive: true,
  },
  {
    id: "SALE_ADDON",
    parentType: "Sale",
    label: "Add-On Services",
    description: "Vacuum, interior wipe, engine wash, ceramic coating — one-time add-on sales",
    itcEligible: false,
    itcRule: "Output supply — not applicable for ITC",
    hsnHint: "998531 (car/vehicle washing and cleaning services SAC)",
    accountHead: "Service Revenue — Add-Ons",
    isCustom: false,
    isActive: true,
  },
  {
    id: "SALE_ONE_TIME",
    parentType: "Sale",
    label: "One-Time / Walk-In",
    description: "Single wash sale to a non-subscriber customer",
    itcEligible: false,
    itcRule: "Output supply — not applicable for ITC",
    hsnHint: "998531 (car/vehicle washing and cleaning services SAC)",
    accountHead: "Service Revenue — One-Time",
    isCustom: false,
    isActive: true,
  },
];

/**
 * Get sub-types for a given parent type
 * Merges system defaults with custom user-defined sub-types
 */
export function getSubTypesForParent(parentType: string): TransactionSubType[] {
  const systemTypes = SYSTEM_TRANSACTION_SUB_TYPES.filter(
    st => st.parentType === parentType && st.isActive
  );

  // Merge with custom types from DataService
  try {
    const customTypes = DataService.get<TransactionSubType>("CUSTOM_TRANSACTION_SUB_TYPES");
    const filteredCustom = customTypes.filter(
      ct => ct.parentType === parentType && ct.isActive
    );
    return [...systemTypes, ...filteredCustom];
  } catch {
    return systemTypes;
  }
}

/**
 * Get sub-type by ID
 */
export function getSubTypeById(id: string): TransactionSubType | undefined {
  // Check system types first
  const systemType = SYSTEM_TRANSACTION_SUB_TYPES.find(st => st.id === id);
  if (systemType) return systemType;

  // Check custom types
  try {
    const customTypes = DataService.get<TransactionSubType>("CUSTOM_TRANSACTION_SUB_TYPES");
    return customTypes.find(ct => ct.id === id && ct.isActive);
  } catch {
    return undefined;
  }
}

/**
 * Get all sub-types (system + custom)
 */
export function getAllSubTypes(): TransactionSubType[] {
  const systemTypes = SYSTEM_TRANSACTION_SUB_TYPES.filter(st => st.isActive);

  try {
    const customTypes = DataService.get<TransactionSubType>("CUSTOM_TRANSACTION_SUB_TYPES");
    const activeCustom = customTypes.filter(ct => ct.isActive);
    return [...systemTypes, ...activeCustom];
  } catch {
    return systemTypes;
  }
}

/**
 * Create custom transaction sub-type
 */
export function createCustomSubType(subType: Omit<TransactionSubType, 'isCustom' | 'isActive' | 'createdAt'>): TransactionSubType {
  const newSubType: TransactionSubType = {
    ...subType,
    isCustom: true,
    isActive: true,
    createdAt: new Date().toISOString(),
  };

  DataService.insert("CUSTOM_TRANSACTION_SUB_TYPES", newSubType);
  return newSubType;
}

/**
 * Update custom sub-type
 */
export function updateCustomSubType(id: string, updates: Partial<TransactionSubType>): void {
  DataService.update("CUSTOM_TRANSACTION_SUB_TYPES", id, updates);
}

/**
 * Deactivate custom sub-type
 */
export function deactivateCustomSubType(id: string): void {
  DataService.update("CUSTOM_TRANSACTION_SUB_TYPES", id, { isActive: false });
}
