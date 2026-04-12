import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About | soloxsnaps",
  description:
    "Meet Chris Solorzano, the San Francisco based photographer behind soloxsnaps.",
  alternates: {
    canonical: "/about",
  },
  openGraph: {
    title: "About | soloxsnaps",
    description:
      "Meet Chris Solorzano, the San Francisco based photographer behind soloxsnaps.",
    type: "profile",
  },
};

const portrait =
  "https://dmtslzwglpezympptqls.supabase.co/storage/v1/object/public/grad-photos/DSC02593_(2).jpg";

const process = [
  ["01", "Planning", "Location, timing, outfit notes, and the reason for the session get set before we shoot."],
  ["02", "Session", "I give clear direction, then leave enough room for the in-between moments to happen."],
  ["03", "Delivery", "The final gallery is edited cleanly and delivered in a private online space."],
];

export default function ProfessionalAboutPage() {
  return (
    <main className="bg-[#fbfbfa] text-[#202020]">
      <section className="mx-auto grid max-w-7xl gap-10 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-[1.05fr_0.95fr] lg:items-end">
        <div className="overflow-hidden bg-black/5">
          <img src={portrait} alt="Chris Solorzano" className="h-full max-h-[760px] w-full object-cover" />
        </div>
        <div>
          <p className="text-sm uppercase text-black/42">All about Chris</p>
          <h1 className="mt-4 font-serif text-5xl font-normal leading-none text-[#202020] sm:text-7xl lg:text-8xl">
            I'm Chris.
          </h1>
          <p className="mt-7 max-w-xl text-lg leading-8 text-black/64">
            I photograph people with a clean, direct style built around light, timing, and calm direction. The work is polished, but the session should still feel like a real person made space for you.
          </p>
        </div>
      </section>

      <section className="border-t border-black/10 px-5 py-16 sm:px-8">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.7fr_1.3fr]">
          <div>
            <p className="text-sm uppercase text-black/42">Approach</p>
            <h2 className="mt-4 font-serif text-4xl font-normal leading-tight text-[#202020] sm:text-6xl">
              Direction without the stiffness.
            </h2>
          </div>
          <div className="space-y-7 text-lg leading-8 text-black/64">
            <p>
              Sessions are built to feel clear and easy. I help with posing, pacing, location choices, and small adjustments so the final gallery feels intentional without flattening the person in front of the camera.
            </p>
            <p>
              My work spans Bay Area graduation portraits, individual portraits, small events, and creative sessions. The common thread is simple: strong light, clean composition, and images that still feel like the moment.
            </p>
            <p>
              soloxsnaps is the professional home for that work. The warmer guides and behind-the-scenes journal still live in the fun side of the site.
            </p>
          </div>
        </div>
      </section>

      <section className="border-t border-black/10 px-5 py-16 sm:px-8">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.75fr_1.25fr]">
          <div>
            <p className="text-sm uppercase text-black/42">How it works</p>
            <h2 className="mt-4 font-serif text-4xl font-normal leading-tight text-[#202020] sm:text-6xl">
              A simple rhythm from first note to final gallery.
            </h2>
          </div>
          <div className="border-t border-black/14">
            {process.map(([number, name, body]) => (
              <div key={name} className="grid gap-4 border-b border-black/14 py-7 sm:grid-cols-[120px_1fr]">
                <p className="font-serif text-3xl leading-none text-black/50">{number}</p>
                <div>
                  <h3 className="text-2xl font-medium text-[#202020]">{name}</h3>
                  <p className="mt-3 text-sm leading-6 text-black/56">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-black/10 px-5 py-16 sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-7 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm uppercase text-black/42">Inquiries</p>
            <h2 className="mt-4 max-w-3xl font-serif text-4xl font-normal leading-tight text-[#202020] sm:text-6xl">
              Ready to see what this could look like for you?
            </h2>
          </div>
          <Link
            href="/investment"
            className="w-fit border border-black px-5 py-3 text-sm font-medium text-[#202020] transition-colors hover:bg-black hover:text-white"
          >
            View investment
          </Link>
        </div>
      </section>
    </main>
  );
}
