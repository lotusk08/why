const COLUMNS = [-450, -150, 150, 450];
const ROWS = [-280, -140, 0, 140, 280];
const PHASE = { discover: 'blue', consider: 'yellow', convert: 'orange', advocate: 'green' };

function idea(id, text, column, row, { color = undefined, lineType = 'solid' } = {}) {
  return { id, text, x: COLUMNS[column], y: ROWS[row], lineType, color };
}

function link(id, from, to, type = '') {
  return { id, type, from: [from].flat(), to };
}

export const DEFAULT_MAP = [
  idea('awareness', '1. Awareness', 0, 1, { color: PHASE.discover }),
  idea('interest', '2. Interest', 1, 1, { color: PHASE.discover }),
  idea('search', '3. Search', 2, 1, { color: PHASE.consider }),
  idea('compare', '4. Compare', 3, 1, { color: PHASE.consider }),
  idea('decision', '5. Decision', 3, 2, { color: PHASE.convert }),
  idea('promotion', '6. Promotion', 3, 3, { color: PHASE.convert }),
  idea('purchase', '7. Purchase', 2, 3, { color: PHASE.convert }),
  idea('sharing', '8. Sharing', 1, 3, { color: PHASE.advocate }),
  idea('advice', '9. Advice', 0, 3, { color: PHASE.advocate }),
  idea('media', 'Ads · TV · News · PR', 0, 0),
  idea('seeding', 'Seeding', 1, 0),
  idea('seo', 'SEO', 2, 0),
  idea('review', 'Review', 3, 0),
  idea('magazine', 'Magazine', 1, 2),
  idea('koc', 'KOC / Group', 2, 2),
  idea('reviewer', 'Reviewer', 0, 4),
  idea('loyalty', 'Loyalty', 1, 4),
  idea('competitor', 'Competitor', 3, 4, { lineType: 'dashed' }),
  link('l1', 'awareness', 'interest', 'stirs'),
  link('l2', 'interest', 'search', 'prompts'),
  link('l3', 'search', 'compare', 'leads to'),
  link('l4', 'compare', 'decision', 'settles'),
  link('l5', 'decision', 'promotion', 'waits for'),
  link('l6', 'promotion', 'purchase', 'triggers'),
  link('l7', 'purchase', 'sharing', 'invites'),
  link('l8', 'sharing', 'advice', 'becomes'),
  link('l9', 'advice', 'awareness', 'feeds'),
  link('t1', 'media', 'awareness', 'build'),
  link('t2', 'seeding', 'interest', 'sparks'),
  link('t3', 'seo', 'search', 'steers'),
  link('t4', 'review', 'compare', 'informs'),
  link('t5', 'magazine', 'interest', 'fuels'),
  link('t6', 'koc', 'interest', 'recommends'),
  link('t7', ['koc', 'decision'], 'purchase', 'convert'),
  link('t8', 'loyalty', 'sharing', 'drives'),
  link('t9', 'reviewer', 'advice', 'shapes'),
  link('o1', 'competitor', 'promotion', 'undercuts')
];
