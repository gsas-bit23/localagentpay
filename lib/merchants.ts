import type { Category, Merchant } from "./types";

// Fictional fixtures: no merchant, rating, distance, or price is a real listing.
export const merchants: Merchant[] = [
  {
    id: "green-basket",
    name: "Green Basket",
    category: "groceries",
    description: "A week's worth of fresh, feel-good essentials.",
    price: 48,
    distance: 0.8,
    trust: 98,
    reviews: 124,
    tag: "Best match",
    color: "green",
    delivery: "25–35 min",
  },
  {
    id: "daily-pantry",
    name: "The Daily Pantry",
    category: "groceries",
    description: "Your neighborhood staples, thoughtfully picked.",
    price: 42,
    distance: 1.2,
    trust: 96,
    reviews: 89,
    tag: "Best value",
    color: "peach",
    delivery: "30–40 min",
  },
  {
    id: "roots-market",
    name: "Roots & Co.",
    category: "groceries",
    description: "Seasonal produce from small, local growers.",
    price: 56,
    distance: 1.6,
    trust: 99,
    reviews: 201,
    tag: "Local favorite",
    color: "purple",
    delivery: "35–45 min",
  },
  {
    id: "autocare",
    name: "Neighborhood Auto",
    category: "car",
    description: "Oil change, tire check, and a little peace of mind.",
    price: 85,
    distance: 1.1,
    trust: 97,
    reviews: 132,
    tag: "Best match",
    color: "green",
    delivery: "Tomorrow, 10 am",
  },
  {
    id: "pit-stop",
    name: "The Pit Stop",
    category: "car",
    description: "A quick tune-up to get your week moving.",
    price: 65,
    distance: 2.4,
    trust: 95,
    reviews: 78,
    tag: "Best value",
    color: "peach",
    delivery: "Today, 4 pm",
  },
  {
    id: "honest-motors",
    name: "Honest Motors",
    category: "car",
    description: "A comprehensive service by experienced hands.",
    price: 150,
    distance: 3.2,
    trust: 99,
    reviews: 264,
    tag: "Local favorite",
    color: "purple",
    delivery: "Tomorrow, 9 am",
  },
  {
    id: "corner-goods",
    name: "Corner Goods",
    category: "shops",
    description: "Useful little things for a more thoughtful home.",
    price: 24,
    distance: 0.6,
    trust: 97,
    reviews: 93,
    tag: "Best match",
    color: "green",
    delivery: "20–30 min",
  },
  {
    id: "little-studio",
    name: "The Little Studio",
    category: "shops",
    description: "Handmade gifts, made around the corner.",
    price: 35,
    distance: 1.5,
    trust: 98,
    reviews: 105,
    tag: "Local favorite",
    color: "peach",
    delivery: "40–50 min",
  },
  {
    id: "everyday-supply",
    name: "Everyday Supply",
    category: "shops",
    description: "Practical essentials at an easygoing price.",
    price: 18,
    distance: 2.1,
    trust: 95,
    reviews: 62,
    tag: "Best value",
    color: "purple",
    delivery: "30–40 min",
  },
];
export function getNearbyOptions(
  category: Category,
  budget?: number,
): Merchant[] {
  return merchants
    .filter(
      (m) =>
        m.category === category && (budget === undefined || m.price <= budget),
    )
    .slice(0, 3);
}
export function interpretRequest(
  message: string,
  hint?: Category,
): { category: Category; budget?: number } {
  const category = /car|auto|tire|tyre|oil change|mechanic/i.test(message)
    ? "car"
    : /shop|gift|home|suppl/i.test(message)
      ? "shops"
      : (hint ?? "groceries");
  const match = message.match(
    /(?:under|below|budget(?:\s+of)?|less than|max(?:imum)?|up to)\s*\$?\s*(\d+(?:\.\d{1,2})?)/i,
  );
  return { category, budget: match ? Number(match[1]) : undefined };
}
