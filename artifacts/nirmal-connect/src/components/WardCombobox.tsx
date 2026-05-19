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
  area?: string | null;
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
  const emptyMsg = lang === "ta" ? "வார்டு கிடைக்கவில்லை" : "No ward found";

  const displayLabel =
    !value
      ? includeAll ? allLbl : ph
      : options.find((o) => o.name === value)?.name ?? value;

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
        className={cn("p-0", className ?? "w-[260px]")}
        align="start"
      >
        <Command>
          <CommandInput placeholder={searchPh} className="h-9" />
          <CommandList>
            <CommandEmpty>{emptyMsg}</CommandEmpty>
            <CommandGroup>
              {includeAll && (
                <CommandItem
                  value=""
                  onSelect={() => { onChange(""); setOpen(false); }}
                >
                  <Check className={cn("mr-2 h-4 w-4", !value ? "opacity-100" : "opacity-0")} />
                  {allLbl}
                </CommandItem>
              )}
              {options.map((opt) => (
                <CommandItem
                  key={opt.id}
                  value={opt.name + (opt.area ? ` ${opt.area}` : "")}
                  onSelect={() => { onChange(opt.name); setOpen(false); }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === opt.name ? "opacity-100" : "opacity-0")} />
                  {opt.name}{opt.area ? <span className="ml-1 text-xs text-muted-foreground">— {opt.area}</span> : null}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
