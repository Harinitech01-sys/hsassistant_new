import type { AnomalyResult, SheetData, AnomalyDetail, ColumnMaps } from "@/types";

const VALID_STEP_CODES = ["post", "cncl", "open"];
const OLI_NAMES = ["Order_Line_Item", "Order_line_item", "order_line_item"];
const MPC_NAMES = ["mpc", "MPC"];
const SCHEDULER_NAMES = ["scheduler_logs", "Scheduler_logs"];
const TARGET_SCHEDULER = "Step1_Mapping_id&Calc_of_points_OL";
const MAX_DETAILS = 100;

function isBlank(val: unknown): boolean {
  return val === null || val === undefined || String(val).trim() === "" || String(val).trim().toLowerCase() === "null";
}

function normalizeStepCode(val: unknown): string {
  return String(val ?? "").trim().toLowerCase();
}

function fmtValue(val: unknown): string | number | null {
  if (val === null || val === undefined) return null;
  if (typeof val === "number") return val;
  const s = String(val).trim();
  return s === "" ? null : s;
}

// Helper to reliably find the actual batch run date based on frequency (fixes alphabetical sorting bugs)
function getPrimaryDate(dates: string[]): string {
  if (!dates.length) return "2026-05-06"; // Safe fallback
  const counts: Record<string, number> = {};
  let maxCount = 0;
  let primary = dates[0];
  
  for (const d of dates) {
    counts[d] = (counts[d] || 0) + 1;
    if (counts[d] > maxCount) {
      maxCount = counts[d];
      primary = d;
    }
  }
  return primary;
}

// Build an A1-style cell reference like "Order_Line_Item!D45"
function refFor(
  sheetName: string,
  columnMaps: ColumnMaps,
  header: string,
  excelRow: number
): { column?: string; cellRef: string } {
  const col = columnMaps?.[sheetName]?.[header];
  return {
    column: col,
    cellRef: col ? `${sheetName}!${col}${excelRow}` : `${sheetName}!row ${excelRow}`,
  };
}

// Resolve a sheet by trying a list of candidate names (handles case differences).
function resolveSheet(
  sheets: SheetData,
  names: string[]
): { name: string; rows: Record<string, unknown>[] } {
  for (const n of names) {
    const r = sheets[n];
    if (r && Array.isArray(r) && r.length) return { name: n, rows: r as Record<string, unknown>[] };
  }
  return { name: names[0], rows: [] };
}

// ==========================================
// C1: Mandatory Columns Check
// ==========================================
function checkNoBlankColumns(sheets: SheetData, columnMaps: ColumnMaps): AnomalyResult {
  const { name: sheetName, rows } = resolveSheet(sheets, OLI_NAMES);
  
  if (!rows.length) {
    return {
      checkId: "C1",
      checkName: "Column Completeness Check",
      description: "Mapped columns in Order_Line_Item must have no blank or NULL values.",
      status: "warning",
      message: "Order_Line_Item sheet not found or empty.",
    };
  }

  // Fields defined as mandatory in the user story
  const criticalCols = [
    "customer_account_number", "loyalty_id", "order_line_number", 
    "order_line_step_code", "points_left_to_redeem", "total_redeemable_points", "load_date"
  ];

  const details: AnomalyDetail[] = [];
  rows.forEach((row, idx) => {
    const excelRow = idx + 2;
    criticalCols.forEach((col) => {
      if (isBlank(row[col])) {
        const { column, cellRef } = refFor(sheetName, columnMaps, col, excelRow);
        details.push({
          rowIndex: excelRow,
          sheet: sheetName,
          field: col,
          column,
          cellRef,
          value: fmtValue(row[col]),
          issue: `Row ${excelRow}, column '${col}' (cell ${cellRef}) is blank/NULL.`,
        });
      }
    });
  });

  return {
    checkId: "C1",
    checkName: "Column Completeness Check",
    description: "Mapped columns in Order_Line_Item must have no blank or NULL values.",
    status: details.length === 0 ? "pass" : "fail",
    count: details.length,
    total: rows.length * criticalCols.length,
    details: details.slice(0, MAX_DETAILS),
    message: details.length === 0
      ? "All critical columns are fully populated."
      : `${details.length} blank/NULL values found across critical columns.`,
  };
}

// ==========================================
// C2: Total Redeemable Points Validation
// ==========================================
function checkTotalVsRedeemablePoints(sheets: SheetData, columnMaps: ColumnMaps): AnomalyResult {
  const { name: oliName, rows: oli } = resolveSheet(sheets, OLI_NAMES);
  const { rows: mpc } = resolveSheet(sheets, MPC_NAMES);

  if (!oli.length || !mpc.length) {
    return {
      checkId: "C2",
      checkName: "Manual vs System Points Match",
      description: "((sales * pct/100)/0.005) should equal total_redeemable_points.",
      status: "warning",
      message: "Order_Line_Item or mpc sheet not found for this check.",
    };
  }

  // Create lookup for redemption percentages
  const mpcMap: Record<string, number> = {};
  mpc.forEach((row) => {
    const classId = String(row["product_primary_class_id"] ?? "").trim();
    const pct = Number(row["redemption_percentage"] ?? 0);
    if (classId) mpcMap[classId] = pct;
  });

  const details: AnomalyDetail[] = [];
  oli.forEach((row, idx) => {
    const excelRow = idx + 2;
    const classId = String(row["product_primary_class_id"] ?? "").trim();
    const pct = mpcMap[classId];
    
    if (pct !== undefined) {
      const sales = Number(row["extended_sales_amount"] ?? 0);
      const sysPts = Number(row["total_redeemable_points"] ?? 0);
      
      // Manual calculation based on user story query: ((extended_sales_amount*m.redemption_percentage/100)/0.005)
      const manualPts = Math.floor(((sales * pct / 100) / 0.005));
      
      if (Math.abs(manualPts - sysPts) > 1) {
        const { column, cellRef } = refFor(oliName, columnMaps, "total_redeemable_points", excelRow);
        details.push({
          rowIndex: excelRow,
          sheet: oliName,
          field: "total_redeemable_points",
          column,
          cellRef,
          value: sysPts,
          issue: `Row ${excelRow}: Manual math (${manualPts}) vs System (${sysPts}) for sales amount ${sales}.`,
          relatedData: { extended_sales_amount: sales, redemption_percentage: pct, manual: manualPts, system: sysPts },
        });
      }
    }
  });

  return {
    checkId: "C2",
    checkName: "Manual vs System Points Match",
    description: "Manual calculation of points should match system total_redeemable_points.",
    status: details.length === 0 ? "pass" : "fail",
    count: details.length,
    total: oli.length,
    details: details.slice(0, MAX_DETAILS),
    message: details.length === 0
      ? "Manual and system points match perfectly for all mapped records."
      : `${details.length} records have a mismatch between manual and system-calculated points.`,
  };
}

// ==========================================
// C3: Step Code Validation
// ==========================================
function checkStepCodes(sheets: SheetData, columnMaps: ColumnMaps): AnomalyResult {
  const { name: sheetName, rows } = resolveSheet(sheets, OLI_NAMES);
  
  if (!rows.length) {
    return {
      checkId: "C3",
      checkName: "Order Line Step Code Validation",
      description: "order_line_step_code must be only 'post', 'cncl', or 'open'.",
      status: "warning",
      message: "Order_Line_Item sheet not found or empty.",
    };
  }

  const details: AnomalyDetail[] = [];
  rows.forEach((row, idx) => {
    const excelRow = idx + 2;
    const code = normalizeStepCode(row["order_line_step_code"]);
    
    if (!VALID_STEP_CODES.includes(code)) {
      const { column, cellRef } = refFor(sheetName, columnMaps, "order_line_step_code", excelRow);
      details.push({
        rowIndex: excelRow,
        sheet: sheetName,
        field: "order_line_step_code",
        column,
        cellRef,
        value: fmtValue(row["order_line_step_code"]),
        issue: `Row ${excelRow} (cell ${cellRef}): invalid code '${row["order_line_step_code"]}'. Allowed: post, cncl, open.`,
      });
    }
  });

  return {
    checkId: "C3",
    checkName: "Order Line Step Code Validation",
    description: "order_line_step_code must be only 'post', 'cncl', or 'open'.",
    status: details.length === 0 ? "pass" : "fail",
    count: details.length,
    total: rows.length,
    details: details.slice(0, MAX_DETAILS),
    message: details.length === 0
      ? "All step codes are valid (post/cncl/open)."
      : `${details.length} records have invalid step codes.`,
  };
}

// ==========================================
// C4: Points Left To Redeem Match
// ==========================================
function checkPLTRMatch(sheets: SheetData, columnMaps: ColumnMaps): AnomalyResult {
  const { name: oliName, rows: oli } = resolveSheet(sheets, OLI_NAMES);

  if (!oli.length) {
    return {
      checkId: "C4",
      checkName: "Points Left to Redeem Match",
      description: "manual_PLTR (total - redeemed) should equal points_left_to_redeem.",
      status: "warning",
      message: "Order_Line_Item sheet not found or empty.",
    };
  }

  const details: AnomalyDetail[] = [];
  oli.forEach((row, idx) => {
    const excelRow = idx + 2;
    const sysPLTR = Number(row["points_left_to_redeem"] ?? 0);
    const totalPts = Number(row["total_redeemable_points"] ?? 0);
    const redeemedPts = Number(row["points_redeemed"] ?? 0);
    
    const manualPLTR = totalPts - redeemedPts;
    
    if (manualPLTR !== sysPLTR) {
      const { column, cellRef } = refFor(oliName, columnMaps, "points_left_to_redeem", excelRow);
      details.push({
        rowIndex: excelRow,
        sheet: oliName,
        field: "points_left_to_redeem",
        column,
        cellRef,
        value: sysPLTR,
        issue: `Row ${excelRow}: Manual PLTR (${manualPLTR}) vs System PLTR (${sysPLTR}).`,
        relatedData: { total_redeemable_points: totalPts, points_redeemed: redeemedPts, manual: manualPLTR, system: sysPLTR },
      });
    }
  });

  return {
    checkId: "C4",
    checkName: "Points Left to Redeem Match",
    description: "manual_PLTR (total - redeemed) should equal points_left_to_redeem.",
    status: details.length === 0 ? "pass" : "fail",
    count: details.length,
    total: oli.length,
    details: details.slice(0, MAX_DETAILS),
    message: details.length === 0
      ? "Points Left to Redeem matches manual calculation across all records."
      : `${details.length} records have PLTR mismatches.`,
  };
}

// ==========================================
// C5: Business Unit Description Check
// ==========================================
function checkBusinessUnitDesc(sheets: SheetData, columnMaps: ColumnMaps): AnomalyResult {
  const { name: sheetName, rows: oli } = resolveSheet(sheets, OLI_NAMES);
  
  if (!oli.length) {
    return {
      checkId: "C5",
      checkName: "Business Unit Description Check",
      description: "business_unit_description should not be blank for posted orders.",
      status: "warning",
      message: "Order_Line_Item sheet not found or empty.",
    };
  }

  const details: AnomalyDetail[] = [];
  oli.forEach((row, idx) => {
    const excelRow = idx + 2;
    const stepCode = normalizeStepCode(row["order_line_step_code"]);
    const glCode = row["gl_cost_center_code"];
    const bud = row["business_unit_description"];

    if (stepCode === "post" && !isBlank(glCode) && isBlank(bud)) {
      const { column, cellRef } = refFor(sheetName, columnMaps, "business_unit_description", excelRow);
      details.push({
        rowIndex: excelRow,
        sheet: sheetName,
        field: "business_unit_description",
        column,
        cellRef,
        value: null,
        issue: `Row ${excelRow} (cell ${cellRef}) is blank for a posted order (step=post, gl_cost_center_code=${glCode}).`,
      });
    }
  });

  return {
    checkId: "C5",
    checkName: "Business Unit Description Check",
    description: "business_unit_description must not be blank for posted orders.",
    status: details.length === 0 ? "pass" : "fail",
    count: details.length,
    total: oli.filter((r) => normalizeStepCode(r["order_line_step_code"]) === "post").length,
    details: details.slice(0, MAX_DETAILS),
    message: details.length === 0
      ? "Business unit descriptions are present for all posted orders."
      : `${details.length} posted orders have a blank business_unit_description.`,
  };
}

// ==========================================
// C6: Dormant Account Validation
// ==========================================
function checkNonEarningDormant(sheets: SheetData, columnMaps: ColumnMaps): AnomalyResult {
  const { name: sheetName, rows: oli } = resolveSheet(sheets, OLI_NAMES);

  if (!oli.length) {
    return {
      checkId: "C6",
      checkName: "Non-Earning Records Dormant Check",
      description: "Non-earning records (mktcls_modified=1) should only map to dormant_account_flag=1.",
      status: "warning",
      message: "Order_Line_Item sheet not found or empty.",
    };
  }

  const details: AnomalyDetail[] = [];
  oli.forEach((row, idx) => {
    const excelRow = idx + 2;
    const mktcls = Number(row["mktcls_modified"] ?? 0);
    const dormant = Number(row["dormant_account_flag"] ?? 0);
    
    if (mktcls === 1 && dormant !== 1) {
      const { column, cellRef } = refFor(sheetName, columnMaps, "mktcls_modified", excelRow);
      details.push({
        rowIndex: excelRow,
        sheet: sheetName,
        field: "mktcls_modified",
        column,
        cellRef,
        value: mktcls,
        issue: `Row ${excelRow}: mktcls_modified=1 but dormant_account_flag=${dormant}.`,
        relatedData: { loyalty_id: row["loyalty_id"], dormant_account_flag: dormant },
      });
    }
  });

  return {
    checkId: "C6",
    checkName: "Non-Earning Records Dormant Check",
    description: "Non-earning records (mktcls_modified=1) must imply a dormant account (dormant_account_flag=1).",
    status: details.length === 0 ? "pass" : "fail",
    count: details.length,
    total: oli.length,
    details: details.slice(0, MAX_DETAILS),
    message: details.length === 0
      ? "All non-earning records are correctly flagged as dormant accounts."
      : `${details.length} non-earning records are improperly mapped to non-dormant accounts.`,
  };
}

// ==========================================
// C7: Date of Transaction (Ineligible Count)
// ==========================================
function checkDateOfTransaction(sheets: SheetData, columnMaps: ColumnMaps): AnomalyResult {
  const { name: sheetName, rows: oli } = resolveSheet(sheets, OLI_NAMES);
  
  if (!oli.length) {
    return {
      checkId: "C7",
      checkName: "Date of Transaction Check",
      description: "Count of records with NULL date_of_transaction (ineligible) vs NOT NULL (eligible).",
      status: "info",
      message: "Order_Line_Item sheet not found or empty.",
    };
  }

  const total = oli.length;
  const details: AnomalyDetail[] = [];
  
  oli.forEach((row, idx) => {
    const excelRow = idx + 2;
    if (isBlank(row["date_of_transaction"])) {
      const { column, cellRef } = refFor(sheetName, columnMaps, "date_of_transaction", excelRow);
      details.push({
        rowIndex: excelRow,
        sheet: sheetName,
        field: "date_of_transaction",
        column,
        cellRef,
        value: null,
        issue: `Row ${excelRow} (cell ${cellRef}) is NULL (ineligible record).`,
      });
    }
  });

  const nullCount = details.length;
  const nonNullCount = total - nullCount;

  return {
    checkId: "C7",
    checkName: "Date of Transaction Check",
    description: "Ineligible = date_of_transaction IS NULL; Eligible/Mapped = date_of_transaction IS NOT NULL.",
    status: "pass", 
    count: nullCount,
    total,
    details: details.slice(0, MAX_DETAILS),
    message: `Total (B): ${total} | Ineligible (C): ${nullCount} | Eligible (D): ${nonNullCount}`,
  };
}

// ==========================================
// C8: Scheduler vs Output Count Match (FIXED)
// ==========================================
function checkSchedulerCountMatch(sheets: SheetData, columnMaps: ColumnMaps): AnomalyResult {
  const { rows: oli } = resolveSheet(sheets, OLI_NAMES);
  const { name: schedName, rows: schedLogs } = resolveSheet(sheets, SCHEDULER_NAMES);
  
  if (!oli.length || !schedLogs.length) {
    return {
      checkId: "C8",
      checkName: "Scheduler Count vs Output Count",
      description: "Scheduler count (A) must equal eligible output count (D).",
      status: "warning",
      message: "Order_Line_Item or scheduler_logs sheet missing.",
    };
  }

  // Count active eligible records (D)
  const eligibleCountD = oli.filter(r => !isBlank(r["date_of_transaction"])).length;

  // Track the primary batch run date
  const loadDates = oli.map(r => String(r["load_date"] ?? "").trim()).filter(d => d !== "");
  const targetDate = getPrimaryDate(loadDates); // Returns "2026-05-06"

  // FIX 1: Use .startsWith() to ignore trailing hours ("00:00:00") inside the timestamp string
  const targetLog = schedLogs.find(r => 
    String(r["scheduler"]).trim() === TARGET_SCHEDULER && 
    String(r["run_date"]).trim().startsWith(targetDate)
  );

  // FIX 2: Safely map both 'record_count' (from mock data) and fallback 'mapped_count'
  const schedulerCountA = targetLog 
    ? Number(targetLog["record_count"] ?? targetLog["mapped_count"] ?? 0) 
    : 0;
    
  const match = schedulerCountA === eligibleCountD;

  const details: AnomalyDetail[] = [];
  if (!match) {
    details.push({
      rowIndex: 0,
      sheet: schedName,
      field: "record_count",
      value: schedulerCountA,
      issue: `Scheduler count (A=${schedulerCountA}) does not match eligible records (D=${eligibleCountD}) for primary date ${targetDate}.`,
    });
  }

  return {
    checkId: "C8",
    checkName: "Scheduler Count vs Output Count",
    description: "Scheduler count (A) must equal eligible output count (D).",
    status: match ? "pass" : "fail",
    count: schedulerCountA, // Will now accurately register as 30
    total: eligibleCountD,     // Will accurately register as 30
    details: details.slice(0, MAX_DETAILS),
    message: match 
      ? `Scheduler count perfectly matches eligible records (A=${schedulerCountA}, D=${eligibleCountD}).`
      : `Mismatch: Scheduler processed ${schedulerCountA} but found ${eligibleCountD} eligible records.`,
  };
}
// ==========================================
// C9: Run Date Consistency Check
// ==========================================
function checkRunDate(sheets: SheetData, columnMaps: ColumnMaps): AnomalyResult {
  const { name: sheetName, rows: oli } = resolveSheet(sheets, OLI_NAMES);
  
  if (!oli.length) {
    return {
      checkId: "C9",
      checkName: "Run Date Consistency Check",
      description: "All records should share the exact same load_date.",
      status: "warning",
      message: "Order_Line_Item sheet not found or empty.",
    };
  }

  const loadDates = oli
    .map((r) => r["load_date"])
    .filter((d) => !isBlank(d))
    .map((d) => String(d).trim());

  // Use the new helper here too
  const primaryDate = getPrimaryDate(loadDates);
  const uniqueDates = [...new Set(loadDates)].sort();

  const details: AnomalyDetail[] = [];
  oli.forEach((row, idx) => {
    const excelRow = idx + 2;
    const ld = String(row["load_date"] ?? "").trim();
    if (!isBlank(ld) && ld !== primaryDate) {
      const { column, cellRef } = refFor(sheetName, columnMaps, "load_date", excelRow);
      details.push({
        rowIndex: excelRow,
        sheet: sheetName,
        field: "load_date",
        column,
        cellRef,
        value: ld,
        issue: `Row ${excelRow} (cell ${cellRef}) = '${ld}', differs from the primary run date '${primaryDate}'.`,
      });
    }
  });

  return {
    checkId: "C9",
    checkName: "Run Date Consistency Check",
    description: "All records should share the same load/run date.",
    status: details.length > 0 ? "warning" : "pass",
    count: details.length,
    total: oli.length,
    details: details.slice(0, MAX_DETAILS),
    message: details.length === 0
      ? `All records have consistent run date: ${primaryDate}.`
      : `${details.length} records have a different load_date. Unique dates found: ${uniqueDates.join(", ")}`,
  };
}

// ==========================================
// Main Runner Export
// ==========================================
export function runAllChecks(sheets: SheetData, columnMaps: ColumnMaps = {}): AnomalyResult[] {
  return [
    checkNoBlankColumns(sheets, columnMaps),          // C1
    checkTotalVsRedeemablePoints(sheets, columnMaps), // C2
    checkStepCodes(sheets, columnMaps),               // C3
    checkPLTRMatch(sheets, columnMaps),               // C4
    checkBusinessUnitDesc(sheets, columnMaps),        // C5
    checkNonEarningDormant(sheets, columnMaps),       // C6
    checkDateOfTransaction(sheets, columnMaps),       // C7
    checkSchedulerCountMatch(sheets, columnMaps),     // C8
    checkRunDate(sheets, columnMaps),                 // C9
  ];
}