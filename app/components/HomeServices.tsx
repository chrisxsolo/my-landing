import Link from "next/link";
import OptimizedPhoto from "@/app/components/OptimizedPhoto";
import type { PortfolioImage } from "@/lib/professionalData";
import styles from "@/app/(professional)/home.module.css";
import responsive from "@/app/(professional)/homeResponsive.module.css";
import { PRICING_CATALOG } from "@/lib/pricingCatalog";

type HomeImage = Pick<PortfolioImage, "id" | "image_url" | "alt" | "category_slug">;

const TURNAROUND_WEEKS = PRICING_CATALOG.standardTurnaroundDays / 7;

const TRUST_POINTS = [
  "Posing guidance included",
  "Private online galleries",
  `${TURNAROUND_WEEKS}-week turnaround`,
] as const;

const SCHOOLS = [
  ["UC Berkeley", "/grads/uc-berkeley"],
  ["SJSU", "/grads/sjsu"],
  ["USF", "/grads/usf"],
  ["San Francisco State", "/grads/sf-state"],
  ["CSU East Bay", "/grads/csueb"],
  ["Stanford", "/grads/stanford"],
] as const;

function startingAt(price: number) {
  return `Starting at $${price}`;
}

const COUPLES_PRICE_LINES = [
  `${PRICING_CATALOG.couples.packages.mini.durationMinutes}-minute sessions from $${PRICING_CATALOG.couples.packages.mini.price}`,
  `Full sessions from $${PRICING_CATALOG.couples.packages["1hr"].price}`,
];

function ServiceCard({
  href,
  image,
  title,
  copy,
  price,
  cta,
}: {
  href: string;
  image: HomeImage;
  title: string;
  copy: string;
  price: string | string[];
  cta: string;
}) {
  const priceLines = Array.isArray(price) ? price : [price];
  return (
    <Link href={href} className={`${styles.serviceCard} ${responsive.serviceCard}`}>
      <div className={styles.serviceImage}>
        <OptimizedPhoto src={image.image_url} alt={image.alt} sizes="(max-width: 760px) 100vw, 38vw" />
      </div>
      <div className={styles.serviceBody}>
        <h3>{title}</h3>
        <p>{copy}</p>
        <span className={styles.servicePrice}>
          {priceLines.map((line) => (
            <span key={line} className={styles.servicePriceLine}>
              {line}
            </span>
          ))}
        </span>
        <span className={styles.cardCta}>{cta} →</span>
      </div>
    </Link>
  );
}

export default function HomeServices({
  cardGrads,
  cardCouples,
  cardPortrait,
}: {
  cardGrads: HomeImage;
  cardCouples: HomeImage;
  cardPortrait: HomeImage;
}) {
  return (
    <section id="services" className={`${styles.section} ${styles.tint} ${responsive.section}`}>
      <div className={`${styles.shell} ${responsive.shell}`}>
        <div className={`${styles.headerRow} ${responsive.headerRow}`}>
          <div>
            <p className={styles.eyebrow}>Choose your session</p>
            <h2 className={styles.title}>A clear place to start, whatever you are celebrating</h2>
          </div>
          <p className={`${styles.copy} ${responsive.headerRowCopy}`}>
            {TRUST_POINTS.join(" · ")}
          </p>
        </div>

        <div className={`${styles.serviceGrid} ${responsive.serviceGrid}`}>
          <ServiceCard
            href="/pricing/grads"
            image={cardGrads}
            title="Graduation Photography"
            copy="Campus sessions celebrating your personality, school, and milestone."
            price={startingAt(PRICING_CATALOG.graduation.baseHourlyRate)}
            cta="View Graduation Sessions"
          />
          <ServiceCard
            href="/pricing/couples"
            image={cardCouples}
            title="Couples Photography"
            copy="Natural, movement-led photographs for engagements, anniversaries, and everyday chapters."
            price={COUPLES_PRICE_LINES}
            cta="View Couples Sessions"
          />
          <ServiceCard
            href="/pricing/families"
            image={cardPortrait}
            title="Families & Portraits"
            copy="Guided portraits for families, maternity, individuals, and personal milestones."
            price={startingAt(PRICING_CATALOG.families.packages.standard.price)}
            cta="View Family & Portrait Sessions"
          />
        </div>

        <p className={styles.serviceNote}>
          I photograph graduates across{" "}
          {SCHOOLS.map(([name, href], index) => (
            <span key={href}>
              <Link href={href}>{name}</Link>
              {index < SCHOOLS.length - 2 ? ", " : null}
              {index === SCHOOLS.length - 2 ? ", and " : null}
            </span>
          ))}
          .
        </p>
      </div>
    </section>
  );
}
