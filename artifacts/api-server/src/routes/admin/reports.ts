import { Router, type IRouter } from "express";
import { gte, lte, and, eq } from "drizzle-orm";
import { db, consultationsTable, invoicesTable, invoicePaymentsTable, tasksTable, teamMembersTable } from "@workspace/db";

const router: IRouter = Router();

function parseRange(from?: string, to?: string) {
  const start = from ? new Date(from + "T00:00:00Z") : new Date(new Date().getFullYear(), 0, 1);
  const end = to ? new Date(to + "T23:59:59Z") : new Date();
  return { start, end };
}

function toCsv(headers: string[], rows: string[][]): string {
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  return [headers.map(escape).join(","), ...rows.map(r => r.map(escape).join(","))].join("\n");
}

// ── Lead Report ───────────────────────────────────────────────────────────────
router.get("/admin/reports/leads", async (req, res): Promise<void> => {
  const { from, to } = req.query as Record<string, string | undefined>;
  const { start, end } = parseRange(from, to);

  const leads = await db.select().from(consultationsTable)
    .where(and(gte(consultationsTable.createdAt, start), lte(consultationsTable.createdAt, end)));

  const byStatus: Record<string, number> = {};
  const bySource: Record<string, number> = {};
  const byAssignee: Record<string, number> = {};
  const byMonth: Record<string, { total: number; won: number; lost: number }> = {};
  let totalExpected = 0;
  let wonExpected = 0;

  for (const l of leads) {
    byStatus[l.status] = (byStatus[l.status] ?? 0) + 1;
    const src = l.source ?? "website";
    bySource[src] = (bySource[src] ?? 0) + 1;
    const assignee = l.assignedTo ?? "Unassigned";
    byAssignee[assignee] = (byAssignee[assignee] ?? 0) + 1;
    const mkey = new Date(l.createdAt).toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
    if (!byMonth[mkey]) byMonth[mkey] = { total: 0, won: 0, lost: 0 };
    byMonth[mkey].total++;
    if (l.status === "won") byMonth[mkey].won++;
    if (l.status === "lost") byMonth[mkey].lost++;
    if (l.expectedRevenue) totalExpected += parseFloat(l.expectedRevenue) || 0;
    if (l.status === "won" && l.expectedRevenue) wonExpected += parseFloat(l.expectedRevenue) || 0;
  }

  const won = byStatus["won"] ?? 0;
  const lost = byStatus["lost"] ?? 0;
  const total = leads.length;
  const conversionRate = total > 0 ? ((won / total) * 100).toFixed(1) : "0.0";

  res.json({
    total, won, lost,
    pending: byStatus["pending"] ?? 0,
    contacted: byStatus["contacted"] ?? 0,
    conversionRate,
    totalExpectedRevenue: totalExpected.toFixed(0),
    wonRevenue: wonExpected.toFixed(0),
    byStatus: Object.entries(byStatus).map(([status, count]) => ({ status, count })).sort((a, b) => b.count - a.count),
    bySource: Object.entries(bySource).map(([source, count]) => ({ source, count })).sort((a, b) => b.count - a.count),
    byAssignee: Object.entries(byAssignee).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
    byMonth: Object.entries(byMonth).map(([month, v]) => ({ month, ...v })),
    leads: leads.slice(0, 500).map(l => ({
      id: l.id, name: l.name, email: l.email, phone: l.phone, company: l.company,
      service: l.serviceInterest, status: l.status, source: l.source,
      assignedTo: l.assignedTo, priority: l.priority,
      expectedRevenue: l.expectedRevenue, probability: l.probability,
      createdAt: new Date(l.createdAt).toLocaleDateString("en-IN"),
    })),
  });
});

// ── Revenue Report ────────────────────────────────────────────────────────────
router.get("/admin/reports/revenue", async (req, res): Promise<void> => {
  const { from, to } = req.query as Record<string, string | undefined>;
  const { start, end } = parseRange(from, to);

  const invoices = await db.select().from(invoicesTable)
    .where(and(gte(invoicesTable.createdAt, start), lte(invoicesTable.createdAt, end)));
  const payments = await db.select().from(invoicePaymentsTable)
    .where(and(gte(invoicePaymentsTable.createdAt, start), lte(invoicePaymentsTable.createdAt, end)));

  const today = new Date().toISOString().slice(0, 10);
  let totalBilled = 0, totalPaid = 0, totalGST = 0, overdueAmt = 0;
  const byType: Record<string, { count: number; amount: number }> = {};
  const byStatus: Record<string, { count: number; amount: number }> = {};
  const byMonth: Record<string, { billed: number; collected: number }> = {};
  const byMode: Record<string, number> = {};

  for (const inv of invoices) {
    const amt = parseFloat(inv.total ?? "0");
    const paid = parseFloat(inv.paidAmount ?? "0");
    const gst = parseFloat(inv.gstAmount ?? "0");
    totalBilled += amt;
    totalPaid += paid;
    totalGST += gst;
    if (inv.dueDate && inv.dueDate < today && inv.status !== "paid" && inv.status !== "cancelled") overdueAmt += (amt - paid);

    const mkey = new Date(inv.createdAt).toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
    if (!byMonth[mkey]) byMonth[mkey] = { billed: 0, collected: 0 };
    byMonth[mkey].billed += amt;
    byMonth[mkey].collected += paid;

    const t = inv.type ?? "invoice";
    if (!byType[t]) byType[t] = { count: 0, amount: 0 };
    byType[t].count++;
    byType[t].amount += amt;

    const s = inv.status ?? "draft";
    if (!byStatus[s]) byStatus[s] = { count: 0, amount: 0 };
    byStatus[s].count++;
    byStatus[s].amount += amt;
  }

  for (const p of payments) {
    const mode = p.mode ?? "cash";
    byMode[mode] = (byMode[mode] ?? 0) + parseFloat(p.amount ?? "0");
  }

  res.json({
    totalBilled: totalBilled.toFixed(2),
    totalPaid: totalPaid.toFixed(2),
    outstanding: (totalBilled - totalPaid).toFixed(2),
    totalGST: totalGST.toFixed(2),
    overdueAmount: overdueAmt.toFixed(2),
    totalInvoices: invoices.length,
    byType: Object.entries(byType).map(([type, v]) => ({ type, ...v })),
    byStatus: Object.entries(byStatus).map(([status, v]) => ({ status, ...v })),
    byMonth: Object.entries(byMonth).map(([month, v]) => ({ month, ...v })),
    byPaymentMode: Object.entries(byMode).map(([mode, amount]) => ({ mode, amount })),
    invoices: invoices.slice(0, 500).map(inv => ({
      number: inv.number, type: inv.type, status: inv.status,
      clientName: inv.clientName, clientGST: inv.clientGST,
      subtotal: inv.subtotal, gstAmount: inv.gstAmount, total: inv.total,
      paidAmount: inv.paidAmount, dueDate: inv.dueDate,
      createdAt: new Date(inv.createdAt).toLocaleDateString("en-IN"),
    })),
  });
});

// ── GST Report ────────────────────────────────────────────────────────────────
router.get("/admin/reports/gst", async (req, res): Promise<void> => {
  const { from, to } = req.query as Record<string, string | undefined>;
  const { start, end } = parseRange(from, to);

  const invoices = await db.select().from(invoicesTable)
    .where(and(gte(invoicesTable.createdAt, start), lte(invoicesTable.createdAt, end), eq(invoicesTable.type, "invoice")));

  let totalTaxable = 0, totalGST = 0, totalCGST = 0, totalSGST = 0, totalIGST = 0;
  const byRate: Record<string, { taxable: number; gst: number; count: number }> = {};
  const records = [];

  for (const inv of invoices) {
    if (inv.status === "cancelled") continue;
    const gst = parseFloat(inv.gstAmount ?? "0");
    const subtotal = parseFloat(inv.subtotal ?? "0");
    const disc = parseFloat(inv.discount ?? "0");
    const discType = inv.discountType ?? "fixed";
    const taxable = discType === "percent" ? subtotal * (1 - disc / 100) : subtotal - disc;

    totalTaxable += taxable;
    totalGST += gst;

    const isInterState = inv.clientState && !["Delhi", "New Delhi"].includes(inv.clientState ?? "");
    if (isInterState) { totalIGST += gst; } else { totalCGST += gst / 2; totalSGST += gst / 2; }

    // Group by GST rate from items
    const items = Array.isArray(inv.items) ? inv.items as Array<{ qty: number; rate: number; gstRate: number }> : [];
    for (const item of items) {
      const base = (item.qty ?? 0) * (item.rate ?? 0);
      const rate = String(item.gstRate ?? 0);
      if (!byRate[rate]) byRate[rate] = { taxable: 0, gst: 0, count: 0 };
      byRate[rate].taxable += base;
      byRate[rate].gst += base * (item.gstRate ?? 0) / 100;
      byRate[rate].count++;
    }

    records.push({
      number: inv.number, date: new Date(inv.createdAt).toLocaleDateString("en-IN"),
      clientName: inv.clientName, clientGST: inv.clientGST ?? "—",
      taxable: taxable.toFixed(2), gst: gst.toFixed(2),
      cgst: isInterState ? "0.00" : (gst / 2).toFixed(2),
      sgst: isInterState ? "0.00" : (gst / 2).toFixed(2),
      igst: isInterState ? gst.toFixed(2) : "0.00",
      total: inv.total, status: inv.status,
    });
  }

  res.json({
    totalTaxable: totalTaxable.toFixed(2),
    totalGST: totalGST.toFixed(2),
    totalCGST: totalCGST.toFixed(2),
    totalSGST: totalSGST.toFixed(2),
    totalIGST: totalIGST.toFixed(2),
    byRate: Object.entries(byRate).map(([rate, v]) => ({ rate: `${rate}%`, ...v })).sort((a, b) => parseFloat(a.rate) - parseFloat(b.rate)),
    records,
  });
});

// ── Task Report ───────────────────────────────────────────────────────────────
router.get("/admin/reports/tasks", async (req, res): Promise<void> => {
  const { from, to } = req.query as Record<string, string | undefined>;
  const { start, end } = parseRange(from, to);

  const tasks = await db.select().from(tasksTable)
    .where(and(gte(tasksTable.createdAt, start), lte(tasksTable.createdAt, end)));

  const today = new Date().toISOString().slice(0, 10);
  const byStatus: Record<string, number> = {};
  const byPriority: Record<string, number> = {};
  const byAssignee: Record<string, { total: number; done: number; overdue: number }> = {};

  for (const t of tasks) {
    byStatus[t.status] = (byStatus[t.status] ?? 0) + 1;
    byPriority[t.priority] = (byPriority[t.priority] ?? 0) + 1;
    const name = t.assignedToName ?? "Unassigned";
    if (!byAssignee[name]) byAssignee[name] = { total: 0, done: 0, overdue: 0 };
    byAssignee[name].total++;
    if (t.status === "done") byAssignee[name].done++;
    if (t.dueDate && t.dueDate < today && t.status !== "done") byAssignee[name].overdue++;
  }

  res.json({
    total: tasks.length,
    done: byStatus["done"] ?? 0,
    inProgress: byStatus["in_progress"] ?? 0,
    todo: byStatus["todo"] ?? 0,
    overdue: tasks.filter(t => t.dueDate && t.dueDate < today && t.status !== "done").length,
    completionRate: tasks.length > 0 ? (((byStatus["done"] ?? 0) / tasks.length) * 100).toFixed(1) : "0.0",
    byStatus: Object.entries(byStatus).map(([status, count]) => ({ status, count })),
    byPriority: Object.entries(byPriority).map(([priority, count]) => ({ priority, count })),
    byAssignee: Object.entries(byAssignee).map(([name, v]) => ({
      name, ...v,
      completionRate: v.total > 0 ? Math.round((v.done / v.total) * 100) : 0,
    })).sort((a, b) => b.total - a.total),
  });
});

// ── CSV Export ────────────────────────────────────────────────────────────────
router.get("/admin/reports/export", async (req, res): Promise<void> => {
  const { module: mod, from, to } = req.query as Record<string, string | undefined>;
  const { start, end } = parseRange(from, to);

  let csv = "";
  let filename = "report.csv";

  if (mod === "leads") {
    const leads = await db.select().from(consultationsTable)
      .where(and(gte(consultationsTable.createdAt, start), lte(consultationsTable.createdAt, end)));
    csv = toCsv(
      ["ID", "Name", "Email", "Phone", "Company", "Service", "Status", "Source", "Priority", "Assigned To", "Expected Revenue", "Probability", "Created Date"],
      leads.map(l => [String(l.id), l.name, l.email, l.phone, l.company ?? "", l.serviceInterest, l.status, l.source ?? "", l.priority ?? "", l.assignedTo ?? "", l.expectedRevenue ?? "", String(l.probability ?? ""), new Date(l.createdAt).toLocaleDateString("en-IN")])
    );
    filename = `leads-report-${from ?? "all"}.csv`;
  } else if (mod === "revenue") {
    const invoices = await db.select().from(invoicesTable)
      .where(and(gte(invoicesTable.createdAt, start), lte(invoicesTable.createdAt, end)));
    csv = toCsv(
      ["Invoice No", "Type", "Status", "Client Name", "Client GST", "Date", "Subtotal", "GST", "Total", "Paid", "Outstanding", "Due Date"],
      invoices.map(inv => [inv.number, inv.type, inv.status, inv.clientName, inv.clientGST ?? "", new Date(inv.createdAt).toLocaleDateString("en-IN"), inv.subtotal ?? "0", inv.gstAmount ?? "0", inv.total ?? "0", inv.paidAmount ?? "0", String((parseFloat(inv.total ?? "0") - parseFloat(inv.paidAmount ?? "0")).toFixed(2)), inv.dueDate ?? ""])
    );
    filename = `revenue-report-${from ?? "all"}.csv`;
  } else if (mod === "gst") {
    const invoices = await db.select().from(invoicesTable)
      .where(and(gte(invoicesTable.createdAt, start), lte(invoicesTable.createdAt, end), eq(invoicesTable.type, "invoice")));
    csv = toCsv(
      ["Invoice No", "Date", "Client Name", "Client GSTIN", "Taxable Amount", "CGST", "SGST", "IGST", "Total GST", "Invoice Total"],
      invoices.filter(i => i.status !== "cancelled").map(inv => {
        const gst = parseFloat(inv.gstAmount ?? "0");
        const isInterState = !["Delhi", "New Delhi"].includes(inv.clientState ?? "");
        return [inv.number, new Date(inv.createdAt).toLocaleDateString("en-IN"), inv.clientName, inv.clientGST ?? "", inv.subtotal ?? "0", isInterState ? "0" : (gst / 2).toFixed(2), isInterState ? "0" : (gst / 2).toFixed(2), isInterState ? gst.toFixed(2) : "0", gst.toFixed(2), inv.total ?? "0"];
      })
    );
    filename = `gst-report-${from ?? "all"}.csv`;
  } else if (mod === "tasks") {
    const tasks = await db.select().from(tasksTable)
      .where(and(gte(tasksTable.createdAt, start), lte(tasksTable.createdAt, end)));
    csv = toCsv(
      ["ID", "Title", "Status", "Priority", "Assigned To", "Due Date", "Created Date"],
      tasks.map(t => [String(t.id), t.title, t.status, t.priority, t.assignedToName ?? "", t.dueDate ?? "", new Date(t.createdAt).toLocaleDateString("en-IN")])
    );
    filename = `tasks-report-${from ?? "all"}.csv`;
  } else {
    res.status(400).json({ error: "Invalid module. Use: leads, revenue, gst, tasks" });
    return;
  }

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(csv);
});

export default router;
