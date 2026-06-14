import Link from "next/link";
import OptimizedPhoto from "@/app/components/OptimizedPhoto";
import type { PortfolioCaseStudy } from "@/lib/portfolioCaseStudies";
import styles from "@/app/(professional)/portfolio/Portfolio.module.css";

// Per-session story blocks: cover photo + session details (location / time of
// day / what the client wanted) + a few preview frames + an optional
// testimonial, ending in a pricing CTA. Renders nothing when there are none.
export default function CaseStudies({
  studies,
  pricingHref,
  pricingLabel,
}: {
  studies: PortfolioCaseStudy[];
  pricingHref: string;
  pricingLabel: string;
}) {
  if (studies.length === 0) return null;

  return (
    <section className={styles.portCases} aria-labelledby="portfolio-cases-heading">
      <div className={styles.portCasesInner}>
        <p className={styles.portCasesEyebrow}>Full sessions</p>
        <h2 id="portfolio-cases-heading" className={styles.portCasesHeading}>
          Inside a few recent sessions
        </h2>

        <div className={styles.portCasesList}>
          {studies.map((study) => (
            <article key={study.id} className={styles.portCase}>
              {study.cover_image_url && (
                <div className={styles.portCaseCover}>
                  <OptimizedPhoto
                    src={study.cover_image_url}
                    alt={study.title}
                    className={styles.portCaseCoverImg}
                    sizes="(max-width: 860px) 100vw, 50vw"
                    quality={85}
                  />
                </div>
              )}

              <div className={styles.portCaseBody}>
                <h3 className={styles.portCaseTitle}>{study.title}</h3>
                {study.client_name && (
                  <p className={styles.portCaseClient}>{study.client_name}</p>
                )}

                <dl className={styles.portCaseDetails}>
                  {study.location && (
                    <div className={styles.portCaseDetail}>
                      <dt className={styles.portCaseDetailLabel}>Location</dt>
                      <dd className={styles.portCaseDetailValue}>{study.location}</dd>
                    </div>
                  )}
                  {study.time_of_day && (
                    <div className={styles.portCaseDetail}>
                      <dt className={styles.portCaseDetailLabel}>Time of day</dt>
                      <dd className={styles.portCaseDetailValue}>{study.time_of_day}</dd>
                    </div>
                  )}
                  {study.client_goal && (
                    <div className={styles.portCaseDetail}>
                      <dt className={styles.portCaseDetailLabel}>What they wanted</dt>
                      <dd className={styles.portCaseDetailValue}>{study.client_goal}</dd>
                    </div>
                  )}
                </dl>

                {study.summary && <p className={styles.portCaseSummary}>{study.summary}</p>}

                {study.preview_image_urls.length > 0 && (
                  <div className={styles.portCasePreviews}>
                    {study.preview_image_urls.map((url) => (
                      <div key={url} className={styles.portCasePreview}>
                        <OptimizedPhoto
                          src={url}
                          alt={`${study.title} — gallery preview`}
                          className={styles.portCasePreviewImg}
                          sizes="(max-width: 860px) 30vw, 160px"
                          quality={75}
                        />
                      </div>
                    ))}
                  </div>
                )}

                {study.testimonial_quote && (
                  <blockquote className={styles.portCaseQuote}>
                    {`“${study.testimonial_quote}”`}
                    {study.testimonial_author && (
                      <cite className={styles.portCaseQuoteCite}>{study.testimonial_author}</cite>
                    )}
                  </blockquote>
                )}

                <Link href={pricingHref} className={styles.portCaseCta}>
                  {pricingLabel}
                </Link>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
