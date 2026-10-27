// Industrias del portal público. Los textos están en messages/<idioma>.json (Portal.industries.<slug>).
// `categories` son los slugs de categorías de la plataforma que se precargan al pedir cotización;
// `keywords` alimenta el buscador de la portada (sin tildes, en minúsculas).
export const industries = [
  {
    slug: "construccion-y-acabados",
    icon: "build",
    categories: ["ceramics-porcelain", "sanitary-faucets", "lighting", "kitchen-cabinets"],
    keywords: ["material", "construccion", "obra", "acabado", "ceramica", "porcelanato", "sanitario", "griferia", "iluminacion", "luminaria", "gabinete", "cocina"],
  },
  {
    slug: "puertas-y-ventanas",
    icon: "door",
    categories: ["doors", "windows"],
    keywords: ["puerta", "ventana", "aluminio", "pvc", "madera", "vidrio", "fachada", "carpinteria", "corrediza"],
  },
  {
    slug: "pisos-y-revestimientos",
    icon: "floor",
    categories: ["flooring", "wall-cladding"],
    keywords: ["piso", "spc", "laminado", "revestimiento", "pared", "piedra", "porcelanato", "vinilico", "baldosa"],
  },
] as const;

export type Industry = (typeof industries)[number];
export type IndustrySlug = Industry["slug"];
export type IllustrationKey = Industry["icon"];

export const industryBySlug = (slug: string) => industries.find((i) => i.slug === slug);

export const normalize = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
