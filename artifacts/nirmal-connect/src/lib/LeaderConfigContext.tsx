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
  nameEn: "Dr. T.K. Prabhu",
  nameTa: "டாக்டர் டி.கே. பிரபு",
  titleEn: "Minister of Minerals and Mines",
  titleTa: "கனிமவளம் மற்றும் சுரங்கத்துறை அமைச்சர்",
  constituencyEn: "Karaikudi",
  constituencyTa: "காரைக்குடி",
  partyEn: "Tamilaga Vettri Kazhagam (TVK)",
  partyTa: "தமிழக வெற்றி கழகம் (TVK)",
  partyShort: "TVK",
  phone: "+91 (Contact Office)",
  whatsapp: "919876543210",
  email: "office@tkprabhu.in",
  addressEn: "Minister's Office, Karaikudi, Sivaganga District – 630001, Tamil Nadu",
  addressTa: "அமைச்சர் அலுவலகம், காரைக்குடி, சிவகங்கை மாவட்டம் – 630001, தமிழ்நாடு",
  officeHoursEn: "Monday – Saturday: 9:00 AM – 6:00 PM",
  officeHoursTa: "திங்கள் – சனி: காலை 9:00 – மாலை 6:00",
  photoUrl: "",
  siteTitle: "TK Prabhu Connect",
  logoInitial: "T",
  districtEn: "Sivaganga",
  districtTa: "சிவகங்கை",
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
