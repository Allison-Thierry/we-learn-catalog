import { createSign } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";

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
  "Search!A1:B2000",
];
const params = new URLSearchParams();
for (const range of ranges) params.append("ranges", range);
params.set("valueRenderOption", "FORMATTED_VALUE");
const sheetResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchGet?${params}`, {
  headers: { authorization: `Bearer ${accessToken}` },
});
if (!sheetResponse.ok) throw new Error(`Google Sheets read failed (${sheetResponse.status}).`);
const payload = await sheetResponse.json();
const [courseRows = [], updateRows = [], translationRows = [], searchRows = []] = payload.valueRanges.map((range) => range.values || []);

const truthy = (value) => value === true || String(value ?? "").trim().toUpperCase() === "TRUE";
const languageCols = { English: 6, Italian: 13, German: 15, Polish: 18, French: 20, Spanish: 24, Portuguese: 34, Czech: 37, "Hebrew & Russian": 39 };
const countryCols = { UK: 7, Ireland: 8, Singapore: 9, "United States": 10, Netherlands: 11, Australia: 12, Italy: 14, Germany: 16, Austria: 17, Poland: 19, France: 21, Belgium: 22, Switzerland: 23, Spain: 25, Chile: 26, Colombia: 27, "Costa Rica": 28, "El Salvador": 29, Guatemala: 30, Mexico: 31, Panama: 32, Peru: 33, Brazil: 35, Portugal: 36, Czechia: 38, Israel: 40 };

const courses = courseRows.slice(1).flatMap((row, index) => {
  if (String(row[0] ?? "").trim() !== "Published") return [];
  const key = String(row[3] ?? `row-${index + 2}`).trim() || `row-${index + 2}`;
  const catalogGroup = String(row[5] ?? "").trim();
  const catalogDescription = String(row[53] ?? "").trim();
  const lessonDescription = String(row[45] ?? "").trim();
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
    publicDescription: catalogDescription || lessonDescription,
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
const searchGroups = searchRows.slice(1)
  .map((row) => ({
    concept: String(row[0] ?? "").trim(),
    synonyms: String(row[1] ?? "").split(",").map((item) => item.trim()).filter(Boolean),
  }))
  .filter((group) => group.concept && group.synonyms.length);

const catalog = {
  schemaVersion: 2,
  generatedAt: new Date().toISOString(),
  courses,
  updates,
  translations,
  searchGroups,
};

const escapeHtml = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#39;");
const listItems = (values, emptyMessage) => values.length
  ? `<ul>${values.map((value) => `<li>${escapeHtml(value)}</li>`).join("")}</ul>`
  : `<p>${escapeHtml(emptyMessage)}</p>`;
const catalogGroupLabel = (value) => ({
  gp: "Global Package",
  sales: "Sales content",
  local: "Local content",
  specific: "Specific content",
}[String(value ?? "").trim().toLowerCase()] || String(value ?? "Local content"));
const languageNames = {
  GB: "English", IT: "Italian", DE: "German", PL: "Polish", FR: "French",
  ES: "Spanish", PT: "Portuguese", CZ: "Czech", IL: "Hebrew & Russian",
};
const activeUpdates = updates.filter((update) => update.show);
const courseArticles = courses.map((course, index) => {
  const availableLanguages = Object.entries(course.languages).filter(([, available]) => available).map(([name]) => name);
  const assignedCountries = Object.entries(course.countries).filter(([, assigned]) => assigned).map(([name]) => name);
  const objectives = String(course.objectiveSearchText ?? "").split(/\r?\n+/).map((item) => item.trim()).filter(Boolean);
  const features = [course.quiz && "Quiz", course.certificate && "Certificate", course.series, course.companionAssignment && "Practical follow-up assignment"].filter(Boolean);
  const duration = /^\d+(?:\.\d+)?$/.test(String(course.duration).trim()) ? `${course.duration} minutes` : String(course.duration || "Not specified");
  return `<article class="course" id="course-${index + 1}">
  <h3>${escapeHtml(course.title)}</h3>
  <dl>
    <dt>Catalog group</dt><dd>${escapeHtml(catalogGroupLabel(course.catalogGroup))}</dd>
    <dt>Category</dt><dd>${escapeHtml(course.category || "Not specified")}</dd>
    <dt>Target audience</dt><dd>${escapeHtml(course.audience || "Not specified")}</dd>
    <dt>Publication date</dt><dd>${escapeHtml(course.date || "Not specified")}</dd>
    <dt>Estimated duration</dt><dd>${escapeHtml(duration)}</dd>
    <dt>Features</dt><dd>${features.length ? escapeHtml(features.join(", ")) : "Standard lesson"}</dd>
    <dt>Prerequisite</dt><dd>${escapeHtml(course.prerequisite || "None recorded")}</dd>
  </dl>
  <section><h4>Description</h4><p>${escapeHtml(course.publicDescription || "No public description available.")}</p></section>
  <section><h4>Learning objectives</h4>${listItems(objectives, "No learning objectives recorded.")}</section>
  <section><h4>Available languages</h4>${listItems(availableLanguages, "No available language recorded.")}</section>
  <section><h4>Assigned countries</h4>${listItems(assignedCountries, "No country assignment recorded.")}</section>
</article>`;
}).join("\n");
const updateArticles = activeUpdates.length ? activeUpdates.map((update) => `<article>
  <h3>${escapeHtml(update.title || "WeLearn update")}</h3>
  <p><strong>Date:</strong> ${escapeHtml(update.date || "Not specified")}</p>
  <p>${escapeHtml(update.message)}</p>
</article>`).join("\n") : "<p>No current WeLearn update.</p>";
const translationItems = translations.length ? `<ul>${translations.map((event) => `<li><strong>${escapeHtml(event.title)}</strong> — ${escapeHtml(languageNames[event.language] || event.language)} — ${escapeHtml(event.date)}</li>`).join("")}</ul>` : "<p>No translation event recorded.</p>";
const knowledgeHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="Static, automatically generated knowledge source for the public WeLearn course catalog.">
  <meta name="generated-at" content="${escapeHtml(catalog.generatedAt)}">
  <link rel="canonical" href="https://allison-thierry.github.io/we-learn-catalog/knowledge/catalog.html">
  <title>WeLearn Course Catalog — Knowledge Source</title>
  <style>
    body{max-width:960px;margin:0 auto;padding:32px;font:16px/1.55 Arial,sans-serif;color:#20252a;background:#fff}header{border-bottom:3px solid #c62032;margin-bottom:32px}h1,h2,h3,h4{line-height:1.2}h1{margin-bottom:8px}.summary,.course{border:1px solid #d9dee1;border-radius:8px;padding:20px;margin:20px 0}.course{break-inside:avoid}.course>h3{margin-top:0;color:#9e1725}dl{display:grid;grid-template-columns:minmax(150px,220px) 1fr;gap:6px 16px}dt{font-weight:700}dd{margin:0}ul{margin-top:6px}@media(max-width:640px){body{padding:20px}dl{grid-template-columns:1fr}dd{margin-bottom:8px}}
  </style>
</head>
<body>
  <header>
    <h1>WeLearn Course Catalog</h1>
    <p>This static page is generated automatically from the public fields of the WeLearn catalog source. Each course record below is complete and independent.</p>
    <dl class="summary">
      <dt>Generated at</dt><dd><time datetime="${escapeHtml(catalog.generatedAt)}">${escapeHtml(catalog.generatedAt)}</time></dd>
      <dt>Published courses</dt><dd>${courses.length}</dd>
      <dt>Active updates</dt><dd>${activeUpdates.length}</dd>
      <dt>Translation events</dt><dd>${translations.length}</dd>
    </dl>
  </header>
  <main>
    <section id="welearn-updates"><h2>Current WeLearn updates</h2>${updateArticles}</section>
    <section id="translation-log"><h2>Translation log</h2>${translationItems}</section>
    <section id="published-courses"><h2>Published courses</h2>${courseArticles}</section>
  </main>
</body>
</html>
`;

const textSeparator = "=".repeat(50);
const textList = (values, emptyMessage) => values.length
  ? values.map((value) => `- ${String(value)}`).join("\n")
  : emptyMessage;
const targetAudienceText = (value) => {
  const audiences = String(value ?? "").split(",").map((item) => item.trim()).filter(Boolean);
  if (!audiences.length) return "Target audience:\nNot specified";
  if (audiences.length === 1) return `Target audience: ${audiences[0]}`;
  return `Target audience:\n${textList(audiences, "Not specified")}`;
};
const courseRecords = courses.map((course) => {
  const availableLanguages = Object.entries(course.languages).filter(([, available]) => available).map(([name]) => name);
  const assignedCountries = Object.entries(course.countries).filter(([, assigned]) => assigned).map(([name]) => name);
  const objectives = String(course.objectiveSearchText ?? "").split(/\r?\n+/).map((item) => item.trim()).filter(Boolean);
  const features = [course.quiz && "Quiz", course.certificate && "Certificate", course.series, course.companionAssignment && "Practical follow-up assignment"].filter(Boolean);
  const duration = /^\d+(?:\.\d+)?$/.test(String(course.duration).trim()) ? `${course.duration} minutes` : String(course.duration || "Not specified");
  return `${textSeparator}
COURSE RECORD
${textSeparator}

COURSE: ${String(course.title)}

Catalog group: ${catalogGroupLabel(course.catalogGroup)}
Category: ${String(course.category || "Not specified")}
${targetAudienceText(course.audience)}
Publication date: ${String(course.date || "Not specified")}
Estimated duration: ${duration}
Features:
${textList(features, "No additional features recorded.")}

Prerequisite:
${String(course.prerequisite || "None recorded")}

Description:
${String(course.publicDescription || "No public description available.")}

Learning objectives:
${textList(objectives, "No learning objectives recorded.")}

Available languages:
${textList(availableLanguages, "No available language recorded.")}

Assigned countries:
${textList(assignedCountries, "No country assignment recorded.")}`;
}).join("\n\n");
const updateRecords = activeUpdates.length ? activeUpdates.map((update) => `UPDATE: ${String(update.title || "WeLearn update")}
Date: ${String(update.date || "Not specified")}
Message:
${String(update.message || "No update message recorded.")}`).join("\n\n") : "No current WeLearn update.";
const translationRecords = translations.length ? translations.map((event) => `TRANSLATION EVENT
Course: ${String(event.title)}
Language: ${String(languageNames[event.language] || event.language)}
Date: ${String(event.date)}`).join("\n\n") : "No translation event recorded.";
const knowledgeText = `WELEARN COURSE CATALOG — AI KNOWLEDGE SOURCE

Generated at: ${catalog.generatedAt}
Published courses: ${courses.length}

Purpose:
This file contains the current published WeLearn course catalogue.
Each COURSE RECORD is complete and independent.
Course titles and metadata must be treated exactly as recorded.
Do not infer course availability, audience, language or prerequisites beyond the information contained in each record.

${textSeparator}
CURRENT WELEARN UPDATES
${textSeparator}

${updateRecords}

${textSeparator}
RECENT TRANSLATION EVENTS
${textSeparator}

${translationRecords}

${textSeparator}
PUBLISHED COURSE RECORDS
${textSeparator}

${courseRecords}

${textSeparator}
END OF WELEARN COURSE CATALOG
${textSeparator}
`;

const knowledgeDirectory = new URL("../public/knowledge/", import.meta.url);
await mkdir(knowledgeDirectory, { recursive: true });
await Promise.all([
  writeFile(new URL("../public/catalog.json", import.meta.url), `${JSON.stringify(catalog, null, 2)}\n`),
  writeFile(new URL("catalog.html", knowledgeDirectory), knowledgeHtml),
  writeFile(new URL("../public/welearn-knowledge.txt", import.meta.url), knowledgeText, "utf8"),
]);
console.log(`Synced ${courses.length} courses, ${updates.length} updates, ${translations.length} translation events and ${searchGroups.length} search groups.`);
