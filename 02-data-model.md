# 02 — მონაცემთა მოდელი
საქართველოს ღვინის რუკა · v1
ბოლო განახლება: [თარიღი]
სტატუსი: პროექტი. §12-ის პუნქტები დადასტურებამდე წინადადებად ითვლება. მოდელი 01-architecture.md-ს მიჰყვება; გადახვევები §11-შია.

---

## 1. ფაილები

| ფაილი | შიგთავსი | ჩატვირთვა | ვინ იყენებს |
|---|---|---|---|
| `sources.json` | წყაროების რეესტრი | სტატიკური import | ყოველი ჩანაწერის `source`, ZonePanel |
| `styles.json` | სტილების ცნობარი (5) | სტატიკური import | ფილტრი, URL-ის ვალიდაცია |
| `grapes.json` | ჯიშების ცნობარი | სტატიკური import | ფილტრი, URL-ის ვალიდაცია, ZonePanel |
| `regions.json` | რეგიონების ატრიბუტები | სტატიკური import | RegionList, `fitToExtent` |
| `zones.json` | ზონების ინდექსი: ატრიბუტები, კავშირები, სოფლები | სტატიკური import | ფილტრი, მთვლელები, RegionList, ZonePanel, ცენტროიდის მარკერი |
| `regions.geo.json` | ADM1 გეომეტრია | `?url` + `fetch` | regionsLayer |
| `zones.geo.json` | ზონების გეომეტრია | `?url` + `fetch` | zonesLayer |

**გეომეტრია და ატრიბუტები ცალ-ცალკე ინახება.** ფილტრი და მთვლელები მხოლოდ `zones.json`-ს იყენებს, ამიტომ რაოდენობები პოლიგონების ჩატვირთვამდე ითვლება (01 §6). გეომეტრიის ფაილებში Feature-ის `properties` ცარიელია (`{}`): ყველა ატრიბუტი ინდექსშია, კავშირი კი `Feature.id`-ით მყარდება (= slug).

ზოგადი წესები:
- ატრიბუტების ფაილი მასივია, დალაგებული `id`-ით, რომ git diff წაკითხვადი იყოს. გეომეტრიის ფაილი FeatureCollection-ია, features `id`-ით დალაგებული.
- კოორდინატები EPSG:4326-შია, `[lon, lat]` რიგით (RFC 7946), 5 ათწილადით. 3857-ში გარდაქმნა ჩატვირთვისას ხდება (01 §3).
- ყოველი კავშირი ერთ მხარეს ინახება, ზონაში. უკუ ინდექსებს (ჯიში → ზონები, რეგიონი → ზონები) `loaders/catalogs.js` ჩატვირთვისას ითვლის.

---

## 2. ID-ები და ტრანსლიტერაცია

### წესები
1. **ფორმა:** `[a-z0-9]+(-[a-z0-9]+)*`. მხოლოდ ლათინური პატარა ასოები, ციფრები და ერთმაგი დეფისი.
2. **საკუთარი სახელები** (ზონა, რეგიონი, ჯიში, სოფელი): `name.ka` → ქართული დამწერლობის ეროვნული ტრანსლიტერაციის სისტემა (2002) → აპოსტროფები იშლება → პატარა ასოები → ჰარი და პუნქტუაცია ხდება `-`.
3. **სტილები** ცნებებია და არა საკუთარი სახელები, ამიტომ მათი slug ინგლისური ტერმინია (`amber` უკვე დაფიქსირებული იყო).
4. **სოფლის id** ყოველთვის `<მუნიციპალიტეტი>-<სოფელი>` ფორმისაა, რადგან სხვადასხვა მუნიციპალიტეტში ერთსახელიანი სოფლები შეიძლება შეგვხვდეს. სოფლის id URL-ში არ ჩანს.
5. **უნიკალურობა** ერთეულის ტიპის შიგნით მოქმედებს: ზონა `napareuli` და ამავე სახელის სოფელი ერთმანეთს არ ეჯახება.
6. **სტაბილურობა.** id-ს სკრიპტი აგენერირებს (ჩატი 3) და ფაილში ინახება; runtime-ში არ ითვლება. გამოქვეყნების შემდეგ id არ იცვლება, რადგან URL-შია. სახელის გასწორება id-ს არ ცვლის.

### ასოების ცხრილი

| ka | lat | ka | lat | ka | lat |
|---|---|---|---|---|---|
| ა | a | მ | m | ღ | gh |
| ბ | b | ნ | n | ყ | q* |
| გ | g | ო | o | შ | sh |
| დ | d | პ | p* | ჩ | ch |
| ე | e | ჟ | zh | ც | ts |
| ვ | v | რ | r | ძ | dz |
| ზ | z | ს | s | წ | ts* |
| თ | t | ტ | t* | ჭ | ch* |
| ი | i | უ | u | ხ | kh |
| კ | k* | ფ | p | ჯ | j |
| ლ | l | ქ | k | ჰ | h |

\* ეროვნულ სისტემაში აპოსტროფით იწერება (`k'`, `p'`, `t'`, `q'`, `ts'`, `ch'`). slug-ში აპოსტროფი იშლება.

| ქართულად | ეროვნული სისტემა | slug |
|---|---|---|
| ნაფარეული | napareuli | `napareuli` |
| ხვანჭკარა | khvanch'k'ara | `khvanchkara` |
| რქაწითელი | rkats'iteli | `rkatsiteli` |
| საფერავი | saperavi | `saperavi` |
| ალექსანდროული | aleksandrouli | `aleksandrouli` |
| მუჯურეთული | mujuretuli | `mujuretuli` |
| მწვანე კახური | mts'vane k'akhuri | `mtsvane-kakhuri` |
| კახეთი | k'akheti | `kakheti` |
| ყვარელი | q'vareli | `qvareli` (გავრცელებული ფორმაა Kvareli) |

ორი ცნობილი შედეგი:
- აპოსტროფის მოშორება ხუთ წყვილს აერთიანებს (კ/ქ, პ/ფ, ტ/თ, წ/ც, ჭ/ჩ), ამიტომ დამთხვევა შესაძლებელია. უნიკალურობას ვალიდაციის სკრიპტი ამოწმებს.
- ყ → `q` ზოგჯერ გავრცელებულ ლათინურ ფორმას შორდება. რეკომენდაცია: გამონაკლისების გარეშე; გავრცელებული ფორმა `synonyms`-ში ჩაიწერება, სადაც ერთეულს ეს ველი აქვს.

### სტილების საბოლოო slug-ები

| `order` | slug | `name.ka` | `synonyms` |
|---|---|---|---|
| 1 | `amber` | ქარვისფერი ქვევრის | amber, orange wine, კახური ტიპის |
| 2 | `semi-sweet` | ბუნებრივად ნახევრად ტკბილი | semi-sweet, ნახევრად ტკბილი |
| 3 | `sparkling` | ცქრიალა | sparkling |
| 4 | `dry-white` | თეთრი მშრალი | dry white |
| 5 | `dry-red` | წითელი მშრალი | dry red |

`order` context.md-ის ცხრილის რიგს იმეორებს; UI-ის რიგი შეიძლება ჩატ 2-ში ან ეტაპ 6-ზე შეიცვალოს, slug-ები კი არა.

---

## 3. საერთო ტიპები

| ტიპი | აღწერა | მაგალითი |
|---|---|---|
| `Slug` | id §2-ის წესით | `"napareuli"` |
| `LocalizedString` | `{ ka, en? }`. `en` v1-ში არ არის: ინგლისური ვერსია ველის დამატება იქნება და არა სტრუქტურის ცვლილება | `{ "ka": "ნაფარეული" }` |
| `LngLat` | `[lon, lat]`, EPSG:4326 | `[45.12345, 41.98765]` |
| `BBox` | `[minLon, minLat, maxLon, maxLat]`, EPSG:4326 | `[45.1, 41.9, 45.3, 42.0]` |
| `Provenance` | `source` + `verified` + `note?`, ყოველ ჩანაწერსა და კავშირზე (§6) | იხ. ქვემოთ |

**Provenance**

| ველი | ტიპი | სავალდებულო? | მაგალითი |
|---|---|---|---|
| `source` | SourceId (`sources.json`-იდან) | კი | `"placeholder"` |
| `verified` | boolean | კი | `false` |
| `note` | string | არა | შიდა კომენტარი, UI-ში არ ჩანს |

---

## 4. ერთეულები

### 4.1 წყარო · `sources.json`

| ველი | ტიპი | სავალდებულო? | მაგალითი |
|---|---|---|---|
| `id` | Slug | კი | `"project-glossary"` |
| `title` | string (ორიგინალის ენაზე) | კი | `"პროექტის ტერმინოლოგია, 04-copy-voice.md"` |
| `publisher` | string | არა | `"[გამომცემელი]"` |
| `url` | string | არა | `"[https://…]"` |
| `accessed` | string, ISO 8601 თარიღი | არა | `"[YYYY-MM-DD]"` |
| `license` | string | არა | `"[ლიცენზია]"` |

დაჯავშნილი id-ები:
- `placeholder` — მონაცემი ჯერ არ გვაქვს. ასეთ ჩანაწერს `verified: false` აქვს და production build-ში ვერ მოხვდება (§6).
- `project-glossary` — პროექტის საკუთარი განმარტებები (სტილები).

რეალური წყაროები და მათი ლიცენზიები: ჩატი 3, 06-data-sources.md. `sources.json` id-ებისა და მისამართების ერთადერთი წყაროა; 06 ამ id-ებს მიუთითებს.

```json
[
  {
    "id": "placeholder",
    "title": "მონაცემი ჯერ არ არის — ჩანაცვლდება ჩატ 3-ში"
  },
  {
    "id": "project-glossary",
    "title": "პროექტის ტერმინოლოგია, 04-copy-voice.md"
  }
]
```

### 4.2 სტილი · `styles.json`

| ველი | ტიპი | სავალდებულო? | მაგალითი |
|---|---|---|---|
| `id` | StyleId: ხუთიდან ერთი (§2) | კი | `"amber"` |
| `name` | LocalizedString | კი | `{ "ka": "ქარვისფერი ქვევრის" }` |
| `synonyms` | string[] (შეიძლება ცარიელი) | კი | `["amber", "orange wine", "კახური ტიპის"]` |
| `order` | integer, 1-დან | კი | `1` |
| `source`, `verified`, `note` | Provenance | კი, კი, არა | `"project-glossary"`, `true` |

ძებნა მოიცავს `name.ka`-ს და `synonyms`-ს. id ძებნის ტერმინი არ არის. ნორმალიზაცია (რეგისტრი, ჰარი/დეფისი): ეტაპი 6.

სრული ფაილი:

```json
[
  {
    "id": "amber",
    "name": { "ka": "ქარვისფერი ქვევრის" },
    "synonyms": ["amber", "orange wine", "კახური ტიპის"],
    "order": 1,
    "source": "project-glossary",
    "verified": true
  },
  {
    "id": "dry-red",
    "name": { "ka": "წითელი მშრალი" },
    "synonyms": ["dry red"],
    "order": 5,
    "source": "project-glossary",
    "verified": true
  },
  {
    "id": "dry-white",
    "name": { "ka": "თეთრი მშრალი" },
    "synonyms": ["dry white"],
    "order": 4,
    "source": "project-glossary",
    "verified": true
  },
  {
    "id": "semi-sweet",
    "name": { "ka": "ბუნებრივად ნახევრად ტკბილი" },
    "synonyms": ["semi-sweet", "ნახევრად ტკბილი"],
    "order": 2,
    "source": "project-glossary",
    "verified": true
  },
  {
    "id": "sparkling",
    "name": { "ka": "ცქრიალა" },
    "synonyms": ["sparkling"],
    "order": 3,
    "source": "project-glossary",
    "verified": true
  }
]
```

### 4.3 ჯიში · `grapes.json`

| ველი | ტიპი | სავალდებულო? | მაგალითი |
|---|---|---|---|
| `id` | Slug | კი | `"rkatsiteli"` |
| `name` | LocalizedString | კი | `{ "ka": "რქაწითელი" }` |
| `synonyms` | string[] (შეიძლება ცარიელი) | კი | `["rkatsiteli"]` |
| `source`, `verified`, `note` | Provenance | კი, კი, არა | `"placeholder"`, `false` |

`synonyms` ძებნის დამხმარეა (ლათინური ფორმა, გავრცელებული ჩაწერა) და ცალკე წყაროს არ საჭიროებს. ამპელოგრაფიული სინონიმები (ჯიშის სხვა სახელები სხვა ქვეყნებში) v1-ში არ შედის.

```json
{
  "id": "rkatsiteli",
  "name": { "ka": "რქაწითელი" },
  "synonyms": ["rkatsiteli"],
  "source": "placeholder",
  "verified": false
}
```

### 4.4 რეგიონი · `regions.json` + `regions.geo.json`

| ველი | ტიპი | სავალდებულო? | მაგალითი |
|---|---|---|---|
| `id` | Slug | კი | `"kakheti"` |
| `name` | LocalizedString | კი | `{ "ka": "კახეთი" }` |
| `bbox` | BBox | კი | `fitToExtent`-ისთვის |
| `source`, `verified`, `note` | Provenance | კი, კი, არა | `"placeholder"`, `false` |

ზონების ჩამონათვალი რეგიონში არ ინახება: ის `zones.json`-იდან ითვლება. აფხაზეთისა და ცხინვალის რეგიონის ჩვენების წესი ჩატ 3-შია; ამისთვის შეიძლება დაემატოს `status` ველი (§8).

```json
{
  "id": "kakheti",
  "name": { "ka": "კახეთი" },
  "bbox": [0, 0, 0.001, 0.001],
  "source": "placeholder",
  "verified": false
}
```

გეომეტრია (`Polygon` ან `MultiPolygon`). placeholder კოორდინატები განზრახ (0, 0)-თანაა, საქართველოს გარეთ, რომ ვალიდაციამ ჩანაცვლებამდე შეცდომა აჩვენოს:

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "id": "kakheti",
      "properties": {},
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [[0, 0], [0.001, 0], [0.001, 0.001], [0, 0.001], [0, 0]]
        ]
      }
    }
  ]
}
```

### 4.5 ზონა · `zones.json` + `zones.geo.json`

| ველი | ტიპი | სავალდებულო? | მაგალითი |
|---|---|---|---|
| `id` | Slug | კი | `"napareuli"` |
| `name` | LocalizedString | კი | `{ "ka": "ნაფარეული" }` |
| `regions` | RegionLink[], მინ. 1 | კი | `[{ "id": "kakheti", … }]` |
| `grapes` | GrapeLink[], მინ. 1 | კი | `[{ "id": "rkatsiteli", … }]` |
| `styles` | StyleLink[], მინ. 1 | კი | `[{ "id": "dry-white", … }]` |
| `villages` | VillageLink[], მინ. 1 | კი | `[{ "id": "[მუნიციპალიტეტი]-[სოფელი]", … }]` |
| `boundary` | Boundary | კი | საზღვრის წყარო და სტატუსი |
| `labelPoint` | LngLat, პოლიგონის შიგნით | კი | ცენტროიდის მარკერისთვის |
| `bbox` | BBox | კი | `fitToExtent`-ისთვის |
| `source`, `verified`, `note` | Provenance | კი, კი, არა | ზონის არსებობა და სახელი |

`regions` სიაა და არა ერთი მნიშვნელობა: ზონა შეიძლება ორ რეგიონს კვეთდეს. სია ყოველთვის სიაა, ერთი რეგიონის შემთხვევაშიც, რომ კოდს ორი ტიპის დამუშავება არ დასჭირდეს. RegionList ასეთ ზონას ყველა შესაბამის რეგიონში აჩვენებს.

`labelPoint` ცენტროიდი არ არის მკაცრი გაგებით: MultiPolygon-ის ცენტროიდი სოფლებს შორის, ზონის გარეთ შეიძლება მოხვდეს. წერტილი უნდა იყოს პოლიგონის შიგნით (ყველაზე დიდ ნაწილში). ალგორითმი: ჩატი 3.

**RegionLink, GrapeLink, StyleLink** — კავშირის ჩანაწერები ერთნაირი ფორმით: მითითებული ერთეულის id და კავშირის საკუთარი წყარო. ერთი id სიაში ერთხელ გვხვდება.

| ველი | ტიპი | სავალდებულო? | მაგალითი |
|---|---|---|---|
| `id` | RegionId / GrapeId / StyleId | კი | `"kakheti"`, `"rkatsiteli"`, `"dry-white"` |
| `source`, `verified`, `note` | Provenance | კი, კი, არა | `"placeholder"`, `false` |

**VillageLink** — სოფელი ზონის შემადგენლობაში. `verified` ადასტურებს, რომ სოფელი ამ ზონაში შედის. სოფლის გეომეტრია აპში არ შედის; ზონის MultiPolygon-ის აწყობა სოფლებიდან ჩატი 3-ის სკრიპტების საქმეა.

| ველი | ტიპი | სავალდებულო? | მაგალითი |
|---|---|---|---|
| `id` | VillageId (`<მუნიციპალიტეტი>-<სოფელი>`) | კი | `"[municipality]-[village]"` |
| `name` | LocalizedString | კი | `{ "ka": "[სოფელი 1]" }` |
| `source`, `verified`, `note` | Provenance | კი, კი, არა | `"placeholder"`, `false` |

**Boundary** — ზონის საზღვრის წყარო. ცალკე ინახება, რადგან ზონის არსებობა და მისი საზღვრები სხვადასხვა წყაროდან შეიძლება მოდიოდეს.

| ველი | ტიპი | სავალდებულო? | მაგალითი |
|---|---|---|---|
| `method` | string | არა | აწყობის ხერხი; მნიშვნელობები: ჩატი 3 |
| `source`, `verified`, `note` | Provenance | კი, კი, არა | `"placeholder"`, `false` |

სანიმუშო ჩანაწერი. სახელი რეალურია; კავშირები, სოფლები და გეომეტრია placeholder-ებია (`regions`, `grapes` და `styles` კანდიდატი მნიშვნელობებია, არა დადასტურებული მონაცემი):

```json
{
  "id": "napareuli",
  "name": { "ka": "ნაფარეული" },
  "regions": [
    { "id": "kakheti", "source": "placeholder", "verified": false }
  ],
  "grapes": [
    { "id": "rkatsiteli", "source": "placeholder", "verified": false },
    { "id": "saperavi", "source": "placeholder", "verified": false }
  ],
  "styles": [
    { "id": "dry-red", "source": "placeholder", "verified": false },
    { "id": "dry-white", "source": "placeholder", "verified": false }
  ],
  "villages": [
    { "id": "placeholder-1", "name": { "ka": "[სოფელი 1]" }, "source": "placeholder", "verified": false },
    { "id": "placeholder-2", "name": { "ka": "[სოფელი 2]" }, "source": "placeholder", "verified": false }
  ],
  "boundary": { "source": "placeholder", "verified": false },
  "labelPoint": [0.0005, 0.0005],
  "bbox": [0, 0, 0.001, 0.001],
  "source": "placeholder",
  "verified": false
}
```

გეომეტრია. ზონა ყოველთვის `MultiPolygon`-ია, ერთნაწილიანიც, რომ ტიპი ერთი იყოს:

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "id": "napareuli",
      "properties": {},
      "geometry": {
        "type": "MultiPolygon",
        "coordinates": [
          [[[0, 0], [0.001, 0], [0.001, 0.001], [0, 0.001], [0, 0]]]
        ]
      }
    }
  ]
}
```

---

## 5. კავშირები

| კავშირი | კარდინალობა | სად ინახება | უკუ მიმართულება |
|---|---|---|---|
| ზონა → რეგიონი | many-to-many (ზონას ≥ 1 რეგიონი) | `zone.regions[]` | რეგიონი → ზონები: ითვლება ჩატვირთვისას |
| ზონა ↔ სტილი | many-to-many | `zone.styles[]` | სტილი → ზონები: ითვლება |
| ზონა ↔ ჯიში | many-to-many | `zone.grapes[]` | ჯიში → ზონები: ითვლება |
| ზონა → სოფელი | one-to-many (სოფელი შეიძლება ორ ზონაში იყოს) | `zone.villages[]` | არ გვჭირდება |
| ზონა → გეომეტრია | 1:1 | `zones.geo.json`, `Feature.id` = `zone.id` | — |
| ჩანაწერი → წყარო | many-to-one | `source` → `sources.json` | — |

კავშირები გეომეტრიის `properties`-ში არ ინახება და არც ცალკე join ფაილშია: ზონების რაოდენობა მცირეა, ჩანაწერი კი თავისი კავშირებით ერთად იკითხება და მოწმდება.

### ფილტრის სემანტიკა

01 §3-ის მიხედვით, ზონის დონეზე: ზონა შეესაბამება ფილტრს, თუ ყოველი არაცარიელი განზომილებისთვის მისი სია (`zone.styles`, `zone.grapes`) მონიშნულ ვარიანტებს კვეთს. OR განზომილების შიგნით, AND განზომილებებს შორის. მთვლელები და disabled-ის წესი 01 §3-ის მიხედვით.

**ცნობილი შეზღუდვა.** სტილი და ჯიში ზონის შიგნით ერთმანეთთან დაკავშირებული არ არის. `style=amber&grape=saperavi` ჩართავს ზონას, სადაც ქარვისფერიც მზადდება და საფერავიც გამოიყენება, მაშინაც, თუ ქარვისფერი საფერავი იქ არ არსებობს. თუ ეს მოგვიანებით პრობლემად იქცა, შეიძლება დაემატოს `zone.wines` (§8); ამას მონაცემების ხელახლა შეგროვება დასჭირდება.

---

## 6. `source` და `verified`

| დონე | რას ადასტურებს |
|---|---|
| ზონა | ზონა არსებობს და ასე ჰქვია |
| `zone.boundary` | საზღვრის გეომეტრია |
| `zone.regions[i]` | ზონა ამ რეგიონშია |
| `zone.grapes[i]` | ჯიში ამ ზონის ღვინოებში გამოიყენება |
| `zone.styles[i]` | ამ ზონაში ეს სტილი მზადდება |
| `zone.villages[i]` | სოფელი ზონაში შედის |
| რეგიონი, ჯიში, სტილი | თავად ჩანაწერი |

წესები:
- `verified: true` მხოლოდ მაშინ, როცა ჩანაწერი მითითებულ წყაროსთან შემოწმდა.
- `source: "placeholder"` ⇒ `verified: false`. production build ჩავარდება, თუ ერთი placeholder მაინც დარჩა; dev-ში მხოლოდ გაფრთხილებაა.
- `verified: false` რეალური წყაროთი შეიძლება გამოქვეყნდეს; UI მას ნიშნით აჩვენებს (ჩვენების წესი: ეტაპი 7).
- ზონის `verified` შვილობილ ჩანაწერებს არ აჯამებს. თუ UI-ს „სრულად შემოწმებული ზონა“ დასჭირდება, ეს წარმოებული მონაცემია.

---

## 7. ფერი: ადგილი ჩატი 2-სთვის

ფერი მონაცემში არასოდეს ინახება; `mapColors.js` მას id-ით ირჩევს (01 §8). მოდელი ორივე ვარიანტს იტევს:

| ჩატი 2-ის ვარიანტი | რას იყენებს | ახალი ველი |
|---|---|---|
| ერთი ფერი ყველა ზონისთვის | — | არა |
| ფერი რეგიონის მიხედვით | `zone.regions` | ორრეგიონიანი ზონისთვის: `primaryRegion?: RegionId` |
| ფერი სტილის მიხედვით, წესით | `zone.styles` + `style.order` (მაგ. ყველაზე პატარა `order`) | არა |
| ფერი სტილის მიხედვით, ხელით არჩეული | `zone.styles` | `primaryStyle?: StyleId` (უნდა იყოს `zone.styles`-ში) |
| რამდენიმე ფერი ერთ ზონაზე (ზოლები, ნაწილები) | `zone.styles` | არა |

---

## 8. ველები, რომლებიც შეიძლება დაემატოს

| ველი | ერთეული | როდის | რისთვის |
|---|---|---|---|
| `primaryStyle`, `primaryRegion` | ზონა | ჩატი 2 | ფერის წესი (§7) |
| `status` | რეგიონი | ჩატი 3 | აფხაზეთისა და ცხინვალის რეგიონის ჩვენების წესი |
| `boundary.method`-ის მნიშვნელობები | ზონა | ჩატი 3 | საზღვრის აწყობის ხერხი |
| `color` (კანის ფერი) | ჯიში | ეტაპი 6 | ფილტრში ჯიშების დაჯგუფება |
| `synonyms` | ზონა | თუ ზონის ძებნა დაემატება | გავრცელებული ლათინური ფორმები (მაგ. ყ → q-ს შემთხვევაში) |
| აღწერის ტექსტები | ზონა | ეტაპი 7 | ცალკე, lazy ფაილში (01 §6) |
| `name.en` | ყველა | ინგლისური ვერსია | `LocalizedString`-ში უკვე გათვალისწინებულია |
| `wines` (სტილი + მისი ჯიშები) | ზონა | თუ §5-ის შეზღუდვა პრობლემად იქცა | სტილისა და ჯიშის ზუსტი კომბინაციები ფილტრში |

---

## 9. ვალიდაციის წესები (იმპლემენტაცია: ჩატი 3)

1. ფაილები §10-ის ინტერფეისებს შეესაბამება: სავალდებულო ველები, ტიპები, slug-ის ფორმა.
2. id უნიკალურია ფაილის შიგნით; `zone.regions`-ში, `zone.grapes`-ში და `zone.styles`-ში id არ მეორდება.
3. ყველა მითითება არსებობს: `regions`, `grapes`, `styles`, `source`.
4. `zones.json` ↔ `zones.geo.json` და `regions.json` ↔ `regions.geo.json`: 1:1 id-ით.
5. ზონის გეომეტრია `MultiPolygon`-ია და ვალიდურია (დახურული რგოლები, თვითგადაკვეთის გარეშე).
6. კოორდინატები საქართველოს ფარგლებშია (ზღვარი `regions.geo.json`-იდან ითვლება); `labelPoint` თავისი ზონის შიგნითაა; `bbox` გეომეტრიის extent-ს ემთხვევა.
7. `source: "placeholder"` ⇒ `verified: false`; production-ში placeholder არ რჩება.
8. `zone.regions` ემთხვევა გეომეტრიისა და რეგიონების თანაკვეთას (გაფრთხილება, არა შეცდომა).
9. ფაილები `id`-ით დალაგებულია; კოორდინატები 5 ათწილადამდეა დამრგვალებული.

---

## 10. TypeScript ინტერფეისები (მხოლოდ დოკუმენტაცია)

```ts
// Documentation only — not compiled, not imported by the app.

/** [a-z0-9]+(-[a-z0-9]+)* — see §2 */
type Slug = string;
type ZoneId = Slug;
type RegionId = Slug;
type GrapeId = Slug;
type VillageId = Slug; // "<municipality>-<village>"
type SourceId = Slug;
type StyleId = 'amber' | 'semi-sweet' | 'sparkling' | 'dry-white' | 'dry-red';

/** [lon, lat], EPSG:4326, 5 decimals */
type LngLat = [number, number];
/** [minLon, minLat, maxLon, maxLat], EPSG:4326 */
type BBox = [number, number, number, number];

interface LocalizedString {
  ka: string;
  en?: string; // not in v1
}

interface Provenance {
  source: SourceId; // 'placeholder' => verified must be false
  verified: boolean;
  note?: string;    // internal, never shown in UI
}

interface Source {
  id: SourceId;
  title: string;
  publisher?: string;
  url?: string;
  accessed?: string; // ISO 8601 date
  license?: string;
}

interface Style extends Provenance {
  id: StyleId;
  name: LocalizedString;
  synonyms: string[];
  order: number;
}

interface Grape extends Provenance {
  id: GrapeId;
  name: LocalizedString;
  synonyms: string[];
}

interface Region extends Provenance {
  id: RegionId;
  name: LocalizedString;
  bbox: BBox;
}

/** Relation record: target id plus the relation's own provenance. */
interface Link<Id extends Slug> extends Provenance {
  id: Id;
}
type RegionLink = Link<RegionId>;
type GrapeLink = Link<GrapeId>;
type StyleLink = Link<StyleId>;

interface VillageLink extends Provenance {
  id: VillageId;
  name: LocalizedString;
}

interface Boundary extends Provenance {
  method?: string; // values defined in chat 3
}

interface Zone extends Provenance {
  id: ZoneId;
  name: LocalizedString;
  regions: RegionLink[];   // min 1, ids unique
  grapes: GrapeLink[];     // min 1, ids unique
  styles: StyleLink[];     // min 1, ids unique
  villages: VillageLink[]; // min 1
  boundary: Boundary;
  labelPoint: LngLat;      // inside the zone geometry
  bbox: BBox;
  // May be added in chat 2: primaryStyle?: StyleId; primaryRegion?: RegionId;
}

/* Geometry files */
type Ring = LngLat[];
interface PolygonGeometry { type: 'Polygon'; coordinates: Ring[] }
interface MultiPolygonGeometry { type: 'MultiPolygon'; coordinates: Ring[][] }

interface GeoFeature<Id extends Slug, G> {
  type: 'Feature';
  id: Id;
  properties: Record<string, never>; // always {}
  geometry: G;
}

interface FeatureCollection<F> {
  type: 'FeatureCollection';
  features: F[];
}

/* Files in src/data/ */
type SourcesFile = Source[];
type StylesFile = Style[];
type GrapesFile = Grape[];
type RegionsFile = Region[];
type ZonesFile = Zone[];
type RegionsGeoFile = FeatureCollection<GeoFeature<RegionId, PolygonGeometry | MultiPolygonGeometry>>;
type ZonesGeoFile = FeatureCollection<GeoFeature<ZoneId, MultiPolygonGeometry>>;
```

---

## 11. გავლენა 01-architecture.md-ზე

1. **ახალი ფაილი** `src/data/sources.json`; მას `loaders/catalogs.js` სტატიკურად ტვირთავს. 01-ის ფაილების ხეს ემატება.
2. **ძებნა** FilterPanel-ში: `name.ka` + `synonyms`, id-ის გარეშე.
3. ფილტრის სემანტიკა (`domain/filter.js`, `domain/facets.js`) უცვლელია: ზონის დონეზე, 01 §3-ის მიხედვით.
4. 01 §10-ის მე-2 პუნქტი (ატრიბუტებისა და გეომეტრიის გაყოფა) ამ მოდელის საფუძველია: 02-ის დადასტურება მასაც ადასტურებს.

---

## 12. გადაწყვეტილებები

### დადასტურებული
- **ზონა↔ჯიში და ზონა↔სტილი დამოუკიდებელი სიებია** (`zone.grapes`, `zone.styles`), როგორც context.md-შია. ფილტრი ზონის დონეზე მუშაობს; ცნობილი შეზღუდვა: §5.

### დასადასტურებელი
1. **ტრანსლიტერაცია:** ეროვნული სისტემა აპოსტროფების გარეშე, გამონაკლისების გარეშე (ყ → `q`).
2. **სტილების slug-ები:** `amber`, `semi-sweet`, `sparkling`, `dry-white`, `dry-red`.
3. **სახელები** `LocalizedString`-ად (`{ "ka": … }`).
4. **`villages` სავალდებულოა, მინ. 1.** თუ ჩატ 3-ში აღმოჩნდა, რომ რომელიმე ზონა სოფლებით არ არის განსაზღვრული, ეს წესი გადაიხედება.
5. **წყაროების რეესტრი** (`sources.json`) დაჯავშნილი id-ებით `placeholder` და `project-glossary`.
6. **placeholder production-ს ბლოკავს**, `verified: false` კი ნიშნით ქვეყნდება.

---

## 13. გადასამოწმებელი მონაცემები

- **ნაფარეული:** ჯიშები (რქაწითელი, საფერავი), სტილები (`dry-white`, `dry-red`) და რეგიონი `kakheti` კანდიდატია; 6 სოფელი (context.md) — სახელები უცნობია; საზღვარი. [verified: false]
- **ხვანჭკარა:** 30+ სოფელი რიონის ხეობის გასწვრივ (context.md); ჯიშები, სტილები, რეგიონი და საზღვარი. [verified: false]
- ყველა ზონა↔ჯიშის კავშირი ოფიციალურ წყაროსთან (context.md).
- განსაზღვრულია თუ არა v1-ის ყველა ზონა სოფლების სიით (§12, პუნქტი 5).
- ფარავს თუ არა ზონები ერთმანეთს გეოგრაფიულად. გავლენა აქვს ეტაპ 5-ზე: გადაფარვაზე დაწკაპუნებისას რომელი ზონა აირჩევა.
- ADM1-ის სახელები და მათი slug-ები (ჩატი 3).
- სინონიმი „კახური ტიპის“ `amber`-თან: მოიცავს თუ არა ის წითელ ქვევრის ღვინოსაც (04-copy-voice.md).

---

## 14. ტერმინები (წინადადება, 04-copy-voice.md-ის გლოსარიუმისთვის)

| ტერმინი | მნიშვნელობა |
|---|---|
| კავშირის ჩანაწერი | `RegionLink`, `GrapeLink`, `StyleLink`, `VillageLink`: კავშირი საკუთარი `source`-ით და `verified`-ით |
| წყაროების რეესტრი | `sources.json`: ყველა წყარო id-ით |
| საზღვრის წყარო | `zone.boundary`: საიდან მოდის ზონის გეომეტრია და შემოწმებულია თუ არა |
| placeholder | ჩანაწერი `source: "placeholder"`-ით: მონაცემი ჯერ არ გვაქვს |
