/*
 * Service worker de l'origine que l'application a quittée.
 *
 * Servi à la place du service worker de l'application, et **uniquement** sur le
 * nom de domaine de la vitrine (voir la sélection par en-tête Host côté
 * serveur, `VITRINE_HOST`).
 *
 * Le problème qu'il règle : un appareil qui utilisait l'application sur cet
 * ancien nom garde un service worker Workbox qui sert la coquille depuis son
 * précache. Il vérifie ses mises à jour en rechargeant `/sw.js` — et la
 * spécification exige que cette requête ne soit pas redirigée. Rediriger
 * `/sw.js` vers la nouvelle adresse fait donc échouer la mise à jour : l'ancien
 * service worker reste en place indéfiniment, sert l'ancien lot, et aucun code
 * neuf ne peut plus atteindre l'appareil.
 *
 * Ce fichier est la réponse à cette requête : same-origin, 200, donc la mise à
 * jour aboutit et ce service worker remplace l'ancien.
 *
 * Il ne se contente pas de se désenregistrer, parce qu'un club sans réseau au
 * boulodrome se retrouverait alors sans rien. Il change seulement l'ordre des
 * priorités :
 *
 * - **avec réseau**, le réseau décide : la navigation aboutit sur la page
 *   vitrine, dont le bandeau explique le déménagement ;
 * - **sans réseau**, on retombe sur ce qui est déjà en cache — l'application
 *   telle qu'elle était s'ouvre encore ;
 * - `?ancienne=1` rouvre délibérément l'ancienne version même avec du réseau,
 *   pour exporter des concours restés sur cette origine (mode invité).
 */

const ECHAPPATOIRE = 'ancienne';

/** Fichiers au nom haché : leur contenu ne change jamais. */
const IMMUABLE = /^\/assets\//;

/** Les mêmes options partout : Workbox range ses entrées avec une révision en
    paramètre, et les réponses du serveur portent un `Vary` qui ne nous concerne
    pas ici. */
const APPARIEMENT = { ignoreSearch: true, ignoreVary: true };

/* Les notifications de convocation restent servies : ces appareils ont leur
   abonnement push sur cette origine, et le perdre en silence serait une
   régression. L'échec de l'import ne doit pas faire échouer l'installation —
   rouvrir le canal de mise à jour compte davantage. */
try {
  importScripts('/push-sw.js');
} catch (e) {
  // Notifications indisponibles sur cette origine : ce n'est pas bloquant.
}

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

/** La coquille de l'application, laissée par le précache de l'ancien worker. */
function coquilleEnCache() {
  return caches.match('/index.html', APPARIEMENT);
}

/**
 * Cache d'abord, pour les fichiers hachés.
 *
 * C'est la bonne stratégie sur ce genre de nom — le contenu ne change jamais —
 * et c'est aussi la seule fiable ici : la coquille servie hors ligne réclame
 * les fichiers de **son** build, que le serveur a effacés au rebuild suivant.
 * Passer par le réseau d'abord condamnerait la page à s'ouvrir vide.
 */
async function cachePuisReseau(request) {
  const enCache = await caches.match(request, APPARIEMENT);
  return enCache ?? fetch(request);
}

/**
 * Réseau d'abord, cache en secours.
 *
 * `ignoreSearch` est indispensable : Workbox range ses entrées avec un
 * paramètre de révision. Et une réponse 404 n'est pas une erreur de `fetch` —
 * les anciens fichiers hachés ayant disparu du serveur au rebuild, il faut
 * traiter le « pas trouvé » comme un échec pour retomber sur le cache.
 */
async function reseauPuisCache(request) {
  try {
    const reponse = await fetch(request);
    // Une redirection destinée au navigateur se rend telle quelle : c'est ainsi
    // que les anciens liens rejoignent la nouvelle adresse.
    if (reponse.ok || reponse.type === 'opaqueredirect' || reponse.type === 'opaque') {
      return reponse;
    }
    const enCache = await caches.match(request, APPARIEMENT);
    return enCache ?? reponse;
  } catch (e) {
    const enCache = await caches.match(request, APPARIEMENT);
    if (enCache) return enCache;
    if (request.mode === 'navigate') {
      const coquille = await coquilleEnCache();
      if (coquille) return coquille;
    }
    return Response.error();
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // L'API n'est jamais servie depuis un cache : une réponse périmée sur des
  // scores vaut moins qu'une erreur franche.
  if (url.pathname.startsWith('/api/')) return;

  // Fichiers hachés : le cache d'abord (voir cachePuisReseau).
  if (IMMUABLE.test(url.pathname)) {
    event.respondWith(cachePuisReseau(request));
    return;
  }

  if (request.mode === 'navigate' && url.searchParams.has(ECHAPPATOIRE)) {
    event.respondWith(coquilleEnCache().then((coquille) => coquille ?? fetch(request)));
    return;
  }

  event.respondWith(reseauPuisCache(request));
});
