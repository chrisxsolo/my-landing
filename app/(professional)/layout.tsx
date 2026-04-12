import Link from "next/link";
import ProNav from "@/app/components/ProNav";

const footerLinks = [
  { label: "Home", href: "/" },
  { label: "Grads", href: "/portfolio?category=grads" },
  { label: "Families", href: "/portfolio?category=families" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "https://www.soloxsnaps.com/contact/" },
  { label: "Blog", href: "/blog" },
];

export default function ProfessionalLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen bg-[#fbfbfa] text-[#262626]">
      <ProNav />
      {children}
      <footer className="border-t border-black/10 bg-[#fbfbfa] px-6 py-14 sm:px-10">
        <div className="mx-auto grid max-w-[1460px] gap-10 text-sm text-black/65 lg:grid-cols-[1.2fr_0.8fr_0.8fr]">
          <nav aria-label="Professional footer navigation" className="grid gap-3 sm:grid-cols-2">
            {footerLinks.map((link) =>
              link.href.startsWith("http") ? (
                <a key={link.href} href={link.href} className="uppercase hover:text-black">
                  {link.label}
                </a>
              ) : (
                <Link key={link.href} href={link.href} className="uppercase hover:text-black">
                  {link.label}
                </Link>
              )
            )}
          </nav>

          <div>
            <p className="text-xs uppercase text-black/45">find your way around</p>
            <p className="mt-4 font-serif text-3xl leading-none text-[#202020]">
              soloxsnaps
            </p>
            <p className="mt-3 font-serif text-base italic">graduation & family photography</p>
          </div>

          <div className="lg:text-right">
            <p className="text-xs uppercase text-black/45">find me elsewhere</p>
            <a
              href="https://www.instagram.com/soloxsnaps"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 block uppercase hover:text-black"
            >
              Instagram
            </a>
            <a href="/home" className="mt-3 block uppercase hover:text-black">
              Fun site
            </a>
            <p className="mt-8 text-xs uppercase text-black/40">2026 soloxsnaps | All rights reserved</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
