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
  tasksTable,
  appointmentsTable,
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
    nameEn: "V.K. Rajeev",
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
  },
};

async function seed() {
  const TENANT = process.env.TENANT ?? "logesh";
  const leaderCfg = TENANT_CONFIGS[TENANT] ?? TENANT_CONFIGS["logesh"];
  console.log(`Seeding database for tenant: ${TENANT}`);

  // Users
  await db.insert(usersTable).values([
    {
      email: "admin@ungalrajeev.in",
      name: "Admin User",
      passwordHash: hashPassword("Admin@2026"),
      role: "super_admin",
      isActive: "true",
    },
    {
      email: "minister@ungalrajeev.in",
      name: "V.K. Rajeev",
      passwordHash: hashPassword("Minister@2026"),
      role: "minister",
      isActive: "true",
    },
    {
      email: "pa@ungalrajeev.in",
      name: "PA Staff",
      passwordHash: hashPassword("PaStaff@2026"),
      role: "pa_staff",
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
      title: "V.K. Rajeev Launches Solar-Powered Street Lighting in Thiruvadanai",
      titleTa: "திருவடனையில் சூரிய சக்தி தெரு விளக்கு திட்டம் – வி.கே. ராஜீவ் தொடக்கம்",
      content: "V.K. Rajeev, Minister for Environment & Climate Change and MLA of Thiruvadanai, launched a solar-powered street lighting project covering 12 villages in the constituency. The initiative replaces 800 conventional bulbs with LED solar lamps, reducing carbon emissions and electricity costs.",
      contentTa: "சுற்றுச்சூழல் மற்றும் காலநிலை மாற்றம் அமைச்சர் வி.கே. ராஜீவ் திருவடனை தொகுதியில் 12 கிராமங்களை உள்ளடக்கிய சூரிய சக்தி தெரு விளக்கு திட்டத்தை தொடக்கி வைத்தார். 800 பழைய விளக்குகளை LED சூரிய விளக்குகளாக மாற்றும் இந்த திட்டம் மின் செலவை குறைக்கும்.",
      category: "development",
      featured: true,
      publishedAt: new Date("2025-04-15"),
    },
    {
      title: "Free Medical Camp Provides Treatment to 5,000 Residents in Thiruvadanai",
      titleTa: "திருவடனையில் 5,000 மக்களுக்கு இலவச மருத்துவ முகாம்",
      content: "A mega free medical camp was organized by V.K. Rajeev's office in collaboration with government hospitals in Thiruvadanai. Over 5,000 residents received free consultation, medicines, and diagnostic tests.",
      contentTa: "வி.கே. ராஜீவின் அலுவலகம் திருவடனை அரசு மருத்துவமனைகளுடன் இணைந்து மெகா இலவச மருத்துவ முகாம் ஏற்பாடு செய்தது. 5,000க்கும் மேற்பட்ட மக்கள் இலவச ஆலோசனை, மருந்துகள் பெற்றனர்.",
      category: "welfare",
      featured: true,
      publishedAt: new Date("2025-03-20"),
    },
    {
      title: "Mangrove Restoration Drive Covers 200 Acres in Thiruvadanai Coast",
      titleTa: "திருவடனை கடற்கரையில் 200 ஏக்கர் சதுப்பு நிலம் மறுவாழ்வு",
      content: "Under the leadership of Minister V.K. Rajeev, a massive mangrove restoration drive was launched along the Thiruvadanai coastline. 200 acres of degraded coastal land were replanted with native mangrove species, protecting fishing communities from erosion and cyclones.",
      contentTa: "அமைச்சர் வி.கே. ராஜீவின் தலைமையில் திருவடனை கடற்கரையில் சதுப்பு நில மறுவாழ்வு பணிகள் தொடங்கப்பட்டன. 200 ஏக்கர் சிதிலமடைந்த கடற்கரை நிலத்தில் உள்ளூர் சதுப்பு நில மரங்கள் நடப்பட்டன.",
      category: "development",
      featured: true,
      publishedAt: new Date("2025-02-10"),
    },
    {
      title: "20 Government Schools Receive Infrastructure Upgrade in Thiruvadanai",
      titleTa: "திருவடனையில் 20 அரசு பள்ளிகளில் கட்டமைப்பு மேம்பாடு",
      content: "Under the constituency development fund, 20 government schools in Thiruvadanai received new classrooms, toilets, and digital equipment, improving learning conditions for over 10,000 students.",
      contentTa: "தொகுதி வளர்ச்சி நிதியின் கீழ், திருவடனையில் 20 அரசு பள்ளிகளுக்கு புதிய வகுப்பறைகள், கழிப்பறைகள் மற்றும் டிஜிட்டல் உபகரணங்கள் வழங்கப்பட்டன.",
      category: "education",
      featured: false,
      publishedAt: new Date("2025-01-25"),
    },
    {
      title: "Drinking Water Pipeline Project Completed in Thiruvadanai",
      titleTa: "திருவடனையில் குடிநீர் குழாய் திட்டம் நிறைவு",
      content: "A new drinking water pipeline project covering Thiruvadanai block has been completed, bringing clean piped water to over 8,000 households and resolving a decade-long water scarcity problem in the region.",
      contentTa: "திருவடனை வட்டாரத்தை உள்ளடக்கிய புதிய குடிநீர் குழாய் திட்டம் நிறைவடைந்தது. 8,000க்கும் மேற்பட்ட குடும்பங்களுக்கு சுத்தமான குழாய் நீர் வழங்கப்படுகிறது.",
      category: "development",
      featured: false,
      publishedAt: new Date("2024-12-15"),
    },
    {
      title: "Organic Farming Training Centre Inaugurated in Thiruvadanai",
      titleTa: "திருவடனையில் இயற்கை வேளாண்மை பயிற்சி மையம் திறப்பு",
      content: "A new organic farming training centre was inaugurated in Thiruvadanai, offering training in sustainable agriculture, composting, and natural pest management. The centre will benefit 500 farmers annually from the constituency.",
      contentTa: "திருவடனையில் இயற்கை வேளாண்மை பயிற்சி மையம் திறக்கப்பட்டது. நிலையான விவசாயம், உரம் தயாரிப்பு மற்றும் இயற்கை பூச்சி மேலாண்மையில் பயிற்சி வழங்கப்படும்.",
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
      description: "Monthly public hearing where residents can directly present their issues to V.K. Rajeev. All are welcome. No appointment needed.",
      descriptionTa: "மாதாந்திர பொது விசாரணை - மக்கள் நேரடியாக வி.கே. ராஜீவிடம் தங்கள் பிரச்சினைகளை தெரிவிக்கலாம்.",
      venue: "Town Panchayat Hall, Thiruvadanai",
      eventDate: futureDate1,
      category: "public-hearing",
    },
    {
      title: "Free Legal Aid Camp",
      titleTa: "இலவச சட்ட உதவி முகாம்",
      description: "A free legal aid camp organized in collaboration with the Tamil Nadu Bar Association. Residents can seek legal advice on property, family, and labour matters.",
      descriptionTa: "தமிழ்நாடு வக்கீல் சங்கத்துடன் இணைந்து ஏற்பாடு செய்யப்பட்ட இலவச சட்ட உதவி முகாம்.",
      venue: "Community Hall, Thiruvadanai",
      eventDate: futureDate2,
      category: "welfare",
    },
    {
      title: "Youth Sports Tournament 2025",
      titleTa: "இளைஞர் விளையாட்டு போட்டி 2025",
      description: "Inter-panchayat youth sports tournament covering cricket, volleyball, and kabaddi. Open to all youth aged 15–30 from Thiruvadanai constituency.",
      descriptionTa: "கிரிக்கெட், கைப்பந்து மற்றும் கபடி உள்ளடக்கிய பஞ்சாயத்து அளவிலான இளைஞர் விளையாட்டு போட்டி.",
      venue: "Government School Ground, Thiruvadanai",
      eventDate: futureDate3,
      category: "sports",
    },
    {
      title: "Coastal Clean-Up & Tree Plantation Drive – Green Thiruvadanai",
      titleTa: "கடற்கரை சுத்திகரிப்பு & மர நடவடிக்கை – பசுமை திருவடனை",
      description: "V.K. Rajeev led a constituency-wide coastal clean-up and tree plantation drive with volunteers. Over 2,000 saplings were planted and 5 km of coastline cleaned.",
      descriptionTa: "வி.கே. ராஜீவ் தன்னார்வலர்களுடன் கடற்கரை சுத்திகரிப்பு மற்றும் மர நடவடிக்கையை நடத்தினார். 2,000 மரக்கன்றுகள் நடப்பட்டன; 5 கி.மீ. கடற்கரை சுத்தம் செய்யப்பட்டது.",
      venue: "Thiruvadanai Coastline",
      eventDate: pastDate1,
      category: "environment",
    },
  ]).onConflictDoNothing();

  // Activities
  const today = new Date();
  await db.insert(activitiesTable).values([
    {
      title: "Met with fishermen of Thiruvadanai on coastal erosion issues",
      titleTa: "திருவடனை மீனவர்களை சந்தித்தல் – கடற்கரை அரிப்பு பிரச்சினை",
      description: "Held a direct consultation with fishing community leaders in Thiruvadanai regarding coastal erosion and sea-wall repair. Action plan submitted to Public Works Department.",
      activityDate: new Date(today.getTime() - 1 * 86400000),
      location: "Thiruvadanai",
      category: "constituency-work",
    },
    {
      title: "Distributed welfare assistance to fishermen families",
      titleTa: "மீனவ குடும்பங்களுக்கு நலன் உதவி வழங்கல்",
      description: "Financial assistance and welfare kits were distributed to 60 fishing families in Thiruvadanai under state welfare schemes.",
      activityDate: new Date(today.getTime() - 3 * 86400000),
      location: "Thiruvadanai",
      category: "welfare",
    },
    {
      title: "Attended Tamil Nadu Legislative Assembly session",
      titleTa: "தமிழ்நாடு சட்டமன்ற கூட்டத்தொடரில் கலந்துகொண்டார்",
      description: "Represented Thiruvadanai constituency in the assembly session. Raised issues related to Ramanathapuram district infrastructure and environmental protection.",
      activityDate: new Date(today.getTime() - 5 * 86400000),
      location: "Tamil Nadu Legislative Assembly, Chennai",
      category: "assembly",
    },
    {
      title: "Distributed school kits to 250 students",
      titleTa: "250 மாணவர்களுக்கு பள்ளி பைகள் வழங்கல்",
      description: "School bags, notebooks, and stationery were distributed to 250 students from economically weaker sections in Thiruvadanai government schools.",
      activityDate: new Date(today.getTime() - 7 * 86400000),
      location: "Govt. School, Thiruvadanai",
      category: "education",
    },
    {
      title: "Reviewed progress of constituency road projects",
      titleTa: "தொகுதி சாலை திட்டங்களின் முன்னேற்றம் ஆய்வு",
      description: "Conducted a field inspection of ongoing road construction works across 6 panchayats in Thiruvadanai to ensure quality and timely completion.",
      activityDate: new Date(today.getTime() - 10 * 86400000),
      location: "Various Panchayats, Thiruvadanai",
      category: "development",
    },
    {
      title: "Public meeting on TVK party activities",
      titleTa: "TVK கட்சி நடவடிக்கைகள் பற்றிய பொது கூட்டம்",
      description: "Chaired a TVK party coordination meeting to plan upcoming constituency outreach programs and volunteer drives in Thiruvadanai.",
      activityDate: new Date(today.getTime() - 12 * 86400000),
      location: "TVK Office, Thiruvadanai",
      category: "party",
    },
  ]).onConflictDoNothing();

  // ── Constituency hierarchy ──────────────────────────────
  // Thiruvadanai constituency (AC 216), Ramanathapuram District.
  // Clean up any old data from previous constituency before inserting fresh.
  await db.delete(pincodeWardsTable);
  await db.delete(pollingStationsTable);
  await db.delete(wardsTable);
  await db.delete(pincodesTable);
  await db.delete(zonesTable);

  // 1) Zones — Thiruvadanai Panchayat Union zones
  await db.insert(zonesTable).values([
    { slug: "central", name: "Central Zone",  nameTa: "மத்திய மண்டலம்",  type: "panchayat", description: "Central zone covering Thiruvadanai town and surrounding panchayats" },
    { slug: "north",   name: "North Zone",    nameTa: "வடக்கு மண்டலம்",  type: "panchayat", description: "Northern zone toward Mandapam and Pamban bridge area" },
    { slug: "east",    name: "East Zone",     nameTa: "கிழக்கு மண்டலம்", type: "panchayat", description: "Eastern coastal zone toward Kilakarai and Gulf of Mannar" },
    { slug: "south",   name: "South Zone",    nameTa: "தெற்கு மண்டலம்",  type: "panchayat", description: "Southern zone toward Sayalkudi and inland villages" },
    { slug: "west",    name: "West Zone",     nameTa: "மேற்கு மண்டலம்",  type: "panchayat", description: "Western zone toward Kanjirangudi and Ramanathapuram" },
  ]);

  const zoneRows = await db.select({ id: zonesTable.id, slug: zonesTable.slug }).from(zonesTable);
  const zoneId = (slug: string) => zoneRows.find((z) => z.slug === slug)?.id ?? null;

  // 2) Panchayat wards of Thiruvadanai constituency with bilingual names and GPS centroids.
  await db.insert(wardsTable).values([
    // Central Zone
    { slug: "ward-01-thiruvadanai-town",   name: "Ward 1 – Thiruvadanai Town",    nameTa: "வார்டு 1 – திருவடனை நகர்",        wardType: "panchayat", zoneId: zoneId("central"), pincode: "623534", latitude: 9.3700, longitude: 78.5200 },
    { slug: "ward-02-thiruvadanai-north",  name: "Ward 2 – Thiruvadanai North",   nameTa: "வார்டு 2 – திருவடனை வடக்கு",      wardType: "panchayat", zoneId: zoneId("central"), pincode: "623534", latitude: 9.3780, longitude: 78.5220 },
    { slug: "ward-03-melamarungoor",       name: "Ward 3 – Melamarungoor",        nameTa: "வார்டு 3 – மேலமருங்கூர்",          wardType: "panchayat", zoneId: zoneId("central"), pincode: "623534", latitude: 9.3650, longitude: 78.5150 },
    { slug: "ward-04-keelamarungoor",      name: "Ward 4 – Keelamarungoor",       nameTa: "வார்டு 4 – கீழமருங்கூர்",          wardType: "panchayat", zoneId: zoneId("central"), pincode: "623534", latitude: 9.3620, longitude: 78.5100 },
    { slug: "ward-05-thiruvadanai-south",  name: "Ward 5 – Thiruvadanai South",   nameTa: "வார்டு 5 – திருவடனை தெற்கு",      wardType: "panchayat", zoneId: zoneId("central"), pincode: "623534", latitude: 9.3600, longitude: 78.5180 },
    // North Zone
    { slug: "ward-06-mandapam",            name: "Ward 6 – Mandapam",             nameTa: "வார்டு 6 – மண்டபம்",               wardType: "panchayat", zoneId: zoneId("north"), pincode: "623526", latitude: 9.2820, longitude: 79.1200 },
    { slug: "ward-07-pamban",              name: "Ward 7 – Pamban",               nameTa: "வார்டு 7 – பாம்பன்",               wardType: "panchayat", zoneId: zoneId("north"), pincode: "623528", latitude: 9.2780, longitude: 79.2100 },
    { slug: "ward-08-agasthiyarpattinam",  name: "Ward 8 – Agasthiyarpattinam",   nameTa: "வார்டு 8 – அகஸ்தியர்பட்டினம்",    wardType: "panchayat", zoneId: zoneId("north"), pincode: "623526", latitude: 9.3000, longitude: 79.0800 },
    { slug: "ward-09-uchippuli",           name: "Ward 9 – Uchippuli",            nameTa: "வார்டு 9 – உச்சிப்புலி",           wardType: "panchayat", zoneId: zoneId("north"), pincode: "623526", latitude: 9.3500, longitude: 79.0500 },
    { slug: "ward-10-north-coastal",       name: "Ward 10 – North Coastal",       nameTa: "வார்டு 10 – வடக்கு கடற்கரை",       wardType: "panchayat", zoneId: zoneId("north"), pincode: "623526", latitude: 9.3200, longitude: 79.1000 },
    // East Zone
    { slug: "ward-11-kilakarai",           name: "Ward 11 – Kilakarai",           nameTa: "வார்டு 11 – கீழக்கரை",             wardType: "panchayat", zoneId: zoneId("east"), pincode: "623540", latitude: 9.2310, longitude: 78.7780 },
    { slug: "ward-12-ervadi",              name: "Ward 12 – Ervadi",              nameTa: "வார்டு 12 – ஏர்வாடி",              wardType: "panchayat", zoneId: zoneId("east"), pincode: "623540", latitude: 9.2600, longitude: 78.7400 },
    { slug: "ward-13-muthupettai",         name: "Ward 13 – Muthupettai",         nameTa: "வார்டு 13 – முத்துப்பேட்டை",       wardType: "panchayat", zoneId: zoneId("east"), pincode: "623534", latitude: 9.3400, longitude: 78.5800 },
    { slug: "ward-14-east-coastal",        name: "Ward 14 – East Coastal",        nameTa: "வார்டு 14 – கிழக்கு கடற்கரை",      wardType: "panchayat", zoneId: zoneId("east"), pincode: "623540", latitude: 9.2800, longitude: 78.8200 },
    { slug: "ward-15-mimisal",             name: "Ward 15 – Mimisal",             nameTa: "வார்டு 15 – மிமிசல்",              wardType: "panchayat", zoneId: zoneId("east"), pincode: "623534", latitude: 9.3100, longitude: 78.6200 },
    // South Zone
    { slug: "ward-16-sayalkudi",           name: "Ward 16 – Sayalkudi",           nameTa: "வார்டு 16 – சாயல்குடி",            wardType: "panchayat", zoneId: zoneId("south"), pincode: "623554", latitude: 9.1700, longitude: 78.4800 },
    { slug: "ward-17-south-villages",      name: "Ward 17 – South Villages",      nameTa: "வார்டு 17 – தெற்கு கிராமங்கள்",    wardType: "panchayat", zoneId: zoneId("south"), pincode: "623554", latitude: 9.1500, longitude: 78.5000 },
    { slug: "ward-18-south-ext",           name: "Ward 18 – South Extension",     nameTa: "வார்டு 18 – தெற்கு விரிவு",         wardType: "panchayat", zoneId: zoneId("south"), pincode: "623554", latitude: 9.2000, longitude: 78.4600 },
    { slug: "ward-19-palliyadi",           name: "Ward 19 – Palliyadi",           nameTa: "வார்டு 19 – பள்ளியடி",             wardType: "panchayat", zoneId: zoneId("south"), pincode: "623554", latitude: 9.2200, longitude: 78.4900 },
    { slug: "ward-20-periyapattinam",      name: "Ward 20 – Periyapattinam",      nameTa: "வார்டு 20 – பெரியபட்டினம்",        wardType: "panchayat", zoneId: zoneId("south"), pincode: "623560", latitude: 9.2400, longitude: 78.4400 },
    // West Zone
    { slug: "ward-21-kanjirangudi",        name: "Ward 21 – Kanjirangudi",        nameTa: "வார்டு 21 – காஞ்சிரங்குடி",        wardType: "panchayat", zoneId: zoneId("west"), pincode: "623553", latitude: 9.4200, longitude: 78.4500 },
    { slug: "ward-22-ramanathapuram",      name: "Ward 22 – Ramanathapuram",      nameTa: "வார்டு 22 – இராமநாதபுரம்",         wardType: "panchayat", zoneId: zoneId("west"), pincode: "623501", latitude: 9.3710, longitude: 78.8300 },
    { slug: "ward-23-mudukulathur",        name: "Ward 23 – Mudukulathur",        nameTa: "வார்டு 23 – முதுகுளத்தூர்",        wardType: "panchayat", zoneId: zoneId("west"), pincode: "623704", latitude: 9.3400, longitude: 78.5100 },
    { slug: "ward-24-west-villages",       name: "Ward 24 – West Villages",       nameTa: "வார்டு 24 – மேற்கு கிராமங்கள்",    wardType: "panchayat", zoneId: zoneId("west"), pincode: "623553", latitude: 9.4000, longitude: 78.4700 },
  ]);

  // 3) Pincodes — Thiruvadanai constituency pin codes (Ramanathapuram District).
  await db.insert(pincodesTable).values([
    { code: "623534", label: "Thiruvadanai" },
    { code: "623526", label: "Mandapam" },
    { code: "623528", label: "Pamban" },
    { code: "623540", label: "Kilakarai" },
    { code: "623553", label: "Kanjirangudi" },
    { code: "623554", label: "Sayalkudi" },
    { code: "623501", label: "Ramanathapuram" },
    { code: "623519", label: "Rameswaram" },
    { code: "623560", label: "Periyapattinam" },
    { code: "623704", label: "Mudukulathur" },
  ]);

  console.log("Constituency hierarchy seeded.");

  // Gallery — intentionally left empty. Real photos are uploaded by staff.
  await db.delete(galleryTable);
  await db.insert(galleryTable).values([
    {
      title: "வி.கே. ராஜீவ் – அலுவலக நாள்",
      mediaUrl: "/gallery/rajeev_1.jpg",
      thumbnailUrl: "/gallery/rajeev_1.jpg",
      mediaType: "photo",
      album: "Official",
      displayOrder: 1,
    },
    {
      title: "மக்கள் சந்திப்பு – திருவடனை",
      mediaUrl: "/gallery/rajeev_2.jpg",
      thumbnailUrl: "/gallery/rajeev_2.jpg",
      mediaType: "photo",
      album: "Public Meetings",
      displayOrder: 2,
    },
    {
      title: "தொகுதி வலம் – திருவடனை",
      mediaUrl: "/gallery/rajeev_3.jpg",
      thumbnailUrl: "/gallery/rajeev_3.jpg",
      mediaType: "photo",
      album: "Constituency",
      displayOrder: 3,
    },
    {
      title: "சதுப்பு நில மறுவாழ்வு திட்டம் – திருவடனை கடற்கரை",
      mediaUrl: "/gallery/rajeev_4.jpg",
      thumbnailUrl: "/gallery/rajeev_4.jpg",
      mediaType: "photo",
      album: "Environment",
      displayOrder: 4,
    },
    {
      title: "இளைஞர் கூட்டம் – TVK",
      mediaUrl: "/gallery/rajeev_5.jpg",
      thumbnailUrl: "/gallery/rajeev_5.jpg",
      mediaType: "photo",
      album: "Events",
      displayOrder: 5,
    },
  ]);

  // FAQs
  await db.insert(faqsTable).values([
    {
      question: "How do I submit a grievance to V.K. Rajeev's office?",
      questionTa: "வி.கே. ராஜீவின் அலுவலகத்திற்கு புகார் எப்படி அனுப்புவது?",
      answer: "You can submit a grievance through the Grievance Portal on this website. Fill in your name, contact number, category, and description of the issue. You will receive a unique ticket number to track the status of your complaint.",
      answerTa: "இந்த வலைத்தளத்தில் உள்ள புகார் மையம் மூலம் புகார் அனுப்பலாம். பெயர், தொலைபேசி, வகை மற்றும் பிரச்சினையின் விவரங்களை பூர்த்தி செய்யுங்கள். உங்கள் புகாரின் நிலையை கண்காணிக்க தனித்துவமான புகார் எண் கிடைக்கும்.",
      order: 1,
    },
    {
      question: "What are the office hours for V.K. Rajeev's constituency office?",
      questionTa: "வி.கே. ராஜீவின் தொகுதி அலுவலகம் எப்போது திறந்திருக்கும்?",
      answer: "The constituency office is open Monday to Saturday, 9:00 AM to 6:00 PM. The office is closed on Sundays and public holidays.",
      answerTa: "தொகுதி அலுவலகம் திங்கள் முதல் சனி வரை, காலை 9:00 மணி முதல் மாலை 6:00 மணி வரை திறந்திருக்கும். ஞாயிறுகள் மற்றும் பொது விடுமுறை நாட்களில் மூடல்.",
      order: 2,
    },
    {
      question: "How can I become a volunteer for TVK in Thiruvadanai?",
      questionTa: "திருவடனையில் TVK தன்னார்வலராக எப்படி இணைவது?",
      answer: "Visit the Volunteer page on this website and fill out the registration form with your details. Our team will contact you to guide you through the process.",
      answerTa: "இந்த வலைத்தளத்தில் உள்ள தன்னார்வலர் பக்கத்திற்கு சென்று பதிவு படிவத்தை நிரப்புங்கள். நாங்கள் உங்களை தொடர்பு கொண்டு மேலும் வழிகாட்டுவோம்.",
      order: 3,
    },
    {
      question: "Which welfare schemes can I apply for through this office?",
      questionTa: "இந்த அலுவலகம் மூலம் எந்த நலத் திட்டங்களுக்கு விண்ணப்பிக்கலாம்?",
      answer: "The office assists with Environment protection schemes, Old Age Pension, Education Scholarships, Housing Schemes (PMAY), MGNREGS, Fishermen welfare, and other central and state government welfare schemes. Visit the office with your documents for assistance.",
      answerTa: "சுற்றுச்சூழல் பாதுகாப்பு திட்டங்கள், முதியோர் ஓய்வூதியம், கல்வி உதவித்தொகை, வீட்டுவசதி திட்டம் (PMAY), MGNREGS, மீனவர் நல திட்டங்கள் மற்றும் பிற மத்திய மாநில அரசு நலத் திட்டங்களுக்கு உதவி வழங்கப்படுகிறது.",
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
    {
      question: "How can I report an environmental issue in Thiruvadanai?",
      questionTa: "திருவடனையில் சுற்றுச்சூழல் பிரச்சினையை எப்படி தெரிவிப்பது?",
      answer: "Use the Grievance Portal and select 'Environment' as the category. Describe the issue — whether it is illegal dumping, water pollution, tree felling, or coastal erosion — and submit with your location details. Our team will act promptly.",
      answerTa: "புகார் மையத்தில் 'சுற்றுச்சூழல்' என்ற வகையை தேர்ந்தெடுத்து பிரச்சினையை விவரிக்கவும் — சட்டவிரோத குப்பை கொட்டல், நீர் மாசுபாடு, மரம் வெட்டல் அல்லது கடற்கரை அரிப்பு என எதுவாக இருந்தாலும். இடத்தின் விவரங்களுடன் சமர்ப்பிக்கவும்.",
      order: 7,
    },
  ]).onConflictDoNothing();

  // Tasks (internal team to-do) — assigned to the seed admin user.
  const [adminUser] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.email, "admin@ungalrajeev.in"));

  if (adminUser) {
    const day = (offset: number) => {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() + offset);
      return d;
    };
    await db.insert(tasksTable).values([
      {
        title: "Review pending grievances from Thiruvadanai ward",
        description: "Go through escalated grievances and assign officers.",
        dueDate: day(-1), dueTime: "10:00", priority: "high", status: "todo",
        category: "grievance_action", assignedTo: adminUser.id, createdBy: adminUser.id,
      },
      {
        title: "Prepare brief for mangrove plantation drive",
        description: "Talking points and guest list for the coastal plantation event.",
        dueDate: day(0), dueTime: "09:30", priority: "high", status: "in_progress",
        category: "visit_prep", assignedTo: adminUser.id, createdBy: adminUser.id,
      },
      {
        title: "Approve press release on solar energy project",
        dueDate: day(0), priority: "medium", status: "todo",
        category: "content", assignedTo: adminUser.id, createdBy: adminUser.id,
      },
      {
        title: "Follow up with PWD on coastal road repair status",
        dueDate: day(2), dueTime: "15:00", priority: "medium", status: "todo",
        category: "follow_up", assignedTo: adminUser.id, createdBy: adminUser.id,
      },
      {
        title: "Confirm attendance for Ramanathapuram district coordination meeting",
        dueDate: day(4), priority: "low", status: "todo",
        category: "official", assignedTo: adminUser.id, createdBy: adminUser.id,
      },
      {
        title: "Sign fishermen welfare scheme approval documents",
        dueDate: day(-3), priority: "high", status: "done",
        category: "official", assignedTo: adminUser.id, createdBy: adminUser.id,
        completedAt: day(-3),
      },
    ]).onConflictDoNothing();

    const year = new Date().getFullYear();
    await db.insert(appointmentsTable).values([
      {
        ticketNo: `APT-${year}-0001`,
        name: "Ramesh Kumar", phone: "9840012345", email: "ramesh@example.com",
        ward: "Ward 1 – Thiruvadanai Town", address: "Thiruvadanai Town, Ramanathapuram",
        category: "Constituency Meeting", subject: "Road repair request for our street",
        description: "Our street has had potholes for months. Requesting a meeting to discuss repair work.",
        partySize: 3, preferredDate: day(-2), preferredTime: "10:00",
        status: "Approved", scheduledDate: day(0), scheduledTime: "11:00",
        location: "MLA Office, Thiruvadanai", decisionNote: "Confirmed. Please arrive 10 mins early.",
        notificationMessage: "Your appointment is confirmed for today at 11:00 AM at the MLA Office.",
        handledBy: adminUser.id, handledByName: "Admin",
      },
      {
        ticketNo: `APT-${year}-0002`,
        name: "Lakshmi Narayanan", phone: "9790054321", email: null,
        ward: "Ward 6 – Mandapam", address: "Mandapam, Ramanathapuram",
        category: "Grievance Hearing", subject: "Drinking water supply issue follow-up",
        description: "Following up on water grievance submitted last week.",
        partySize: 1, preferredDate: day(0), preferredTime: "14:30",
        status: "Approved", scheduledDate: day(0), scheduledTime: "15:00",
        location: "MLA Office, Thiruvadanai",
        notificationMessage: "Approved for today 3:00 PM.",
        handledBy: adminUser.id, handledByName: "Admin",
      },
      {
        ticketNo: `APT-${year}-0003`,
        name: "Anand Selvam", phone: "9551098765", email: "anand.s@example.com",
        ward: "Ward 11 – Kilakarai", address: "Kilakarai, Ramanathapuram",
        category: "Official Visit", subject: "Inauguration invitation for fishing harbour improvement",
        description: "Requesting the Minister to inaugurate our newly upgraded fishing harbour facilities.",
        partySize: 5, preferredDate: day(2), preferredTime: "17:00",
        status: "Pending",
      },
      {
        ticketNo: `APT-${year}-0004`,
        name: "Priya Dharshini", phone: "9445567890", email: null,
        ward: "Ward 3 – Melamarungoor", address: "Melamarungoor, Thiruvadanai",
        category: "General", subject: "Scholarship guidance for students",
        description: "Group of students seeking guidance on government scholarships.",
        partySize: 8, preferredDate: day(3), preferredTime: "11:00",
        status: "Pending",
      },
      {
        ticketNo: `APT-${year}-0005`,
        name: "Mohammed Irfan", phone: "9362011223", email: "irfan@example.com",
        ward: "Ward 16 – Sayalkudi", address: "Sayalkudi, Ramanathapuram",
        category: "Media", subject: "Interview request on coastal environment schemes",
        description: "Local news channel requesting a short interview on mangrove restoration.",
        partySize: 2, preferredDate: day(1), preferredTime: "16:00",
        status: "Rescheduled", scheduledDate: day(4), scheduledTime: "10:30",
        location: "MLA Office, Thiruvadanai", decisionNote: "Rescheduled due to prior engagement.",
        notificationMessage: "Your interview has been rescheduled. New slot: see confirmed schedule.",
        handledBy: adminUser.id, handledByName: "Admin",
      },
      {
        ticketNo: `APT-${year}-0006`,
        name: "Geetha Raman", phone: "9698034567", email: null,
        ward: "Ward 9 – Uchippuli", address: "Uchippuli, Ramanathapuram",
        category: "Constituency Meeting", subject: "Solar streetlight installation",
        partySize: 4, preferredDate: day(-5), preferredTime: "09:00",
        status: "Completed", scheduledDate: day(-4), scheduledTime: "09:30",
        location: "MLA Office, Thiruvadanai", decisionNote: "Meeting held; work order issued.",
        handledBy: adminUser.id, handledByName: "Admin", completedAt: day(-4),
      },
      {
        ticketNo: `APT-${year}-0007`,
        name: "Suresh Babu", phone: "9123045678", email: null,
        ward: "Ward 21 – Kanjirangudi", address: "Kanjirangudi, Ramanathapuram",
        category: "General", subject: "Personal financial assistance request",
        description: "Request that falls outside constituency office scope.",
        partySize: 1, preferredDate: day(-1), preferredTime: "12:00",
        status: "Rejected", rejectionReason: "This request should be routed to the district welfare office.",
        notificationMessage: "Unable to schedule. Please contact the district welfare office.",
        handledBy: adminUser.id, handledByName: "Admin",
      },
    ]).onConflictDoNothing();
  }

  console.log("Database seeded successfully!");
}

seed().then(() => process.exit(0)).catch((err) => {
  console.error("Seed error:", err);
  process.exit(1);
});
