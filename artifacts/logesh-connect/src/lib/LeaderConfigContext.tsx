import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import type { Language } from "@/lib/i18n";

export interface LeaderConfig {
  nameEn: string;
  nameTa: string;
  titleEn: string;
  titleTa: string;
  constituencyEn: string;
  constituencyTa: string;
  partyEn: string;
  partyTa: string;
  partyShort: string;
  phone: string;
  whatsapp: string;
  email: string;
  addressEn: string;
  addressTa: string;
  officeHoursEn: string;
  officeHoursTa: string;
  photoUrl: string;
  siteTitle: string;
  logoInitial: string;
  districtEn: string;
  districtTa: string;
}

export const DEFAULT_LEADER_CONFIG: LeaderConfig = {
  nameEn: "D. Logesh Tamilselvan",
  nameTa: "D. லோகேஷ் தமிழ்செல்வன்",
  titleEn: "Minister of Commercial Taxes, Registration and Stamp Duty",
  titleTa: "பத்திரப்பதிவு மற்றும் வணிக வரித்துறை அமைச்சர்",
  constituencyEn: "Rasipuram",
  constituencyTa: "ராசிபுரம்",
  partyEn: "Tamilaga Vettri Kazhagam (TVK)",
  partyTa: "தமிழக வெற்றி கழகம் (TVK)",
  partyShort: "TVK",
  phone: "+91 (Contact Office)",
  whatsapp: "919876543210",
  email: "office@logeshtamilselvan.in",
  addressEn: "MLA Office, Rasipuram, Namakkal District – 637408, Tamil Nadu",
  addressTa: "சட்டமன்ற உறுப்பினர் அலுவலகம், ராசிபுரம், நாமக்கல் மாவட்டம் – 637408, தமிழ்நாடு",
  officeHoursEn: "Monday – Saturday: 9:00 AM – 6:00 PM",
  officeHoursTa: "திங்கள் – சனி: காலை 9:00 – மாலை 6:00",
  photoUrl: "",
  siteTitle: "Logesh Connect",
  logoInitial: "D",
  districtEn: "Namakkal",
  districtTa: "நாமக்கல்",
};

const LeaderConfigContext = createContext<LeaderConfig>(DEFAULT_LEADER_CONFIG);

export function LeaderConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<LeaderConfig>(DEFAULT_LEADER_CONFIG);

  useEffect(() => {
    fetch("/api/leader-config")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && typeof data === "object") {
          setConfig({ ...DEFAULT_LEADER_CONFIG, ...data });
        }
      })
      .catch(() => {});
  }, []);

  return (
    <LeaderConfigContext.Provider value={config}>
      {children}
    </LeaderConfigContext.Provider>
  );
}

export function useLeaderConfig() {
  return useContext(LeaderConfigContext);
}

export function lc(lang: Language, enVal: string, taVal: string): string {
  return lang === "ta" ? taVal : enVal;
}
