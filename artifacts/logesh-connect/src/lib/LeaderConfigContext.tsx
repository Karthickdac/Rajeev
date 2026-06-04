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
  // Map / location fields (editable from Map & Location Settings)
  mapCenterLat: number;
  mapCenterLng: number;
  mapZoom: number;
  acNumber: string;
  officialEmail: string;
  secondaryPhone: string;
  whatsappNumber: string;
}

export const DEFAULT_LEADER_CONFIG: LeaderConfig = {
  nameEn: "VK Rajeev",
  nameTa: "வி.கே. ராஜீவ்",
  titleEn: "Minister for Environment & Climate Change",
  titleTa: "சுற்றுச்சூழல் மற்றும் காலநிலை மாற்றம் அமைச்சர்",
  constituencyEn: "Thiruvadanai",
  constituencyTa: "திருவடனை",
  partyEn: "Tamilaga Vettri Kazhagam (TVK)",
  partyTa: "தமிழக வெற்றி கழகம் (TVK)",
  partyShort: "TVK",
  phone: "+91 (Contact Office)",
  whatsapp: "919876543210",
  email: "office@ungalrajeev.in",
  addressEn: "MLA Office, Thiruvadanai, Ramanathapuram District, Tamil Nadu",
  addressTa: "சட்டமன்ற உறுப்பினர் அலுவலகம், திருவடனை, இராமநாதபுரம் மாவட்டம், தமிழ்நாடு",
  officeHoursEn: "Monday – Saturday: 9:00 AM – 6:00 PM",
  officeHoursTa: "திங்கள் – சனி: காலை 9:00 – மாலை 6:00",
  photoUrl: "/rajeev_dp.png",
  siteTitle: "Ungal Rajeev",
  siteTitleTa: "உங்கள் ராஜீவ்",
  logoInitial: "R",
  districtEn: "Ramanathapuram",
  districtTa: "இராமநாதபுரம்",
  mapCenterLat: 9.370,
  mapCenterLng: 78.520,
  mapZoom: 12,
  acNumber: "216",
  officialEmail: "office@ungalrajeev.in",
  secondaryPhone: "",
  whatsappNumber: "919876543210",
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
