// ========================================
// InvoiceDocument.jsx
// Pure @react-pdf/renderer recreation of the on-screen invoice preview in
// Orders.jsx. Presentational only — receives plain data via props and
// renders a real, selectable PDF (no DOM capture or rasterization).
// ========================================

import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: {
    padding: 28,
    fontSize: 9.5,
    fontFamily: "Helvetica",
    color: "#000000",
  },

  titleBox: {
    border: "1.5pt solid #000000",
    borderRadius: 4,
    paddingVertical: 8,
    paddingHorizontal: 8,
    marginBottom: 12,
  },
  title: {
    fontFamily: "Helvetica-Bold",
    fontSize: 16,
    letterSpacing: 1,
    textAlign: "center",
  },

  billRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  billLabel: {
    fontFamily: "Helvetica-Bold",
    fontSize: 9.5,
  },
  billBox: {
    border: "1pt solid #000000",
    borderRadius: 3,
    paddingVertical: 3,
    paddingHorizontal: 10,
  },
  billValue: {
    fontFamily: "Helvetica-Bold",
    fontSize: 9.5,
    textAlign: "center",
  },

  detailsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  detailsBox: {
    flex: 1,
    border: "1pt solid #000000",
    borderRadius: 4,
    padding: 8,
  },
  detailsHeading: {
    fontFamily: "Helvetica-Bold",
    fontSize: 9.5,
    textAlign: "center",
    marginBottom: 6,
  },
  fieldRow: {
    flexDirection: "row",
    marginBottom: 5,
  },
  fieldLabel: {
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    width: 62,
  },
  fieldValue: {
    flex: 1,
    fontSize: 9,
    borderBottom: "0.75pt solid #000000",
    paddingBottom: 1.5,
  },

  table: {
    border: "1pt solid #000000",
    borderRadius: 4,
    marginBottom: 24,
  },
  tr: {
    flexDirection: "row",
  },
  th: {
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    padding: 5,
    borderRight: "1pt solid #000000",
    borderBottom: "1pt solid #000000",
  },
  td: {
    fontSize: 9,
    padding: 5,
    borderRight: "1pt solid #000000",
    borderBottom: "1pt solid #000000",
  },
  tdLast: {
    fontSize: 9,
    padding: 5,
    borderBottom: "1pt solid #000000",
  },
  colSr: { width: "8%", textAlign: "center" },
  colDescription: { width: "28%" },
  colDesign: { width: "22%" },
  colQty: { width: "14%", textAlign: "right" },
  colRate: { width: "14%", textAlign: "right" },
  colAmount: { width: "14%", textAlign: "right", borderRight: "none" },

  subTotalLabel: {
    fontFamily: "Helvetica-Bold",
    fontSize: 9.5,
    textAlign: "right",
    padding: 6,
    width: "86%",
    borderRight: "1pt solid #000000",
  },
  subTotalValue: {
    fontFamily: "Helvetica-Bold",
    fontSize: 9.5,
    textAlign: "right",
    padding: 6,
    width: "14%",
  },

  signatureRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 32,
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
      <Text style={styles.fieldValue}>{value || ""}</Text>
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
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.titleBox}>
          <Text style={styles.title}>NAVEED &amp; SONS</Text>
        </View>

        <View style={styles.billRow}>
          <Text style={styles.billLabel}>Bill No.</Text>
          <View style={styles.billBox}>
            <Text style={styles.billValue}>{billNo}</Text>
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

          {rows.map((row, i) => {
            const qty = Number(row.qty) || 0;
            const rate = Number(row.rate) || 0;
            return (
              <View style={styles.tr} key={i} wrap={false}>
                <Text style={[styles.td, styles.colSr]}>{i + 1}</Text>
                <Text style={[styles.td, styles.colDescription]}>{row.description}</Text>
                <Text style={[styles.td, styles.colDesign]}>{row.design}</Text>
                <Text style={[styles.td, styles.colQty]}>{formatNumber(qty)}</Text>
                <Text style={[styles.td, styles.colRate]}>{row.rate === "" || row.rate == null ? "" : formatNumber(rate)}</Text>
                <Text style={[styles.tdLast, styles.colAmount]}>{formatNumber(qty * rate)}</Text>
              </View>
            );
          })}

          <View style={styles.tr}>
            <Text style={styles.subTotalLabel}>Sub Total</Text>
            <Text style={styles.subTotalValue}>{formatNumber(subTotal)}</Text>
          </View>
        </View>

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