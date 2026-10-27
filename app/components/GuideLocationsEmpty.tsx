// Shown in a guide's location grid when none of its location guides is
// published yet: public hubs list only published guides, so an unpublished
// (noindex) page is never linked from here. Uses the guides' fg-empty style.

export default function GuideLocationsEmpty({ service }: { service: string }) {
  return (
    <div className="fg-empty" data-reveal>
      <p>
        {service} location guides are on their way. In the meantime, send me your date and
        I&rsquo;ll suggest the right spot for your session.
      </p>
    </div>
  );
}
