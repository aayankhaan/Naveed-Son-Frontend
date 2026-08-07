// ========================================
// InvoiceDocument.jsx
// Matches the printed Naveed & Sons bill form:
// header · billing boxes · line table · Sub Total · empty space · signatures at foot.
// ========================================

import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";

const MIN_ROWS = 20;

const styles = StyleSheet.create({
  page: {
    paddingTop: 28,
    paddingHorizontal: 28,
    paddingBottom: 28,
    fontSize: 9.5,
    fontFamily: "Helvetica",
    color: "#000000",
    flexDirection: "column",
  },

  titleBox: {
    border: "1.5pt solid #000000",
    borderRadius: 3,
    paddingVertical: 10,
    paddingHorizontal: 8,
    marginBottom: 14,
  },
  title: {
    fontFamily: "Helvetica-Bold",
    fontSize: 16,
    letterSpacing: 1.2,
    textAlign: "center",
  },

  billRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 6,
    marginBottom: 12,
  },
  billLabel: {
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
  },
  billLine: {
    borderBottom: "1pt solid #000000",
    minWidth: 72,
    paddingBottom: 1,
    paddingHorizontal: 4,
  },
  billValue: {
    fontFamily: "Helvetica-Bold",
    fontSize: 11,
  },

  detailsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },
  detailsBox: {
    flex: 1,
    border: "1pt solid #000000",
    borderRadius: 3,
    padding: 8,
    minHeight: 88,
  },
  detailsHeading: {
    fontFamily: "Helvetica-Bold",
    fontSize: 9.5,
    textAlign: "center",
    marginBottom: 8,
  },
  fieldRow: {
    flexDirection: "row",
    marginBottom: 7,
    alignItems: "flex-end",
  },
  fieldLabel: {
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    width: 68,
  },
  fieldValue: {
    flex: 1,
    fontSize: 9,
    borderBottom: "0.75pt solid #000000",
    paddingBottom: 1,
    minHeight: 11,
  },

  table: {
    border: "1pt solid #000000",
    borderRadius: 3,
  },
  tr: {
    flexDirection: "row",
  },
  th: {
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    paddingVertical: 5,
    paddingHorizontal: 4,
    borderRight: "1pt solid #000000",
    borderBottom: "1pt solid #000000",
    textAlign: "center",
  },
  td: {
    fontSize: 9,
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderRight: "1pt solid #000000",
    borderBottom: "1pt solid #000000",
    minHeight: 22,
  },
  tdLast: {
    fontSize: 9,
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderBottom: "1pt solid #000000",
    minHeight: 22,
  },
  tdEmpty: {
    fontSize: 9,
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderRight: "1pt solid #000000",
    borderBottom: "1pt solid #000000",
    minHeight: 22,
    color: "#000000",
  },
  colSr: { width: "8%", textAlign: "center" },
  colDescription: { width: "32%" },
  colDesign: { width: "20%" },
  colQty: { width: "12%", textAlign: "right" },
  colRate: { width: "13%", textAlign: "right" },
  colAmount: { width: "15%", textAlign: "right", borderRight: "none" },
  designLine: { fontSize: 9, marginBottom: 1 },

  subTotalRow: {
    flexDirection: "row",
  },
  subTotalLabel: {
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
    textAlign: "right",
    paddingVertical: 7,
    paddingHorizontal: 6,
    width: "85%",
    borderRight: "1pt solid #000000",
  },
  subTotalValue: {
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
    textAlign: "right",
    paddingVertical: 7,
    paddingHorizontal: 6,
    width: "15%",
  },

  spacer: {
    flexGrow: 1,
    minHeight: 48,
  },

  signatureRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  signatureBlock: {
    width: "22%",
    textAlign: "center",
  },
  signatureLine: {
    borderTop: "1pt solid #000000",
    paddingTop: 6,
    fontSize: 8.5,
  },
});

function formatNumber(n) {
  const num = Number(n) || 0;
  return num.toLocaleString("en-US");
}

function InvoiceField({ label, value }) {
  return (
    <View style={styles.fieldRow}>
      <Text style={styles.fieldLabel}>{label}:</Text>
      <Text style={styles.fieldValue}>{value || " "}</Text>
    </View>
  );
}

function EmptyRow({ sr }) {
  return (
    <View style={styles.tr} wrap={false}>
      <Text style={[styles.tdEmpty, styles.colSr]}>{sr}</Text>
      <Text style={[styles.tdEmpty, styles.colDescription]}> </Text>
      <Text style={[styles.tdEmpty, styles.colDesign]}> </Text>
      <Text style={[styles.tdEmpty, styles.colQty]}> </Text>
      <Text style={[styles.tdEmpty, styles.colRate]}> </Text>
      <Text style={[styles.tdLast, styles.colAmount]}> </Text>
    </View>
  );
}

export default function InvoiceDocument({
  billNo,
  name,
  orderRef,
  challanNo,
  date,
  partyName,
  jobOrderNo,
  scNo,
  rows = [],
  subTotal = 0,
}) {
  const filled = Array.isArray(rows) ? rows : [];
  const emptyCount = Math.max(0, MIN_ROWS - filled.length);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.titleBox}>
          <Text style={styles.title}>NAVEED &amp; SONS</Text>
        </View>

        <View style={styles.billRow}>
          <Text style={styles.billLabel}>Bill No.</Text>
          <View style={styles.billLine}>
            <Text style={styles.billValue}>{billNo || " "}</Text>
          </View>
        </View>

        <View style={styles.detailsRow}>
          <View style={styles.detailsBox}>
            <Text style={styles.detailsHeading}>Billing Details</Text>
            <InvoiceField label="Name" value={name} />
            <InvoiceField label="Order" value={orderRef} />
            <InvoiceField label="Challan #" value={challanNo} />
          </View>
          <View style={styles.detailsBox}>
            <Text style={styles.detailsHeading}> </Text>
            <InvoiceField label="Date" value={date} />
            <InvoiceField label="Party Name" value={partyName} />
            <InvoiceField label="Job Order #" value={jobOrderNo} />
            <InvoiceField label="S/C #" value={scNo} />
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tr}>
            <Text style={[styles.th, styles.colSr]}>SR#</Text>
            <Text style={[styles.th, styles.colDescription]}>Description</Text>
            <Text style={[styles.th, styles.colDesign]}>Design</Text>
            <Text style={[styles.th, styles.colQty]}>Qty</Text>
            <Text style={[styles.th, styles.colRate]}>Rate</Text>
            <Text style={[styles.th, styles.colAmount]}>Amount</Text>
          </View>

          {filled.map((row, i) => {
            const qtyOrdered = Number(row.qtyOrdered ?? row.qty) || 0;
            const rate = Number(row.rate) || 0;
            const designLines = row.designLines?.length
              ? row.designLines
              : String(row.design || "").split("\n").filter(Boolean);
            const amount =
              row.rate === "" || row.rate == null ? "" : formatNumber(qtyOrdered * rate);
            return (
              <View style={styles.tr} key={`r-${i}`} wrap={false}>
                <Text style={[styles.td, styles.colSr]}>{i + 1}</Text>
                <Text style={[styles.td, styles.colDescription]}>{row.description || ""}</Text>
                <View style={[styles.td, styles.colDesign]}>
                  {designLines.length ? (
                    designLines.map((d, di) => (
                      <Text key={di} style={styles.designLine}>
                        {d}
                      </Text>
                    ))
                  ) : (
                    <Text> </Text>
                  )}
                </View>
                <Text style={[styles.td, styles.colQty]}>
                  {qtyOrdered ? formatNumber(qtyOrdered) : ""}
                </Text>
                <Text style={[styles.td, styles.colRate]}>
                  {row.rate === "" || row.rate == null ? "" : formatNumber(rate)}
                </Text>
                <Text style={[styles.tdLast, styles.colAmount]}>{amount}</Text>
              </View>
            );
          })}

          {Array.from({ length: emptyCount }, (_, i) => (
            <EmptyRow key={`e-${i}`} sr={filled.length + i + 1} />
          ))}

          <View style={styles.subTotalRow}>
            <Text style={styles.subTotalLabel}>Sub Total</Text>
            <Text style={styles.subTotalValue}>{formatNumber(subTotal)}</Text>
          </View>
        </View>

        {/* Push signatures to the bottom of the page */}
        <View style={styles.spacer} />

        <View style={styles.signatureRow}>
          <View style={styles.signatureBlock}>
            <Text style={styles.signatureLine}>Prepared By</Text>
          </View>
          <View style={styles.signatureBlock}>
            <Text style={styles.signatureLine}>Approved By</Text>
          </View>
          <View style={styles.signatureBlock}>
            <Text style={styles.signatureLine}>Checked By</Text>
          </View>
          <View style={styles.signatureBlock}>
            <Text style={styles.signatureLine}>Contractor</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
