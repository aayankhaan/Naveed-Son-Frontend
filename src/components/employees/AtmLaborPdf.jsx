// ========================================
// AtmLaborPdf.jsx
// Big ATM labor sheet (all workers) or single-contractor ATM page.
// ========================================

import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";

const C = {
  ink: "#1C1917",
  gold: "#B8873D",
  goldSoft: "#F5E6C8",
  bone: "#F7F3EB",
  boneDim: "#EFE8DC",
  green: "#3D6B4F",
  greenSoft: "#D8E8DE",
  rust: "#9C4A34",
  rustSoft: "#F0D8D0",
  graphite: "#6B655C",
  border: "#E0D6C8",
  white: "#FFFFFF",
};

const styles = StyleSheet.create({
  page: {
    padding: 24,
    fontSize: 9,
    fontFamily: "Helvetica",
    color: C.ink,
    backgroundColor: C.bone,
  },
  header: {
    backgroundColor: C.ink,
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
  },
  brand: {
    color: C.gold,
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 3,
  },
  title: { color: C.white, fontSize: 16, fontFamily: "Helvetica-Bold" },
  sub: { color: "#C4B8A8", fontSize: 8.5, marginTop: 3 },
  section: {
    backgroundColor: C.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
    padding: 10,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    marginBottom: 6,
    color: C.ink,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  label: { color: C.graphite, fontSize: 8.5, maxWidth: "70%" },
  value: { fontFamily: "Helvetica-Bold", fontSize: 9 },
  muted: { color: C.graphite, fontSize: 8 },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: C.boneDim,
    paddingVertical: 5,
    paddingHorizontal: 4,
    borderRadius: 4,
    marginBottom: 2,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  colItem: { width: "34%" },
  colDept: { width: "16%" },
  colNum: { width: "12.5%", textAlign: "right" },
  colWide: { width: "16%", textAlign: "right" },
  th: { fontSize: 7.5, fontFamily: "Helvetica-Bold", color: C.graphite },
  td: { fontSize: 8 },
  badge: {
    backgroundColor: C.goldSoft,
    color: C.gold,
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 6,
    alignSelf: "flex-start",
    marginBottom: 6,
  },
  totalBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: C.ink,
    borderRadius: 8,
    padding: 10,
    marginTop: 6,
  },
  totalLabel: { color: "#C4B8A8", fontSize: 8 },
  totalValue: { color: C.gold, fontSize: 12, fontFamily: "Helvetica-Bold" },
  empBlock: { marginBottom: 8 },
  empName: { fontFamily: "Helvetica-Bold", fontSize: 10, marginBottom: 2 },
});

function pkr(n) {
  return `Rs ${Math.round(Number(n) || 0).toLocaleString()}`;
}

function qty(n) {
  return Math.round(Number(n) || 0).toLocaleString();
}

/** One contractor page for this ATM */
function EmployeeAtmPages({ order, employee, filterLabel }) {
  if (!employee) return null;
  return (
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        <Text style={styles.brand}>Naveed & Sons · ATM labor</Text>
        <Text style={styles.title}>{employee.full_name}</Text>
        <Text style={styles.sub}>
          ATM {order.atm_no} · {order.customer}
          {filterLabel ? ` · ${filterLabel}` : ""}
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>1. What they made</Text>
        <View style={styles.tableHeader}>
          <Text style={[styles.th, styles.colItem]}>Item</Text>
          <Text style={[styles.th, styles.colDept]}>Dept</Text>
          <Text style={[styles.th, styles.colNum]}>Qty</Text>
          <Text style={[styles.th, styles.colWide]}>Bill</Text>
        </View>
        {(employee.items || []).map((it, i) => (
          <View key={i} style={styles.tableRow}>
            <Text style={[styles.td, styles.colItem]}>{it.article_name}</Text>
            <Text style={[styles.td, styles.colDept]}>{it.station}</Text>
            <Text style={[styles.td, styles.colNum]}>{qty(it.qty)}</Text>
            <Text style={[styles.td, styles.colWide]}>{pkr(it.bill)}</Text>
          </View>
        ))}
        <View style={styles.row}>
          <Text style={styles.label}>Total made</Text>
          <Text style={styles.value}>
            {qty(employee.qty_made)} · {pkr(employee.bill)}
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>2. Bill for that qty</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Work bill (qty × rate)</Text>
          <Text style={styles.value}>{pkr(employee.bill)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>ATM payout after ship ratio</Text>
          <Text style={styles.value}>{pkr(employee.atm_payout)}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>3. Waste on their work</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Ship waste qty (unshipped share)</Text>
          <Text style={styles.value}>{qty(employee.ship_waste_qty)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Ship waste money</Text>
          <Text style={styles.value}>{pkr(employee.ship_waste_money)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Floor defects qty</Text>
          <Text style={styles.value}>{qty(employee.floor_waste_qty)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Floor defects money</Text>
          <Text style={styles.value}>{pkr(employee.floor_waste_money)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Total waste money</Text>
          <Text style={styles.value}>{pkr(employee.waste_money)}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>4. This ATM payout</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Full work bill</Text>
          <Text style={styles.value}>{pkr(employee.bill)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>ATM payout (bill × ship ratio)</Text>
          <Text style={styles.value}>{pkr(employee.atm_payout)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Unpaid slice</Text>
          <Text style={styles.value}>{pkr(employee.atm_unpaid)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>− Installment</Text>
          <Text style={styles.value}>{pkr(employee.installment_deduct)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>− Advance</Text>
          <Text style={styles.value}>{pkr(employee.advance_deduct)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={[styles.label, { fontFamily: "Helvetica-Bold", color: C.ink }]}>
            Final for this ATM
          </Text>
          <Text style={[styles.value, { color: C.green, fontSize: 11 }]}>{pkr(employee.net)}</Text>
        </View>
        {employee.atm_paid > 0 ? (
          <Text style={[styles.muted, { marginTop: 4 }]}>
            Already paid on this ATM: {pkr(employee.atm_paid)}
          </Text>
        ) : null}
      </View>
    </Page>
  );
}

/** Full merged sheet — all departments / workers */
function MergedAtmPages({ report }) {
  const { order, departments, totals, filters } = report;
  const filterLabel = [
    filters?.station ? `Dept: ${filters.station}` : null,
    filters?.employee_id ? "Single employee" : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Page size="A4" style={styles.page} wrap>
      <View style={styles.header}>
        <Text style={styles.brand}>Naveed & Sons · ATM labor sheet</Text>
        <Text style={styles.title}>ATM {order.atm_no}</Text>
        <Text style={styles.sub}>
          {order.customer}
          {filterLabel ? ` · ${filterLabel}` : " · all departments"}
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>ATM units (shipment)</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Made</Text>
          <Text style={styles.value}>{qty(totals.qty_made)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Shipped</Text>
          <Text style={styles.value}>{qty(totals.qty_shipped)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Ship waste (made − shipped)</Text>
          <Text style={styles.value}>{qty(totals.ship_waste)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Pay ratio</Text>
          <Text style={styles.value}>{Math.round((totals.shipment_ratio || 0) * 100)}%</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Workers</Text>
          <Text style={styles.value}>{totals.employee_count}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Work bill (all depts pcs × rate)</Text>
          <Text style={styles.value}>{pkr(totals.bill)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Total labor (bill × ratio)</Text>
          <Text style={styles.value}>{pkr(totals.labor_cost)}</Text>
        </View>
      </View>

      {(departments || []).map((dept) => (
        <View key={dept.station} style={styles.section} wrap={false}>
          <Text style={styles.badge}>{dept.station}</Text>
          <Text style={styles.muted}>
            {dept.employees.length} worker{dept.employees.length === 1 ? "" : "s"} · labor{" "}
            {pkr(dept.atm_payout)}
          </Text>
          <View style={[styles.tableHeader, { marginTop: 6 }]}>
            <Text style={[styles.th, { width: "28%" }]}>Worker</Text>
            <Text style={[styles.th, { width: "28%" }]}>Pieces</Text>
            <Text style={[styles.th, styles.colNum]}>Qty</Text>
            <Text style={[styles.th, styles.colNum]}>Waste</Text>
            <Text style={[styles.th, styles.colWide]}>Payout</Text>
            <Text style={[styles.th, styles.colWide]}>Net</Text>
          </View>
          {dept.employees.map((emp) => (
            <View key={`${dept.station}-${emp.employee_id}`} style={styles.tableRow}>
              <Text style={[styles.td, { width: "28%" }]}>{emp.full_name}</Text>
              <Text style={[styles.td, { width: "28%", color: C.graphite }]}>
                {(emp.items || []).map((it) => it.article_name).join(", ") || "—"}
              </Text>
              <Text style={[styles.td, styles.colNum]}>{qty(emp.qty_made)}</Text>
              <Text style={[styles.td, styles.colNum]}>{qty(emp.waste_qty)}</Text>
              <Text style={[styles.td, styles.colWide]}>{pkr(emp.atm_payout)}</Text>
              <Text style={[styles.td, styles.colWide]}>{pkr(emp.net)}</Text>
            </View>
          ))}
          <View style={styles.row}>
            <Text style={styles.label}>
              Dept waste {qty(dept.waste_qty)} · {pkr(dept.waste_money)}
            </Text>
            <Text style={styles.value}>
              −inst/adv in nets · unpaid {pkr(dept.atm_unpaid)}
            </Text>
          </View>
        </View>
      ))}

      <View style={styles.totalBar}>
        <View>
          <Text style={styles.totalLabel}>Total labor on this ATM</Text>
          <Text style={styles.totalValue}>{pkr(totals.labor_cost)}</Text>
        </View>
        <View>
          <Text style={styles.totalLabel}>After loans (unpaid slice)</Text>
          <Text style={styles.totalValue}>{pkr(totals.net)}</Text>
        </View>
      </View>
    </Page>
  );
}

/**
 * @param {{ report: object, mode?: 'merged'|'employee', employeeId?: number }} props
 */
export default function AtmLaborPdf({ report, mode = "merged", employeeId = null }) {
  if (!report?.shipped) {
    return (
      <Document>
        <Page size="A4" style={styles.page}>
          <View style={styles.header}>
            <Text style={styles.brand}>Naveed & Sons</Text>
            <Text style={styles.title}>ATM {report?.order?.atm_no || "—"}</Text>
          </View>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Can't calculate</Text>
            <Text style={styles.muted}>
              {report?.message || "Order isn't shipped yet."}
            </Text>
          </View>
        </Page>
      </Document>
    );
  }

  const filterLabel = report.filters?.station ? `Dept: ${report.filters.station}` : "";

  if (mode === "employee" && employeeId) {
    const emp =
      (report.employees || []).find((e) => e.employee_id === employeeId) ||
      (report.departments || [])
        .flatMap((d) => d.employees)
        .find((e) => e.employee_id === employeeId);
    return (
      <Document>
        <EmployeeAtmPages order={report.order} employee={emp} filterLabel={filterLabel} />
      </Document>
    );
  }

  return (
    <Document>
      <MergedAtmPages report={report} />
    </Document>
  );
}
