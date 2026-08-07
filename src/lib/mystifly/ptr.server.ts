/**
 * Pós-emissão: Post Ticketing Request (cancelamento, reembolso, reemissão)
 * e consulta de PTRs.
 */
import { mystiflyRequest, type LogContext } from "./client.server";
import type { MystiflyCallResult } from "./types";
import { ptrSchema, ptrSearchSchema } from "./validators";

/** Abre um pedido pós-emissão (refund, reissue, void, cancellation). */
export async function createPostTicketingRequest(
  raw: unknown,
  context?: LogContext,
): Promise<MystiflyCallResult> {
  const input = ptrSchema.parse(raw);
  return mystiflyRequest(
    "postTicketingRequest",
    {
      UniqueID: input.uniqueId,
      RequestType: input.requestType,
      ...(input.remarks ? { Remarks: input.remarks } : {}),
    },
    { context: { ...(context || {}), bookingId: input.uniqueId } },
  );
}

/** Consulta o andamento dos pedidos pós-emissão. */
export async function searchPostTicketingRequests(
  raw: unknown,
  context?: LogContext,
): Promise<MystiflyCallResult> {
  const input = ptrSearchSchema.parse(raw);
  return mystiflyRequest(
    "ptrSearch",
    {
      ...(input.ptrId ? { PTRID: input.ptrId } : {}),
      ...(input.uniqueId ? { UniqueID: input.uniqueId } : {}),
      ...(input.fromDate ? { FromDate: `${input.fromDate}T00:00:00` } : {}),
      ...(input.toDate ? { ToDate: `${input.toDate}T23:59:59` } : {}),
    },
    { context },
  );
}
