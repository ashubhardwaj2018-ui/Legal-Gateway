import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, contactsTable } from "@workspace/db";
import { CreateContactBody, UpdateContactBody, UpdateContactParams } from "@workspace/api-zod";

const router: IRouter = Router();

router.post("/contacts", async (req, res): Promise<void> => {
  const parsed = CreateContactBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [contact] = await db
    .insert(contactsTable)
    .values({
      name: parsed.data.name,
      email: parsed.data.email,
      phone: parsed.data.phone ?? null,
      subject: parsed.data.subject,
      message: parsed.data.message,
      status: "unread",
    })
    .returning();
  req.log.info({ id: contact.id }, "Contact created");
  res.status(201).json(contact);
});

router.get("/contacts", async (_req, res): Promise<void> => {
  const results = await db.select().from(contactsTable).orderBy(desc(contactsTable.createdAt));
  res.json(results);
});

router.patch("/contacts/:id", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const paramsParsed = UpdateContactParams.safeParse({ id: parseInt(rawId, 10) });
  if (!paramsParsed.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }
  const bodyParsed = UpdateContactBody.safeParse(req.body);
  if (!bodyParsed.success) {
    res.status(400).json({ error: bodyParsed.error.message });
    return;
  }
  const [result] = await db
    .update(contactsTable)
    .set({ ...bodyParsed.data, updatedAt: new Date() })
    .where(eq(contactsTable.id, paramsParsed.data.id))
    .returning();
  if (!result) {
    res.status(404).json({ error: "Contact not found" });
    return;
  }
  res.json(result);
});

export default router;
