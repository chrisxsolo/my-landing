"use client";

// Private, phone-first couples posing reference for use during shoots: search,
// category jump chips, tap-to-open directions, favorites (shared with the
// public guide's photographer view via the same localStorage key), next-pose
// navigation, back-to-top, and an optional keep-screen-awake toggle.

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { COUPLES_GUIDE_FAVORITES_KEY } from "@/lib/couplesPosingGuide";
import PoseCard, { type ReferencePrompt } from "./PoseCard";
import styles from "./couplesPosingReference.module.css";

export type { ReferencePrompt };

type Props = { prompts: ReferencePrompt[]; categories: string[]; loadError: boolean };

const ALL = "All";
const FAVORITES = "Favorites";
const SHOW_TOP_AFTER_PX = 500;

function readFavorites(): number[] {
  try {
    const value = JSON.parse(localStorage.getItem(COUPLES_GUIDE_FAVORITES_KEY) ?? "[]");
    return Array.isArray(value) ? value.filter(Number.isInteger) : [];
  } catch {
    return [];
  }
}

function groupId(name: string) {
  return `group-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

function matches(prompt: ReferencePrompt, needle: string) {
  if (!needle) return true;
  return [prompt.title, prompt.instructions, prompt.variation ?? "", prompt.category, ...prompt.keywords]
    .some((value) => value.toLowerCase().includes(needle));
}

type WakeLockHandle = { release: () => Promise<void> };

function useWakeLock(enabled: boolean) {
  const lock = useRef<WakeLockHandle | null>(null);
  useEffect(() => {
    const nav = navigator as Navigator & { wakeLock?: { request: (type: "screen") => Promise<WakeLockHandle> } };
    if (!enabled || !nav.wakeLock) return;
    const acquire = () => {
      nav.wakeLock?.request("screen").then((handle) => { lock.current = handle; }).catch((err) => {
        console.error("[posing reference] screen wake lock unavailable", err);
      });
    };
    const onVisible = () => { if (document.visibilityState === "visible") acquire(); };
    acquire();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      void lock.current?.release().catch(() => undefined);
      lock.current = null;
    };
  }, [enabled]);
}

export default function CouplesPosingReference({ prompts, categories, loadError }: Props) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState(ALL);
  const [favorites, setFavorites] = useState<number[]>([]);
  const [open, setOpen] = useState<number[]>([]);
  const [showTop, setShowTop] = useState(false);
  const [awake, setAwake] = useState(false);
  useWakeLock(awake);

  useEffect(() => {
    const timeout = window.setTimeout(() => setFavorites(readFavorites()), 0);
    const onScroll = () => setShowTop(window.scrollY > SHOW_TOP_AFTER_PX);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  const groups = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const visible = prompts.filter((prompt) =>
      matches(prompt, needle) &&
      (filter === ALL || (filter === FAVORITES ? favorites.includes(prompt.number) : prompt.category === filter)));
    const order = [...categories, ...visible.map((p) => p.category).filter((c) => !categories.includes(c))];
    return Array.from(new Set(order))
      .map((name) => ({ name, prompts: visible.filter((prompt) => prompt.category === name) }))
      .filter((group) => group.prompts.length > 0);
  }, [categories, favorites, filter, prompts, search]);

  const flat = useMemo(() => groups.flatMap((group) => group.prompts), [groups]);
  const counts = useMemo(
    () => Object.fromEntries(categories.map((name) => [name, prompts.filter((p) => p.category === name).length])),
    [categories, prompts],
  );
  const allOpen = flat.length > 0 && flat.every((prompt) => open.includes(prompt.number));

  function toggleFavorite(number: number) {
    setFavorites((current) => {
      const next = current.includes(number) ? current.filter((n) => n !== number) : [...current, number];
      try {
        localStorage.setItem(COUPLES_GUIDE_FAVORITES_KEY, JSON.stringify(next));
      } catch (err) {
        console.error("[posing reference] could not save favorites", err);
      }
      return next;
    });
  }

  function toggle(number: number) {
    setOpen((current) => (current.includes(number) ? current.filter((n) => n !== number) : [...current, number]));
  }

  function goNext(number: number) {
    const next = flat[flat.findIndex((prompt) => prompt.number === number) + 1];
    if (!next) return;
    setOpen((current) => [...current.filter((n) => n !== number), next.number]);
    window.requestAnimationFrame(() => {
      document.getElementById(`pose-${next.number}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  const chips = [ALL, FAVORITES, ...categories.filter((name) => counts[name] > 0)];

  return (
    <main className={styles.page}>
      <header className={styles.bar}>
        <div className={styles.barRow}>
          <h1 className={styles.title}>Couples poses</h1>
          <Link href="/admin?tab=couplesGuide" className={styles.manage}>Manage</Link>
        </div>
        <input
          type="search"
          className={styles.search}
          placeholder={`Search ${prompts.length} poses…`}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          aria-label="Search poses"
          enterKeyHint="search"
        />
        <nav className={styles.chips} aria-label="Filter poses">
          {chips.map((chip) => (
            <button
              key={chip}
              type="button"
              className={`${styles.chip} ${filter === chip ? styles.chipActive : ""}`}
              onClick={() => setFilter(chip)}
              aria-pressed={filter === chip}
            >
              {chip === FAVORITES ? `★ ${FAVORITES} ${favorites.length}` : chip === ALL ? `${ALL} ${prompts.length}` : `${chip} ${counts[chip]}`}
            </button>
          ))}
        </nav>
        <div className={styles.tools}>
          <button type="button" className={styles.tool} onClick={() => setOpen(allOpen ? [] : flat.map((p) => p.number))}>
            {allOpen ? "Collapse all" : "Expand all"}
          </button>
          <label className={styles.tool}>
            <input type="checkbox" checked={awake} onChange={(event) => setAwake(event.target.checked)} /> Keep screen on
          </label>
        </div>
      </header>

      {loadError && <p className={styles.empty}>Couldn&rsquo;t load poses. Check your connection and refresh.</p>}
      {!loadError && groups.length === 0 && (
        <p className={styles.empty}>
          {filter === FAVORITES ? "No favorites yet — tap ☆ on any pose to save it here." : "No poses match that search."}
        </p>
      )}

      {groups.map((group) => (
        <section key={group.name} className={styles.group} aria-labelledby={groupId(group.name)}>
          <h2 id={groupId(group.name)} className={styles.groupTitle}>{group.name}</h2>
          {group.prompts.map((prompt) => (
            <PoseCard
              key={prompt.number}
              prompt={prompt}
              open={open.includes(prompt.number)}
              favorite={favorites.includes(prompt.number)}
              hasNext={flat[flat.length - 1]?.number !== prompt.number}
              onToggle={() => toggle(prompt.number)}
              onFavorite={() => toggleFavorite(prompt.number)}
              onNext={() => goNext(prompt.number)}
            />
          ))}
        </section>
      ))}

      {showTop && (
        <button type="button" className={styles.topButton} onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} aria-label="Back to top">
          ↑
        </button>
      )}
    </main>
  );
}
