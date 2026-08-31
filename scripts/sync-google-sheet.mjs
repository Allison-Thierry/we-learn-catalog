import { createSign } from "node:crypto";
import { writeFile } from "node:fs/promises";

const spreadsheetId = "1NpAqZxoRGMU4r9iZI4L8-fYv_ELm3ugCQ_CORqShwn4";
const secret = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();

if (!secret) {
  throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is required to build the public catalog.");
}

const credentials = JSON.parse(secret);
const base64url = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
const now = Math.floor(Date.now() / 1000);
const unsigned = `${base64url({ alg: "RS256", typ: "JWT" })}.${base64url({
  iss: credentials.client_email,
  scope: "https://www.googleapis.com/auth/spreadsheets.readonly",
  aud: "https://oauth2.googleapis.com/token",
  iat: now,
  exp: now + 3600,
})}`;
const signer = createSign("RSA-SHA256");
signer.update(unsigned);
signer.end();
const assertion = `${unsigned}.${signer.sign(credentials.private_key).toString("base64url")}`;

const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
  method: "POST",
  headers: { "content-type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion,
  }),
});
if (!tokenResponse.ok) throw new Error(`Google authentication failed (${tokenResponse.status}).`);
const { access_token: accessToken } = await tokenResponse.json();

const ranges = [
  "Courses catalog!A1:BB2000",
  "WeLearn Updates!A1:D1000",
  "Translation Log!A1:C2000",
];
const params = new URLSearchParams();
for (const range of ranges) params.append("ranges", range);
params.set("valueRenderOption", "FORMATTED_VALUE");
const sheetResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchGet?${params}`, {
  headers: { authorization: `Bearer ${accessToken}` },
});
if (!sheetResponse.ok) throw new Error(`Google Sheets read failed (${sheetResponse.status}).`);
const payload = await sheetResponse.json();
const [courseRows = [], updateRows = [], translationRows = []] = payload.valueRanges.map((range) => range.values || []);

const truthy = (value) => value === true || String(value ?? "").trim().toUpperCase() === "TRUE";
const languageCols = { English: 6, Italian: 13, German: 15, Polish: 18, French: 20, Spanish: 24, Portuguese: 34, Czech: 37, "Hebrew & Russian": 39 };
const countryCols = { UK: 7, Ireland: 8, Singapore: 9, "United States": 10, Netherlands: 11, Australia: 12, Italy: 14, Germany: 16, Austria: 17, Poland: 19, France: 21, Belgium: 22, Switzerland: 23, Spain: 25, Chile: 26, Colombia: 27, "Costa Rica": 28, "El Salvador": 29, Guatemala: 30, Mexico: 31, Panama: 32, Peru: 33, Brazil: 35, Portugal: 36, Czechia: 38, Israel: 40 };

const courses = courseRows.slice(1).flatMap((row, index) => {
  if (String(row[0] ?? "").trim() !== "Published") return [];
  const key = String(row[3] ?? `row-${index + 2}`).trim() || `row-${index + 2}`;
  const catalogGroup = String(row[5] ?? "").trim();
  return [{
    key,
    date: String(row[1] ?? ""),
    title: String(row[2] ?? ""),
    globalPackage: catalogGroup === "GP",
    catalogGroup,
    languages: Object.fromEntries(Object.entries(languageCols).map(([name, column]) => [name, truthy(row[column])])),
    countries: Object.fromEntries(Object.entries(countryCols).map(([name, column]) => [name, truthy(row[column])])),
    category: String(row[41] ?? ""),
    audience: String(row[42] ?? ""),
    publicDescription: String(row[53] ?? ""),
    objectiveSearchText: String(row[47] ?? ""),
    duration: String(row[46] ?? ""),
    quiz: truthy(row[49]),
    certificate: truthy(row[50]),
    prerequisite: String(row[51] ?? ""),
    series: ({ "125": "17-video series", "164": "4-part series" }[key] ?? ""),
    companionAssignment: key === "51",
  }];
});

if (!courses.length) throw new Error("No published courses were returned; refusing to replace the catalog snapshot.");
const updates = updateRows.slice(1)
  .filter((row) => [row[1], row[2], row[3]].some((value) => String(value ?? "").trim()))
  .map((row) => ({ show: truthy(row[0]), date: String(row[1] ?? ""), title: String(row[2] ?? ""), message: String(row[3] ?? "") }));
const translations = translationRows.slice(1)
  .filter((row) => row[0] && row[1] && row[2])
  .map((row) => ({ date: String(row[0]), title: String(row[1]), language: String(row[2]).trim().toUpperCase() }));

const catalog = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  courses,
  updates,
  translations,
};

await writeFile(
  new URL("../public/catalog.json", import.meta.url),
  `${JSON.stringify(catalog, null, 2)}\n`,
);
console.log(`Synced ${courses.length} courses, ${updates.length} updates and ${translations.length} translation events.`);
