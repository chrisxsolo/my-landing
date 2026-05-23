// POST /api/admin/chat
//
// Admin-only general-purpose Claude chat with streaming.
// Body: { messages: {role:"user"|"assistant", content:string}[] }
// Response: SSE stream of:
//   { type:"text", text: string }
//   { type:"done" }
//   { type:"error", message: string }

import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { requireAdmin } from "@/lib/requireAdmin";

export const dynamic = "force-dynamic";

const SYSTEM_PROMPT = `You are a helpful assistant for Chris Solorzano's photography business, Soloxsnaps (soloxsnaps.com). You help with:

- Client management strategy and communication advice
- Business decisions (pricing, packages, policies)
- Content ideas for blog posts, social media, and marketing
- SEO and website strategy
- Booking workflow and client experience improvements
- Any other photography business questions

Chris runs a Bay Area portrait photography business specializing in graduation portraits, family sessions, couples, and events. His main markets are Bay Area universities (UC Berkeley, SJSU, SF State, CSUEB, USF).

Be direct, practical, and conversational. You already know Chris's business context — no need for lengthy disclaimers.`;

export async function POST(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    const encoder = new TextEncoder();
    return new Response(
      new ReadableStream({
        start(c) {
          c.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "error", message: "No API key configured" })}\n\n`));
          c.close();
        },
      }),
      { headers: { "Content-Type": "text/event-stream" } }
    );
  }

  const { messages } = await req.json() as {
    messages: { role: "user" | "assistant"; content: string }[];
  };

  if (!Array.isArray(messages) || messages.length === 0) {
    const encoder = new TextEncoder();
    return new Response(
      new ReadableStream({
        start(c) {
          c.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "error", message: "messages required" })}\n\n`));
          c.close();
        },
      }),
      { headers: { "Content-Type": "text/event-stream" } }
    );
  }

  const client = new Anthropic({ apiKey });
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function emit(data: unknown) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      }

      try {
        const claudeStream = client.messages.stream({
          model: "claude-opus-4-7",
          max_tokens: 64000,
          thinking: { type: "adaptive" },
          system: SYSTEM_PROMPT,
          messages,
        });

        for await (const event of claudeStream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            emit({ type: "text", text: event.delta.text });
          }
        }

        emit({ type: "done" });
      } catch (err) {
        console.error("[admin/chat] stream error", err);
        emit({ type: "error", message: "Something went wrong. Try again." });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
