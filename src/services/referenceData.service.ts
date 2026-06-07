/**
 * Reference-data service — SINGLE SOURCE OF TRUTH for AVETMISS classification codes.
 *
 * Parses the official NCVER coding files (embedded as raw TSV in ../data) ONCE at module
 * load and exposes:
 *   • name → code resolution (full variant index, e.g. "Holland" → 2308, "Burma" → 5101)
 *   • valid code sets (for NAT-file validation)
 *   • clean {value,label} option lists for the frontend dropdowns
 *
 * Both the AVETMISS report generator (avetmiss.service.ts) and the public reference-data
 * API (referenceData.controller.ts) read from here, so the dropdown a user picks from and
 * the code written to the NAT file can never disagree.
 *
 * Sources:
 *   • SACC country coding index, revised 24 Oct 2025
 *   • ASCL language system file, 2016 (ABS cat. 1267.0)
 */
import { VALID_ASCL_LANGUAGE_CODES } from "../constants/ascl-languages.constant";
import { ASCL_LANGUAGE_INDEX_RAW } from "../data/ascl-language-index.data";
import { SACC_COUNTRY_INDEX_RAW } from "../data/sacc-country-index.data";

export const COUNTRY_INDEX_VERSION = "2025-10-24";
export const LANGUAGE_INDEX_VERSION = "2016";

export interface ReferenceOption {
  value: string;
  label: string;
}

/**
 * Normalise a name for matching: lowercase, strip diacritics, "&"→"and",
 * "saint "→"st ", drop punctuation, collapse whitespace.
 */
const normalizeName = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip combining accents (Curaçao → Curacao)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\bsaint\b/g, "st")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");

const parseTsv = (raw: string): Array<{ code: string; description: string }> =>
  raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const tab = line.indexOf("\t");
      return { code: line.slice(0, tab).trim(), description: line.slice(tab + 1).trim() };
    })
    .filter((row) => row.code && row.description);

// ───────────────────────────── Country (SACC) ─────────────────────────────

const countryRows = parseTsv(SACC_COUNTRY_INDEX_RAW);

/** Every distinct code in the index — the authoritative valid set for the NAT file. */
export const COUNTRY_CODE_SET: ReadonlySet<string> = new Set(countryRows.map((r) => r.code));

/** Full variant index: any official name / alternate spelling / old name → SACC code. */
export const COUNTRY_NAME_TO_CODE: ReadonlyMap<string, string> = (() => {
  const map = new Map<string, string>();
  for (const { code, description } of countryRows) {
    const key = normalizeName(description);
    if (key && !map.has(key)) map.set(key, code);
  }
  // Legacy aliases for values stored by the old (phone-list-derived) frontend dropdown.
  const aliases: Record<string, string> = {
    "united states canada": "8104",
    "russia kazakhstan": "3308",
    "antarctica australian territories": "1603",
    "democratic republic of the congo": "9108",
    "republic of the congo": "9107",
    macau: "6103"
  };
  for (const [name, code] of Object.entries(aliases)) {
    const key = normalizeName(name);
    if (!map.has(key)) map.set(key, code);
  }
  return map;
})();

/**
 * Curated canonical label per reportable SACC code (the dropdown list).
 * Resolution above uses the FULL index, so legacy/variant names still resolve even if
 * they are not offered here. Aggregate/region rows (codes ending "00") and the
 * "inadequately described" / supplementary catch-alls are intentionally excluded.
 */
const CANONICAL_COUNTRY_LABEL: Record<string, string> = {
  "1101": "Australia",
  "1102": "Norfolk Island",
  "1199": "Australian External Territories, nec",
  "1201": "New Zealand",
  "1301": "New Caledonia",
  "1302": "Papua New Guinea",
  "1303": "Solomon Islands",
  "1304": "Vanuatu",
  "1401": "Guam",
  "1402": "Kiribati",
  "1403": "Marshall Islands",
  "1404": "Micronesia, Federated States of",
  "1405": "Nauru",
  "1406": "Northern Mariana Islands",
  "1407": "Palau",
  "1501": "Cook Islands",
  "1502": "Fiji",
  "1503": "French Polynesia",
  "1504": "Niue",
  "1505": "Samoa",
  "1506": "American Samoa",
  "1507": "Tokelau",
  "1508": "Tonga",
  "1511": "Tuvalu",
  "1512": "Wallis and Futuna",
  "1513": "Pitcairn Islands",
  "1599": "Polynesia (excludes Hawaii), nec",
  "1601": "Adelie Land (France)",
  "1602": "Argentinian Antarctic Territory",
  "1603": "Australian Antarctic Territory",
  "1604": "British Antarctic Territory",
  "1605": "Chilean Antarctic Territory",
  "1606": "Queen Maud Land (Norway)",
  "1607": "Ross Dependency (New Zealand)",
  "2102": "England",
  "2103": "Isle of Man",
  "2104": "Northern Ireland",
  "2105": "Scotland",
  "2106": "Wales",
  "2107": "Guernsey",
  "2108": "Jersey",
  "2201": "Ireland",
  "2301": "Austria",
  "2302": "Belgium",
  "2303": "France",
  "2304": "Germany",
  "2305": "Liechtenstein",
  "2306": "Luxembourg",
  "2307": "Monaco",
  "2308": "Netherlands",
  "2311": "Switzerland",
  "2401": "Denmark",
  "2402": "Faroe Islands",
  "2403": "Finland",
  "2404": "Greenland",
  "2405": "Iceland",
  "2406": "Norway",
  "2407": "Sweden",
  "2408": "Aland Islands",
  "3101": "Andorra",
  "3102": "Gibraltar",
  "3103": "Vatican City",
  "3104": "Italy",
  "3105": "Malta",
  "3106": "Portugal",
  "3107": "San Marino",
  "3108": "Spain",
  "3201": "Albania",
  "3202": "Bosnia and Herzegovina",
  "3203": "Bulgaria",
  "3204": "Croatia",
  "3205": "Cyprus",
  "3206": "North Macedonia",
  "3207": "Greece",
  "3208": "Moldova",
  "3211": "Romania",
  "3212": "Slovenia",
  "3214": "Montenegro",
  "3215": "Serbia",
  "3216": "Kosovo",
  "3301": "Belarus",
  "3302": "Czechia",
  "3303": "Estonia",
  "3304": "Hungary",
  "3305": "Latvia",
  "3306": "Lithuania",
  "3307": "Poland",
  "3308": "Russian Federation",
  "3311": "Slovakia",
  "3312": "Ukraine",
  "4101": "Algeria",
  "4102": "Egypt",
  "4103": "Libya",
  "4104": "Morocco",
  "4105": "Sudan",
  "4106": "Tunisia",
  "4107": "Western Sahara",
  "4108": "Spanish North Africa",
  "4111": "South Sudan",
  "4201": "Bahrain",
  "4202": "Gaza Strip and West Bank",
  "4203": "Iran",
  "4204": "Iraq",
  "4205": "Israel",
  "4206": "Jordan",
  "4207": "Kuwait",
  "4208": "Lebanon",
  "4211": "Oman",
  "4212": "Qatar",
  "4213": "Saudi Arabia",
  "4214": "Syria",
  "4215": "Turkey",
  "4216": "United Arab Emirates",
  "4217": "Yemen",
  "5101": "Myanmar",
  "5102": "Cambodia",
  "5103": "Laos",
  "5104": "Thailand",
  "5105": "Vietnam",
  "5201": "Brunei Darussalam",
  "5202": "Indonesia",
  "5203": "Malaysia",
  "5204": "Philippines",
  "5205": "Singapore",
  "5206": "Timor-Leste",
  "6101": "China",
  "6102": "Hong Kong (SAR of China)",
  "6103": "Macau (SAR of China)",
  "6104": "Mongolia",
  "6105": "Taiwan",
  "6201": "Japan",
  "6202": "Korea, Democratic People's Republic of (North)",
  "6203": "Korea, Republic of (South)",
  "7101": "Bangladesh",
  "7102": "Bhutan",
  "7103": "India",
  "7104": "Maldives",
  "7105": "Nepal",
  "7106": "Pakistan",
  "7107": "Sri Lanka",
  "7201": "Afghanistan",
  "7202": "Armenia",
  "7203": "Azerbaijan",
  "7204": "Georgia",
  "7205": "Kazakhstan",
  "7206": "Kyrgyzstan",
  "7207": "Tajikistan",
  "7208": "Turkmenistan",
  "7211": "Uzbekistan",
  "8101": "Bermuda",
  "8102": "Canada",
  "8103": "St Pierre and Miquelon",
  "8104": "United States of America",
  "8201": "Argentina",
  "8202": "Bolivia",
  "8203": "Brazil",
  "8204": "Chile",
  "8205": "Colombia",
  "8206": "Ecuador",
  "8207": "Falkland Islands",
  "8208": "French Guiana",
  "8211": "Guyana",
  "8212": "Paraguay",
  "8213": "Peru",
  "8214": "Suriname",
  "8215": "Uruguay",
  "8216": "Venezuela",
  "8299": "South America, nec",
  "8301": "Belize",
  "8302": "Costa Rica",
  "8303": "El Salvador",
  "8304": "Guatemala",
  "8305": "Honduras",
  "8306": "Mexico",
  "8307": "Nicaragua",
  "8308": "Panama",
  "8401": "Anguilla",
  "8402": "Antigua and Barbuda",
  "8403": "Aruba",
  "8404": "Bahamas",
  "8405": "Barbados",
  "8406": "Cayman Islands",
  "8407": "Cuba",
  "8408": "Dominica",
  "8411": "Dominican Republic",
  "8412": "Grenada",
  "8413": "Guadeloupe",
  "8414": "Haiti",
  "8415": "Jamaica",
  "8416": "Martinique",
  "8417": "Montserrat",
  "8421": "Puerto Rico",
  "8422": "St Kitts and Nevis",
  "8423": "St Lucia",
  "8424": "St Vincent and the Grenadines",
  "8425": "Trinidad and Tobago",
  "8426": "Turks and Caicos Islands",
  "8427": "British Virgin Islands",
  "8428": "United States Virgin Islands",
  "8431": "St Barthelemy",
  "8432": "St Martin (French part)",
  "8433": "Bonaire, Sint Eustatius and Saba",
  "8434": "Curacao",
  "8435": "Sint Maarten (Dutch part)",
  "9101": "Benin",
  "9102": "Burkina Faso",
  "9103": "Cameroon",
  "9104": "Cabo Verde",
  "9105": "Central African Republic",
  "9106": "Chad",
  "9107": "Congo, Republic of",
  "9108": "Congo, Democratic Republic of",
  "9111": "Cote d'Ivoire",
  "9112": "Equatorial Guinea",
  "9113": "Gabon",
  "9114": "Gambia",
  "9115": "Ghana",
  "9116": "Guinea",
  "9117": "Guinea-Bissau",
  "9118": "Liberia",
  "9121": "Mali",
  "9122": "Mauritania",
  "9123": "Niger",
  "9124": "Nigeria",
  "9125": "Sao Tome and Principe",
  "9126": "Senegal",
  "9127": "Sierra Leone",
  "9128": "Togo",
  "9201": "Angola",
  "9202": "Botswana",
  "9203": "Burundi",
  "9204": "Comoros",
  "9205": "Djibouti",
  "9206": "Eritrea",
  "9207": "Ethiopia",
  "9208": "Kenya",
  "9211": "Lesotho",
  "9212": "Madagascar",
  "9213": "Malawi",
  "9214": "Mauritius",
  "9215": "Mayotte",
  "9216": "Mozambique",
  "9217": "Namibia",
  "9218": "Reunion",
  "9221": "Rwanda",
  "9222": "St Helena, Ascension and Tristan da Cunha",
  "9223": "Seychelles",
  "9224": "Somalia",
  "9225": "South Africa",
  "9226": "Eswatini",
  "9227": "Tanzania",
  "9228": "Uganda",
  "9231": "Zambia",
  "9232": "Zimbabwe",
  "9299": "Southern and East Africa, nec"
};

/** Dropdown list for country of birth / citizenship — sorted by label. */
export const COUNTRY_OPTIONS: ReadonlyArray<ReferenceOption> = Object.entries(CANONICAL_COUNTRY_LABEL)
  .map(([value, label]) => ({ value, label }))
  .sort((a, b) => a.label.localeCompare(b.label));

/**
 * Resolve a stored country value to its 4-digit SACC code.
 * Accepts an existing code (validated) or any name/variant; returns "@@@@" when blank or
 * unresolved so the NAT file stays valid.
 */
export const resolveCountryCode = (value: string | undefined): string => {
  const raw = (value ?? "").trim();
  if (!raw) return "@@@@";
  if (/^\d{4}$/.test(raw) && COUNTRY_CODE_SET.has(raw)) return raw;
  return COUNTRY_NAME_TO_CODE.get(normalizeName(raw)) ?? "@@@@";
};

// ───────────────────────────── Language (ASCL) ─────────────────────────────

const languageRows = parseTsv(ASCL_LANGUAGE_INDEX_RAW);

/** Name → ASCL code, restricted to valid (reportable) leaf codes. */
export const LANGUAGE_NAME_TO_CODE: ReadonlyMap<string, string> = (() => {
  const map = new Map<string, string>();
  for (const { code, description } of languageRows) {
    if (!VALID_ASCL_LANGUAGE_CODES.has(code)) continue; // skip group headers / not-specified
    const key = normalizeName(description);
    if (key && !map.has(key)) map.set(key, code);
  }
  return map;
})();

/** Dropdown list for language identifier — valid leaf codes + an explicit not-stated row. */
export const LANGUAGE_OPTIONS: ReadonlyArray<ReferenceOption> = (() => {
  const opts = languageRows
    .filter((r) => VALID_ASCL_LANGUAGE_CODES.has(r.code))
    .map((r) => ({ value: r.code, label: r.description }))
    .sort((a, b) => a.label.localeCompare(b.label));
  return [...opts, { value: "@@@@", label: "Not stated" }];
})();

/**
 * Resolve a stored language value to its 4-digit ASCL code.
 * Accepts an existing code (validated against the official ASCL set) or any name; returns
 * "@@@@" when blank or unresolved.
 */
export const resolveLanguageCode = (value: string | undefined): string => {
  const raw = (value ?? "").trim();
  if (!raw || raw.toUpperCase() === "@@@@") return "@@@@";
  if (/^\d{4}$/.test(raw)) return VALID_ASCL_LANGUAGE_CODES.has(raw) ? raw : "@@@@";
  return LANGUAGE_NAME_TO_CODE.get(normalizeName(raw)) ?? "@@@@";
};
