// src/copy/ka.js
// Every UI string lives here (04-copy-voice.md).
// Stages 4–5: map and layout strings. Stage 6: filter panel.
// Stage 7: term explanations, zone panel, region list.
// Stage 8: bottom sheet, filter button, keyboard use of the map.

// One sentence per term (04 §3): reused wherever the term first appears.
const QVEVRI = 'ქვევრი მიწაში ჩაფლული თიხის დიდი ჭურჭელია, რომელშიც ღვინო დუღს და ინახება.';

// Month names in the nominative, for dates like "9 ოქტომბერი, 2026". Written
// out here because not every browser ships Georgian locale data for Intl.
const MONTHS = [
  'იანვარი',
  'თებერვალი',
  'მარტი',
  'აპრილი',
  'მაისი',
  'ივნისი',
  'ივლისი',
  'აგვისტო',
  'სექტემბერი',
  'ოქტომბერი',
  'ნოემბერი',
  'დეკემბერი',
];

export const ka = {
  app: {
    title: 'საქართველოს ღვინის რუკა',
  },
  /**
   * ISO date from the data files ("2026-10-09") → "9 ოქტომბერი, 2026".
   * Anything that is not such a date is returned as written.
   */
  date: (iso) => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? '');
    const month = match && MONTHS[Number(match[2]) - 1];
    return month ? `${Number(match[3])} ${month}, ${match[1]}` : String(iso ?? '');
  },
  map: {
    label: 'რუკა',
    zoomIn: 'მიახლოება',
    zoomOut: 'დაშორება',
    loading: 'რუკა იტვირთება…',
    loadError: 'რეგიონების საზღვრები ვერ ჩაიტვირთა.',
    zonesLoadError: 'ღვინის ზონები ვერ ჩაიტვირთა.',
    retry: 'თავიდან ცდა',
    // Button on a zone or a region: fits the map to it.
    showOnMap: 'რუკაზე ჩვენება',
    // Announced after the map has moved (role="status").
    shownOnMap: (name) => `რუკა აჩვენებს: ${name}`,
    // The map as one keyboard stop (stage 8). Key names stay as printed on the keys.
    keyboard: {
      // Name of the focusable map; the landmark around it is `map.label`.
      label: 'ინტერაქტიული რუკა',
      // Shown while the map has keyboard focus, and its description for screen readers.
      help: 'ისრები რუკას გადაადგილებს, + და − მასშტაბს ცვლის. Page Down და Page Up შემდეგ და წინა ზონაზე გადადის, Enter ზონის აღწერას ხსნის.',
      // Announced when Page Down / Page Up moves to a zone: "ნაფარეული, კახეთი. ზონა 1, სულ 2."
      zone: ({ name, regions, index, total }) =>
        `${[name, regions].filter(Boolean).join(', ')}. ზონა ${index}, სულ ${total}.`,
      noZones: 'რუკაზე ზონა ჯერ არ არის.',
    },
  },
  // Bottom sheet handle (mobile): the label says what pressing it does now.
  sheet: {
    expand: 'გაშლა',
    expandFull: 'სრულად გაშლა',
    collapse: 'ჩაკეცვა',
  },
  basemap: {
    button: 'საბაზისო რუკა',
    names: {
      light: 'ღია ფონი',
      humanitarian: 'ჰუმანიტარული',
      terrain: 'რელიეფი',
      imagery: 'სატელიტი',
      hybrid: 'ჰიბრიდი',
    },
  },
  filter: {
    title: 'ფილტრი',
    clear: 'გასუფთავება',
    // Mobile: closes the filter and brings the region list back.
    close: 'დახურვა',
    // Mobile button over the map that opens the filter in the bottom sheet.
    button: (activeCount) => (activeCount > 0 ? `ფილტრი, აქტიურია ${activeCount}` : 'ფილტრი'),
    groups: {
      style: 'ღვინის სტილი',
      grape: 'ვაზის ჯიში',
    },
    // Read after the number by screen readers: "2 ზონა".
    zoneUnit: 'ზონა',
    search: {
      label: 'სტილის ან ჯიშის ძებნა',
      placeholder: 'სტილი ან ჯიში',
      clear: 'ძებნის გასუფთავება',
      matchedBy: 'დაემთხვა:',
      found: (count) => `ნაპოვნია ${count} ვარიანტი`,
      nothing: 'ვერაფერი მოიძებნა. სცადე სხვა სიტყვა.',
    },
    // Why an option with 0 zones is switched off; one line per group and reason.
    hints: {
      style: {
        'no-zones': '0-იან სტილებს რუკაზე ზონა ჯერ არ აქვს.',
        conflict: '0-იან სტილებს არჩეული ჯიშით ზონა არ აქვს.',
      },
      grape: {
        'no-zones': '0-იან ჯიშებს რუკაზე ზონა ჯერ არ აქვს.',
        conflict: '0-იან ჯიშებს არჩეული სტილით ზონა არ აქვს.',
      },
    },
    summary: {
      all: (total) => `ნაჩვენებია ყველა ზონა: ${total}`,
      some: (count, total) => `ფილტრს შეესაბამება ${count} ზონა ${total}-დან`,
      none: 'ფილტრს არცერთი ზონა არ შეესაბამება.',
    },
    /**
     * The one sentence about the filter's result: the visible line in the
     * filter panel, the collapsed bottom sheet and the app's live region.
     * @param {{ active: boolean, count: number, total: number }} state
     */
    summaryOf: ({ active, count, total }) => {
      if (!active) return ka.filter.summary.all(total);
      return count === 0 ? ka.filter.summary.none : ka.filter.summary.some(count, total);
    },
  },
  // Explanations for readers who do not know wine vocabulary: one sentence
  // per term, no second unexplained term inside it (04 §3).
  terms: {
    grape: 'ვაზის ჯიში ყურძნის ნაირსახეობაა: ღვინის გემო და ფერი დიდწილად მასზეა დამოკიდებული.',
    qvevri: QVEVRI,
  },
  // Shown under the style badge in the zone panel. Keys are styles.json slugs.
  styleNotes: {
    amber: `თეთრი ყურძნის ღვინო, რომელიც ქვევრში ყურძნის კანთან და წიპწასთან ერთად დუღს და ამიტომ ქარვისფერია. ${QVEVRI}`,
    'semi-sweet': 'ღვინო, რომელშიც ყურძნის საკუთარი შაქრის ნაწილი რჩება; შაქარს არ უმატებენ.',
    sparkling: 'ღვინო ბუშტებით, რომლებიც დუღილისას ბუნებრივად ჩნდება.',
    'dry-white': 'თეთრი ღვინო, რომელშიც შაქარი თითქმის არ რჩება, ამიტომ ტკბილი არ არის.',
    'dry-red': 'წითელი ღვინო, რომელშიც შაქარი თითქმის არ რჩება, ამიტომ ტკბილი არ არის.',
  },
  zone: {
    close: 'დახურვა',
    sections: {
      style: 'ღვინის სტილი',
      grape: 'ვაზის ჯიში',
      villages: 'სოფლები',
    },
    grapeHint: 'აირჩიე ჯიში და რუკა მის ყველა ზონას აჩვენებს.',
    // Hidden addition after the name of a style or grape that is in the filter: ", ფილტრშია".
    inFilter: 'ფილტრშია',
    // Data that does not exist yet: "[what] ჯერ არ არის." Never a dash or "N/A".
    missing: {
      description: 'აღწერა ჯერ არ არის.',
      source: 'წყარო ჯერ არ არის მითითებული.',
    },
    // "verified": false. The sign sits at the highest level it fully covers:
    // the whole panel, a section, or a single item.
    unverified: {
      all: 'ამ ზონის მონაცემები წყაროსთან ჯერ არ შემოწმებულა.',
      tag: 'გადასამოწმებელი',
      // Hidden text of the "?" sign next to a single item.
      item: 'გადასამოწმებელია',
      legend: 'ნიშანი „?“: მონაცემი წყაროსთან ჯერ არ შემოწმებულა.',
    },
    // One line under "show on the map", by the state of zone.boundary.
    boundary: {
      missing: 'ამ ზონის საზღვარი ჯერ არ გვაქვს.',
      // Follows `missing`: what "show on the map" shows while the zone has no
      // outline. The names stay in the nominative after the colon.
      showsRegion: (regionNames) =>
        `ამიტომ რუკა ${regionNames.length > 1 ? 'რეგიონებს' : 'რეგიონს'} აჩვენებს: ${regionNames.join(', ')}.`,
      approximate: 'საზღვარი მიახლოებითია: სოფლების მდებარეობიდანაა გამოთვლილი.',
      unverified: 'საზღვარი წყაროსთან ჯერ არ შემოწმებულა.',
    },
    source: {
      one: 'წყარო',
      many: 'წყაროები',
      accessed: (date) => `ნანახია: ${date}`,
      // Hidden addition after an external link: ", ახალ ჩანართში იხსნება".
      newTab: 'ახალ ჩანართში იხსნება',
    },
  },
  regionList: {
    title: 'რეგიონები',
    intro: 'აირჩიე რეგიონი და რუკა მას აჩვენებს. ზონის არჩევა მის აღწერას ხსნის.',
    zoneCount: (count) => `${count} ზონა`,
    // Second line of a zone that the filter has dimmed.
    dimmed: 'არ შეესაბამება ფილტრს',
    empty: 'ამ რეგიონის ზონა რუკაზე ჯერ არ არის.',
  },
};
