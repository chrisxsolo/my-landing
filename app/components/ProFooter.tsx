import Link from "next/link";
import { C } from "@/lib/colors";
import { FOOTER_LINK_GROUPS, INSTAGRAM_URL } from "@/lib/footerLinks";
import styles from "@/app/(professional)/ProfessionalLayout.module.css";

// Site footer for every public page: brand line, the booking and planning
// link rows (see lib/footerLinks), and the legal links. Server-rendered, so
// every link here is in the HTML crawlers read.
export default function ProFooter() {
  return (
    <footer className={styles.professionalFooter}>
      <div className={styles.professionalFooterInner}>
        <div className={styles.professionalFooterTop}>
          <div>
            <p className={styles.professionalFooterBrand}>soloxsnaps</p>
            <p className={styles.professionalFooterCopy}>
              Bay Area graduation and couples photography, with guided family and portrait sessions also available — clean direction, real light, and galleries that feel ready to share.
            </p>
          </div>

          <div className={styles.professionalFooterNavs}>
            {FOOTER_LINK_GROUPS.map((group) => (
              <nav key={group.id} className={styles.professionalFooterLinks} aria-label={`${group.label} links`}>
                <span className={styles.professionalFooterGroupLabel}>{group.label}</span>
                {group.links.map((link) => (
                  <Link key={link.href} href={link.href} className={styles.professionalFooterLink}>
                    {link.label}
                  </Link>
                ))}
                {group.id === "book" ? (
                  <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" className={styles.professionalFooterLink}>
                    Instagram
                  </a>
                ) : null}
              </nav>
            ))}
          </div>
        </div>

        <div className={styles.professionalFooterBottom}>
          <span>© {new Date().getFullYear()} soloxsnaps</span>
          <div style={{ display: "flex", gap: 16 }}>
            <Link href="/privacy" style={{ color: C.proMuted, textDecoration: "none" }}>Privacy</Link>
            <Link href="/terms" style={{ color: C.proMuted, textDecoration: "none" }}>Terms</Link>
            <span>San Francisco, California</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
