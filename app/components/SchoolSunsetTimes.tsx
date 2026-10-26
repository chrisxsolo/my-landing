// Approximate sunset by month for a campus city, computed with the site's
// NOAA-based sunset calculator (lib/ai/goldenHour) — never hardcoded. Rendered
// on the server, so the numbers follow the current year on each revalidation.
import { computeSunsetUtc, formatLocalTime } from "@/lib/ai/goldenHour";

const MONTHS = [
  { label: "Jan", month: "01" }, { label: "Mar", month: "03" }, { label: "May", month: "05" },
  { label: "Jul", month: "07" }, { label: "Sep", month: "09" }, { label: "Nov", month: "11" },
] as const;

type Props = { city: string; coords: { latitude: number; longitude: number } };

export default function SchoolSunsetTimes({ city, coords }: Props) {
  const year = new Date().getFullYear();
  const rows = MONTHS.flatMap(({ label, month }) => {
    const sunset = computeSunsetUtc(`${year}-${month}-15`, coords.latitude, coords.longitude);
    return sunset ? [{ label, time: formatLocalTime(sunset) }] : [];
  });
  if (rows.length === 0) return null;

  return (
    <>
      <p className="spg-ideas-label">Approximate sunset in {city} (mid-month, {year})</p>
      <dl className="spg-sunset">
        {rows.map((row) => (
          <div key={row.label}>
            <dt>{row.label}</dt>
            <dd>{row.time}</dd>
          </div>
        ))}
      </dl>
      <p className="spg-fine">
        Calculated times for planning, not a guarantee. Golden-hour sessions usually start about an hour
        before sunset, and I&rsquo;ll confirm the exact start time for your date.
      </p>
    </>
  );
}
