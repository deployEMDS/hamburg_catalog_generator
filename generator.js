import fs from "fs";
import path from "path";
import { program } from "commander";
import pLimit from "p-limit";

// Example Concurrency of 10 promises at once
const limit = pLimit(10);

// Default parameters
const DEFAULT_PAGE_SIZE = 50;
const TIME_INTERVAL_LIST = {
  P15M: "http://publications.europa.eu/resource/authority/frequency/15MIN",
  P1H: "http://publications.europa.eu/resource/authority/frequency/HOURLY",
  P1D: "http://publications.europa.eu/resource/authority/frequency/DAILY"
};

const DEFAULT_PROFILE_LINK =
  "https://pod.rubendedecker.be/scholar/deployEMDS/data/catalogs/profile_catalog#sensorthings-api-profile";
const DEFAULT_CATALOG_HOME =
  "https://pod.rubendedecker.be/scholar/deployEMDS/data/datasets/catalog";
const DEFAULT_LANGUAGE = "de";
const DEFAULT_DESCRIPTION_LANGUAGE = "en";
const DEFAULT_BASE_URL =
  "https://pod.rubendedecker.be/scholar/deployEMDS/data/datasets/catalog";

// ---- Helper: Build context ----
function buildContext(baseUrl) {
  return {
    "@context": {
      "@base": baseUrl,
      "@vocab": "http://www.w3.org/ns/dcat#",
      dct: "http://purl.org/dc/terms/",
      dcat: "http://www.w3.org/ns/dcat#",
      foaf: "http://xmlns.com/foaf/0.1/",
      skos: "http://www.w3.org/2004/02/skos/core#",
      locn: "http://www.w3.org/ns/locn#",
      geo: "http://www.opengis.net/ont/geosparql#",
      xsd: "http://www.w3.org/2001/XMLSchema#",
      mobilitydcatap: "https://w3id.org/mobilitydcat-ap#",

      /* ---- Classes ---- */
      Catalog: "dcat:Catalog",
      Dataset: "dcat:Dataset",
      Distribution: "dcat:Distribution",
      CatalogRecord: "dcat:CatalogRecord",
      Location: "dct:Location",
      Organization: "foaf:Organization",
      PeriodOfTime: "dct:PeriodOfTime",

      /* ---- Human-readable text ---- */
      title: {
        "@id": "dct:title",
        "@language": "de"
      },
      description: {
        "@id": "dct:description",
        "@language": "de"
      },
      name: {
        "@id": "foaf:name",
        "@language": "de"
      },
      keyword: {
        "@id": "dcat:keyword",
        "@language": "en"
      },

      /* ---- IRIs ---- */
      homepage: {
        "@id": "foaf:homepage",
        "@type": "@id"
      },
      landingPage: {
        "@id": "dcat:landingPage",
        "@type": "@id"
      },
      accessURL: {
        "@id": "dcat:accessURL",
        "@type": "@id"
      },
      identifier: {
        "@id": "dct:identifier",
        "@type": "@id"
      },
      inScheme: {
        "@id": "skos:inScheme",
        "@type": "@id"
      },
      format: {
        "@id": "dct:format",
        "@type": "@id"
      },
      language: {
        "@id": "dct:language",
        "@type": "@id"
      },
      accrualPeriodicity: {
        "@id": "dct:accrualPeriodicity",
        "@type": "@id"
      },

      /* ---- Dates & times ---- */
      created: {
        "@id": "dct:created",
        "@type": "xsd:dateTime"
      },
      modified: {
        "@id": "dct:modified",
        "@type": "xsd:dateTime"
      },

      /* ---- Spatial ---- */
      spatial: "dct:spatial",
      geometry: {
        "@id": "locn:geometry",
        "@type": "geo:wktLiteral"
      },

      /* ---- Temporal & frequency ---- */
      temporal: "dct:temporal",

      /* ---- Relations ---- */
      publisher: "dct:publisher",
      primaryTopic: "foaf:primaryTopic",
      distribution: "dcat:distribution",
      record: "dcat:record",
      dataset: "dcat:dataset",
      relation: {
        "@id": "dct:relation",
        "@type": "@id"
      },

      /* ---- Mobility DCAT ---- */
      mobilityTheme: {
        "@id": "mobilitydcatap:mobilityTheme",
        "@type": "@id"
      },
      mobilityDataStandard: {
        "@id": "mobilitydcatap:mobilityDataStandard",
        "@type": "@id"
      }
    }
  };
}

// ---- Build Hamburg Location ----
function buildHamburgLocation() {
  return {
    "@id": `#location_${crypto.randomUUID()}`,
    "@type": "dct:Location",
    "dct:identifier": { "@id": "http://publications.europa.eu/resource/authority/place/DEU_HAM" },
    "skos:inScheme": { "@id": "http://publications.europa.eu/resource/authority/place" }
  };
}

// ---- Generate SensorThings API URL ----
function generateSensorThingsURL(timeInterval, pageSize = DEFAULT_PAGE_SIZE) {
  const baseURL = "https://iot.hamburg.de/v1.1/Datastreams";
  const filter =
    "properties/serviceName eq 'HH_STA_Verkehrsdaten_Kfz_Infrarotdetektoren'";
  const durationFilter = `properties/aggregationDuration eq '${timeInterval}'`;
  
  return (
    `${baseURL}?$filter=${encodeURIComponent(filter)} and ${encodeURIComponent(durationFilter)}` +
    `&$top=${pageSize}`
  );
}

// ---- Transform datastream to Dataset ----
async function datastreamToDataset(ds, language, profileLink) {
  const datasetId = ds["@iot.selfLink"];
  return {
    datasetId,
    dataset: {
      "@id": datasetId,
      "@type": "dcat:Dataset",
      "mobilitydcatap:mobilityTheme": {
        "@id": "https://w3id.org/mobilitydcat-ap/mobility-theme/traffic-volume"
      },
      "dct:title": {
        "@value": ds.name,
        "@language": language
      },
      "dct:description": {
        "@value": ds.description,
        "@language": language
      },
      "dct:publisher": {
        "@type": "foaf:Organization",
        "foaf:name": {
          "@value": ds.properties?.ownerData || "Freie und Hansestadt Hamburg",
          "@language": language
        }
      },
      "dct:created": {
        "@value": ds.properties?.infoLastUpdate || new Date().toISOString(),
        "@type": "xsd:dateTime"
      },
      "dct:modified": {
        "@value": ds.properties?.infoLastUpdate || new Date().toISOString(),
        "@type": "xsd:dateTime"
      },
      "dct:spatial": await getLocationObject(ds),
      "dct:accrualPeriodicity": {
        "@id": TIME_INTERVAL_LIST[ds.properties?.aggregateDuration]
          ? TIME_INTERVAL_LIST[ds.properties?.aggregateDuration]
          : "http://publications.europa.eu/resource/authority/frequency/" +
            ds.properties?.aggregateDuration
      },
      "dct:temporal": {
        "@type": "dct:PeriodOfTime",
        "dct:description": `Aggregation interval: ${ds.properties?.aggregateDuration}`
      },
      "dct:relation": [
        { "@id": ds["Sensor@iot.navigationLink"] },
        { "@id": ds["Thing@iot.navigationLink"] },
        { "@id": ds["ObservedProperty@iot.navigationLink"] }
      ],
      "dcat:keyword": ["mobility", "traffic", "Hamburg"],
      "dcat:distribution": [
        {
          "@type": "dcat:Distribution",
          "mobilitydcatap:mobilityDataStandard": {
            "@id": profileLink
          },
          "dct:rights": {
            "@id": "http://publications.europa.eu/resource/authority/access-right/PUBLIC"
          },
          "dcat:accessURL": {
            "@id": ds["Observations@iot.navigationLink"]
          },
          "dct:format": {
            "@id": "http://publications.europa.eu/resource/authority/file-type/JSON"
          },
          "dct:conformsTo": {
            "@id": profileLink
          }
        }
      ],
      "dcat:landingPage": {
        "@id": ds.properties?.metadata
      }
    }
  };
}

// ---- Get location from datastream ----
async function getLocationObject(datastream) {
  const thing = await getThing(datastream);
  if (thing) return await getLocation(thing);
  else return {};
}

async function getThing(datastream) {
  const thingURL = datastream["Thing@iot.navigationLink"];
  if (!thingURL) return {};
  const thing = await fetch(thingURL);
  return await thing.json();
}

async function getLocation(thing) {
  const locationURL = thing["Locations@iot.navigationLink"];
  if (!locationURL) return {};
  const locationsPage = await fetch(locationURL);
  const locationsJSON = await locationsPage.json();
  const locations = locationsJSON.value;
  if (!locations || !locations.length) return {};
  const location = locations[0].location;
  const points = location.geometry?.coordinates;
  if (!points || !points.length) return {};
  if (points.length === 2) {
    return {
      "@id": `#location_${crypto.randomUUID()}`,
      "@type": "Location",
      geometry: `POINT(${points.join(" ")})`
    };
  } else {
    return {
      "@id": `#location_${crypto.randomUUID()}`,
      "@type": "Location",
      geometry: `POLYGON(${points.join(" ")})`
    };
  }
}

// ---- Transform datastream to CatalogRecord ----
async function datastreamToRecord(datastream, language, profileLink) {
  const { datasetId, dataset } = await datastreamToDataset(
    datastream,
    language,
    profileLink
  );
  return {
    datasetId,
    record: {
      "@id": `#catalogrecord_${crypto.randomUUID()}`,
      "@type": "dcat:CatalogRecord",
      "dct:created": {
        "@value": datastream.properties?.infoLastUpdate || new Date().toISOString(),
        "@type": "xsd:dateTime"
      },
      "dct:language": language,
      "dct:modified": {
        "@value": datastream.properties?.infoLastUpdate || new Date().toISOString(),
        "@type": "xsd:dateTime"
      },
      "foaf:primaryTopic": dataset
    }
  };
}

// ---- Create catalog from datastreams ----
async function datastreamsToCatalog(
  datastreams,
  baseUrl,
  catalogHome,
  language,
  descriptionLanguage,
  profileLink
) {
  const recordEntries = await Promise.all(
    datastreams.map(datastream => {
      return limit(() => datastreamToRecord(datastream, language, profileLink));
    })
  );

  return {
    ...buildContext(baseUrl),
    "@id": "#catalog",
    "@type": "dcat:Catalog",
    "dct:title": {
      "@value": "Hamburg Traffic Counting Datasets",
      "@language": descriptionLanguage
    },
    "dct:description": {
      "@value": "Traffic counting datasets published via OGC SensorThings API",
      "@language": descriptionLanguage
    },
    "foaf:homepage": { "@id": catalogHome },
    "dct:spatial": buildHamburgLocation(),
    "dct:publisher": {
      "@type": "foaf:Organization",
      "foaf:name": {
        "@value": "Freie und Hansestadt Hamburg",
        "@language": language
      }
    },
    "dcat:dataset": recordEntries.map(entry => {
      return { "@id": entry.datasetId };
    }),
    "dcat:record": recordEntries.map(entry => entry.record)
  };
}

// ---- Fetch all pages from API ----
async function fetchAllPages(url) {
  let results = [];
  let nextUrl = url;

  while (nextUrl) {
    console.error("fetching", nextUrl);

    const res = await fetch(nextUrl);
    if (!res.ok) {
      throw new Error(`API error: ${res.status}`);
    }

    const page = await res.json();

    if (Array.isArray(page.value)) {
      results.push(...page.value);
    }

    // SensorThings pagination
    nextUrl = page["@iot.nextLink"] ?? null;
  }

  return results;
}

// ---- Main function: Generate Catalog ----
async function generateCatalog(options) {
  const timeInterval = options.timeInterval || "P1D";
  const profileLink = options.profileLink || DEFAULT_PROFILE_LINK;
  const catalogHome = options.catalogHome || DEFAULT_CATALOG_HOME;
  const language = options.language || DEFAULT_LANGUAGE;
  const descriptionLanguage = options.descriptionLanguage || DEFAULT_DESCRIPTION_LANGUAGE;
  const baseUrl = options.baseUrl || DEFAULT_BASE_URL;

  const url = generateSensorThingsURL(timeInterval);
  console.error("Generating catalog for URL:", url);

  const datastreams = await fetchAllPages(url);
  console.error(`Fetched ${datastreams.length} datastreams`);

  const catalog = await datastreamsToCatalog(
    datastreams,
    baseUrl,
    catalogHome,
    language,
    descriptionLanguage,
    profileLink
  );

  return catalog;
}

// ---- Main function: Generate URLs ----
async function generateURLs(options) {
  const timeInterval = options.timeInterval || "P1D";
  
  const url = generateSensorThingsURL(timeInterval);
  console.error("Fetching datastreams for URL:", url);

  const datastreams = await fetchAllPages(url);
  console.error(`Fetched ${datastreams.length} datastreams`);

  // Extract the @iot.selfLink from each datastream
  const datastreamURLs = datastreams.map(ds => ds["@iot.selfLink"]);

  return JSON.stringify(datastreamURLs);
}

// ---- CLI Setup ----
program.version("1.0.0").description("Hamburg Catalog Generator");

// Command: catalog
program
  .command("catalog")
  .description("Generate DCAT-AP catalog from Hamburg SensorThings API")
  .option("-t, --time-interval <interval>", "Time interval (P15M, P1H, P1D)", "P1D")
  .option("-p, --profile-link <url>", "DCAT-AP Profile Link", DEFAULT_PROFILE_LINK)
  .option("-c, --catalog-home <url>", "Catalog Home URL", DEFAULT_CATALOG_HOME)
  .option("-l, --language <lang>", "Dataset language code", DEFAULT_LANGUAGE)
  .option("-d, --description-language <lang>", "Description language code", DEFAULT_DESCRIPTION_LANGUAGE)
  .option("-b, --base-url <url>", "Base URL for the catalog", DEFAULT_BASE_URL)
  .option("-o, --output <file>", "Output file (default: stdout)")
  .action(async (options) => {
    try {
      const catalog = await generateCatalog(options);
      const output = JSON.stringify(catalog, null, 2);

      if (options.output) {
        fs.writeFileSync(options.output, output, "utf8");
        console.error(`Catalog written to ${options.output}`);
      } else {
        console.log(output);
      }
    } catch (err) {
      console.error("Catalog generation failed:");
      console.error(err.message);
      process.exit(1);
    }
  });

// Command: urls
program
  .command("urls")
  .description("Generate SensorThings API URLs for Hamburg traffic data")
  .option("-t, --time-interval <interval>", "Time interval (P15M, P1H, P1D)", "P1D")
  .action(async (options) => {
    try {
      const url = await generateURLs(options);
      console.log(url);
    } catch (err) {
      console.error("URL generation failed:");
      console.error(err.message);
      process.exit(1);
    }
  });

program.parse(process.argv);

// Show help if no command is provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
