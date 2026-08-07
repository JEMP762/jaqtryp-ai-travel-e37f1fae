/**
 * Faturas (Invoice Search).
 */
import { mystiflyRequest, type LogContext } from "./client.server";
import type { MystiflyCallResult } from "./types";

export interface InvoiceSearchParams {
  uniqueId?: string;
  fromDate?: string;
  toDate?: string;
}

/** Busca faturas por reserva ou por período. */
export async function invoiceSearch(
  params: InvoiceSearchParams,
  context?: LogContext,
): Promise<MystiflyCallResult> {
  return mystiflyRequest(
    "invoiceSearch",
    {
      ...(params.uniqueId ? { UniqueID: params.uniqueId } : {}),
      ...(params.fromDate ? { FromDate: `${params.fromDate}T00:00:00` } : {}),
      ...(params.toDate ? { ToDate: `${params.toDate}T23:59:59` } : {}),
    },
    { context },
  );
}
