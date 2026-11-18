// src/copy/ka.js
// Every UI string lives here (04-copy-voice.md).
// Stages 4–5: map and layout strings. Stage 6: filter panel.

export const ka = {
  app: {
    title: 'საქართველოს ღვინის რუკა',
  },
  map: {
    label: 'რუკა',
    zoomIn: 'მიახლოება',
    zoomOut: 'დაშორება',
    loading: 'რუკა იტვირთება…',
    loadError: 'რეგიონების საზღვრები ვერ ჩაიტვირთა.',
    zonesLoadError: 'ღვინის ზონები ვერ ჩაიტვირთა.',
    retry: 'თავიდან ცდა',
  },
  basemap: {
    button: 'საბაზისო რუკა',
    names: {
      light: 'ღია ფონი',
      terrain: 'რელიეფი',
      imagery: 'სატელიტი',
    },
  },
  filter: {
    title: 'ფილტრი',
    clear: 'გასუფთავება',
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
  },
};
