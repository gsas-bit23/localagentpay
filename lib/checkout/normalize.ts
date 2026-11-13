import { isCoordinates } from "../maps/geo";
import type { HotelRate, TravelOffer } from "./types";
import { usdcAmount } from "./types";
const clean = (value: unknown, max = 400) =>
  typeof value === "string" ? value.slice(0, max) : "";
export function flightOffer(raw: any): TravelOffer {
  return {
    id: clean(raw.id, 200),
    kind: "flight",
    title: clean(
      raw.owner_name || raw.segments?.[0]?.carrier_name || "Airline flight",
    ),
    subtitle: `${clean(raw.origin_iata, 3)} → ${clean(raw.destination_iata, 3)}`,
    price: raw.total_amount
      ? usdcAmount(String(raw.total_amount))
      : clean(raw.total_amount_decimal),
    currency: clean(raw.total_currency, 3) || "USD",
    expiresAt: clean(raw.expires_at),
    departure: clean(raw.departing_at),
    arrival: clean(raw.arriving_at),
    timeZone: clean(raw.origin_time_zone),
    duration: clean(raw.duration),
    stops: Number(raw.stops) || 0,
    baggage: `${raw.checked_bags_included ?? "Unknown"} checked · ${raw.carry_on_bags_included ?? "Unknown"} carry-on`,
    fare: clean(raw.fare_brand_name),
    refundable:
      typeof raw.conditions?.refund_allowed === "boolean"
        ? raw.conditions.refund_allowed
        : undefined,
    changeable:
      typeof raw.conditions?.change_allowed === "boolean"
        ? raw.conditions.change_allowed
        : undefined,
    alternatives: Array.isArray(raw.fare_options)
      ? raw.fare_options.slice(0, 12).map((fare: any) => ({
          id: clean(fare.offer_id, 200),
          name: clean(fare.fare_brand_name),
          price: clean(fare.total_amount_decimal),
          refundable: fare.refundable,
          changeable: fare.changeable,
        }))
      : [],
  };
}
export function hotelOffer(raw: any, country: string): TravelOffer {
  const point: [number, number] = [Number(raw.longitude), Number(raw.latitude)];
  const id = clean(raw.hotel_id, 200),
    name = clean(raw.name),
    address = clean(raw.address);
  return {
    id,
    kind: "hotel",
    title: name,
    subtitle: address,
    price: clean(raw.total_from || raw.price_from),
    currency: clean(raw.currency, 3) || "USD",
    expiresAt: clean(raw.expires_at),
    dueAtHotel: clean(raw.due_at_hotel_from) || "0",
    rating: Number(raw.rating) || undefined,
    location: isCoordinates(point)
      ? {
          id: `brij-${id}`,
          name,
          address,
          coordinates: point,
          countryCode: country,
          source: "provider",
          kind: "hotel",
        }
      : undefined,
    photo:
      typeof raw.photo_url === "string" &&
      /^https:\/\/[^/]+(?:\.agoda\.net|\.bstatic\.com)\//.test(raw.photo_url)
        ? raw.photo_url
        : undefined,
  };
}
export function hotelRates(data: any): HotelRate[] {
  return (Array.isArray(data.room_types) ? data.room_types : [])
    .flatMap((room: any) =>
      (Array.isArray(room.rates) ? room.rates : []).map((rate: any) => ({
        id: clean(rate.rate_id, 200),
        room: clean(room.name),
        board: clean(rate.board),
        price: clean(rate.price?.total_amount),
        dueAtHotel: clean(rate.price?.due_at_hotel_amount) || "0",
        currency: clean(rate.price?.currency, 3) || "USD",
        refundable:
          typeof rate.refundable === "boolean" ? rate.refundable : undefined,
        refundability: clean(rate.refundability, 1000),
        conditions: (Array.isArray(rate.conditions) ? rate.conditions : [])
          .slice(0, 20)
          .map((condition: any) => ({
            title: clean(condition.title),
            description: clean(condition.description, 4000),
          })),
        cancellations: rate.cancellation_timeline || [],
        expiresAt: clean(rate.expires_at),
      })),
    )
    .slice(0, 30);
}
