import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { buildPortfolioSeoDescription, normalizeAiPortfolioSeoDescription } from "@/lib/portfolioSeoDescription";
import { requireAdmin } from "@/lib/requireAdmin";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

type RequestBody = {
  imageId?: unknown;
  school?: unknown;
  location?: unknown;
  session?: unknown;
  degree?: unknown;
  year?: unknown;
  attire?: unknown;
  goldenHour?: unknown;
};

function readImageId(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error("imageId must be a positive integer.");
  }

  return parsed;
}

function getErrorStatus(message: string) {
  return message.endsWith("must be a positive integer.") ? 400 : 500;
}

function parseAiJson(text: string) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return {};

  try {
    return JSON.parse(match[0]) as { title?: string; alt?: string };
  } catch {
    return {};
  }
}

async function polishWithAi(fallback: { title: string; alt: string }, body: RequestBody) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return fallback;

  const anthropic = new Anthropic({ apiKey });
  const response = await anthropic.messages.create({
    model: "claude-opus-4-7",
    max_tokens: 180,
    system: "Write concise SEO image metadata for soloxsnaps, a Bay Area graduation photographer. Return only JSON with title and alt. Keep alt under 125 characters. Be descriptive and natural, never keyword-stuffed.",
    messages: [
      {
        role: "user",
        content: JSON.stringify({
          fallback,
          school: body.school,
          location: body.location,
          session: body.session,
          degree: body.degree,
          year: body.year,
          attire: body.attire,
          goldenHour: body.goldenHour === true,
        }),
      },
    ],
  });

  const text = response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n");

  return normalizeAiPortfolioSeoDescription(parseAiJson(text), fallback);
}

export async function POST(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  try {
    const body = (await req.json()) as RequestBody;
    const imageId = readImageId(body.imageId);
    const fallback = buildPortfolioSeoDescription(body);
    let description = fallback;

    try {
      description = await polishWithAi(fallback, body);
    } catch (err) {
      console.error("[admin/portfolio-image-description] AI fallback", err);
    }

    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("portfolio_images")
      .update({ title: description.title, alt: description.alt })
      .eq("id", imageId)
      .select("*")
      .single();

    if (error) throw error;

    return NextResponse.json({ image: data, description });
  } catch (err) {
    console.error("[admin/portfolio-image-description] POST", err);
    const message = err instanceof Error ? err.message : "Failed to update image description.";
    return NextResponse.json({ error: message }, { status: getErrorStatus(message) });
  }
}
