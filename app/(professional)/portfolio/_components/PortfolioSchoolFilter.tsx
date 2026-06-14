import Link from "next/link";
import { GRAD_SCHOOLS } from "@/lib/portfolioCategoryContent";
import styles from "@/app/(professional)/portfolio/Portfolio.module.css";

// In-wall grad school filter. Only lists schools that actually have tagged
// photos (passed in via `availableSlugs`), so the row stays invisible until
// Chris tags photos in the admin. Links keep the grads category and toggle
// ?school=<slug>; the active chip clears back to all schools.
export default function PortfolioSchoolFilter({
  availableSlugs,
  activeSchool,
}: {
  availableSlugs: string[];
  activeSchool?: string;
}) {
  const schools = GRAD_SCHOOLS.filter((school) => availableSlugs.includes(school.slug));
  if (schools.length === 0) return null;

  return (
    <nav className={styles.portSchoolFilter} aria-label="Filter grads by school">
      <Link
        href="/portfolio?category=grads"
        className={styles.portSchoolFilterChip}
        aria-current={!activeSchool ? "true" : undefined}
      >
        All schools
      </Link>
      {schools.map((school) => (
        <Link
          key={school.slug}
          href={`/portfolio?category=grads&school=${school.slug}`}
          className={styles.portSchoolFilterChip}
          aria-current={activeSchool === school.slug ? "true" : undefined}
        >
          {school.label}
        </Link>
      ))}
    </nav>
  );
}
