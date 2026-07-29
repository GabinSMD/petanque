import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Licencie, Player } from '@shared';
import {
  BAREME_CDC,
  COMPETITIONS_CLUB,
  categorieAgeDe,
  controlerEquipe,
  criteresCompetition,
  estHorsUE,
  parseLicenceQr,
  bilanRencontre,
  partiesVides,
  pointsEnJeu,
  type ChampLicence,
  type CompetitionClubId,
  type PartieRencontre,
} from '@shared';
import { useLicencies } from '../db/hooks';
import {
  FeuilleMatchVerso,
  type JoueurFeuille,
  type Remplacements,
} from '../components/FeuilleMatchVerso';
import {
  ANOMALIE_EQUIPE_LABELS,
  ANOMALIE_LABELS,
  CATEGORIE_AGE_LABELS,
  formatDateFr,
} from '../lib/labels';

/** Mémoire locale : une composition n'est pas un concours, elle ne se synchronise pas. */
const CLE_MEMOIRE = 'petanque-championnat-clubs';

interface Etat {
  competition: CompetitionClubId;
  maxMutes: number;
  date: string;
  club: string;
  adversaire: string;
  licences: string[];
  /* Champs de la feuille de match (recto). */
  division: string;
  poule: string;
  numeroClub: string;
  numeroClubAdverse: string;
  /** Capitaine ou coach qui ne joue pas : la feuille lui réserve deux cases. */
  capitaineNom: string;
  capitaineLicence: string;
  /** Composition adverse : saisie à la main, ses licences ne sont pas dans notre fichier. */
  adversaireJoueurs: JoueurFeuille[];
  /* Verso : ordre des rencontres et résultats. */
  heureDebut: string;
  heureFin: string;
  parties: PartieRencontre[];
  places: { a: string[]; b: string[] }[];
  remplacements: Remplacements;
  remarques: string;
  courrielComite: string;
}

/** Places vides pour chaque partie, selon la formation. */
function placesVides(): { a: string[]; b: string[] }[] {
  const taille: Record<string, number> = { tete_a_tete: 1, doublette: 2, triplette: 3 };
  return partiesVides(BAREME_CDC).map((p) => ({
    a: Array<string>(taille[p.type] ?? 1).fill(''),
    b: Array<string>(taille[p.type] ?? 1).fill(''),
  }));
}

function lireMemoire(): Etat {
  const parDefaut: Etat = {
    competition: 'cnc_open',
    maxMutes: 1,
    date: new Date().toISOString().slice(0, 10),
    club: '',
    adversaire: '',
    licences: [],
    division: '',
    poule: '',
    numeroClub: '',
    numeroClubAdverse: '',
    capitaineNom: '',
    capitaineLicence: '',
    adversaireJoueurs: Array.from({ length: 8 }, () => ({ nom: '', licence: '' })),
    heureDebut: '',
    heureFin: '',
    parties: partiesVides(BAREME_CDC),
    places: placesVides(),
    remplacements: { a: {}, b: {} },
    remarques: '',
    courrielComite: '',
  };
  try {
    const brut = localStorage.getItem(CLE_MEMOIRE);
    const lu = brut ? { ...parDefaut, ...(JSON.parse(brut) as Partial<Etat>) } : parDefaut;
    // Le barème a pu changer depuis la dernière feuille : on repart de zéro
    // plutôt que d'afficher des parties qui ne correspondent plus.
    if (lu.parties.length !== parDefaut.parties.length) {
      return { ...lu, parties: parDefaut.parties, places: parDefaut.places };
    }
    if (lu.places.length !== parDefaut.places.length) {
      return { ...lu, places: parDefaut.places };
    }
    return lu;
  } catch {
    return parDefaut;
  }
}

/**
 * Championnat des clubs et Coupe de France (manuel §3.E).
 *
 * On compose une équipe, licence par licence, et l'application dit si elle est
 * réglementaire : licences à jour, catégorie, sexe, homogénéité de club,
 * contingent de mutés et de joueurs hors Union européenne. Puis on imprime la
 * feuille de rencontre.
 *
 * Ce module ne fait pas jouer la compétition — le logiciel fédéral non plus.
 */
export function ChampionnatClubsPage() {
  const licencies = useLicencies() ?? [];
  const parLicence = useMemo(
    () => new Map(licencies.filter((l) => l.licence).map((l) => [l.licence!, l])),
    [licencies],
  );

  const [etat, setEtat] = useState<Etat>(lireMemoire);
  const [saisie, setSaisie] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const champ = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem(CLE_MEMOIRE, JSON.stringify(etat));
    } catch {
      /* stockage indisponible : on continue sans mémoriser */
    }
  }, [etat]);

  const maj = (patch: Partial<Etat>): void => setEtat((prev) => ({ ...prev, ...patch }));

  const joueurs: Player[] = etat.licences.map((licence) => ({
    name: parLicence.get(licence)?.name ?? '',
    licence,
    club: parLicence.get(licence)?.club,
  }));

  const criteres = criteresCompetition(
    etat.competition,
    Number(etat.date.slice(0, 4)) || new Date().getFullYear(),
    etat.maxMutes,
    etat.date,
  );
  const controle = controlerEquipe(joueurs, parLicence, criteres);
  const competition = COMPETITIONS_CLUB.find((c) => c.id === etat.competition)!;

  /**
   * Courriel préparé pour le comité : objet et corps remplis, la feuille signée
   * restant à joindre. On ne peut pas joindre un fichier depuis un lien
   * `mailto:` — et de toute façon c'est la signature qui fait foi, donc le
   * message part de la messagerie de l'organisateur, sous ses yeux.
   */
  const bilanFeuille = bilanRencontre(BAREME_CDC, etat.parties);
  const objetCourriel = [
    `Feuille de match ${competition.label}`,
    etat.division && `division ${etat.division}`,
    etat.poule && `poule ${etat.poule}`,
    formatDateFr(etat.date),
  ]
    .filter(Boolean)
    .join(' — ');
  const corpsCourriel = [
    `${etat.club || 'Notre club'} contre ${etat.adversaire || 'l\'adversaire'}`,
    `${formatDateFr(etat.date)}${etat.heureDebut ? ` — début ${etat.heureDebut}` : ''}`,
    '',
    `Résultat : ${bilanFeuille.totalA} - ${bilanFeuille.totalB}` +
      (bilanFeuille.complete
        ? ` (${pointsEnJeu(BAREME_CDC)} points en jeu)`
        : ' — feuille incomplète'),
    ...(etat.remarques.trim() ? ['', `Remarques : ${etat.remarques.trim()}`] : []),
    '',
    'Feuille signée en pièce jointe.',
  ].join('\n');
  const lienCourriel = `mailto:${encodeURIComponent(etat.courrielComite.trim())}?subject=${encodeURIComponent(objetCourriel)}&body=${encodeURIComponent(corpsCourriel)}`;

  /** Ajoute un joueur par son numéro de licence (scan, douchette ou saisie). */
  const ajouter = (contenu: string): void => {
    const decode = parseLicenceQr(contenu);
    if (!decode?.licence) {
      setMessage(`Contenu non reconnu : « ${contenu.slice(0, 40)} ».`);
      return;
    }
    if (etat.licences.includes(decode.licence)) {
      setMessage(`Licence ${decode.licence} déjà dans l'équipe.`);
      return;
    }
    const fiche = parLicence.get(decode.licence);
    setMessage(
      fiche
        ? null
        : `Licence ${decode.licence} inconnue du fichier des licenciés : rien à contrôler pour ce joueur.`,
    );
    maj({ licences: [...etat.licences, decode.licence] });
  };

  const retirer = (licence: string): void =>
    maj({ licences: etat.licences.filter((l) => l !== licence) });

  return (
    <div className="page championnat-page">
      <div className="page-head no-print">
        <h1>🏅 Championnat des clubs & Coupe de France</h1>
        <Link className="btn btn-ghost btn-sm" to="/">
          ← Retour aux concours
        </Link>
      </div>

      <p className="hint no-print">
        Contrôle qu'une composition est réglementaire, puis impression de la feuille de rencontre.
        Cette composition reste sur cet appareil : ce n'est pas un concours, elle ne se synchronise
        pas.
      </p>

      <div className="draw-panel no-print">
        <div className="form-row">
          <label>
            Compétition
            <select
              value={etat.competition}
              onChange={(e) => maj({ competition: e.target.value as CompetitionClubId })}
            >
              {COMPETITIONS_CLUB.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Mutés autorisés
            <input
              type="number"
              min={0}
              max={11}
              value={etat.maxMutes}
              onChange={(e) => maj({ maxMutes: Number(e.target.value) })}
            />
          </label>
        </div>
        <div className="form-row">
          <label>
            Division
            <input
              value={etat.division}
              onChange={(e) => maj({ division: e.target.value })}
              placeholder="ex. D1"
            />
          </label>
          <label>
            Poule
            <input
              value={etat.poule}
              onChange={(e) => maj({ poule: e.target.value })}
              placeholder="ex. A"
            />
          </label>
          <label>
            N° de club
            <input
              value={etat.numeroClub}
              onChange={(e) => maj({ numeroClub: e.target.value })}
              placeholder="ex. 6032"
            />
          </label>
          <label>
            N° du club adverse
            <input
              value={etat.numeroClubAdverse}
              onChange={(e) => maj({ numeroClubAdverse: e.target.value })}
            />
          </label>
        </div>
        <div className="form-row">
          <label>
            Capitaine ou coach qui ne joue pas
            <input
              value={etat.capitaineNom}
              onChange={(e) => maj({ capitaineNom: e.target.value })}
              placeholder="Nom et prénom"
            />
          </label>
          <label>
            Sa licence
            <input
              value={etat.capitaineLicence}
              onChange={(e) => maj({ capitaineLicence: e.target.value })}
              placeholder="N° licence"
            />
          </label>
          <label>
            Heure de début
            <input
              type="time"
              value={etat.heureDebut}
              onChange={(e) => maj({ heureDebut: e.target.value })}
            />
          </label>
          <label>
            Heure de fin
            <input
              type="time"
              value={etat.heureFin}
              onChange={(e) => maj({ heureFin: e.target.value })}
            />
          </label>
        </div>
        <p className="hint">
          Le capitaine joueur se met en <strong>première ligne</strong> de la composition ; ces deux
          cases ne servent qu'au capitaine ou coach qui ne joue pas.
        </p>
        <div className="form-row">
          <label>
            Date de la rencontre
            <input type="date" value={etat.date} onChange={(e) => maj({ date: e.target.value })} />
          </label>
          <label>
            Club
            <input
              value={etat.club}
              onChange={(e) => maj({ club: e.target.value })}
              placeholder="Votre club"
            />
          </label>
          <label>
            Adversaire
            <input
              value={etat.adversaire}
              onChange={(e) => maj({ adversaire: e.target.value })}
              placeholder="Club adverse"
            />
          </label>
        </div>
        <p className="hint">
          {competition.label} · {competition.sexe === 'feminin' ? 'féminin' : 'ouvert'} ·{' '}
          {competition.categorieAge
            ? CATEGORIE_AGE_LABELS[competition.categorieAge].toLowerCase()
            : 'toutes catégories'}{' '}
          · {competition.homogene ? 'équipe homogène exigée' : 'homogénéité non exigée'} · 1 joueur
          hors UE au plus
        </p>
      </div>

      <form
        className="toolbar no-print"
        onSubmit={(e) => {
          e.preventDefault();
          const v = saisie.trim();
          if (!v) return;
          ajouter(v);
          setSaisie('');
          champ.current?.focus();
        }}
      >
        <input
          ref={champ}
          value={saisie}
          onChange={(e) => setSaisie(e.target.value)}
          placeholder="Scannez une licence (douchette) ou tapez un n° puis Entrée"
          autoComplete="off"
        />
        <span className="toolbar-actions">
          {etat.licences.length > 0 && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => maj({ licences: [] })}>
              🗑 Réinitialiser l'équipe
            </button>
          )}
          <button type="button" className="btn btn-primary btn-sm" onClick={() => window.print()}>
            🖨 Feuille de rencontre
          </button>
        </span>
      </form>

      {message && <p className="hint no-print">{message}</p>}

      <div className="print-doc-head">
        <h2>Feuille de rencontre — {competition.label}</h2>
        <p>
          {formatDateFr(etat.date)}
          {etat.club ? ` · ${etat.club}` : ''}
          {etat.adversaire ? ` contre ${etat.adversaire}` : ''}
        </p>
      </div>

      {etat.licences.length === 0 ? (
        <p className="no-print">Scannez les licences de l'équipe pour la contrôler.</p>
      ) : (
        <>
          <p
            className={
              controle.conforme ? 'championnat-verdict ok' : 'championnat-verdict ko no-print'
            }
          >
            {controle.conforme
              ? `✓ Équipe conforme (${etat.licences.length} joueurs)`
              : `⚠ Équipe non conforme : ${
                  controle.anomaliesEquipe.map((a) => ANOMALIE_EQUIPE_LABELS[a]).join(', ') ||
                  'voir les joueurs en rouge'
                }`}
          </p>

          <table className="print-table">
            <thead>
              <tr>
                <th></th>
                <th>N° licence</th>
                <th>Nom, prénom</th>
                <th>Club</th>
                <th>Catégorie</th>
                <th>Position</th>
                <th className="no-print">Anomalies</th>
                <th className="no-print"></th>
              </tr>
            </thead>
            <tbody>
              {etat.licences.map((licence, i) => {
                const c = controle.joueurs[i]!;
                const fiche: Licencie | undefined = parLicence.get(licence);
                const horsUE = estHorsUE(fiche?.nationalite);
                const faute = (champLicence: ChampLicence) =>
                  c.anomalies.includes(champLicence) ? 'depot-champ-faute' : undefined;
                return (
                  <tr key={licence}>
                    <td>
                      <span
                        className={
                          c.anomalies.length === 0 && !c.inconnu
                            ? 'depot-voyant depot-voyant-ok'
                            : 'depot-voyant depot-voyant-ko'
                        }
                      />
                    </td>
                    <td className={faute('licence')}>{licence}</td>
                    <td>{(fiche?.name ?? '—').toLocaleUpperCase('fr-FR')}</td>
                    <td className={faute('club')}>{fiche?.club ?? '—'}</td>
                    <td className={faute('dateNaissance')}>
                      {fiche?.dateNaissance
                        ? (categorieAgeDe(fiche.dateNaissance, criteres.annee)
                            ? CATEGORIE_AGE_LABELS[
                                categorieAgeDe(fiche.dateNaissance, criteres.annee)!
                              ]
                            : '—')
                        : '—'}
                    </td>
                    <td>
                      {[
                        fiche?.mutation ? 'muté' : '',
                        horsUE === true ? 'hors UE' : '',
                        horsUE === null && fiche ? 'nationalité inconnue' : '',
                      ]
                        .filter(Boolean)
                        .join(' · ') || '—'}
                    </td>
                    <td className="no-print">
                      {c.inconnu
                        ? 'hors fichier'
                        : c.anomalies.map((a) => ANOMALIE_LABELS[a]).join(', ') || '—'}
                    </td>
                    <td className="no-print">
                      <button
                        className="btn-icon btn-icon-danger"
                        title="Retirer de l'équipe"
                        onClick={() => retirer(licence)}
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <ul className="print-bilan">
            <li>Joueurs : {etat.licences.length}</li>
            <li>
              Mutés : {joueurs.filter((p) => parLicence.get(p.licence!)?.mutation).length} /{' '}
              {etat.maxMutes} autorisé{etat.maxMutes > 1 ? 's' : ''}
            </li>
            <li>
              Hors Union européenne :{' '}
              {joueurs.filter((p) => estHorsUE(parLicence.get(p.licence!)?.nationalite) === true)
                .length}{' '}
              / 1 autorisé
            </li>
          </ul>

          {/* Composition adverse : saisie à la main — ses licences ne sont pas
              dans notre fichier, donc rien à contrôler de ce côté. */}
          <section className="feuille-adverse">
            <h2>Composition {etat.adversaire.trim() || 'de l\'équipe adverse'}</h2>
            <p className="hint no-print">
              Recopiée depuis sa feuille : ses licences ne sont pas dans votre fichier, l'application
              ne les contrôle donc pas.
            </p>
            <div className="table-scroll">
              <table className="print-table">
                <thead>
                  <tr>
                    <th></th>
                    <th>Nom, prénom</th>
                    <th>N° licence</th>
                  </tr>
                </thead>
                <tbody>
                  {etat.adversaireJoueurs.map((j, i) => (
                    <tr key={i}>
                      <td className="feuille-num">{i + 1}</td>
                      <td>
                        <input
                          value={j.nom}
                          onChange={(e) =>
                            maj({
                              adversaireJoueurs: etat.adversaireJoueurs.map((x, k) =>
                                k === i ? { ...x, nom: e.target.value } : x,
                              ),
                            })
                          }
                          placeholder={i === 0 ? 'Capitaine' : ''}
                        />
                      </td>
                      <td>
                        <input
                          className="licence-input"
                          value={j.licence}
                          onChange={(e) =>
                            maj({
                              adversaireJoueurs: etat.adversaireJoueurs.map((x, k) =>
                                k === i ? { ...x, licence: e.target.value } : x,
                              ),
                            })
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <FeuilleMatchVerso
            bareme={BAREME_CDC}
            parties={etat.parties}
            onParties={(parties) => maj({ parties })}
            joueursA={joueurs.map((p) => ({ nom: p.name, licence: p.licence ?? '' }))}
            joueursB={etat.adversaireJoueurs}
            places={etat.places}
            onPlaces={(places) => maj({ places })}
            remplacements={etat.remplacements}
            onRemplacements={(remplacements) => maj({ remplacements })}
            clubA={etat.club}
            clubB={etat.adversaire}
          />

          <label className="feuille-remarques">
            Remarques
            <textarea
              value={etat.remarques}
              onChange={(e) => maj({ remarques: e.target.value })}
              rows={2}
              placeholder="En cas d'incident, joindre un rapport."
            />
          </label>

          <section className="print-arbitrage-sign">
            <p>
              Capitaine {etat.club || '…'} : <span className="print-rule" />
            </p>
            <p>
              Capitaine {etat.adversaire || '…'} : <span className="print-rule" />
            </p>
            <p>
              Arbitre : <span className="print-rule" />
            </p>
          </section>

          <div className="export-bar no-print">
            <span className="export-bar-label">Retour au comité :</span>
            <input
              className="courriel-comite"
              value={etat.courrielComite}
              onChange={(e) => maj({ courrielComite: e.target.value })}
              placeholder="courriel du comité (ex. cd26-cdc@francepetanque.com)"
            />
            <a
              className="btn btn-ghost btn-sm"
              href={lienCourriel}
              onClick={(e) => {
                if (!etat.courrielComite.trim()) e.preventDefault();
              }}
              title="Prépare le message ; joignez-y la feuille signée"
            >
              ✉ Préparer le courriel
            </a>
            <span className="hint">
              Imprimez, faites signer les deux capitaines, puis joignez la feuille au message : une
              feuille signée vaut acceptation.
            </span>
          </div>
        </>
      )}
    </div>
  );
}
