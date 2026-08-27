<a name="readme-top"></a>

<!-- PROJECT SHIELDS -->
[![Contributors][contributors-shield]][contributors-url]
[![Stargazers][stars-shield]][stars-url]
[![Issues][issues-shield]][issues-url]
[![AGPL-3.0 License][license-shield]][license-url]
![Offline-first][offline-shield]

<!-- PROJECT HEADER -->
<br />
<div align="center">

<h3 align="center">🎯 Pétanque Concours</h3>

  <p align="center">
    Multi-club SaaS for running pétanque competitions — with a genuinely complete offline mode.
    Draws, scoring and brackets all work with no network at the boulodrome, and sync when it returns.
    <br />
    <a href="#features"><strong>See the features »</strong></a>
    <br />
    <br />
    <a href="./docs/DEPLOIEMENT.md">Deployment guide</a>
    ·
    <a href="https://github.com/GabinSMD/petanque/issues">Report bug</a>
    ·
    <a href="https://github.com/GabinSMD/petanque/issues">Request feature</a>
  </p>
</div>

> **Language note** — the application, its help content and its documentation are in French:
> it implements the FFPJP (French pétanque federation) rulebook for French clubs. This README is
> in English because the repository is public.

<!-- TABLE OF CONTENTS -->
<details>
  <summary>Table of Contents</summary>
  <ol>
    <li>
      <a href="#about-the-project">About The Project</a>
      <ul>
        <li><a href="#two-audiences-one-application">Two audiences, one application</a></li>
        <li><a href="#built-with">Built With</a></li>
      </ul>
    </li>
    <li><a href="#features">Features</a></li>
    <li>
      <a href="#architecture">Architecture</a>
      <ul>
        <li><a href="#sync-protocol">Sync protocol</a></li>
      </ul>
    </li>
    <li>
      <a href="#getting-started">Getting Started</a>
      <ul>
        <li><a href="#prerequisites">Prerequisites</a></li>
        <li><a href="#installation">Installation</a></li>
        <li><a href="#server-environment-variables">Server environment variables</a></li>
      </ul>
    </li>
    <li><a href="#deployment">Deployment</a></li>
    <li><a href="#a-typical-competition-day">A typical competition day</a></li>
    <li><a href="#shipping-a-user-visible-change">Shipping a user-visible change</a></li>
    <li><a href="#tests">Tests</a></li>
    <li><a href="#roadmap">Roadmap</a></li>
    <li><a href="#contributing">Contributing</a></li>
    <li><a href="#license">License</a></li>
    <li><a href="#contact">Contact</a></li>
    <li><a href="#acknowledgments">Acknowledgments</a></li>
  </ol>
</details>

<!-- ABOUT THE PROJECT -->
## About The Project

A web application for running pétanque competitions, inspired by
[FFPJP Gestion Concours](https://www.ffpjp-gestion-concours.com/) and rebuilt as a
**multi-club SaaS** with a **complete offline mode**: draws, score entry and brackets all work
with no connection at the boulodrome, and synchronise as soon as the network is back.

The design constraint that shapes everything: at a boulodrome there is often neither Wi-Fi nor a
shared account. So the tournament engine runs **in the browser**, the local database is the
primary one, and the server is only an authenticated replicator.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

### Two audiences, one application

A club running friendly competitions has no use for the licensee file, the club championship or
the paperwork handed to the committee. **Federal mode** (⚙ Settings) hides all of it; unchecked,
the application sticks to entries, the draw, pools, brackets, scores and prize money.

That toggle changes **display only**, never behaviour: a competition already declared official
keeps checking licences, and its screens stay visible on it. It turns itself on when an official
competition exists or a licensee file has been imported — an organiser is never hidden a feature
they actually use.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

### Built With

* [TypeScript](https://www.typescriptlang.org/) — including the tournament engine, framework-free
* [React](https://react.dev/) + [Vite](https://vite.dev/) — PWA client
* [Dexie](https://dexie.org/) / IndexedDB — the primary database, on the device
* [Workbox](https://developer.chrome.com/docs/workbox) via `vite-plugin-pwa` — service worker
* [Fastify](https://fastify.dev/) — API, on Node ≥ 22.5
* [`node:sqlite`](https://nodejs.org/api/sqlite.html) — Node's built-in SQLite, zero native dependency
* [Vitest](https://vitest.dev/) — the engine's test suite

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- FEATURES -->
## Features

<details>
  <summary><strong>Tournament management</strong> — formats, pools, brackets, scoring</summary>

* **Competitions** in singles, doubles or triples; games to 13 points (configurable, e.g. 11);
  number of lanes; time-limited games (with a stated duration).
* **Every format**:
  * **Pools then knockout** — the FFPJP classic;
  * **Straight knockout**, with an optional consolation bracket;
  * **Federal A-B-C formats** (FFPJP manual §3.D.8 to §3.D.12): losers cascade from one bracket
    to the next — consolation, complementary, and second-round losers of the main bracket feeding
    the consolation qualifier (or the complementary bracket, CD19 variant);
  * **A-B-C group format** (§3.D.5): groups of 4 with **no play-off**, decided on wins alone —
    2 wins go to competition A, 1 win to B (**both** teams), 0 to C. Nobody goes home after two games;
  * **Rotating mêlée**: individual entries, teams drawn afresh each round — uneven numbers handled
    the way they are on the field (a triple can meet a double, nobody sits out), individual standings;
  * **Swiss system**: random round 1, then pairing by standing with no rematch; the bye wins 13-7
    and never falls on the same team twice;
  * **Round-robin championship**: full schedule generated at once (circle method), a rest round when
    the field is odd.
* **Round standings**: wins, then goal difference, then points scored — updated live on every entry.
* **Finals after rounds** (§3.D.15): the standings turn into a knockout bracket inside the same
  competition, with no intermediate export. Both federal configurations are offered — 1/8 A + 1/8 B,
  or 1/4 A + 1/4 B + 1/4 C: each slice of the standings plays its own competition. Ties are broken
  on head-to-head, and what that does not settle can be swapped by hand.
* **Entries**: numbered teams, players with optional licence number, club, forfeits, locking after
  the draw — plus an **amendment mode** (§3.B.8) to replace or add a player after the draw without
  disturbing bib numbers or bracket positions.
* **FFPJP pools**: pools of 4 topped up with pools of 3 (7 → 1×4 + 1×3, 9 → 3×3…), automatic
  *game 1 / game 2 → winners / losers → play-off* progression, first place qualifying on 2 wins and
  second through the play-off, with an option to keep two teams from the same club out of one pool.
* **Final bracket**: generated when pools end — byes go to the top seeds, first plays a second from
  another pool in round 1, and the first and second of one pool land in opposite halves; automatic
  **qualifying round** when the field is not a power of two; official labels (round of 16, quarters,
  semi-finals, final).
* **Straight knockout** (no pools) with the same qualifying rules.
* **Consolation bracket**: pool eliminees, or first-round losers in straight knockout ("loser of
  game N" slots filled as results come in).
* **Score entry** with validation (13 points, no draws) and **cascading correction**: fixing an
  upstream game cleanly resets everything that depended on it.
* **Lanes** assigned automatically for opening games, editable game by game.
* **Final standings**: winner, runner-up, semi-finalists, eliminees by round, pool outcome, consolation.
* **Public display** (TV / projector): dedicated read-only page, large type, live updates.
* **Printing**: pool sheets, brackets and results through the browser's print layout.

</details>

<details>
  <summary><strong>Running a day</strong> — categories, multi-site, archiving, lane map</summary>

* **Categories & day view**: a category per competition — derived from the federal criteria when
  they exist ("Féminin Vétérans Promotion"), free text otherwise — with a dashboard grouped by date
  and filtered by category, which matters when a club runs several competitions the same day.
* **Multi-site split** (§3.B.10.D): a competition too big for one boulodrome splits into one
  competition per site. Field sizes follow each site's lanes, teams from one club stay together,
  bib numbers are kept, and the original competition is archived as a record.
* **Archiving** (§3.F.3): a filed competition leaves the current list and the honours board without
  losing anything, and comes back in one click. The honours board always states how many archived
  competitions it is leaving out — a winner never disappears silently.
* **Entry list import** (§3.B.10.B): reuse another competition's list as CSV — the application's own
  "📋 Engagés" export re-imports as-is, bib numbers, licences, clubs, forfeits and payments included.
  One column per player is accepted too, for a hand-made spreadsheet. In an empty competition the
  file's bib numbers are kept; otherwise teams are appended.
* **Online pre-registration**: teams enter themselves through the public link ("✍️ Je m'inscris");
  the organiser validates in one click at the scoring table.
* **Pool statistics** (§3.D.1.G): a summary of what is *not* finished, the longest-waiting pool
  first, and the play-offs holding their pool up. Across thirty pools, that is what finds the
  laggard without walking the whole list.
* **Lane map**: free/busy board live, automatic assignment of waiting games to free lanes, released
  on score entry.
* **Seeds**: at the draw, mark the strongest teams so they land in different pools or bracket halves.

</details>

<details>
  <summary><strong>Club championship</strong> (federal mode) — squad checks, match sheet, signatures</summary>

* **Squad compliance** (§3.E): all five club competitions come with their preset filter — Coupe de
  France, CNC/CRC/CDC Open, Women's, Youth, Veterans — including the quotas for transferred and
  non-EU players. An unreadable nationality excludes nobody.
* **Match sheet**: the sheet filled in by hand today — both squads, order of games, scores and
  signatures. Points are not typed in: they follow from the winner and the game type (singles,
  doubles, triples), and the application checks the invariant the sheet itself prints at the top —
  **the two totals always add up to a known number** (36 on the CD26 sheet). A wrong sheet shows up
  before it is signed. The scale is data: it varies from one committee to the next.
* **Squad exchange between the two clubs**: the visiting club shows a QR code, the host scans it, and
  the eight lines of the opposing squad fill in with licence numbers — instead of being copied by hand
  when the other club already typed and checked them at home. Nothing goes through the network or a
  shared account: at the boulodrome there is usually neither. The code is readable text, so it can be
  typed if a camera fails.
* **One synchronised sheet per fixture**: sheets are replicated entities, not a per-device draft. They
  show up on the club's other tablets, survive the loss of one of them, and persist from one fixture
  to the next.
* **Captains sign in the application**: each signs with a finger on the tablet. Signing **locks the
  sheet** — nothing can be edited any more — and a **fingerprint of the signed content** is printed
  next to the signatures. If the sheet is altered afterwards, the fingerprint no longer matches the
  signed copy, and the application says so. Correcting requires explicitly clearing the signatures,
  never silently. A sheet in an inconsistent state cannot be signed at all.
* **File backup**: a sheet exports as a self-contained JSON, signatures included, and re-imports —
  to archive it, send it on, or pick it up on a device without the club's account. It always lands
  **beside** existing ones, never on top, and the fingerprint of the signed content stays verifiable
  after the round trip. Both importers — competition and match sheet — recognise the other's file and
  say so.
* **Return to the committee**: a pre-filled email (subject, result, remarks) to attach the signed
  sheet to — or an upload to the committee's site. The signature is what counts.

</details>

<details>
  <summary><strong>Onboarding</strong> — guided creation, tutorial, in-app assistant</summary>

* **Three-step guided creation**: format cards in plain language ("the classic for official
  competitions", "ideal for clubs & friends — every player for themselves"…), an illustrated pick of
  the team formation, then a suggested name.
* **Built-in tutorial**: welcome screen on first use, an interactive tour that highlights parts of the
  interface, and a **pre-filled example competition** to practise on with nothing at stake.
* **"Next step" banner**: every competition permanently states where you are and what comes next
  (entries → draw → scores → bracket → close).
* **In-app assistant** 💬: about twenty step-by-step guides (draw the pools, fix a score, consolation,
  forfeit, TV display, offline…), keyword search tolerant of accents — entirely **offline**, no
  external service.
* **It assists instead of cataloguing**: after answering, the assistant offers **your competition's
  next step** ("pools are done, on to the bracket"), inferred from the actual data — never "related
  topics". Question unclear? It asks for a clarification anchored in the screen you are on rather
  than unrolling the table of contents. It re-orients itself on opening ("you are on *Concours du
  12/07*: 3 games left to enter"), and the index only comes back when explicitly asked for.
* **Interactive walkthroughs**: "🎓 Me guider pas à pas" does not narrate, it makes you do. The
  assistant highlights the element, then **waits for the gesture** — a click on the target, or a fact
  observed in the data (the pools exist, the play-off is entered). A target that only appears after an
  action is waited for, not skipped; steps already done are passed over, so a walkthrough **resumes
  where you are**; and if you wander off, it says so and offers to resume instead of highlighting
  nothing.
* **Version in the footer** (number, commit, build date, injected at build time): so you know what the
  tablet is actually running.
* **"What's new" popup** after an update: the application replaces itself silently (auto-updating PWA),
  and the popup walks through what it gained, with a button to go and look. Skipped versions are merged
  into a single window; the tour can be reopened from the footer or the assistant ("Quoi de neuf ?").

</details>

<details>
  <summary><strong>Sharing & self-refereeing</strong> — public link, push, score declarations</summary>

* **Public link** per competition (revocable, with a **QR code** to display at the boulodrome) with
  **two paths**: *"Je joue"* (enter your team number and see only your game, your declaration, your
  notifications) and *"Je consulte"* (full live display) — no account either way.
* **Push notifications**: a team subscribes with its number and gets an alert on its phone at every
  call-up (play-off, next round…), even with the app closed. The scoring table does nothing:
  call-ups are detected client-side and relayed by the server (Web Push / VAPID, deduplicated per game).
* **Self-declared scores**: one team declares, the opponent confirms from their own phone; the scoring
  table sees the **matching** declarations and applies them in one click — it stays the sole decider.
* **Licensees**: CSV import (Surname/First name/Licence/Club), autocompletion on entry, updates
  without duplicates.
* **Printable sheets**: official pool sheets and game tickets to hand out.
* **Multiple organisers**: invitation codes (7 days) to join the club, member list.
* **Precision shooting**: series of 20 boules (100 points max), ranked on best series.
  **Prize money**: suggested split of the pot by ranking group.

</details>

<details>
  <summary><strong>SaaS & offline</strong> — landing page, tenants, local-first, sync</summary>

* **Landing page**: a visitor with no session is met by a presentation — what the software does, the
  offline mode, how a day unfolds, real screenshots — not by a login form. It can live on its own
  domain (`petanque.exemple.fr` for the landing page, `app.petanque.exemple.fr` for the application):
  both names reach the same server, which picks the document from the `Host` header. See
  [DEPLOIEMENT.md](./docs/DEPLOIEMENT.md).
* **Club accounts (multi-tenant)**: each organisation has its own competitions, users and audit log.
* **Guest mode**: try everything **without creating an account** — data stays on the device; when an
  account is created, the application offers to **attach the guest competitions** (which are then
  pushed to the server).
* **Persistent storage**: `navigator.storage.persist()` is requested at startup so the browser cannot
  evict local data.
* **Local-first / PWA**: the UI reads and writes IndexedDB first; the service worker caches the
  application — reload the page with no network and everything is there. Installable on phone or tablet.
* **Synchronisation**: local changes pushed, other devices' changes pulled (per-organisation oplog
  cursor, timestamped last-writer-wins, tie-broken by device, idempotent — replayable with no side effect).
* **Multi-device**: the same account on the scoring table's computer and the tablet on the field sees
  the same data.

</details>

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- ARCHITECTURE -->
## Architecture

```
petanque/
├── shared/   Pure TypeScript tournament engine (pools, play-offs, qualifying rounds,
│             brackets, consolation, standings) + types + Vitest tests.
│             It runs CLIENT-SIDE: this is what makes offline mode possible.
├── client/   React + Vite PWA. IndexedDB (Dexie) as the primary store, sync engine
│             (outbox + cursor), react-router, Workbox service worker (vite-plugin-pwa).
└── server/   Fastify API (Node ≥ 22.5, native node:sqlite, zero native dependency).
              JWT auth, multi-tenant, /api/sync endpoint (replication), serves the built client.
```

The server knows **no pétanque rules whatsoever**: it is an authenticated replicator. All the sporting
logic lives in `shared/` and executes in the browser — which is exactly what allows total offline use.

### Sync protocol

The client only acknowledges what the server has **accepted**: a rejected entity stays pending and
visible in the counter, rather than being believed synced while it exists nowhere. The two decisions
that govern replication — "does this change supersede local state?" and "is this push acknowledged?" —
live in `shared/src/engine/replication.ts`, where they are tested.

```
POST /api/sync  { cursor, deviceId, changes: [{type, id, data, updatedAt, deleted}] }
             →  { cursor, hasMore, accepted, changes: [...] }
```

* Each organisation owns a monotonic sequence (oplog). The client sends its dirty entities and its
  cursor; the server applies last-writer-wins (`updatedAt`, tie-broken on `deviceId`), assigns a
  sequence number and returns everything changed since the cursor.
* A rejected push (a newer server version) immediately returns the winning version: the sending device
  converges without waiting.
* Deletions are synchronised tombstones.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- GETTING STARTED -->
## Getting Started

### Prerequisites

* **Node.js ≥ 22.5** — for the built-in SQLite module
  ```sh
  node --version
  ```

### Installation

1. Clone the repository
   ```sh
   git clone https://github.com/GabinSMD/petanque.git
   cd petanque
   ```
2. Install the workspaces
   ```sh
   npm install
   ```
3. Run in development — API on `:8787`, Vite on `:5173` with an `/api` proxy
   ```sh
   npm run dev
   ```

```sh
npm test          # tournament engine test suite
npm run typecheck # TypeScript across all workspaces
npm run build     # build shared, then client, then server
npm start         # serve everything on :8787
```

### Server environment variables

| Variable | Default | Role |
| --- | --- | --- |
| `PORT` | `8787` | HTTP port |
| `DATA_DIR` | `server/data` | SQLite directory and JWT secret |
| `DB_PATH` | `$DATA_DIR/petanque.sqlite` | Database file |
| `JWT_SECRET` | generated and persisted | Token signing secret |

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- DEPLOYMENT -->
## Deployment

Three paths are kept in the repository, all documented in
[docs/DEPLOIEMENT.md](./docs/DEPLOIEMENT.md):

| Target | Files |
| --- | --- |
| **Docker** anywhere | `Dockerfile`, `docker-compose.yml` |
| **Fly.io** | `fly.toml` (region `cdg`, a 1 GB volume for the data) |
| **Render** | `render.yaml` (`/api/health` health check, generated `JWT_SECRET`) |
| **Oracle Cloud free tier** | `deploy/` — `setup-oracle.sh`, `Caddyfile`, `petanque.service`, `update.sh`, plus [docs/DEPLOIEMENT-ORACLE.md](./docs/DEPLOIEMENT-ORACLE.md) |

```sh
docker build -t petanque-concours .
docker run -p 8787:8787 -v petanque-data:/app/server/data petanque-concours
```

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- USAGE -->
## A typical competition day

1. The day before, at the club: create the competition, enter the teams.
2. At the boulodrome, usually with no network: open the application — it loads from cache — draw the
   pools, print, enter scores, generate the bracket, run the consolation… all of it works offline.
3. The display screen (TV) shows pools and brackets live.
4. As soon as the network is back (or through a phone hotspot), everything syncs and the club's second
   device sees the results.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- SHIPPING -->
## Shipping a user-visible change

Delivering something a user will notice takes two gestures:

1. add a bullet to `client/src/help/nouveautes.ts`, under the current version (or a new version entry);
2. bump `version` in the root `package.json`.

It is the **changelog** that triggers the popup, not `package.json`: forgetting the bump does not
silence detection, it only makes the footer label lie. The version shown is always the highest the
changelog publishes, and the order of the array does not matter (`recapNouveautes` sorts it).

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- TESTS -->
## Tests

* `shared/` — 86 Vitest spec files, around 990 cases, covering pool distribution, the 4/3 progression
  with play-off, cascading corrections, qualifying rounds and byes, first/second pairing, the
  consolation bracket fed by losers, and the standings.
  ```sh
  npm test
  ```
* An end-to-end Playwright run has validated the whole path — club sign-up → guided tour → assistant
  (step-by-step answer) → competition → 7 teams → pools → bracket → consolation → winner → server sync
  → **reloading the application offline**. It was a one-off validation: there is no Playwright config
  in the repository, so it is not part of `npm test`.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- ROADMAP -->
## Roadmap

- [ ] Multi-user invitations within a club, roles (scoring table / read-only)
- [ ] Licensee file import (CSV / Geslico), lookup by licence number, barcode scanner
- [ ] "Complementary" competition, time-limited games, precision shooting
- [ ] Prize money / stake splitting, PDF export of game sheets
- [ ] Public results page (shareable link, no account)
- [ ] SaaS hardening: rate limiting, Postgres, backups, GDPR

See the [open issues](https://github.com/GabinSMD/petanque/issues) for the full list.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- CONTRIBUTING -->
## Contributing

Contributions are welcome, particularly from people who actually run competitions: a rule modelled
wrongly is worth more as a bug report than as a pull request.

1. Fork the project
2. Create your branch (`git checkout -b feature/formule-cd19`)
3. Add tests in `shared/` — the engine is where correctness is proven
4. Check `npm test` and `npm run typecheck` pass
5. Commit, push, and open a pull request

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- LICENSE -->
## License

Distributed under the GNU Affero General Public License v3.0. If you run a modified version as a
network service, its source must be available to its users. See `LICENSE` for the full text.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- CONTACT -->
## Contact

Gabin Simond — gabin.simond@simondancebros.org

Project link: [https://github.com/GabinSMD/petanque](https://github.com/GabinSMD/petanque)

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- ACKNOWLEDGMENTS -->
## Acknowledgments

* The **FFPJP rulebook** — every §3.x reference above points to it
* [FFPJP Gestion Concours](https://www.ffpjp-gestion-concours.com/) — the software this one learns from
* [Dexie](https://dexie.org/) and [Workbox](https://developer.chrome.com/docs/workbox) — what makes offline plausible
* [Best-README-Template](https://github.com/othneildrew/Best-README-Template) — the shape of this file

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- MARKDOWN LINKS & IMAGES -->
[contributors-shield]: https://img.shields.io/github/contributors/GabinSMD/petanque.svg?style=for-the-badge
[contributors-url]: https://github.com/GabinSMD/petanque/graphs/contributors
[stars-shield]: https://img.shields.io/github/stars/GabinSMD/petanque.svg?style=for-the-badge
[stars-url]: https://github.com/GabinSMD/petanque/stargazers
[issues-shield]: https://img.shields.io/github/issues/GabinSMD/petanque.svg?style=for-the-badge
[issues-url]: https://github.com/GabinSMD/petanque/issues
[license-shield]: https://img.shields.io/badge/license-AGPL%20v3-blue.svg?style=for-the-badge
[license-url]: https://github.com/GabinSMD/petanque/blob/main/LICENSE
[offline-shield]: https://img.shields.io/badge/PWA-offline--first-5A0FC8?style=for-the-badge
