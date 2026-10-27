// Industrias del portal público. Los textos están en messages/<idioma>.json (Portal.industries.<slug>).
// `categories` son los slugs de categorías de la plataforma que se precargan al pedir cotización;
// `keywords` alimenta el buscador de la portada (sin tildes, en minúsculas). `featured` = tarjeta en la
// portada. Las industrias sin `categories` aún no tienen categoría en la plataforma: la solicitud se
// precarga como "Otro producto".
export const industries = [
  {
    slug: "construccion-y-acabados",
    icon: "build",
    photo: "/fotos/construccion.jpg",
    featured: true,
    categories: ["ceramics-porcelain", "sanitary-faucets", "lighting", "kitchen-cabinets"],
    keywords: ["material", "construccion", "obra", "acabado", "ceramica", "porcelanato", "sanitario", "griferia", "iluminacion", "luminaria", "gabinete", "cocina"],
  },
  {
    slug: "puertas-y-ventanas",
    icon: "door",
    photo: null,
    featured: false,
    categories: ["doors", "windows"],
    keywords: ["puerta", "ventana", "aluminio", "pvc", "madera", "vidrio", "fachada", "carpinteria", "corrediza"],
  },
  {
    slug: "pisos-y-revestimientos",
    icon: "floor",
    photo: "/fotos/pisos.jpg",
    featured: true,
    categories: ["flooring", "wall-cladding"],
    keywords: ["piso", "spc", "laminado", "revestimiento", "pared", "piedra", "porcelanato", "vinilico", "baldosa"],
  },
  {
    slug: "alimentos-y-bebidas",
    icon: "build",
    photo: "/fotos/alimentos.jpg",
    featured: true,
    categories: [],
    keywords: ["alimento", "bebida", "energetica", "envasado", "snack", "consumo", "comida", "jugo", "agua"],
  },
  {
    slug: "equipamiento-comercial",
    icon: "build",
    photo: "/fotos/equipamiento.jpg",
    featured: true,
    categories: [],
    keywords: ["equipamiento", "mobiliario", "mueble", "exhibidor", "gondola", "estanteria", "mostrador", "tienda", "comercial"],
  },
  {
    slug: "textiles-y-confeccion",
    icon: "build",
    photo: "/fotos/textiles.jpg",
    featured: true,
    categories: [],
    keywords: ["textil", "tela", "ropa", "prenda", "uniforme", "confeccion", "accesorio", "camisa"],
  },
] as const;

export type Industry = (typeof industries)[number];
export type IndustrySlug = Industry["slug"];
export type IllustrationKey = Industry["icon"];

export const industryBySlug = (slug: string) => industries.find((i) => i.slug === slug);

export const normalize = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
