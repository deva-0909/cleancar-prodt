import { useState, useMemo } from "react";
import { toast } from "sonner";
import { Building2, Plus, Search, Download, X, Check, AlertCircle, Edit2, Ban, CheckCircle, Upload, Shield, Calendar, FileText, Clock } from "lucide-react";
import { gstComplianceService, type GSTVendor, type VendorRiskLevel, type LegalEntityType, type TDSOverride, type VendorDocument, TDS_ENTITY_CONFIG } from "../../services/gstComplianceService";
import { useRole } from "../../contexts/RoleContext";
import { showExportMenu } from "../../utils/gstExportUtils";
import { GST_STATE_OPTIONS, GST_STATES } from "../../services/accountingEntryService";

// Legal entity types
const LEGAL_ENTITY_TYPES: LegalEntityType[] = [
  "Proprietorship", "Partnership", "LLP", "Pvt Ltd",
  "Public Ltd", "OPC", "Trust / NGO", "HUF", "Government", "Not Applicable"
];

// TDS sections most used for vendor payments
const TDS_SECTIONS = [
  { section: "194C", label: "194C — Contractor/Sub-contractor" },
  { section: "194J", label: "194J — Professional/Technical Fees" },
  { section: "194I", label: "194I — Rent (Land/Building)" },
  { section: "194I(a)", label: "194I(a) — Rent (Plant/Machinery)" },
  { section: "194H", label: "194H — Commission/Brokerage" },
  { section: "194A", label: "194A — Interest" },
  { section: "194Q", label: "194Q — Purchase of Goods" },
  { section: "192",  label: "192 — Salary" },
  { section: "N/A",  label: "Not Applicable" },
];

// Derive TDS rate from entity type + section
function getTDSRate(entityType: LegalEntityType | undefined, section: string): number {
  if (!entityType || entityType === "Not Applicable" || entityType === "Government") return 0;
  const cfg = TDS_ENTITY_CONFIG.find(c => c.entityType === entityType);
  const isCompany = cfg?.isCompany ?? false;
  const rateMap: Record<string, { individual: number; company: number }> = {
    "194C":    { individual: 1,   company: 2   },
    "194J":    { individual: 10,  company: 10  },
    "194J(b)": { individual: 2,   company: 2   },
    "194I":    { individual: 10,  company: 10  },
    "194I(a)": { individual: 2,   company: 2   },
    "194H":    { individual: 5,   company: 5   },
    "194A":    { individual: 10,  company: 10  },
    "194Q":    { individual: 0.1, company: 0.1 },
    "192":     { individual: 0,   company: 0   },
    "N/A":     { individual: 0,   company: 0   },
  };
  const rates = rateMap[section];
  if (!rates) return 0;
  return isCompany ? rates.company : rates.individual;
}

// Roles that can approve vendor master changes
const MANAGER_ROLES = ["Super Admin", "Admin", "Accounts", "City Manager", "Cluster Manager"];

export function GSTVendorMaster() {
  const { currentRole, currentUser } = useRole();
  const isManager = MANAGER_ROLES.includes(currentRole || "");
  const [vendors, setVendors] = useState<GSTVendor[]>(gstComplianceService.getVendors());
  const [pendingApprovals, setPendingApprovals] = useState<GSTVendor[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterState, setFilterState] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterRisk, setFilterRisk] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingVendor, setEditingVendor] = useState<GSTVendor | null>(null);
  const [viewingVendor, setViewingVendor] = useState<GSTVendor | null>(null);

  const filteredVendors = useMemo(() => {
    return vendors.filter(v => {
      const matchSearch = !searchTerm ||
        v.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.gstin.toLowerCase().includes(searchTerm.toLowerCase());
      const matchState = !filterState || v.state === filterState;
      const matchStatus = !filterStatus || v.status === filterStatus;
      const matchRisk = !filterRisk || v.riskLevel === filterRisk;
      return matchSearch && matchState && matchStatus && matchRisk;
    });
  }, [vendors, searchTerm, filterState, filterStatus, filterRisk]);

  const states = useMemo(() => Array.from(new Set(vendors.map(v => v.state))), [vendors]);

  const handleExport = (e: React.MouseEvent) => {
    const data = filteredVendors.map(v => ({
      Name: v.name,
      GSTIN: v.gstin,
      PAN: v.pan,
      State: v.state,
      "Risk Score": v.riskScore,
      "Filing Status": v.filingStatus,
      Status: v.status,
      "Contact Person": v.contactPerson,
      Email: v.contactEmail,
      Phone: v.contactPhone
    }));
    showExportMenu(data, "gst-vendor-master", e.currentTarget as HTMLElement);
  };

  const handleSaveVendor = (vendor: GSTVendor) => {
    gstComplianceService.saveVendor(vendor);
    setVendors(gstComplianceService.getVendors());
    setShowAddForm(false);
    setEditingVendor(null);
  };

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between border-b pb-4">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Building2 className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">GST Vendor Master</h1>
            <p className="text-sm text-gray-600">Manage vendor information and GSTIN validation</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <Download className="w-4 h-4" />
            <span className="text-sm">Export</span>
          </button>
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            <span className="text-sm">Add Vendor</span>
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name or GSTIN..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <select
            value={filterState}
            onChange={e => setFilterState(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="">All States</option>
            {states.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="">All Status</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
            <option value="Blacklisted">Blacklisted</option>
          </select>
          <select
            value={filterRisk}
            onChange={e => setFilterRisk(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="">All Risk Levels</option>
            <option value="Clean">Clean</option>
            <option value="Medium">Medium</option>
            <option value="High">High</option>
            <option value="Critical">Critical</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 text-left text-sm text-gray-600">
                <th className="pb-3 font-medium">Vendor Name</th>
                <th className="pb-3 font-medium">GSTIN</th>
                <th className="pb-3 font-medium">State</th>
                <th className="pb-3 font-medium">PAN</th>
                <th className="pb-3 font-medium">Risk Score</th>
                <th className="pb-3 font-medium">Filing Status</th>
                <th className="pb-3 font-medium">Status</th>
                <th className="pb-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredVendors.map(vendor => (
                <tr key={vendor.id} className="border-b border-gray-100 text-sm">
                  <td className="py-3 font-medium text-gray-900">{vendor.name}</td>
                  <td className="py-3 text-gray-700 font-mono text-xs">{vendor.gstin}</td>
                  <td className="py-3 text-gray-700">{vendor.state}</td>
                  <td className="py-3 text-gray-700 font-mono text-xs">{vendor.pan}</td>
                  <td className="py-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      vendor.riskLevel === "Clean" ? "bg-green-100 text-green-700" :
                      vendor.riskLevel === "Medium" ? "bg-amber-100 text-amber-700" :
                      vendor.riskLevel === "High" ? "bg-orange-100 text-orange-700" :
                      "bg-red-100 text-red-700"
                    }`}>
                      {vendor.riskScore}
                    </span>
                  </td>
                  <td className="py-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      vendor.filingStatus === "Regular Filer" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                    }`}>
                      {vendor.filingStatus}
                    </span>
                  </td>
                  <td className="py-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      vendor.status === "Active" ? "bg-blue-100 text-blue-700" :
                      vendor.status === "Inactive" ? "bg-gray-100 text-gray-700" :
                      "bg-red-100 text-red-700"
                    }`}>
                      {vendor.status}
                    </span>
                  </td>
                  <td className="py-3">
                    <button
                      onClick={() => setViewingVendor(vendor)}
                      className="text-blue-600 hover:text-blue-700 text-xs font-medium"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
              {filteredVendors.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-gray-500">
                    No vendors found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {(showAddForm || editingVendor) && (
        <VendorForm
          vendor={editingVendor}
          onSave={handleSaveVendor}
          onClose={() => {
            setShowAddForm(false);
            setEditingVendor(null);
          }}
        />
      )}

      {viewingVendor && (
        <VendorDetail
          vendor={viewingVendor}
          onEdit={() => {
            setEditingVendor(viewingVendor);
            setViewingVendor(null);
          }}
          onClose={() => setViewingVendor(null)}
          onUpdate={(v) => {
            handleSaveVendor(v);
            setViewingVendor(null);
          }}
        />
      )}
    </div>
  );
}

function VendorForm({ vendor, onSave, onClose }: {
  vendor: GSTVendor | null;
  onSave: (v: GSTVendor) => void;
  onClose: () => void;
}) {
  const { currentRole, currentUser } = useRole();
  const isManagerForm = MANAGER_ROLES.includes(currentRole || "");

  const [formData, setFormData] = useState<Partial<GSTVendor>>(vendor || {
    id: crypto.randomUUID(),
    name: "",
    gstin: "",
    pan: "",
    state: "",
    stateCode: "",
    address: "",
    contactPerson: "",
    contactPhone: "",
    contactEmail: "",
    vendorType: "Both",
    supplyType: "Regular",
    paymentTerms: "",
    bankAccountNumber: "",
    ifscCode: "",
    gstinValidated: false,
    riskScore: 0,
    riskLevel: "Medium",
    filingStatus: "Unknown",
    createdBy: currentUser?.name || "User",
    createdAt: new Date().toISOString(),
    status: "Active",
    notes: "",
    // New fields
    legalEntityType: undefined,
    tdsApplicable: false,
    tdsDefaultSection: "",
    tdsDefaultRate: 0,
    tdsOverrides: [],
    gstCertificate: undefined,
    panCertificate: undefined,
    approvalStatus: undefined,
    // FIX 2: registration type drives GSTIN requirement
    registrationType: "Regular" as "Regular" | "Composition" | "URP" | "SEZ" | "Government",
  });

  const [gstinError, setGstinError] = useState("");
  const [gstinValid, setGstinValid] = useState(!!vendor?.gstinValidated);
  const [showTDSOverrideForm, setShowTDSOverrideForm] = useState(false);
  const [overrideForm, setOverrideForm] = useState({
    overrideRate: 0, tdsSection: formData.tdsDefaultSection || "",
    reason: "", certificateNumber: "", validFrom: "", validTill: "",
    supportingDocumentBase64: "", supportingDocumentName: "",
  });

  const handleGSTINBlur = () => {
    if (!formData.gstin) return;
    const validation = gstComplianceService.validateGSTIN(formData.gstin);
    if (validation.valid) {
      setGstinValid(true);
      setGstinError("");
      const riskScore = gstComplianceService.initVendorRisk(formData.gstin);
      setFormData(prev => ({
        ...prev,
        stateCode: validation.stateCode,
        gstinValidated: true,
        gstinValidatedOn: new Date().toISOString(),
        riskScore,
        riskLevel: riskScore > 70 ? "Critical" : riskScore > 50 ? "High" : riskScore > 30 ? "Medium" : "Clean"
      }));
    } else {
      setGstinValid(false);
      setGstinError(validation.error || "Invalid GSTIN");
    }
  };

  const handleEntityTypeChange = (entityType: LegalEntityType) => {
    const cfg = TDS_ENTITY_CONFIG.find(c => c.entityType === entityType);
    const section = formData.tdsDefaultSection || "194C";
    const rate = getTDSRate(entityType, section);
    setFormData(prev => ({
      ...prev,
      legalEntityType: entityType,
      tdsApplicable: cfg?.tdsApplicable ?? false,
      tdsDefaultRate: rate,
    }));
  };

  const handleSectionChange = (section: string) => {
    const rate = getTDSRate(formData.legalEntityType, section);
    setFormData(prev => ({ ...prev, tdsDefaultSection: section, tdsDefaultRate: rate }));
  };

  const handleDocumentUpload = (
    field: "gstCertificate" | "panCertificate",
    file: File
  ) => {
    const reader = new FileReader();
    reader.onload = () => {
      const doc: VendorDocument = {
        id: crypto.randomUUID(),
        type: field === "gstCertificate" ? "GST Certificate" : "PAN Certificate",
        fileName: file.name,
        fileBase64: (reader.result as string).split(",")[1] || "",
        uploadedBy: currentUser?.name || "User",
        uploadedAt: new Date().toISOString(),
        status: "Pending Verification",
      };
      setFormData(prev => ({ ...prev, [field]: doc }));
      toast.success(`${doc.type} uploaded — pending verification`);
    };
    reader.readAsDataURL(file);
  };

  const handleOverrideDocUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      setOverrideForm(prev => ({
        ...prev,
        supportingDocumentBase64: (reader.result as string).split(",")[1] || "",
        supportingDocumentName: file.name,
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleAddOverride = () => {
    if (!overrideForm.validFrom || !overrideForm.validTill || !overrideForm.certificateNumber) {
      toast.error("Valid From, Valid Till, and Certificate Number are required for TDS override.");
      return;
    }
    if (!overrideForm.supportingDocumentBase64) {
      toast.error("Please upload the supporting document (lower deduction certificate).");
      return;
    }
    const override: TDSOverride = {
      id: crypto.randomUUID(),
      overrideRate: overrideForm.overrideRate,
      tdsSection: overrideForm.tdsSection || formData.tdsDefaultSection || "N/A",
      reason: overrideForm.reason,
      certificateNumber: overrideForm.certificateNumber,
      supportingDocumentBase64: overrideForm.supportingDocumentBase64,
      supportingDocumentName: overrideForm.supportingDocumentName,
      validFrom: overrideForm.validFrom,
      validTill: overrideForm.validTill,
      createdBy: currentUser?.name || "User",
      createdAt: new Date().toISOString(),
      status: isManagerForm ? "Approved" : "Pending Approval",
    };
    setFormData(prev => ({ ...prev, tdsOverrides: [...(prev.tdsOverrides || []), override] }));
    setShowTDSOverrideForm(false);
    setOverrideForm({ overrideRate:0, tdsSection:"", reason:"", certificateNumber:"", validFrom:"", validTill:"", supportingDocumentBase64:"", supportingDocumentName:"" });
    toast.success(isManagerForm ? "TDS override added and approved." : "TDS override added — pending approval.");
  };

  // Get the active TDS rate for today considering overrides
  const getEffectiveTDSRate = () => {
    const today = new Date().toISOString().split("T")[0];
    const activeOverride = (formData.tdsOverrides || []).find(o =>
      o.status === "Approved" && o.validFrom <= today && o.validTill >= today
    );
    if (activeOverride) return { rate: activeOverride.overrideRate, source: `Override (${activeOverride.tdsSection}) · ${activeOverride.certificateNumber}` };
    return { rate: formData.tdsDefaultRate || 0, source: "Standard rate" };
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // FIX 2: GSTIN required only for Regular/SEZ/Government vendors
    const gstinRequired = ["Regular", "SEZ", "Government"].includes(formData.registrationType || "Regular");
    if (gstinRequired && !gstinValid) {
      toast.error("Please fix GSTIN validation errors");
      return;
    }
    if (!formData.gstCertificate) {
      toast.error("GST Certificate upload is mandatory.");
      return;
    }
    if (!formData.panCertificate) {
      toast.error("PAN Certificate upload is mandatory.");
      return;
    }
    if (!formData.legalEntityType) {
      toast.error("Legal entity type is mandatory.");
      return;
    }
    onSave(formData as GSTVendor);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-6">
      <div className="bg-white rounded-lg w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">
            {vendor ? "Edit Vendor" : "Add New Vendor"}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Vendor Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            {/* FIX 2: Registration Type determines if GSTIN is required */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Registration Type <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={formData.registrationType || "Regular"}
                onChange={e => setFormData(prev => ({ ...prev, registrationType: e.target.value as any }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="Regular">Regular Taxpayer (GSTIN required)</option>
                <option value="Composition">Composition Dealer (GSTIN required)</option>
                <option value="URP">URP — Unregistered Person (no GSTIN)</option>
                <option value="SEZ">SEZ Unit (GSTIN required)</option>
                <option value="Government">Government Body (GSTIN optional)</option>
              </select>
              {formData.registrationType === "URP" && (
                <p className="text-xs text-amber-700 mt-1 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                  URP: No input credit available. Reverse Charge Mechanism may apply.
                </p>
              )}
              {formData.registrationType === "Composition" && (
                <p className="text-xs text-blue-700 mt-1 bg-blue-50 border border-blue-200 rounded px-2 py-1">
                  Composition dealer: Input credit NOT claimable on purchases from this vendor.
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                GSTIN {["Regular","Composition","SEZ"].includes(formData.registrationType || "Regular")
                  ? <span className="text-red-500">*</span>
                  : <span className="text-gray-400 text-xs">(optional — {formData.registrationType})</span>}
              </label>
              <div className="relative">
                <input
                  type="text"
                  required={["Regular","Composition","SEZ"].includes(formData.registrationType || "Regular")}
                  value={formData.gstin}
                  onChange={e => setFormData(prev => ({ ...prev, gstin: e.target.value.toUpperCase() }))}
                  onBlur={handleGSTINBlur}
                  className={`w-full px-3 py-2 border rounded-lg text-sm pr-10 ${
                    gstinError ? "border-red-500" : gstinValid ? "border-green-500" : "border-gray-300"
                  }`}
                />
                {gstinValid && <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-green-600" />}
                {gstinError && <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-red-600" />}
              </div>
              {gstinError && <p className="text-xs text-red-600 mt-1">{gstinError}</p>}
              {gstinValid && (
                <p className="text-xs text-green-600 mt-1">
                  Risk Score initialized: {formData.riskScore} — {formData.riskLevel}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                PAN <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.pan}
                onChange={e => setFormData(prev => ({ ...prev, pan: e.target.value.toUpperCase() }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>

            {/* ── LEGAL ENTITY TYPE ─────────────────────────────────────── */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Legal Entity Type <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={formData.legalEntityType || ""}
                onChange={e => handleEntityTypeChange(e.target.value as LegalEntityType)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="">Select entity type</option>
                {LEGAL_ENTITY_TYPES.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              {formData.legalEntityType && (
                <p className="text-xs mt-1 text-gray-500">
                  {TDS_ENTITY_CONFIG.find(c => c.entityType === formData.legalEntityType)?.isCompany
                    ? "Company rate applies" : "Individual/Non-company rate applies"}
                  {" · TDS "}
                  {TDS_ENTITY_CONFIG.find(c => c.entityType === formData.legalEntityType)?.tdsApplicable
                    ? "applicable" : "not applicable"}
                </p>
              )}
            </div>

            {/* ── TDS SECTION & RATE (only if applicable) ──────────────── */}
            {formData.tdsApplicable && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Default TDS Section
                  </label>
                  <select
                    value={formData.tdsDefaultSection || ""}
                    onChange={e => handleSectionChange(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value="">Select section</option>
                    {TDS_SECTIONS.map(s => (
                      <option key={s.section} value={s.section}>{s.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Default TDS Rate (%)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="0.01"
                      value={formData.tdsDefaultRate || 0}
                      readOnly
                      className="w-full px-3 py-2 border border-gray-200 bg-gray-50 rounded-lg text-sm"
                    />
                    <span className="text-xs text-gray-400 whitespace-nowrap">Auto-calculated</span>
                  </div>
                  {(() => { const e = getEffectiveTDSRate(); return (
                    <p className="text-xs mt-1 font-medium text-blue-700">
                      Effective today: {e.rate}% · {e.source}
                    </p>
                  ); })()}
                </div>
              </>
            )}

            {/* ── MANDATORY DOCUMENTS ──────────────────────────────────── */}
            <div className="col-span-2 mt-2">
              <div className="flex items-center gap-2 mb-3">
                <Shield className="w-4 h-4 text-indigo-600" />
                <h3 className="font-semibold text-gray-800 text-sm">Mandatory Compliance Documents</h3>
                <span className="text-xs text-red-500">* Both required before saving</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {/* GST Certificate */}
                <div className={`border-2 rounded-lg p-3 ${formData.gstCertificate ? "border-green-400 bg-green-50" : "border-dashed border-red-300 bg-red-50"}`}>
                  <label className="block text-xs font-semibold text-gray-700 mb-2">
                    GST Registration Certificate <span className="text-red-500">*</span>
                  </label>
                  {formData.gstCertificate ? (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-green-600" />
                        <span className="text-xs text-green-700 font-medium">{formData.gstCertificate.fileName}</span>
                      </div>
                      <div className="flex gap-1">
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">✓ Uploaded</span>
                        <label className="cursor-pointer text-xs text-blue-600 hover:underline">
                          Replace
                          <input type="file" accept=".pdf,.jpg,.png" className="hidden"
                            onChange={e => e.target.files?.[0] && handleDocumentUpload("gstCertificate", e.target.files[0])} />
                        </label>
                      </div>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center gap-2 cursor-pointer py-2">
                      <Upload className="w-5 h-5 text-red-400" />
                      <span className="text-xs text-red-600">Click to upload GST certificate</span>
                      <span className="text-xs text-gray-400">PDF, JPG or PNG</span>
                      <input type="file" accept=".pdf,.jpg,.png" className="hidden"
                        onChange={e => e.target.files?.[0] && handleDocumentUpload("gstCertificate", e.target.files[0])} />
                    </label>
                  )}
                </div>

                {/* PAN Certificate */}
                <div className={`border-2 rounded-lg p-3 ${formData.panCertificate ? "border-green-400 bg-green-50" : "border-dashed border-red-300 bg-red-50"}`}>
                  <label className="block text-xs font-semibold text-gray-700 mb-2">
                    PAN Card Copy <span className="text-red-500">*</span>
                  </label>
                  {formData.panCertificate ? (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-green-600" />
                        <span className="text-xs text-green-700 font-medium">{formData.panCertificate.fileName}</span>
                      </div>
                      <div className="flex gap-1">
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">✓ Uploaded</span>
                        <label className="cursor-pointer text-xs text-blue-600 hover:underline">
                          Replace
                          <input type="file" accept=".pdf,.jpg,.png" className="hidden"
                            onChange={e => e.target.files?.[0] && handleDocumentUpload("panCertificate", e.target.files[0])} />
                        </label>
                      </div>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center gap-2 cursor-pointer py-2">
                      <Upload className="w-5 h-5 text-red-400" />
                      <span className="text-xs text-red-600">Click to upload PAN copy</span>
                      <span className="text-xs text-gray-400">PDF, JPG or PNG</span>
                      <input type="file" accept=".pdf,.jpg,.png" className="hidden"
                        onChange={e => e.target.files?.[0] && handleDocumentUpload("panCertificate", e.target.files[0])} />
                    </label>
                  )}
                </div>
              </div>
            </div>

            {/* ── TDS OVERRIDE SECTION ─────────────────────────────────── */}
            {formData.tdsApplicable && (
              <div className="col-span-2 mt-2">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-amber-600" />
                    <h3 className="font-semibold text-gray-800 text-sm">TDS Rate Overrides</h3>
                    <span className="text-xs text-gray-400">(e.g. Nil/lower deduction certificates)</span>
                  </div>
                  <button type="button" onClick={() => setShowTDSOverrideForm(true)}
                    className="text-xs px-3 py-1 bg-amber-600 text-white rounded hover:bg-amber-700">
                    + Add Override
                  </button>
                </div>

                {/* Existing overrides */}
                {(formData.tdsOverrides || []).length > 0 && (
                  <div className="space-y-2 mb-3">
                    {(formData.tdsOverrides || []).map(ov => {
                      const today = new Date().toISOString().split("T")[0];
                      const isActive = ov.status === "Approved" && ov.validFrom <= today && ov.validTill >= today;
                      return (
                        <div key={ov.id}
                          className={`p-3 rounded-lg border text-xs ${isActive ? "bg-green-50 border-green-300" : "bg-gray-50 border-gray-200"}`}>
                          <div className="flex items-center justify-between">
                            <div className="space-y-1">
                              <div className="flex items-center gap-3">
                                <span className="font-semibold">{ov.tdsSection} — {ov.overrideRate}% (override)</span>
                                {isActive && <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded font-medium">ACTIVE NOW</span>}
                                <span className={`px-2 py-0.5 rounded ${ov.status === "Approved" ? "bg-green-100 text-green-700" : ov.status === "Pending Approval" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>
                                  {ov.status}
                                </span>
                              </div>
                              <div className="text-gray-500">
                                Cert: {ov.certificateNumber} · {ov.reason}
                              </div>
                              <div className="text-gray-400 flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                Valid: {new Date(ov.validFrom).toLocaleDateString("en-IN")} to {new Date(ov.validTill).toLocaleDateString("en-IN")}
                              </div>
                              {ov.supportingDocumentName && (
                                <div className="text-blue-600 flex items-center gap-1">
                                  <FileText className="w-3 h-3" />
                                  {ov.supportingDocumentName}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Override form */}
                {showTDSOverrideForm && (
                  <div className="border-2 border-amber-300 bg-amber-50 rounded-lg p-4 space-y-3">
                    <h4 className="font-semibold text-amber-900 text-sm">Add TDS Rate Override</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">TDS Section</label>
                        <select value={overrideForm.tdsSection}
                          onChange={e => setOverrideForm(p=>({...p,tdsSection:e.target.value}))}
                          className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm">
                          <option value="">Select section</option>
                          {TDS_SECTIONS.map(s=><option key={s.section} value={s.section}>{s.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Override Rate (%)</label>
                        <input type="number" step="0.01" min="0" max="100"
                          value={overrideForm.overrideRate}
                          onChange={e=>setOverrideForm(p=>({...p,overrideRate:parseFloat(e.target.value)||0}))}
                          className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Valid From <span className="text-red-500">*</span></label>
                        <input type="date" value={overrideForm.validFrom}
                          onChange={e=>setOverrideForm(p=>({...p,validFrom:e.target.value}))}
                          className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Valid Till <span className="text-red-500">*</span></label>
                        <input type="date" value={overrideForm.validTill}
                          onChange={e=>setOverrideForm(p=>({...p,validTill:e.target.value}))}
                          className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Certificate Number <span className="text-red-500">*</span></label>
                        <input type="text" value={overrideForm.certificateNumber}
                          onChange={e=>setOverrideForm(p=>({...p,certificateNumber:e.target.value}))}
                          placeholder="e.g. NIL/CERT/2025-26/001"
                          className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Reason</label>
                        <input type="text" value={overrideForm.reason}
                          onChange={e=>setOverrideForm(p=>({...p,reason:e.target.value}))}
                          placeholder="e.g. Lower deduction certificate u/s 197"
                          className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Supporting Document <span className="text-red-500">*</span>
                          <span className="ml-1 text-gray-400 font-normal">(Lower deduction certificate, Form 13, etc.)</span>
                        </label>
                        {overrideForm.supportingDocumentName ? (
                          <div className="flex items-center gap-2 p-2 bg-green-50 border border-green-300 rounded">
                            <FileText className="w-4 h-4 text-green-600" />
                            <span className="text-sm text-green-700">{overrideForm.supportingDocumentName}</span>
                            <label className="ml-auto text-xs text-blue-600 cursor-pointer hover:underline">
                              Replace
                              <input type="file" accept=".pdf,.jpg,.png" className="hidden" onChange={e=>e.target.files?.[0] && handleOverrideDocUpload(e.target.files[0])} />
                            </label>
                          </div>
                        ) : (
                          <label className="flex items-center gap-2 px-3 py-2 border-dashed border-2 border-amber-300 rounded cursor-pointer hover:bg-amber-50">
                            <Upload className="w-4 h-4 text-amber-600" />
                            <span className="text-sm text-amber-700">Upload supporting document</span>
                            <input type="file" accept=".pdf,.jpg,.png" className="hidden" onChange={e=>e.target.files?.[0] && handleOverrideDocUpload(e.target.files[0])} />
                          </label>
                        )}
                      </div>
                    </div>
                    {!isManagerForm && (
                      <p className="text-xs text-amber-700 bg-amber-100 px-3 py-2 rounded">
                        ⚠ This override will require manager approval before it takes effect.
                      </p>
                    )}
                    <div className="flex gap-2 justify-end">
                      <button type="button" onClick={()=>setShowTDSOverrideForm(false)}
                        className="px-3 py-1.5 border border-gray-300 text-sm rounded hover:bg-gray-50">Cancel</button>
                      <button type="button" onClick={handleAddOverride}
                        className="px-4 py-1.5 bg-amber-600 text-white text-sm rounded hover:bg-amber-700">
                        Add Override
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                State <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={formData.stateCode}
                onChange={e => setFormData(prev => ({ ...prev, stateCode: e.target.value, state: GST_STATES[e.target.value] || "" }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="">Select state</option>
                {GST_STATE_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Address <span className="text-red-500">*</span>
              </label>
              <textarea
                required
                value={formData.address}
                onChange={e => setFormData(prev => ({ ...prev, address: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                rows={2}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contact Person</label>
              <input
                type="text"
                value={formData.contactPerson}
                onChange={e => setFormData(prev => ({ ...prev, contactPerson: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contact Phone</label>
              <input
                type="tel"
                value={formData.contactPhone}
                onChange={e => setFormData(prev => ({ ...prev, contactPhone: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Contact Email</label>
              <input
                type="email"
                value={formData.contactEmail}
                onChange={e => setFormData(prev => ({ ...prev, contactEmail: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Vendor Type</label>
              <select
                value={formData.vendorType}
                onChange={e => setFormData(prev => ({ ...prev, vendorType: e.target.value as any }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="GSTRegistered">GST Registered</option>
                <option value="NonRegistered">Non-Registered</option>
                <option value="SEZ">SEZ</option>
                <option value="Import">Import</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Supply Type</label>
              <select
                value={formData.supplyType}
                onChange={e => setFormData(prev => ({ ...prev, supplyType: e.target.value as any }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="Regular">Regular</option>
                <option value="RCM">RCM</option>
                <option value="SEZ">SEZ</option>
                <option value="Deemed Export">Deemed Export</option>
              </select>
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea
                value={formData.notes}
                onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                rows={2}
              />
            </div>
          </div>

          <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4 mt-4">
            {!isManagerForm && (
              <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-2">
                <Clock className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-blue-800">This submission will require manager approval</p>
                  <p className="text-xs text-blue-600">The vendor will remain Inactive until an Accounts Manager reviews and approves all documents.</p>
                </div>
              </div>
            )}
            <div className="flex items-center justify-end gap-3">
              <button type="button" onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm">
                Cancel
              </button>
              <button type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
                {vendor ? "Update Vendor" : isManagerForm ? "Save & Approve" : "Submit for Approval"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function VendorDetail({ vendor, onEdit, onClose, onUpdate }: {
  vendor: GSTVendor;
  onEdit: () => void;
  onClose: () => void;
  onUpdate: (v: GSTVendor) => void;
}) {
  const handleStatusChange = (status: "Active" | "Inactive" | "Blacklisted") => {
    onUpdate({ ...vendor, status });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-6">
      <div className="bg-white rounded-lg w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">Vendor Details</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            <div>
              <label className="text-sm text-gray-600">Vendor Name</label>
              <p className="font-medium text-gray-900">{vendor.name}</p>
            </div>
            <div>
              <label className="text-sm text-gray-600">GSTIN</label>
              <p className="font-mono text-sm text-gray-900">{vendor.gstin}</p>
            </div>
            <div>
              <label className="text-sm text-gray-600">PAN</label>
              <p className="font-mono text-sm text-gray-900">{vendor.pan}</p>
            </div>
            <div>
              <label className="text-sm text-gray-600">State</label>
              <p className="text-gray-900">{vendor.state} ({vendor.stateCode})</p>
            </div>
            <div className="col-span-2">
              <label className="text-sm text-gray-600">Address</label>
              <p className="text-gray-900">{vendor.address}</p>
            </div>
            <div>
              <label className="text-sm text-gray-600">Risk Score</label>
              <p className="font-semibold text-gray-900">{vendor.riskScore} ({vendor.riskLevel})</p>
            </div>
            <div>
              <label className="text-sm text-gray-600">Filing Status</label>
              <p className="text-gray-900">{vendor.filingStatus}</p>
            </div>
          </div>

          {/* Linked transactions */}
          {(() => {
            const linked = gstComplianceService.getTransactions()
              .filter(t => t.partyId === vendor.id);
            if (linked.length === 0) return (
              <div className="text-sm text-gray-500 italic">No transactions found for this vendor.</div>
            );
            const totalTaxable = linked.reduce((s, t) => s + t.taxableValue, 0);
            const totalITC     = linked.filter(t => t.itcEligible).reduce((s, t) => s + t.itcAmount, 0);
            return (
              <div className="mt-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-2">
                  Linked Transactions ({linked.length}) — Total Taxable: ₹{totalTaxable.toLocaleString()} | ITC Claimed: ₹{totalITC.toLocaleString()}
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="text-left p-2 border border-gray-200">Invoice No.</th>
                        <th className="text-left p-2 border border-gray-200">Date</th>
                        <th className="text-right p-2 border border-gray-200">Taxable (₹)</th>
                        <th className="text-right p-2 border border-gray-200">GST (₹)</th>
                        <th className="text-left p-2 border border-gray-200">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {linked.slice(0, 10).map(t => (
                        <tr key={t.id} className="border-b border-gray-100">
                          <td className="p-2 font-mono">{t.invoiceNumber}</td>
                          <td className="p-2">{t.invoiceDate}</td>
                          <td className="p-2 text-right">{(t?.taxableValue ?? 0).toLocaleString()}</td>
                          <td className="p-2 text-right">{(t?.totalTax ?? 0).toLocaleString()}</td>
                          <td className="p-2">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                              t.status === "Filed" ? "bg-purple-100 text-purple-700"
                              : t.status === "Approved" ? "bg-green-100 text-green-700"
                              : "bg-gray-100 text-gray-600"
                            }`}>{t.status}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {linked.length > 10 && (
                    <p className="text-xs text-gray-500 mt-1">Showing 10 of {linked.length} transactions.</p>
                  )}
                </div>
              </div>
            );
          })()}

          <div className="flex justify-between items-center pt-4 border-t">
            <div className="flex gap-2">
              <button
                onClick={() => handleStatusChange("Blacklisted")}
                className="flex items-center gap-2 px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 text-sm"
              >
                <Ban className="w-4 h-4" />
                Blacklist
              </button>
              <button
                onClick={() => handleStatusChange("Active")}
                className="flex items-center gap-2 px-4 py-2 border border-green-300 text-green-600 rounded-lg hover:bg-green-50 text-sm"
              >
                <CheckCircle className="w-4 h-4" />
                Reactivate
              </button>
            </div>
            <button
              onClick={onEdit}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
            >
              <Edit2 className="w-4 h-4" />
              Edit
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
