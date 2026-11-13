import type { CountryCode } from "../commerce/config";
export const marketAirports: Record<
  CountryCode,
  { code: string; city: string }[]
> = {
  PK: [
    { code: "KHI", city: "Karachi" },
    { code: "LHE", city: "Lahore" },
    { code: "ISB", city: "Islamabad" },
  ],
  IN: [
    { code: "DEL", city: "Delhi" },
    { code: "BOM", city: "Mumbai" },
    { code: "BLR", city: "Bengaluru" },
  ],
  US: [
    { code: "JFK", city: "New York" },
    { code: "SFO", city: "San Francisco" },
    { code: "LAX", city: "Los Angeles" },
  ],
  GB: [
    { code: "LHR", city: "London" },
    { code: "LGW", city: "London Gatwick" },
    { code: "MAN", city: "Manchester" },
  ],
  AE: [
    { code: "DXB", city: "Dubai" },
    { code: "AUH", city: "Abu Dhabi" },
    { code: "SHJ", city: "Sharjah" },
  ],
  DE: [
    { code: "FRA", city: "Frankfurt" },
    { code: "BER", city: "Berlin" },
    { code: "MUC", city: "Munich" },
  ],
  SG: [{ code: "SIN", city: "Singapore" }],
  NG: [
    { code: "LOS", city: "Lagos" },
    { code: "ABV", city: "Abuja" },
  ],
  CA: [
    { code: "YYZ", city: "Toronto" },
    { code: "YVR", city: "Vancouver" },
    { code: "YUL", city: "Montreal" },
  ],
  AU: [
    { code: "SYD", city: "Sydney" },
    { code: "MEL", city: "Melbourne" },
    { code: "BNE", city: "Brisbane" },
  ],
  FR: [
    { code: "CDG", city: "Paris" },
    { code: "ORY", city: "Paris Orly" },
    { code: "LYS", city: "Lyon" },
  ],
  JP: [
    { code: "HND", city: "Tokyo" },
    { code: "NRT", city: "Tokyo Narita" },
    { code: "KIX", city: "Osaka" },
  ],
};
