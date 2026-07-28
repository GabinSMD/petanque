import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Licencie, Player } from '@shared';
import {
  COMPETITIONS_CLUB,
  categorieAgeDe,
  controlerEquipe,
  criteresCompetition,
  estHorsUE,
  parseLicenceQr,
  type ChampLicence,
  type CompetitionClubId,
} from '@shared';
import { useLicencies } from '../db/hooks';
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
}

function lireMemoire(): Etat {
  const parDefaut: Etat = {
    competition: 'cnc_open',
    maxMutes: 1,
    date: new Date().toISOString().slice(0, 10),
    club: '',
    adversaire: '',
    licences: [],
  };
  try {
    const brut = localStorage.getItem(CLE_MEMOIRE);
    return brut ? { ...parDefaut, ...(JSON.parse(brut) as Partial<Etat>) } : parDefaut;
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
        </>
      )}
    </div>
  );
}
