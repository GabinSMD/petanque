import { useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { Licencie, Player } from '@shared';
import {
  BAREME_CDC,
  COMPETITIONS_CLUB,
  categorieAgeDe,
  controlerEquipe,
  criteresCompetition,
  resumeFeuille,
  estHorsUE,
  parseLicenceQr,
  bilanRencontre,
  empreinteFeuille,
  partiesVides,
  pointsEnJeu,
  type ChampLicence,
  type CompetitionClubId,
  type FeuilleMatch,
} from '@shared';
import { useFeuilleMatch, useLicencies } from '../db/hooks';
import { updateFeuilleMatch } from '../db/actions';
import { SignaturePad } from '../components/SignaturePad';
import {
  EchangeCompositionModal,
  appliquerComposition,
} from '../components/EchangeCompositionModal';
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

/**
 * Feuille de match d'une rencontre de championnat des clubs (manuel §3.E).
 *
 * On compose l'équipe licence par licence et l'application dit si elle est
 * réglementaire ; on saisit l'ordre des rencontres et les résultats, dont elle
 * fait l'addition ; les deux capitaines signent ; on imprime et on transmet.
 *
 * La feuille est une entité synchronisée : elle se retrouve sur les autres
 * tablettes du club et survit à la perte de celle-ci.
 */
export function FeuilleMatchPage() {
  const { id } = useParams();
  const feuille = useFeuilleMatch(id);
  const licencies = useLicencies() ?? [];
  const parLicence = useMemo(
    () => new Map(licencies.filter((l) => l.licence).map((l) => [l.licence!, l])),
    [licencies],
  );

  const [saisie, setSaisie] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [echange, setEchange] = useState(false);
  const champ = useRef<HTMLInputElement>(null);

  if (!feuille) {
    return (
      <div className="page">
        <p className="empty-state">
          Feuille introuvable. <Link to="/championnat-clubs">Retour aux feuilles de match</Link>
        </p>
      </div>
    );
  }
  const etat = feuille;

  /** Toute modification est écrite tout de suite : la feuille se synchronise. */
  const maj = (patch: Partial<FeuilleMatch>): void => {
    void updateFeuilleMatch({ ...etat, ...patch });
  };

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

  /* ------------------------------------------------------------------ */
  /* Signature : ce qu'elle atteste, et ce qu'elle verrouille             */
  /* ------------------------------------------------------------------ */

  const bilanPourSignature = bilanRencontre(BAREME_CDC, etat.parties);
  const contenu = {
    entete: {
      competition: competition.label,
      date: etat.date,
      division: etat.division,
      poule: etat.poule,
      clubA: etat.club,
      numeroClubA: etat.numeroClub,
      clubB: etat.adversaire,
      numeroClubB: etat.numeroClubAdverse,
      heureDebut: etat.heureDebut,
      heureFin: etat.heureFin,
      capitaine: `${etat.capitaineNom} ${etat.capitaineLicence}`,
    },
    compositionA: joueurs.map((p) => p.name),
    compositionB: etat.adversaireJoueurs.map((j) => `${j.nom} ${j.licence}`),
    parties: etat.parties.map((p, i) => ({
      type: p.type,
      scoreA: p.scoreA,
      scoreB: p.scoreB,
      jeu: p.jeu,
      placesA: etat.places[i]?.a ?? [],
      placesB: etat.places[i]?.b ?? [],
    })),
    remplacements: (['a', 'b'] as const).flatMap((cote) =>
      Object.entries(etat.remplacements[cote] ?? {}).flatMap(([bloc, liste]) =>
        (liste ?? []).map((r) => ({ bloc, cote, remplace: r.remplace, remplacant: r.remplacant })),
      ),
    ),
    remarques: etat.remarques,
    totalA: bilanPourSignature.totalA,
    totalB: bilanPourSignature.totalB,
  };
  const empreinte = empreinteFeuille(contenu);

  const signee = Boolean(etat.signatures.a || etat.signatures.b);
  /**
   * Une anomalie interdit de signer : on n'atteste pas un résultat impossible.
   * Une feuille simplement incomplète reste signable — une rencontre peut être
   * interrompue — mais on le dit.
   */
  const empecheSignature =
    bilanPourSignature.anomalies.length > 0
      ? 'Corrigez la feuille avant de signer : une partie est à égalité ou n\'a qu\'un seul score.'
      : undefined;
  /** L'empreinte figurant sur un exemplaire signé ne correspond plus au contenu. */
  const empreinteSignee = etat.signatures.a?.empreinte ?? etat.signatures.b?.empreinte;
  const empreinteDivergente = Boolean(empreinteSignee && empreinteSignee !== empreinte);

  const signer = (cote: 'a' | 'b', image: string): void =>
    maj({
      signatures: {
        ...etat.signatures,
        [cote]: {
          image,
          quand: new Date().toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }),
          empreinte,
        },
      },
    });

  const effacerSignatures = (): void => {
    if (
      window.confirm(
        'Effacer les signatures pour corriger la feuille ? Les deux capitaines devront signer de nouveau.',
      )
    ) {
      maj({ signatures: { a: null, b: null } });
    }
  };

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
        <h1>🏅 {resumeFeuille(etat)}</h1>
        <Link className="btn btn-ghost btn-sm" to="/championnat-clubs">
          ← Feuilles de match
        </Link>
      </div>

      <p className="hint no-print">
        Contrôle qu'une composition est réglementaire, puis impression de la feuille de rencontre.
        Cette composition reste sur cet appareil : ce n'est pas un concours, elle ne se synchronise
        pas.
      </p>

      {signee && (
        <p className="banner-warn no-print">
          🔒 Feuille signée — elle n'est plus modifiable. Empreinte{' '}
          <strong>{empreinteSignee}</strong>.{' '}
          <button className="btn-lien" onClick={effacerSignatures}>
            Effacer les signatures pour corriger
          </button>
        </p>
      )}

      {empreinteDivergente && (
        <p className="banner-warn no-print">
          ⚠ Le contenu a changé depuis la signature : l'empreinte est maintenant{' '}
          <strong>{empreinte}</strong> au lieu de <strong>{empreinteSignee}</strong>. L'exemplaire
          signé ne correspond plus — faites signer de nouveau.
        </p>
      )}

      {/* Signer verrouille tout ce que la signature atteste : un `fieldset`
          désactivé neutralise d'un coup tous les champs qu'il contient. */}
      <fieldset className="feuille-verrou" disabled={signee}>
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
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setEchange(true)}
            title="Montrer notre composition à l'autre club, ou recevoir la sienne"
          >
            🔁 Échanger les compositions
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => window.print()}>
            🖨 Feuille de rencontre
          </button>
        </span>
      </form>
      </fieldset>

      {echange && (
        <EchangeCompositionModal
          feuille={etat}
          joueurs={joueurs}
          onClose={() => setEchange(false)}
          onRecevoir={(compo) => {
            const { patch, message: dit } = appliquerComposition(etat, compo);
            maj(patch);
            setMessage(dit);
          }}
        />
      )}

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
          <fieldset className="feuille-verrou" disabled={signee}>
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
          </fieldset>

          <section className="feuille-signatures">
            <h2>Signatures des capitaines</h2>
            <p className="hint no-print">
              Une feuille signée vaut acceptation du résultat : plus de réclamation possible.
              {!bilanPourSignature.complete &&
                ' Cette feuille est encore incomplète — vérifiez avant de faire signer.'}
            </p>
            <div className="feuille-signatures-paves">
              {(['a', 'b'] as const).map((cote) => (
                <SignaturePad
                  key={cote}
                  valeur={etat.signatures[cote]?.image ?? ''}
                  quand={etat.signatures[cote]?.quand}
                  qui={
                    cote === 'a'
                      ? etat.club.trim() || 'Capitaine A'
                      : etat.adversaire.trim() || 'Capitaine B'
                  }
                  empeche={empecheSignature}
                  onSigner={(image) => signer(cote, image)}
                />
              ))}
            </div>
            <p className="feuille-empreinte">
              Empreinte de la feuille : <strong>{empreinte}</strong>
              <span className="hint">
                {' '}
                — à comparer avec celle de l'exemplaire signé : si elle diffère, la feuille a été
                modifiée depuis.
              </span>
            </p>
            <p className="feuille-arbitre">
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
