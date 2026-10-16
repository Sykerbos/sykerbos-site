// This flag changes public navigation only; it never grants access to user data.
(() => {
  if (new URLSearchParams(location.search).get('demo') !== '1') return;
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
