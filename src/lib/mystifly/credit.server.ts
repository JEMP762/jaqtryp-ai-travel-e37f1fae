/**
 * Notas de crédito (Credit Note) — usadas em reembolsos.
 */
import { mystiflyRequest, type LogContext } from "./client.server";
import type { MystiflyCallResult } from "./types";
import { creditNoteSchema } from "./validators";

/** Consulta notas de crédito por reserva ou período. */
export async function searchCreditNotes(
  raw: unknown,
  context?: LogContext,
): Promise<MystiflyCallResult> {
  const input = creditNoteSchema.parse(raw);
  return mystiflyRequest(
    "creditNote",
    {
      ...(input.uniqueId ? { UniqueID: input.uniqueId } : {}),
      ...(input.fromDate ? { FromDate: `${input.fromDate}T00:00:00` } : {}),
      ...(input.toDate ? { ToDate: `${input.toDate}T23:59:59` } : {}),
    },
    { context },
  );
}
