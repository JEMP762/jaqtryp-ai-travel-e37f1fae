/**
 * Emissão do bilhete (Order Ticket) — Ticketing In Progress.
 */
import { mystiflyRequest, type LogContext } from "./client.server";
import type { MystiflyCallResult } from "./types";

/** Solicita a emissão do bilhete de uma reserva já criada. */
export async function orderTicket(
  uniqueId: string,
  context?: LogContext,
): Promise<MystiflyCallResult> {
  return mystiflyRequest(
    "orderTicket",
    { UniqueID: uniqueId, ClientTransactionId: `JQ-TKT-${Date.now()}` },
    { context: { ...(context || {}), bookingId: uniqueId } },
  );
}
