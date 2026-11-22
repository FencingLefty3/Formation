
const CACHE_NAME = 'formation-cache-v4';

const APP_SHELL = [
    './',
    './index.html',
    './map.html',
    './style.css',
    './manifest.json',
    './index.js',
    './weather.js',
    './map.js',

    // Branding
    './formationLogo.png',
    './formationLogoWhite.png',
    './180.png',
    './256.png',

    // Icons
    './icons/square-pen.png',
    './icons/arrow-up.svg',
    './icons/trash.svg',
    './icons/square-pen.svg',
    './icons/search.svg',
    './icons/funnel.svg',
    './icons/database-arrow-down.svg',
    './icons/tags/all.svg',
    './icons/tags/info.svg',
    './icons/tags/star.svg',
    './icons/tags/tally-2.svg',
    './icons/tags/tally-3.svg',
    './icons/tags/tally-4.svg',
    './icons/circle-user-round.svg'
];

self.addEventListener('install', event => {
    console.log('Formation: Installing service worker.');

    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(APP_SHELL))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', event => {
    console.log('Formation: Activating service worker.');

    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(
                keys
                    .filter(key =>
                        key.startsWith('formation-cache-') &&
                        key !== CACHE_NAME
                    )
                    .map(key => caches.delete(key))
            ))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    const request = event.request;
    const url = new URL(request.url);

    if (
        request.method !== 'GET' ||
        url.origin !== self.location.origin
    ) {
        return;
    }

    event.respondWith(
        caches.match(request).then(cachedResponse => {
            if (cachedResponse) {
                return cachedResponse;
            }

            return fetch(request)
                .then(response => {
                    if (response && response.ok) {
                        const responseClone = response.clone();

                        event.waitUntil(
                            caches.open(CACHE_NAME)
                                .then(cache =>
                                    cache.put(request, responseClone)
                                )
                        );
                    }

                    return response;
                })
                .catch(() => {
                    if (request.mode === 'navigate') {
                        return caches.match('./index.html');
                    }

                    return new Response('Offline', {
                        status: 503,
                        statusText: 'Service Unavailable'
                    });
                });
        })
    );
});
