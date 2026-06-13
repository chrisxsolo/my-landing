import Link from "next/link";
import ProNav from "@/app/components/ProNav";
import ScrollReveal from "@/app/components/ScrollReveal";
import VisitorTracker from "@/app/components/VisitorTracker";
import { getNavConfig } from "@/lib/professionalData";
import styles from "@/app/(professional)/ProfessionalLayout.module.css";

const footerLinks = [
  { label: "Couples rates", href: "/pricing/couples" },
  { label: "Grad rates", href: "/pricing/grads" },
  { label: "Family rates", href: "/pricing/families" },
  { label: "Portfolio", href: "/portfolio" },
  { label: "Dates", href: "/availability" },
  { label: "Contact", href: "/contact" },
];

export default async function ProfessionalLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const navConfig = await getNavConfig();
  return (
    <div className={styles.professionalShell}>
      <VisitorTracker />
      <ScrollReveal />
      <ProNav config={navConfig} />
      {children}

      <footer className={styles.professionalFooter}>
        <div className={styles.professionalFooterInner}>
          <div className={styles.professionalFooterTop}>
            <div>
              <p className={styles.professionalFooterBrand}>soloxsnaps</p>
              <p className={styles.professionalFooterCopy}>
                Bay Area graduation and couples photography, with guided family and portrait sessions also available — clean direction, real light, and galleries that feel ready to share.
              </p>
            </div>

            <nav className={styles.professionalFooterLinks} aria-label="Footer navigation">
              {footerLinks.map((link) => (
                <Link key={link.href} href={link.href} className={styles.professionalFooterLink}>
                  {link.label}
                </Link>
              ))}
              <a
                href="https://www.instagram.com/soloxsnaps"
                target="_blank"
                rel="noopener noreferrer"
                className={styles.professionalFooterLink}
              >
                Instagram
              </a>
            </nav>
          </div>

          <div className={styles.professionalFooterBottom}>
            <span>© {new Date().getFullYear()} soloxsnaps</span>
            <div style={{ display: "flex", gap: 16 }}>
              <Link href="/privacy" style={{ color: "#64716d", textDecoration: "none" }}>Privacy</Link>
              <Link href="/terms" style={{ color: "#64716d", textDecoration: "none" }}>Terms</Link>
              <span>San Francisco, California</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
