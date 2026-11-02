import { queryOptions } from "@tanstack/react-query";
import { listSmartRouteItineraries } from "./maps.functions";
export const smartItineraryOptions = queryOptions({ queryKey: ["smart-route", "itineraries"], queryFn: () => listSmartRouteItineraries(), staleTime: 60000 });