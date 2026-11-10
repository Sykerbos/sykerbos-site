const fieldGuide=[
  {
    theme:'drought',name:'Drought',tag:'Dry roots · closed leaf pores',image:'assets/herbarium/drought.webp',
    organ:'Leaves & stomata',
    mechanism:'As the pot dries, the roots have a harder time drawing water from the mix. The plant can close its stomata, the tiny pores in its leaves, to slow water loss.',
    signal:'The weight curve may flatten as the pot dries. Check the pot and the leaves together: weight loss includes evaporation, so a flatter curve alone doesn’t tell you the roots have run out of water.',
    milestone:'Drought Recovery',
    recovery:'After a very dry cycle, the pot was watered, its usual dry-down returned, and the leaves looked healthy.'
  },
  {
    theme:'monsoon',name:'Monsoon',tag:'Saturated mix · low root oxygen',image:'assets/herbarium/monsoon.webp',
    organ:'Roots & oxygen',
    mechanism:'If the mix stays saturated, water fills spaces that normally hold air. Roots need oxygen to function, so a plant can wilt even while the pot is still heavy.',
    signal:'Watch whether the pot drains and begins to get lighter again. A heavy pot with drooping leaves is a reason to check drainage before adding more water.',
    milestone:'Flood Recovery',
    recovery:'After an accidental repeat soaking, the pot drained, its usual dry-down returned, and the leaves looked healthy.'
  }
];

for(const section of document.querySelectorAll('[data-plant-physiology]')){
  section.innerHTML=`
    <header class="physiology-heading">
      <p>Herbarium · Field guide</p>
      <h2>Plant physiology</h2>
      <span>Two extremes. Two very different things happening inside the plant.</span>
    </header>
    <div class="physiology-grid">
      ${fieldGuide.map(card=>`<details class="physiology-entry ${card.theme}">
        <summary class="environment-card">
          <img src="${card.image}" alt="" loading="lazy" decoding="async">
          <span class="environment-etch" aria-hidden="true"></span>
          <span class="environment-head"><span class="environment-mark" aria-hidden="true">◈</span><span>Environmental card</span></span>
          <span class="environment-title"><strong>${card.name}</strong><span>${card.tag}</span></span>
          <span class="environment-foot"><span>Inside the plant</span><span class="environment-arrow" aria-hidden="true">+</span></span>
        </summary>
        <div class="physiology-copy">
          <h3>${card.organ}</h3><p>${card.mechanism}</p>
          <h4>What VyTile can see</h4><p>${card.signal}</p>
          <div class="physiology-milestone"><span>Recovery card preview</span><strong>${card.milestone}</strong><p>${card.recovery}</p></div>
        </div>
      </details>`).join('')}
    </div>
    <p class="physiology-source">Further reading: <a href="https://www.pubs.ext.vt.edu/content/pubs_ext_vt_edu/en/SPES/spes-749.html">Virginia Tech Extension · Water stress in container plants</a></p>`;
}
