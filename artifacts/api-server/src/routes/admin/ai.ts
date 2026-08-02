import { Router } from "express";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { openai } from "@workspace/integrations-openai-ai-server";

const AI_ACTIONS: Record<string, string> = {
  rewrite:          "Rewrite this text completely while preserving its meaning and key information. Return ONLY the rewritten text.",
  shorten:          "Shorten this text to about half its length while keeping all key points. Return ONLY the shortened text.",
  expand:           "Expand this text with more detail, examples, and depth to approximately double the current length. Return ONLY the expanded text.",
  professional:     "Rewrite this in a polished, professional, authoritative tone suitable for a premium Indian law firm's website. Return ONLY the rewritten text.",
  seo:              "Rewrite this to be SEO-optimised for an Indian law firm. Include relevant legal keywords naturally without keyword stuffing. Return ONLY the rewritten text.",
  human_friendly:   "Rewrite this in a warm, approachable, human-friendly tone while remaining professional and credible. Return ONLY the rewritten text.",
  generate_faq:     "Generate 5 FAQ questions and answers highly relevant to this law firm content. Format each as:\nQ: [question]\nA: [answer]\n\nReturn ONLY the formatted FAQs, nothing else.",
  meta_title:       "Generate a single SEO-optimised meta title (maximum 60 characters) for this page. Return ONLY the title text, no quotes, no label.",
  meta_description: "Generate a single SEO-optimised meta description (maximum 160 characters) for this page. Return ONLY the description text, no quotes, no label.",
  schema:           "Generate valid JSON-LD schema markup of type LegalService for this Indian law firm page. Return ONLY the complete <script type=\"application/ld+json\">...</script> tag.",
  internal_links:   "Suggest 5 internal link anchor-text and target-URL pairs for a law firm website based on this content. Format each as:\n[anchor text] → /page-path\n\nReturn ONLY the 5 formatted pairs.",
  generate_cta:     "Generate 3 compelling call-to-action button text options for this legal services context. Return as:\n1. [CTA text]\n2. [CTA text]\n3. [CTA text]",
  translate:        "Translate this text accurately to Hindi. Return ONLY the Hindi translation.",
  grammar:          "Correct any grammar, spelling, punctuation, or style errors in this text. Return ONLY the corrected text.",
};

const SYSTEM_PROMPT =
  "You are an expert legal-services content writer for Vakil & Co., a premium Indian law firm. Follow the instruction exactly and completely. Return ONLY the requested content — no preamble, no label, no suffix.";

const router = Router();

router.post("/admin/ai/improve", async (req, res): Promise<void> => {
  const { text, action, provider = "anthropic" } = req.body as {
    text?: string;
    action?: string;
    provider?: "anthropic" | "openai";
  };

  if (!text?.trim()) {
    res.status(400).json({ error: "text is required" });
    return;
  }
  if (!action) {
    res.status(400).json({ error: "action is required" });
    return;
  }

  const instruction = AI_ACTIONS[action];
  if (!instruction) {
    res.status(400).json({ error: `Unknown action: ${action}` });
    return;
  }

  const userMessage = `${instruction}\n\n---\n${text.slice(0, 8000)}`;

  try {
    let result = "";

    if (provider === "openai") {
      const completion = await openai.chat.completions.create({
        model: "gpt-5.6-luna",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user",   content: userMessage },
        ],
        max_tokens: 2000,
      });
      result = completion.choices[0]?.message?.content ?? "";
    } else {
      const message = await anthropic.messages.create({
        model: "claude-haiku-4-5",
        max_tokens: 2000,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
      });
      result =
        message.content[0]?.type === "text" ? message.content[0].text : "";
    }

    res.json({ result: result.trim() });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "AI request failed";
    console.error("[ai/improve]", msg);
    res.status(500).json({ error: msg });
  }
});

export default router;
