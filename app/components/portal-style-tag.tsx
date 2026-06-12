import { PORTAL_FONTS_URL, PORTAL_STYLES } from "@/app/components/portal-styles";

/** Font link + shared Gallery Print styles. Safe to render more than once. */
export default function PortalStyleTag() {
  return (
    <>
      <link rel="stylesheet" href={PORTAL_FONTS_URL} />
      <style>{PORTAL_STYLES}</style>
    </>
  );
}
