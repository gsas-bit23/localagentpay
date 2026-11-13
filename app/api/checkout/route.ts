import { NextResponse } from "next/server";
import { z } from "zod";
import { PublicKey } from "@solana/web3.js";
import { marketAirports } from "@/lib/checkout/markets";
import { readBody } from "@/lib/http";
import {
  brijCall,
  CheckoutError,
  validateChallenge,
} from "@/lib/checkout/brij";
import {
  checkoutConfigured,
  requirePayable,
  seal,
  unseal,
  type BookingSession,
} from "@/lib/checkout/session";
import { flightOffer, hotelOffer, hotelRates } from "@/lib/checkout/normalize";
import {
  positiveAtomic,
  solanaAddress,
  usdcAmount,
  isPayableStatus,
} from "@/lib/checkout/types";
import { usdcBalance } from "@/lib/checkout/rpc";
import { validateSignedPayment } from "@/lib/checkout/payment";
import { fundWithNear, fundingStatus } from "@/lib/checkout/funding";
import { checkoutRequest, intentSchema } from "@/lib/checkout/validation";
function response(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
}
export async function GET() {
  return response({
    provider: "BRIJ",
    ready: checkoutConfigured(),
    liveSearch: true,
    checkout: "in-app",
    settlement: "USDC on Solana",
    nearFunding: "NEAR Intents conversion to your connected Solana wallet",
    integrationFee:
      "No account, API key or subscription; MCP search/quote call fees waived",
    bookingFees: "Included in the provider's exact quote",
    countries:
      "Travel availability is checked per search. Other merchants/categories and unlisted countries are coming soon.",
  });
}
async function currentStatus(session: BookingSession) {
  const result = await brijCall("brij_get_intent", {
    intent_id: session.intentId,
  });
  const intent = result.data?.intent || result.data || {};
  let hotel: any;
  if (
    session.kind === "hotel" &&
    !isPayableStatus(String(intent.status || ""))
  ) {
    try {
      hotel = (
        await brijCall("brij_get_hotel_order", {
          intent_id: session.intentId,
          customer_support_code: session.supportCode,
        })
      ).data;
    } catch {
      /* The intent remains the payment authority even while the order is being issued. */
    }
  }
  return {
    status: String(
      hotel?.order?.status || hotel?.status || intent.status || "unknown",
    ),
    intentStatus: String(intent.status || "unknown"),
    reference: String(
      intent.booking_reference ||
        hotel?.order?.booking_reference ||
        hotel?.booking_reference ||
        "",
    ),
    paymentReceived:
      !!intent.funded_at ||
      !!intent.escrow_funding_signature ||
      !!intent.payment_signature ||
      Number(intent.funded_amount || intent.escrow_balance || 0) > 0,
    updatedAt: intent.updated_at,
    summary: session.summary,
    hotel: hotel
      ? {
          reference: hotel.order?.booking_reference || hotel.booking_reference,
          status: hotel.order?.status || hotel.status,
        }
      : undefined,
  };
}
export async function POST(request: Request) {
  try {
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin)
      throw new CheckoutError("Use checkout from this website.", 403);
    const input = checkoutRequest.parse(await readBody(request, 64000));
    if (input.action === "flights") {
      if (
        !marketAirports[input.country].some(
          (airport) => airport.code === input.destination,
        )
      )
        throw new CheckoutError(
          "This destination is coming soon. Choose an arrival airport listed for the selected country.",
          400,
          "COUNTRY_COMING_SOON",
        );
      const today = new Date().toISOString().slice(0, 10);
      if (
        input.departure < today ||
        (input.returnDate && input.returnDate < input.departure)
      )
        throw new CheckoutError(
          "Choose future travel dates in the right order.",
          400,
        );
      const { data } = await brijCall("brij_search_flights", {
        origin_iata: input.origin,
        destination_iata: input.destination,
        depart_date: input.departure,
        return_date: input.returnDate,
        adults: input.adults,
        limit: 8,
        cheapest_per_itinerary: true,
      });
      const search = data?.search || data;
      return response({
        offers: (search?.offers || [])
          .filter((offer: any) => !offer.identity_documents_required)
          .map(flightOffer),
        searchId: search?.search_id,
        status: search?.status || "complete",
        source: "BRIJ live airline inventory",
        feesIncluded: true,
      });
    }
    if (input.action === "hotels") {
      const duration =
        (Date.parse(input.checkOut) - Date.parse(input.checkIn)) / 86400000;
      if (
        input.checkIn < new Date().toISOString().slice(0, 10) ||
        duration < 1 ||
        duration > 30
      )
        throw new CheckoutError(
          "Choose a hotel stay of 1–30 nights in the future.",
          400,
        );
      const { data } = await brijCall("brij_search_hotels", {
        location: input.location,
        check_in_date: input.checkIn,
        check_out_date: input.checkOut,
        rooms: 1,
        adults: input.adults,
        sort: "price",
      });
      if (data?.place?.country && data.place.country !== input.country)
        throw new CheckoutError(
          "That city is in another country. Change the selected country to search there.",
          400,
          "COUNTRY_MISMATCH",
        );
      return response({
        offers: (data?.hotels || [])
          .slice(0, 12)
          .map((hotel: any) => hotelOffer(hotel, input.country)),
        source: "BRIJ live hotel inventory",
        nights: data?.nights,
        feesIncluded: true,
      });
    }
    if (input.action === "flightUpdates") {
      const { data } = await brijCall("brij_get_flight_search_updates", {
        search_id: input.searchId,
      });
      const search = data?.search || data;
      return response({
        offers: (search?.offers || [])
          .filter((offer: any) => !offer.identity_documents_required)
          .map(flightOffer),
        searchId: search?.search_id,
        status: search?.status || "complete",
      });
    }
    if (input.action === "rates") {
      const { data } = await brijCall("brij_get_hotel_rates", {
        hotel_id: input.hotelId,
      });
      return response({ rates: hotelRates(data), title: data?.hotel?.name });
    }
    if (input.action === "balance") {
      new PublicKey(input.wallet);
      const balance = await usdcBalance(input.wallet);
      return response({ amountAtomic: balance, amount: usdcAmount(balance) });
    }
    if (input.action === "fundingStatus")
      return response(await fundingStatus(input.token));
    if (input.action === "prepare") {
      if (!checkoutConfigured())
        throw new CheckoutError(
          "Checkout is coming soon while secure order storage is configured.",
          503,
          "CHECKOUT_NOT_CONFIGURED",
        );
      const publicKey = new PublicKey(input.wallet);
      if (!PublicKey.isOnCurve(publicKey.toBytes()))
        throw new CheckoutError(
          "Connect a personal Solana wallet for payment and refunds.",
          400,
        );
      let offerId = input.offerId,
        title = "",
        dueAtHotel = "0";
      let policy: string[] = [];
      if (input.kind === "flight") {
        for (const traveller of input.travellers)
          if (
            !traveller.born_on ||
            !traveller.title ||
            !traveller.gender ||
            traveller.born_on >= new Date().toISOString().slice(0, 10)
          )
            throw new CheckoutError(
              "Complete every passenger's date of birth, title and document sex.",
              400,
            );
        const { data } = await brijCall("brij_get_flight_offer_details", {
          offer_id: offerId,
        });
        if (data?.offer?.identity_documents_required)
          throw new CheckoutError(
            "This fare needs identity-document handling that is coming soon. Choose another fare.",
            409,
          );
        if (
          data?.offer?.passenger_ids?.length &&
          data.offer.passenger_ids.length !== input.travellers.length
        )
          throw new CheckoutError(
            "The passenger count changed. Search again for the correct party size.",
            400,
          );
        const offer = flightOffer(data?.offer);
        title = `${offer.title} · ${offer.subtitle} · ${offer.departure}`;
        policy = [
          `Fare: ${offer.fare || "As quoted by airline"}`,
          `Refunds: ${offer.refundable === undefined ? "not specified" : offer.refundable ? "allowed under airline conditions" : "not allowed"}`,
          `Changes: ${offer.changeable === undefined ? "not specified" : offer.changeable ? "allowed under airline conditions" : "not allowed"}`,
          `Baggage: ${offer.baggage}`,
          `Airline conditions and penalties: ${JSON.stringify(data?.offer?.conditions || {})}`,
        ];
      } else {
        const { data } = await brijCall("brij_quote_hotel", {
          rate_id: offerId,
        });
        offerId = String(data?.offer_id || "");
        title = `${data?.hotel?.name || "Hotel stay"} · ${data?.room || "Room"} · ${data?.check_in_date}–${data?.check_out_date}`;
        dueAtHotel = String(data?.price?.due_at_hotel_amount || "0");
        policy = [
          String(data?.rate?.refundability || "Refund terms are not specified"),
          ...(data?.rate?.conditions || []).map(
            (condition: { title: string; description: string }) =>
              `${condition.title}: ${condition.description}`,
          ),
          `Cancellation amounts and deadlines: ${JSON.stringify(data?.rate?.cancellation_timeline || [])}`,
          `Provider service fee kept on cancellation: ${data?.rate?.service_fee_kept_on_cancel || "As defined in the rate"} USD`,
        ];
        if (Number(data?.party?.adults) !== input.travellers.length)
          throw new CheckoutError(
            "The guest count changed. Search again for the correct party size.",
            400,
          );
      }
      if (new TextEncoder().encode(JSON.stringify(policy)).length > 12000)
        throw new CheckoutError(
          "This fare or property's terms exceed the current checkout limits. Coming soon — choose another offer.",
          409,
        );
      const kind = input.kind;
      const { data } = await brijCall(
        kind === "flight"
          ? "brij_create_flight_intent"
          : "brij_create_hotel_intent",
        {
          offer_id: offerId,
          funding_wallet: input.wallet,
          refund_wallet: input.wallet,
        },
      );
      const intent = intentSchema.parse(data?.intent);
      if (
        intent.funding_wallet !== input.wallet ||
        intent.refund_wallet !== input.wallet
      )
        throw new CheckoutError(
          "The booking refund wallet does not match your connected wallet.",
          502,
        );
      const args =
        kind === "flight"
          ? {
              intent_id: intent.id,
              passengers: input.travellers.map((person) => ({
                ...person,
                email: input.email,
                phone_number: input.phone,
              })),
            }
          : {
              intent_id: intent.id,
              guests: input.travellers.map(({ given_name, family_name }) => ({
                given_name,
                family_name,
              })),
              email: input.email,
              phone_number: input.phone,
            };
      const challenge = await brijCall(
        kind === "flight" ? "brij_book_flight" : "brij_book_hotel",
        args,
      );
      const requirements = validateChallenge(
        challenge.paymentRequired,
        intent,
        kind,
      );
      const payBy = Math.min(
        Date.parse(intent.expires_at),
        Date.now() + 10 * 60000,
      );
      if (!Number.isFinite(payBy) || payBy <= Date.now())
        throw new CheckoutError(
          "The merchant quote has expired. Search again.",
          409,
        );
      const summary = {
        kind,
        intentId: intent.id,
        amount: usdcAmount(intent.expected_escrow_amount),
        amountAtomic: intent.expected_escrow_amount,
        serviceFee: usdcAmount(intent.fee_amount),
        ticketAmount: usdcAmount(intent.expected_ticket_amount),
        wallet: input.wallet,
        refundWallet: input.wallet,
        escrow: intent.escrow_address,
        expiresAt: new Date(payBy).toISOString(),
        title,
        travellers: input.travellers.length,
        dueAtHotel,
      };
      const session: BookingSession = {
        kind,
        intentId: intent.id,
        supportCode: intent.customer_support_code,
        wallet: input.wallet,
        payBy,
        args,
        requirements,
        summary,
        paymentId: crypto.randomUUID(),
        policy,
      };
      return response({
        token: await seal("booking", session),
        summary,
        requirements,
        paymentId: session.paymentId,
        policy: session.policy || [],
        review: {
          travellers: input.travellers.map(({ given_name, family_name }) => ({
            given_name,
            family_name,
          })),
          email: input.email,
          phone: input.phone,
        },
      });
    }
    const session = await unseal<BookingSession>(input.token, "booking");
    if (input.action === "restore") {
      const people = (
        session.kind === "flight"
          ? session.args.passengers
          : session.args.guests
      ) as {
        given_name: string;
        family_name: string;
        email?: string;
        phone_number?: string;
      }[];
      return response({
        token: input.token,
        summary: session.summary,
        requirements: session.requirements,
        paymentId: session.paymentId,
        policy: session.policy || [],
        review: {
          travellers: people.map(({ given_name, family_name }) => ({
            given_name,
            family_name,
          })),
          email: session.args.email || people[0]?.email,
          phone: session.args.phone_number || people[0]?.phone_number,
        },
      });
    }
    if (input.action === "status")
      return response(await currentStatus(session));
    if (input.action === "fund") {
      const status = await currentStatus(session);
      if (!isPayableStatus(status.intentStatus) || status.paymentReceived)
        throw new CheckoutError(
          "This booking is already processing or closed. Check its status before paying.",
          409,
        );
      return response(await fundWithNear(session, input.nearAccount));
    }
    if (input.action === "execute") {
      requirePayable(session);
      await validateSignedPayment(input.payment, session);
      const status = await currentStatus(session);
      if (!isPayableStatus(status.intentStatus) || status.paymentReceived)
        return response({ ...status, alreadyProcessing: true });
      const result = await brijCall(
        session.kind === "flight" ? "brij_book_flight" : "brij_book_hotel",
        session.args,
        input.payment,
      );
      if (result.paymentRequired)
        throw new CheckoutError(
          "The provider did not accept this signed payment. Check order status before retrying the same approved payment.",
          409,
          "PAYMENT_NOT_ACCEPTED",
        );
      return response({ ...(await currentStatus(session)), submitted: true });
    }
    if (input.action === "cancel") {
      const status = await currentStatus(session);
      if (isPayableStatus(status.intentStatus) && !status.paymentReceived)
        throw new CheckoutError(
          "This booking is unpaid; no refund is due.",
          409,
        );
      const args = {
        intent_id: session.intentId,
        customer_support_code: session.supportCode,
        passenger_family_name: input.familyName,
        reason: input.reason,
      };
      await brijCall(
        session.kind === "flight"
          ? "brij_request_flight_refund"
          : "brij_cancel_hotel",
        args,
      );
      return response({
        requested: true,
        message:
          "The provider received your request. Refund eligibility and amount follow the fare or hotel cancellation policy.",
        ...(await currentStatus(session)),
      });
    }
    throw new CheckoutError("Unsupported checkout operation.", 400);
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError)
      return response(
        {
          error: "Please check the checkout fields and try again.",
          code: "INVALID_INPUT",
        },
        400,
      );
    if (error instanceof CheckoutError)
      return response({ error: error.message, code: error.code }, error.status);
    if (
      error instanceof Error &&
      (error.name === "TimeoutError" || error.name === "AbortError")
    )
      return response(
        {
          error:
            "The provider response timed out. If you approved payment, check order status before retrying; do not approve a second payment.",
          code: "PROVIDER_TIMEOUT",
        },
        504,
      );
    return response(
      {
        error:
          error instanceof Error
            ? error.message
            : "Checkout is temporarily unavailable.",
        code: "CHECKOUT_ERROR",
      },
      422,
    );
  }
}
