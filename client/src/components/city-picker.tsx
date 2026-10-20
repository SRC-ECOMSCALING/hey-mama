import { useState } from "react";
import { Check, ChevronsUpDown, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useLanguage } from "@/contexts/LanguageContext";
import { ITALIAN_PROVINCES } from "@shared/provinces";

interface CityPickerProps {
  value: string;
  onChange: (city: string) => void;
  // Buyer filter: adds an "All cities" entry that clears the value.
  allowAll?: boolean;
  testId?: string;
}

// Searchable city picker over the same province list used at registration,
// so a listing's city and a buyer's filter always match exactly.
export default function CityPicker({ value, onChange, allowAll = false, testId = "select-city" }: CityPickerProps) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);

  const pick = (city: string) => {
    onChange(city);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
          data-testid={testId}
        >
          <span className={`flex items-center gap-2 truncate ${value ? "text-gray-900" : "text-muted-foreground"}`}>
            <MapPin className="h-4 w-4 shrink-0 opacity-60" />
            {/* Older listings may hold free text outside the list: show it as-is */}
            {value || (allowAll ? t("allCities") : t("selectCity"))}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      {/* z-[70]: the picker also lives inside the marketplace setup screen
          (z-[60]); at the default z-50 the list opened hidden behind it. */}
      <PopoverContent className="z-[70] w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder={t("searchCity")} />
          <CommandList>
            <CommandEmpty>{t("noCityFound")}</CommandEmpty>
            <CommandGroup>
              {allowAll && (
                <CommandItem value={t("allCities")} onSelect={() => pick("")} data-testid={`${testId}-all`}>
                  <Check className={`mr-2 h-4 w-4 ${!value ? "opacity-100" : "opacity-0"}`} />
                  {t("allCities")}
                </CommandItem>
              )}
              {ITALIAN_PROVINCES.map((city) => (
                <CommandItem key={city} value={city} onSelect={() => pick(city)}>
                  <Check className={`mr-2 h-4 w-4 ${value === city ? "opacity-100" : "opacity-0"}`} />
                  {city}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
