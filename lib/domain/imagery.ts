import type { Category } from "./types";

/**
 * Decorative header imagery. Nothing depends on these — an opportunity with no
 * image works identically — but a wall of text is a wall you stop opening, and
 * this tool only pays off if it gets opened every day.
 *
 * Direct Unsplash CDN URLs: no API key, no rate limit, no runtime dependency.
 * Every id below was checked to return a real image before being added.
 */

const CDN = "https://images.unsplash.com";

/** Photo ids, grouped by what the picture actually shows. */
const PHOTOS = {
  code: "photo-1461749280684-dccba630e2f6",
  laptopCode: "photo-1498050108023-c5249f4df085",
  laptopDesk: "photo-1504384308090-c894fdcc538d",
  macbook: "photo-1486312338219-ce68d2c6f44d",
  warehouse: "photo-1553413077-190dd305871c",
  truck: "photo-1519003722824-194d4455a60c",
  finance: "photo-1454165804606-c3d57bc86b40",
  calculator: "photo-1554224155-6726b3ff858f",
  paperwork: "photo-1450101499163-c8848c66ca85",
  filing: "photo-1568667256549-094345857637",
  analytics: "photo-1551288049-bebda4e38f71",
  charts: "photo-1460925895917-afdab827c52f",
  clinic: "photo-1588776814546-1ffcf47267a5",
  legal: "photo-1589829545856-d10d557cf95f",
  studio: "photo-1561070791-2526d30994b5",
  interview: "photo-1521737711867-e3b97375f902",
  team: "photo-1573164713988-8665fc963095",
  retail: "photo-1441986300917-64674bd600d8",
  factory: "photo-1581091226825-a6a2a5aee158",
  support: "photo-1553877522-43269d4ea984",
  property: "photo-1560518883-ce09059eeffa",
  energy: "photo-1466611653911-95081537e5b7",
  office: "photo-1522071820081-009f0129c71c",
  meeting: "photo-1517245386807-bb43f82c33c4",
  campus: "photo-1541339907198-e08756dedf3f",
  graduation: "photo-1607013251379-e6eecfffe234",
  library: "photo-1481627834876-b7833e8f5570",
} as const;

/** First match wins, so put the specific patterns above the generic ones. */
const RULES: { test: RegExp; photo: string }[] = [
  { test: /freight|logistic|shipping|haulage|courier|supply chain|3pl|customs/i, photo: PHOTOS.truck },
  { test: /warehouse|fulfil|distribution|inventory|stock/i, photo: PHOTOS.warehouse },
  { test: /invoice|accounts payable|billing|bookkeep|account|payroll|finance|reconcil/i, photo: PHOTOS.finance },
  { test: /insurance|claim|underwrit|broker/i, photo: PHOTOS.paperwork },
  { test: /legal|law|solicitor|conveyanc|paralegal|compliance|contract review/i, photo: PHOTOS.legal },
  { test: /dental|clinic|health|medical|patient|veterinar|pharmac|care home/i, photo: PHOTOS.clinic },
  { test: /recruit|talent|hiring|candidate|cv |résumé|resume/i, photo: PHOTOS.interview },
  { test: /property|estate|letting|tenant|landlord|real estate|facilit/i, photo: PHOTOS.property },
  { test: /manufactur|production|factory|plant|assembly|engineering works/i, photo: PHOTOS.factory },
  { test: /retail|ecommerce|e-commerce|shop|store|merchandis|order processing/i, photo: PHOTOS.retail },
  { test: /support|helpdesk|service desk|call cent|customer service|ticket/i, photo: PHOTOS.support },
  { test: /energy|utilit|solar|renewable|oil|gas|power/i, photo: PHOTOS.energy },
  { test: /scholarship|fellowship|bursary|grant|master|phd|undergrad|universit|academic|study/i, photo: PHOTOS.graduation },
  { test: /research|analys|analyt|data science|report|dashboard|bi\b/i, photo: PHOTOS.analytics },
  { test: /design|creative|brand|studio|agency|portfolio|ux|ui\b/i, photo: PHOTOS.studio },
  { test: /data entry|spreadsheet|excel|admin|clerical|back.?office|document|filing|record/i, photo: PHOTOS.filing },
  { test: /web|frontend|front-end|react|next\.?js|website|full.?stack|javascript|typescript/i, photo: PHOTOS.laptopCode },
  { test: /software|engineer|developer|programming|api|backend|back-end|python|automation|ai\b|llm|integration|internal tool/i, photo: PHOTOS.code },
];

/** Used when nothing matches, varied by category so the board is not uniform. */
const FALLBACK: Record<Category, string> = {
  workflow: PHOTOS.paperwork,
  speculative: PHOTOS.meeting,
  job: PHOTOS.laptopDesk,
  scholarship: PHOTOS.campus,
  build: PHOTOS.macbook,
};

/**
 * Picks a photo from whatever text describes the opportunity — title, industry,
 * skills, the observed problem. Deterministic: the same opportunity always gets
 * the same picture, so the board does not reshuffle on every render.
 */
export function imageForOpportunity(input: {
  category: Category;
  title?: string | null;
  industry?: string | null;
  problem?: string | null;
  skills?: string[] | null;
  notes?: string | null;
}): string {
  const haystack = [
    input.title,
    input.industry,
    input.problem,
    input.notes,
    ...(input.skills ?? []),
  ]
    .filter(Boolean)
    .join(" ");

  const match = RULES.find((rule) => rule.test.test(haystack));
  return photoUrl(match?.photo ?? FALLBACK[input.category]);
}

export function photoUrl(id: string, width = 640): string {
  return `${CDN}/${id}?auto=format&fit=crop&w=${width}&q=60`;
}

/* -------------------------------------------------------------------------- */
/*  Country flags                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Derives a country from free-text location ("Lagos, Nigeria", "Pittsburgh PA HQ").
 * Decorative only — a wrong or missing flag changes nothing.
 *
 * Both a flag emoji and an ISO code are carried because Windows has no glyphs
 * for regional-indicator pairs: 🇳🇬 renders there as the letters "NG". The UI
 * uses the image; the emoji is the fallback if the image fails to load.
 */
const COUNTRIES: { flag: string; name: string; code: string; test: RegExp }[] = [
  { flag: "🇬🇧", name: "United Kingdom", code: "gb", test: /\b(uk|united kingdom|england|scotland|wales|london|manchester|birmingham|leeds|bristol|glasgow|edinburgh|sheffield|liverpool|nottingham|cardiff|belfast|coventry|reading|brighton|oxford|cambridge)\b/i },
  { flag: "🇳🇬", name: "Nigeria", code: "ng", test: /\b(nigeria|lagos|abuja|ibadan|port harcourt|kano|benin city)\b/i },
  { flag: "🇺🇸", name: "United States", code: "us", test: /\b(usa|u\.s\.|united states|america|new york|san francisco|austin|seattle|boston|chicago|denver|atlanta|pittsburgh|tampa|miami|los angeles|remote us|[a-z]+,? (ny|ca|tx|wa|ma|il|co|ga|pa|fl|nj|va|nc|oh|az|mi))\b/i },
  { flag: "🇨🇦", name: "Canada", code: "ca", test: /\b(canada|toronto|vancouver|montreal|ottawa|calgary)\b/i },
  { flag: "🇮🇪", name: "Ireland", code: "ie", test: /\b(ireland|dublin|cork|galway)\b/i },
  { flag: "🇩🇪", name: "Germany", code: "de", test: /\b(germany|berlin|munich|hamburg|frankfurt|cologne)\b/i },
  { flag: "🇳🇱", name: "Netherlands", code: "nl", test: /\b(netherlands|holland|amsterdam|rotterdam|utrecht|eindhoven)\b/i },
  { flag: "🇫🇷", name: "France", code: "fr", test: /\b(france|paris|lyon|marseille|toulouse)\b/i },
  { flag: "🇪🇸", name: "Spain", code: "es", test: /\b(spain|madrid|barcelona|valencia)\b/i },
  { flag: "🇮🇹", name: "Italy", code: "it", test: /\b(italy|milan|rome|turin)\b/i },
  { flag: "🇵🇹", name: "Portugal", code: "pt", test: /\b(portugal|lisbon|porto)\b/i },
  { flag: "🇵🇱", name: "Poland", code: "pl", test: /\b(poland|warsaw|krakow|kraków|wroclaw)\b/i },
  { flag: "🇸🇪", name: "Sweden", code: "se", test: /\b(sweden|stockholm|gothenburg)\b/i },
  { flag: "🇩🇰", name: "Denmark", code: "dk", test: /\b(denmark|copenhagen)\b/i },
  { flag: "🇳🇴", name: "Norway", code: "no", test: /\b(norway|oslo)\b/i },
  { flag: "🇨🇭", name: "Switzerland", code: "ch", test: /\b(switzerland|zurich|geneva|zürich)\b/i },
  { flag: "🇦🇹", name: "Austria", code: "at", test: /\b(austria|vienna)\b/i },
  { flag: "🇧🇪", name: "Belgium", code: "be", test: /\b(belgium|brussels|antwerp)\b/i },
  { flag: "🇦🇺", name: "Australia", code: "au", test: /\b(australia|sydney|melbourne|brisbane|perth)\b/i },
  { flag: "🇳🇿", name: "New Zealand", code: "nz", test: /\b(new zealand|auckland|wellington)\b/i },
  { flag: "🇮🇳", name: "India", code: "in", test: /\b(india|bangalore|bengaluru|mumbai|delhi|hyderabad|pune|chennai)\b/i },
  { flag: "🇿🇦", name: "South Africa", code: "za", test: /\b(south africa|johannesburg|cape town|durban|pretoria)\b/i },
  { flag: "🇰🇪", name: "Kenya", code: "ke", test: /\b(kenya|nairobi|mombasa)\b/i },
  { flag: "🇬🇭", name: "Ghana", code: "gh", test: /\b(ghana|accra|kumasi)\b/i },
  { flag: "🇪🇬", name: "Egypt", code: "eg", test: /\b(egypt|cairo)\b/i },
  { flag: "🇦🇪", name: "United Arab Emirates", code: "ae", test: /\b(uae|dubai|abu dhabi|emirates)\b/i },
  { flag: "🇸🇬", name: "Singapore", code: "sg", test: /\bsingapore\b/i },
  { flag: "🇯🇵", name: "Japan", code: "jp", test: /\b(japan|tokyo|osaka)\b/i },
  { flag: "🇧🇷", name: "Brazil", code: "br", test: /\b(brazil|brasil|sao paulo|são paulo|rio de janeiro)\b/i },
  { flag: "🇲🇽", name: "Mexico", code: "mx", test: /\b(mexico|méxico|guadalajara|monterrey)\b/i },
];

export type CountryHint = { flag: string; name: string; code: string; imageUrl: string };

export function countryOf(...values: (string | null | undefined)[]): CountryHint | null {
  const text = values.filter(Boolean).join(" ");
  if (!text.trim()) return null;
  const match = COUNTRIES.find((country) => country.test.test(text));
  if (!match) return null;
  return {
    flag: match.flag,
    name: match.name,
    code: match.code,
    imageUrl: `https://flagcdn.com/32x24/${match.code}.png`,
  };
}

/** Remote-first roles have no country; say so rather than showing nothing. */
export function isRemote(...values: (string | null | undefined)[]): boolean {
  return /\b(remote|distributed|work from home|wfh|anywhere)\b/i.test(
    values.filter(Boolean).join(" "),
  );
}
