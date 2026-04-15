import { Router, type IRouter } from "express";
import { desc } from "drizzle-orm";
import { db, contactsTable } from "@workspace/db";
import { CreateContactBody } from "@workspace/api-zod";

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
  const results = await db
    .select()
    .from(contactsTable)
    .orderBy(desc(contactsTable.createdAt));
  res.json(results);
});

export default router;
