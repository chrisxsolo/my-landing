import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return NextResponse.json({ error: "No OpenAI key configured" }, { status: 500 });

  const formData = await req.formData();
  const audio = formData.get("audio") as Blob | null;
  if (!audio) return NextResponse.json({ error: "No audio" }, { status: 400 });

  const body = new FormData();
  body.append("file", audio, "audio.webm");
  body.append("model", "whisper-1");
  body.append("language", "en");

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body,
  });

  if (!res.ok) {
    const err = await res.text();
    return NextResponse.json({ error: err }, { status: res.status });
  }

  const json = await res.json() as { text: string };
  return NextResponse.json({ text: json.text });
}
