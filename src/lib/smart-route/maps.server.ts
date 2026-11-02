// Source: Google Maps Platform Code Assist
const BASE = "https://connector-gateway.lovable.dev/google_maps";
export async function mapsRequest(appKey: string, connectionKey: string, path: string, body: unknown, mask: string): Promise<unknown> {
  const response = await fetch(`${BASE}${path}`, { method: "POST", signal: AbortSignal.timeout(15000), headers: { Authorization: `Bearer ${appKey}`, "X-Connection-Api-Key": connectionKey, "Content-Type": "application/json", "X-Goog-FieldMask": mask, "X-Goog-Maps-Solution-ID": "gmp_lovable_agentskills_v1" }, body: JSON.stringify(body) });
  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`SMART ROUTE Google Maps [${response.status}]: ${errorBody}`);
    if (response.status === 403) {
      let reason = "";
      try { const parsed = JSON.parse(errorBody) as { error?: { details?: { reason?: string }[] } }; reason = parsed.error?.details?.find(d => d.reason)?.reason ?? ""; } catch { /* plain-text gateway error */ }
      if (reason === "API_KEY_HTTP_REFERRER_BLOCKED") throw new Error("Google Maps [403]: a chave do servidor tem restrição de site. O administrador precisa ajustar essa chave no Google Cloud para uso no servidor, sem alterar a proteção da chave do mapa.");
      if (reason === "API_KEY_SERVICE_BLOCKED") throw new Error("Google Maps [403]: habilite Places API (New) e Routes API nas permissões da chave no Google Cloud.");
      throw new Error("Google Maps [403]: acesso recusado. Verifique as permissões da conexão.");
    }
    if (response.status === 429) throw new Error("Google Maps [429]: limite de consultas atingido. Tente novamente mais tarde.");
    throw new Error(`Google Maps [${response.status}]: não foi possível consultar o serviço.`);
  }
  return response.json();
}