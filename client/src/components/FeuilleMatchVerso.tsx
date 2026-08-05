import type { BaremeRencontre, PartieRencontre } from '@shared';
import { LIBELLE_TYPE_PARTIE, TAILLE_FORMATION, bilanRencontre, pointsEnJeu } from '@shared';

/** Un joueur tel qu'il apparaît sur la feuille : nom et numéro de licence. */
export interface JoueurFeuille {
  nom: string;
  licence: string;
}

/** Remplacements d'un bloc : jusqu'à deux par équipe, comme sur la feuille. */
export interface Remplacement {
  remplace: string;
  remplacant: string;
}

export interface Remplacements {
  a: Record<string, Remplacement[]>;
  b: Record<string, Remplacement[]>;
}

interface Props {
  bareme: BaremeRencontre;
  parties: PartieRencontre[];
  onParties: (parties: PartieRencontre[]) => void;
  /** Compositions déclarées au recto, pour choisir qui joue quoi. */
  joueursA: JoueurFeuille[];
  joueursB: JoueurFeuille[];
  /** Qui joue chaque place de chaque partie : `places[i][cote]` = noms. */
  places: { a: string[]; b: string[] }[];
  onPlaces: (places: { a: string[]; b: string[] }[]) => void;
  remplacements: Remplacements;
  onRemplacements: (r: Remplacements) => void;
  clubA: string;
  clubB: string;
}

/**
 * Verso de la feuille de match : « ORDRE des RENCONTRES & FEUILLE DE RÉSULTAT ».
 *
 * Les points ne se saisissent pas — ils découlent du vainqueur et du type de
 * partie. C'est précisément ce que l'appli apporte : le bas de la feuille
 * s'additionne tout seul, et la somme des deux totaux est connue d'avance
 * (36 points sur la feuille du CD26). Une feuille fausse se voit avant d'être
 * signée, et une feuille signée vaut acceptation.
 */
export function FeuilleMatchVerso({
  bareme,
  parties,
  onParties,
  joueursA,
  joueursB,
  places,
  onPlaces,
  remplacements,
  onRemplacements,
  clubA,
  clubB,
}: Props) {
  const bilan = bilanRencontre(bareme, parties);
  const enJeu = pointsEnJeu(bareme);

  const majPartie = (i: number, patch: Partial<PartieRencontre>): void =>
    onParties(parties.map((p, j) => (j === i ? { ...p, ...patch } : p)));

  const majPlace = (i: number, cote: 'a' | 'b', slot: number, nom: string): void =>
    onPlaces(
      places.map((p, j) =>
        j === i ? { ...p, [cote]: p[cote].map((n, k) => (k === slot ? nom : n)) } : p,
      ),
    );

  const majRemplacement = (
    cote: 'a' | 'b',
    type: string,
    idx: number,
    patch: Partial<Remplacement>,
  ): void => {
    const bloc = remplacements[cote][type] ?? [
      { remplace: '', remplacant: '' },
      { remplace: '', remplacant: '' },
    ];
    onRemplacements({
      ...remplacements,
      [cote]: {
        ...remplacements[cote],
        [type]: bloc.map((r, i) => (i === idx ? { ...r, ...patch } : r)),
      },
    });
  };

  /** Points marqués par un camp sur une partie donnée, ou rien. */
  const pointsDe = (partie: PartieRencontre, cote: 'a' | 'b'): string => {
    const bloc = bareme.blocs.find((b) => b.type === partie.type);
    if (!bloc || partie.scoreA === null || partie.scoreB === null) return '';
    if (partie.scoreA === partie.scoreB) return '';
    const gagneA = partie.scoreA > partie.scoreB;
    return (cote === 'a' ? gagneA : !gagneA) ? String(bloc.points) : '0';
  };

  /** Index de la première partie de chaque bloc, pour les titres et sous-totaux. */
  let curseur = 0;
  const blocs = bareme.blocs.map((b) => {
    const debut = curseur;
    curseur += b.nb;
    return { ...b, debut };
  });

  const joueursDe = (cote: 'a' | 'b'): JoueurFeuille[] => (cote === 'a' ? joueursA : joueursB);

  /** Noms déclarés dans la composition d'un camp. */
  const composition = (cote: 'a' | 'b'): string[] =>
    joueursDe(cote)
      .map((j) => j.nom.trim())
      .filter(Boolean);

  /**
   * Qui joue effectivement dans ce bloc, pour ce camp : on ne remplace que
   * quelqu'un qui est sur le terrain.
   */
  const surLeTerrain = (cote: 'a' | 'b', debut: number, nb: number): string[] => [
    ...new Set(
      places
        .slice(debut, debut + nb)
        .flatMap((p) => p[cote])
        .map((n) => n.trim())
        .filter(Boolean),
    ),
  ];

  /**
   * Liste d'un menu de remplacement. Une valeur déjà enregistrée qui n'y figure
   * plus — composition modifiée depuis, ou feuille saisie avant les menus — est
   * conservée et signalée : on ne perd pas une donnée en silence.
   */
  const optionsAvecValeur = (choix: string[], valeur: string): { nom: string; hors: boolean }[] => {
    const liste = choix.map((nom) => ({ nom, hors: false }));
    const v = valeur.trim();
    if (v && !choix.includes(v)) liste.unshift({ nom: v, hors: true });
    return liste;
  };

  return (
    <section className="feuille-verso">
      <h2>Ordre des rencontres &amp; feuille de résultat</h2>

      {blocs.map((bloc) => {
        const sousTotal = bilan.sousTotaux.find((s) => s.type === bloc.type);
        return (
          <div key={bloc.type} className="feuille-bloc">
            <h3>
              {LIBELLE_TYPE_PARTIE[bloc.type]}{' '}
              <span className="hint">
                {bloc.points} point{bloc.points > 1 ? 's' : ''} par partie
              </span>
            </h3>
            <div className="table-scroll">
              <table className="print-table feuille-table">
                <thead>
                  <tr>
                    <th></th>
                    <th>{clubA.trim() || 'Équipe A'}</th>
                    <th>Score</th>
                    <th>Pts</th>
                    <th title="Jeu attribué à la partie">Jeux</th>
                    <th>Pts</th>
                    <th>Score</th>
                    <th>{clubB.trim() || 'Équipe B'}</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: bloc.nb }, (_, n) => {
                    const i = bloc.debut + n;
                    const partie = parties[i]!;
                    return (
                      <tr key={i}>
                        <td className="feuille-num">{n + 1}</td>
                        {(['a', 'b'] as const).map((cote) => {
                          const cellules = (
                            <td key={`${cote}-noms`} className="feuille-noms">
                              {Array.from({ length: TAILLE_FORMATION[bloc.type] }, (_, slot) => (
                                <select
                                  key={slot}
                                  value={places[i]?.[cote][slot] ?? ''}
                                  onChange={(e) => majPlace(i, cote, slot, e.target.value)}
                                >
                                  <option value="">—</option>
                                  {joueursDe(cote)
                                    .filter((j) => j.nom.trim())
                                    .map((j) => (
                                      <option key={j.nom} value={j.nom}>
                                        {j.nom}
                                      </option>
                                    ))}
                                </select>
                              ))}
                            </td>
                          );
                          const score = (
                            <td key={`${cote}-score`} className="feuille-score">
                              <input
                                type="number"
                                min={0}
                                value={(cote === 'a' ? partie.scoreA : partie.scoreB) ?? ''}
                                onChange={(e) =>
                                  majPartie(i, {
                                    [cote === 'a' ? 'scoreA' : 'scoreB']:
                                      e.target.value === '' ? null : Number(e.target.value),
                                  })
                                }
                              />
                            </td>
                          );
                          const pts = (
                            <td key={`${cote}-pts`} className="feuille-pts">
                              {pointsDe(partie, cote)}
                            </td>
                          );
                          // Camp A : noms, score, points ; puis le jeu attribué ;
                          // camp B : points, score, noms — comme sur le papier.
                          return cote === 'a'
                            ? [
                                cellules,
                                score,
                                pts,
                                <td key="jeu" className="feuille-jeu">
                                  <input
                                    value={partie.jeu ?? ''}
                                    onChange={(e) => majPartie(i, { jeu: e.target.value })}
                                    placeholder="—"
                                  />
                                </td>,
                              ]
                            : [pts, score, cellules];
                        })}
                      </tr>
                    );
                  })}
                  <tr className="feuille-soustotal">
                    <td></td>
                    <td>Sous-total</td>
                    <td></td>
                    <td className="feuille-pts">{sousTotal?.a ?? 0}</td>
                    <td></td>
                    <td className="feuille-pts">{sousTotal?.b ?? 0}</td>
                    <td></td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            </div>

            {bloc.type !== 'tete_a_tete' && (
              <div className="feuille-remplacements">
                {(['a', 'b'] as const).map((cote) => (
                  <div key={cote}>
                    <h4>Remplacements — {cote === 'a' ? clubA.trim() || 'A' : clubB.trim() || 'B'}</h4>
                    {[0, 1].map((idx) => {
                      const r = remplacements[cote][bloc.type]?.[idx] ?? {
                        remplace: '',
                        remplacant: '',
                      };
                      const menus = [
                        {
                          cle: 'remplace' as const,
                          etiquette: `Remplacé n°${idx + 1}`,
                          choix: surLeTerrain(cote, bloc.debut, bloc.nb),
                          valeur: r.remplace,
                        },
                        {
                          cle: 'remplacant' as const,
                          etiquette: `Remplaçant n°${idx + 1}`,
                          // Toute la composition : un remplaçant n'est pas encore
                          // sur le terrain, mais il doit être déclaré au recto.
                          choix: composition(cote),
                          valeur: r.remplacant,
                        },
                      ];
                      return (
                        <div key={idx} className="feuille-remplacement">
                          {menus.map((m) => (
                            <label key={m.cle} className="feuille-menu">
                              <span className="hint">{m.etiquette}</span>
                              <select
                                value={m.valeur}
                                onChange={(e) =>
                                  majRemplacement(cote, bloc.type, idx, {
                                    [m.cle]: e.target.value,
                                  })
                                }
                              >
                                <option value="">—</option>
                                {optionsAvecValeur(m.choix, m.valeur).map((o) => (
                                  <option key={o.nom} value={o.nom}>
                                    {o.nom}
                                    {o.hors ? ' (hors composition)' : ''}
                                  </option>
                                ))}
                              </select>
                            </label>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      <table className="print-table feuille-totaux">
        <tbody>
          <tr>
            <td>Total général {clubA.trim() || 'Équipe A'}</td>
            <td className="feuille-pts">{bilan.totalA}</td>
            <td>Total général {clubB.trim() || 'Équipe B'}</td>
            <td className="feuille-pts">{bilan.totalB}</td>
          </tr>
        </tbody>
      </table>

      {/* Le contrôle que la feuille papier laisse à l'addition à la main. */}
      <p
        className={
          bilan.anomalies.length > 0
            ? 'feuille-verdict ko'
            : bilan.complete
              ? 'feuille-verdict ok'
              : 'feuille-verdict'
        }
      >
        {bilan.anomalies.includes('nulle') &&
          'Une partie est à égalité : une partie de pétanque a un vainqueur. '}
        {bilan.anomalies.includes('incomplete') &&
          'Une partie n\'a qu\'un seul score saisi. '}
        {bilan.anomalies.length === 0 &&
          (bilan.complete
            ? `✓ Feuille complète : ${bilan.totalA} + ${bilan.totalB} = ${enJeu} points, le compte est bon.`
            : `${bilan.jouees} partie${bilan.jouees > 1 ? 's' : ''} sur ${bilan.parties} saisie${
                bilan.jouees > 1 ? 's' : ''
              } — ${enJeu} points en jeu au total.`)}
      </p>
    </section>
  );
}
