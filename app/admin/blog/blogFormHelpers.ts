// Pure helpers for the Blog tab form (moved out of BlogTab.tsx unchanged):
// slug derivation, the "paste a journal entry" parser, and browser-side JPEG
// compression used before photos go to the AI route or to storage.
export function slugify(s: string) { return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }

export function parseJournalEntry(raw: string) {
  const lines = raw.split("\n");
  const title = lines.find(l => l.trim())?.trim() ?? "";

  const dateRe = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{2,4}/i;
  const numericDateRe = /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/;
  const timeRe = /\b(\d{1,2}:\d{2}\s*(?:am|pm)?)/i;

  let dateStr = "", timeStr = "", dateLine = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const dMatch = line.match(dateRe) || line.match(numericDateRe);
    if (dMatch) {
      dateStr = dMatch[0];
      const tMatch = line.match(timeRe);
      if (tMatch) timeStr = tMatch[1];
      dateLine = i;
      break;
    }
  }

  let published_at = new Date().toISOString().slice(0, 16);
  if (dateStr) {
    try {
      const d = new Date(`${dateStr}${timeStr ? " " + timeStr : ""}`);
      if (!isNaN(d.getTime())) published_at = d.toISOString().slice(0, 16);
    } catch { /* ignore parse failures */ }
  }

  const skipLines = new Set([0]);
  if (dateLine >= 0) skipLines.add(dateLine);
  const body = lines.filter((_, i) => !skipLines.has(i)).join("\n").replace(/^\n+/, "").trim();
  return { title, slug: slugify(title), published_at, body };
}

export async function compressForAI(file: File, maxPx = 900, quality = 0.75): Promise<Blob> {
  return new Promise(resolve => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > maxPx || height > maxPx) {
        if (width > height) { height = Math.round(height * (maxPx / width)); width = maxPx; }
        else { width = Math.round(width * (maxPx / height)); height = maxPx; }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
      canvas.toBlob(blob => resolve(blob ?? file), "image/jpeg", quality);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}
