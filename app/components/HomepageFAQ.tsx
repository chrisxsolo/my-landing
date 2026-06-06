"use client";

import Link from "next/link";
import { useState } from "react";
import styles from "@/app/(professional)/home.module.css";
import details from "@/app/(professional)/homeDetails.module.css";
import responsive from "@/app/(professional)/homeResponsive.module.css";

type FAQItem = {
  q: string;
  a: string;
};

export default function HomepageFAQ({ items }: { items: FAQItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section className={`${styles.section} ${styles.tint} ${responsive.section}`}>
      <div className={`${styles.shell} ${responsive.shell}`}>
        <div className={`${styles.headerRow} ${responsive.headerRow}`}>
          <div>
            <p className={styles.eyebrow}>Before you book</p>
            <h2 className={styles.title}>Questions before booking</h2>
          </div>
          <p className={`${styles.copy} ${responsive.headerRowCopy}`}>
            Practical answers about posing, timing, booking, gallery delivery, and who can join your session.
          </p>
        </div>

        <div className={details.faqList}>
          {items.map((item, index) => {
            const open = openIndex === index;
            const panelId = `homepage-faq-${index}`;

            return (
              <div key={item.q} className={details.faqItem}>
                <button
                  type="button"
                  className={details.faqButton}
                  aria-expanded={open}
                  aria-controls={panelId}
                  onClick={() => setOpenIndex(open ? null : index)}
                >
                  <span>{item.q}</span>
                  <span className={details.faqIcon} aria-hidden="true">{open ? "−" : "+"}</span>
                </button>
                <div id={panelId} hidden={!open}>
                  <p className={details.faqAnswer}>{item.a}</p>
                </div>
              </div>
            );
          })}
        </div>

        <div className={styles.actions}>
          <Link href="/faq" className={`${styles.button} ${styles.buttonGhost}`}>
            Read All Frequently Asked Questions
          </Link>
        </div>
      </div>
    </section>
  );
}
