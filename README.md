# Hamburg DCAT-AP catalog generator

A command-line tool for generating a DCAT-AP-style JSON-LD catalog or URL listing from the traffic-counting datastreams in the Hamburg Open Data Portal for a given time interval. 

## Requirements and installation

```sh
npm ci
```

## Generate a catalog

Generate a catalog for daily aggregates and save it as JSON-LD:

```sh
node generator.js catalog --output hamburg-catalog.jsonld
```

Select another aggregation interval (P1D, P1H or P15M):

```sh
node hamburg_catalog_generator.js catalog \
  --time-interval PT15M \
  --output hamburg-15min-catalog.jsonld
```

Without `--output`, the catalog is written to standard output. Progress messages go to standard error, so output can also be redirected:

```sh
node hamburg_catalog_generator.js catalog > hamburg-catalog.jsonld
```

Output files are overwritten if they already exist. Create any parent output directory before running the command.

### Catalog options

| Option | Purpose | Default |
| --- | --- | --- |
| `-t, --time-interval <interval>` | Aggregation interval: `PT15M` (15 minutes), `P1H` (hourly), or `P1D` (daily) | `P1D` |
| `-p, --profile-link <url>` | Distribution's mobility data standard and conformance reference | SensorThings profile URL below |
| `-c, --catalog-home <url>` | Catalog homepage | Catalog URL below |
| `-l, --language <lang>` | Language tag for dataset titles, descriptions, and publisher names; also used on catalog records | `de` |
| `-d, --description-language <lang>` | Language tag for the catalog title and description | `en` |
| `-b, --base-url <url>` | JSON-LD base IRI for relative identifiers | Catalog URL below |
| `-o, --output <file>` | Destination file | Standard output |

The default catalog homepage and base IRI are both:

```text
https://pod.rubendedecker.be/scholar/deployEMDS/data/datasets/catalog
```

The default profile reference is:

```text
https://pod.rubendedecker.be/scholar/deployEMDS/data/catalogs/profile_catalog#sensorthings-api-profile
```

To use identifiers for your own deployment:

```sh
node hamburg_catalog_generator.js catalog \
  --base-url https://example.org/catalog \
  --catalog-home https://example.org/catalog \
  --profile-link 'https://example.org/profiles#sensorthings' \
  --output hamburg-catalog.jsonld
```

These options set metadata references; the tool only writes output locally and does not publish it. Language options change tags, not the text itself. The catalog title and description are fixed English strings in the source.

## Export datastream URLs

To output a JSON list of the matching datastream URLs, instead of a DCAT catalog, use the following command

```sh
node hamburg_catalog_generator.js urls --time-interval P1D > datastream-urls.txt
```

The `urls` command supports `-t, --time-interval <interval>` with the same default of `P1D`. 


## Export datastream Collection

To output a JSON list of the matching datastream URLs, instead of a DCAT catalog, use the following command

```sh
node hamburg_catalog_generator.js collection --time-interval P1D > datastream-urls.txt
```

The `urls` command supports `-t, --time-interval <interval>` with the same default of `P1D`. 
