import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Investment | soloxsnaps",
  description:
    "Photography investment and package starting points for soloxsnaps in San Francisco and the Bay Area.",
  alternates: {
    canonical: "/investment",
  },
  openGraph: {
    title: "Investment | soloxsnaps",
    description:
      "Photography investment and package starting points for soloxsnaps in San Francisco and the Bay Area.",
    type: "website",
  },
};

const packages = [
  {
    name: "Portrait",
    price: "Starting at $250",
    details: "Individual portraits, personal branding, or a clean creative refresh.",
    includes: ["45-60 minute session", "One Bay Area location", "Edited online gallery"],
  },
  {
    name: "Graduation",
    price: "Starting at $300",
    details: "A polished gallery for grads who want a sharper, more editorial set.",
    includes: ["60-90 minute session", "Campus or city location", "Cap, gown, and detail shots"],
  },
  {
    name: "Events",
    price: "Custom quote",
    details: "Small events, celebrations, and coverage with a documentary feel.",
    includes: ["Hourly coverage", "Candid and detail images", "Edited online gallery"],
  },
];

export default function InvestmentPage() {
  return (
    <main className="bg-[#fbfbfa] text-[#202020]">
      <section className="mx-auto max-w-7xl px-5 py-16 text-center sm:px-8 sm:py-20">
        <p className="text-sm uppercase text-black/42">Investment</p>
        <h1 className="mx-auto mt-4 max-w-5xl font-serif text-5xl font-normal leading-none text-[#202020] sm:text-7xl lg:text-8xl">
          What I can offer for you.
        </h1>
        <p className="mx-auto mt-7 max-w-2xl text-base leading-7 text-black/60">
          Every session starts with the same baseline: thoughtful planning, calm direction, clean edits, and a private gallery built for easy sharing.
        </p>
      </section>

      <section className="px-5 pb-16 sm:px-8">
        <div className="mx-auto max-w-7xl border-t border-black/14">
          {packages.map((item, index) => (
            <article key={item.name} className="grid gap-6 border-b border-black/14 py-9 lg:grid-cols-[140px_0.7fr_1fr]">
              <p className="font-serif text-3xl leading-none text-black/50">
                {String(index + 1).padStart(2, "0")}
              </p>
              <div>
                <p className="text-sm uppercase text-black/42">{item.name}</p>
                <h2 className="mt-3 text-3xl font-medium leading-tight text-[#202020]">{item.price}</h2>
                <p className="mt-4 max-w-md text-sm leading-6 text-black/58">{item.details}</p>
              </div>
              <ul className="grid gap-3 text-sm text-black/62 sm:grid-cols-3 lg:grid-cols-1">
                {item.includes.map((detail) => (
                  <li key={detail} className="border-t border-black/10 pt-3">
                    {detail}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="border-t border-black/10 px-5 py-16 sm:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 md:grid-cols-[1fr_0.6fr] md:items-end">
          <div>
            <p className="text-sm uppercase text-black/42">Availability</p>
            <h2 className="mt-4 max-w-4xl font-serif text-4xl font-normal leading-tight text-[#202020] sm:text-6xl">
              Tell me the date, location, and what this is for.
            </h2>
            <p className="mt-5 max-w-2xl text-base leading-7 text-black/58">
              I will reply with availability, package fit, and a clear next step.
            </p>
          </div>
          <a
            href="https://www.soloxsnaps.com/contact/"
            className="w-fit border border-black px-5 py-3 text-sm font-medium text-[#202020] transition-colors hover:bg-black hover:text-white"
          >
            Start an inquiry
          </a>
        </div>
      </section>
    </main>
  );
}
