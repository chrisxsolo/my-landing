import { describe, it, expect } from "vitest";
import { buildRawMessage, bodyToHtml, sanitizeHeader, base64UrlEncode } from "@/lib/gmailMime";
import { signatureHtmlToText } from "@/lib/gmailSignature";

/** Decodes what the Gmail API would receive, so assertions read the real wire format. */
function decode(raw: string): string {
  const base64 = raw.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  return new TextDecoder().decode(Uint8Array.from(atob(padded), (c) => c.charCodeAt(0)));
}

const SIGNATURE = {
  html: '<div dir="ltr"><h3 style="color:rgb(0,0,0)">Chris Solorzano</h3><br>soloxsnaps.com</div>',
  text: "Chris Solorzano\nsoloxsnaps.com",
};

const base = {
  from: "soloxsnaps@gmail.com",
  to: "sarah@example.com",
  subject: "Re: Graduation photos",
  body: "Hi Sarah,\n\nI'm available October 26th!\n\nLooking forward to hearing back from you!",
};

describe("without a signature", () => {
  it("stays a single text/plain part, as before", () => {
    const message = decode(buildRawMessage({ ...base, signature: null }));
    expect(message).toContain("Content-Type: text/plain; charset=UTF-8");
    expect(message).not.toContain("multipart/alternative");
    expect(message).toContain("Looking forward to hearing back from you!");
  });
});

describe("with a signature", () => {
  const message = decode(buildRawMessage({ ...base, signature: SIGNATURE }, "BOUNDARY"));

  it("builds multipart/alternative with both parts", () => {
    expect(message).toContain('Content-Type: multipart/alternative; boundary="BOUNDARY"');
    expect(message).toContain("Content-Type: text/plain; charset=UTF-8");
    expect(message).toContain("Content-Type: text/html; charset=UTF-8");
    expect(message.trimEnd().endsWith("--BOUNDARY--")).toBe(true);
  });

  it("puts the flattened signature in the plain part and the HTML in the html part", () => {
    const [, plainPart, htmlPart] = message.split("--BOUNDARY");
    expect(plainPart).toContain("Chris Solorzano\r\nsoloxsnaps.com".replace(/\r\n/g, "\n"));
    expect(plainPart).not.toContain("<h3");
    expect(htmlPart).toContain("<h3");
  });

  it("never leaks raw signature markup into the plain-text part", () => {
    const plainPart = message.split("--BOUNDARY")[1];
    expect(plainPart).not.toMatch(/<[a-z]+[\s>]/i);
  });

  it("keeps the body appearing exactly once per part", () => {
    const occurrences = message.split("October 26th").length - 1;
    expect(occurrences).toBe(2); // once in text/plain, once in text/html
  });
});

describe("threading", () => {
  it("sets References and In-Reply-To when replying", () => {
    const message = decode(buildRawMessage({ ...base, threadId: "thread-abc", signature: SIGNATURE }));
    expect(message).toContain("References: thread-abc");
    expect(message).toContain("In-Reply-To: thread-abc");
  });

  it("omits them on a new message", () => {
    const message = decode(buildRawMessage({ ...base, signature: SIGNATURE }));
    expect(message).not.toContain("In-Reply-To");
  });
});

describe("header injection", () => {
  it("strips CR/LF so a Bcc line cannot be injected", () => {
    expect(sanitizeHeader("Re: hi\r\nBcc: attacker@evil.com")).toBe("Re: hi Bcc: attacker@evil.com");
  });

  it("sanitises the subject inside the built message", () => {
    const message = decode(buildRawMessage({
      ...base, subject: "Re: hi\r\nBcc: attacker@evil.com", signature: null,
    }));
    expect(message).not.toMatch(/^Bcc:/m);
  });
});

describe("bodyToHtml", () => {
  it("turns blank-line blocks into paragraphs and single newlines into breaks", () => {
    const html = bodyToHtml("Hi Sarah,\n\nLine one\nLine two");
    expect(html).toContain("<p");
    expect(html.match(/<p/g)).toHaveLength(2);
    expect(html).toContain("Line one<br>Line two");
  });

  it("escapes markup in the body", () => {
    expect(bodyToHtml("I <3 this & that")).toContain("I &lt;3 this &amp; that");
  });
});

describe("utf-8", () => {
  it("round-trips non-ASCII in the body", () => {
    const message = decode(buildRawMessage({
      ...base, body: "Hi Zoë,\n\nSee you at the Café!", signature: null,
    }));
    expect(message).toContain("Zoë");
    expect(message).toContain("Café");
  });

  it("base64url output carries no padding or unsafe characters", () => {
    expect(base64UrlEncode("hello world ünïcode")).not.toMatch(/[+/=]/);
  });
});

describe("signatureHtmlToText", () => {
  it("flattens Gmail's table-based signature into readable lines", () => {
    const html = '<table><tbody><tr><td><h3>Chris Solorzano</h3></td></tr><tr><td>Photographer</td><td>SF</td></tr></tbody></table>';
    const text = signatureHtmlToText(html);
    expect(text).toContain("Chris Solorzano");
    expect(text).toContain("Photographer");
    expect(text).not.toContain("<");
  });

  it("decodes entities and collapses runaway blank lines", () => {
    expect(signatureHtmlToText("<div>Chris &amp; Co.</div><br><br><br><div>SF</div>"))
      .toBe("Chris & Co.\n\nSF");
  });
});
