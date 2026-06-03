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
    photoUrl: "/logesh_profile.jpg",
    siteTitle: "Ungaludan Sarath",
    logoInitial: "S",
    districtEn: "Chengalpattu",
    districtTa: "செங்கல்பட்டு",
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
    {
      email: "minister@logeshconnect.in",
      name: "D. Sarath Kumar",
      passwordHash: hashPassword("Minister@2026"),
      role: "minister",
      isActive: "true",
    },
    {
      email: "pa@logeshconnect.in",
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
      title: "New Flyover Inaugurated at Tambaram Junction",
      titleTa: "தாம்பரம் சந்திப்பில் புதிய மேம்பாலம் திறப்பு",
      content: "D. Sarath Kumar, Minister for Human Resources Management and Ex-Servicemen Welfare, inaugurated a new flyover at Tambaram Junction, easing traffic congestion for thousands of daily commuters. The project was funded under the state urban infrastructure scheme.",
      contentTa: "மனித வள மேலாண்மை மற்றும் முன்னாள் இராணுவ வீரர் நலன் அமைச்சர் D. சரத் குமார் தாம்பரம் சந்திப்பில் புதிய மேம்பாலம் திறந்து வைத்தார். இந்த திட்டம் மாநில நகர்புற உள்கட்டமைப்பு திட்டத்தின் கீழ் நிதியளிக்கப்பட்டது.",
      category: "development",
      featured: true,
      publishedAt: new Date("2025-04-15"),
    },
    {
      title: "Free Medical Camp Provides Treatment to 5,000 Residents in Tambaram",
      titleTa: "தாம்பரத்தில் 5,000 மக்களுக்கு இலவச மருத்துவ முகாம்",
      content: "A mega free medical camp was organized by D. Sarath Kumar's office in collaboration with government hospitals in Tambaram. Over 5,000 residents received free consultation, medicines, and diagnostic tests.",
      contentTa: "D. சரத் குமாரின் அலுவலகம் தாம்பரம் அரசு மருத்துவமனைகளுடன் இணைந்து மெகா இலவச மருத்துவ முகாம் ஏற்பாடு செய்தது. 5,000க்கும் மேற்பட்ட மக்கள் இலவச ஆலோசனை, மருந்துகள் பெற்றனர்.",
      category: "welfare",
      featured: true,
      publishedAt: new Date("2025-03-20"),
    },
    {
      title: "Ex-Servicemen Welfare Assistance Distributed in Tambaram",
      titleTa: "தாம்பரத்தில் முன்னாள் இராணுவ வீரர்களுக்கு நலன் உதவி வழங்கல்",
      content: "D. Sarath Kumar distributed financial assistance and welfare certificates to 250 ex-servicemen and their families in Tambaram constituency. The initiative aims to honour veterans and support their livelihoods.",
      contentTa: "D. சரத் குமார் தாம்பரம் தொகுதியில் 250 முன்னாள் இராணுவ வீரர்களுக்கும் அவர்களின் குடும்பங்களுக்கும் நிதி உதவி மற்றும் நலன் சான்றிதழ்கள் வழங்கினார்.",
      category: "welfare",
      featured: true,
      publishedAt: new Date("2025-02-10"),
    },
    {
      title: "20 Government Schools Receive Infrastructure Upgrade in Tambaram",
      titleTa: "தாம்பரத்தில் 20 அரசு பள்ளிகளில் கட்டமைப்பு மேம்பாடு",
      content: "Under the constituency development fund, 20 government schools in Tambaram received new classrooms, toilets, and digital equipment, improving learning conditions for over 10,000 students.",
      contentTa: "தொகுதி வளர்ச்சி நிதியின் கீழ், தாம்பரத்தில் 20 அரசு பள்ளிகளுக்கு புதிய வகுப்பறைகள், கழிப்பறைகள் மற்றும் டிஜிட்டல் உபகரணங்கள் வழங்கப்பட்டன.",
      category: "education",
      featured: false,
      publishedAt: new Date("2025-01-25"),
    },
    {
      title: "Underground Drainage Project Completed in Tambaram East",
      titleTa: "தாம்பரம் கிழக்கில் நிலத்தடி வடிகால் திட்டம் நிறைவு",
      content: "The underground drainage project covering Tambaram East area has been completed, bringing modern sanitation infrastructure to over 8,000 households and significantly reducing waterlogging during monsoon.",
      contentTa: "தாம்பரம் கிழக்கு பகுதியை உள்ளடக்கிய நிலத்தடி வடிகால் திட்டம் நிறைவடைந்தது. 8,000க்கும் மேற்பட்ட குடும்பங்களுக்கு நவீன சுகாதார கட்டமைப்பு வழங்கப்பட்டது.",
      category: "development",
      featured: false,
      publishedAt: new Date("2024-12-15"),
    },
    {
      title: "Youth Skill Development Centre Inaugurated in Tambaram",
      titleTa: "தாம்பரத்தில் இளைஞர் திறன் மேம்பாட்டு மையம் திறப்பு",
      content: "A new skill development centre offering vocational training in IT, tailoring, and electronics repair was inaugurated in Tambaram. The centre will benefit 500 youth annually from the constituency.",
      contentTa: "IT, தையல் மற்றும் மின்னணுவியல் பழுது நீக்கத்தில் தொழிற்பயிற்சி வழங்கும் புதிய திறன் மேம்பாட்டு மையம் தாம்பரத்தில் திறக்கப்பட்டது.",
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
      description: "Monthly public hearing where residents can directly present their issues to D. Sarath Kumar. All are welcome. No appointment needed.",
      descriptionTa: "மாதாந்திர பொது விசாரணை - மக்கள் நேரடியாக D. சரத் குமாரிடம் தங்கள் பிரச்சினைகளை தெரிவிக்கலாம்.",
      venue: "Town Hall, Tambaram",
      eventDate: futureDate1,
      category: "public-hearing",
    },
    {
      title: "Free Legal Aid Camp",
      titleTa: "இலவச சட்ட உதவி முகாம்",
      description: "A free legal aid camp organized in collaboration with the Tamil Nadu Bar Association. Residents can seek legal advice on property, family, and labour matters.",
      descriptionTa: "தமிழ்நாடு வக்கீல் சங்கத்துடன் இணைந்து ஏற்பாடு செய்யப்பட்ட இலவச சட்ட உதவி முகாம்.",
      venue: "Community Hall, Tambaram",
      eventDate: futureDate2,
      category: "welfare",
    },
    {
      title: "Youth Sports Tournament 2025",
      titleTa: "இளைஞர் விளையாட்டு போட்டி 2025",
      description: "Inter-ward youth sports tournament covering cricket, volleyball, and kabaddi. Open to all youth aged 15–30 from Tambaram constituency.",
      descriptionTa: "கிரிக்கெட், கைப்பந்து மற்றும் கபடி உள்ளடக்கிய வார்டு அளவிலான இளைஞர் விளையாட்டு போட்டி.",
      venue: "Municipal Stadium, Tambaram",
      eventDate: futureDate3,
      category: "sports",
    },
    {
      title: "Tree Plantation Drive – Green Tambaram",
      titleTa: "மர நடவடிக்கை – பச்சை தாம்பரம்",
      description: "D. Sarath Kumar led a constituency-wide tree plantation drive with volunteers. Over 1,500 saplings were planted across public spaces in Tambaram.",
      descriptionTa: "D. சரத் குமார் தன்னார்வலர்களுடன் தொகுதி அளவிலான மர நடவடிக்கையை நடத்தினார். தாம்பரத்தில் 1,500 மரக்கன்றுகள் நடப்பட்டன.",
      venue: "Throughout Tambaram Constituency",
      eventDate: pastDate1,
      category: "environment",
    },
  ]).onConflictDoNothing();

  // Activities
  const today = new Date();
  await db.insert(activitiesTable).values([
    {
      title: "Met with residents of Tambaram Ward on traffic issues",
      titleTa: "தாம்பரம் வார்டு மக்களை சந்தித்தல் – போக்குவரத்து பிரச்சினை",
      description: "Held a direct consultation with Tambaram ward residents regarding traffic congestion and road widening. Action plan submitted to Highways Department.",
      activityDate: new Date(today.getTime() - 1 * 86400000),
      location: "Tambaram",
      category: "constituency-work",
    },
    {
      title: "Distributed welfare assistance to ex-servicemen families",
      titleTa: "முன்னாள் இராணுவ வீரர் குடும்பங்களுக்கு நலன் உதவி வழங்கல்",
      description: "Financial assistance and welfare kits were distributed to 60 ex-servicemen families in Tambaram as part of the Ex-Servicemen Welfare scheme.",
      activityDate: new Date(today.getTime() - 3 * 86400000),
      location: "Tambaram",
      category: "welfare",
    },
    {
      title: "Attended Tamil Nadu Legislative Assembly session",
      titleTa: "தமிழ்நாடு சட்டமன்ற கூட்டத்தொடரில் கலந்துகொண்டார்",
      description: "Represented Tambaram constituency in the assembly session. Raised issues related to Chengalpattu district infrastructure and human resource development.",
      activityDate: new Date(today.getTime() - 5 * 86400000),
      location: "Tamil Nadu Legislative Assembly, Chennai",
      category: "assembly",
    },
    {
      title: "Distributed school kits to 250 students",
      titleTa: "250 மாணவர்களுக்கு பள்ளி பைகள் வழங்கல்",
      description: "School bags, notebooks, and stationery were distributed to 250 students from economically weaker sections in Tambaram government schools.",
      activityDate: new Date(today.getTime() - 7 * 86400000),
      location: "Govt. School, Tambaram",
      category: "education",
    },
    {
      title: "Reviewed progress of constituency road projects",
      titleTa: "தொகுதி சாலை திட்டங்களின் முன்னேற்றம் ஆய்வு",
      description: "Conducted a field inspection of ongoing road construction works across 6 wards in Tambaram to ensure quality and timely completion.",
      activityDate: new Date(today.getTime() - 10 * 86400000),
      location: "Various Wards, Tambaram",
      category: "development",
    },
    {
      title: "Public meeting on TVK party activities",
      titleTa: "TVK கட்சி நடவடிக்கைகள் பற்றிய பொது கூட்டம்",
      description: "Chaired a TVK party coordination meeting to plan upcoming constituency outreach programs and volunteer drives in Tambaram.",
      activityDate: new Date(today.getTime() - 12 * 86400000),
      location: "TVK Office, Tambaram",
      category: "party",
    },
  ]).onConflictDoNothing();

  // ── Constituency hierarchy ──────────────────────────────
  // Tambaram constituency, Chengalpattu District.

  // 1) Zones — Tambaram Corporation zones
  await db.insert(zonesTable).values([
    { slug: "central", name: "Central Zone", nameTa: "மத்திய மண்டலம்", type: "municipality", description: "Central zone covering Tambaram main area and railway station" },
    { slug: "north",   name: "North Zone",   nameTa: "வடக்கு மண்டலம்", type: "municipality", description: "Northern zone toward Pallavaram and Chromepet" },
    { slug: "east",    name: "East Zone",    nameTa: "கிழக்கு மண்டலம்", type: "municipality", description: "Eastern zone toward Selaiyur and Medavakkam" },
    { slug: "south",   name: "South Zone",   nameTa: "தெற்கு மண்டலம்", type: "municipality", description: "Southern zone toward Vandalur and Guduvanchery" },
    { slug: "west",    name: "West Zone",    nameTa: "மேற்கு மண்டலம்", type: "municipality", description: "Western zone toward Anakaputhur and Pammal" },
  ]).onConflictDoNothing();

  const zoneRows = await db.select({ id: zonesTable.id, slug: zonesTable.slug }).from(zonesTable);
  const zoneId = (slug: string) => zoneRows.find((z) => z.slug === slug)?.id ?? null;

  // 2) Wards of Tambaram Corporation with bilingual names and GPS centroids.
  await db.insert(wardsTable).values([
    // Central Zone
    { slug: "ward-01-tambaram-central", name: "Ward 1 – Tambaram Central",   nameTa: "வார்டு 1 – தாம்பரம் மத்தியம்",    wardType: "municipal", zoneId: zoneId("central"), pincode: "600045", latitude: 12.9249, longitude: 80.1000 },
    { slug: "ward-02-railway-station",  name: "Ward 2 – Railway Station",     nameTa: "வார்டு 2 – இரயில் நிலையம்",       wardType: "municipal", zoneId: zoneId("central"), pincode: "600045", latitude: 12.9260, longitude: 80.1020 },
    { slug: "ward-03-anna-nagar",       name: "Ward 3 – Anna Nagar",          nameTa: "வார்டு 3 – அண்ணா நகர்",           wardType: "municipal", zoneId: zoneId("central"), pincode: "600045", latitude: 12.9240, longitude: 80.0980 },
    { slug: "ward-04-gandhi-nagar",     name: "Ward 4 – Gandhi Nagar",        nameTa: "வார்டு 4 – காந்தி நகர்",          wardType: "municipal", zoneId: zoneId("central"), pincode: "600045", latitude: 12.9230, longitude: 80.0970 },
    { slug: "ward-05-west-tambaram",    name: "Ward 5 – West Tambaram",       nameTa: "வார்டு 5 – மேற்கு தாம்பரம்",      wardType: "municipal", zoneId: zoneId("central"), pincode: "600045", latitude: 12.9220, longitude: 80.0960 },
    // North Zone
    { slug: "ward-06-chromepet",        name: "Ward 6 – Chromepet",           nameTa: "வார்டு 6 – குரோம்பேட்",           wardType: "municipal", zoneId: zoneId("north"), pincode: "600044", latitude: 12.9516, longitude: 80.0708 },
    { slug: "ward-07-pallavaram",       name: "Ward 7 – Pallavaram",          nameTa: "வார்டு 7 – பல்லாவரம்",            wardType: "municipal", zoneId: zoneId("north"), pincode: "600043", latitude: 12.9675, longitude: 80.0852 },
    { slug: "ward-08-nehru-nagar",      name: "Ward 8 – Nehru Nagar",         nameTa: "வார்டு 8 – நேரு நகர்",            wardType: "municipal", zoneId: zoneId("north"), pincode: "600044", latitude: 12.9480, longitude: 80.0750 },
    { slug: "ward-09-rajaji-nagar",     name: "Ward 9 – Rajaji Nagar",        nameTa: "வார்டு 9 – ராஜாஜி நகர்",          wardType: "municipal", zoneId: zoneId("north"), pincode: "600044", latitude: 12.9460, longitude: 80.0730 },
    { slug: "ward-10-north-ext",        name: "Ward 10 – North Extension",    nameTa: "வார்டு 10 – வடக்கு விரிவு",        wardType: "municipal", zoneId: zoneId("north"), pincode: "600043", latitude: 12.9700, longitude: 80.0870 },
    // East Zone
    { slug: "ward-11-selaiyur",         name: "Ward 11 – Selaiyur",           nameTa: "வார்டு 11 – செலையூர்",             wardType: "municipal", zoneId: zoneId("east"), pincode: "600073", latitude: 12.9100, longitude: 80.1350 },
    { slug: "ward-12-medavakkam",       name: "Ward 12 – Medavakkam",         nameTa: "வார்டு 12 – மேடவாக்கம்",           wardType: "municipal", zoneId: zoneId("east"), pincode: "600100", latitude: 12.9170, longitude: 80.1900 },
    { slug: "ward-13-perungalathur",    name: "Ward 13 – Perungalathur",      nameTa: "வார்டு 13 – பெருங்களத்தூர்",       wardType: "municipal", zoneId: zoneId("east"), pincode: "600063", latitude: 12.9000, longitude: 80.1200 },
    { slug: "ward-14-kamarajar-nagar",  name: "Ward 14 – Kamarajar Nagar",   nameTa: "வார்டு 14 – காமராஜர் நகர்",        wardType: "municipal", zoneId: zoneId("east"), pincode: "600073", latitude: 12.9120, longitude: 80.1300 },
    { slug: "ward-15-east-ext",         name: "Ward 15 – East Extension",     nameTa: "வார்டு 15 – கிழக்கு விரிவு",       wardType: "municipal", zoneId: zoneId("east"), pincode: "600100", latitude: 12.9080, longitude: 80.1400 },
    // South Zone
    { slug: "ward-16-vandalur",         name: "Ward 16 – Vandalur",           nameTa: "வார்டு 16 – வண்டலூர்",             wardType: "municipal", zoneId: zoneId("south"), pincode: "600048", latitude: 12.8760, longitude: 80.0820 },
    { slug: "ward-17-guduvanchery",     name: "Ward 17 – Guduvanchery",       nameTa: "வார்டு 17 – குடுவாஞ்சேரி",         wardType: "municipal", zoneId: zoneId("south"), pincode: "603202", latitude: 12.8360, longitude: 80.0600 },
    { slug: "ward-18-south-ext",        name: "Ward 18 – South Extension",   nameTa: "வார்டு 18 – தெற்கு விரிவு",         wardType: "municipal", zoneId: zoneId("south"), pincode: "600048", latitude: 12.8800, longitude: 80.0850 },
    { slug: "ward-19-potheri",          name: "Ward 19 – Potheri",            nameTa: "வார்டு 19 – போத்தேரி",             wardType: "municipal", zoneId: zoneId("south"), pincode: "603203", latitude: 12.8480, longitude: 80.0460 },
    { slug: "ward-20-urapakkam",        name: "Ward 20 – Urapakkam",          nameTa: "வார்டு 20 – உரப்பாக்கம்",          wardType: "municipal", zoneId: zoneId("south"), pincode: "603210", latitude: 12.8600, longitude: 80.0550 },
    // West Zone
    { slug: "ward-21-pammal",           name: "Ward 21 – Pammal",             nameTa: "வார்டு 21 – பம்மல்",               wardType: "municipal", zoneId: zoneId("west"), pincode: "600075", latitude: 12.9680, longitude: 80.0630 },
    { slug: "ward-22-anakaputhur",      name: "Ward 22 – Anakaputhur",        nameTa: "வார்டு 22 – அணகாபுத்தூர்",         wardType: "municipal", zoneId: zoneId("west"), pincode: "600070", latitude: 12.9780, longitude: 80.0500 },
    { slug: "ward-23-nagalkeni",        name: "Ward 23 – Nagalkeni",          nameTa: "வார்டு 23 – நாகல்கேணி",            wardType: "municipal", zoneId: zoneId("west"), pincode: "600044", latitude: 12.9550, longitude: 80.0650 },
    { slug: "ward-24-west-ext",         name: "Ward 24 – West Extension",     nameTa: "வார்டு 24 – மேற்கு விரிவு",         wardType: "municipal", zoneId: zoneId("west"), pincode: "600070", latitude: 12.9720, longitude: 80.0480 },
  ]).onConflictDoNothing();

  // 3) Pincodes — Tambaram constituency pin codes (Chengalpattu District).
  await db.insert(pincodesTable).values([
    { code: "600045", label: "Tambaram" },
    { code: "600044", label: "Chromepet" },
    { code: "600043", label: "Pallavaram" },
    { code: "600073", label: "Selaiyur" },
    { code: "600075", label: "Pammal" },
    { code: "600048", label: "Vandalur" },
    { code: "600063", label: "Perungalathur" },
    { code: "600070", label: "Anakaputhur" },
    { code: "600100", label: "Medavakkam" },
    { code: "603202", label: "Guduvanchery" },
  ]).onConflictDoNothing();

  console.log("Constituency hierarchy seeded.");

  // Gallery — intentionally left empty. Real photos are uploaded by staff.
  await db.delete(galleryTable);
  await db.insert(galleryTable).values([
    {
      title: "D. சரத் குமார் – அலுவலக நாள்",
      mediaUrl: "/gallery/sarath_1.jpg",
      thumbnailUrl: "/gallery/sarath_1.jpg",
      mediaType: "photo",
      album: "Official",
      displayOrder: 1,
    },
    {
      title: "மக்கள் சந்திப்பு – தாம்பரம்",
      mediaUrl: "/gallery/sarath_2.jpg",
      thumbnailUrl: "/gallery/sarath_2.jpg",
      mediaType: "photo",
      album: "Public Meetings",
      displayOrder: 2,
    },
    {
      title: "தொகுதி வலம் – தாம்பரம்",
      mediaUrl: "/gallery/sarath_3.jpg",
      thumbnailUrl: "/gallery/sarath_3.jpg",
      mediaType: "photo",
      album: "Constituency",
      displayOrder: 3,
    },
    {
      title: "முன்னாள் இராணுவ வீரர் நலன் திட்டம் – தாம்பரம்",
      mediaUrl: "/gallery/sarath_4.jpg",
      thumbnailUrl: "/gallery/sarath_4.jpg",
      mediaType: "photo",
      album: "Welfare",
      displayOrder: 4,
    },
    {
      title: "இளைஞர் கூட்டம் – TVK",
      mediaUrl: "/gallery/sarath_5.jpg",
      thumbnailUrl: "/gallery/sarath_5.jpg",
      mediaType: "photo",
      album: "Events",
      displayOrder: 5,
    },
  ]);

  // FAQs
  await db.insert(faqsTable).values([
    {
      question: "How do I submit a grievance to D. Sarath Kumar's office?",
      questionTa: "D. சரத் குமாரின் அலுவலகத்திற்கு புகார் எப்படி அனுப்புவது?",
      answer: "You can submit a grievance through the Grievance Portal on this website. Fill in your name, contact number, category, and description of the issue. You will receive a unique ticket number to track the status of your complaint.",
      answerTa: "இந்த வலைத்தளத்தில் உள்ள புகார் மையம் மூலம் புகார் அனுப்பலாம். பெயர், தொலைபேசி, வகை மற்றும் பிரச்சினையின் விவரங்களை பூர்த்தி செய்யுங்கள். உங்கள் புகாரின் நிலையை கண்காணிக்க தனித்துவமான புகார் எண் கிடைக்கும்.",
      order: 1,
    },
    {
      question: "What are the office hours for D. Sarath Kumar's constituency office?",
      questionTa: "D. சரத் குமாரின் தொகுதி அலுவலகம் எப்போது திறந்திருக்கும்?",
      answer: "The constituency office is open Monday to Saturday, 9:00 AM to 6:00 PM. The office is closed on Sundays and public holidays.",
      answerTa: "தொகுதி அலுவலகம் திங்கள் முதல் சனி வரை, காலை 9:00 மணி முதல் மாலை 6:00 மணி வரை திறந்திருக்கும். ஞாயிறுகள் மற்றும் பொது விடுமுறை நாட்களில் மூடல்.",
      order: 2,
    },
    {
      question: "How can I become a volunteer for TVK in Tambaram?",
      questionTa: "தாம்பரத்தில் TVK தன்னார்வலராக எப்படி இணைவது?",
      answer: "Visit the Volunteer page on this website and fill out the registration form with your details. Our team will contact you to guide you through the process.",
      answerTa: "இந்த வலைத்தளத்தில் உள்ள தன்னார்வலர் பக்கத்திற்கு சென்று பதிவு படிவத்தை நிரப்புங்கள். நாங்கள் உங்களை தொடர்பு கொண்டு மேலும் வழிகாட்டுவோம்.",
      order: 3,
    },
    {
      question: "Which welfare schemes can I apply for through this office?",
      questionTa: "இந்த அலுவலகம் மூலம் எந்த நலத் திட்டங்களுக்கு விண்ணப்பிக்கலாம்?",
      answer: "The office assists with Ex-Servicemen welfare schemes, Old Age Pension, Education Scholarships, Housing Schemes (PMAY), MGNREGS, and other central and state government welfare schemes. Visit the office with your documents for assistance.",
      answerTa: "முன்னாள் இராணுவ வீரர் நலத் திட்டங்கள், முதியோர் ஓய்வூதியம், கல்வி உதவித்தொகை, வீட்டுவசதி திட்டம் (PMAY), MGNREGS மற்றும் பிற மத்திய மாநில அரசு நலத் திட்டங்களுக்கு உதவி வழங்கப்படுகிறது.",
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

  // Tasks (internal team to-do) — assigned to the seed admin user.
  const [adminUser] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.email, "admin@logeshconnect.in"));

  if (adminUser) {
    const day = (offset: number) => {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() + offset);
      return d;
    };
    await db.insert(tasksTable).values([
      {
        title: "Review pending grievances from Tambaram ward",
        description: "Go through escalated grievances and assign officers.",
        dueDate: day(-1), dueTime: "10:00", priority: "high", status: "todo",
        category: "grievance_action", assignedTo: adminUser.id, createdBy: adminUser.id,
      },
      {
        title: "Prepare brief for school inauguration visit",
        description: "Talking points and guest list for the event.",
        dueDate: day(0), dueTime: "09:30", priority: "high", status: "in_progress",
        category: "visit_prep", assignedTo: adminUser.id, createdBy: adminUser.id,
      },
      {
        title: "Approve press release on water project",
        dueDate: day(0), priority: "medium", status: "todo",
        category: "content", assignedTo: adminUser.id, createdBy: adminUser.id,
      },
      {
        title: "Follow up with PWD on road repair status",
        dueDate: day(2), dueTime: "15:00", priority: "medium", status: "todo",
        category: "follow_up", assignedTo: adminUser.id, createdBy: adminUser.id,
      },
      {
        title: "Confirm attendance for district coordination meeting",
        dueDate: day(4), priority: "low", status: "todo",
        category: "official", assignedTo: adminUser.id, createdBy: adminUser.id,
      },
      {
        title: "Sign welfare scheme approval documents",
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
        ward: "Ward 12", address: "Selaiyur, Tambaram",
        category: "Constituency Meeting", subject: "Road repair request for our street",
        description: "Our street has had potholes for months. Requesting a meeting to discuss repair work.",
        partySize: 3, preferredDate: day(-2), preferredTime: "10:00",
        status: "Approved", scheduledDate: day(0), scheduledTime: "11:00",
        location: "MLA Office, Tambaram", decisionNote: "Confirmed. Please arrive 10 mins early.",
        notificationMessage: "Your appointment is confirmed for today at 11:00 AM at the MLA Office.",
        handledBy: adminUser.id, handledByName: "Admin",
      },
      {
        ticketNo: `APT-${year}-0002`,
        name: "Lakshmi Narayanan", phone: "9790054321", email: null,
        ward: "Ward 8", address: "Camp Road, Selaiyur",
        category: "Grievance Hearing", subject: "Water supply issue follow-up",
        description: "Following up on water grievance submitted last week.",
        partySize: 1, preferredDate: day(0), preferredTime: "14:30",
        status: "Approved", scheduledDate: day(0), scheduledTime: "15:00",
        location: "MLA Office, Tambaram",
        notificationMessage: "Approved for today 3:00 PM.",
        handledBy: adminUser.id, handledByName: "Admin",
      },
      {
        ticketNo: `APT-${year}-0003`,
        name: "Anand Selvam", phone: "9551098765", email: "anand.s@example.com",
        ward: "Ward 15", address: "East Tambaram",
        category: "Official Visit", subject: "Inauguration invitation for community hall",
        description: "Requesting the Minister to inaugurate our newly built community hall.",
        partySize: 5, preferredDate: day(2), preferredTime: "17:00",
        status: "Pending",
      },
      {
        ticketNo: `APT-${year}-0004`,
        name: "Priya Dharshini", phone: "9445567890", email: null,
        ward: "Ward 3", address: "West Tambaram",
        category: "General", subject: "Scholarship guidance for students",
        description: "Group of students seeking guidance on government scholarships.",
        partySize: 8, preferredDate: day(3), preferredTime: "11:00",
        status: "Pending",
      },
      {
        ticketNo: `APT-${year}-0005`,
        name: "Mohammed Irfan", phone: "9362011223", email: "irfan@example.com",
        ward: "Ward 20", address: "Mudichur Road",
        category: "Media", subject: "Interview request on welfare schemes",
        description: "Local news channel requesting a short interview.",
        partySize: 2, preferredDate: day(1), preferredTime: "16:00",
        status: "Rescheduled", scheduledDate: day(4), scheduledTime: "10:30",
        location: "MLA Office, Tambaram", decisionNote: "Rescheduled due to prior engagement.",
        notificationMessage: "Your interview has been rescheduled. New slot: see confirmed schedule.",
        handledBy: adminUser.id, handledByName: "Admin",
      },
      {
        ticketNo: `APT-${year}-0006`,
        name: "Geetha Raman", phone: "9698034567", email: null,
        ward: "Ward 7", address: "Sembakkam",
        category: "Constituency Meeting", subject: "Streetlight installation",
        partySize: 4, preferredDate: day(-5), preferredTime: "09:00",
        status: "Completed", scheduledDate: day(-4), scheduledTime: "09:30",
        location: "MLA Office, Tambaram", decisionNote: "Meeting held; work order issued.",
        handledBy: adminUser.id, handledByName: "Admin", completedAt: day(-4),
      },
      {
        ticketNo: `APT-${year}-0007`,
        name: "Suresh Babu", phone: "9123045678", email: null,
        ward: "Ward 5", address: "Rajakilpakkam",
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
