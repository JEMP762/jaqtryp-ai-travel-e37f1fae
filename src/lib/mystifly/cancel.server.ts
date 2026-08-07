/**
 * Cancelamento de reserva (Booking Cancel).
 */
import { mystiflyRequest, type LogContext } from "./client.server";
import type { MystiflyCallResult } from "./types";

/** Cancela uma reserva ainda não emitida (ou dentro da janela de void). */
export async function cancelBooking(
  uniqueId: string,
  context?: LogContext,
): Promise<MystiflyCallResult> {
  return mystiflyRequest(
    "bookingCancel",
    { UniqueID: uniqueId },
    { context: { ...(context || {}), bookingId: uniqueId } },
  );
}
