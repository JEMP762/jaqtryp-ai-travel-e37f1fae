/**
 * Validadores de entrada da integração Mystifly.
 * Usados no servidor antes de qualquer chamada externa.
 */
import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida (AAAA-MM-DD)");
const iata = z.string().trim().length(3).toUpperCase();

export const cabinClassSchema = z.enum([
  "Economy",
  "PremiumEconomy",
  "Business",
  "First",
]);

export const searchSchema = z.object({
  tripType: z.enum(["OneWay", "Return"]).default("OneWay"),
  segments: z
    .array(
      z.object({
        origin: iata,
        destination: iata,
        departureDate: isoDate,
      }),
    )
    .min(1)
    .max(4),
  adults: z.number().int().min(1).max(9).default(1),
  children: z.number().int().min(0).max(8).default(0),
  infants: z.number().int().min(0).max(8).default(0),
  cabinClass: cabinClassSchema.default("Economy"),
  currency: z.string().trim().length(3).toUpperCase().optional(),
  directOnly: z.boolean().default(false),
});

export const revalidateSchema = z.object({
  fareSourceCode: z.string().min(1),
  target: z.string().optional(),
});

export const fareRulesSchema = z.object({
  fareSourceCode: z.string().min(1),
});

export const passengerSchema = z.object({
  type: z.enum(["ADT", "CHD", "INF"]).default("ADT"),
  title: z.string().min(1).max(10),
  firstName: z.string().trim().min(1).max(60),
  lastName: z.string().trim().min(1).max(60),
  gender: z.enum(["M", "F"]),
  dateOfBirth: isoDate,
  nationality: z.string().trim().length(2).optional(),
  passportNumber: z.string().trim().max(40).optional(),
  passportExpiry: isoDate.optional(),
  email: z.string().email().max(160),
  phone: z.string().trim().min(5).max(30),
});

export const bookSchema = z.object({
  fareSourceCode: z.string().min(1),
  passengers: z.array(passengerSchema).min(1).max(9),
  /** Reserva sem emissão imediata (Booking In Progress). */
  holdOnly: z.boolean().default(true),
});

export const uniqueIdSchema = z.object({
  uniqueId: z.string().min(1).max(60),
});

export const bookingNotesSchema = uniqueIdSchema.extend({
  note: z.string().trim().min(1).max(1000).optional(),
});

export const invoiceSearchSchema = z.object({
  uniqueId: z.string().min(1).max(60).optional(),
  fromDate: isoDate.optional(),
  toDate: isoDate.optional(),
});

export const ptrSchema = uniqueIdSchema.extend({
  /** Tipo do pedido pós-emissão: cancelamento, reembolso ou reemissão. */
  requestType: z.enum(["Cancellation", "Refund", "Reissue", "Void", "Other"]),
  remarks: z.string().trim().max(1000).optional(),
});

export const ptrSearchSchema = z.object({
  ptrId: z.string().min(1).max(60).optional(),
  uniqueId: z.string().min(1).max(60).optional(),
  fromDate: isoDate.optional(),
  toDate: isoDate.optional(),
});

export const scheduleChangeSchema = z.object({
  uniqueId: z.string().min(1).max(60).optional(),
  fromDate: isoDate.optional(),
  toDate: isoDate.optional(),
});

export const creditNoteSchema = z.object({
  uniqueId: z.string().min(1).max(60).optional(),
  fromDate: isoDate.optional(),
  toDate: isoDate.optional(),
});

export const settingsSchema = z.object({
  environment: z.enum(["sandbox", "production"]),
  timeoutMs: z.number().int().min(3000).max(120000),
  maxRetries: z.number().int().min(0).max(5),
  cacheTtlSeconds: z.number().int().min(0).max(86400),
});

export type SearchInput = z.infer<typeof searchSchema>;
export type BookInput = z.infer<typeof bookSchema>;
export type PtrInput = z.infer<typeof ptrSchema>;
export type SettingsInput = z.infer<typeof settingsSchema>;
