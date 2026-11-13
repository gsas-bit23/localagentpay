export type Category = "groceries" | "car" | "shops";
export type PayAsset = "ETH" | "USDC" | "wNEAR";
export type Location = { city: string; latitude?: number; longitude?: number };
export type Merchant = {
  id: string;
  name: string;
  category: Category;
  description: string;
  price: number;
  distance: number;
  trust: number;
  reviews: number;
  tag: string;
  color: string;
  delivery: string;
};
export type ChatResult = {
  message: string;
  options: Merchant[];
  category: Category;
  source: "rules" | "near-ai";
  budget?: number;
};
export type PaymentQuote = {
  id: string;
  mode: "demo" | "live";
  merchant: string;
  merchantId: string;
  origin: { symbol: PayAsset; chain: string; amount: string };
  destination: {
    symbol: "USDC";
    chain: "Base";
    amount: string;
    recipient?: string;
  };
  fee: string;
  feeLabel: string;
  expiresAt: string;
  estimatedSeconds: number;
  provider: string;
  dryRun: true;
};
