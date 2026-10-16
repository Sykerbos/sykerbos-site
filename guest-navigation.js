// This flag changes public navigation only; it never grants access to user data.
(() => {
  if (new URLSearchParams(location.search).get('demo') !== '1') return;
  if (location.pathname.endsWith('/herbarium.html')) {
    const count = document.querySelector('.collection-summary article strong');
    if (count) count.textContent = '3';
    const collection = document.querySelector('.dossier-card.featured')?.parentElement;
    if (collection) collection.innerHTML = [
      ['basil', 'Kitchen Basil', 'Ocimum basilicum', 'basil'],
      ['orange', 'Orange Seedling', 'Citrus × sinensis', 'valencia-orange-seedling'],
      ['rosemary', 'Windowsill Rosemary', 'Salvia rosmarinus', 'rosemary']
    ].map(([id, name, botanical, image]) => `<a class="dossier-card" href="herbarium-${id}.html?demo=1"><div class="dossier-image"><img src="assets/plants/${image}.png" alt="${name}"></div><div class="dossier-copy"><span class="status learning">Sample plant</span><h3>${name}</h3><p><em>${botanical}</em></p></div></a>`).join('');
  }
  for (const link of document.querySelectorAll('a[href]')) {
    const url = new URL(link.href, location.href);
    if (url.origin !== location.origin) continue;
    const page = url.pathname.split('/').pop();
    if (page === 'app.html') link.href = 'demo.html' + url.hash;
    else if (page === 'plants.html' || page === 'plant.html') link.href = 'demo.html?view=plants';
    else if (page.startsWith('herbarium') && page.endsWith('.html')) {
      url.searchParams.set('demo', '1');
      link.href = url.href;
    }
  }
  const banner = document.createElement('aside');
  banner.className = 'demo-banner';
  banner.setAttribute('aria-label', 'Guest demo');
  banner.innerHTML = '<strong>Guest demo</strong><span>You’re exploring sample collections and plant dossiers.</span><a href="demo.html">Back to demo →</a>';
  document.querySelector('.app-header')?.after(banner);
  for (const button of document.querySelectorAll('.profile-button')) {
    button.textContent = 'G';
    button.setAttribute('aria-label', 'Leave demo and sign in');
    button.addEventListener('click', () => { location.href = 'account.html'; });
  }
})();
