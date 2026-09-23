export const ENTRY_CONTEXT_KEY = "jaqtryp:entry-context";

export type EntryIntent =
  | "itinerary"
  | "flight_search"
  | "image_translation"
  | "document_translation"
  | "travel_budget"
  | "direct";

export type EntryContext = {
  intent: EntryIntent;
  ref?: string;
  source?: string;
  medium?: string;
  campaign?: string;
  contentSlug?: string;
  visitorId?: string;
  destination?: string;
  origin?: string;
  startDate?: string;
  endDate?: string;
  variant: string;
};

const intents = new Set<EntryIntent>([
  "itinerary",
  "flight_search",
  "image_translation",
  "document_translation",
  "travel_budget",
  "direct",
]);

function clean(value: unknown, max = 120) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : undefined;
}

export function normalizeEntryContext(value: Partial<EntryContext>): EntryContext {
  const rawIntent = clean(value.intent, 40) as EntryIntent | undefined;
  return {
    intent: rawIntent && intents.has(rawIntent) ? rawIntent : "direct",
    ref: clean(value.ref, 32)?.toUpperCase(),
    source: clean(value.source, 80),
    medium: clean(value.medium, 80),
    campaign: clean(value.campaign, 120),
    contentSlug: clean(value.contentSlug, 100),
    visitorId: clean(value.visitorId, 100),
    destination: clean(value.destination, 120),
    origin: clean(value.origin, 120),
    startDate: clean(value.startDate, 20),
    endDate: clean(value.endDate, 20),
    variant: clean(value.variant, 40) ?? "default",
  };
}

export function readEntryContext(): EntryContext | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(ENTRY_CONTEXT_KEY);
    return raw ? normalizeEntryContext(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function saveEntryContext(value: Partial<EntryContext>) {
  if (typeof window === "undefined") return;
  const current = readEntryContext();
  const next = normalizeEntryContext({
    ...current,
    ...value,
    // Referral attribution is first-touch: later links never replace it.
    ref: current?.ref ?? value.ref,
    contentSlug: current?.ref ? current.contentSlug : value.contentSlug,
    visitorId: current?.visitorId ?? value.visitorId,
  });
  window.localStorage.setItem(ENTRY_CONTEXT_KEY, JSON.stringify(next));
  if (next.ref) window.sessionStorage.setItem("jq_pending_ref", next.ref);
  window.sessionStorage.setItem("jq_post_login_dest", "/onboarding");
}

export function clearEntryContext() {
  if (typeof window !== "undefined") window.localStorage.removeItem(ENTRY_CONTEXT_KEY);
}

export function onboardingDestination() {
  return readEntryContext() ? "/onboarding" : "/dashboard";
}