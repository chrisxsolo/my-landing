// Schema.org builders for the public site, around two stable entities.
//
// Every page used to describe the business afresh (a ProfessionalService on
// the homepage, another with different casing on each campus page, a bare
// Person/Organization pair on posts), so crawlers saw disconnected nodes. The
// business and its photographer each have one @id now; pages that refer to
// them use the short references below, and only the homepage and About page
// carry the full nodes.
//
// Only facts shown on the site go here. No address, phone, hours, review
// counts, or service-area invention: SoloXSnaps is a service-area business
// and the owner's residential address stays private.

import { absoluteUrl, DEFAULT_SOCIAL_IMAGE, SITE_URL } from "./siteMetadata";

export const BUSINESS_NAME = "SoloXSnaps";
export const OWNER_NAME = "Chris Solorzano";
export const BUSINESS_ID = `${SITE_URL}/#business`;
export const PERSON_ID = `${SITE_URL}/#chris-solorzano`;
export const WEBSITE_ID = `${SITE_URL}/#website`;
export const ABOUT_PATH = "/about";
export const INSTAGRAM_PROFILE_URL = "https://www.instagram.com/soloxsnaps";

/** Where the business works, as the public pages describe it. */
export const AREA_SERVED = ["San Francisco", "San Francisco Bay Area", "Berkeley", "Oakland", "San Jose", "Peninsula"];
export const SERVICE_TYPES = [
  "Graduation photography",
  "Couples photography",
  "Family photography",
  "Maternity photography",
  "Elopement photography",
  "Portrait photography",
  "Event photography",
];

export type JsonLdNode = Record<string, unknown>;

/** The ProfessionalService node every other page points at. */
export function businessEntity(image: string = DEFAULT_SOCIAL_IMAGE.url): JsonLdNode {
  return {
    "@type": "ProfessionalService",
    "@id": BUSINESS_ID,
    name: BUSINESS_NAME,
    alternateName: "SoloXSnaps Photography",
    url: SITE_URL,
    image: absoluteUrl(image),
    description:
      "Bay Area graduation and couples photographer Chris Solorzano, with guided family, maternity, elopement, and portrait sessions.",
    founder: personRef(),
    areaServed: AREA_SERVED,
    serviceType: SERVICE_TYPES,
    sameAs: [INSTAGRAM_PROFILE_URL],
  };
}

/** The photographer, as the About page presents him. */
export function personEntity(image: string = DEFAULT_SOCIAL_IMAGE.url): JsonLdNode {
  return {
    "@type": "Person",
    "@id": PERSON_ID,
    name: OWNER_NAME,
    url: absoluteUrl(ABOUT_PATH),
    image: absoluteUrl(image),
    jobTitle: "Photographer",
    worksFor: { "@id": BUSINESS_ID },
    knowsAbout: SERVICE_TYPES,
    sameAs: [INSTAGRAM_PROFILE_URL],
  };
}

export function websiteEntity(): JsonLdNode {
  return {
    "@type": "WebSite",
    "@id": WEBSITE_ID,
    name: BUSINESS_NAME,
    url: SITE_URL,
    publisher: { "@id": BUSINESS_ID },
  };
}

/** Short reference to the business for provider/publisher fields. */
export function businessRef(): JsonLdNode {
  return { "@type": "ProfessionalService", "@id": BUSINESS_ID, name: BUSINESS_NAME, url: SITE_URL };
}

/** Short reference to the photographer for author/creator fields. */
export function personRef(): JsonLdNode {
  return { "@type": "Person", "@id": PERSON_ID, name: OWNER_NAME, url: absoluteUrl(ABOUT_PATH) };
}

export type OfferInput = { name: string; price: number; description?: string; unitText?: string };

/** A priced package exactly as the catalog states it. */
export function offerEntity(path: string, offer: OfferInput): JsonLdNode {
  const base = { "@type": "Offer", name: offer.name, url: absoluteUrl(path), priceCurrency: "USD", availability: "https://schema.org/InStock" };
  const description = offer.description ? { description: offer.description } : {};
  if (offer.unitText) {
    return {
      ...base, ...description,
      priceSpecification: { "@type": "UnitPriceSpecification", price: offer.price, priceCurrency: "USD", unitText: offer.unitText },
    };
  }
  return { ...base, ...description, price: offer.price };
}

export type ServiceInput = {
  name: string;
  description: string;
  path: string;
  serviceType: string;
  areaServed?: string[];
  image?: string;
  offers?: OfferInput[];
};

/** A service the business sells, provided by the stable business node. */
export function serviceEntity(input: ServiceInput): JsonLdNode {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name: input.name,
    description: input.description,
    url: absoluteUrl(input.path),
    serviceType: input.serviceType,
    provider: businessRef(),
    areaServed: input.areaServed ?? AREA_SERVED,
    ...(input.image ? { image: absoluteUrl(input.image) } : {}),
    ...(input.offers?.length ? { offers: input.offers.map((offer) => offerEntity(input.path, offer)) } : {}),
  };
}

export type WebPageType = "WebPage" | "ContactPage" | "CollectionPage" | "ProfilePage" | "Blog" | "AboutPage";

export type WebPageInput = {
  type: WebPageType;
  name: string;
  description: string;
  path: string;
  mainEntity?: JsonLdNode;
};

/** A page node tied to the site and its publisher. */
export function webPageEntity(input: WebPageInput): JsonLdNode {
  return {
    "@context": "https://schema.org",
    "@type": input.type,
    name: input.name,
    description: input.description,
    url: absoluteUrl(input.path),
    isPartOf: { "@id": WEBSITE_ID },
    publisher: { "@id": BUSINESS_ID },
    ...(input.mainEntity ? { mainEntity: input.mainEntity } : {}),
  };
}

/** The homepage graph: business, photographer, and site in one block. */
export function siteGraph(heroImage?: string | null): JsonLdNode {
  return {
    "@context": "https://schema.org",
    "@graph": [businessEntity(heroImage ?? undefined), personEntity(), websiteEntity()],
  };
}

/** The About page graph: a ProfilePage whose subject is the photographer. */
export function profileGraph(portrait: string): JsonLdNode {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "ProfilePage",
        url: absoluteUrl(ABOUT_PATH),
        name: `About ${OWNER_NAME}`,
        mainEntity: { "@id": PERSON_ID },
        isPartOf: { "@id": WEBSITE_ID },
      },
      personEntity(portrait),
      businessRef(),
    ],
  };
}

/** Serialises a node for a `<script type="application/ld+json">` body. */
export function serializeJsonLd(node: JsonLdNode): string {
  return JSON.stringify(node).replace(/</g, "\\u003c");
}
