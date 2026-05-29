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
const TENANT_CONFIGS: Record<string, object> = {
  logesh: {
    nameEn: "D. Logesh Tamilselvan",
    nameTa: "D. லோகேஷ் தமிழ்செல்வன்",
    titleEn: "Rasipuram Constituency - MLA",
    titleTa: "ராசிபுரம் தொகுதி - MLA",
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
    photoUrl: "/logesh_profile.jpg",
    siteTitle: "Logesh Connect",
    logoInitial: "D",
    districtEn: "Namakkal",
    districtTa: "நாமக்கல்",
  },
};

async function seed() {
  const TENANT = process.env.TENANT ?? "logesh";
  const leaderCfg = TENANT_CONFIGS[TENANT] ?? TENANT_CONFIGS["logesh"];
  console.log(`Seeding database for tenant: ${TENANT}`);

  // Users
  await db.insert(usersTable).values([
    {
      email: "admin@logeshconnect.in",
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
      roadsBuiltKm: 95,
      waterProjectsCompleted: 38,
      schoolsUpgraded: 14,
      healthClinicsOpened: 5,
      jobsCreated: 2200,
      beneficiariesServed: 38000,
      totalProjects: 72,
      completedProjects: 54,
      ongoingProjects: 18,
    },
  ]).onConflictDoNothing();

  // News
  await db.insert(newsTable).values([
    {
      title: "40 km Road Construction Completed in Rasipuram",
      titleTa: "ராசிபுரத்தில் 40 கி.மீ சாலை கட்டுமானம் நிறைவு",
      content: "D. Logesh Tamilselvan, Minister of Commercial Taxes, Registration and Stamp Duty, inaugurated 40 km of newly built roads across Rasipuram constituency, benefiting thousands of residents. The project was funded under the state infrastructure development scheme.",
      contentTa: "பத்திரப்பதிவு மற்றும் வணிக வரித்துறை அமைச்சர் டி. லோகேஷ் தமிழ்செல்வன் ராசிபுரம் தொகுதியில் 40 கி.மீ புதிய சாலைகளை திறந்து வைத்தார். இந்த திட்டம் மாநில உள்கட்டமைப்பு மேம்பாட்டு திட்டத்தின் கீழ் நிதியளிக்கப்பட்டது.",
      category: "development",
      featured: true,
      publishedAt: new Date("2025-04-15"),
    },
    {
      title: "Free Medical Camp Provides Treatment to 4,000 Residents in Rasipuram",
      titleTa: "ராசிபுரத்தில் 4,000 மக்களுக்கு இலவச மருத்துவ முகாம்",
      content: "A mega free medical camp was organized by D. Logesh Tamilselvan's office in collaboration with government hospitals. Over 4,000 residents received free consultation, medicines, and diagnostic tests.",
      contentTa: "டி. லோகேஷ் தமிழ்செல்வனின் அலுவலகம் அரசு மருத்துவமனைகளுடன் இணைந்து மெகா இலவச மருத்துவ முகாம் ஏற்பாடு செய்தது. 4,000க்கும் மேற்பட்ட மக்கள் இலவச ஆலோசனை, மருந்துகள் பெற்றனர்.",
      category: "welfare",
      featured: true,
      publishedAt: new Date("2025-03-20"),
    },
    {
      title: "New Women's Self-Help Group Launched in Rasipuram",
      titleTa: "ராசிபுரத்தில் புதிய மகளிர் சுய உதவி குழு தொடக்கம்",
      content: "180 women from Rasipuram have been enrolled in new self-help groups to promote financial independence and entrepreneurship. D. Logesh Tamilselvan handed over seed capital to each group.",
      contentTa: "ராசிபுரத்தில் 180 பெண்கள் நிதி சுதந்திரம் மற்றும் தொழில் முனைவோர்மையை ஊக்குவிக்க புதிய சுய உதவி குழுக்களில் சேர்க்கப்பட்டுள்ளனர்.",
      category: "welfare",
      featured: true,
      publishedAt: new Date("2025-02-10"),
    },
    {
      title: "14 Government Schools Receive Infrastructure Upgrade in Rasipuram",
      titleTa: "ராசிபுரத்தில் 14 அரசு பள்ளிகளில் கட்டமைப்பு மேம்பாடு",
      content: "Under the constituency development fund, 14 government schools in Rasipuram received new classrooms, toilets, and digital equipment, improving learning conditions for over 7,000 students.",
      contentTa: "தொகுதி வளர்ச்சி நிதியின் கீழ், ராசிபுரத்தில் 14 அரசு பள்ளிகளுக்கு புதிய வகுப்பறைகள், கழிப்பறைகள் மற்றும் டிஜிட்டல் உபகரணங்கள் வழங்கப்பட்டன.",
      category: "education",
      featured: false,
      publishedAt: new Date("2025-01-25"),
    },
    {
      title: "Drinking Water Project Reaches All Wards in Rasipuram",
      titleTa: "ராசிபுரம் வார்டுகளிலும் குடிநீர் திட்டம் நிறைவு",
      content: "The long-awaited drinking water supply project has been completed across all wards of Rasipuram constituency. Households now receive regular clean piped water supply.",
      contentTa: "நீண்ட காலமாக எதிர்பார்க்கப்பட்ட குடிநீர் வழங்கல் திட்டம் ராசிபுரம் தொகுதியின் அனைத்து வார்டுகளிலும் நிறைவடைந்தது.",
      category: "development",
      featured: false,
      publishedAt: new Date("2024-12-15"),
    },
    {
      title: "Youth Skill Development Centre Inaugurated in Rasipuram",
      titleTa: "ராசிபுரத்தில் இளைஞர் திறன் மேம்பாட்டு மையம் திறப்பு",
      content: "A new skill development centre offering vocational training in IT, tailoring, and automobile repair was inaugurated in Rasipuram. The centre will benefit 400 youth annually.",
      contentTa: "IT, தையல் மற்றும் வாகன பழுது நீக்கத்தில் தொழிற்பயிற்சி வழங்கும் புதிய திறன் மேம்பாட்டு மையம் ராசிபுரத்தில் திறக்கப்பட்டது.",
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
      description: "Monthly public hearing where residents can directly present their issues to D. Logesh Tamilselvan. All are welcome. No appointment needed.",
      descriptionTa: "மாதாந்திர பொது விசாரணை - மக்கள் நேரடியாக டி. லோகேஷ் தமிழ்செல்வனிடம் தங்கள் பிரச்சினைகளை தெரிவிக்கலாம்.",
      venue: "Town Hall, Rasipuram",
      eventDate: futureDate1,
      category: "public-hearing",
    },
    {
      title: "Free Legal Aid Camp",
      titleTa: "இலவச சட்ட உதவி முகாம்",
      description: "A free legal aid camp organized in collaboration with the Tamil Nadu Bar Association. Residents can seek legal advice on property, family, and labour matters.",
      descriptionTa: "தமிழ்நாடு வக்கீல் சங்கத்துடன் இணைந்து ஏற்பாடு செய்யப்பட்ட இலவச சட்ட உதவி முகாம்.",
      venue: "Panchayat Hall, Rasipuram",
      eventDate: futureDate2,
      category: "welfare",
    },
    {
      title: "Youth Sports Tournament 2025",
      titleTa: "இளைஞர் விளையாட்டு போட்டி 2025",
      description: "Inter-ward youth sports tournament covering cricket, volleyball, and kabaddi. Open to all youth aged 15–30 from Rasipuram constituency.",
      descriptionTa: "கிரிக்கெட், கைப்பந்து மற்றும் கபடி உள்ளடக்கிய வார்டு அளவிலான இளைஞர் விளையாட்டு போட்டி.",
      venue: "Municipal Stadium, Rasipuram",
      eventDate: futureDate3,
      category: "sports",
    },
    {
      title: "Tree Plantation Drive – Green Rasipuram",
      titleTa: "மர நடவடிக்கை – பச்சை ராசிபுரம்",
      description: "D. Logesh Tamilselvan led a constituency-wide tree plantation drive with volunteers. Over 1,000 saplings were planted across public spaces.",
      descriptionTa: "டி. லோகேஷ் தமிழ்செல்வன் தன்னார்வலர்களுடன் தொகுதி அளவிலான மர நடவடிக்கையை நடத்தினார்.",
      venue: "Throughout Rasipuram Constituency",
      eventDate: pastDate1,
      category: "environment",
    },
  ]).onConflictDoNothing();

  // Activities
  const today = new Date();
  await db.insert(activitiesTable).values([
    {
      title: "Met with residents of Rasipuram Ward on road issues",
      titleTa: "ராசிபுரம் வார்டு மக்களை சந்தித்தல் – சாலை பிரச்சினை",
      description: "Held a direct consultation with Rasipuram ward residents regarding pothole repairs and road widening. Action plan submitted to PWD.",
      activityDate: new Date(today.getTime() - 1 * 86400000),
      location: "Rasipuram",
      category: "constituency-work",
    },
    {
      title: "Inaugurated new community water tank in Rasipuram",
      titleTa: "ராசிபுரத்தில் புதிய நீர் தொட்டி திறப்பு",
      description: "A 50,000-litre overhead water tank was inaugurated, benefiting 280 households in Rasipuram with regular water supply.",
      activityDate: new Date(today.getTime() - 3 * 86400000),
      location: "Rasipuram",
      category: "development",
    },
    {
      title: "Attended Tamil Nadu Legislative Assembly session",
      titleTa: "தமிழ்நாடு சட்டமன்ற கூட்டத்தொடரில் கலந்துகொண்டார்",
      description: "Represented Rasipuram constituency in the assembly session. Raised issues related to Namakkal district infrastructure funding and commercial tax reforms.",
      activityDate: new Date(today.getTime() - 5 * 86400000),
      location: "Tamil Nadu Legislative Assembly, Chennai",
      category: "assembly",
    },
    {
      title: "Distributed school kits to 180 students",
      titleTa: "180 மாணவர்களுக்கு பள்ளி பைகள் வழங்கல்",
      description: "School bags, notebooks, and stationery were distributed to 180 students from economically weaker sections in Rasipuram government schools.",
      activityDate: new Date(today.getTime() - 7 * 86400000),
      location: "Govt. School, Rasipuram",
      category: "education",
    },
    {
      title: "Reviewed progress of constituency road projects",
      titleTa: "தொகுதி சாலை திட்டங்களின் முன்னேற்றம் ஆய்வு",
      description: "Conducted a field inspection of ongoing road construction works across 5 wards to ensure quality and timely completion.",
      activityDate: new Date(today.getTime() - 10 * 86400000),
      location: "Various Wards, Rasipuram",
      category: "development",
    },
    {
      title: "Public meeting on TVK party activities",
      titleTa: "TVK கட்சி நடவடிக்கைகள் பற்றிய பொது கூட்டம்",
      description: "Chaired a TVK party coordination meeting to plan upcoming constituency outreach programs and volunteer drives.",
      activityDate: new Date(today.getTime() - 12 * 86400000),
      location: "TVK Office, Rasipuram",
      category: "party",
    },
  ]).onConflictDoNothing();

  // ── Constituency hierarchy ──────────────────────────────
  // Rasipuram constituency, Namakkal District.

  // 1) Zones — Rasipuram Municipality zones
  await db.insert(zonesTable).values([
    { slug: "central", name: "Central Zone", nameTa: "மத்திய மண்டலம்", type: "municipality", description: "Central zone covering the main market and town core" },
    { slug: "north",   name: "North Zone",   nameTa: "வடக்கு மண்டலம்", type: "municipality", description: "Northern zone toward Salem highway" },
    { slug: "east",    name: "East Zone",    nameTa: "கிழக்கு மண்டலம்", type: "municipality", description: "Eastern zone toward Namakkal road" },
    { slug: "south",   name: "South Zone",   nameTa: "தெற்கு மண்டலம்", type: "municipality", description: "Southern zone toward Tiruchengode road" },
    { slug: "west",    name: "West Zone",    nameTa: "மேற்கு மண்டலம்", type: "municipality", description: "Western zone toward Erode highway" },
  ]).onConflictDoNothing();

  const zoneRows = await db.select({ id: zonesTable.id, slug: zonesTable.slug }).from(zonesTable);
  const zoneId = (slug: string) => zoneRows.find((z) => z.slug === slug)?.id ?? null;

  // 2) Wards of Rasipuram Municipality with bilingual names and GPS centroids.
  await db.insert(wardsTable).values([
    // Central Zone
    { slug: "ward-01-main-market",    name: "Ward 1 – Main Market",       nameTa: "வார்டு 1 – பிரதான சந்தை",      wardType: "municipal", zoneId: zoneId("central"), pincode: "637408", latitude: 11.4560, longitude: 77.9880 },
    { slug: "ward-02-town-hall",      name: "Ward 2 – Town Hall",         nameTa: "வார்டு 2 – டவுன் ஹால்",        wardType: "municipal", zoneId: zoneId("central"), pincode: "637408", latitude: 11.4545, longitude: 77.9870 },
    { slug: "ward-03-anna-nagar",     name: "Ward 3 – Anna Nagar",        nameTa: "வார்டு 3 – அண்ணா நகர்",        wardType: "municipal", zoneId: zoneId("central"), pincode: "637408", latitude: 11.4570, longitude: 77.9900 },
    { slug: "ward-04-gandhi-nagar",   name: "Ward 4 – Gandhi Nagar",      nameTa: "வார்டு 4 – காந்தி நகர்",       wardType: "municipal", zoneId: zoneId("central"), pincode: "637408", latitude: 11.4550, longitude: 77.9860 },
    { slug: "ward-05-old-bus-stand",  name: "Ward 5 – Old Bus Stand",     nameTa: "வார்டு 5 – பழைய பேருந்து நிலையம்", wardType: "municipal", zoneId: zoneId("central"), pincode: "637408", latitude: 11.4535, longitude: 77.9850 },
    // North Zone
    { slug: "ward-06-salem-road",     name: "Ward 6 – Salem Road",        nameTa: "வார்டு 6 – சேலம் சாலை",       wardType: "municipal", zoneId: zoneId("north"), pincode: "637408", latitude: 11.4630, longitude: 77.9880 },
    { slug: "ward-07-nehru-nagar",    name: "Ward 7 – Nehru Nagar",       nameTa: "வார்டு 7 – நேரு நகர்",         wardType: "municipal", zoneId: zoneId("north"), pincode: "637408", latitude: 11.4650, longitude: 77.9860 },
    { slug: "ward-08-rajaji-nagar",   name: "Ward 8 – Rajaji Nagar",      nameTa: "வார்டு 8 – ராஜாஜி நகர்",       wardType: "municipal", zoneId: zoneId("north"), pincode: "637408", latitude: 11.4670, longitude: 77.9900 },
    { slug: "ward-09-north-ext",      name: "Ward 9 – North Extension",   nameTa: "வார்டு 9 – வடக்கு விரிவு",      wardType: "municipal", zoneId: zoneId("north"), pincode: "637408", latitude: 11.4690, longitude: 77.9870 },
    { slug: "ward-10-kavalar-nagar",  name: "Ward 10 – Kavalar Nagar",    nameTa: "வார்டு 10 – காவலர் நகர்",      wardType: "municipal", zoneId: zoneId("north"), pincode: "637408", latitude: 11.4660, longitude: 77.9920 },
    // East Zone
    { slug: "ward-11-namakkal-road",  name: "Ward 11 – Namakkal Road",    nameTa: "வார்டு 11 – நாமக்கல் சாலை",    wardType: "municipal", zoneId: zoneId("east"), pincode: "637408", latitude: 11.4560, longitude: 77.9960 },
    { slug: "ward-12-mgr-nagar",      name: "Ward 12 – MGR Nagar",        nameTa: "வார்டு 12 – எம்ஜிஆர் நகர்",    wardType: "municipal", zoneId: zoneId("east"), pincode: "637408", latitude: 11.4575, longitude: 77.9980 },
    { slug: "ward-13-east-ext",       name: "Ward 13 – East Extension",   nameTa: "வார்டு 13 – கிழக்கு விரிவு",    wardType: "municipal", zoneId: zoneId("east"), pincode: "637408", latitude: 11.4590, longitude: 78.0000 },
    { slug: "ward-14-kamarajar",      name: "Ward 14 – Kamarajar Nagar",  nameTa: "வார்டு 14 – காமராஜர் நகர்",    wardType: "municipal", zoneId: zoneId("east"), pincode: "637408", latitude: 11.4545, longitude: 77.9970 },
    { slug: "ward-15-tamil-nagar",    name: "Ward 15 – Tamil Nagar",      nameTa: "வார்டு 15 – தமிழ் நகர்",       wardType: "municipal", zoneId: zoneId("east"), pincode: "637408", latitude: 11.4530, longitude: 77.9990 },
    // South Zone
    { slug: "ward-16-tc-road",        name: "Ward 16 – Tiruchengode Rd",  nameTa: "வார்டு 16 – திருச்செங்கோடு சாலை", wardType: "municipal", zoneId: zoneId("south"), pincode: "637408", latitude: 11.4490, longitude: 77.9870 },
    { slug: "ward-17-railway-stn",    name: "Ward 17 – Railway Station",  nameTa: "வார்டு 17 – இரயில் நிலையம்",   wardType: "municipal", zoneId: zoneId("south"), pincode: "637408", latitude: 11.4510, longitude: 77.9850 },
    { slug: "ward-18-south-ext",      name: "Ward 18 – South Extension",  nameTa: "வார்டு 18 – தெற்கு விரிவு",     wardType: "municipal", zoneId: zoneId("south"), pincode: "637408", latitude: 11.4480, longitude: 77.9860 },
    { slug: "ward-19-palam-nagar",    name: "Ward 19 – Palam Nagar",      nameTa: "வார்டு 19 – பாலம் நகர்",       wardType: "municipal", zoneId: zoneId("south"), pincode: "637408", latitude: 11.4465, longitude: 77.9880 },
    { slug: "ward-20-muthu-nagar",    name: "Ward 20 – Muthu Nagar",      nameTa: "வார்டு 20 – முத்து நகர்",       wardType: "municipal", zoneId: zoneId("south"), pincode: "637408", latitude: 11.4500, longitude: 77.9900 },
    // West Zone
    { slug: "ward-21-erode-road",     name: "Ward 21 – Erode Road",       nameTa: "வார்டு 21 – ஈரோடு சாலை",       wardType: "municipal", zoneId: zoneId("west"), pincode: "637408", latitude: 11.4555, longitude: 77.9800 },
    { slug: "ward-22-west-ext",       name: "Ward 22 – West Extension",   nameTa: "வார்டு 22 – மேற்கு விரிவு",     wardType: "municipal", zoneId: zoneId("west"), pincode: "637408", latitude: 11.4540, longitude: 77.9780 },
    { slug: "ward-23-nehru-colony",   name: "Ward 23 – Nehru Colony",     nameTa: "வார்டு 23 – நேரு காலனி",       wardType: "municipal", zoneId: zoneId("west"), pincode: "637408", latitude: 11.4570, longitude: 77.9760 },
    { slug: "ward-24-managiri-rd",    name: "Ward 24 – Managiri Road",    nameTa: "வார்டு 24 – மணகிரி சாலை",      wardType: "municipal", zoneId: zoneId("west"), pincode: "637408", latitude: 11.4520, longitude: 77.9770 },
  ]).onConflictDoNothing();

  // 3) Pincodes — Rasipuram constituency pin codes (Namakkal District).
  await db.insert(pincodesTable).values([
    { code: "637408", label: "Rasipuram town" },
    { code: "637401", label: "Namakkal" },
    { code: "637405", label: "Mohanur" },
    { code: "637406", label: "Sendamangalam" },
    { code: "637013", label: "Tiruchengode" },
    { code: "638052", label: "Erode (border)" },
  ]).onConflictDoNothing();

  console.log("Constituency hierarchy seeded.");

  // Gallery — intentionally left empty. Real photos are uploaded by staff.
  await db.delete(galleryTable);
  await db.insert(galleryTable).values([
    {
      title: "டி. லோகேஷ் தமிழ்செல்வன் – அலுவலக நாள்",
      mediaUrl: "/gallery/logesh_1.jpg",
      thumbnailUrl: "/gallery/logesh_1.jpg",
      mediaType: "photo",
      album: "Official",
      displayOrder: 1,
    },
    {
      title: "மக்கள் சந்திப்பு – ராசிபுரம்",
      mediaUrl: "/gallery/logesh_2.jpg",
      thumbnailUrl: "/gallery/logesh_2.jpg",
      mediaType: "photo",
      album: "Public Meetings",
      displayOrder: 2,
    },
    {
      title: "தொகுதி வலம் – ராசிபுரம் நாடாளுமன்றம்",
      mediaUrl: "/gallery/logesh_3.jpg",
      thumbnailUrl: "/gallery/logesh_3.jpg",
      mediaType: "photo",
      album: "Constituency",
      displayOrder: 3,
    },
    {
      title: "மக்கள் நல திட்டம் – ராசிபுரம்",
      mediaUrl: "/gallery/logesh_4.jpg",
      thumbnailUrl: "/gallery/logesh_4.jpg",
      mediaType: "photo",
      album: "Welfare",
      displayOrder: 4,
    },
    {
      title: "இளைஞர் கூட்டம் – TVK",
      mediaUrl: "/gallery/logesh_5.jpg",
      thumbnailUrl: "/gallery/logesh_5.jpg",
      mediaType: "photo",
      album: "Events",
      displayOrder: 5,
    },
  ]);

  // FAQs
  await db.insert(faqsTable).values([
    {
      question: "How do I submit a grievance to D. Logesh Tamilselvan's office?",
      questionTa: "டி. லோகேஷ் தமிழ்செல்வனின் அலுவலகத்திற்கு புகார் எப்படி அனுப்புவது?",
      answer: "You can submit a grievance through the Grievance Portal on this website. Fill in your name, contact number, category, and description of the issue. You will receive a unique ticket number to track the status of your complaint.",
      answerTa: "இந்த வலைத்தளத்தில் உள்ள புகார் மையம் மூலம் புகார் அனுப்பலாம். பெயர், தொலைபேசி, வகை மற்றும் பிரச்சினையின் விவரங்களை பூர்த்தி செய்யுங்கள். உங்கள் புகாரின் நிலையை கண்காணிக்க தனித்துவமான புகார் எண் கிடைக்கும்.",
      order: 1,
    },
    {
      question: "What are the office hours for D. Logesh Tamilselvan's constituency office?",
      questionTa: "டி. லோகேஷ் தமிழ்செல்வனின் தொகுதி அலுவலகம் எப்போது திறந்திருக்கும்?",
      answer: "The constituency office is open Monday to Saturday, 9:00 AM to 6:00 PM. The office is closed on Sundays and public holidays.",
      answerTa: "தொகுதி அலுவலகம் திங்கள் முதல் சனி வரை, காலை 9:00 மணி முதல் மாலை 6:00 மணி வரை திறந்திருக்கும். ஞாயிறுகள் மற்றும் பொது விடுமுறை நாட்களில் மூடல்.",
      order: 2,
    },
    {
      question: "How can I become a volunteer for TVK in Rasipuram?",
      questionTa: "ராசிபுரத்தில் TVK தன்னார்வலராக எப்படி இணைவது?",
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
