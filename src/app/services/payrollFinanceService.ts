/**
 * Payroll Finance Service
 * FLOW 5: Payroll Processing → Finance Payables
 *
 * CRITICAL: Finance reads payables from HRDataContext
 * No duplicate payables - one payable per payroll run
 * Payment status synced between Finance and HR
 */

import type { PayrollRun } from "../contexts/HRDataContext";
import type { Payable } from "../contexts/FinanceContext";

export interface PayrollProcessingResult {
  success: boolean;
  payroll?: PayrollRun;
  payable?: Payable;
  error?: string;
}

export interface PaymentSyncResult {
  success: boolean;
  payrollUpdated: boolean;
  payableUpdated: boolean;
  error?: string;
}

/**
 * FLOW 5: PAYROLL → FINANCE
 *
 * When HR processes payroll:
 * 1. Store PayrollRun in HRDataContext
 * 2. Create Salary Payable in FinanceContext
 * 3. Link via payrollId and employeeId
 * 4. Status sync: Paid in Finance → Paid in HR
 *
 * When Finance marks payable as paid:
 * 1. Update Payable.status = "Paid"
 * 2. Update PayrollRun.status = "Paid"
 * 3. Record payment reference in both
 *
 * CRITICAL RULES:
 * - Finance displays payables from FinanceContext
 * - Finance reads payroll details from HRDataContext (via payrollId)
 * - Payment status must be synced bidirectionally
 * - No duplicate payables per payroll run
 */
export class PayrollFinanceService {
  /**
   * Process payroll and create corresponding payable
   */
  static processPayroll(
    payrollData: Omit<PayrollRun, "payrollId" | "createdAt" | "updatedAt">,
    contexts: {
      processPayroll: (payroll: Omit<PayrollRun, "payrollId" | "createdAt" | "updatedAt">) => PayrollRun;
      createPayable: (payable: Omit<Payable, "payableId" | "createdAt" | "updatedAt">) => Payable;
      getEmployeeById: (employeeId: string) => any;
      emit: (event: string, data: any, source?: string) => void;
    }
  ): PayrollProcessingResult {
    try {
      // Step 1: Create PayrollRun in HRDataContext
      const payrollRun = contexts.processPayroll(payrollData);

      console.log(
        `[PAYROLL_PROCESSING] Payroll created: ${payrollRun.payrollId} for employee ${payrollRun.employeeId}, Net: ₹${payrollRun.netSalary}`
      );

      // Step 2: Get employee details for payable description
      const employee = contexts.getEmployeeById(payrollData.employeeId);
      const employeeName = employee
        ? `${employee.firstName} ${employee.lastName}`
        : payrollData.employeeId;

      // Get cityId from employee for multi-city isolation
      const cityId = employee?.cityId || payrollData.cityId || "CITY-SURAT";

      // Step 3: Create Salary Payable in FinanceContext
      const payable = contexts.createPayable({
        type: "Salary",
        employeeId: payrollRun.employeeId,
        payrollId: payrollRun.payrollId,
        amount: payrollRun.netSalary,
        dueDate: payrollRun.period.endDate,
        status: "Pending",
        description: `Salary for ${employeeName} (${payrollRun.month})`,
        cityId, // ✅ Multi-city isolation
      });

      console.log(
        `[PAYROLL_PROCESSING] Salary payable created: ${payable.payableId} for ₹${payable.amount}`
      );

      // Step 3b: Post journal entry -- Dr Salary Expense / Cr Salary Payable
      try {
        const { accountingEntryService } = await import("./accountingEntryService");
        const ledgers = accountingEntryService.getLedgers(cityId);
        const salaryExpLedger = ledgers.find(l => l.accountHead === "indirect_expenses" && l.name.toLowerCase().includes("salary"));
        const salaryPayLedger = ledgers.find(l => l.accountHead === "accounts_payable" && l.name.toLowerCase().includes("salary"));
        if (salaryExpLedger && salaryPayLedger) {
          accountingEntryService.saveJournalEntry({
            date: new Date().toISOString().split("T")[0],
            narration: "Salary payable for " + employeeName + " (" + payrollData.month + ")",
            lines: [
              { accountHead: salaryExpLedger.id, accountLabel: salaryExpLedger.name, debit: payrollRun.netSalary, credit: 0 },
              { accountHead: salaryPayLedger.id, accountLabel: salaryPayLedger.name, debit: 0, credit: payrollRun.netSalary },
            ],
            city: cityId,
            cityId,
            createdBy: "Payroll Engine",
          });
        }
      } catch (e) {
        console.warn("[PAYROLL] Journal entry skipped -- ledgers not found", e);
      }

      // Step 4: Emit PAYROLL_PROCESSED event
      contexts.emit(
        "PAYROLL_PROCESSED",
        {
          payrollId: payrollRun.payrollId,
          employeeId: payrollRun.employeeId,
          employeeName,
          month: payrollRun.month,
          grossSalary: payrollRun.grossSalary,
          netSalary: payrollRun.netSalary,
          deductions: payrollRun.totalDeductions,
          payableId: payable.payableId,
          status: payrollRun.status,
        },
        "PayrollFinanceService"
      );

      return {
        success: true,
        payroll: payrollRun,
        payable,
      };
    } catch (error) {
      console.error("[PAYROLL_PROCESSING] Error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Sync payment from Finance to HR
   * When Finance marks payable as paid, update payroll status
   */
  static syncPaymentToHR(
    payableId: string,
    paymentReference: string,
    paymentMethod: string,
    contexts: {
      payables: Payable[];
      markAsPaid: (
        payableId: string,
        paymentReference: string,
        paymentMethod: Payable["paymentMethod"]
      ) => void;
      markPayrollAsPaid: (payrollId: string, paymentReference: string) => void;
      emit: (event: string, data: any, source?: string) => void;
    }
  ): PaymentSyncResult {
    try {
      // Find the payable
      const payable = contexts.payables.find((p) => p.payableId === payableId);
      if (!payable) {
        return {
          success: false,
          payrollUpdated: false,
          payableUpdated: false,
          error: "Payable not found",
        };
      }

      if (payable.type !== "Salary") {
        return {
          success: false,
          payrollUpdated: false,
          payableUpdated: false,
          error: "Payable is not a salary payable",
        };
      }

      if (!payable.payrollId) {
        return {
          success: false,
          payrollUpdated: false,
          payableUpdated: false,
          error: "Payable is not linked to a payroll run",
        };
      }

      // Step 1: Mark payable as paid in FinanceContext
      contexts.markAsPaid(payableId, paymentReference, paymentMethod as Payable["paymentMethod"]);
      console.log(`[PAYMENT_SYNC] Payable ${payableId} marked as paid`);

      // Step 2: Mark payroll as paid in HRDataContext
      contexts.markPayrollAsPaid(payable.payrollId, paymentReference);
      console.log(`[PAYMENT_SYNC] Payroll ${payable.payrollId} marked as paid`);

      // Step 3: Emit PAYMENT_PROCESSED event
      contexts.emit(
        "PAYMENT_PROCESSED",
        {
          payableId,
          payrollId: payable.payrollId,
          employeeId: payable.employeeId,
          amount: payable.amount,
          paymentReference,
          paymentMethod,
          paidAt: new Date().toISOString(),
        },
        "PayrollFinanceService"
      );

      return {
        success: true,
        payrollUpdated: true,
        payableUpdated: true,
      };
    } catch (error) {
      console.error("[PAYMENT_SYNC] Error:", error);
      return {
        success: false,
        payrollUpdated: false,
        payableUpdated: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Get salary payables with payroll details
   * Finance module calls this to display payables with employee info
   */
  static getSalaryPayablesWithDetails(contexts: {
    getSalaryPayables: () => Payable[];
    payrollRuns: PayrollRun[];
    employees: any[];
  }): Array<
    Payable & {
      employeeName?: string;
      grossSalary?: number;
      deductions?: number;
      payrollMonth?: string;
      payrollStatus?: string;
    }
  > {
    const salaryPayables = contexts.getSalaryPayables();

    return salaryPayables.map((payable) => {
      // Find linked payroll run
      const payroll = payable.payrollId
        ? contexts.payrollRuns.find((pr) => pr.payrollId === payable.payrollId)
        : undefined;

      // Find employee
      const employee = payable.employeeId
        ? contexts.employees.find((e: any) => e.employeeId === payable.employeeId)
        : undefined;

      return {
        ...payable,
        employeeName: employee ? `${employee.firstName} ${employee.lastName}` : undefined,
        grossSalary: payroll?.grossSalary,
        deductions: payroll?.totalDeductions,
        payrollMonth: payroll?.month,
        payrollStatus: payroll?.status,
      };
    });
  }

  /**
   * Get pending salary payables
   */
  static getPendingSalaryPayables(contexts: {
    getSalaryPayables: () => Payable[];
  }): Payable[] {
    return contexts
      .getSalaryPayables()
      .filter((p) => p.status === "Pending" || p.status === "Approved");
  }

  /**
   * Approve payroll by HR
   */
  static approvePayrollByHR(
    payrollId: string,
    approvedBy: string,
    contexts: {
      approvePayrollByHR: (payrollId: string, approvedBy: string) => void;
      payables: Payable[];
      approvePayable: (payableId: string, approvedBy: string) => void;
      emit: (event: string, data: any, source?: string) => void;
    }
  ): { success: boolean; error?: string } {
    try {
      // Approve payroll in HR
      contexts.approvePayrollByHR(payrollId, approvedBy);

      // Find and approve corresponding payable
      const payable = contexts.payables.find((p) => p.payrollId === payrollId);
      if (payable && payable.status === "Pending") {
        contexts.approvePayable(payable.payableId, approvedBy);
      }

      console.log(`[PAYROLL_APPROVAL] Payroll ${payrollId} approved by HR: ${approvedBy}`);

      contexts.emit(
        "PAYROLL_APPROVED_BY_HR",
        {
          payrollId,
          approvedBy,
          approvedAt: new Date().toISOString(),
        },
        "PayrollFinanceService"
      );

      return { success: true };
    } catch (error) {
      console.error("[PAYROLL_APPROVAL] Error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Approve payroll by Finance
   */
  static approvePayrollByFinance(
    payrollId: string,
    approvedBy: string,
    contexts: {
      approvePayrollByFinance: (payrollId: string, approvedBy: string) => void;
      emit: (event: string, data: any, source?: string) => void;
    }
  ): { success: boolean; error?: string } {
    try {
      contexts.approvePayrollByFinance(payrollId, approvedBy);

      console.log(`[PAYROLL_APPROVAL] Payroll ${payrollId} approved by Finance: ${approvedBy}`);

      contexts.emit(
        "PAYROLL_APPROVED_BY_FINANCE",
        {
          payrollId,
          approvedBy,
          approvedAt: new Date().toISOString(),
        },
        "PayrollFinanceService"
      );

      return { success: true };
    } catch (error) {
      console.error("[PAYROLL_APPROVAL] Error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Get payroll summary for Finance dashboard
   */
  static getPayrollSummary(
    month: string,
    contexts: {
      getPayrollForMonth: (month: string) => PayrollRun[];
    }
  ): {
    month: string;
    totalEmployees: number;
    totalGrossSalary: number;
    totalDeductions: number;
    totalNetSalary: number;
    pendingApprovals: number;
    paidCount: number;
    unpaidCount: number;
  } {
    const payrolls = contexts.getPayrollForMonth(month);

    return {
      month,
      totalEmployees: payrolls.length,
      totalGrossSalary: payrolls.reduce((sum, pr) => sum + pr.grossSalary, 0),
      totalDeductions: payrolls.reduce((sum, pr) => sum + pr.totalDeductions, 0),
      totalNetSalary: payrolls.reduce((sum, pr) => sum + pr.netSalary, 0),
      pendingApprovals: payrolls.filter((pr) => pr.status === "Draft" || pr.status === "HR Approved")
        .length,
      paidCount: payrolls.filter((pr) => pr.status === "Paid").length,
      unpaidCount: payrolls.filter((pr) => pr.status !== "Paid").length,
    };
  }
}
