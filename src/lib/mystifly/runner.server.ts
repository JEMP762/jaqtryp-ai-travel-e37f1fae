/**
 * Roteador único que conecta a chave lógica de um endpoint ao seu serviço.
 * Usado pela tela Admin → Mystifly Test e por futuras integrações do app.
 */
import type { LogContext } from "./client.server";
import type { MystiflyCallResult } from "./types";
import { searchLowestFare, searchBrandedFare, revalidateFlight, getFareRules } from "./search.server";
import { bookFlight } from "./booking.server";
import { orderTicket } from "./ticket.server";
import { getTripDetails, bookingNotes } from "./trip.server";
import { cancelBooking } from "./cancel.server";
import { invoiceSearch } from "./invoice.server";
import { createPostTicketingRequest, searchPostTicketingRequests } from "./ptr.server";
import { listScheduleChanges } from "./schedule.server";
import { searchCreditNotes } from "./credit.server";
import { createSession, getSessionState } from "./session.server";
import {
  fareRulesSchema,
  revalidateSchema,
  uniqueIdSchema,
  bookingNotesSchema,
  invoiceSearchSchema,
} from "./validators";

/** Executa o endpoint solicitado com validação de entrada. */
export async function runEndpoint(
  endpoint: string,
  payload: unknown,
  context: LogContext,
): Promise<MystiflyCallResult> {
  const body = (payload ?? {}) as any;

  switch (endpoint) {
    case "createSession": {
      const started = Date.now();
      await createSession();
      return {
        ok: true,
        endpoint: "createSession",
        httpStatus: 200,
        durationMs: Date.now() - started,
        data: getSessionState(),
        error: null,
        request: {},
      };
    }
    case "searchLowestFare":
      return searchLowestFare(body, context);
    case "searchBrandedFare":
      return searchBrandedFare(body, context);
    case "revalidate":
      return revalidateFlight(revalidateSchema.parse(body).fareSourceCode, context);
    case "fareRules":
      return getFareRules(fareRulesSchema.parse(body).fareSourceCode, context);
    case "bookFlight":
      return bookFlight(body, context);
    case "orderTicket":
      return orderTicket(uniqueIdSchema.parse(body).uniqueId, context);
    case "tripDetails":
      return getTripDetails(uniqueIdSchema.parse(body).uniqueId, context);
    case "bookingCancel":
      return cancelBooking(uniqueIdSchema.parse(body).uniqueId, context);
    case "bookingNotes": {
      const parsed = bookingNotesSchema.parse(body);
      return bookingNotes(parsed.uniqueId, parsed.note, context);
    }
    case "invoiceSearch":
      return invoiceSearch(invoiceSearchSchema.parse(body), context);
    case "postTicketingRequest":
      return createPostTicketingRequest(body, context);
    case "ptrSearch":
      return searchPostTicketingRequests(body, context);
    case "scheduleChange":
      return listScheduleChanges(body, context);
    case "creditNote":
      return searchCreditNotes(body, context);
    default:
      throw new Error(`Endpoint desconhecido: ${endpoint}`);
  }
}
