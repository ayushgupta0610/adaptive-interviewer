export interface PricingTier {
  id: "free" | "starter" | "pro";
  name: string;
  priceInr: number;
  blurb: string;
  features: string[];
  cta: string;
  /** Only paid tiers — matches the checkout API enum. */
  checkoutId?: "starter" | "pro";
  featured?: boolean;
}

export const TIERS: PricingTier[] = [
  { id: "free", name: "Free", priceInr: 0, blurb: "Try it, no card.", features: ["1 free voice interview", "Daily text practice", "Full scorecards"], cta: "Start free" },
  { id: "starter", name: "Plus", priceInr: 299, blurb: "For active job seekers.", features: ["3 voice interviews / mo", "Unlimited text practice", "Full scorecards"], cta: "Choose Plus", checkoutId: "starter" },
  { id: "pro", name: "Pro", priceInr: 699, blurb: "For serious prep.", features: ["10 voice interviews / mo", "Unlimited text practice", "Priority models"], cta: "Choose Pro", checkoutId: "pro", featured: true },
];
