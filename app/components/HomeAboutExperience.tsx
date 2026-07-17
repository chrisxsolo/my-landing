import Link from "next/link";
import { Caveat } from "next/font/google";
import OptimizedPhoto from "@/app/components/OptimizedPhoto";
import styles from "@/app/(professional)/home.module.css";
import details from "@/app/(professional)/homeDetails.module.css";
import film from "@/app/(professional)/homeFilm.module.css";
import responsive from "@/app/(professional)/homeResponsive.module.css";

const caveat = Caveat({ subsets: ["latin"], weight: "600", display: "swap" });

type ProcessFrame = {
  frame: string;
  title: string;
  copy: string;
  keeper?: boolean;
};

const PROCESS: readonly ProcessFrame[] = [
  {
    frame: "01A",
    title: "Plan",
    copy: "Choose your session, location, and preferred date.",
  },
  {
    frame: "02A",
    title: "Prepare",
    copy: "Receive clear outfit, timing, location, and arrival guidance.",
  },
  {
    frame: "03A",
    title: "Photograph",
    copy: "Get full posing direction and natural movement prompts throughout your session.",
  },
  {
    frame: "04A",
    title: "Receive",
    copy: "Download your professionally edited photographs from a private online gallery.",
    keeper: true,
  },
];

export default function HomeAboutExperience({
  aboutPortrait,
}: {
  aboutPortrait: { image_url: string; alt: string };
}) {
  return (
    <section className={`${styles.section} ${styles.tint} ${responsive.section}`}>
      <div className={`${styles.shell} ${responsive.shell}`}>
        <div className={details.split}>
          <div className={details.portrait} data-reveal="scale">
            <OptimizedPhoto
              src={aboutPortrait.image_url}
              alt={aboutPortrait.alt}
              sizes="(max-width: 920px) 92vw, 44vw"
              quality={90}
            />
          </div>
          <div data-reveal="left">
            <p className={styles.eyebrow}>The photographer and the experience</p>
            <h2 className={styles.title}>Hi, I&rsquo;m Chris</h2>
            <p className={styles.copy}>
              I am a San Francisco-based photographer specializing in graduation and couples
              portraits throughout the Bay Area. Most of my clients are not professional models, so
              I provide clear posing guidance while keeping the experience relaxed, natural, and
              personal.
            </p>
            <div className={styles.actions}>
              <Link href="/about" className={styles.button}>More About Chris</Link>
              <Link href="/availability" className={`${styles.button} ${styles.buttonGhost}`}>
                View Availability
              </Link>
            </div>
          </div>
        </div>

        <p className={film.label}>The process, frame by frame</p>
        <div className={film.strip}>
          <div className={film.perf} aria-hidden="true" />
          <ol className={film.frames}>
            {PROCESS.map((step, index) => (
              <li
                key={step.frame}
                className={film.frame}
                data-reveal
                data-delay={index + 1}
              >
                <span className={film.edge} aria-hidden="true">
                  <span>Solox 400</span>
                  <span className={film.frameNo}>
                    {step.frame}
                    {step.keeper ? (
                      <svg
                        className={film.circle}
                        viewBox="0 0 100 44"
                        preserveAspectRatio="none"
                      >
                        <path
                          d="M9 22 C 12 8, 36 3, 58 5 C 82 7, 95 13, 93 24 C 91 36, 68 42, 44 41 C 22 40, 5 35, 8 23 C 10 15, 22 9, 34 8"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          vectorEffect="non-scaling-stroke"
                        />
                      </svg>
                    ) : null}
                  </span>
                </span>
                <h3>{step.title}</h3>
                <p>{step.copy}</p>
                {step.keeper ? (
                  <span className={`${film.note} ${caveat.className}`} aria-hidden="true">
                    the keeper
                  </span>
                ) : null}
              </li>
            ))}
          </ol>
          <div className={film.perf} aria-hidden="true" />
        </div>

        <p className={styles.copy}>
          Your booking details, preparation resources, editing status, and gallery are organized
          inside your private client dashboard.
        </p>
      </div>
    </section>
  );
}
