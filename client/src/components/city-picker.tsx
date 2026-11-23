import { useState } from "react";
import { Check, ChevronsUpDown, MapPin } from "lucide-react";
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
  // "field" (default) looks like a form input; "pill" is the compact white
  // pill used next to the marketplace search.
  variant?: "field" | "pill";
}

// Searchable city picker over the same province list used at registration,
// so a listing's city and a buyer's filter always match exactly.
export default function CityPicker({ value, onChange, allowAll = false, testId = "select-city", variant = "field" }: CityPickerProps) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);

  const pick = (city: string) => {
    onChange(city);
    setOpen(false);
  };

  // Older listings may hold free text outside the list: show it as-is
  const label = value || (allowAll ? t("allCities") : t("selectCity"));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {variant === "pill" ? (
          <button
            type="button"
            role="combobox"
            aria-expanded={open}
            aria-label={t("marketCityAria").replace("{city}", label)}
            className="inline-flex h-[52px] max-w-[46%] shrink-0 items-center gap-1.5 rounded-full bg-white pl-3 pr-4 text-sm font-semibold text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            data-testid={testId}
          >
            <MapPin className="h-4 w-4 shrink-0 text-pink-500" />
            <span className="truncate">{label}</span>
          </button>
        ) : (
          <button
            type="button"
            role="combobox"
            aria-expanded={open}
            className="flex h-12 w-full items-center justify-between gap-2 rounded-2xl border border-input bg-white px-4 text-left text-base focus-visible:border-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            data-testid={testId}
          >
            <span className={`flex min-w-0 items-center gap-2 ${value ? "text-gray-900" : "text-muted-foreground"}`}>
              <MapPin className="h-4 w-4 shrink-0 text-pink-500" />
              <span className="truncate">{label}</span>
            </span>
            <ChevronsUpDown className="h-4 w-4 shrink-0 text-gray-500" />
          </button>
        )}
      </PopoverTrigger>
      {/* z-[70]: the picker also lives inside the marketplace setup screen
          (z-[60]); at the default z-50 the list opened hidden behind it. */}
      <PopoverContent
        className={`z-[70] overflow-hidden p-0 ${variant === "pill" ? "w-64" : "w-[--radix-popover-trigger-width]"}`}
        align={variant === "pill" ? "end" : "start"}
      >
        <Command>
          <CommandInput placeholder={t("searchCity")} />
          <CommandList>
            <CommandEmpty>{t("noCityFound")}</CommandEmpty>
            <CommandGroup>
              {allowAll && (
                <CommandItem value={t("allCities")} onSelect={() => pick("")} data-testid={`${testId}-all`}>
                  <Check className={`mr-2 h-4 w-4 text-pink-500 ${!value ? "opacity-100" : "opacity-0"}`} />
                  {t("allCities")}
                </CommandItem>
              )}
              {ITALIAN_PROVINCES.map((city) => (
                <CommandItem key={city} value={city} onSelect={() => pick(city)}>
                  <Check className={`mr-2 h-4 w-4 text-pink-500 ${value === city ? "opacity-100" : "opacity-0"}`} />
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
