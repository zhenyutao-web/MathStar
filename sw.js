const CACHE_NAME = 'mathstar-v3';
const FILES = [
  './MathStar.html',
  './manifest.json',
  './mathstar-sheet-sync.js'
];
const SYNC_SCRIPT_TAG = '<script src="./mathstar-sheet-sync.js" defer></script>';

// Cache app shell on install.
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(FILES))
  );
  self.skipWaiting();
});

// Delete old caches on activate.
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (isMathStarHtmlRequest(event.request)) {
    event.respondWith(serveMathStarHtml(event.request));
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request))
  );
});

function isMathStarHtmlRequest(request) {
  if (request.method !== 'GET') return false;

  const url = new URL(request.url);
  return (
    request.mode === 'navigate' ||
    url.pathname.endsWith('/MathStar.html')
  );
}

async function serveMathStarHtml(request) {
  const cache = await caches.open(CACHE_NAME);
  let response = null;

  try {
    response = await fetch(request);
    cache.put(request, response.clone());
  } catch (error) {
    response =
      (await caches.match(request)) ||
      (await cache.match('./MathStar.html'));
  }

  if (!response) {
    return fetch(request);
  }

  const html = await response.text();
  if (
    html.includes('mathstar-sheet-sync.js') ||
    html.includes('window.MathStarSheetSync')
  ) {
    return responseFromHtml(html, response);
  }

  return responseFromHtml(injectSyncScript(html), response);
}

function injectSyncScript(html) {
  if (html.includes('</body>')) {
    return html.replace('</body>', `    ${SYNC_SCRIPT_TAG}\n  </body>`);
  }

  return `${html}\n${SYNC_SCRIPT_TAG}`;
}

function responseFromHtml(html, originalResponse) {
  const headers = new Headers(originalResponse.headers);
  headers.set('Content-Type', 'text/html; charset=utf-8');

  return new Response(html, {
    status: originalResponse.status,
    statusText: originalResponse.statusText,
    headers
  });
}
