export const CLIENT_CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "soloxsnaps@gmail.com";

type GmailComposeOptions = {
  body?: string;
  subject?: string;
  to?: string;
};

export function buildGmailComposeUrl(options: GmailComposeOptions = {}) {
  const params = new URLSearchParams({
    view: "cm",
    fs: "1",
    to: options.to ?? CLIENT_CONTACT_EMAIL,
  });

  if (options.subject) params.set("su", options.subject);
  if (options.body) params.set("body", options.body);

  return `https://mail.google.com/mail/?${params.toString()}`;
}
