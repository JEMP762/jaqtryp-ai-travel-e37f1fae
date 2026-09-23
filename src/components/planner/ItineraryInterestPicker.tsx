import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ITINERARY_INTERESTS } from "@/lib/itinerary-interests";

type Props = {
  selected: string[];
  onSelectedChange: (selected: string[]) => void;
  custom: string;
  onCustomChange: (custom: string) => void;
};

export function ItineraryInterestPicker({ selected, onSelectedChange, custom, onCustomChange }: Props) {
  const toggle = (id: string) => {
    onSelectedChange(selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id]);
  };

  return (
    <div className="space-y-3">
      <Label>O que deseja conhecer?</Label>
      <div className="flex flex-wrap gap-2" aria-label="Preferências do roteiro">
        {ITINERARY_INTERESTS.map((interest) => {
          const active = selected.includes(interest.id);
          return (
            <Button
              key={interest.id}
              type="button"
              size="sm"
              variant={active ? "default" : "outline"}
              aria-pressed={active}
              onClick={() => toggle(interest.id)}
            >
              {active ? <Check className="h-3.5 w-3.5" /> : null}
              {interest.label}
            </Button>
          );
        })}
      </div>
      <Textarea
        value={custom}
        onChange={(event) => onCustomChange(event.target.value)}
        placeholder="Outros interesses ou lugares que não podem faltar..."
        rows={2}
        maxLength={500}
      />
    </div>
  );
}