import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Language } from "@/lib/i18n";

export interface WardOption {
  id: number;
  name: string;
  nameTa?: string | null;
  area?: string | null;
  zoneName?: string | null;
  zoneNameTa?: string | null;
}

interface WardComboboxProps {
  value: string;
  onChange: (value: string) => void;
  options: WardOption[];
  placeholder?: string;
  allLabel?: string;
  includeAll?: boolean;
  disabled?: boolean;
  lang?: Language;
  className?: string;
  triggerClassName?: string;
}

export default function WardCombobox({
  value,
  onChange,
  options,
  placeholder,
  allLabel,
  includeAll = false,
  disabled = false,
  lang = "en",
  className,
  triggerClassName,
}: WardComboboxProps) {
  const [open, setOpen] = useState(false);

  const ph = placeholder ?? (lang === "ta" ? "வார்டை தேர்ந்தெடுங்கள்" : "Select ward…");
  const allLbl = allLabel ?? (lang === "ta" ? "அனைத்தும்" : "All wards");
  const searchPh = lang === "ta" ? "தேட தட்டச்சு செய்யவும்…" : "Type to search…";
  const emptyMsg = lang === "ta" ? "கிடைக்கவில்லை" : "No results found";

  const displayLabel =
    !value
      ? (includeAll ? allLbl : ph)
      : (() => {
          const opt = options.find((o) => o.name === value);
          if (!opt) return value;
          const name = lang === "ta" && opt.nameTa ? opt.nameTa : opt.name;
          const zone = lang === "ta" && opt.zoneNameTa ? opt.zoneNameTa : opt.zoneName;
          return zone ? `${name} — ${zone}` : name;
        })();

  // Group options by zone; ungrouped wards go under a fallback group
  const grouped = options.reduce<Record<string, WardOption[]>>((acc, opt) => {
    const key = (lang === "ta" && opt.zoneNameTa ? opt.zoneNameTa : opt.zoneName) ?? (lang === "ta" ? "பிற பகுதிகள்" : "Other Areas");
    if (!acc[key]) acc[key] = [];
    acc[key].push(opt);
    return acc;
  }, {});

  const groupEntries = Object.entries(grouped);
  const isGrouped = groupEntries.length > 1;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "justify-between font-normal",
            !value && "text-muted-foreground",
            triggerClassName,
          )}
        >
          <span className="truncate">{displayLabel}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className={cn("p-0", className ?? "w-[280px]")}
        align="start"
      >
        <Command>
          <CommandInput placeholder={searchPh} className="h-9" />
          <CommandList>
            <CommandEmpty>{emptyMsg}</CommandEmpty>

            {/* "All" reset option */}
            {includeAll && (
              <CommandGroup>
                <CommandItem
                  value="__all__"
                  onSelect={() => { onChange(""); setOpen(false); }}
                >
                  <Check className={cn("mr-2 h-4 w-4", !value ? "opacity-100" : "opacity-0")} />
                  {allLbl}
                </CommandItem>
              </CommandGroup>
            )}

            {isGrouped
              ? groupEntries.map(([groupName, wards]) => (
                  <CommandGroup key={groupName} heading={groupName}>
                    {wards.map((opt) => {
                      const label = lang === "ta" && opt.nameTa ? opt.nameTa : opt.name;
                      const searchVal = [opt.name, opt.nameTa, opt.area, opt.zoneName, opt.zoneNameTa]
                        .filter(Boolean).join(" ");
                      return (
                        <CommandItem
                          key={opt.id}
                          value={searchVal}
                          onSelect={() => { onChange(opt.name); setOpen(false); }}
                        >
                          <Check className={cn("mr-2 h-4 w-4 shrink-0", value === opt.name ? "opacity-100" : "opacity-0")} />
                          <span>{label}</span>
                          {opt.area && <span className="ml-1.5 text-xs text-muted-foreground truncate">— {opt.area}</span>}
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                ))
              : (
                <CommandGroup>
                  {options.map((opt) => {
                    const label = lang === "ta" && opt.nameTa ? opt.nameTa : opt.name;
                    const searchVal = [opt.name, opt.nameTa, opt.area, opt.zoneName].filter(Boolean).join(" ");
                    return (
                      <CommandItem
                        key={opt.id}
                        value={searchVal}
                        onSelect={() => { onChange(opt.name); setOpen(false); }}
                      >
                        <Check className={cn("mr-2 h-4 w-4 shrink-0", value === opt.name ? "opacity-100" : "opacity-0")} />
                        <span>{label}</span>
                        {opt.area && <span className="ml-1.5 text-xs text-muted-foreground truncate">— {opt.area}</span>}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              )
            }
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
