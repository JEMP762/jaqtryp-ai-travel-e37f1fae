# Architecture rules

- SMART ROUTE lives in its own components and library directory under the existing `/_app` shell; only an additive menu entry touches the shell, to preserve existing flows.
- SMART ROUTE geographic queries use authenticated server functions with the Google Maps connector and no AI or credit/payment mutations, to keep provider data and existing billing isolated.
- SMART ROUTE reads existing owner-scoped itinerary results but holds confirmed stops and live GPS only in session memory, to avoid changing saved planner data or retaining location history.
- SMART ROUTE pauses browser GPS when hidden and cleans up on exit; background navigation is delegated to an external maps app rather than promising browser capabilities it does not have.