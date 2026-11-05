import ProNav from "@/app/components/ProNav";
import ProFooter from "@/app/components/ProFooter";
import ScrollReveal from "@/app/components/ScrollReveal";
import VisitorTracker from "@/app/components/VisitorTracker";
import PricingPhotoWarmup from "@/app/components/PricingPhotoWarmup";
import PublicPhotoWarmup from "@/app/components/PublicPhotoWarmup";
import { getNavConfig, getPortfolioData, getSiteSettings } from "@/lib/professionalData";
import { getPricingPhotoManifest } from "@/lib/pricingPhotos";
import styles from "@/app/(professional)/ProfessionalLayout.module.css";

export default async function ProfessionalLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const [navConfig, { images }, settings] = await Promise.all([
    getNavConfig(), getPortfolioData(), getSiteSettings(),
  ]);
  return (
    <div className={styles.professionalShell}>
      <VisitorTracker />
      <PricingPhotoWarmup manifest={getPricingPhotoManifest(images, settings)} />
      <PublicPhotoWarmup />
      <ScrollReveal />
      <ProNav config={navConfig} />
      {children}

      <ProFooter />
    </div>
  );
}
