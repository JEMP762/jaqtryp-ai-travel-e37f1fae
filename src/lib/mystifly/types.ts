/**
 * Tipagem compartilhada da integração Mystifly (OnePoint REST API).
 * Este arquivo é livre de segredos e pode ser importado no cliente.
 */

export type MystiflyEnvironment = "sandbox" | "production";

/** Chaves lógicas de cada endpoint suportado. */
export type MystiflyEndpointKey =
  | "createSession"
  | "searchLowestFare"
  | "searchBrandedFare"
  | "revalidate"
  | "fareRules"
  | "bookFlight"
  | "orderTicket"
  | "tripDetails"
  | "bookingCancel"
  | "bookingNotes"
  | "invoiceSearch"
  | "postTicketingRequest"
  | "ptrSearch"
  | "scheduleChange"
  | "creditNote";

/** Rótulos legíveis usados nas telas administrativas. */
export const MYSTIFLY_ENDPOINT_LABELS: Record<MystiflyEndpointKey, string> = {
  createSession: "Create Session",
  searchLowestFare: "Search Lowest Fare",
  searchBrandedFare: "Search Branded Fare",
  revalidate: "Revalidate Flight",
  fareRules: "Flight Fare Rules",
  bookFlight: "Book Flight",
  orderTicket: "Order Ticket",
  tripDetails: "Trip Details",
  bookingCancel: "Booking Cancel",
  bookingNotes: "Booking Notes",
  invoiceSearch: "Invoice Search",
  postTicketingRequest: "Post Ticketing Request",
  ptrSearch: "PTR Search",
  scheduleChange: "Schedule Change",
  creditNote: "Credit Note",
};

/** Caminhos REST relativos à Base URL configurada. */
export const MYSTIFLY_ENDPOINT_PATHS: Record<MystiflyEndpointKey, string> = {
  createSession: "/Authenticate",
  searchLowestFare: "/Search",
  searchBrandedFare: "/SearchBrandedFare",
  revalidate: "/Revalidate",
  fareRules: "/FareRules",
  bookFlight: "/Book",
  orderTicket: "/OrderTicket",
  tripDetails: "/TripDetails",
  bookingCancel: "/BookingCancel",
  bookingNotes: "/BookingNotes",
  invoiceSearch: "/InvoiceSearch",
  postTicketingRequest: "/PostTicketingRequest",
  ptrSearch: "/PTRSearch",
  scheduleChange: "/ScheduleChange",
  creditNote: "/CreditNote",
};

export type CabinClass =
  | "Economy"
  | "PremiumEconomy"
  | "Business"
  | "First";

export type TripType = "OneWay" | "Return";

export interface MystiflySegmentInput {
  origin: string;
  destination: string;
  departureDate: string; // YYYY-MM-DD
}

export interface MystiflySearchInput {
  tripType: TripType;
  segments: MystiflySegmentInput[];
  adults: number;
  children?: number;
  infants?: number;
  cabinClass: CabinClass;
  /** Moeda solicitada (ex.: BRL, USD). */
  currency?: string;
  /** Somente voos diretos. */
  directOnly?: boolean;
}

export interface MystiflyPassengerInput {
  type: "ADT" | "CHD" | "INF";
  title: string;
  firstName: string;
  lastName: string;
  gender: "M" | "F";
  dateOfBirth: string; // YYYY-MM-DD
  nationality?: string;
  passportNumber?: string;
  passportExpiry?: string;
  email: string;
  phone: string;
}

/** Configurações não sensíveis persistidas no banco. */
export interface MystiflySettings {
  environment: MystiflyEnvironment;
  timeoutMs: number;
  maxRetries: number;
  cacheTtlSeconds: number;
  connectionStatus: string;
  connectionMessage: string | null;
  lastSyncAt: string | null;
}

/** Resultado padronizado de qualquer chamada à API. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface MystiflyCallResult<T = any> {
  ok: boolean;
  endpoint: MystiflyEndpointKey;
  httpStatus: number | null;
  durationMs: number;
  data: T | null;
  error: string | null;
  /** Eco do payload enviado, útil na tela de testes. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  request: any;
}

export interface MystiflyCredentialStatus {
  baseUrl: boolean;
  username: boolean;
  password: boolean;
  apiKey: boolean;
}
