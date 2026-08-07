/**
 * Buscas de voo: Search Lowest Fare e Search Branded Fare.
 */
import { mystiflyRequest, type LogContext } from "./client.server";
import { toMystiflyCabin } from "./utils";
import type { MystiflyCallResult } from "./types";
import { searchSchema, type SearchInput } from "./validators";

/** Monta o corpo padrão de busca aceito pela Mystifly. */
function buildSearchBody(input: SearchInput) {
  const segments = input.segments.map((s, i) => ({
    Origin: s.origin,
    Destination: s.destination,
    DepartureDate: `${s.departureDate}T00:00:00`,
    SegmentIndex: i + 1,
  }));

  const passengers: Record<string, number> = { AdultCount: input.adults };
  if (input.children) passengers["ChildCount"] = input.children;
  if (input.infants) passengers["InfantCount"] = input.infants;

  return {
    OriginDestinationInformations: segments,
    TravelPreferences: {
      AirTripType: input.tripType,
      CabinPreference: toMystiflyCabin(input.cabinClass),
      MaxStopsQuantity: input.directOnly ? "Direct" : "All",
    },
    PricingSourceType: "All",
    IsRefundable: false,
    RequestOptions: "Fifty",
    PassengerTypeQuantities: passengers,
    ...(input.currency ? { RequestedCurrency: input.currency } : {}),
  };
}

/** Busca a tarifa mais barata (One Way ou Return, todas as cabines). */
export async function searchLowestFare(
  raw: unknown,
  context?: LogContext,
): Promise<MystiflyCallResult> {
  const input = searchSchema.parse(raw);
  return mystiflyRequest("searchLowestFare", buildSearchBody(input), { context });
}

/** Busca tarifas "branded" (famílias tarifárias) para a mesma pesquisa. */
export async function searchBrandedFare(
  raw: unknown,
  context?: LogContext,
): Promise<MystiflyCallResult> {
  const input = searchSchema.parse(raw);
  return mystiflyRequest(
    "searchBrandedFare",
    { ...buildSearchBody(input), IsBrandedFare: true },
    { context },
  );
}

/** Revalida a tarifa antes da reserva (preço e disponibilidade). */
export async function revalidateFlight(
  fareSourceCode: string,
  context?: LogContext,
): Promise<MystiflyCallResult> {
  return mystiflyRequest("revalidate", { FareSourceCode: fareSourceCode }, { context });
}

/** Regras tarifárias da oferta selecionada. */
export async function getFareRules(
  fareSourceCode: string,
  context?: LogContext,
): Promise<MystiflyCallResult> {
  return mystiflyRequest("fareRules", { FareSourceCode: fareSourceCode }, { context });
}
