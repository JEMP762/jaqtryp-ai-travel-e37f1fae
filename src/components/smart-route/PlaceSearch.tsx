import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Search, MapPin, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { searchSmartRoutePlaces } from "@/lib/smart-route/maps.functions";
import type { Coordinate, Place } from "@/lib/smart-route/model";

export function PlaceSearch({ label, value, onSelect, language, bias, initialQuery = "" }: { label: string; value: Place | null; onSelect: (place: Place | null) => void; language: "pt-BR" | "en" | "es" | "fr" | "de" | "it" | "ja" | "zh-CN"; bias?: Coordinate; initialQuery?: string }) {
  const search = useServerFn(searchSmartRoutePlaces);
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<Awaited<ReturnType<typeof searchSmartRoutePlaces>>>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);
  const request = useRef(0);
  const last = useRef<{ key: string; results: Awaited<ReturnType<typeof searchSmartRoutePlaces>> } | null>(null);
  async function submit() {
    if (query.trim().length < 3 || busy) return;
    const id = ++request.current;
    const key = JSON.stringify([query.trim(), language, bias]);
    setBusy(true); setError(""); setSearched(false);
    try {
      const found = last.current?.key === key ? last.current.results : await search({ data: { query: query.trim(), language, bias } });
      if (id !== request.current) return;
      last.current = { key, results: found }; setResults(found); setSearched(true);
    } catch (e) { if (id === request.current) { setResults([]); setError(e instanceof Error ? e.message : "Não foi possível buscar este local."); } }
    finally { if (id === request.current) setBusy(false); }
  }
  return <div className="space-y-2">
    <Label>{label}</Label>
    {value ? <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-3"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><div className="min-w-0 flex-1"><p className="break-words text-sm font-medium">{value.name}</p><p className="break-words text-xs text-muted-foreground">{value.address}</p></div><Button size="icon" variant="ghost" aria-label={`Alterar ${label.toLowerCase()}`} onClick={() => onSelect(null)}><X className="h-4 w-4" /></Button></div>
      : <><form className="flex gap-2" onSubmit={e => { e.preventDefault(); void submit(); }}><Input aria-label={label} maxLength={200} value={query} placeholder="Nome do lugar, cidade ou endereço" onChange={e => { request.current++; setBusy(false); setResults([]); setSearched(false); setQuery(e.target.value); }} /><Button variant="outline" size="icon" aria-label={`Buscar ${label.toLowerCase()}`} title="Buscar local" disabled={busy || query.trim().length < 3} type="submit">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}</Button></form>
      {!!results.length && <div className="divide-y divide-border rounded-lg border border-border">{results.map(result => <div key={result.id} className="p-1"><Button variant="ghost" className="h-auto w-full justify-start whitespace-normal px-2 py-3 text-left" onClick={() => { onSelect(result); setResults([]); }}><div><p className="text-sm font-medium">{result.name}</p><p className="text-xs font-normal text-muted-foreground">{result.address}</p></div></Button>{result.attributions.map((a, i) => a.providerUri?.startsWith("https://") ? <a className="px-2 text-xs text-muted-foreground underline" key={i} href={a.providerUri} target="_blank" rel="noopener noreferrer">{a.provider || "Fonte"}</a> : <span key={i} className="px-2 text-xs text-muted-foreground">{a.provider}</span>)}</div>)}<p className="px-3 py-2 text-xs text-muted-foreground">Google Maps</p></div>}
      {searched && !results.length && <p className="text-sm text-muted-foreground">Nenhum local encontrado. Inclua a cidade na busca.</p>}</>}
    {error && <p role="alert" className="break-words text-sm text-destructive">{error}</p>}
  </div>;
}