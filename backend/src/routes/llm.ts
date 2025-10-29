import { Router } from "express";
import OpenAI from "openai";

const router = Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

router.post("/", async (req, res) => {
  try {
    const { model, messages, temperature = 0.7, maxTokens = 512 } = req.body || {};
    if (!model || !Array.isArray(messages)) {
      return res.status(400).json({ error: "model and messages are required" });
    }

    // Use Chat Completions (or Responses API if you prefer)
    const completion = await openai.chat.completions.create({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
    });

    const text = completion.choices?.[0]?.message?.content ?? "";
    res.json({ text });
  } catch (err: any) {
    console.error("LLM proxy error:", err?.message || err);
    res.status(500).json({ error: "LLM call failed" });
  }
});

export default router;
