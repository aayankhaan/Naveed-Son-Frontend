// ========================================
// EmployeeProofPdf.jsx
// Colorful PDF of employee work proof (qty or money).
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
    padding: 28,
    fontSize: 9.5,
    fontFamily: "Helvetica",
    color: C.ink,
    backgroundColor: C.bone,
  },
  header: {
    backgroundColor: C.ink,
    borderRadius: 10,
    padding: 16,
    marginBottom: 14,
  },
  brand: {
    color: C.gold,
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  title: {
    color: C.white,
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
  },
  sub: {
    color: "#C4B8A8",
    fontSize: 9,
    marginTop: 4,
  },
  pills: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 10,
  },
  pill: {
    backgroundColor: "rgba(184,135,61,0.25)",
    color: C.gold,
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  section: {
    backgroundColor: C.white,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    padding: 12,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    marginBottom: 8,
    color: C.ink,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingVertical: 7,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  labelCol: {
    flexDirection: "column",
    flexGrow: 1,
    flexShrink: 1,
    paddingRight: 12,
    maxWidth: "78%",
  },
  label: {
    color: C.graphite,
    fontSize: 9,
    fontFamily: "Helvetica",
  },
  value: {
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
    flexShrink: 0,
    textAlign: "right",
  },
  hint: {
    color: "#948C7F",
    fontSize: 7.5,
    marginTop: 3,
    lineHeight: 1.35,
  },
  cards: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10,
  },
  card: {
    width: "23%",
    borderRadius: 8,
    padding: 10,
    minWidth: 100,
  },
  cardLabel: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  cardValue: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
  },
  stationBlock: {
    backgroundColor: C.boneDim,
    borderRadius: 8,
    padding: 10,
    marginBottom: 6,
  },
  stationName: {
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
    marginBottom: 6,
    color: C.gold,
  },
  stationGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
  },
  chip: {
    backgroundColor: C.white,
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 7,
    marginRight: 4,
    marginBottom: 4,
  },
  chipLabel: { fontSize: 7, color: C.graphite },
  chipVal: { fontSize: 9, fontFamily: "Helvetica-Bold", marginTop: 1 },
  footer: {
    marginTop: 8,
    fontSize: 7.5,
    color: C.graphite,
    textAlign: "center",
  },
});

function fmtQty(n) {
  return `${Math.round(Number(n) || 0).toLocaleString()} pcs`;
}

function fmtPKR(n) {
  return `PKR ${Math.round(Number(n) || 0).toLocaleString()}`;
}

function formatRange(from, to) {
  return `${String(from || "").slice(0, 10)} → ${String(to || "").slice(0, 10)}`;
}

function StoryRow({ label, value, hint, color }) {
  return (
    <View style={styles.row} wrap={false}>
      <View style={styles.labelCol}>
        <Text style={styles.label}>{label}</Text>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>
      <Text style={color ? [styles.value, { color }] : styles.value}>{value}</Text>
    </View>
  );
}

/**
 * @param {{
 *   employee: { name, id, station },
 *   summary: object,
 *   viewMode: 'qty' | 'money',
 * }} props
 */
export default function EmployeeProofPdf({ employee, summary, viewMode = "qty" }) {
  const isQty = viewMode === "qty";
  const qty = summary?.qty_story?.totals || {};
  const byStation = summary?.qty_story?.by_station || [];
  const story = summary?.money_story || {};
  const cycle = summary?.cycle || {};

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.brand}>Naveed &amp; Sons · Floor proof</Text>
          <Text style={styles.title}>{employee?.name || summary?.full_name || "Employee"}</Text>
          <Text style={styles.sub}>
            {employee?.id || ""} · {employee?.station || summary?.station || ""} ·{" "}
            {formatRange(cycle.from, cycle.to)}
          </Text>
          <View style={styles.pills}>
            <Text style={styles.pill}>{isQty ? "Qty view" : "Money view"}</Text>
            {cycle.since_last_payout ? <Text style={styles.pill}>Since last payout</Text> : null}
            {summary?.last_payout_at ? (
              <Text style={styles.pill}>Last paid {String(summary.last_payout_at).slice(0, 10)}</Text>
            ) : (
              <Text style={styles.pill}>Never paid out</Text>
            )}
          </View>
        </View>

        {isQty ? (
          <>
            <View style={styles.cards}>
              <View style={[styles.card, { backgroundColor: C.goldSoft }]}>
                <Text style={[styles.cardLabel, { color: C.gold }]}>Worked</Text>
                <Text style={styles.cardValue}>{fmtQty(qty.worked)}</Text>
              </View>
              <View style={[styles.card, { backgroundColor: C.rustSoft }]}>
                <Text style={[styles.cardLabel, { color: C.rust }]}>Waste</Text>
                <Text style={styles.cardValue}>
                  {fmtQty((qty.waste || 0) + (qty.ship_waste || 0))}
                </Text>
              </View>
              <View style={[styles.card, { backgroundColor: C.greenSoft }]}>
                <Text style={[styles.cardLabel, { color: C.green }]}>Paid qty</Text>
                <Text style={styles.cardValue}>{fmtQty(qty.paid)}</Text>
              </View>
              <View style={[styles.card, { backgroundColor: C.boneDim }]}>
                <Text style={[styles.cardLabel, { color: C.graphite }]}>Pending ship</Text>
                <Text style={styles.cardValue}>{fmtQty(qty.pending_ship)}</Text>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Qty story (easy to match on floor)</Text>
              <StoryRow label="Good pcs worked" value={fmtQty(qty.worked)} hint="Logged on Daily Entry" />
              <StoryRow label="Defects (floor waste)" value={fmtQty(qty.waste)} color={C.rust} />
              <StoryRow
                label="Ship waste"
                value={fmtQty(qty.ship_waste)}
                hint="Worked but not shipped with the order"
                color={C.rust}
              />
              <StoryRow label="Still waiting shipment" value={fmtQty(qty.pending_ship)} />
              <StoryRow
                label="Shipped — ready to pay"
                value={fmtQty(qty.ready_pay)}
                color={C.gold}
              />
              <StoryRow label="Already paid qty" value={fmtQty(qty.paid)} color={C.green} />
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>What we owe (money)</Text>
              <StoryRow
                label="You earned / we owe"
                value={fmtPKR(story.settled_unlocked)}
                hint="Shipped & unlocked — not paid yet"
                color={C.gold}
              />
              <StoryRow
                label="− Installment"
                value={`−${fmtPKR(story.installment_deduct)}`}
                color={C.rust}
              />
              <StoryRow
                label="− Advance"
                value={`−${fmtPKR(story.advance_deduct)}`}
                color={C.rust}
              />
              <StoryRow
                label="Total they take home"
                value={fmtPKR(story.net_pay)}
                hint="After deductions"
                color={C.green}
              />
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>By department</Text>
              {byStation.length === 0 ? (
                <Text style={{ color: C.graphite }}>No work in this range.</Text>
              ) : (
                byStation.map((s) => (
                  <View key={s.station} style={styles.stationBlock} wrap={false}>
                    <Text style={styles.stationName}>{s.station}</Text>
                    <View style={styles.stationGrid}>
                      {[
                        ["Worked", s.worked, C.ink],
                        ["Waste", (s.waste || 0) + (s.ship_waste || 0), C.rust],
                        ["Pending ship", s.pending_ship, C.graphite],
                        ["Ready pay", s.ready_pay, C.gold],
                        ["Paid", s.paid, C.green],
                      ].map(([lab, val, col]) => (
                        <View key={lab} style={styles.chip}>
                          <Text style={styles.chipLabel}>{lab}</Text>
                          <Text style={[styles.chipVal, { color: col }]}>{fmtQty(val)}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ))
              )}
            </View>
          </>
        ) : (
          <>
            <View style={styles.cards}>
              <View style={[styles.card, { backgroundColor: C.goldSoft }]}>
                <Text style={[styles.cardLabel, { color: C.gold }]}>Net payable</Text>
                <Text style={styles.cardValue}>{fmtPKR(story.net_pay)}</Text>
              </View>
              <View style={[styles.card, { backgroundColor: C.boneDim }]}>
                <Text style={[styles.cardLabel, { color: C.graphite }]}>Settled unpaid</Text>
                <Text style={styles.cardValue}>{fmtPKR(story.settled_unlocked)}</Text>
              </View>
              <View style={[styles.card, { backgroundColor: C.greenSoft }]}>
                <Text style={[styles.cardLabel, { color: C.green }]}>Already paid</Text>
                <Text style={styles.cardValue}>{fmtPKR(story.already_paid_out)}</Text>
              </View>
              <View style={[styles.card, { backgroundColor: C.boneDim }]}>
                <Text style={[styles.cardLabel, { color: C.graphite }]}>Waiting ship</Text>
                <Text style={styles.cardValue}>{fmtPKR(story.waiting_on_ship)}</Text>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Money story</Text>
              {[
                ["Raw production logged", fmtPKR(story.raw_logged), C.ink],
                ["Already paid out", fmtPKR(story.already_paid_out), C.green],
                ["Waiting on shipment", fmtPKR(story.waiting_on_ship), C.graphite],
                ["Settled unpaid (bill now)", fmtPKR(story.settled_unlocked), C.gold],
                ["− Installment", `−${fmtPKR(story.installment_deduct)}`, C.rust],
                ["− Advance", `−${fmtPKR(story.advance_deduct)}`, C.rust],
                ["Net take-home now", fmtPKR(story.net_pay), C.green],
              ].map(([lab, val, col]) => (
                <View key={lab} style={styles.row}>
                  <Text style={styles.label}>{lab}</Text>
                  <Text style={[styles.value, { color: col }]}>{val}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        <Text style={styles.footer}>
          Generated for shop floor matching · defects + ship waste shown separately · not a legal payslip
        </Text>
      </Page>
    </Document>
  );
}
