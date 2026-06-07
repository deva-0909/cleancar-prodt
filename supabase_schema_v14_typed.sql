-- ============================================================
-- CleanCar 360 ERP — Supabase Schema v14
-- Replaces opaque JSONB columns with typed columns
-- for all finance and GST tables
-- Run AFTER v13 schema is already applied
-- ============================================================

-- ── GST Vendors (typed) ──────────────────────────────────────
create table if not exists gst_vendors_v2 (
  id                  text primary key,
  city_id             text not null default 'CITY-SURAT',
  name                text not null,
  gstin               text,
  pan                 text,
  state               text,
  state_code          text,
  address             text,
  contact_person      text,
  contact_phone       text,
  contact_email       text,
  vendor_type         text check (vendor_type in ('Goods','Services','Both')),
  supply_type         text check (supply_type in ('Regular','RCM','SEZ','Deemed Export')),
  registration_type   text check (registration_type in ('Regular','Composition','URP','SEZ','Government')),
  payment_terms       text,
  bank_account_number text,
  ifsc_code           text,
  gstin_validated     boolean default false,
  gstin_validated_on  date,
  risk_score          integer default 0,
  risk_level          text check (risk_level in ('Clean','Medium','High','Critical')),
  filing_status       text check (filing_status in ('Regular Filer','Non-Filer','Irregular','Unknown')),
  last_filed_month    text,
  legal_entity_type   text,
  tds_applicable      boolean default false,
  tds_default_section text,
  tds_default_rate    numeric(5,2),
  approval_status     text check (approval_status in ('Pending','Approved','Rejected')),
  status              text check (status in ('Active','Inactive','Blacklisted')) default 'Active',
  notes               text,
  created_by          text,
  created_at          timestamptz default now(),
  approved_by         text,
  approved_at         timestamptz
);

-- ── GST Customers (typed) ────────────────────────────────────
create table if not exists gst_customers_v2 (
  id                  text primary key,
  city_id             text not null default 'CITY-SURAT',
  name                text not null,
  gstin               text,
  pan                 text,
  state               text,
  state_code          text,
  address             text,
  contact_person      text,
  contact_phone       text,
  contact_email       text,
  customer_type       text check (customer_type in ('B2B','B2C','B2CL','EXPORT')),
  registration_type   text check (registration_type in ('Regular','Composition','SEZ','Unregistered')),
  credit_limit        numeric(12,2) default 0,
  credit_days         integer default 0,
  status              text check (status in ('Active','Inactive')) default 'Active',
  created_by          text,
  created_at          timestamptz default now()
);

-- ── GST Transactions (typed) ─────────────────────────────────
create table if not exists gst_transactions_v2 (
  id                  text primary key,
  city_id             text not null default 'CITY-SURAT',
  invoice_number      text not null,
  invoice_date        date not null,
  month               integer not null check (month between 1 and 12),
  year                integer not null,
  transaction_type    text not null check (transaction_type in ('Sale','Purchase','Credit Note','Debit Note')),
  sub_type            text,
  party_name          text,
  party_gstin         text,
  party_state         text,
  place_of_supply     text,
  supply_type         text check (supply_type in ('INTRA_STATE','INTER_STATE','EXPORT','RCM_INTRA','RCM_INTER')),
  supply_nature       text check (supply_nature in ('Taxable','ZeroRated','NilRated','Exempt','NonGST')),
  gst_type            text check (gst_type in ('B2B','B2C','B2CL','EXPORT')),
  hsn_sac_code        text,
  description         text,
  quantity            numeric(10,3) default 1,
  taxable_value       numeric(14,2) not null default 0,
  gst_rate            numeric(5,2) not null default 0,
  cgst                numeric(14,2) not null default 0,
  sgst                numeric(14,2) not null default 0,
  igst                numeric(14,2) not null default 0,
  total_tax           numeric(14,2) not null default 0,
  invoice_total       numeric(14,2) not null default 0,
  itc_eligible        boolean default false,
  itc_amount          numeric(14,2) default 0,
  reverse_charge      boolean default false,
  risk_score          integer default 0,
  risk_level          text check (risk_level in ('Clean','Medium','High','Critical')) default 'Clean',
  status              text check (status in ('Draft','Validated','Flagged','Approved','Filed')) default 'Draft',
  filed_in_return     text,
  gstr1_generated_at  timestamptz,
  validation_errors   text[] default '{}',
  created_by          text,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

-- ── Finance Ledger Entries (typed) ───────────────────────────
create table if not exists finance_ledger_v2 (
  id                  text primary key,
  city_id             text not null default 'CITY-SURAT',
  voucher_number      text not null,
  entry_type          text not null check (entry_type in ('Expense','Purchase','PurchaseReturn','Sales','SalesReturn','AssetPurchase')),
  entry_date          date not null,
  vendor_id           text,
  vendor_name         text,
  vendor_gstin        text,
  vendor_state_code   text,
  invoice_number      text,
  hsn_sac_code        text,
  expense_account     text,
  expense_account_label text,
  taxable_value       numeric(14,2) not null default 0,
  gst_rate            numeric(5,2) not null default 0,
  gst_entry_type      text check (gst_entry_type in ('B2B','Unregistered','RCM','NonGST')),
  cgst                numeric(14,2) not null default 0,
  sgst                numeric(14,2) not null default 0,
  igst                numeric(14,2) not null default 0,
  total_bill_value    numeric(14,2) not null default 0,
  payment_mode        text check (payment_mode in ('Bank','Cash','PettyCash')),
  petty_cash_branch   text,
  is_rcm              boolean default false,
  rcm_cgst            numeric(14,2) default 0,
  rcm_sgst            numeric(14,2) default 0,
  rcm_igst            numeric(14,2) default 0,
  debit_account       text,
  credit_account      text,
  narration           text,
  financial_year      text,
  created_by          text,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now(),
  status              text check (status in ('Draft','Posted','Cancelled')) default 'Draft'
);

-- ── Finance Revenues (typed) ─────────────────────────────────
create table if not exists finance_revenues_v2 (
  id                  text primary key,
  city_id             text not null default 'CITY-SURAT',
  customer_id         text not null,
  subscription_id     text,
  job_id              text,
  revenue_type        text check (revenue_type in ('Subscription','One-Time','Add-on')),
  amount              numeric(14,2) not null default 0,
  received_date       date not null,
  payment_method      text check (payment_method in ('UPI','Card','Bank Transfer','Cash')),
  invoice_number      text,
  status              text check (status in ('Received','Pending','Failed')) default 'Received',
  customer_name       text,
  package_name        text,
  source              text,
  created_at          timestamptz default now()
);

-- ── Finance Payables (typed) ─────────────────────────────────
create table if not exists finance_payables_v2 (
  id                  text primary key,
  city_id             text not null default 'CITY-SURAT',
  payable_type        text check (payable_type in ('Salary','Vendor','Statutory')),
  employee_id         text,
  payroll_id          text,
  vendor_id           text,
  vendor_name         text,
  invoice_number      text,
  statutory_type      text check (statutory_type in ('PF','ESIC','TDS','GST','PT')),
  amount              numeric(14,2) not null default 0,
  due_date            date,
  status              text check (status in ('Pending','Approved','Paid','Overdue')) default 'Pending',
  description         text,
  paid_at             timestamptz,
  payment_reference   text,
  payment_method      text check (payment_method in ('Bank Transfer','UPI','Cash','Cheque')),
  approved_by         text,
  approved_at         timestamptz,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

-- ── Indexes ──────────────────────────────────────────────────
create index if not exists idx_gst_txn_v2_city    on gst_transactions_v2(city_id);
create index if not exists idx_gst_txn_v2_month   on gst_transactions_v2(month, year);
create index if not exists idx_gst_txn_v2_status  on gst_transactions_v2(status);
create index if not exists idx_gst_txn_v2_type    on gst_transactions_v2(transaction_type);
create index if not exists idx_gst_ven_v2_gstin   on gst_vendors_v2(gstin);
create index if not exists idx_gst_ven_v2_city    on gst_vendors_v2(city_id);
create index if not exists idx_fin_led_v2_city    on finance_ledger_v2(city_id);
create index if not exists idx_fin_led_v2_date    on finance_ledger_v2(entry_date);
create index if not exists idx_fin_led_v2_type    on finance_ledger_v2(entry_type);
create index if not exists idx_fin_rev_v2_city    on finance_revenues_v2(city_id);
create index if not exists idx_fin_pay_v2_city    on finance_payables_v2(city_id);
create index if not exists idx_fin_pay_v2_status  on finance_payables_v2(status);

-- ── Auto updated_at triggers ─────────────────────────────────
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists t_upd_gst_txn_v2   on gst_transactions_v2;
create trigger t_upd_gst_txn_v2
  before update on gst_transactions_v2
  for each row execute function update_updated_at();

drop trigger if exists t_upd_fin_led_v2   on finance_ledger_v2;
create trigger t_upd_fin_led_v2
  before update on finance_ledger_v2
  for each row execute function update_updated_at();

drop trigger if exists t_upd_fin_pay_v2   on finance_payables_v2;
create trigger t_upd_fin_pay_v2
  before update on finance_payables_v2
  for each row execute function update_updated_at();

-- ── JSONB migration helpers ───────────────────────────────────
-- Run these after schema is created to copy existing JSONB data
-- into the new typed tables

insert into gst_vendors_v2 (
  id, city_id, name, gstin, pan, state, state_code, address,
  contact_person, contact_phone, contact_email, vendor_type,
  supply_type, payment_terms, bank_account_number, ifsc_code,
  gstin_validated, risk_score, risk_level, filing_status,
  legal_entity_type, tds_applicable, approval_status, status,
  notes, created_by, created_at
)
select
  id,
  coalesce(data->>'cityId', 'CITY-SURAT'),
  data->>'name',
  data->>'gstin',
  data->>'pan',
  data->>'state',
  data->>'stateCode',
  data->>'address',
  data->>'contactPerson',
  data->>'contactPhone',
  data->>'contactEmail',
  data->>'vendorType',
  data->>'supplyType',
  data->>'paymentTerms',
  data->>'bankAccountNumber',
  data->>'ifscCode',
  (data->>'gstinValidated')::boolean,
  (data->>'riskScore')::integer,
  data->>'riskLevel',
  data->>'filingStatus',
  data->>'legalEntityType',
  (data->>'tdsApplicable')::boolean,
  data->>'approvalStatus',
  coalesce(data->>'status', 'Active'),
  data->>'notes',
  data->>'createdBy',
  coalesce((data->>'createdAt')::timestamptz, now())
from gst_vendors
on conflict (id) do nothing;

insert into gst_transactions_v2 (
  id, city_id, invoice_number, invoice_date, month, year,
  transaction_type, sub_type, party_name, party_gstin,
  party_state, place_of_supply, supply_type, supply_nature,
  gst_type, hsn_sac_code, description, quantity,
  taxable_value, gst_rate, cgst, sgst, igst,
  total_tax, invoice_total, itc_eligible, itc_amount,
  reverse_charge, risk_score, risk_level, status,
  filed_in_return, created_by, created_at
)
select
  id,
  coalesce(city_id, 'CITY-SURAT'),
  data->>'invoiceNumber',
  (data->>'invoiceDate')::date,
  coalesce((data->>'month')::integer, extract(month from (data->>'invoiceDate')::date)::integer),
  coalesce((data->>'year')::integer,  extract(year  from (data->>'invoiceDate')::date)::integer),
  data->>'transactionType',
  data->>'subType',
  data->>'partyName',
  data->>'partyGstin',
  data->>'partyState',
  data->>'placeOfSupply',
  data->>'supplyType',
  data->>'supplyNature',
  data->>'gstType',
  data->>'hsnSacCode',
  data->>'description',
  coalesce((data->>'quantity')::numeric, 1),
  coalesce((data->>'taxableValue')::numeric, 0),
  coalesce((data->>'gstRate')::numeric, 0),
  coalesce((data->>'cgst')::numeric, 0),
  coalesce((data->>'sgst')::numeric, 0),
  coalesce((data->>'igst')::numeric, 0),
  coalesce((data->>'totalTax')::numeric, 0),
  coalesce((data->>'invoiceTotal')::numeric, 0),
  coalesce((data->>'itcEligible')::boolean, false),
  coalesce((data->>'itcAmount')::numeric, 0),
  coalesce((data->>'reverseCharge')::boolean, false),
  coalesce((data->>'riskScore')::integer, 0),
  coalesce(data->>'riskLevel', 'Clean'),
  coalesce(data->>'status', 'Draft'),
  data->>'filedInReturn',
  data->>'createdBy',
  coalesce((data->>'createdAt')::timestamptz, now())
from gst_transactions
on conflict (id) do nothing;

-- ── Comment ───────────────────────────────────────────────────
-- After verifying data in v2 tables:
-- 1. Update app services to read/write v2 tables
-- 2. Drop old JSONB tables once migration is confirmed