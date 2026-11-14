// This flag changes public navigation only; it never grants access to user data.
(() => {
  if (new URLSearchParams(location.search).get('demo') !== '1') return;
  if (location.pathname.endsWith('/herbarium.html')) {
    const title=document.querySelector('#herbarium-featured-title');
    if(title)title.textContent='Sample plants';
    const collection = document.querySelector('.dossier-card.featured')?.parentElement;
    if (collection) collection.innerHTML = [
      ['demo-a','Pot A'],['demo-b','Pot B']
    ].map(([id,name]) => `<a class="dossier-card" href="plant.html?demo=watering&collection=${id}"><div class="dossier-image"><img src="assets/plants/valencia-orange-seedling.png" alt=""></div><div class="dossier-copy"><span class="status learning">Sample plant</span><h3>${name}</h3><p><em>Citrus × sinensis</em></p></div></a>`).join('');
  }
  for (const link of document.querySelectorAll('a[href]')) {
    const url = new URL(link.href, location.href);
    if (url.origin !== location.origin) continue;
    const page = url.pathname.split('/').pop();
    if (page === 'app.html') link.href = 'app.html?demo=collection' + url.hash;
    else if (page === 'plants.html') link.href = 'app.html?demo=collection';
    else if (page === 'plant.html'&&!url.searchParams.has('demo')) link.href = 'app.html?demo=collection';
    else if (page.startsWith('herbarium') && page.endsWith('.html')) {
      url.searchParams.set('demo', '1');
      link.href = url.href;
    }
  }
  const banner = document.createElement('aside');
  banner.className = 'demo-banner';
  banner.setAttribute('aria-label', 'Guest demo');
  banner.innerHTML = '<strong>Guest demo</strong><span>You’re exploring sample collections and plant dossiers.</span><a href="app.html?demo=collection">Back to demo →</a>';
  document.querySelector('.app-header')?.after(banner);
  for (const button of document.querySelectorAll('.profile-button')) {
    button.textContent = 'G';
    button.setAttribute('aria-label', 'Leave demo and sign in');
    button.addEventListener('click', () => { location.href = 'account.html'; });
  }
})();
