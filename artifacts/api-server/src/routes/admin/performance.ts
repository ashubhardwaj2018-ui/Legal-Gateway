import { Router, type IRouter } from "express";
import { eq, and, gte, lte, inArray } from "drizzle-orm";
import {
  db,
  consultationsTable,
  leadAssignmentsTable,
  leadTimelineTable,
  leadTasksTable,
  teamMembersTable,
} from "@workspace/db";
import type { AuthenticatedRequest } from "./auth";

const router: IRouter = Router();

function parseRange(range?: string, from?: string, to?: string): { start: Date; end: Date } {
  const now = new Date();
  if (range === "today") {
    const s = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return { start: s, end: new Date(s.getTime() + 86400000) };
  }
  if (range === "week") {
    const day = now.getDay();
    const s = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day);
    return { start: s, end: now };
  }
  if (range === "custom" && from && to) {
    return { start: new Date(from + "T00:00:00Z"), end: new Date(to + "T23:59:59Z") };
  }
  // default: this month
  return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: now };
}

// ── GET /admin/performance/me — personal KPIs ─────────────────────────────────
router.get("/admin/performance/me", async (req: AuthenticatedRequest, res): Promise<void> => {
  const userId = typeof req.adminUser?.userId === "number" ? req.adminUser.userId : null;
  if (!userId) { res.status(401).json({ error: "Not authenticated" }); return; }

  const { range, from, to } = req.query as Record<string, string>;
  const { start, end } = parseRange(range, from, to);

  // Active assignments for this employee
  const assignments = await db.select()
    .from(leadAssignmentsTable)
    .where(and(eq(leadAssignmentsTable.assignedToId, userId), eq(leadAssignmentsTable.status, "active")));

  const leadIds = [...new Set(assignments.map(a => a.leadId))];

  // Lead details for assigned leads
  const leads = leadIds.length
    ? await db.select().from(consultationsTable).where(inArray(consultationsTable.id, leadIds))
    : [];

  const won = leads.filter(l => l.status === "won");
  const lost = leads.filter(l => l.status === "lost");
  const pending = leads.filter(l => !["won", "lost"].includes(l.status));
  const wonRevenue = won.reduce((s, l) => s + (parseFloat(l.expectedRevenue ?? "0") || 0), 0);
  const conversionRate = leads.length > 0 ? Math.round((won.length / leads.length) * 100) : 0;

  // Timeline events for assigned leads within date range
  const timeline = leadIds.length
    ? await db.select().from(leadTimelineTable)
        .where(and(
          inArray(leadTimelineTable.leadId, leadIds),
          eq(leadTimelineTable.actorId, userId),
          gte(leadTimelineTable.createdAt, start),
          lte(leadTimelineTable.createdAt, end),
        ))
    : [];

  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const todayEnd = new Date(todayStart.getTime() + 86400000);

  const todayFollowUps = leadIds.length
    ? await db.select().from(leadTimelineTable)
        .where(and(
          inArray(leadTimelineTable.leadId, leadIds),
          eq(leadTimelineTable.actionType, "followup_added"),
          gte(leadTimelineTable.createdAt, todayStart),
          lte(leadTimelineTable.createdAt, todayEnd),
        ))
    : [];

  // Pending tasks for assigned leads
  const pendingTasks = leadIds.length
    ? await db.select().from(leadTasksTable)
        .where(and(
          inArray(leadTasksTable.leadId, leadIds),
          eq(leadTasksTable.status, "pending"),
        ))
    : [];

  const calls = timeline.filter(t => t.actionType === "call_recorded").length;
  const meetings = timeline.filter(t => t.actionType === "meeting_scheduled").length;
  const followups = timeline.filter(t => t.actionType === "followup_added").length;
  const documents = timeline.filter(t => t.actionType === "document_uploaded").length;

  // Monthly target: leads to close this month (fixed target of 5 for now)
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const wonThisMonth = won.filter(l => {
    const ua = new Date(l.updatedAt);
    return ua >= monthStart;
  }).length;

  // Performance chart: leads closed (won) per week for last 8 weeks
  const chartWeeks: Array<{ label: string; won: number; total: number }> = [];
  for (let i = 7; i >= 0; i--) {
    const weekEnd = new Date(todayStart.getTime() - i * 7 * 86400000);
    const weekStart = new Date(weekEnd.getTime() - 7 * 86400000);
    const label = `${weekStart.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`;
    // Won during this week based on timeline status_changed entries
    const wonInWeek = leadIds.length
      ? await db.select().from(leadTimelineTable)
          .where(and(
            inArray(leadTimelineTable.leadId, leadIds),
            eq(leadTimelineTable.actionType, "status_changed"),
            gte(leadTimelineTable.createdAt, weekStart),
            lte(leadTimelineTable.createdAt, weekEnd),
          ))
      : [];
    const wonCount = wonInWeek.filter(t => t.description.toLowerCase().includes("won")).length;
    chartWeeks.push({ label, won: wonCount, total: wonInWeek.length });
  }

  res.json({
    assignedLeads: leads.length,
    todayFollowUps: todayFollowUps.length,
    pendingTasks: pendingTasks.length,
    upcomingMeetings: meetings,
    wonLeads: won.length,
    lostLeads: lost.length,
    pendingLeads: pending.length,
    revenueGenerated: wonRevenue,
    conversionRate,
    calls,
    meetings,
    followups,
    documents,
    wonThisMonth,
    monthlyTarget: 5,
    chart: chartWeeks,
    range: { start: start.toISOString(), end: end.toISOString() },
  });
});

// ── GET /admin/performance/team — team summary (admin/manager only) ───────────
router.get("/admin/performance/team", async (req: AuthenticatedRequest, res): Promise<void> => {
  const { range, from, to } = req.query as Record<string, string>;
  const { start, end } = parseRange(range, from, to);

  const perms = (req as { permissions?: { all: boolean; map: Record<string, Record<string, boolean>> } }).permissions;
  const isEmployee = req.adminUser?.userType === "employee";
  const canViewTeam = !isEmployee || perms?.all || perms?.map["team"]?.["view"] || perms?.map["team"]?.["manage"] || perms?.map["leads"]?.["manage"];
  if (!canViewTeam) { res.status(403).json({ error: "Insufficient permissions" }); return; }

  // All team members
  const members = await db.select().from(teamMembersTable).where(eq(teamMembersTable.status, "active"));

  // All lead assignments with lead details
  const allAssignments = await db.select().from(leadAssignmentsTable)
    .where(eq(leadAssignmentsTable.status, "active"));

  const allLeadIds = [...new Set(allAssignments.map(a => a.leadId))];
  const allLeads = allLeadIds.length
    ? await db.select().from(consultationsTable).where(inArray(consultationsTable.id, allLeadIds))
    : [];

  const leadMap = new Map(allLeads.map(l => [l.id, l]));

  // Timeline events within date range (for all members)
  const allMemberIds = members.map(m => m.id);
  const timeline = allMemberIds.length
    ? await db.select().from(leadTimelineTable)
        .where(and(
          gte(leadTimelineTable.createdAt, start),
          lte(leadTimelineTable.createdAt, end),
        ))
    : [];

  // Build per-member stats
  const rows = members.map(member => {
    const myAssignments = allAssignments.filter(a => a.assignedToId === member.id);
    const myLeadIds = new Set(myAssignments.map(a => a.leadId));
    const myLeads = allLeads.filter(l => myLeadIds.has(l.id));
    const myWon = myLeads.filter(l => l.status === "won");
    const myLost = myLeads.filter(l => l.status === "lost");
    const myPending = myLeads.filter(l => !["won", "lost"].includes(l.status));
    const revenue = myWon.reduce((s, l) => s + (parseFloat(l.expectedRevenue ?? "0") || 0), 0);
    const rate = myLeads.length > 0 ? Math.round((myWon.length / myLeads.length) * 100) : 0;

    const myTimeline = timeline.filter(t => t.actorId === member.id && myLeadIds.has(t.leadId));

    return {
      id: member.id,
      name: member.name,
      designation: member.designation ?? "",
      leadsAssigned: myLeads.length,
      leadsWon: myWon.length,
      leadsLost: myLost.length,
      leadsPending: myPending.length,
      revenueGenerated: revenue,
      conversionRate: rate,
      calls: myTimeline.filter(t => t.actionType === "call_recorded").length,
      meetings: myTimeline.filter(t => t.actionType === "meeting_scheduled").length,
      followups: myTimeline.filter(t => t.actionType === "followup_added").length,
      documents: myTimeline.filter(t => t.actionType === "document_uploaded").length,
    };
  });

  res.json({ rows, range: { start: start.toISOString(), end: end.toISOString() } });
});

// ── GET /admin/performance/chart/:employeeId — time series for employee ────────
router.get("/admin/performance/chart/:employeeId", async (req: AuthenticatedRequest, res): Promise<void> => {
  const employeeId = parseInt(req.params.employeeId as string, 10);
  if (isNaN(employeeId)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  const assignments = await db.select({ leadId: leadAssignmentsTable.leadId })
    .from(leadAssignmentsTable)
    .where(and(eq(leadAssignmentsTable.assignedToId, employeeId), eq(leadAssignmentsTable.status, "active")));
  const leadIds = [...new Set(assignments.map(a => a.leadId))];

  const chart: Array<{ label: string; won: number; activities: number }> = [];
  for (let i = 7; i >= 0; i--) {
    const weekEnd = new Date(todayStart.getTime() - i * 7 * 86400000);
    const weekStart = new Date(weekEnd.getTime() - 7 * 86400000);
    const label = weekStart.toLocaleDateString("en-IN", { day: "numeric", month: "short" });

    const events = leadIds.length
      ? await db.select().from(leadTimelineTable)
          .where(and(
            inArray(leadTimelineTable.leadId, leadIds),
            eq(leadTimelineTable.actorId, employeeId),
            gte(leadTimelineTable.createdAt, weekStart),
            lte(leadTimelineTable.createdAt, weekEnd),
          ))
      : [];

    const won = events.filter(e => e.actionType === "status_changed" && e.description.toLowerCase().includes("won")).length;
    chart.push({ label, won, activities: events.length });
  }

  res.json({ chart });
});

export default router;
