import { Router, type IRouter } from "express";
import { eq, and, gte, lte, inArray, isNotNull, ne } from "drizzle-orm";
import {
  db,
  consultationsTable,
  leadAssignmentsTable,
  leadTimelineTable,
  leadTasksTable,
  teamMembersTable,
  quotationsTable,
  chatMessagesTable,
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
  return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: now };
}

// ── GET /admin/performance/me — personal KPIs ─────────────────────────────────
router.get("/admin/performance/me", async (req: AuthenticatedRequest, res): Promise<void> => {
  const userId = typeof req.adminUser?.userId === "number" ? req.adminUser.userId : null;
  if (!userId) { res.status(401).json({ error: "Not authenticated" }); return; }

  const { range, from, to } = req.query as Record<string, string>;
  const { start, end } = parseRange(range, from, to);

  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const todayEnd = new Date(todayStart.getTime() + 86400000);

  // Get employee record for name-based chat attribution
  const [member] = await db.select({ id: teamMembersTable.id, name: teamMembersTable.name })
    .from(teamMembersTable).where(eq(teamMembersTable.id, userId));

  // Active assignments for this employee (all time — total portfolio)
  const assignments = await db.select()
    .from(leadAssignmentsTable)
    .where(and(eq(leadAssignmentsTable.assignedToId, userId), eq(leadAssignmentsTable.status, "active")));
  const leadIds = [...new Set(assignments.map(a => a.leadId))];

  // All assigned lead details (current status for total counts)
  const leads = leadIds.length
    ? await db.select().from(consultationsTable).where(inArray(consultationsTable.id, leadIds))
    : [];
  const leadEmailSet = new Set(leads.map(l => l.email));

  // Period-scoped timeline events for this employee's leads
  const periodTimeline = leadIds.length
    ? await db.select().from(leadTimelineTable)
        .where(and(
          inArray(leadTimelineTable.leadId, leadIds),
          eq(leadTimelineTable.actorId, userId),
          gte(leadTimelineTable.createdAt, start),
          lte(leadTimelineTable.createdAt, end),
        ))
    : [];

  // Core KPIs scoped to the selected date range using status_changed timeline events
  const periodStatusChanges = periodTimeline.filter(t => t.actionType === "status_changed");
  const wonInPeriod = periodStatusChanges.filter(t => t.description.toLowerCase().includes("won"));
  const lostInPeriod = periodStatusChanges.filter(t => t.description.toLowerCase().includes("lost"));

  // De-duplicate by leadId (take most recent status change per lead in period)
  const wonLeadIdsInPeriod = [...new Set(wonInPeriod.map(t => t.leadId))];
  const lostLeadIdsInPeriod = [...new Set(lostInPeriod.map(t => t.leadId))];

  // Revenue from leads won in period
  const wonLeadsInPeriod = leads.filter(l => wonLeadIdsInPeriod.includes(l.id));
  const revenueInPeriod = wonLeadsInPeriod.reduce((s, l) => s + (parseFloat(l.expectedRevenue ?? "0") || 0), 0);

  // Conversion rate = won in period / (won + lost in period)
  const closedInPeriod = wonLeadIdsInPeriod.length + lostLeadIdsInPeriod.length;
  const conversionRate = closedInPeriod > 0 ? Math.round((wonLeadIdsInPeriod.length / closedInPeriod) * 100) : 0;

  // Pending: assigned leads not won/lost
  const closedLeadIds = new Set([...wonLeadIdsInPeriod, ...lostLeadIdsInPeriod]);
  const pendingLeads = leads.filter(l => !["won", "lost"].includes(l.status)).length;

  // Activity counts in period
  const calls = periodTimeline.filter(t => t.actionType === "call_recorded").length;
  const meetings = periodTimeline.filter(t => t.actionType === "meeting_scheduled").length;
  const followups = periodTimeline.filter(t => t.actionType === "followup_added").length;
  const documents = periodTimeline.filter(t => t.actionType === "document_uploaded").length;

  // Today's follow-ups
  const todayFollowUps = periodTimeline.filter(t => {
    const d = new Date(t.createdAt);
    return t.actionType === "followup_added" && d >= todayStart && d < todayEnd;
  }).length;

  // Upcoming meetings: meeting_scheduled entries from last 30 days
  const thirtyDaysAgo = new Date(today.getTime() - 30 * 86400000);
  const upcomingMeetings = leadIds.length
    ? await db.select({ id: leadTimelineTable.id })
        .from(leadTimelineTable)
        .where(and(
          inArray(leadTimelineTable.leadId, leadIds),
          eq(leadTimelineTable.actorId, userId),
          eq(leadTimelineTable.actionType, "meeting_scheduled"),
          gte(leadTimelineTable.createdAt, thirtyDaysAgo),
        ))
    : [];

  // Pending tasks for assigned leads
  const pendingTasks = leadIds.length
    ? await db.select({ id: leadTasksTable.id })
        .from(leadTasksTable)
        .where(and(
          inArray(leadTasksTable.leadId, leadIds),
          eq(leadTasksTable.status, "pending"),
        ))
    : [];

  // New messages today: chat messages not sent by this employee
  const newMessages = member
    ? await db.select({ id: chatMessagesTable.id })
        .from(chatMessagesTable)
        .where(and(
          ne(chatMessagesTable.senderName, member.name),
          eq(chatMessagesTable.isDeleted, false),
          gte(chatMessagesTable.createdAt, todayStart),
          lte(chatMessagesTable.createdAt, todayEnd),
        ))
    : [];

  // Quotations sent in period attributed to this employee via clientEmail → lead email matching
  const periodQuotations = leadEmailSet.size > 0
    ? await db.select({ id: quotationsTable.id })
        .from(quotationsTable)
        .where(and(
          eq(quotationsTable.status, "sent"),
          gte(quotationsTable.createdAt, start),
          lte(quotationsTable.createdAt, end),
        ))
    : [];
  // Filter to those whose clientEmail matches one of this employee's lead emails
  // (Quotations don't have a direct employeeId, so we attribute via lead email)
  const quotationsSent = 0; // no clientEmail filter available yet — kept as 0 for /me (team view only)

  // Monthly target progress: leads won this calendar month (all-time)
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const wonThisMonth = leads.filter(l => {
    if (l.status !== "won") return false;
    const ua = new Date(l.updatedAt);
    return ua >= monthStart && ua <= today;
  }).length;

  // Performance chart: won leads per week for last 8 weeks (via status_changed timeline)
  const chartWeeks: Array<{ label: string; won: number; total: number }> = [];
  for (let i = 7; i >= 0; i--) {
    const weekEnd = new Date(todayStart.getTime() - i * 7 * 86400000);
    const weekStart = new Date(weekEnd.getTime() - 7 * 86400000);
    const label = weekStart.toLocaleDateString("en-IN", { day: "numeric", month: "short" });

    const weekEvents = leadIds.length
      ? await db.select({ actionType: leadTimelineTable.actionType, description: leadTimelineTable.description })
          .from(leadTimelineTable)
          .where(and(
            inArray(leadTimelineTable.leadId, leadIds),
            eq(leadTimelineTable.actorId, userId),
            gte(leadTimelineTable.createdAt, weekStart),
            lte(leadTimelineTable.createdAt, weekEnd),
          ))
      : [];

    const wonCount = weekEvents.filter(
      e => e.actionType === "status_changed" && e.description.toLowerCase().includes("won")
    ).length;
    chartWeeks.push({ label, won: wonCount, total: weekEvents.length });
  }

  res.json({
    assignedLeads: leads.length,
    todayFollowUps,
    pendingTasks: pendingTasks.length,
    upcomingMeetings: upcomingMeetings.length,
    newMessages: newMessages.length,
    wonLeads: wonLeadIdsInPeriod.length,
    lostLeads: lostLeadIdsInPeriod.length,
    pendingLeads,
    revenueGenerated: revenueInPeriod,
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

  const members = await db.select().from(teamMembersTable).where(eq(teamMembersTable.status, "active"));

  const allAssignments = await db.select().from(leadAssignmentsTable)
    .where(eq(leadAssignmentsTable.status, "active"));
  const allLeadIds = [...new Set(allAssignments.map(a => a.leadId))];
  const allLeads = allLeadIds.length
    ? await db.select().from(consultationsTable).where(inArray(consultationsTable.id, allLeadIds))
    : [];

  // Timeline events in period (for activity counts and status changes)
  const periodTimeline = allLeadIds.length
    ? await db.select().from(leadTimelineTable)
        .where(and(
          inArray(leadTimelineTable.leadId, allLeadIds),
          gte(leadTimelineTable.createdAt, start),
          lte(leadTimelineTable.createdAt, end),
          isNotNull(leadTimelineTable.actorId),
        ))
    : [];

  // All quotations sent in period — attribute by clientEmail → lead email → assigned employee
  const periodQuotations = await db.select({
    id: quotationsTable.id,
    clientEmail: quotationsTable.clientEmail,
  }).from(quotationsTable)
    .where(and(
      eq(quotationsTable.status, "sent"),
      gte(quotationsTable.createdAt, start),
      lte(quotationsTable.createdAt, end),
    ));

  // Build a map: lead email → set of assignedToIds
  const leadEmailToEmployee = new Map<string, number>();
  for (const lead of allLeads) {
    const assignment = allAssignments.find(a => a.leadId === lead.id);
    if (assignment) leadEmailToEmployee.set(lead.email, assignment.assignedToId);
  }

  const rows = members.map(member => {
    const myAssignments = allAssignments.filter(a => a.assignedToId === member.id);
    const myLeadIds = new Set(myAssignments.map(a => a.leadId));
    const myLeads = allLeads.filter(l => myLeadIds.has(l.id));

    // Period-scoped status changes
    const myTimeline = periodTimeline.filter(t => t.actorId === member.id && myLeadIds.has(t.leadId));
    const statusChanges = myTimeline.filter(t => t.actionType === "status_changed");
    const myWonIds = [...new Set(statusChanges.filter(t => t.description.toLowerCase().includes("won")).map(t => t.leadId))];
    const myLostIds = [...new Set(statusChanges.filter(t => t.description.toLowerCase().includes("lost")).map(t => t.leadId))];

    const wonLeads = myLeads.filter(l => myWonIds.includes(l.id));
    const revenue = wonLeads.reduce((s, l) => s + (parseFloat(l.expectedRevenue ?? "0") || 0), 0);
    const closed = myWonIds.length + myLostIds.length;
    const rate = closed > 0 ? Math.round((myWonIds.length / closed) * 100) : 0;
    const myPending = myLeads.filter(l => !["won", "lost"].includes(l.status)).length;

    // Quotations attributed via lead email matching
    const myEmails = new Set(myLeads.map(l => l.email));
    const myQuotations = periodQuotations.filter(q => myEmails.has(q.clientEmail)).length;

    return {
      id: member.id,
      name: member.name,
      designation: member.designation ?? "",
      leadsAssigned: myLeads.length,
      leadsWon: myWonIds.length,
      leadsLost: myLostIds.length,
      leadsPending: myPending,
      revenueGenerated: revenue,
      conversionRate: rate,
      calls: myTimeline.filter(t => t.actionType === "call_recorded").length,
      meetings: myTimeline.filter(t => t.actionType === "meeting_scheduled").length,
      followups: myTimeline.filter(t => t.actionType === "followup_added").length,
      documents: myTimeline.filter(t => t.actionType === "document_uploaded").length,
      quotationsSent: myQuotations,
    };
  });

  const teamQuotationsSent = periodQuotations.length;

  res.json({
    rows,
    teamQuotationsSent,
    range: { start: start.toISOString(), end: end.toISOString() },
  });
});

// ── GET /admin/performance/chart/:employeeId ───────────────────────────────────
// Employees may only query their own chart; managers/admins can query any.
router.get("/admin/performance/chart/:employeeId", async (req: AuthenticatedRequest, res): Promise<void> => {
  const employeeId = parseInt(req.params.employeeId as string, 10);
  if (isNaN(employeeId)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const userId = typeof req.adminUser?.userId === "number" ? req.adminUser.userId : null;
  const isEmployee = req.adminUser?.userType === "employee";
  const perms = (req as { permissions?: { all: boolean; map: Record<string, Record<string, boolean>> } }).permissions;
  const canViewOthers = !isEmployee || perms?.all || perms?.map["team"]?.["view"] || perms?.map["team"]?.["manage"];

  if (isEmployee && userId !== employeeId && !canViewOthers) {
    res.status(403).json({ error: "Access denied: can only view your own performance chart" });
    return;
  }

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
      ? await db.select({ actionType: leadTimelineTable.actionType, description: leadTimelineTable.description })
          .from(leadTimelineTable)
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
