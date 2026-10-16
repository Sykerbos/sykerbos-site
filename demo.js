import { plantAssetFor } from './plant-assets.js';

// Fixed, fictional examples. The guest preview makes no Auth or Data API calls.
const plants = [
  { id:'basil', nickname:'Kitchen Basil', common_name:'Basil', botanical_name:'Ocimum basilicum', weight:684.2, temperature:22.1, rate:18.6, status:'Comfortable', note:'A steady dry-down after watering. In this example, the basil is using water faster than the rosemary.', action:'Watch the trend', guidance:'A continuing downward weight curve shows water leaving the pot. Real guidance will learn from each plant’s own wet and dry cycles.', dossier:'herbarium-basil.html', dry:610, wet:735 },
  { id:'orange', nickname:'Orange Seedling', common_name:'Valencia Orange', botanical_name:'Citrus × sinensis', weight:548.5, temperature:23.4, rate:6.2, status:'Watch closely', note:'This sample seedling is approaching its illustrative dry reference. Its slowing weight loss is a pattern to investigate.', action:'A closer look', guidance:'Slower weight loss can have several causes, including changing conditions or reduced water availability. A real plant needs its own observations before a watering threshold is trusted.', dossier:'herbarium-orange.html', dry:530, wet:650 },
  { id:'rosemary', nickname:'Windowsill Rosemary', common_name:'Rosemary', botanical_name:'Salvia rosmarinus', weight:1124.8, temperature:21.3, rate:9.4, status:'Learning', note:'A slower example dry-down. Comparing repeated cycles helps reveal how this rosemary behaves in its growing conditions.', action:'Learning its rhythm', guidance:'Rosemary comes from habitats with seasonal dryness. Sykerbos combines plant knowledge with the actual pot’s measurements; the species name alone cannot set a watering schedule.', dossier:'herbarium-rosemary.html', dry:1040, wet:1190 }
];
const params = new URLSearchParams(location.search);
const chosen = plants.find(p => p.id === params.get('plant'));
const view = chosen || params.has('plant') ? 'detail' : params.get('view') === 'plants' ? 'plants' : 'home';
const host = document.querySelector('#demo-content');
for (const link of document.querySelectorAll('[data-view]')) {
  if (link.dataset.view === (view === 'detail' ? 'plants' : view)) {
    link.classList.add('active');
    link.setAttribute('aria-current', 'page');
  }
}
const detailUrl = p => `demo.html?plant=${p.id}`;
const photo = p => plantAssetFor(p).image;
function readings(p, days = 7) {
  const count = days * 48;
  // 30-minute sample cadence, with one fictional irrigation event four days ago.
  return Array.from({length:count + 1}, (_, i) => {
    const ago = (count - i) / 48;
    return p.weight + p.rate * ago - (ago > 4 ? p.rate * 4.5 : 0)
      + Math.sin(ago * Math.PI * 2) * 1.2;
  });
}
function chart(p, days = 7) {
  const values = readings(p, days);
  const low = Math.floor(Math.min(...values) - 3), high = Math.ceil(Math.max(...values) + 3);
  const coords = values.map((weight, i) => `${(38 + i / (values.length - 1) * 724).toFixed(1)},${(18 + (high - weight) / (high - low) * 190).toFixed(1)}`);
  return `<svg class="demo-chart" viewBox="0 0 800 240" role="img" aria-label="Simulated ${days}-day weight history for ${p.nickname}">
    <line x1="38" y1="18" x2="762" y2="18" class="chart-grid-line"/>
    <line x1="38" y1="113" x2="762" y2="113" class="chart-grid-line"/>
    <line x1="38" y1="208" x2="762" y2="208" class="chart-grid-line"/>
    <polyline points="${coords.join(' ')}" class="live-chart-path"/>
    <text x="40" y="14" font-size="12" fill="currentColor">${high} g</text>
    <text x="40" y="225" font-size="12" fill="currentColor">${days} day${days === 1 ? '' : 's'} ago</text>
    <text x="718" y="225" font-size="12" fill="currentColor">Now</text>
  </svg>`;
}
function card(p) {
  return `<a class="plant-collection-card" href="${detailUrl(p)}">
    <img class="demo-photo" src="${photo(p)}" alt="${p.common_name}">
    <div class="plant-collection-copy"><span class="status ${p.id === 'orange' ? 'learning' : 'good'}">${p.status} · sample</span><h3>${p.nickname}</h3><p><em>${p.botanical_name}</em></p><div class="mini-reading"><strong>${p.weight.toFixed(1)} g</strong><span>${p.temperature.toFixed(1)} °C</span></div><small>Explore sample plant →</small></div>
  </a>`;
}
function metrics(p) {
  return `<section class="metric-strip" aria-label="Simulated plant summary">
    <article><small>Temperature</small><strong>${p.temperature.toFixed(1)} °C</strong><span>Sample reading</span></article>
    <article><small>Dry-down</small><strong>${p.rate.toFixed(1)} g/day</strong><span>Illustrative water loss</span></article>
    <article><small>Sample history</small><strong>7 days</strong><span>30-minute intervals</span></article>
    <article><small>Source</small><strong>Simulated</strong><span>No hardware connected</span></article>
  </section>`;
}
function primary(p, link = false) {
  const content = `<section class="attention-card live-primary-card"><img class="primary-herbarium-image has-image" src="${photo(p)}" alt="${p.common_name}" style="object-fit:cover"><div class="primary-copy"><span class="status learning">${p.status} · sample</span><p class="eyebrow">${p.botanical_name}</p><h2>${p.nickname}</h2><p>${p.note}</p>${link ? '<p class="text-link">Explore this plant →</p>' : ''}</div><div class="attention-reading"><strong>${p.weight.toFixed(1)} g</strong><span>Simulated weight</span></div></section>`;
  return link ? `<a class="demo-overview-link" href="${detailUrl(p)}">${content}</a>` : content;
}
function renderHome() {
  const p = plants[0];
  host.innerHTML = `<section class="welcome-row"><div><p class="eyebrow">Explore Sykerbos</p><h1>A little garden to explore.</h1><p class="lede">See how continuous plant sensing could look, using three sample plants.</p></div><a class="button" href="demo.html?view=plants">Meet the sample plants →</a></section>
    ${primary(p, true)}${metrics(p)}
    <section class="home-grid"><article class="panel chart-panel"><div class="panel-heading"><div><p class="eyebrow">Kitchen Basil · sample</p><h2>Weight trend</h2></div><span>7 days</span></div>${chart(p)}<p class="panel-note">Simulated readings: the upward step illustrates watering; the falling curve illustrates dry-down.</p></article>
    <article class="panel intelligence-panel"><p class="eyebrow">Understanding the pattern</p><h2>Each plant has a rhythm.</h2><p>Weight rises when water is added and falls as water leaves the pot. Repeated cycles help Sykerbos learn that plant’s behaviour.</p><p class="demo-note">This preview illustrates the experience. These plants, readings and interpretations are examples.</p><a class="text-link" href="${detailUrl(p)}">Explore the sample evidence →</a></article></section>
    <section class="section-block"><div class="section-title-row"><div><p class="eyebrow">Sample collection</p><h2>Growing now</h2></div><a class="text-link" href="demo.html?view=plants">View all sample plants →</a></div><div class="plant-grid-live">${plants.map(card).join('')}</div></section>
    <section class="section-block panel settings-tease" id="settings"><div><p class="eyebrow">Keep exploring</p><h2>Meet the plants behind the data.</h2><p>Discover their habitats, history and water strategies.</p></div><a class="button" href="herbarium.html?demo=1">Browse Herbarium →</a></section>`;
}
function renderPlants() {
  document.title = 'Sample plants — Sykerbos';
  host.innerHTML = `<section class="demo-collection-title"><p class="eyebrow">Guest demo · sample collection</p><h1>Growing now.</h1><p class="lede">Three different plants, three different water-use patterns. Choose one to explore.</p></section><div class="plant-grid-live">${plants.map(card).join('')}</div><section class="section-block"><a class="text-link" href="herbarium.html?demo=1">Find more species in the Herbarium →</a></section>`;
}
function renderDetail(p) {
  if (!p) {
    host.innerHTML = '<h1>Sample plant not found.</h1><a class="button" href="demo.html?view=plants">Choose a sample plant</a>';
    return;
  }
  document.title = `${p.nickname} · Demo — Sykerbos`;
  const reserve = Math.round((p.weight - p.dry) / (p.wet - p.dry) * 100);
  host.innerHTML = `<a class="demo-back" href="demo.html?view=plants">← All sample plants</a>${primary(p)}${metrics(p)}
    <div class="demo-tabs" role="tablist" aria-label="Sample plant details"><button type="button" role="tab" id="tab-overview" aria-controls="panel-overview" aria-selected="true" data-panel="overview">Overview</button><button type="button" role="tab" id="tab-intelligence" aria-controls="panel-intelligence" aria-selected="false" tabindex="-1" data-panel="intelligence">Intelligence</button><button type="button" role="tab" id="tab-herbarium" aria-controls="panel-herbarium" aria-selected="false" tabindex="-1" data-panel="herbarium">Herbarium</button></div>
    <section class="panel demo-panel" id="panel-overview" role="tabpanel" aria-labelledby="tab-overview"><div class="panel-heading"><h2>Weight history</h2><div class="demo-chart-controls" aria-label="History range"><button type="button" aria-pressed="false" data-days="1">24h</button><button type="button" aria-pressed="true" data-days="7">7d</button></div></div><div id="demo-history">${chart(p)}</div><p class="panel-note">Simulated data for illustration. No real VyTile readings are shown.</p><h2>${p.action}</h2><p>${p.guidance}</p></section>
    <section class="panel demo-panel" id="panel-intelligence" role="tabpanel" aria-labelledby="tab-intelligence" hidden><p class="eyebrow">Illustrative plant intelligence</p><h2>Learning from wet and dry cycles.</h2><p>Using sample dry and saturated references of ${p.dry} g and ${p.wet} g, this example places the pot at about ${reserve}% of its sample water reserve.</p><div class="learning-progress" aria-label="Illustrative water reserve ${reserve}%"><span style="width:${reserve}%"></span></div><p class="demo-note">These references and this percentage are invented for the demo. Real thresholds need observations of the individual plant and pot; this is not a watering recommendation.</p><h2>What the curve can tell us</h2><p>${p.guidance}</p></section>
    <section class="panel demo-panel" id="panel-herbarium" role="tabpanel" aria-labelledby="tab-herbarium" hidden><p class="eyebrow">Meet the species</p><h2>${p.common_name}</h2><p><em>${p.botanical_name}</em></p><p>Explore this plant’s origins, history, abilities and water strategy in its botanical dossier.</p><a class="button" href="${p.dossier}?demo=1">Open full dossier →</a></section>`;
  const tabs = [...host.querySelectorAll('[role="tab"]')];
  const selectTab = button => {
    tabs.forEach(tab => { tab.setAttribute('aria-selected', String(tab === button)); tab.tabIndex = tab === button ? 0 : -1; });
    host.querySelectorAll('.demo-panel').forEach(panel => { panel.hidden = panel.id !== 'panel-' + button.dataset.panel; });
  };
  tabs.forEach((button, index) => {
    button.addEventListener('click', () => selectTab(button));
    button.addEventListener('keydown', event => {
      let next;
      if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
      if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = tabs.length - 1;
      if (next !== undefined) { event.preventDefault(); selectTab(tabs[next]); tabs[next].focus(); }
    });
  });
  host.querySelectorAll('[data-days]').forEach(button => button.addEventListener('click', () => {
    host.querySelector('#demo-history').innerHTML = chart(p, Number(button.dataset.days));
    host.querySelectorAll('[data-days]').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
  }));
}
if (view === 'detail') renderDetail(chosen);
else if (view === 'plants') renderPlants();
else renderHome();
