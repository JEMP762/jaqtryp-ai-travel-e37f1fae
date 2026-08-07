/**
 * Consulta da reserva (Trip Details) e notas da reserva (Booking Notes).
 */
import { mystiflyRequest, type LogContext } from "./client.server";
import type { MystiflyCallResult } from "./types";

/** Detalhes completos da reserva/bilhete. */
export async function getTripDetails(
  uniqueId: string,
  context?: LogContext,
): Promise<MystiflyCallResult> {
  return mystiflyRequest(
    "tripDetails",
    { UniqueID: uniqueId },
    { context: { ...(context || {}), bookingId: uniqueId } },
  );
}

/** Lê ou adiciona notas administrativas à reserva. */
export async function bookingNotes(
  uniqueId: string,
  note?: string,
  context?: LogContext,
): Promise<MystiflyCallResult> {
  return mystiflyRequest(
    "bookingNotes",
    { UniqueID: uniqueId, ...(note ? { Notes: note } : {}) },
    { context: { ...(context || {}), bookingId: uniqueId } },
  );
}
