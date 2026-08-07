/**
 * Alterações de malha informadas pela companhia (Schedule Change).
 */
import { mystiflyRequest, type LogContext } from "./client.server";
import type { MystiflyCallResult } from "./types";
import { scheduleChangeSchema } from "./validators";

/** Lista as alterações de voo pendentes de ciência/ação. */
export async function listScheduleChanges(
  raw: unknown,
  context?: LogContext,
): Promise<MystiflyCallResult> {
  const input = scheduleChangeSchema.parse(raw);
  return mystiflyRequest(
    "scheduleChange",
    {
      ...(input.uniqueId ? { UniqueID: input.uniqueId } : {}),
      ...(input.fromDate ? { FromDate: `${input.fromDate}T00:00:00` } : {}),
      ...(input.toDate ? { ToDate: `${input.toDate}T23:59:59` } : {}),
    },
    { context },
  );
}
