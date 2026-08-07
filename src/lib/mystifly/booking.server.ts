/**
 * Reserva de voo (Book Flight) — suporta Booking In Progress (hold).
 */
import { mystiflyRequest, type LogContext } from "./client.server";
import type { MystiflyCallResult } from "./types";
import { bookSchema, type BookInput } from "./validators";

/** Converte um passageiro interno no formato esperado pela Mystifly. */
function mapPassenger(p: BookInput["passengers"][number], index: number) {
  return {
    PassengerIndex: index + 1,
    PassengerType: p.type,
    Gender: p.gender,
    PassengerTitle: p.title,
    PassengerFirstName: p.firstName,
    PassengerLastName: p.lastName,
    DateOfBirth: `${p.dateOfBirth}T00:00:00`,
    ...(p.nationality ? { NationalityCode: p.nationality } : {}),
    ...(p.passportNumber
      ? {
          PassportNumber: p.passportNumber,
          ...(p.passportExpiry ? { ExpiryDate: `${p.passportExpiry}T00:00:00` } : {}),
        }
      : {}),
  };
}

/**
 * Cria a reserva. Com `holdOnly` a reserva fica em "Booking In Progress"
 * e a emissão é feita depois pelo Order Ticket.
 */
export async function bookFlight(
  raw: unknown,
  context?: LogContext,
): Promise<MystiflyCallResult> {
  const input = bookSchema.parse(raw);
  const lead = input.passengers[0]!;

  const body = {
    FareSourceCode: input.fareSourceCode,
    TravelerInfo: {
      AirTravelers: input.passengers.map(mapPassenger),
      PhoneNumber: lead.phone,
      Email: lead.email,
    },
    ClientTransactionId: `JQ-${Date.now()}`,
    Target: undefined,
    /** true = apenas reserva; false = reserva + emissão automática. */
    BookingType: input.holdOnly ? "Hold" : "Instant",
  };

  return mystiflyRequest("bookFlight", body, { context });
}
