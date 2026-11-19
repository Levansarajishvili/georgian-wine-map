# საქართველოს ღვინის რუკა

ინტერაქტიული რუკა: საქართველოს რეგიონები, ღვინის ზონები, ვაზის ჯიშები და ღვინის სტილის ფილტრი. Map_2 პროექტის გაგრძელება.

სტეკი: Vite + React (JavaScript), OpenLayers, ბექენდის გარეშე. მონაცემები სტატიკური JSON და GeoJSON ფაილებია `src/data/`-ში.

## მდგომარეობა

v1 მუშავდება. რაც ახლა რეპოშია:

| რა | მდგომარეობა |
|---|---|
| რეგიონების საზღვრები | 2 რეგიონი: კახეთი; რაჭა-ლეჩხუმი და ქვემო სვანეთი. დანარჩენი 10 დასამატებელია |
| ღვინის ზონები | 2 ზონა (ნაფარეული, ხვანჭკარა): სოფლები, ჯიშები და სტილები არის; **საზღვრები placeholder-ია** და რუკაზე ზონა ჯერ არ ჩანს |
| ფილტრი, ზონის პანელი, რეგიონების სია, მობილური განლაგება | მუშაობს |
| ტესტები | 30 (ფილტრის ლოგიკა და bottom sheet-ის მდგომარეობები) |

ღია საკითხების სრული სია: `docs/context.md`.

## გაშვება

საჭიროა Node.js `^20.19` ან `>=22.12` (Vite 8-ის მოთხოვნა) და npm.

```bash
npm ci          # დამოკიდებულებები package-lock.json-იდან
npm run dev     # dev სერვერი: http://localhost:5173
```

| ბრძანება | რას აკეთებს |
|---|---|
| `npm run dev` | dev სერვერი hot reload-ით |
| `npm test` | Vitest, ერთხელ (`npm run test:watch` ცვლილებებს უყურებს) |
| `npm run lint` | ESLint |
| `npm run validate` | `src/data/`-ის შემოწმება მონაცემთა მოდელთან; placeholder გაფრთხილებაა |
| `npm run validate -- --strict` | იგივე, მაგრამ placeholder შეცდომაა (production-ისთვის) |
| `npm run build` | production build `dist/`-ში |
| `npm run preview` | `dist/`-ის ნახვა ლოკალურად |

API გასაღები და `.env` ფაილი არ სჭირდება: სამივე საბაზისო ფენა გასაღების გარეშე იტვირთება.

## ფილტრის ბმულები

ფილტრი მისამართშია და ბმული ზუსტად იმავე ეკრანს ხსნის:

```
/?style=amber&grape=rkatsiteli,saperavi
```

რამდენიმე მნიშვნელობა მძიმით იწერება. უცნობი მნიშვნელობა იგნორირდება და მისამართი კანონიკურ ფორმაზე სწორდება. წესები: `docs/01-architecture.md` §5.

## სტრუქტურა

```
src/
├── components/   UI: MapView, FilterPanel, ZonePanel, RegionList, BottomSheet…
├── state/        ფილტრი URL-იდან
├── domain/       სუფთა ფუნქციები (ფილტრის ლოგიკა) და მათი ტესტები
├── map/          OpenLayers: რუკა, ფენები, სტილები
├── loaders/      მონაცემების ჩატვირთვა
├── data/         JSON და GeoJSON
├── copy/ka.js    UI-ის ყველა ტექსტი
└── styles/       tokens.css, global.css
scripts/          მონაცემების ვალიდაცია; bundle-ში არ შედის
```

დეტალები: `docs/01-architecture.md` (მოდულები), `docs/02-data-model.md` (მონაცემთა მოდელი).

## განთავსება (Vercel)

კონფიგურაცია `vercel.json`-შია და Project Settings-ის build პარამეტრებს ფარავს; ინტერფეისში მათი შევსება საჭირო არ არის. JSON-ში კომენტარი არ იწერება, ამიტომ ახსნა აქ არის.

1. რეპო Vercel-ზე პროექტად იმპორტდება Git რეპოზიტორიიდან. თუ `package.json` რეპოს ძირში არ არის, Project Settings-ში Root Directory უნდა მიეთითოს.
2. ყოველ push-ზე Vercel დამოკიდებულებებს აყენებს და უშვებს `buildCommand`-ს:
   ```bash
   npm run lint && npm test && npm run validate && npm run build
   ```
   ბრძანებები რიგით ეშვება. თუ lint, ტესტი ან მონაცემთა შემოწმება ჩავარდა, build აღარ იწყება, deployment შეცდომით სრულდება და საიტზე წინა ვერსია რჩება.
3. ქვეყნდება `dist/`. მთავარი ტოტი production-ია, სხვა ტოტები და pull request-ები preview მისამართს იღებენ.

რას აწყობს `vercel.json`:

- **`rewrites` (SPA):** ნებისმიერი მისამართი, რომელიც ფაილი არ არის, `index.html`-ს იღებს. `/assets/` ამ წესიდან ამოღებულია, რომ არარსებულ ფაილზე პასუხი 404 იყოს და არა HTML. ფილტრის ბმულები (`/?style=…`) ამის გარეშეც მუშაობს; წესი მომავალი path-ებისთვისაა (მაგ. `/en/`).
- **`headers` (cache):** `/assets/*` ფაილებს სახელში hash აქვს, ამიტომ ბრაუზერი მათ ერთი წლით ინახავს (`immutable`). `index.html` ყოველ ვიზიტზე მოწმდება, ასე რომ ახალი ვერსია მაშინვე ჩანს.
- **`headers` (ყველა მისამართი):** `X-Content-Type-Options: nosniff` და `Referrer-Policy: strict-origin-when-cross-origin`. მეორე ბრაუზერის ნაგულისხმევი მნიშვნელობაა და განზრახ წერია: tile სერვერები ხედავენ, რომელი საიტი ითხოვს tile-ებს. `no-referrer`-ით არ უნდა შეიცვალოს.

Node.js-ის ვერსია `vercel.json`-ში არ იწერება: ის Project Settings-ში ირჩევა (Node.js Version). lint, ტესტები, validate და build შემოწმებულია Node 22, 24 და 26-ზე.

გამოქვეყნებამდე იგივე შემოწმება ლოკალურად:

```bash
npm run lint && npm test && npm run validate && npm run build && npm run preview
```

**მკაცრი რეჟიმი production-ისთვის.** ნაგულისხმევად placeholder მონაცემი გაფრთხილებაა და deployment-ს არ აჩერებს. როცა ზონების ნამდვილი საზღვრები მზად იქნება, `buildCommand`-ში `npm run validate` ამით შეიცვლება:

```bash
npm run validate -- $([ "$VERCEL_ENV" = "production" ] && echo --strict)
```

მაშინ production deployment placeholder-ზე ჩავარდება, preview კი ისევ გაივლის. `vercel.json`-ში ბრჭყალებს `\"` სჭირდება.

Vercel-ის უფასო (Hobby) გეგმა პირადი, არაკომერციული გამოყენებისთვისაა.

## მონაცემთა წყაროები

სრული ცხრილი, განხილული და არარჩეული წყაროები: `docs/06-data-sources.md`. წყაროების id-ები `src/data/sources.json`-ს ემთხვევა; ყოველ ჩანაწერს აქვს `source` და `verified` ველი.

| მონაცემი | წყარო | ლიცენზია | შენიშვნა |
|---|---|---|---|
| რეგიონების საზღვრები (`regions.geo.json`) | OpenStreetMap, ადმინისტრაციული საზღვრები; ჩამოტვირთულია Nominatim-ით 2026-11-18-ს. კახეთი: relation 2000091. რაჭა-ლეჩხუმი და ქვემო სვანეთი: relation 17916471 (`boundary=disputed`, `claimed_by=Georgia`, დე იურე საზღვარი) | ODbL 1.0 | `osm-adm1`; `verified: false`, relation-ების ნომრები და tag-ები გადასამოწმებელია |
| ხვანჭკარა: სოფლები, ჯიშები, სტილი | საქპატენტი, `sakpatenti.gov.ge/ka/page/142/`, ნანახია 2026-10-09 | მითითებული არ არის | `sakpatenti-khvanchkara`. გამოიყენება ფაქტები; ტექსტი არ კოპირდება |
| ნაფარეული: სოფლები, ჯიშები, სტილები | vinoge.com-ის გვერდი, ტექსტი მონიშნულია „© საქპატენტი“ (გამოქვეყნდა 2009-02-11), ნანახია 2026-10-09 | მითითებული არ არის | `vinoge-napareuli`. მეორადი ასლია, `verified: false`; საქპატენტის ორიგინალით უნდა ჩანაცვლდეს |
| ღვინის სტილების სახელები და ახსნები | პროექტის ტერმინოლოგია, `docs/04-copy-voice.md` | — | `project-glossary`; ახსნები წყაროსთან შესადარებელია |
| ზონების საზღვრები (`zones.geo.json`) | ჯერ არ არის | — | `placeholder`; მიდგომა არჩეული არ არის (`docs/06-data-sources.md` §5) |

### საბაზისო ფენები

კონფიგურაცია: `src/map/basemaps.js`. პირობები წაკითხულია 2026-11-18-ს (`docs/06-data-sources.md` §8).

| ფენა | სერვისი | ლიცენზია და პირობები |
|---|---|---|
| ღია ფონი (ნაგულისხმევი) | OpenStreetMap.de (`tile.openstreetmap.de`), ოპერატორი FOSSGIS | tile-ები CC-BY-SA 2.0, მონაცემი ODbL. მაღალი ტრაფიკის საიტებს გამოყენება არ შეუძლიათ; აპს, რომელიც tile-ებს თავად ტვირთავს, წინასწარი თანხმობა სჭირდება |
| რელიეფი | OpenTopoMap (`tile.opentopomap.org`) | tile-ები CC-BY-SA 3.0; opentopomap.org ყოველთვის უნდა იყოს მითითებული; დიდი პროექტისთვის ავტორებთან დაკავშირება |
| სატელიტი | Esri World Imagery (`server.arcgisonline.com`) | Esri Master Agreement და Terms of Use. პირობები პირველწყაროსთან **შესამოწმებელია** (უფასო ანგარიშის მოთხოვნა, „Powered by Esri“) |

სამივე მოხალისეების ან მესამე მხარის სერვერია: გამოქვეყნებამდე საჭიროა ტრაფიკის შეფასება და სათადარიგო ვარიანტი.

## ლიცენზიები

- **კოდი:** ლიცენზია ჯერ არჩეული არ არის; `LICENSE` ფაილი რეპოში არ არის.
- **მონაცემები:** `src/data/regions.geo.json` OpenStreetMap-იდან წარმოებული მონაცემთა ბაზაა და ODbL 1.0-ით ვრცელდება. ეს მონაცემის ფაილს ეხება და არა კოდს. როგორ გაფორმდება ეს რეპოში (მაგ. მონაცემების ცალკე `LICENSE`), დასადასტურებელია. თუ `zones.geo.json` OSM-ის მონაცემიდან აიგება, იგივე წესი გავრცელდება მასზეც.
- **დამოკიდებულებები:** OpenLayers (BSD-2-Clause), React და React DOM (MIT).
- **შრიფტი:** FiraGO-ს self-host იგეგმება; ფაილები რეპოში ჯერ არ არის. დამატებისას მისი ლიცენზია აქ ჩაიწერება.

## Attribution

რუკის ქვედა მარჯვენა კუთხეში ჩანს ხილული საბაზისო ფენის attribution. ტექსტები `src/map/basemaps.js`-შია, წყაროდან უცვლელად:

```
ღია ფონი   © OpenStreetMap contributors
რელიეფი    Map data: © OpenStreetMap contributors, SRTM | Map style: © OpenTopoMap (CC-BY-SA)
სატელიტი   Tiles © Esri — Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community
```

სხვა მონაცემები:

- **რეგიონების საზღვრები:** `© OpenStreetMap contributors` (ODbL), ბმულით `openstreetmap.org/copyright`. ამ მონაცემს საკუთარი attribution ჯერ არ აქვს: „ღია ფონსა“ და „რელიეფზე“ იგივე ტექსტი საბაზისო ფენიდან ჩანს, სატელიტზე კი მხოლოდ Esri-ის ტექსტია. გამოქვეყნებამდე გასასწორებელია.
- **ზონის მონაცემები:** ზონის პანელის „წყარო“ განყოფილებაში ჩანს წყაროს სათაური, გამომცემელი, ნახვის თარიღი და ბმული (`src/data/sources.json`-იდან).

## გამოქვეყნებამდე

- ზონების ნამდვილი საზღვრები და დანარჩენი 10 რეგიონი.
- რეგიონების მონაცემის attribution რუკაზე, საბაზისო ფენისგან დამოუკიდებლად.
- FOSSGIS-ისა და OpenTopoMap-ის პირობები ტრაფიკთან მიმართებით; Esri-ის პირობები პირველწყაროში.
- აფხაზეთისა და ცხინვალის რეგიონის ჩვენების ვარიანტი (`docs/06-data-sources.md` §4).
