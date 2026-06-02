import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { ArrowRight, Calendar, ChevronRight, Megaphone, Shield, HeartPulse, Briefcase, GraduationCap, Home, Star, FileText, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SectionHeader } from "@/components/SectionHeader";
import type { Language } from "@/lib/i18n";
import { t } from "@/lib/i18n";
import { format } from "date-fns";
import { type LeaderConfig, DEFAULT_LEADER_CONFIG } from "@/lib/LeaderConfigContext";

export function createDefaultHomeHero(lc: LeaderConfig): HomeHeroConfig {
  return {
    badge: `${lc.partyShort} – ${lc.partyEn}`,
    badgeTa: lc.partyTa,
    headline: lc.nameEn,
    headlineTa: lc.nameTa,
    subheadline: `${lc.titleEn} – ${lc.constituencyEn} Constituency, Tamil Nadu`,
    subheadlineTa: `${lc.titleTa} – ${lc.constituencyTa} தொகுதி`,
    description: `A leader dedicated to the people of ${lc.constituencyEn} — committed to development, transparency, and citizen welfare.`,
    descriptionTa: `மக்களுக்கான சேவையில், வளர்ச்சியில் உறுதிபூண்ட தாம்பரத்தின் குரல்.`,
    primaryCtaLabel: "Submit Grievance",
    primaryCtaLabelTa: "புகார் அளிக்க",
    primaryCtaHref: "/grievance",
    secondaryCtaLabel: "Join the Movement",
    secondaryCtaLabelTa: "இயக்கத்தில் இணையுங்கள்",
    secondaryCtaHref: "/volunteer",
    photoUrl: lc.photoUrl || "",
    statsHeadline: "Constituency Development at a Glance",
    statsHeadlineTa: "தொகுதி வளர்ச்சி புள்ளிவிவரம்",
    statsSubheadline: `Key development milestones in ${lc.constituencyEn}`,
    statsSubheadlineTa: `தாம்பரத்தில் நடந்த வளர்ச்சி பணிகள்`,
    grievanceCtaTitle: "Your Voice Matters",
    grievanceCtaTitleTa: "உங்கள் குரல் முக்கியம்",
    grievanceCtaBody: "Report issues in your area directly to the office. Submit your grievance and track its resolution in real time.",
    grievanceCtaBodyTa: "உங்கள் பகுதியில் உள்ள பிரச்சினைகளை நேரடியாக தெரிவியுங்கள். புகார் அனுப்பி நிலையை கண்காணியுங்கள்.",
    volunteerCtaTitle: "Join the Movement",
    volunteerCtaTitleTa: "இயக்கத்தில் இணையுங்கள்",
    volunteerCtaBody: `Be part of positive change in ${lc.constituencyEn}. Register as a volunteer and contribute to our community.`,
    volunteerCtaBodyTa: `தாம்பரத்தின் வளர்ச்சிக்கு பங்காற்றுங்கள். தன்னார்வலராக பதிவு செய்யுங்கள்.`,
  };
}

export const DEFAULT_HOME_HERO: HomeHeroConfig = createDefaultHomeHero(DEFAULT_LEADER_CONFIG);

export interface HomeHeroConfig {
  badge: string;
  badgeTa: string;
  headline: string;
  headlineTa: string;
  subheadline: string;
  subheadlineTa: string;
  description: string;
  descriptionTa: string;
  primaryCtaLabel: string;
  primaryCtaLabelTa: string;
  primaryCtaHref: string;
  secondaryCtaLabel: string;
  secondaryCtaLabelTa: string;
  secondaryCtaHref: string;
  photoUrl: string;
  statsHeadline: string;
  statsHeadlineTa: string;
  statsSubheadline: string;
  statsSubheadlineTa: string;
  grievanceCtaTitle: string;
  grievanceCtaTitleTa: string;
  grievanceCtaBody: string;
  grievanceCtaBodyTa: string;
  volunteerCtaTitle: string;
  volunteerCtaTitleTa: string;
  volunteerCtaBody: string;
  volunteerCtaBodyTa: string;
}


export interface HomeStats {
  roadsBuiltKm: number;
  waterProjectsCompleted: number;
  schoolsUpgraded: number;
  jobsCreated: number;
  beneficiariesServed: number;
}

export interface HomeSummary {
  totalVolunteers?: number | null;
  totalEvents?: number | null;
  totalNews?: number | null;
}

export interface HomeNewsItem {
  id: number;
  title: string;
  titleTa?: string | null;
  category?: string | null;
  publishedAt?: string | null;
  thumbnailUrl?: string | null;
  imageUrl?: string | null;
}

export interface HomeEventItem {
  id: number;
  title: string;
  titleTa?: string | null;
  eventDate: string;
  venue?: string | null;
  thumbnailUrl?: string | null;
  imageUrl?: string | null;
}

export interface HomeActivityItem {
  title: string;
  titleTa?: string | null;
  location?: string | null;
  activityDate: string;
}

export interface HomeGalleryItem {
  id: number;
  title: string;
  thumbnailUrl?: string | null;
  mediaUrl: string;
}

export interface HomeViewProps {
  config: HomeHeroConfig;
  lang: Language;
  summary?: HomeSummary | null;
  stats?: HomeStats | null;
  featuredNews?: HomeNewsItem[] | null;
  upcomingEvents?: HomeEventItem[] | null;
  recentActivities?: HomeActivityItem[] | null;
  gallery?: { items: HomeGalleryItem[] } | null;
  /** When true, disables count-up animations and fixed viewport heights so the
   *  view fits inside the admin preview panel. */
  embedded?: boolean;
}

function useCountUp(target: number, duration = 2000, enabled = true) {
  const [count, setCount] = useState(enabled ? 0 : target);
  const ref = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  useEffect(() => {
    if (!enabled) { setCount(target); return; }
    if (target === 0) { setCount(0); return; }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !started.current) {
          started.current = true;
          const start = Date.now();
          const tick = () => {
            const elapsed = Date.now() - start;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setCount(Math.round(eased * target));
            if (progress < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }
      },
      { threshold: 0.3 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [target, duration, enabled]);

  return { count, ref };
}

function StatCard({ label, value, unit = "", animate }: { label: string; value: number; unit?: string; animate: boolean }) {
  const { count, ref } = useCountUp(value, 2000, animate);
  return (
    <div ref={ref} className="glass-card rounded-xl p-5 text-center text-white" data-testid="stat-card">
      <div className="text-3xl md:text-4xl font-bold text-yellow-400">
        {count.toLocaleString()}{unit}
      </div>
      <div className="text-sm text-white/80 mt-1">{label}</div>
    </div>
  );
}

export function HomeView({
  config,
  lang,
  summary,
  stats,
  featuredNews,
  upcomingEvents,
  recentActivities,
  gallery,
  embedded = false,
}: HomeViewProps) {
  const tx = (en: string, ta: string) => (lang === "ta" ? (ta || en) : en);
  const photoSrc = config.photoUrl || "";
  const heroMinH = embedded ? "min-h-[420px]" : "min-h-[90vh]";
  const animate = !embedded;

  return (
    <div>
      {/* Hero Section */}
      <section className={`relative ${heroMinH} flex items-center overflow-hidden tvk-hero-gradient`}>
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-10 w-72 h-72 rounded-full bg-yellow-400 blur-3xl" />
          <div className="absolute bottom-20 right-10 w-96 h-96 rounded-full bg-red-400 blur-3xl" />
        </div>

        <div className={`relative ${embedded ? "w-full" : "max-w-7xl mx-auto"} w-full px-4 py-8 md:py-20 grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-12 items-center`}>
          <div className="text-white text-center lg:text-left">
            {/* Mobile-only portrait — keeps the leader visible above the fold
                on phones (desktop shows the richer card on the right). */}
            <div className="lg:hidden flex justify-center mb-5">
              <div className="relative">
                <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full overflow-hidden border-4 border-yellow-400 shadow-2xl ring-4 ring-yellow-400/20 bg-primary/60 flex items-center justify-center">
                  {photoSrc ? <img src={photoSrc} alt={tx(config.headline, config.headlineTa)} className="w-full h-full object-cover object-top" /> : <span className="text-4xl font-bold text-yellow-400">{config.logoInitial ?? "D"}</span>}
                </div>
                <span className="absolute -bottom-1 -right-1 bg-yellow-400 text-yellow-900 text-[10px] font-bold px-2 py-0.5 rounded-full shadow">
                  Minister
                </span>
              </div>
            </div>

            <Badge className="mb-3 md:mb-4 bg-yellow-400/20 text-yellow-300 border-yellow-400/30 text-[11px] md:text-xs font-medium px-3 py-1">
              {tx(config.badge, config.badgeTa)}
            </Badge>
            <h1 className="text-[28px] sm:text-4xl md:text-5xl lg:text-6xl font-bold leading-[1.15] mb-3 md:mb-4">
              {tx(config.headline, config.headlineTa)}
            </h1>
            <p className="text-base sm:text-lg md:text-2xl text-yellow-300 font-semibold mb-3 md:mb-6 leading-snug">
              {tx(config.subheadline, config.subheadlineTa)}
            </p>
            <p className="text-white/80 text-sm md:text-lg max-w-lg mx-auto lg:mx-0 mb-6 md:mb-8 leading-relaxed">
              {tx(config.description, config.descriptionTa)}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 sm:flex-wrap sm:justify-center lg:justify-start">
              <Link href={config.primaryCtaHref || "/grievance"}>
                <Button data-testid="hero-grievance-btn" className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-white h-12 px-6 text-base font-semibold shadow-lg">
                  {tx(config.primaryCtaLabel, config.primaryCtaLabelTa)}
                  <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </Link>
              <Link href={config.secondaryCtaHref || "/volunteer"}>
                <Button data-testid="hero-volunteer-btn" variant="outline" className="w-full sm:w-auto border-white/40 text-white hover:bg-white/10 h-12 px-6 text-base">
                  {tx(config.secondaryCtaLabel, config.secondaryCtaLabelTa)}
                </Button>
              </Link>
            </div>

            {/* Mobile-only quick stats strip — reuses the desktop card data
                in a horizontal layout so phones aren't bare below the CTAs. */}
            <div className="lg:hidden mt-7 grid grid-cols-3 gap-2 text-center">
              <div className="glass-card rounded-xl py-3 px-1">
                <div className="text-xl font-bold text-yellow-400 leading-none">
                  {summary?.totalVolunteers?.toLocaleString() ?? "—"}
                </div>
                <div className="text-[10px] text-white/75 mt-1 leading-tight">
                  {tx("Volunteers", "தன்னார்வலர்கள்")}
                </div>
              </div>
              <div className="glass-card rounded-xl py-3 px-1">
                <div className="text-xl font-bold text-yellow-400 leading-none">
                  {summary?.totalEvents?.toLocaleString() ?? "—"}
                </div>
                <div className="text-[10px] text-white/75 mt-1 leading-tight">
                  {tx("Events", "நிகழ்வுகள்")}
                </div>
              </div>
              <div className="glass-card rounded-xl py-3 px-1">
                <div className="text-xl font-bold text-yellow-400 leading-none">
                  {summary?.totalNews?.toLocaleString() ?? "—"}
                </div>
                <div className="text-[10px] text-white/75 mt-1 leading-tight">
                  {tx("News", "செய்திகள்")}
                </div>
              </div>
            </div>
          </div>

          <div className={`${embedded ? "flex" : "hidden lg:flex"} justify-center`}>
            <div className="glass-card rounded-2xl p-5 md:p-6 max-w-sm w-full text-white">

              {/* CM + Minister photos — fixed equal size */}
              <div className="flex items-start justify-center gap-3 mb-5">
                {/* CM — left */}
                <div className="flex flex-col items-center gap-2 w-[128px]">
                  <div className="w-[128px] h-[160px] rounded-xl overflow-hidden border-2 border-yellow-400 shadow-xl bg-primary/60 flex-shrink-0">
                    <img
                      src="/cm_vijay.jpg"
                      alt="C. Joseph Vijay – Chief Minister"
                      className="w-full h-full object-cover object-top"
                    />
                  </div>
                  <span className="bg-yellow-400 text-yellow-900 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide text-center whitespace-nowrap">
                    {tx("Chief Minister", "முதலமைச்சர்")}
                  </span>
                  <span className="text-white/70 text-[11px] text-center leading-tight w-full">
                    {tx("C. Joseph Vijay", "C. ஜோசப் விஜய்")}
                  </span>
                </div>

                {/* Divider */}
                <div className="flex flex-col items-center gap-1 mt-16 flex-shrink-0">
                  <div className="w-px h-6 bg-yellow-400/30" />
                  <span className="text-yellow-400 text-base">★</span>
                  <div className="w-px h-6 bg-yellow-400/30" />
                </div>

                {/* Minister — right, identical size */}
                <div className="flex flex-col items-center gap-2 w-[128px]">
                  <div className="w-[128px] h-[160px] rounded-xl overflow-hidden border-2 border-yellow-400/50 shadow-xl bg-primary/60 flex-shrink-0">
                    {photoSrc
                      ? <img src={photoSrc} alt={tx(config.headline, config.headlineTa)} className="w-full h-full object-cover object-top" />
                      : <span className="w-full h-full flex items-center justify-center text-3xl font-bold text-yellow-400">S</span>
                    }
                  </div>
                  <span className="bg-white/20 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide text-center whitespace-nowrap">
                    {tx("Minister & MLA", "அமைச்சர் & எம்எல்ஏ")}
                  </span>
                  <span className="text-white/70 text-[11px] text-center leading-tight w-full">
                    {tx("D. Sarath Kumar", "டி. சரத் குமார்")}
                  </span>
                  <span className="text-yellow-300/80 text-[10px] text-center leading-tight w-full">
                    {tx("Human Resources & Ex-Servicemen Welfare", "மனித வளம் & முன்னாள் இராணுவ வீரர் நலன்")}
                  </span>
                </div>
              </div>

              {/* TVK party label */}
              <div className="text-center mb-4">
                <span className="text-yellow-400/80 text-[11px] font-semibold uppercase tracking-widest">
                  {tx("Tamilaga Vettri Kazhagam", "தமிழக வெற்றி கழகம்")}
                </span>
              </div>

              {/* Stats strip */}
              <div className="grid grid-cols-3 gap-2 text-center border-t border-white/10 pt-4">
                <div>
                  <div className="text-yellow-400 font-bold text-lg leading-none">
                    {summary?.totalVolunteers?.toLocaleString() ?? "—"}+
                  </div>
                  <div className="text-[10px] text-white/60 mt-0.5">{tx("Volunteers", "தன்னார்வலர்")}</div>
                </div>
                <div>
                  <div className="text-yellow-400 font-bold text-lg leading-none">
                    {summary?.totalEvents ?? "—"}
                  </div>
                  <div className="text-[10px] text-white/60 mt-0.5">{tx("Events", "நிகழ்வுகள்")}</div>
                </div>
                <div>
                  <div className="text-yellow-400 font-bold text-lg leading-none">
                    {summary?.totalNews ?? "—"}
                  </div>
                  <div className="text-[10px] text-white/60 mt-0.5">{tx("News", "செய்திகள்")}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Activity Ticker */}
      {recentActivities && recentActivities.length > 0 && (
        <div className="bg-primary text-white py-2 overflow-hidden border-b border-primary/50">
          <div className="flex items-center">
            <div className="flex-shrink-0 px-4 py-0.5 bg-yellow-400 text-yellow-900 font-bold text-xs uppercase tracking-wide">
              {tx("LIVE", "நேரலை")}
            </div>
            <div className="overflow-hidden flex-1">
              <div className={`flex gap-12 whitespace-nowrap ${animate ? "animate-ticker" : ""}`}>
                {[...recentActivities, ...recentActivities].map((a, i) => (
                  <span key={i} className="text-sm">
                    <span className="text-yellow-300 mr-2">★</span>
                    {tx(a.title, a.titleTa || a.title)}
                    {a.location && ` – ${a.location}`}{" "}
                    <span className="text-white/60 text-xs">{a.activityDate && !isNaN(new Date(a.activityDate).getTime()) ? format(new Date(a.activityDate), "dd MMM") : ""}</span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CM Feature Banner */}
      <section className="relative overflow-hidden bg-gradient-to-br from-gray-950 via-red-950/60 to-gray-950 border-y border-yellow-400/20">
        {/* Decorative blobs */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-20 -left-20 w-80 h-80 rounded-full bg-yellow-400/5 blur-3xl" />
          <div className="absolute -bottom-20 -right-20 w-96 h-96 rounded-full bg-red-600/10 blur-3xl" />
        </div>

        <div className={`relative ${embedded ? "w-full" : "max-w-7xl mx-auto"} px-4 py-10 md:py-14`}>
          <div className="flex flex-col md:flex-row items-center gap-8 md:gap-14">

            {/* Photo */}
            <div className="flex-shrink-0 flex flex-col items-center">
              <div className="relative">
                <div className="w-48 h-56 md:w-60 md:h-72 rounded-2xl overflow-hidden border-2 border-yellow-400/50 shadow-2xl shadow-yellow-400/10">
                  <img
                    src="/cm_vijay.jpg"
                    alt="C. Joseph Vijay – Chief Minister of Tamil Nadu"
                    className="w-full h-full object-cover object-top"
                  />
                </div>
                {/* Gold badge */}
                <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-yellow-400 text-yellow-900 text-[11px] font-bold px-4 py-1 rounded-full shadow-lg whitespace-nowrap tracking-wide uppercase">
                  {tx("Chief Minister", "முதலமைச்சர்")}
                </div>
              </div>
            </div>

            {/* Text */}
            <div className="flex-1 text-center md:text-left text-white">
              <div className="inline-flex items-center gap-2 mb-3">
                <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
                <span className="text-yellow-400 text-xs font-bold uppercase tracking-widest">
                  {tx("TVK Party Leadership", "தமிழக வெற்றி கழகம்")}
                </span>
              </div>
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-extrabold leading-tight mb-2 tracking-tight">
                {tx("C. Joseph Vijay", "C. ஜோசப் விஜய்")}
              </h2>
              <p className="text-yellow-300 font-semibold text-lg md:text-xl mb-5">
                {tx("Chief Minister of Tamil Nadu", "தமிழ்நாடு முதலமைச்சர்")}
              </p>

              {/* Divider */}
              <div className="w-16 h-0.5 bg-yellow-400/50 mb-5 mx-auto md:mx-0" />

              <blockquote className="text-white/80 text-base md:text-lg leading-relaxed mb-6 max-w-xl mx-auto md:mx-0 italic border-l-2 border-yellow-400/40 pl-4">
                {tx(
                  '"Together, we build a prosperous Tamil Nadu — one constituency at a time."',
                  '"ஒன்றிணைந்து, நாம் ஒரு வளமான தமிழ்நாட்டை கட்டியெழுப்புவோம்."'
                )}
              </blockquote>

              {/* Party endorsement line */}
              <div className="flex items-center gap-3 justify-center md:justify-start flex-wrap">
                <span className="text-xs text-white/50 uppercase tracking-wider">
                  {tx("Tambaram Constituency is proud to serve under", "தாம்பரம் தொகுதி பெருமையுடன் உழைக்கிறது")}
                </span>
                <span className="text-yellow-400 font-bold text-xs">
                  {tx("TVK Leadership", "TVK தலைமை")}
                </span>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Constituency Stats */}
      {stats && (
        <section className="py-12 md:py-16 tvk-hero-gradient text-white">
          <div className={`${embedded ? "w-full" : "max-w-7xl mx-auto"} px-4`}>
            <div className="text-center mb-8 md:mb-10">
              <h2 className="text-xl md:text-3xl font-bold text-white">
                {tx(config.statsHeadline, config.statsHeadlineTa)}
              </h2>
              <p className="text-white/70 mt-2 text-sm md:text-base">
                {tx(config.statsSubheadline, config.statsSubheadlineTa)}
              </p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
              <StatCard animate={animate} label={tx("Roads Built (km)", "சாலை கட்டப்பட்டது (கி.மீ)")} value={stats.roadsBuiltKm} />
              <StatCard animate={animate} label={tx("Water Projects", "நீர் திட்டங்கள்")} value={stats.waterProjectsCompleted} />
              <StatCard animate={animate} label={tx("Schools Upgraded", "மேம்படுத்திய பள்ளிகள்")} value={stats.schoolsUpgraded} />
              <StatCard animate={animate} label={tx("Jobs Created", "உருவாக்கிய வேலைகள்")} value={stats.jobsCreated} unit="+" />
              <StatCard animate={animate} label={tx("Beneficiaries Served", "பயனாளிகள்")} value={stats.beneficiariesServed} unit="+" />
            </div>
          </div>
        </section>
      )}

      {/* Ex-Servicemen Welfare Section */}
      <section className="relative overflow-hidden py-14 md:py-20">
        {/* Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900" />
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full bg-yellow-400/5 blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-80 h-80 rounded-full bg-blue-500/10 blur-3xl" />
        </div>

        <div className={`relative ${embedded ? "w-full" : "max-w-7xl mx-auto"} px-4`}>
          {/* Header */}
          <div className="text-center mb-10 md:mb-14">
            <div className="inline-flex items-center gap-2 bg-yellow-400/10 border border-yellow-400/30 rounded-full px-4 py-1.5 mb-4">
              <Shield className="w-4 h-4 text-yellow-400" />
              <span className="text-yellow-400 text-xs font-bold uppercase tracking-widest">
                {tx("Ex-Servicemen Welfare", "முன்னாள் இராணுவ வீரர் நலன்")}
              </span>
            </div>
            <h2 className="text-2xl md:text-4xl font-extrabold text-white mb-3 leading-tight">
              {tx("Serving Those Who Served the Nation", "நாட்டிற்காக உழைத்தவர்களுக்கு நாம் உழைக்கிறோம்")}
            </h2>
            <p className="text-white/65 text-sm md:text-base max-w-2xl mx-auto leading-relaxed">
              {tx(
                "D. Sarath Kumar, as Minister for Human Resources Management and Ex-Servicemen Welfare, is committed to the welfare, dignity, and rehabilitation of veterans and their families in Tambaram and across Tamil Nadu.",
                "மனித வள மேலாண்மை மற்றும் முன்னாள் இராணுவ வீரர் நலன் அமைச்சராக, டி. சரத் குமார் தாம்பரம் மற்றும் தமிழ்நாடு முழுவதும் உள்ள வீரர்கள் மற்றும் அவர்களது குடும்பங்களுக்கு சேவை செய்ய உறுதிபூண்டுள்ளார்."
              )}
            </p>
          </div>

          {/* Scheme Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-12">
            {[
              {
                icon: HeartPulse,
                color: "from-rose-500/20 to-rose-600/10",
                border: "border-rose-500/30",
                iconColor: "text-rose-400",
                title: tx("ECHS Health Scheme", "ஈசிஹெச்எஸ் சுகாதார திட்டம்"),
                desc: tx(
                  "Free medical care at ECHS polyclinics and empanelled hospitals for ex-servicemen and their dependents.",
                  "முன்னாள் இராணுவ வீரர்கள் மற்றும் அவர்களது குடும்பத்தினருக்கு இலவச மருத்துவ சேவை."
                ),
                tag: tx("Health", "சுகாதாரம்"),
              },
              {
                icon: Star,
                color: "from-yellow-500/20 to-yellow-600/10",
                border: "border-yellow-500/30",
                iconColor: "text-yellow-400",
                title: tx("Gallantry Award Recognition", "வீரதீர விருது அங்கீகாரம்"),
                desc: tx(
                  "Felicitation and financial rewards for Param Vir Chakra, Vir Chakra, and Sena Medal awardees in Tamil Nadu.",
                  "பரம வீர சக்கரம், வீர சக்கரம் மற்றும் சேனா பதக்கம் பெற்ற வீரர்களுக்கு விருது மற்றும் நிதி உதவி."
                ),
                tag: tx("Recognition", "அங்கீகாரம்"),
              },
              {
                icon: Briefcase,
                color: "from-blue-500/20 to-blue-600/10",
                border: "border-blue-500/30",
                iconColor: "text-blue-400",
                title: tx("Employment Reservation", "வேலைவாய்ப்பு இட ஒதுக்கீடு"),
                desc: tx(
                  "10% reservation in Tamil Nadu government jobs for ex-servicemen under the Ex-Servicemen Re-employment Act.",
                  "தமிழ்நாடு அரசு வேலைகளில் முன்னாள் இராணுவ வீரர்களுக்கு 10% இட ஒதுக்கீடு."
                ),
                tag: tx("Employment", "வேலைவாய்ப்பு"),
              },
              {
                icon: GraduationCap,
                color: "from-emerald-500/20 to-emerald-600/10",
                border: "border-emerald-500/30",
                iconColor: "text-emerald-400",
                title: tx("Education Scholarships", "கல்வி உதவித்தொகை"),
                desc: tx(
                  "Scholarships and fee concessions for children of ex-servicemen studying in schools and colleges across Tamil Nadu.",
                  "முன்னாள் வீரர்களின் பிள்ளைகளுக்கு பள்ளி மற்றும் கல்லூரி கல்விக்கு உதவித்தொகை."
                ),
                tag: tx("Education", "கல்வி"),
              },
              {
                icon: Home,
                color: "from-purple-500/20 to-purple-600/10",
                border: "border-purple-500/30",
                iconColor: "text-purple-400",
                title: tx("Housing Assistance", "வீட்டுவசதி உதவி"),
                desc: tx(
                  "Priority allotment in Tamil Nadu Housing Board schemes and subsidised loans for ex-servicemen families.",
                  "தமிழ்நாடு வீட்டு வாரிய திட்டங்களில் முன்னுரிமை ஒதுக்கீடு மற்றும் மானிய கடன் வசதி."
                ),
                tag: tx("Housing", "வீட்டுவசதி"),
              },
              {
                icon: FileText,
                color: "from-sky-500/20 to-sky-600/10",
                border: "border-sky-500/30",
                iconColor: "text-sky-400",
                title: tx("Pension & Financial Aid", "ஓய்வூதியம் & நிதி உதவி"),
                desc: tx(
                  "Assistance with pension arrears, disability pension claims, and one-time financial grants for veterans in need.",
                  "ஓய்வூதிய நிலுவை, ஊனமுற்றோர் ஓய்வூதியம் மற்றும் ஒருமுறை நிதி உதவிக்கு ஆதரவு."
                ),
                tag: tx("Pension", "ஓய்வூதியம்"),
              },
            ].map(({ icon: Icon, color, border, iconColor, title, desc, tag }) => (
              <div
                key={title}
                className={`relative rounded-2xl border ${border} bg-gradient-to-br ${color} backdrop-blur-sm p-6 flex flex-col gap-3 hover:scale-[1.02] transition-transform duration-200`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className={`w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0`}>
                    <Icon className={`w-5 h-5 ${iconColor}`} />
                  </div>
                  <span className={`text-[10px] font-bold uppercase tracking-widest ${iconColor} bg-white/10 px-2 py-0.5 rounded-full`}>
                    {tag}
                  </span>
                </div>
                <h3 className="text-white font-bold text-base leading-snug">{title}</h3>
                <p className="text-white/60 text-sm leading-relaxed flex-1">{desc}</p>
              </div>
            ))}
          </div>

          {/* CTA strip */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/grievance">
              <Button className="h-12 px-8 bg-yellow-400 hover:bg-yellow-300 text-yellow-900 font-bold text-sm shadow-lg shadow-yellow-400/20">
                <Phone className="w-4 h-4 mr-2" />
                {tx("Apply / File a Welfare Complaint", "விண்ணப்பிக்க / புகார் அளிக்க")}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
            <Link href="/contact">
              <Button variant="outline" className="h-12 px-8 border-white/30 text-white hover:bg-white/10 text-sm">
                {tx("Contact the Welfare Office", "நலன் அலுவலகத்தை தொடர்பு கொள்ளுங்கள்")}
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Latest News */}
      <section className={`py-12 md:py-16 ${embedded ? "w-full" : "max-w-7xl mx-auto"} px-4`}>
        <div className="flex items-center justify-between mb-8 md:mb-10">
          <SectionHeader title={tx("Latest News & Announcements", "சமீபத்திய செய்திகள்")} centered={false} />
          <Link href="/news">
            <Button variant="outline" size="sm" data-testid="view-all-news">
              {t(lang, "viewAll")} <ChevronRight className="w-3 h-3 ml-1" />
            </Button>
          </Link>
        </div>
        {!featuredNews ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-64 rounded-xl" />)}
          </div>
        ) : featuredNews.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">{t(lang, "noData")}</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {featuredNews.map((article) => (
              <Link key={article.id} href={`/news/${article.id}`}>
                <Card data-testid={`news-card-${article.id}`} className="group cursor-pointer hover:shadow-lg transition-all hover:-translate-y-1 overflow-hidden">
                  {(article.thumbnailUrl ?? article.imageUrl) && (
                    <div className="h-40 overflow-hidden">
                      <img src={article.thumbnailUrl || article.imageUrl || undefined} alt={article.title} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    </div>
                  )}
                  <CardContent className="p-4">
                    {article.category && <Badge variant="secondary" className="text-xs mb-2">{article.category}</Badge>}
                    <h3 className="font-semibold text-sm leading-snug mb-2 line-clamp-2 group-hover:text-primary transition-colors">
                      {tx(article.title, article.titleTa || article.title)}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {article.publishedAt ? format(new Date(article.publishedAt), "dd MMM yyyy") : ""}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Upcoming Events */}
      {upcomingEvents && upcomingEvents.length > 0 && (
        <section className="py-12 md:py-16 bg-muted/30">
          <div className={`${embedded ? "w-full" : "max-w-7xl mx-auto"} px-4`}>
            <div className="flex items-center justify-between mb-8 md:mb-10">
              <SectionHeader title={tx("Upcoming Events", "வரவிருக்கும் நிகழ்வுகள்")} centered={false} />
              <Link href="/events">
                <Button variant="outline" size="sm" data-testid="view-all-events">
                  {t(lang, "viewAll")} <ChevronRight className="w-3 h-3 ml-1" />
                </Button>
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {upcomingEvents.map((event) => (
                <Link key={event.id} href={`/events/${event.id}`}>
                  <Card data-testid={`event-card-${event.id}`} className="group cursor-pointer hover:shadow-md transition-all overflow-hidden">
                    {(event.thumbnailUrl ?? event.imageUrl) && (
                      <div className="h-36 overflow-hidden">
                        <img src={event.thumbnailUrl || event.imageUrl || undefined} alt={event.title} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      </div>
                    )}
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Calendar className="w-4 h-4 text-primary" />
                        <span className="text-xs font-medium text-primary">
                          {event.eventDate && !isNaN(new Date(event.eventDate).getTime()) ? format(new Date(event.eventDate), "dd MMM yyyy, h:mm a") : ""}
                        </span>
                      </div>
                      <h3 className="font-semibold text-sm leading-snug mb-1 group-hover:text-primary transition-colors">
                        {tx(event.title, event.titleTa || event.title)}
                      </h3>
                      {event.venue && <p className="text-xs text-muted-foreground">{event.venue}</p>}
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Gallery Strip */}
      {gallery?.items && gallery.items.length > 0 && (
        <section className={`py-12 md:py-16 ${embedded ? "w-full" : "max-w-7xl mx-auto"} px-4`}>
          <div className="flex items-center justify-between mb-8 md:mb-10">
            <SectionHeader title={tx("Photo Gallery", "படத் தொகுப்பு")} centered={false} />
            <Link href="/gallery">
              <Button variant="outline" size="sm" data-testid="view-all-gallery">
                {t(lang, "viewAll")} <ChevronRight className="w-3 h-3 ml-1" />
              </Button>
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {gallery.items.slice(0, 8).map((item) => (
              <div key={item.id} data-testid={`gallery-item-${item.id}`} className="aspect-square rounded-lg overflow-hidden group cursor-pointer">
                <img src={item.thumbnailUrl || item.mediaUrl} alt={item.title} loading="lazy" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Grievance CTA */}
      <section className="py-16 md:py-20 bg-primary text-white">
        <div className={`${embedded ? "w-full" : "max-w-4xl mx-auto"} px-4 text-center`}>
          <Megaphone className="w-10 h-10 md:w-12 md:h-12 text-yellow-300 mx-auto mb-4" />
          <h2 className="text-2xl md:text-4xl font-bold mb-4">
            {tx(config.grievanceCtaTitle, config.grievanceCtaTitleTa)}
          </h2>
          <p className="text-white/80 text-base md:text-lg mb-8 max-w-2xl mx-auto">
            {tx(config.grievanceCtaBody, config.grievanceCtaBodyTa)}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/grievance">
              <Button data-testid="cta-submit-grievance" className="bg-white text-primary hover:bg-yellow-50 font-semibold px-8 py-3">
                {t(lang, "submitGrievance")}
              </Button>
            </Link>
            <Link href="/grievance">
              <Button data-testid="cta-track-grievance" variant="outline" className="border-white/40 text-white hover:bg-white/10 px-8 py-3">
                {t(lang, "trackGrievance")}
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Volunteer CTA */}
      <section className={`py-12 md:py-16 ${embedded ? "w-full" : "max-w-7xl mx-auto"} px-4`}>
        <div className="rounded-2xl overflow-hidden bg-gradient-to-r from-yellow-50 to-yellow-100 dark:from-yellow-900/20 dark:to-yellow-800/20 p-6 md:p-12 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h2 className="text-xl md:text-3xl font-bold mb-2">
              {tx(config.volunteerCtaTitle, config.volunteerCtaTitleTa)}
            </h2>
            <p className="text-muted-foreground max-w-md text-sm md:text-base">
              {tx(config.volunteerCtaBody, config.volunteerCtaBodyTa)}
            </p>
          </div>
          <Link href="/volunteer">
            <Button data-testid="cta-volunteer" className="bg-primary text-white hover:bg-primary/90 px-8 py-3 text-base font-semibold flex-shrink-0">
              {t(lang, "registerNow")}
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
