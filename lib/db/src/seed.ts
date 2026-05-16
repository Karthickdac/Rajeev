import { db } from "./index.js";
import {
  usersTable,
  newsTable,
  eventsTable,
  activitiesTable,
  galleryTable,
  faqsTable,
  constituencyStatsTable,
  wardsTable,
  zonesTable,
  pincodesTable,
  pincodeWardsTable,
  pollingStationsTable,
  siteConfigTable,
} from "./schema/index.js";
import { createHmac, randomBytes } from "crypto";
import { eq, sql } from "drizzle-orm";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

import bcrypt from "bcryptjs";
function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 12);
}
function _legacyHashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = createHmac("sha256", salt).update(password).digest("hex");
  return `${salt}:${hash}`;
}

// Pretty-titles a panchayat/RV name for use as a ward `name`.
function titleCase(s: string): string {
  return s.trim().replace(/\s+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
function slugify(s: string): string {
  return s.toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

type PollingPdfArea = {
  revenueVillage: string | null;
  panchayat: string | null;
  ward: string | null;
  locality: string | null;
  raw: string;
};
type PollingPdfBooth = {
  slNo: number;
  boothNo: string;
  location: string;
  pincode: string | null;
  voterType: "all" | "men_only" | "women_only";
  areas: PollingPdfArea[];
};


// ── Tenant leader configurations ─────────────────────────────────────
// Add a new entry here for each new minister / deployment.
// TENANT env var selects which config to seed (default: "nirmal").
const TENANT_CONFIGS: Record<string, object> = {
  nirmal: {
    nameEn: "C.T.R. Nirmal Kumar",
    nameTa: "சி.டி.ஆர். நிர்மல் குமார்",
    titleEn: "Minister of Energy Resources and Law",
    titleTa: "மின்சக்தி மற்றும் சட்டத்துறை அமைச்சர்",
    constituencyEn: "Tirupparankundram",
    constituencyTa: "திருப்பரங்குன்றம்",
    partyEn: "Tamilaga Vettri Kazhagam (TVK)",
    partyTa: "தமிழக வெற்றி கழகம் (TVK)",
    partyShort: "TVK",
    phone: "+91 (Contact Office)",
    whatsapp: "919876543210",
    email: "office@nirmalconnect.in",
    addressEn: "Minister's Office, Tirupparankundram, Madurai – 625005, Tamil Nadu",
    addressTa: "அமைச்சர் அலுவலகம், திருப்பரங்குன்றம், மதுரை – 625005, தமிழ்நாடு",
    officeHoursEn: "Monday – Saturday: 9:00 AM – 6:00 PM",
    officeHoursTa: "திங்கள் – சனி: காலை 9:00 – மாலை 6:00",
    photoUrl: "",
    siteTitle: "Nirmal Connect",
    logoInitial: "N",
    districtEn: "Madurai",
    districtTa: "மதுரை",
  },
  tkprabhu: {
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
    photoUrl: "/tkp_profile.jpg",
    siteTitle: "TK Prabhu Connect",
    logoInitial: "T",
    districtEn: "Sivaganga",
    districtTa: "சிவகங்கை",
  },
};

async function seed() {
  const TENANT = process.env.TENANT ?? "tkprabhu";
  const leaderCfg = TENANT_CONFIGS[TENANT] ?? TENANT_CONFIGS["tkprabhu"];
  console.log(`Seeding database for tenant: ${TENANT}`);

  // Users
  await db.insert(usersTable).values([
    {
      email: "admin@tkprabhu.com",
      name: "Admin User",
      passwordHash: hashPassword("Admin@2026"),
      role: "super_admin",
      isActive: "true",
    },
  ]).onConflictDoNothing();

  // Leader config — upsert so re-running with a different TENANT updates the live value.
  await db.insert(siteConfigTable).values({
    key: "leader_config",
    value: JSON.stringify(leaderCfg),
  }).onConflictDoUpdate({
    target: siteConfigTable.key,
    set: { value: JSON.stringify(leaderCfg), updatedAt: new Date() },
  });
  console.log(`[seed] leader_config upserted for tenant: ${TENANT}`);

  // Constituency Stats
  await db.insert(constituencyStatsTable).values([
    {
      roadsBuiltKm: 127,
      waterProjectsCompleted: 43,
      schoolsUpgraded: 18,
      healthClinicsOpened: 6,
      jobsCreated: 2800,
      beneficiariesServed: 45000,
      totalProjects: 89,
      completedProjects: 67,
      ongoingProjects: 22,
    },
  ]).onConflictDoNothing();

  // News
  await db.insert(newsTable).values([
    {
      title: "50 km Road Construction Completed in Karaikudi",
      titleTa: "காரைக்குடியில் 50 கி.மீ சாலை கட்டுமானம் நிறைவு",
      content: "Dr. T.K. Prabhu, Minister of Minerals and Mines, inaugurated 50 km of newly built roads across Karaikudi constituency, benefiting thousands of residents. The project was funded under the state infrastructure development scheme.",
      contentTa: "கனிமவளம் மற்றும் சுரங்கத்துறை அமைச்சர் டாக்டர் டி.கே. பிரபு காரைக்குடி தொகுதியில் 50 கி.மீ புதிய சாலைகளை திறந்து வைத்தார். இந்த திட்டம் மாநில உள்கட்டமைப்பு மேம்பாட்டு திட்டத்தின் கீழ் நிதியளிக்கப்பட்டது.",
      category: "development",
      featured: true,
      publishedAt: new Date("2025-04-15"),
    },
    {
      title: "Free Medical Camp Provides Treatment to 5,000 Residents",
      titleTa: "5,000 மக்களுக்கு இலவச மருத்துவ முகாம்",
      content: "A mega free medical camp was organized by Dr. T.K. Prabhu's office in collaboration with government hospitals. Over 5,000 residents received free consultation, medicines, and diagnostic tests.",
      contentTa: "டாக்டர் டி.கே. பிரபுவின் அலுவலகம் அரசு மருத்துவமனைகளுடன் இணைந்து மெகா இலவச மருத்துவ முகாம் ஏற்பாடு செய்தது. 5,000க்கும் மேற்பட்ட மக்கள் இலவச ஆலோசனை, மருந்துகள் பெற்றனர்.",
      category: "welfare",
      featured: true,
      publishedAt: new Date("2025-03-20"),
    },
    {
      title: "New Women's Self-Help Group Launched in Karaikudi",
      titleTa: "காரைக்குடியில் புதிய மகளிர் சுய உதவி குழு தொடக்கம்",
      content: "200 women from Karaikudi have been enrolled in new self-help groups to promote financial independence and entrepreneurship. Dr. T.K. Prabhu handed over seed capital to each group.",
      contentTa: "காரைக்குடியில் 200 பெண்கள் நிதி சுதந்திரம் மற்றும் தொழில் முனைவோர்மையை ஊக்குவிக்க புதிய சுய உதவி குழுக்களில் சேர்க்கப்பட்டுள்ளனர்.",
      category: "welfare",
      featured: true,
      publishedAt: new Date("2025-02-10"),
    },
    {
      title: "15 Government Schools Receive Infrastructure Upgrade",
      titleTa: "15 அரசு பள்ளிகளில் கட்டமைப்பு மேம்பாடு",
      content: "Under the constituency development fund, 15 government schools in Karaikudi received new classrooms, toilets, and digital equipment, improving learning conditions for over 8,000 students.",
      contentTa: "தொகுதி வளர்ச்சி நிதியின் கீழ், காரைக்குடியில் 15 அரசு பள்ளிகளுக்கு புதிய வகுப்பறைகள், கழிப்பறைகள் மற்றும் டிஜிட்டல் உபகரணங்கள் வழங்கப்பட்டன.",
      category: "education",
      featured: false,
      publishedAt: new Date("2025-01-25"),
    },
    {
      title: "Drinking Water Project Reaches All Wards in Karaikudi",
      titleTa: "காரைக்குடி வார்டுகளிலும் குடிநீர் திட்டம் நிறைவு",
      content: "The long-awaited drinking water supply project has been completed across all wards of Karaikudi constituency. Households now receive 24/7 clean piped water supply.",
      contentTa: "நீண்ட காலமாக எதிர்பார்க்கப்பட்ட குடிநீர் வழங்கல் திட்டம் காரைக்குடி தொகுதியின் அனைத்து வார்டுகளிலும் நிறைவடைந்தது.",
      category: "development",
      featured: false,
      publishedAt: new Date("2024-12-15"),
    },
    {
      title: "Youth Skill Development Centre Inaugurated in Karaikudi",
      titleTa: "காரைக்குடியில் இளைஞர் திறன் மேம்பாட்டு மையம் திறப்பு",
      content: "A new skill development centre offering vocational training in IT, tailoring, and automobile repair was inaugurated in Karaikudi. The centre will benefit 500 youth annually.",
      contentTa: "IT, தையல் மற்றும் வாகன பழுது நீக்கத்தில் தொழிற்பயிற்சி வழங்கும் புதிய திறன் மேம்பாட்டு மையம் காரைக்குடியில் திறக்கப்பட்டது.",
      category: "employment",
      featured: false,
      publishedAt: new Date("2024-11-30"),
    },
  ]).onConflictDoNothing();

  // Events
  const futureDate1 = new Date();
  futureDate1.setDate(futureDate1.getDate() + 14);
  const futureDate2 = new Date();
  futureDate2.setDate(futureDate2.getDate() + 30);
  const futureDate3 = new Date();
  futureDate3.setDate(futureDate3.getDate() + 45);
  const pastDate1 = new Date();
  pastDate1.setDate(pastDate1.getDate() - 15);

  await db.insert(eventsTable).values([
    {
      title: "Constituency Meeting & Public Hearing",
      titleTa: "தொகுதி கூட்டம் & பொது விசாரணை",
      description: "Monthly public hearing where residents can directly present their issues to Dr. T.K. Prabhu. All are welcome. No appointment needed.",
      descriptionTa: "மாதாந்திர பொது விசாரணை - மக்கள் நேரடியாக டாக்டர் டி.கே. பிரபுவிடம் தங்கள் பிரச்சினைகளை தெரிவிக்கலாம்.",
      venue: "Town Hall, Karaikudi",
      eventDate: futureDate1,
      category: "public-hearing",
    },
    {
      title: "Free Legal Aid Camp",
      titleTa: "இலவச சட்ட உதவி முகாம்",
      description: "A free legal aid camp organized in collaboration with the Tamil Nadu Bar Association. Residents can seek legal advice on property, family, and labour matters.",
      descriptionTa: "தமிழ்நாடு வக்கீல் சங்கத்துடன் இணைந்து ஏற்பாடு செய்யப்பட்ட இலவச சட்ட உதவி முகாம்.",
      venue: "Panchayat Hall, Karaikudi",
      eventDate: futureDate2,
      category: "welfare",
    },
    {
      title: "Youth Sports Tournament 2025",
      titleTa: "இளைஞர் விளையாட்டு போட்டி 2025",
      description: "Inter-ward youth sports tournament covering cricket, volleyball, and kabaddi. Open to all youth aged 15–30 from Karaikudi constituency.",
      descriptionTa: "கிரிக்கெட், கைப்பந்து மற்றும் கபடி உள்ளடக்கிய வார்டு அளவிலான இளைஞர் விளையாட்டு போட்டி.",
      venue: "Municipal Stadium, Karaikudi",
      eventDate: futureDate3,
      category: "sports",
    },
    {
      title: "Tree Plantation Drive – Green Karaikudi",
      titleTa: "மர நடவடிக்கை – பச்சை காரைக்குடி",
      description: "Dr. T.K. Prabhu led a constituency-wide tree plantation drive with volunteers. Over 1,000 saplings were planted across public spaces.",
      descriptionTa: "டாக்டர் டி.கே. பிரபு தன்னார்வலர்களுடன் தொகுதி அளவிலான மர நடவடிக்கையை நடத்தினார்.",
      venue: "Throughout Karaikudi Constituency",
      eventDate: pastDate1,
      category: "environment",
    },
  ]).onConflictDoNothing();

  // Activities
  const today = new Date();
  await db.insert(activitiesTable).values([
    {
      title: "Met with residents of Karaikudi Ward on road issues",
      titleTa: "காரைக்குடி வார்டு மக்களை சந்தித்தல் – சாலை பிரச்சினை",
      description: "Held a direct consultation with Karaikudi ward residents regarding pothole repairs and road widening. Action plan submitted to PWD.",
      activityDate: new Date(today.getTime() - 1 * 86400000),
      location: "Karaikudi Ward, Karaikudi",
      category: "constituency-work",
    },
    {
      title: "Inaugurated new community water tank in Karaikudi",
      titleTa: "காரைக்குடியில் புதிய நீர் தொட்டி திறப்பு",
      description: "A 50,000-litre overhead water tank was inaugurated, benefiting 300 households in Karaikudi with regular water supply.",
      activityDate: new Date(today.getTime() - 3 * 86400000),
      location: "Karaikudi",
      category: "development",
    },
    {
      title: "Attended Tamil Nadu Legislative Assembly session",
      titleTa: "தமிழ்நாடு சட்டமன்ற கூட்டத்தொடரில் கலந்துகொண்டார்",
      description: "Represented Karaikudi constituency in the assembly session. Raised issues related to Sivaganga district infrastructure funding.",
      activityDate: new Date(today.getTime() - 5 * 86400000),
      location: "Tamil Nadu Legislative Assembly, Chennai",
      category: "assembly",
    },
    {
      title: "Distributed school kits to 200 students",
      titleTa: "200 மாணவர்களுக்கு பள்ளி பைகள் வழங்கல்",
      description: "School bags, notebooks, and stationery were distributed to 200 students from economically weaker sections in Karaikudi government schools.",
      activityDate: new Date(today.getTime() - 7 * 86400000),
      location: "Govt. School, Karaikudi",
      category: "education",
    },
    {
      title: "Reviewed progress of constituency road projects",
      titleTa: "தொகுதி சாலை திட்டங்களின் முன்னேற்றம் ஆய்வு",
      description: "Conducted a field inspection of ongoing road construction works across 5 wards to ensure quality and timely completion.",
      activityDate: new Date(today.getTime() - 10 * 86400000),
      location: "Various Wards, Karaikudi",
      category: "development",
    },
    {
      title: "Public meeting on TVK party activities",
      titleTa: "TVK கட்சி நடவடிக்கைகள் பற்றிய பொது கூட்டம்",
      description: "Chaired a TVK party coordination meeting to plan upcoming constituency outreach programs and volunteer drives.",
      activityDate: new Date(today.getTime() - 12 * 86400000),
      location: "TVK Office, Karaikudi",
      category: "party",
    },
  ]).onConflictDoNothing();

  // Gallery — intentionally left empty. Real photos are uploaded by
  // staff through Admin → Gallery; we don't ship stock placeholders.

  // ── Constituency hierarchy ──────────────────────────────
  // Karaikudi constituency (AC 194), Sivaganga District.

  // 1) Zones — 5 Karaikudi Municipality zones
  await db.insert(zonesTable).values([
    { slug: "central", name: "Central Zone", nameTa: "மத்திய மண்டலம்",  type: "municipality", description: "Central zone covering Sekkalai, Main Market and town core" },
    { slug: "north",   name: "North Zone",   nameTa: "வடக்கு மண்டலம்",  type: "municipality", description: "Northern zone toward Kundrakudi and Koviloor" },
    { slug: "east",    name: "East Zone",    nameTa: "கிழக்கு மண்டலம்", type: "municipality", description: "Eastern zone toward Alagappapuram and Devakottai road" },
    { slug: "south",   name: "South Zone",   nameTa: "தெற்கு மண்டலம்",  type: "municipality", description: "Southern zone toward Ariyakudi and Soodamanikuppam" },
    { slug: "west",    name: "West Zone",    nameTa: "மேற்கு மண்டலம்",  type: "municipality", description: "Western zone toward Managiri and Patharakkudi" },
  ]).onConflictDoNothing();

  // Resolve zone IDs once for the ward inserts below.
  const zoneRows = await db.select({ id: zonesTable.id, slug: zonesTable.slug }).from(zonesTable);
  const zoneId = (slug: string) => zoneRows.find((z) => z.slug === slug)?.id ?? null;

  // 2) 36 wards of Karaikudi Municipality with bilingual names and GPS centroids.
  await db.insert(wardsTable).values([
    // Central Zone
    { slug: "ward-01-sekkalai",       name: "Ward 1 – Sekkalai",           nameTa: "வார்டு 1 – செக்கலை",              wardType: "municipal", zoneId: zoneId("central"), pincode: "630001", latitude: 10.0780, longitude: 78.7700 },
    { slug: "ward-02-main-market",    name: "Ward 2 – Main Market",        nameTa: "வார்டு 2 – பிரதான சந்தை",         wardType: "municipal", zoneId: zoneId("central"), pincode: "630001", latitude: 10.0770, longitude: 78.7740 },
    { slug: "ward-03-old-bus-stand",  name: "Ward 3 – Old Bus Stand",      nameTa: "வார்டு 3 – பழைய பேருந்து நிலையம்",wardType: "municipal", zoneId: zoneId("central"), pincode: "630001", latitude: 10.0760, longitude: 78.7750 },
    { slug: "ward-04-anna-nagar",     name: "Ward 4 – Anna Nagar",         nameTa: "வார்டு 4 – அண்ணா நகர்",           wardType: "municipal", zoneId: zoneId("central"), pincode: "630001", latitude: 10.0750, longitude: 78.7730 },
    { slug: "ward-05-gandhi-nagar",   name: "Ward 5 – Gandhi Nagar",       nameTa: "வார்டு 5 – காந்தி நகர்",          wardType: "municipal", zoneId: zoneId("central"), pincode: "630001", latitude: 10.0745, longitude: 78.7720 },
    { slug: "ward-06-nehru-nagar",    name: "Ward 6 – Nehru Nagar",        nameTa: "வார்டு 6 – நேரு நகர்",            wardType: "municipal", zoneId: zoneId("central"), pincode: "630001", latitude: 10.0765, longitude: 78.7710 },
    { slug: "ward-07-town-hall",      name: "Ward 7 – Town Hall Area",     nameTa: "வார்டு 7 – டவுன் ஹால் பகுதி",     wardType: "municipal", zoneId: zoneId("central"), pincode: "630001", latitude: 10.0755, longitude: 78.7760 },
    // North Zone
    { slug: "ward-08-koviloor",       name: "Ward 8 – Koviloor",           nameTa: "வார்டு 8 – கோவிலூர்",             wardType: "municipal", zoneId: zoneId("north"),   pincode: "630001", latitude: 10.0820, longitude: 78.7620 },
    { slug: "ward-09-kundrakudi-rd",  name: "Ward 9 – Kundrakudi Road",    nameTa: "வார்டு 9 – குன்றக்குடி சாலை",     wardType: "municipal", zoneId: zoneId("north"),   pincode: "630001", latitude: 10.0860, longitude: 78.7680 },
    { slug: "ward-10-muthupatti",     name: "Ward 10 – Muthupatti",        nameTa: "வார்டு 10 – முத்துப்பட்டி",        wardType: "municipal", zoneId: zoneId("north"),   pincode: "630001", latitude: 10.0840, longitude: 78.7700 },
    { slug: "ward-11-rajaji-nagar",   name: "Ward 11 – Rajaji Nagar",      nameTa: "வார்டு 11 – ராஜாஜி நகர்",         wardType: "municipal", zoneId: zoneId("north"),   pincode: "630001", latitude: 10.0830, longitude: 78.7740 },
    { slug: "ward-12-kavalar-nagar",  name: "Ward 12 – Kavalar Nagar",     nameTa: "வார்டு 12 – காவலர் நகர்",         wardType: "municipal", zoneId: zoneId("north"),   pincode: "630001", latitude: 10.0870, longitude: 78.7720 },
    { slug: "ward-13-saraswathi",     name: "Ward 13 – Saraswathi Nagar",  nameTa: "வார்டு 13 – சரஸ்வதி நகர்",        wardType: "municipal", zoneId: zoneId("north"),   pincode: "630001", latitude: 10.0850, longitude: 78.7760 },
    { slug: "ward-14-north-ext",      name: "Ward 14 – North Extension",   nameTa: "வார்டு 14 – வடக்கு விரிவு",        wardType: "municipal", zoneId: zoneId("north"),   pincode: "630001", latitude: 10.0890, longitude: 78.7700 },
    { slug: "ward-15-puliyampatti",   name: "Ward 15 – Puliyampatti",      nameTa: "வார்டு 15 – புளியம்பட்டி",         wardType: "municipal", zoneId: zoneId("north"),   pincode: "630001", latitude: 10.0800, longitude: 78.7660 },
    // East Zone
    { slug: "ward-16-alagappapuram",  name: "Ward 16 – Alagappapuram",     nameTa: "வார்டு 16 – அழகப்பாபுரம்",        wardType: "municipal", zoneId: zoneId("east"),    pincode: "630003", latitude: 10.0790, longitude: 78.7820 },
    { slug: "ward-17-devakottai-rd",  name: "Ward 17 – Devakottai Road",   nameTa: "வார்டு 17 – தேவகோட்டை சாலை",      wardType: "municipal", zoneId: zoneId("east"),    pincode: "630003", latitude: 10.0770, longitude: 78.7860 },
    { slug: "ward-18-tamil-nagar",    name: "Ward 18 – Tamil Nagar",       nameTa: "வார்டு 18 – தமிழ் நகர்",          wardType: "municipal", zoneId: zoneId("east"),    pincode: "630003", latitude: 10.0750, longitude: 78.7800 },
    { slug: "ward-19-arumugam-nagar", name: "Ward 19 – Arumugam Nagar",    nameTa: "வார்டு 19 – அருமுகம் நகர்",       wardType: "municipal", zoneId: zoneId("east"),    pincode: "630003", latitude: 10.0780, longitude: 78.7850 },
    { slug: "ward-20-mgr-nagar",      name: "Ward 20 – MGR Nagar",         nameTa: "வார்டு 20 – எம்ஜிஆர் நகர்",       wardType: "municipal", zoneId: zoneId("east"),    pincode: "630003", latitude: 10.0740, longitude: 78.7840 },
    { slug: "ward-21-east-ext",       name: "Ward 21 – East Extension",    nameTa: "வார்டு 21 – கிழக்கு விரிவு",       wardType: "municipal", zoneId: zoneId("east"),    pincode: "630003", latitude: 10.0800, longitude: 78.7880 },
    { slug: "ward-22-senjakulam",     name: "Ward 22 – Senjakulam",        nameTa: "வார்டு 22 – செஞ்சாக்குளம்",        wardType: "municipal", zoneId: zoneId("east"),    pincode: "630003", latitude: 10.0820, longitude: 78.7820 },
    { slug: "ward-23-kamarajar",      name: "Ward 23 – Kamarajar Nagar",   nameTa: "வார்டு 23 – காமராஜர் நகர்",       wardType: "municipal", zoneId: zoneId("east"),    pincode: "630003", latitude: 10.0760, longitude: 78.7880 },
    // South Zone
    { slug: "ward-24-soodamani",      name: "Ward 24 – Soodamanikuppam",   nameTa: "வார்டு 24 – சூடாமணிக்குப்பம்",    wardType: "municipal", zoneId: zoneId("south"),   pincode: "630002", latitude: 10.0650, longitude: 78.7750 },
    { slug: "ward-25-ariyakudi-rd",   name: "Ward 25 – Ariyakudi Road",    nameTa: "வார்டு 25 – அரியக்குடி சாலை",     wardType: "municipal", zoneId: zoneId("south"),   pincode: "630002", latitude: 10.0620, longitude: 78.7720 },
    { slug: "ward-26-kallukatti",     name: "Ward 26 – Kallukatti",        nameTa: "வார்டு 26 – கல்லுக்கட்டி",         wardType: "municipal", zoneId: zoneId("south"),   pincode: "630002", latitude: 10.0680, longitude: 78.7700 },
    { slug: "ward-27-railway-stn",    name: "Ward 27 – Railway Station",   nameTa: "வார்டு 27 – இரயில் நிலையம்",      wardType: "municipal", zoneId: zoneId("south"),   pincode: "630002", latitude: 10.0700, longitude: 78.7730 },
    { slug: "ward-28-south-ext",      name: "Ward 28 – South Extension",   nameTa: "வார்டு 28 – தெற்கு விரிவு",        wardType: "municipal", zoneId: zoneId("south"),   pincode: "630002", latitude: 10.0640, longitude: 78.7760 },
    { slug: "ward-29-palam-nagar",    name: "Ward 29 – Palam Nagar",       nameTa: "வார்டு 29 – பாலம் நகர்",          wardType: "municipal", zoneId: zoneId("south"),   pincode: "630002", latitude: 10.0660, longitude: 78.7800 },
    { slug: "ward-30-muthu-nagar",    name: "Ward 30 – Muthu Nagar",       nameTa: "வார்டு 30 – முத்து நகர்",          wardType: "municipal", zoneId: zoneId("south"),   pincode: "630002", latitude: 10.0690, longitude: 78.7780 },
    // West Zone
    { slug: "ward-31-managiri",       name: "Ward 31 – Managiri",          nameTa: "வார்டு 31 – மணகிரி",              wardType: "municipal", zoneId: zoneId("west"),    pincode: "630001", latitude: 10.0720, longitude: 78.7580 },
    { slug: "ward-32-patharakkudi",   name: "Ward 32 – Patharakkudi Road", nameTa: "வார்டு 32 – பத்தரக்குடி சாலை",    wardType: "municipal", zoneId: zoneId("west"),    pincode: "630001", latitude: 10.0740, longitude: 78.7600 },
    { slug: "ward-33-ilangudi-rd",    name: "Ward 33 – Ilangudi Road",     nameTa: "வார்டு 33 – இளங்குடி சாலை",       wardType: "municipal", zoneId: zoneId("west"),    pincode: "630001", latitude: 10.0700, longitude: 78.7610 },
    { slug: "ward-34-west-ext",       name: "Ward 34 – West Extension",    nameTa: "வார்டு 34 – மேற்கு விரிவு",        wardType: "municipal", zoneId: zoneId("west"),    pincode: "630001", latitude: 10.0760, longitude: 78.7620 },
    { slug: "ward-35-nehru-colony",   name: "Ward 35 – Nehru Colony",      nameTa: "வார்டு 35 – நேரு காலனி",          wardType: "municipal", zoneId: zoneId("west"),    pincode: "630001", latitude: 10.0780, longitude: 78.7650 },
    { slug: "ward-36-kaliamman",      name: "Ward 36 – Kaliamman Nagar",   nameTa: "வார்டு 36 – காளியம்மன் நகர்",     wardType: "municipal", zoneId: zoneId("west"),    pincode: "630001", latitude: 10.0720, longitude: 78.7640 },
  ]).onConflictDoNothing();

  // 3) Pincodes — Karaikudi constituency pin codes (Sivaganga District).
  await db.insert(pincodesTable).values([
    { code: "630001", label: "Karaikudi town centre" },
    { code: "630002", label: "Karaikudi south / Railway Station area" },
    { code: "630003", label: "Karaikudi east / Alagappapuram" },
    { code: "630004", label: "Karaikudi – Devakottai road" },
    { code: "630301", label: "Kundrakudi" },
    { code: "630305", label: "Managiri / Patharakkudi area" },
    { code: "630102", label: "Ariyakudi" },
    { code: "630311", label: "Koviloor" },
  ]).onConflictDoNothing();

  console.log("Constituency hierarchy seeded.");

  // Gallery — images served from /gallery/ (public/gallery in the frontend build)
  await db.delete(galleryTable);
  await db.insert(galleryTable).values([
    {
      title: "காரைக்குடி சாலை திறப்பு விழா",
      mediaUrl: "/gallery/1_1778235908020.jpg",
      thumbnailUrl: "/gallery/1_1778235908020.jpg",
      mediaType: "photo",
      album: "Development Works",
      displayOrder: 1,
    },
    {
      title: "இலவச மருத்துவ முகாம் – காரைக்குடி",
      mediaUrl: "/gallery/2_1778235908021.jpg",
      thumbnailUrl: "/gallery/2_1778235908021.jpg",
      mediaType: "photo",
      album: "Welfare",
      displayOrder: 2,
    },
    {
      title: "பொதுக் கூட்டம் – மக்கள் சந்திப்பு",
      mediaUrl: "/gallery/3_1778235908022.jpg",
      thumbnailUrl: "/gallery/3_1778235908022.jpg",
      mediaType: "photo",
      album: "Events",
      displayOrder: 3,
    },
    {
      title: "பள்ளி கட்டிட திறப்பு விழா",
      mediaUrl: "/gallery/4_1778235908013.jpg",
      thumbnailUrl: "/gallery/4_1778235908013.jpg",
      mediaType: "photo",
      album: "Development Works",
      displayOrder: 4,
    },
    {
      title: "இளைஞர் விளையாட்டு போட்டி 2025",
      mediaUrl: "/gallery/5_1778235908015.jpg",
      thumbnailUrl: "/gallery/5_1778235908015.jpg",
      mediaType: "photo",
      album: "Events",
      displayOrder: 5,
    },
    {
      title: "குடிநீர் திட்டம் – தொகுதி வளர்ச்சி",
      mediaUrl: "/gallery/6_1778235908018.jpg",
      thumbnailUrl: "/gallery/6_1778235908018.jpg",
      mediaType: "photo",
      album: "Development Works",
      displayOrder: 6,
    },
    {
      title: "மர நடவடிக்கை – பச்சை காரைக்குடி",
      mediaUrl: "/gallery/7_1778235908019.jpg",
      thumbnailUrl: "/gallery/7_1778235908019.jpg",
      mediaType: "photo",
      album: "Environment",
      displayOrder: 7,
    },
  ]);

  // FAQs
  await db.insert(faqsTable).values([
    {
      question: "How do I submit a grievance to Dr. T.K. Prabhu's office?",
      questionTa: "டாக்டர் டி.கே. பிரபுவின் அலுவலகத்திற்கு புகார் எப்படி அனுப்புவது?",
      answer: "You can submit a grievance through the Grievance Portal on this website. Fill in your name, contact number, category, and description of the issue. You will receive a unique ticket number to track the status of your complaint.",
      answerTa: "இந்த வலைத்தளத்தில் உள்ள புகார் மையம் மூலம் புகார் அனுப்பலாம். பெயர், தொலைபேசி, வகை மற்றும் பிரச்சினையின் விவரங்களை பூர்த்தி செய்யுங்கள். உங்கள் புகாரின் நிலையை கண்காணிக்க தனித்துவமான புகார் எண் கிடைக்கும்.",
      order: 1,
    },
    {
      question: "What are the office hours for Dr. T.K. Prabhu's constituency office?",
      questionTa: "டாக்டர் டி.கே. பிரபுவின் தொகுதி அலுவலகம் எப்போது திறந்திருக்கும்?",
      answer: "The constituency office is open Monday to Saturday, 9:00 AM to 6:00 PM. The office is closed on Sundays and public holidays.",
      answerTa: "தொகுதி அலுவலகம் திங்கள் முதல் சனி வரை, காலை 9:00 மணி முதல் மாலை 6:00 மணி வரை திறந்திருக்கும். ஞாயிறுகள் மற்றும் பொது விடுமுறை நாட்களில் மூடல்.",
      order: 2,
    },
    {
      question: "How can I become a volunteer for TVK in Karaikudi?",
      questionTa: "காரைக்குடியில் TVK தன்னார்வலராக எப்படி இணைவது?",
      answer: "Visit the Volunteer page on this website and fill out the registration form with your details. Our team will contact you to guide you through the process.",
      answerTa: "இந்த வலைத்தளத்தில் உள்ள தன்னார்வலர் பக்கத்திற்கு சென்று பதிவு படிவத்தை நிரப்புங்கள். நாங்கள் உங்களை தொடர்பு கொண்டு மேலும் வழிகாட்டுவோம்.",
      order: 3,
    },
    {
      question: "Which welfare schemes can I apply for through this office?",
      questionTa: "இந்த அலுவலகம் மூலம் எந்த நலத் திட்டங்களுக்கு விண்ணப்பிக்கலாம்?",
      answer: "The office assists with Old Age Pension, Education Scholarships, Housing Schemes (PMAY), MGNREGS, and other central and state government welfare schemes. Visit the office with your documents for assistance.",
      answerTa: "முதியோர் ஓய்வூதியம், கல்வி உதவித்தொகை, வீட்டுவசதி திட்டம் (PMAY), MGNREGS மற்றும் பிற மத்திய மாநில அரசு நலத் திட்டங்களுக்கு உதவி வழங்கப்படுகிறது.",
      order: 4,
    },
    {
      question: "How do I track my grievance status?",
      questionTa: "என் புகாரின் நிலையை எப்படி கண்காணிப்பது?",
      answer: "Go to the Grievance Portal and click on 'Track Status'. Enter your ticket number (format: GRV-YEAR-XXXXX) to see the current status of your complaint.",
      answerTa: "புகார் மையத்திற்கு சென்று 'நிலை அறிய' என்பதை கிளிக் செய்யுங்கள். உங்கள் புகார் எண்ணை (வடிவம்: GRV-ஆண்டு-XXXXX) உள்ளிட்டு தற்போதைய நிலையை காணலாம்.",
      order: 5,
    },
    {
      question: "Can I contact the office via WhatsApp?",
      questionTa: "WhatsApp மூலம் அலுவலகத்தை தொடர்பு கொள்ளலாமா?",
      answer: "Yes! You can reach us on WhatsApp at +91 98765 43210. Click the WhatsApp button on any page or use the Contact page to connect directly.",
      answerTa: "ஆம்! +91 98765 43210 என்ற எண்ணில் WhatsApp மூலம் தொடர்பு கொள்ளலாம். எந்த பக்கத்திலும் உள்ள WhatsApp பொத்தானை கிளிக் செய்யுங்கள்.",
      order: 6,
    },
  ]).onConflictDoNothing();

  console.log("Database seeded successfully!");
}

seed().then(() => process.exit(0)).catch((err) => {
  console.error("Seed error:", err);
  process.exit(1);
});
