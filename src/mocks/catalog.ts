import { productSchema, type Product } from "@/contracts";
export const categories = [
  {
    slug: "indoor-plants",
    name: "Indoor plants",
    short: "Indoor",
    image: "monstera",
  },
  {
    slug: "outdoor-plants",
    name: "Outdoor plants",
    short: "Outdoor",
    image: "lifestyle",
  },
  {
    slug: "flowering-plants",
    name: "Flowering plants",
    short: "Flowering",
    image: "lily",
  },
  {
    slug: "succulents",
    name: "Succulents & cacti",
    short: "Succulents",
    image: "snake",
  },
  {
    slug: "pots-planters",
    name: "Pots & planters",
    short: "Planters",
    image: "hero",
  },
  {
    slug: "plant-care",
    name: "Care & essentials",
    short: "Essentials",
    image: "variegated",
  },
];
const seeds: [string, string, number, string, string][] = [
  ["Monstera Deliciosa", "indoor-plants", 699, "monstera", "Bestseller"],
  ["Snake Plant Laurentii", "indoor-plants", 449, "snake", "Easy to love"],
  ["Peace Lily", "flowering-plants", 549, "lily", "Customer favourite"],
  [
    "Golden Money Plant",
    "indoor-plants",
    299,
    "variegated",
    "Beginner friendly",
  ],
  ["Areca Palm", "indoor-plants", 899, "lifestyle", "Statement plant"],
  ["ZZ Plant", "indoor-plants", 649, "snake", "Easy care"],
  ["Rubber Plant", "indoor-plants", 749, "monstera", "New arrival"],
  ["Philodendron Green", "indoor-plants", 399, "variegated", "Easy care"],
  ["Balcony Fern", "outdoor-plants", 399, "lifestyle", "Balcony edit"],
  ["Jade Plant", "succulents", 349, "snake", "Small & lovely"],
  ["Aloe Vera", "succulents", 299, "snake", "Easy care"],
  ["Echeveria Rosette", "succulents", 249, "variegated", "Little greens"],
  ["Hibiscus", "flowering-plants", 449, "lily", "Flowering"],
  ["Anthurium", "flowering-plants", 799, "lily", "Colourful corners"],
  ["Bougainvillea", "outdoor-plants", 599, "lifestyle", "Balcony edit"],
  ["Tulsi", "outdoor-plants", 199, "variegated", "Everyday green"],
  [
    "Ivory Ceramic Planter",
    "pots-planters",
    399,
    "hero",
    "The finishing touch",
  ],
  ["Terracotta Pot", "pots-planters", 249, "hero", "Earthy essentials"],
  ["Sage Tabletop Planter", "pots-planters", 499, "hero", "New arrival"],
  ["Everyday Potting Mix", "plant-care", 199, "lifestyle", "Garden essentials"],
  ["Plant Care Kit", "plant-care", 499, "lifestyle", "A little extra care"],
  ["Garden Hand Tools", "plant-care", 599, "lifestyle", "Garden essentials"],
  ["First Plant Duo", "bundles", 799, "monstera", "A lovely beginning"],
  [
    "Green Corner Bundle",
    "bundles",
    149900 / 100,
    "variegated",
    "Curated for you",
  ],
];
export const products: Product[] = seeds.map(
  ([name, category, price, image, tag], i) =>
    productSchema.parse({
      id: `p${i + 1}`,
      slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      name,
      category,
      price: price * 100,
      image: `/images/${image}.jpg`,
      tag,
      light: i % 3 === 0 ? "Bright indirect" : "Filtered light",
      care: i % 4 === 0 ? "A little attention" : "Easy care",
      stock: i === 13 ? 0 : i === 5 ? 3 : 10,
      description: `Make room for a little green. ${name} is part of our thoughtfully selected sample collection, made for everyday spaces and slower moments. Photography is illustrative; every living plant has its own shape and character.`,
    }),
);
export function getProduct(id: string) {
  return products.find((p) => p.id === id || p.slug === id);
}
export const money = (paise: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(paise / 100);
export const variantPrice = (p: Product, variant: string) =>
  p.price + (variant === "ceramic" ? 20000 : 0);
export const guides = [
  {
    slug: "your-first-plant",
    title: "Your first plant, your new favourite ritual.",
    label: "THE BEGINNER’S GUIDE",
    image: "/images/variegated.jpg",
    text: "Start with one plant and get to know your space. Notice where daylight falls, choose a pot with drainage, and check the growing mix before watering. Plant needs vary, so follow the care instructions supplied with your chosen variety.",
  },
  {
    slug: "watering-made-simple",
    title: "Less guessing. Happier greens.",
    label: "WATERING 101",
    image: "/images/lily.jpg",
    text: "A calendar is a reminder to check, not a rule to water. Feel the growing mix and observe your plant before adding water. Let excess water drain away and avoid leaving the pot standing in a full saucer.",
  },
  {
    slug: "find-the-right-light",
    title: "A little light makes all the difference.",
    label: "FIND YOUR SPOT",
    image: "/images/lifestyle.jpg",
    text: "Spend a day noticing the light in your room. Direct sunshine, filtered daylight, and darker corners are different environments. Use the supplier’s variety-specific guidance, and make changes gradually.",
  },
];
