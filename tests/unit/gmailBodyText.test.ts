import { describe, it, expect } from "vitest";
import {
  decodeGmailBase64Url,
  extractEmailText,
  htmlToPlainText,
  type GmailMimePart,
} from "@/lib/gmailBodyText";

function b64url(text: string): string {
  return Buffer.from(text, "utf-8").toString("base64")
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

describe("decodeGmailBase64Url", () => {
  it("decodes Gmail's URL-safe base64 alphabet", () => {
    const original = "Jane sent you $200 — thanks! ✓";
    expect(decodeGmailBase64Url(b64url(original))).toBe(original);
  });

  it("returns empty string for garbage input", () => {
    expect(decodeGmailBase64Url("")).toBe("");
  });
});

describe("htmlToPlainText", () => {
  it("strips tags, scripts, styles, and decodes entities", () => {
    const html = `<html><head><style>.x{color:red}</style></head>
      <body><script>track()</script>
      <p>Jane Doe <b>sent you</b> &#36;200.00</p>
      <div>via Venmo &amp; noted &quot;deposit&quot;</div></body></html>`;
    const text = htmlToPlainText(html);
    expect(text).toContain("Jane Doe sent you $200.00");
    expect(text).toContain('via Venmo & noted "deposit"');
    expect(text).not.toContain("track()");
    expect(text).not.toContain("color:red");
    expect(text).not.toContain("<");
  });

  it("turns block elements and <br> into line breaks", () => {
    const text = htmlToPlainText("<p>line one</p><p>line two</p>three<br>four");
    expect(text.split("\n").map(l => l.trim())).toEqual(["line one", "line two", "three", "four"]);
  });
});

describe("extractEmailText", () => {
  it("reads a simple text/plain payload from payload.body.data", () => {
    const payload: GmailMimePart = {
      mimeType: "text/plain",
      body: { data: b64url("I just sent the deposit!") },
    };
    expect(extractEmailText(payload)).toBe("I just sent the deposit!");
  });

  it("falls back to text/html when no plain text exists", () => {
    const payload: GmailMimePart = {
      mimeType: "text/html",
      body: { data: b64url("<p>You received <b>$175.00</b> from Jane</p>") },
    };
    expect(extractEmailText(payload)).toBe("You received $175.00 from Jane");
  });

  it("uses the HTML part when the text/plain sibling is empty", () => {
    const payload: GmailMimePart = {
      mimeType: "multipart/alternative",
      parts: [
        { mimeType: "text/plain", body: { data: b64url("   \n ") } },
        { mimeType: "text/html", body: { data: b64url("<div>Venmo: Jane paid you $200</div>") } },
      ],
    };
    expect(extractEmailText(payload)).toBe("Venmo: Jane paid you $200");
  });

  it("prefers plain text when both parts have content", () => {
    const payload: GmailMimePart = {
      mimeType: "multipart/alternative",
      parts: [
        { mimeType: "text/plain", body: { data: b64url("plain version") } },
        { mimeType: "text/html", body: { data: b64url("<p>html version</p>") } },
      ],
    };
    expect(extractEmailText(payload)).toBe("plain version");
  });

  it("recurses through deeply nested multipart trees", () => {
    const payload: GmailMimePart = {
      mimeType: "multipart/mixed",
      parts: [
        { mimeType: "application/pdf", body: { data: b64url("%PDF binary junk") } },
        {
          mimeType: "multipart/alternative",
          parts: [
            { mimeType: "text/plain", body: {} },
            {
              mimeType: "multipart/related",
              parts: [{ mimeType: "text/html", body: { data: b64url("<p>deposit sent</p>") } }],
            },
          ],
        },
      ],
    };
    expect(extractEmailText(payload)).toBe("deposit sent");
  });

  it("ignores non-text attachments entirely", () => {
    const payload: GmailMimePart = {
      mimeType: "multipart/mixed",
      parts: [
        { mimeType: "image/jpeg", body: { data: b64url("fakejpegbytes") } },
        { mimeType: "text/plain", body: { data: b64url("real content") } },
      ],
    };
    expect(extractEmailText(payload)).toBe("real content");
  });

  it("caps output length and handles a missing payload", () => {
    const payload: GmailMimePart = {
      mimeType: "text/plain",
      body: { data: b64url("x".repeat(5000)) },
    };
    expect(extractEmailText(payload, 1500)).toHaveLength(1500);
    expect(extractEmailText(undefined)).toBe("");
  });
});
