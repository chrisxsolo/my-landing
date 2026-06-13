import Link from "next/link";
import { GRAD_SCHOOL_LINKS } from "@/lib/portfolioCategoryContent";
import styles from "@/app/(professional)/portfolio/Portfolio.module.css";

// Grad-only: a row of chips linking to the existing per-school landing pages.
// Stands in for in-wall school filtering until photos are tagged by school.
export default function PortfolioSchoolLinks() {
  return (
    <section className={styles.portSchools} aria-labelledby="portfolio-schools-heading">
      <div className={styles.portSchoolsInner}>
        <p className={styles.portSchoolsEyebrow}>Find your school</p>
        <h2 id="portfolio-schools-heading" className={styles.portSchoolsHeading}>
          Grad sessions by campus
        </h2>
        <nav className={styles.portSchoolsRow} aria-label="Graduation photography by school">
          {GRAD_SCHOOL_LINKS.map((school) => (
            <Link key={school.href} href={school.href} className={styles.portSchoolLink}>
              {school.label}
            </Link>
          ))}
        </nav>
      </div>
    </section>
  );
}
