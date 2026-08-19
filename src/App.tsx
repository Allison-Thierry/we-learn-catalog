import { useEffect, useMemo, useState } from "react";
import courseData from "./data/courses.json";
import updateData from "./data/updates.json";
import translationData from "./data/translations.json";

type PageName = "home" | "catalog" | "country" | "faq";
type Course = {
  key: string; row: number; date: string; title: string; globalPackage: boolean;
  languages: Record<string, boolean>; countries: Record<string, boolean>;
  category: string; audience: string; publicDescription: string;
  duration: string; quiz: boolean; certificate: boolean;
  prerequisite: string; series: string; companionAssignment: boolean;
  catalogGroup?: string;
};
type Filters = {
  families: string[]; categories: string[]; audiences: string[];
  languages: string[]; countries: string[];
};
type CatalogUpdate = { show: boolean; date: string; title: string; message: string };
type TranslationEvent = { date: string; title: string; language: string };

const courses = courseData as Course[];
const updates = updateData as CatalogUpdate[];
const translationEvents = translationData as TranslationEvent[];
const TODAY = new Date();
const languageNames: Record<string, string> = {
  GB: "English", IT: "Italian", DE: "German", PL: "Polish", FR: "French",
  ES: "Spanish", PT: "Portuguese", CZ: "Czech", IL: "Hebrew & Russian",
};
const emptyFilters: Filters = { families: [], categories: [], audiences: [], languages: [], countries: [] };
const familyOptions = ["Global Package", "Sales content", "Specific content", "Local content"];
const countries = [
  "UK", "Ireland", "Singapore", "United States", "Netherlands", "Australia",
  "Italy", "Germany", "Austria", "Poland", "France", "Belgium", "Switzerland",
  "Spain", "Chile", "Colombia", "Costa Rica", "El Salvador", "Guatemala",
  "Mexico", "Panama", "Peru", "Brazil", "Portugal", "Czechia", "Israel",
].sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));
const spanishLatamCountries = ["Chile", "Colombia", "Costa Rica", "El Salvador", "Guatemala", "Mexico", "Panama", "Peru"];
const countryRequirements: Record<string, string[]> = {
  UK: ["English"], Ireland: ["English"], Singapore: ["English"],
  "United States": ["English"], Netherlands: ["English"], Australia: ["English"],
  Italy: ["Italian"], Germany: ["German"], Austria: ["German"], Poland: ["Polish"],
  France: ["French"], Belgium: ["French"], Switzerland: ["French", "German"],
  Spain: ["Spanish"], Chile: ["Spanish"], Colombia: ["Spanish"],
  "Costa Rica": ["Spanish"], "El Salvador": ["Spanish"], Guatemala: ["Spanish"],
  Mexico: ["Spanish"], Panama: ["Spanish"], Peru: ["Spanish"],
  Brazil: ["Portuguese"], Portugal: ["Portuguese"], Czechia: ["Czech"],
  Israel: ["Hebrew & Russian"],
};
const audienceOptions = ["All Employees", "Auditors", "Supervisors / Flow Leaders", "RTS", "AM / DM", "Sales", "LMS roles"];
const suitableFor: Record<string, string[]> = {
  "All Employees": ["All Employees"],
  Auditors: ["All Employees", "Auditors"],
  "Supervisors / Flow Leaders": ["All Employees", "Auditors", "Supervisors / Flow Leaders"],
  RTS: ["All Employees", "Auditors", "Supervisors / Flow Leaders", "RTS"],
  "AM / DM": ["All Employees", "Auditors", "Supervisors / Flow Leaders", "RTS", "AM / DM"],
  Sales: ["All Employees", "Sales"],
  "LMS roles": ["All Employees", "LMS roles"],
};
const categoryStyle: Record<string, { icon: string; tone: string }> = {
  Accuracy: { icon: "◎", tone: "blue" }, "Customer Certifications": { icon: "✦", tone: "gold" },
  Efficiency: { icon: "↗", tone: "teal" }, "Leadership & Management": { icon: "◇", tone: "violet" },
  NGEN: { icon: "N", tone: "coral" }, Onboarding: { icon: "↟", tone: "navy" },
  "Safety & Wellbeing": { icon: "+", tone: "green" }, "Sales & Development": { icon: "◒", tone: "orange" },
  Sheffield: { icon: "S", tone: "slate" }, Tableau: { icon: "▥", tone: "cyan" },
  "Technology & Innovation": { icon: "⬡", tone: "indigo" }, "Verticals & Merchandising": { icon: "▦", tone: "rose" },
};
const faqItems = [
  ["How do I request a lesson for my country?", "Open the lesson, choose Request assignment, and send the pre-filled email. Allison will confirm the audience and coordinate the assignment in Sheffield."],
  ["What if the lesson is not translated yet?", "Choose Request translation from the lesson details. The request starts a conversation about priority, timing and the review process for your country."],
  ["What does Local content mean?", "The lesson was created for a specific country, customer or local need. It is shown to share ideas. Contact Allison if it could be relevant to your market."],
  ["How is a Local content market identified?", "The market label is inferred from the country assignments recorded in the catalog. Spanish-speaking Latin American countries are grouped as LATAM when several of them share the same lesson."],
  ["What does Specific content mean?", "The lesson was created internally for a targeted need. It is not part of the Global Package or Sales content, and its rollout is managed directly for the relevant audience."],
  ["What is Sales content?", "Sales lessons are created internally and managed separately from the Global Package because their rollout is coordinated directly with Sales teams."],
  ["Why can a translation exist without a country assignment?", "The translation may still be under review, the country may not have adopted it yet, or the assignment may simply need checking. The catalog keeps both pieces of information separate."],
  ["How is Switzerland handled?", "A lesson needs both French and German translations before it can be released in Switzerland."],
  ["How is Israel handled?", "The IL translation status represents both Hebrew and Russian. Both are required for an Israeli release."],
  ["How often is the catalog updated?", "This prototype uses a current snapshot of the LMS Courses sheet. The production version can later refresh automatically from the same professional Google Sheet."],
];

function Icon({ name }: { name: "home" | "book" | "pin" | "help" | "search" | "clock" | "filter" | "close" | "globe" | "mail" }) {
  const paths: Record<string, React.ReactNode> = {
    home: <><path d="M3 10.8 12 3l9 7.8"/><path d="M5.5 9.5V21h13V9.5"/><path d="M9 21v-7h6v7"/></>,
    book: <><path d="M4 5.5A3.5 3.5 0 0 1 7.5 2H11v18H7.5A3.5 3.5 0 0 0 4 23Z"/><path d="M20 5.5A3.5 3.5 0 0 0 16.5 2H13v18h3.5A3.5 3.5 0 0 1 20 23Z"/></>,
    pin: <><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></>,
    help: <><circle cx="12" cy="12" r="9"/><path d="M9.7 9a2.4 2.4 0 1 1 3.7 2c-1 .6-1.4 1.1-1.4 2.2"/><path d="M12 17h.01"/></>,
    search: <><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 5 5"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></>,
    filter: <><path d="M4 6h16M7 12h10M10 18h4"/></>,
    close: <><path d="m6 6 12 12M18 6 6 18"/></>,
    globe: <><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></>,
    mail: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/></>,
  };
  return <svg aria-hidden="true" className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}
function parseDate(value: string) {
  const [day, month, year] = value.split("/").map(Number);
  if (!day || !month || Number.isNaN(year)) return new Date(0);
  return new Date(year < 100 ? 2000 + year : year, month - 1, day);
}
function prettyDate(value: string) {
  const date = parseDate(value);
  return date.getTime() ? date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "Date unavailable";
}
function isNew(value: string) {
  const age = TODAY.getTime() - parseDate(value).getTime();
  return age >= 0 && age <= 30 * 24 * 60 * 60 * 1000;
}
function textFor(course: Course) {
  return course.publicDescription || "Open the lesson details to learn more about this content.";
}
function audienceList(course: Course) {
  return course.audience.split(",").map((item) => item.trim()).filter(Boolean);
}
function displayDuration(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "Self-paced";
  return /^\d+(?:\.\d+)?$/.test(trimmed) ? `${trimmed} min` : trimmed;
}
function courseFamily(course: Course) {
  const group = normalize(course.catalogGroup || "");
  if (group === "gp" || group === "global package") return "Global Package";
  if (group === "sales" || group === "sales content") return "Sales content";
  if (group === "specific" || group === "specific content") return "Specific content";
  return "Local content";
}
function localMarketLabel(course: Course) {
  if (courseFamily(course) !== "Local content") return "";
  const assigned = Object.entries(course.countries).filter(([, value]) => value).map(([name]) => name);
  if (!assigned.length) return "Market to confirm";
  const latam = assigned.filter((country) => spanishLatamCountries.includes(country));
  const labels = assigned.filter((country) => !spanishLatamCountries.includes(country));
  if (latam.length > 1) labels.push("LATAM");
  else if (latam.length === 1) labels.push(latam[0]);
  const compact = labels.length > 3 ? [...labels.slice(0, 2), `+${labels.length - 2} markets`] : labels;
  return compact.join(" · ");
}
function normalize(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
function searchableText(course: Course) {
  const langs = Object.entries(course.languages).filter(([, value]) => value).map(([name]) => name);
  const markets = Object.entries(course.countries).filter(([, value]) => value).map(([name]) => name);
  const roleAliases = audienceList(course).flatMap((role) => ({
    Auditors: ["auditor", "auditors"], "Supervisors / Flow Leaders": ["supervisor", "supervisors", "flow leader", "flow leaders"],
    RTS: ["rts"], "AM / DM": ["am", "dm", "manager", "managers"], Sales: ["sales"],
    "LMS roles": ["lms", "lms role", "lms roles"], "All Employees": ["employee", "employees", "all employees"],
  }[role] || []));
  return normalize([course.title, textFor(course), course.category, course.audience, courseFamily(course), localMarketLabel(course), ...roleAliases, ...langs, ...markets].join(" "));
}
function matchesFilters(course: Course, query: string, filters: Filters) {
  const q = normalize(query.trim());
  const targets = audienceList(course);
  return (!q || searchableText(course).includes(q))
    && (!filters.families.length || filters.families.includes(courseFamily(course)))
    && (!filters.categories.length || filters.categories.includes(course.category))
    && (!filters.audiences.length || filters.audiences.some((role) => targets.some((target) => suitableFor[role]?.includes(target))))
    && (!filters.languages.length || filters.languages.some((language) => course.languages[language]))
    && (!filters.countries.length || filters.countries.some((country) => course.countries[country]));
}
function toggleValue(values: string[], value: string) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

function CourseCard({ course, onOpen, translationLanguage, translationDate }: { course: Course; onOpen: (course: Course) => void; translationLanguage?: string; translationDate?: string }) {
  const style = categoryStyle[course.category] || { icon: "•", tone: "navy" };
  return <article className="course-card">
    <div className={`course-art tone-${style.tone}`}>
      {isNew(course.date) && !translationLanguage && <span className="new-ribbon">NEW</span>}
      {translationLanguage && <span className="translation-banner">{translationLanguage}</span>}
      <span className="art-mark">{style.icon}</span><span className="art-title">{course.title}</span><span className="art-lines" aria-hidden="true" />
    </div>
    <div className="course-body">
      <div className="eyebrow-row"><span className="eyebrow-tags"><span className={`package-tag family-${courseFamily(course).replaceAll(" ", "-").toLowerCase()}`}>{courseFamily(course)}</span>{localMarketLabel(course) && <span className="market-tag">{localMarketLabel(course)}</span>}</span><span className="course-date">{translationDate ? prettyDate(translationDate) : prettyDate(course.date)}</span></div>
      <h3>{course.category}</h3><p className="course-copy">{textFor(course)}</p>
      <div className="pill-row">{audienceList(course).slice(0, 2).map((audience) => <span className="pill" key={audience}>{audience}</span>)}{course.series && <span className="pill pill-series">{course.series}</span>}</div>
    </div>
    <div className="course-meta"><span><Icon name="clock" />{displayDuration(course.duration)}</span><button className="text-button" onClick={() => onOpen(course)}>View details <span>›</span></button></div>
  </article>;
}

function CourseList({ items, onOpen, limit }: { items: Course[]; onOpen: (course: Course) => void; limit?: number }) {
  const [sort, setSort] = useState<{ key: "title" | "category"; direction: "asc" | "desc" } | null>(null);
  const sortedItems = useMemo(() => {
    if (!sort) return items;
    return [...items].sort((a, b) => {
      const result = a[sort.key].localeCompare(b[sort.key], "en", { sensitivity: "base" });
      return sort.direction === "asc" ? result : -result;
    });
  }, [items, sort]);
  function cycleSort(key: "title" | "category") {
    setSort((current) => {
      if (!current || current.key !== key) return { key, direction: "asc" };
      if (current.direction === "asc") return { key, direction: "desc" };
      return null;
    });
  }
  function sortMark(key: "title" | "category") {
    if (!sort || sort.key !== key) return "↕";
    return sort.direction === "asc" ? "↑" : "↓";
  }
  const visibleItems = typeof limit === "number" ? sortedItems.slice(0, limit) : sortedItems;
  return <div className="lesson-list">
    <div className="lesson-list-head"><button onClick={() => cycleSort("title")} aria-label="Sort lessons by title">Lesson <b>{sortMark("title")}</b></button><button onClick={() => cycleSort("category")} aria-label="Sort lessons by category">Category <b>{sortMark("category")}</b></button><span>Target audience</span><span>Description</span><span>Translations</span><span /></div>
    {visibleItems.map((course) => {
      const langs = Object.entries(course.languages).filter(([, value]) => value).map(([name]) => name);
      return <article className="lesson-row" key={course.key}>
        <div className="lesson-title"><span className={`mini-category tone-${(categoryStyle[course.category] || { tone: "navy" }).tone}`}>{(categoryStyle[course.category] || { icon: "•" }).icon}</span><span><span className="title-tags"><span className={`package-tag family-${courseFamily(course).replaceAll(" ", "-").toLowerCase()}`}>{courseFamily(course)}</span>{localMarketLabel(course) && <span className="market-tag">{localMarketLabel(course)}</span>}</span><strong>{course.title}</strong><small>{prettyDate(course.date)} · {displayDuration(course.duration)}</small></span></div>
        <div className="lesson-category" data-label="Category">{course.category}</div>
        <div className="lesson-audience" data-label="Target audience">{audienceList(course).map((role) => <span key={role}>{role}</span>)}</div>
        <p className="lesson-description" data-label="Description">{textFor(course)}</p>
        <div className="lesson-languages" data-label="Translations">{langs.slice(0, 3).map((language) => <span key={language}>{language}</span>)}{langs.length > 3 && <b>+{langs.length - 3}</b>}{!langs.length && <em>—</em>}</div>
        <button className="row-action" onClick={() => onOpen(course)} aria-label={`View ${course.title}`}>View <span>›</span></button>
      </article>;
    })}
  </div>;
}

function FilterGroup({ title, options, selected, onToggle }: { title: string; options: string[]; selected: string[]; onToggle: (value: string) => void }) {
  return <fieldset className="checkbox-group"><legend>{title}</legend><div>{options.map((option) => <label key={option}><input type="checkbox" checked={selected.includes(option)} onChange={() => onToggle(option)} /><span>{option}</span></label>)}</div></fieldset>;
}
function FilterPanel({ filters, setFilters, categories, languages, includeCountries = true, lockedCountry }: {
  filters: Filters; setFilters: (next: Filters) => void; categories: string[]; languages: string[]; includeCountries?: boolean; lockedCountry?: string;
}) {
  return <div className="checkbox-filter-panel">
    {lockedCountry && <div className="locked-filter"><Icon name="pin" /><span>Assigned in <strong>{lockedCountry}</strong></span></div>}
    <FilterGroup title="Content type" options={familyOptions} selected={filters.families} onToggle={(value) => setFilters({ ...filters, families: toggleValue(filters.families, value) })} />
    <FilterGroup title="Category" options={categories} selected={filters.categories} onToggle={(value) => setFilters({ ...filters, categories: toggleValue(filters.categories, value) })} />
    <FilterGroup title="Suitable for" options={audienceOptions} selected={filters.audiences} onToggle={(value) => setFilters({ ...filters, audiences: toggleValue(filters.audiences, value) })} />
    <FilterGroup title="Translation" options={languages} selected={filters.languages} onToggle={(value) => setFilters({ ...filters, languages: toggleValue(filters.languages, value) })} />
    {includeCountries && <FilterGroup title="Assigned in" options={countries} selected={filters.countries} onToggle={(value) => setFilters({ ...filters, countries: toggleValue(filters.countries, value) })} />}
  </div>;
}
function PageHeading({ kicker, title, copy }: { kicker?: string; title: string; copy: string }) {
  return <div className="page-heading">{kicker && <span>{kicker}</span>}<h1>{title}</h1><p>{copy}</p></div>;
}
function Donut({ value, label }: { value: number; label: string }) {
  return <div className="donut-card"><div className="donut" style={{ background: `conic-gradient(var(--red) 0 ${value}%, #e7eaec ${value}% 100%)` }}><span>{value}%</span></div><div><strong>{label}</strong><p>of all current Global Package lessons</p></div></div>;
}

export default function Home() {
  const [page, setPage] = useState<PageName>("home");
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [countryQuery, setCountryQuery] = useState("");
  const [countryFilters, setCountryFilters] = useState<Filters>(emptyFilters);
  const [selectedCountry, setSelectedCountry] = useState("");
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [countryFiltersOpen, setCountryFiltersOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(20);
  const [countryVisibleCount, setCountryVisibleCount] = useState(6);
  const [countryFocus, setCountryFocus] = useState<"overview" | "global-unassigned" | "worth-checking">("overview");
  const [focusQuery, setFocusQuery] = useState("");
  const [openFaq, setOpenFaq] = useState(0);

  const categories = useMemo(() => [...new Set(courses.map((course) => course.category))].sort(), []);
  const languages = useMemo(() => Object.keys(courses[0]?.languages || {}), []);
  const latestCourses = useMemo(() => [...courses].sort((a, b) => parseDate(b.date).getTime() - parseDate(a.date).getTime()).slice(0, 5), []);
  const currentUpdate = useMemo(() => [...updates].filter((item) => item.show && item.title).sort((a, b) => parseDate(b.date).getTime() - parseDate(a.date).getTime())[0], []);
  const recentlyTranslated = useMemo(() => translationEvents
    .map((event) => {
      const language = languageNames[event.language] || event.language;
      const course = courses.find((item) => item.title === event.title);
      return course && course.languages[language] ? { course, language, date: event.date } : null;
    })
    .filter((item): item is { course: Course; language: string; date: string } => Boolean(item))
    .sort((a, b) => parseDate(b.date).getTime() - parseDate(a.date).getTime())
    .slice(0, 5), []);
  const filteredCourses = useMemo(() => courses.filter((course) => matchesFilters(course, query, filters)), [query, filters]);
  const activeFilters = Object.values(filters).reduce((sum, values) => sum + values.length, 0);

  useEffect(() => {
    if (!selectedCourse) return;
    const close = (event: KeyboardEvent) => event.key === "Escape" && setSelectedCourse(null);
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [selectedCourse]);

  const assigned = selectedCountry ? courses.filter((course) => course.countries[selectedCountry]) : [];
  const requirements = selectedCountry ? countryRequirements[selectedCountry] || [] : [];
  const translatedNotAssigned = selectedCountry ? courses.filter((course) => !course.countries[selectedCountry] && requirements.every((language) => course.languages[language])) : [];
  const globalCourses = courses.filter((course) => course.globalPackage);
  const globalAssigned = assigned.filter((course) => course.globalPackage);
  const globalNotAssigned = selectedCountry ? globalCourses.filter((course) => !course.countries[selectedCountry]) : [];
  const globalTranslated = selectedCountry ? globalCourses.filter((course) => requirements.every((language) => course.languages[language])) : [];
  const assignmentPct = globalCourses.length ? Math.round(globalAssigned.length / globalCourses.length * 100) : 0;
  const translationPct = globalCourses.length ? Math.round(globalTranslated.length / globalCourses.length * 100) : 0;
  const categoryCounts = categories.map((category) => ({ category, count: assigned.filter((course) => course.category === category).length })).filter((item) => item.count).sort((a, b) => b.count - a.count);
  const countryCatalog = assigned.filter((course) => matchesFilters(course, countryQuery, { ...countryFilters, countries: [] }));
  const focusItems = (countryFocus === "global-unassigned" ? globalNotAssigned : translatedNotAssigned).filter((course) => !focusQuery.trim() || searchableText(course).includes(normalize(focusQuery.trim())));

  function navigate(next: PageName) {
    setPage(next); setFiltersOpen(false); window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function clearCatalogFilters() { setQuery(""); setFilters(emptyFilters); setVisibleCount(20); }
  function resetCountry() { setCountryQuery(""); setCountryFilters(emptyFilters); setCountryVisibleCount(6); setCountryFocus("overview"); setFocusQuery(""); }

  return <div className="site-shell">
    <header className="topbar">
      <button className="brand" onClick={() => navigate("home")} aria-label="WeLearn Course Catalog home"><span className="brand-bulb">✺</span><span>WE<span>LEARN</span></span></button>
      <span className="brand-divider" /><span className="product-name">Course Catalog</span>
      <div className="quick-search"><Icon name="search" /><input value={query} onChange={(event) => setQuery(event.target.value)} onFocus={() => navigate("catalog")} placeholder="Search lessons, skills or topics" aria-label="Quick search" />{query && <button onClick={() => setQuery("")} aria-label="Clear search">×</button>}</div>
    </header>
    <aside className="side-nav" aria-label="Main navigation">
      {([["home", "home", "Home"], ["catalog", "book", "Catalog"], ["country", "pin", "My Country"], ["faq", "help", "FAQ"]] as [PageName, "home" | "book" | "pin" | "help", string][]).map(([id, icon, label]) => <button key={id} className={page === id ? "active" : ""} onClick={() => navigate(id)} aria-label={label} title={label}><Icon name={icon} /><span>{label}</span></button>)}
    </aside>
    <main className="main-area">
      <div className="red-band"><strong>{page === "home" ? "Home" : page === "catalog" ? "Catalog" : page === "country" ? "My Country" : "Help & FAQ"}</strong><small>WeLearn Course Catalog · Prototype V1</small></div>

      {page === "home" && <>
        <section className="hero section-wrap">
          <div className="hero-copy"><h1>WeLearn Course Catalog</h1><p>Browse published lessons, check available translations and see what is currently assigned in each country.</p>
            <div className="hero-search"><Icon name="search" /><input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => event.key === "Enter" && navigate("catalog")} placeholder="Search by title, role, topic or language" /><button onClick={() => navigate("catalog")}>Search</button></div>
            <div className="catalog-update"><span>i</span><div><small>WELEARN UPDATES{currentUpdate?.date ? ` · ${prettyDate(currentUpdate.date)}` : ""}</small><strong>{currentUpdate?.title || "No current update"}</strong><p>{currentUpdate?.message || "Platform news, rollout notes and other WeLearn updates will appear here when needed."}</p></div></div>
          </div>
          <div className="hero-panel">
            <div className="hero-stat primary"><strong>{courses.length}</strong><span>published lessons</span></div>
            <div className="hero-stat"><strong>{globalCourses.length}</strong><span>Global Package lessons</span></div>
            <div className="hero-stat"><strong>{courses.filter((course) => courseFamily(course) === "Sales content").length}</strong><span>Sales lessons</span></div>
            <div className="hero-stat"><strong>{countries.length}</strong><span>countries tracked</span></div>
            <button onClick={() => navigate("country")}><Icon name="pin" /><span><strong>Open My Country</strong><small>Assignments, translations and coverage</small></span><b>›</b></button>
          </div>
        </section>
        <section className="section-wrap latest-section"><div className="section-title"><div><h2>Recently published</h2><p>Latest lessons added to the catalog.</p></div><button className="outline-button" onClick={() => navigate("catalog")}>View all <span>›</span></button></div><div className="course-grid home-course-grid">{latestCourses.map((course) => <CourseCard key={course.key} course={course} onOpen={setSelectedCourse} />)}</div></section>
        <section className="section-wrap translated-section"><div className="section-title"><div><h2>Recently translated</h2><p>Latest completed translations recorded in the Translation Log.</p></div></div><div className="course-grid home-course-grid">{recentlyTranslated.map(({ course, language, date }) => <CourseCard key={`${course.key}-${language}-${date}`} course={course} translationLanguage={language} translationDate={date} onOpen={setSelectedCourse} />)}</div></section>
        <section className="section-wrap paths">
          <button onClick={() => { setFilters({ ...emptyFilters, families: ["Global Package"] }); navigate("catalog"); }}><span className="path-icon red">G</span><span><strong>Global Package</strong><p>Lessons available for countries to adopt or translate.</p></span><b>›</b></button>
          <button onClick={() => { setFilters({ ...emptyFilters, families: ["Sales content"] }); navigate("catalog"); }}><span className="path-icon gold">S</span><span><strong>Sales content</strong><p>Internally created sales training with a separately managed rollout.</p></span><b>›</b></button>
          <button onClick={() => { setFilters({ ...emptyFilters, families: ["Local content"] }); navigate("catalog"); }}><span className="path-icon navy">✦</span><span><strong>Local content</strong><p>Country, customer and local creations shared for reference.</p></span><b>›</b></button>
          <button onClick={() => { setFilters({ ...emptyFilters, families: ["Specific content"] }); navigate("catalog"); }}><span className="path-icon teal">◆</span><span><strong>Specific content</strong><p>Internally created lessons with a targeted, directly managed rollout.</p></span><b>›</b></button>
        </section>
      </>}

      {page === "catalog" && <section className="section-wrap catalog-page">
        <PageHeading title="Course Catalog" copy="Search every published lesson by title, description, audience, language or country." />
        <div className="catalog-toolbar"><label className="catalog-search"><Icon name="search" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search titles, descriptions, roles and translations" /><span>{filteredCourses.length} result{filteredCourses.length !== 1 ? "s" : ""}</span></label><button className={`filter-toggle ${filtersOpen ? "active" : ""}`} onClick={() => setFiltersOpen(!filtersOpen)}><Icon name="filter" />Filters {activeFilters > 0 && <b>{activeFilters}</b>}</button></div>
        {filtersOpen && <FilterPanel filters={filters} setFilters={setFilters} categories={categories} languages={languages} />}
        {(query || activeFilters > 0) && <div className="results-summary"><span><strong>{filteredCourses.length}</strong> matching lessons</span><button onClick={clearCatalogFilters}>Reset search and filters</button></div>}
        {filteredCourses.length ? <><CourseList items={filteredCourses} limit={visibleCount} onOpen={setSelectedCourse} />{visibleCount < filteredCourses.length && <button className="load-more" onClick={() => setVisibleCount(visibleCount + 20)}>Show 20 more <span>{filteredCourses.length - visibleCount} remaining</span></button>}</> : <div className="empty-state"><span>⌕</span><h2>No lesson found</h2><p>Try a broader keyword or clear one of the filters.</p><button onClick={clearCatalogFilters}>Clear all filters</button></div>}
      </section>}

      {page === "country" && <section className="section-wrap country-page">
        <PageHeading title="My Country" copy="Select one country to view its assignments and translation coverage. No other country’s results are displayed or compared." />
        <div className={`country-picker ${selectedCountry ? "selected" : ""}`}><label htmlFor="country-select">Select a country</label><select id="country-select" value={selectedCountry} onChange={(event) => { setSelectedCountry(event.target.value); resetCountry(); }}><option value="">Choose a country…</option>{countries.map((value) => <option key={value}>{value}</option>)}</select>{!selectedCountry && <p>Country data will appear after you make a selection.</p>}</div>
        {selectedCountry && countryFocus !== "overview" && <section className="country-focus-page">
          <button className="back-button" onClick={() => { setCountryFocus("overview"); setFocusQuery(""); }}>‹ Back to {selectedCountry} overview</button>
          <div className="focus-heading"><div><span>{countryFocus === "global-unassigned" ? "GLOBAL PACKAGE" : "TRANSLATION STATUS"}</span><h2>{countryFocus === "global-unassigned" ? "Global Package lessons not assigned" : "Worth checking"}</h2><p>{countryFocus === "global-unassigned" ? `These Global Package lessons are not currently recorded as assigned in ${selectedCountry}.` : `The required translation is recorded, but no assignment is shown for ${selectedCountry}.`}</p></div><strong>{focusItems.length}</strong></div>
          <label className="catalog-search focus-search"><Icon name="search" /><input value={focusQuery} onChange={(event) => setFocusQuery(event.target.value)} placeholder="Search this list" /><span>{focusItems.length} results</span></label>
          <CourseList items={focusItems} onOpen={setSelectedCourse} />
        </section>}
        {selectedCountry && countryFocus === "overview" && <>
          <div className="country-rule"><span><Icon name="globe" /></span><div><small>RELEASE REQUIREMENT</small><strong>{selectedCountry === "Israel" ? "Hebrew & Russian are both required" : selectedCountry === "Switzerland" ? "French & German are both required" : `${requirements.join(" & ")} translation required`}</strong><p>A translation record and a country assignment are tracked separately.</p></div></div>
          <div className="stat-grid">
            <div><span className="stat-icon navy"><Icon name="book" /></span><strong>{assigned.length}</strong><p>lessons currently assigned</p></div>
            <div><span className="stat-icon red">G</span><strong>{globalAssigned.length}</strong><p>Global Package lessons assigned</p></div>
            <div><span className="stat-icon gold"><Icon name="globe" /></span><strong>{translatedNotAssigned.length}</strong><p>translated, but not assigned</p></div>
            <button className="stat-action" onClick={() => setCountryFocus("global-unassigned")}><span className="stat-icon teal">!</span><strong>{globalNotAssigned.length}</strong><p>Global Package lessons not assigned</p><em>View list ›</em></button>
          </div>
          <div className="country-insights">
            <section><div className="insight-heading"><h2>Global Package coverage</h2><p>Percentages for {selectedCountry} only.</p></div><div className="donut-grid"><Donut value={assignmentPct} label="Assigned" /><Donut value={translationPct} label="Translated" /></div></section>
            <section><div className="insight-heading"><h2>Category overview</h2><p>Assigned lessons by category.</p></div><div className="bar-list">{categoryCounts.slice(0, 6).map(({ category, count }) => <div key={category}><span>{category}</span><div><i style={{ width: `${Math.max(7, Math.round(count / Math.max(...categoryCounts.map((item) => item.count)) * 100))}%` }} /></div><b>{count}</b></div>)}</div></section>
            <section className="worth-summary"><span className="worth-icon">!</span><small>TRANSLATION RECORDED</small><strong>{translatedNotAssigned.length}</strong><h2>Worth checking</h2><p>Lessons with the required translation but no recorded assignment for {selectedCountry}.</p><button onClick={() => setCountryFocus("worth-checking")}>View list <span>›</span></button></section>
          </div>
          <section className="country-catalog">
            <div className="country-catalog-heading"><div><h2>Assigned lessons</h2><p>The country assignment is already applied. Use the other filters to refine this list.</p></div><span>{countryCatalog.length}</span></div>
            <div className="catalog-toolbar"><label className="catalog-search"><Icon name="search" /><input value={countryQuery} onChange={(event) => setCountryQuery(event.target.value)} placeholder={`Search lessons assigned in ${selectedCountry}`} /><span>{countryCatalog.length} results</span></label><button className={`filter-toggle ${countryFiltersOpen ? "active" : ""}`} onClick={() => setCountryFiltersOpen(!countryFiltersOpen)}><Icon name="filter" />Filters {Object.values(countryFilters).reduce((sum, values) => sum + values.length, 0) > 0 && <b>{Object.values(countryFilters).reduce((sum, values) => sum + values.length, 0)}</b>}</button></div>
            {countryFiltersOpen && <FilterPanel filters={countryFilters} setFilters={setCountryFilters} categories={categories} languages={languages} includeCountries={false} lockedCountry={selectedCountry} />}
            <CourseList items={countryCatalog} limit={countryVisibleCount} onOpen={setSelectedCourse} />
            {countryVisibleCount < countryCatalog.length && <button className="load-more" onClick={() => setCountryVisibleCount(countryVisibleCount + 20)}>Show more assigned lessons <span>{countryCatalog.length - countryVisibleCount} remaining</span></button>}
          </section>
        </>}
      </section>}

      {page === "faq" && <section className="section-wrap faq-page"><PageHeading title="Help & FAQ" copy="Information for discovering, requesting and adopting WeLearn content." /><div className="faq-layout"><div className="faq-list">{faqItems.map(([question, answer], index) => <div className={`faq-item ${openFaq === index ? "open" : ""}`} key={question}><button onClick={() => setOpenFaq(openFaq === index ? -1 : index)}><span>{String(index + 1).padStart(2, "0")}</span><strong>{question}</strong><b>{openFaq === index ? "−" : "+"}</b></button>{openFaq === index && <p>{answer}</p>}</div>)}</div><aside className="contact-card"><span className="contact-mark">?</span><small>CONTACT</small><h2>Ask Allison</h2><p>Send the lesson name, country and intended audience.</p><a href="mailto:?subject=WeLearn%20Catalog%20question"><Icon name="mail" />Start an email</a><em>Open a lesson first for a pre-filled request.</em></aside></div></section>}
    </main>
    <footer><span>✺ WE<span>LEARN</span></span><p>Course Catalog · Internal prototype</p><small>© 2026 RGIS</small></footer>

    {selectedCourse && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setSelectedCourse(null)}><article className="course-modal" role="dialog" aria-modal="true" aria-labelledby="course-modal-title">
      <button className="modal-close" onClick={() => setSelectedCourse(null)} aria-label="Close details"><Icon name="close" /></button>
      <div className={`modal-art tone-${(categoryStyle[selectedCourse.category] || { tone: "navy" }).tone}`}><span>{(categoryStyle[selectedCourse.category] || { icon: "•" }).icon}</span><small>{selectedCourse.category}</small></div>
      <div className="modal-content"><div className="modal-tags"><span className={`package-tag family-${courseFamily(selectedCourse).replaceAll(" ", "-").toLowerCase()}`}>{courseFamily(selectedCourse)}</span>{localMarketLabel(selectedCourse) && <span className="market-tag">{localMarketLabel(selectedCourse)}</span>}{isNew(selectedCourse.date) && <span className="new-pill">New</span>}</div><h2 id="course-modal-title">{selectedCourse.title}</h2><p className="modal-description">{textFor(selectedCourse)}</p>
        {courseFamily(selectedCourse) === "Local content" && <div className="info-note"><strong>Shared for reference · {localMarketLabel(selectedCourse)}</strong><span>This content was created for a country, customer or local need. Ask if it could be adapted for your market.</span></div>}
        {courseFamily(selectedCourse) === "Sales content" && <div className="info-note sales-note"><strong>Sales rollout</strong><span>This internally created lesson is managed separately from the Global Package.</span></div>}
        {courseFamily(selectedCourse) === "Specific content" && <div className="info-note specific-note"><strong>Targeted internal content</strong><span>This lesson was created internally for a specific need and is assigned only to the relevant audience.</span></div>}
        {selectedCourse.companionAssignment && <div className="info-note assignment-note"><strong>Practical follow-up</strong><span>This lesson ends with a separate practical assignment.</span></div>}
        <div className="detail-grid"><div><small>SUITABLE FOR</small><p>{audienceList(selectedCourse).join(" · ")}</p></div><div><small>ESTIMATED TIME</small><p>{displayDuration(selectedCourse.duration)}</p></div><div><small>PUBLISHED</small><p>{prettyDate(selectedCourse.date)}</p></div><div><small>FEATURES</small><p>{[selectedCourse.quiz && "Quiz", selectedCourse.certificate && "Certificate", selectedCourse.series].filter(Boolean).join(" · ") || "Standard lesson"}</p></div></div>
        <div className="availability"><div><small>TRANSLATIONS RECORDED</small><div className="tag-cloud">{Object.entries(selectedCourse.languages).filter(([, value]) => value).map(([name]) => <span key={name}>{name}</span>)}{!Object.values(selectedCourse.languages).some(Boolean) && <em>No translation status recorded</em>}</div></div><div><small>ASSIGNED COUNTRIES</small><div className="tag-cloud countries">{Object.entries(selectedCourse.countries).filter(([, value]) => value).map(([name]) => <span key={name}>{name}</span>)}{!Object.values(selectedCourse.countries).some(Boolean) && <em>No country assignment recorded</em>}</div></div></div>
        {selectedCourse.prerequisite && <p className="prerequisite"><strong>Required course:</strong> {selectedCourse.prerequisite}</p>}
        <div className="modal-actions">{courseFamily(selectedCourse) === "Global Package" ? <><a className="primary-action" href={`mailto:?subject=${encodeURIComponent(`WeLearn assignment request – ${selectedCourse.title}`)}&body=${encodeURIComponent(`Hi Allison,\n\nI would like to request the assignment of “${selectedCourse.title}”.\n\nCountry:\nTarget audience:\nDesired timing:\n\nThank you.`)}`}><Icon name="mail" />Request assignment</a><a className="secondary-action" href={`mailto:?subject=${encodeURIComponent(`WeLearn translation request – ${selectedCourse.title}`)}&body=${encodeURIComponent(`Hi Allison,\n\nI would like to discuss translating “${selectedCourse.title}”.\n\nCountry / language:\nTarget audience:\nDesired timing:\n\nThank you.`)}`}>Request translation</a></> : <a className="primary-action" href={`mailto:?subject=${encodeURIComponent(`Question about WeLearn lesson – ${selectedCourse.title}`)}&body=${encodeURIComponent(`Hi Allison,\n\nI would like to know more about “${selectedCourse.title}”.\n\nCountry:\nContext / need:\n\nThank you.`)}`}><Icon name="mail" />Ask about this lesson</a>}</div>
      </div>
    </article></div>}
  </div>;
}
