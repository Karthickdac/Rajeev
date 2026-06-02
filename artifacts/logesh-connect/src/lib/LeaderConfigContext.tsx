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
  siteTitleTa: string;
  logoInitial: string;
  districtEn: string;
  districtTa: string;
}

export const DEFAULT_LEADER_CONFIG: LeaderConfig = {
  nameEn: "D. Sarath Kumar",
  nameTa: "D. சரத் குமார்",
  titleEn: "Minister for Human Resources Management and Ex-Servicemen Welfare",
  titleTa: "மனித வள மேலாண்மை மற்றும் முன்னாள் இராணுவ வீரர் நலன் அமைச்சர்",
  constituencyEn: "Tambaram",
  constituencyTa: "தாம்பரம்",
  partyEn: "Tamilaga Vettri Kazhagam (TVK)",
  partyTa: "தமிழக வெற்றி கழகம் (TVK)",
  partyShort: "TVK",
  phone: "+91 (Contact Office)",
  whatsapp: "919876543210",
  email: "office@sarathkumar.in",
  addressEn: "MLA Office, Tambaram, Chengalpattu District, Tamil Nadu",
  addressTa: "சட்டமன்ற உறுப்பினர் அலுவலகம், தாம்பரம், செங்கல்பட்டு மாவட்டம், தமிழ்நாடு",
  officeHoursEn: "Monday – Saturday: 9:00 AM – 6:00 PM",
  officeHoursTa: "திங்கள் – சனி: காலை 9:00 – மாலை 6:00",
  photoUrl: "/sarath_kumar_dp.png",
  siteTitle: "Ungaludan Sarath",
  siteTitleTa: "உங்களுடன் சரத்",
  logoInitial: "S",
  districtEn: "Chengalpattu",
  districtTa: "செங்கல்பட்டு",
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
