import { Router } from "express";
import OpenAI from "openai";
import { io } from "../server"; 

const router = Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

router.post("/", async (req, res) => {
  try {
    const { model, messages, temperature = 0.7, maxTokens = 512, traceId } = req.body || {};
    if (!model || !Array.isArray(messages)) {
      return res.status(400).json({ error: "model and messages are required" });
    }

    const completion = await openai.chat.completions.create({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
    });

    const text =
      completion.choices?.[0]?.message?.content ??
      completion.choices?.[0]?.delta?.content ??
      "";

    // Optional: emit to the trace room so the dashboard sees replay results live
    if (traceId) {
      io.to(`trace:${traceId}`).emit("replay_llm_result", {
        traceId,
        text,
        timestamp: Date.now(),
      });
    }

    res.json({ text });
  } catch (err: any) {
    console.error("LLM proxy error:", err);
    res.status(500).json({ error: err.message || "LLM call failed" });
  }
});

export default router;
