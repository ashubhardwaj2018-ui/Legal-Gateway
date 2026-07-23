import { Router, type IRouter } from "express";
import { eq, count, and, gte, lte, desc } from "drizzle-orm";
import {
  db,
  consultationsTable,
  invoicesTable,
  tasksTable,
  leadActivitiesTable,
  teamMembersTable,
} from "@workspace/db";

const router: IRouter = Router();

router.get("/admin/dashboard", async (_req, res): Promise<void> => {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart.getTime() + 86400000);

  // ── Leads ───────────────────────────────────────────────────────
  const [allLeads, todayLeads] = await Promise.all([
    db.select().from(consultationsTable),
    db.select({ value: count() }).from(consultationsTable)
      .where(and(gte(consultationsTable.createdAt, todayStart), lte(consultationsTable.createdAt, todayEnd))),
  ]);

  const leadsByStatus: Record<string, number> = {};
  const leadsBySource: Record<string, number> = {};
  let totalExpectedRevenue = 0;
  let wonRevenue = 0;

  for (const lead of allLeads) {
    const s = lead.status ?? "new";
    leadsByStatus[s] = (leadsByStatus[s] ?? 0) + 1;
    const src = lead.source ?? "website";
    leadsBySource[src] = (leadsBySource[src] ?? 0) + 1;
    if (lead.expectedRevenue) totalExpectedRevenue += parseFloat(lead.expectedRevenue) || 0;
    if (s === "won" && lead.expectedRevenue) wonRevenue += parseFloat(lead.expectedRevenue) || 0;
  }

  const won = leadsByStatus["won"] ?? 0;
  const total = allLeads.length;
  const conversionRate = total > 0 ? Math.round((won / total) * 100) : 0;

  // ── Invoices / Revenue ──────────────────────────────────────────
  const allInvoices = await db.select().from(invoicesTable).where(eq(invoicesTable.type, "invoice"));
  const monthLabels: string[] = [];
  const monthlyMap: Record<string, { revenue: number; collected: number; month: string }> = {};

  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
    monthLabels.push(key);
    monthlyMap[key] = { revenue: 0, collected: 0, month: label };
  }

  let totalRevenue = 0, collectedRevenue = 0;
  const today = now.toISOString().slice(0, 10);
  let overdueCount = 0;

  for (const inv of allInvoices) {
    const total = parseFloat(inv.total ?? "0");
    const paid = parseFloat(inv.paidAmount ?? "0");
    totalRevenue += total;
    collectedRevenue += paid;
    if (inv.dueDate && inv.dueDate < today && inv.status !== "paid" && inv.status !== "cancelled") overdueCount++;
    const d = new Date(inv.createdAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (monthlyMap[key]) {
      monthlyMap[key].revenue += total;
      monthlyMap[key].collected += paid;
    }
  }

  // ── Tasks ───────────────────────────────────────────────────────
  const allTasks = await db.select().from(tasksTable);
  const tasksByStatus: Record<string, number> = {};
  let overdueTasks = 0;
  for (const t of allTasks) {
    const s = t.status ?? "todo";
    tasksByStatus[s] = (tasksByStatus[s] ?? 0) + 1;
    if (t.dueDate && t.dueDate < today && s !== "done") overdueTasks++;
  }

  // ── Upcoming follow-ups ────────────────────────────────────────
  const sevenDaysLater = new Date(now.getTime() + 7 * 86400000);
  const upcomingFollowUps = await db.select({
    id: consultationsTable.id,
    name: consultationsTable.name,
    company: consultationsTable.company,
    serviceInterest: consultationsTable.serviceInterest,
    assignedTo: consultationsTable.assignedTo,
    nextFollowUp: consultationsTable.nextFollowUp,
    status: consultationsTable.status,
    priority: consultationsTable.priority,
    phone: consultationsTable.phone,
  }).from(consultationsTable)
    .where(and(
      gte(consultationsTable.nextFollowUp, now),
      lte(consultationsTable.nextFollowUp, sevenDaysLater),
    ))
    .orderBy(consultationsTable.nextFollowUp)
    .limit(10);

  // ── Recent activity ────────────────────────────────────────────
  const recentActivity = await db.select().from(leadActivitiesTable)
    .orderBy(desc(leadActivitiesTable.createdAt)).limit(12);

  // ── Team ───────────────────────────────────────────────────────
  const [teamCount] = await db.select({ value: count() }).from(teamMembersTable).where(eq(teamMembersTable.status, "active"));

  // ── Build response ─────────────────────────────────────────────
  res.json({
    leads: {
      total,
      today: todayLeads[0]?.value ?? 0,
      new: leadsByStatus["new"] ?? 0,
      contacted: leadsByStatus["contacted"] ?? 0,
      pending: leadsByStatus["pending"] ?? 0,
      won,
      lost: leadsByStatus["lost"] ?? 0,
      hold: leadsByStatus["hold"] ?? 0,
      byStatus: leadsByStatus,
    },
    revenue: {
      total: totalRevenue.toFixed(0),
      collected: collectedRevenue.toFixed(0),
      outstanding: Math.max(0, totalRevenue - collectedRevenue).toFixed(0),
      wonRevenue: wonRevenue.toFixed(0),
      overdueInvoices: overdueCount,
      monthly: Object.values(monthlyMap).map(m => ({
        month: m.month,
        revenue: Math.round(m.revenue),
        collected: Math.round(m.collected),
      })),
    },
    tasks: {
      total: allTasks.length,
      todo: tasksByStatus["todo"] ?? 0,
      inProgress: tasksByStatus["in_progress"] ?? 0,
      done: tasksByStatus["done"] ?? 0,
      overdue: overdueTasks,
    },
    leadSources: Object.entries(leadsBySource)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value })),
    leadFunnel: [
      { status: "New", count: leadsByStatus["new"] ?? 0, color: "#6366f1" },
      { status: "Contacted", count: leadsByStatus["contacted"] ?? 0, color: "#3b82f6" },
      { status: "Pending", count: leadsByStatus["pending"] ?? 0, color: "#f59e0b" },
      { status: "Meeting", count: leadsByStatus["meeting_scheduled"] ?? 0, color: "#8b5cf6" },
      { status: "Proposal", count: leadsByStatus["proposal_sent"] ?? 0, color: "#06b6d4" },
      { status: "Negotiation", count: leadsByStatus["negotiation"] ?? 0, color: "#f97316" },
      { status: "Won", count: won, color: "#22c55e" },
      { status: "Lost", count: leadsByStatus["lost"] ?? 0, color: "#ef4444" },
    ].filter(s => s.count > 0),
    conversionRate,
    teamCount: teamCount?.value ?? 0,
    upcomingFollowUps,
    recentActivity,
  });
});

export default router;
