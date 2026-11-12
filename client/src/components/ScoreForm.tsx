import { Check, Pencil, RotateCw, Trash2, TriangleAlert, Undo, X } from 'lucide-react';
import { useEffect, useRef, useState, type FocusEvent, type FormEvent, type ReactNode } from 'react';
import type { Concours, Match } from '@shared';
import { evolutionEnTexte, inverserResultat, validateScore } from '@shared';
import {
  ajouterMeneAuMatch,
  clearScore,
  inverserResultatDuMatch,
  partiesEffaceesSi,
  retirerMeneDuMatch,
  setMatchVainqueur,
  setScore,
} from '../db/actions';
import { phraseEffacement } from '../lib/matchLabel';

type Camp = 'a' | 'b';

interface Props {
  concours: Concours;
  match: Match;
  /** Libellés des deux camps, pour nommer les boutons de victoire. */
  labelA?: string;
  labelB?: string;
  disabled?: boolean;
  /** Partie terminée : n'afficher que le bouton de correction (les scores sont déjà visibles ailleurs). */
  editOnly?: boolean;
  /** Appelé après une saisie réussie (saisie rapide : revenir au champ n°). */
  onSaved?: () => void;
  /**
   * Ordre d'affichage des camps. La saisie rapide met en tête l'équipe dont on
   * vient de taper le numéro : c'est d'elle qu'on parle. Les données ne
   * bougent pas — la case de gauche reste rattachée à son camp.
   */
  ordre?: 'AB' | 'BA';
  /**
   * Annoncer en toutes lettres le vainqueur désigné (« n°9 gagne 13 contre
   * n°3 : __ ») avec de quoi se reprendre. Utile quand c'est Entrée, et non un
   * bouton nommé, qui a désigné le vainqueur.
   */
  annonce?: boolean;
  /**
   * Désignation du vainqueur venue de l'extérieur (Entrée dans la saisie
   * rapide). Le jeton change à chaque demande, pour qu'une même équipe puisse
   * être redésignée.
   */
  demande?: { camp: Camp; jeton: number };
  /** Écrire « corriger » à côté du crayon d'une partie jouée. */
  motCorriger?: boolean;
}

/** Une action qui effacerait des parties déjà jouées, en attente d'accord. */
interface AConfirmer {
  phrases: string[];
  action: () => Promise<void>;
}

/**
 * Saisie / correction du score d'une partie.
 * Les deux scores se valident automatiquement (touche Entrée, ou dès qu'on
 * quitte les cases une fois les deux remplies) — aucun bouton à cliquer.
 */
export function ScoreForm({
  concours,
  match,
  labelA,
  labelB,
  disabled,
  editOnly,
  onSaved,
  ordre = 'AB',
  annonce,
  demande,
  motCorriger,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [error, setError] = useState<string | null>(null);
  /** Saisir le score alors que le concours se joue au vainqueur seul. */
  const [scoreQuandMeme, setScoreQuandMeme] = useState(false);
  /** Panneau des mènes, replié par défaut. */
  const [menesOuvertes, setMenesOuvertes] = useState(false);
  /** Camp désigné vainqueur par « gagne 13 » ou par Entrée. */
  const [designe, setDesigne] = useState<Camp | null>(null);
  const [aConfirmer, setAConfirmer] = useState<AConfirmer | null>(null);
  /** Case à prendre au prochain rendu (ouverture d'une correction). */
  const [focusSur, setFocusSur] = useState<Camp | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const champA = useRef<HTMLInputElement>(null);
  const champB = useRef<HTMLInputElement>(null);
  const champ = (camp: Camp) => (camp === 'a' ? champA : champB).current;
  const nom = (camp: Camp) => (camp === 'a' ? (labelA ?? 'A') : (labelB ?? 'B'));
  const autre = (camp: Camp): Camp => (camp === 'a' ? 'b' : 'a');

  /**
   * Le geste du manuel : « un écran pour indiquer le score de la partie apparaît,
   * avec 13 automatiquement pour l'équipe gagnante. Vous mettez le score de
   * l'équipe perdante » (p.46, dialogue montré p.97). On désigne le vainqueur,
   * son score est prérempli à `scoreMax`, et il ne reste qu'un nombre à taper.
   *
   * Le champ reste modifiable : une partie peut se gagner à un autre score.
   */
  const designerVainqueur = (camp: Camp): void => {
    const gagnant = String(concours.scoreMax);
    setA(camp === 'a' ? gagnant : '');
    setB(camp === 'b' ? gagnant : '');
    setDesigne(camp);
    setError(null);
    // Le focus part sur le perdant : c'est le seul nombre qui reste à saisir.
    champ(autre(camp))?.focus();
  };

  useEffect(() => {
    if (demande) designerVainqueur(demande.camp);
    // Seul le jeton déclenche : une nouvelle demande, pas un nouveau rendu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demande?.jeton]);

  useEffect(() => {
    if (!focusSur) return;
    const el = champ(focusSur);
    el?.focus();
    el?.select();
    setFocusSur(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusSur]);

  if (match.byeA || match.byeB) {
    return <span className="score-view score-bye">exempt</span>;
  }
  const sideAKnown = Boolean(match.teamAId || (match.playersA && match.playersA.length > 0));
  const sideBKnown = Boolean(match.teamBId || (match.playersB && match.playersB.length > 0));
  if (!sideAKnown || !sideBKnown) {
    return <span className="score-view score-tbd">—</span>;
  }

  const ready = !match.done;
  const showForm = ready || editing;

  const fermer = () => {
    setEditing(false);
    setA('');
    setB('');
    setDesigne(null);
    setAConfirmer(null);
  };

  /**
   * Garde-fou des corrections : inverser, gommer ou changer le gagnant d'une
   * partie dont la suite est jouée effacerait cette suite. On la calcule à
   * blanc ; s'il y a quelque chose à perdre, on le nomme et on attend l'accord.
   * Sinon, rien ne s'interpose — la correction ordinaire reste d'un geste.
   */
  const avecGardeFou = async (apres: Match, action: () => Promise<void>): Promise<void> => {
    const { effacees, matches, poules, teams } = await partiesEffaceesSi(concours, apres);
    if (effacees.length === 0) {
      setAConfirmer(null);
      await action();
      return;
    }
    const teamsById = new Map(teams.map((t) => [t.id, t]));
    setAConfirmer({
      phrases: effacees.map((m) => phraseEffacement(m, poules, matches, teamsById)),
      action,
    });
  };

  /** Valide dès que les deux cases sont remplies ; sinon ne fait rien. */
  const tryCommit = async () => {
    if (a.trim() === '' || b.trim() === '') return;
    setError(null);
    const scoreA = Number(a);
    const scoreB = Number(b);
    const enregistrer = async () => {
      try {
        await setScore(concours, match, scoreA, scoreB);
        fermer();
        onSaved?.();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Score invalide');
      }
    };
    if (!match.done) {
      await enregistrer();
      return;
    }
    // Une correction : le score doit être valable avant qu'on parle de
    // l'aval, sinon on demanderait un accord pour une saisie refusée.
    const check = validateScore(scoreA, scoreB, concours.scoreMax);
    if (!check.ok) {
      setError(check.error ?? 'Score invalide');
      return;
    }
    await avecGardeFou(
      { ...match, scoreA, scoreB, vainqueur: undefined, done: true },
      enregistrer,
    );
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void tryCommit();
  };

  /** Sauvegarde en quittant la saisie (sauf si le focus reste dans le formulaire). */
  const onBlur = (e: FocusEvent<HTMLFormElement>) => {
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    void tryCommit();
  };

  const startEdit = () => {
    setA(match.scoreA !== null ? String(match.scoreA) : '');
    setB(match.scoreB !== null ? String(match.scoreB) : '');
    setEditing(true);
    setDesigne(null);
    setError(null);
    // On corrige presque toujours le score du perdant : sa case est prise et
    // son contenu sélectionné, le nouveau chiffre le remplace.
    if (match.scoreA !== null && match.scoreB !== null) {
      setFocusSur(match.scoreA < match.scoreB ? 'a' : 'b');
    }
  };

  const erase = () =>
    avecGardeFou(
      { ...match, scoreA: null, scoreB: null, menes: undefined, vainqueur: undefined, done: false },
      async () => {
        await clearScore(concours, match);
        fermer();
      },
    );

  /**
   * « Inverser Résultat » (planche p.97, à côté de `Modifier Score` et
   * `Gommer`, et texte p.101). Rangé dans la correction et non plus à côté du
   * crayon : d'un seul toucher, à 26 px du crayon, il effaçait la suite.
   */
  const inverser = () =>
    avecGardeFou(inverserResultat(match), async () => {
      await inverserResultatDuMatch(concours, match);
      fermer();
    });

  /** Panneau d'accord, quand une correction emporterait des parties jouées. */
  const confirmation = aConfirmer && (
    <div className="score-confirmer" role="alertdialog" aria-label="Parties jouées effacées">
      <p>
        <TriangleAlert className="ic" aria-hidden />{' '}
        <strong>
          {aConfirmer.phrases.length > 1
            ? 'Cette correction efface des parties déjà jouées :'
            : 'Cette correction efface une partie déjà jouée :'}
        </strong>
      </p>
      <ul>
        {aConfirmer.phrases.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ul>
      <span className="score-confirmer-actions">
        <button
          type="button"
          className="btn btn-danger btn-sm score-outil"
          onClick={() => {
            const { action } = aConfirmer;
            setAConfirmer(null);
            void action();
          }}
        >
          Confirmer et effacer
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm score-outil"
          onClick={() => setAConfirmer(null)}
        >
          Annuler
        </button>
      </span>
    </div>
  );

  const crayon = (titre: string, mot?: string) => (
    <button type="button" className="btn-icon score-crayon" onClick={startEdit} title={titre}>
      <Pencil className="ic" aria-hidden />
      {mot ? ` ${mot}` : null}
    </button>
  );

  if (!showForm) {
    if (editOnly) {
      if (disabled) return null;
      return <span className="score-view score-done">{crayon('Corriger le score', 'corriger')}</span>;
    }
    if (match.scoreA === null || match.scoreB === null) {
      // Vainqueur désigné sans score.
      return (
        <span className="score-view score-done">
          <strong className="score-win">
            {match.vainqueur === 'A' ? (labelA ?? 'A') : (labelB ?? 'B')} gagne
          </strong>
          {!disabled && crayon('Corriger : saisir le score, changer ou inverser le vainqueur')}
        </span>
      );
    }
    // Le score se lit dans l'ordre des équipes affichées autour.
    const [s1, s2] =
      ordre === 'BA' ? [match.scoreB!, match.scoreA!] : [match.scoreA!, match.scoreB!];
    return (
      <span className="score-view score-done">
        <strong className={s1 > s2 ? 'score-win' : ''}>{s1}</strong>
        <span className="score-sep">–</span>
        <strong className={s2 > s1 ? 'score-win' : ''}>{s2}</strong>
        {!disabled &&
          crayon('Corriger, inverser ou effacer le score', motCorriger ? 'corriger' : undefined)}
      </span>
    );
  }

  if (disabled) return <span className="score-view score-tbd">—</span>;

  // Concours au vainqueur seul : deux boutons, et le score reste accessible
  // pour qui veut le noter quand même.
  if (concours.vainqueurSeul && !scoreQuandMeme) {
    const designer = (cote: 'A' | 'B') => {
      const ecrire = async () => {
        await setMatchVainqueur(concours, match, cote);
        fermer();
        onSaved?.();
      };
      if (!match.done) return void ecrire();
      void avecGardeFou(
        { ...match, vainqueur: cote, scoreA: null, scoreB: null, done: true },
        ecrire,
      );
    };
    return (
      <span className="score-vainqueur">
        <button type="button" className="btn btn-sm" onClick={() => designer('A')}>
          {labelA ?? 'A'} gagne
        </button>
        <button type="button" className="btn btn-sm" onClick={() => designer('B')}>
          {labelB ?? 'B'} gagne
        </button>
        <button
          type="button"
          className="btn-icon"
          title="Saisir le score de cette partie"
          onClick={() => setScoreQuandMeme(true)}
        >
          123
        </button>
        {match.done && (
          <button type="button" className="btn-icon" title="Effacer" onClick={() => void erase()}>
            <Trash2 className="ic" aria-hidden />
          </button>
        )}
        {confirmation}
      </span>
    );
  }

  const valeur = (camp: Camp) => (camp === 'a' ? a : b);
  const ordreCamps: [Camp, Camp] = ordre === 'BA' ? ['b', 'a'] : ['a', 'b'];

  const boutonGagne = (camp: Camp): ReactNode => (
    <button
      key={camp}
      type="button"
      className="btn btn-sm score-gagne"
      onClick={() => designerVainqueur(camp)}
      title={`${nom(camp)} gagne — score prérempli à ${concours.scoreMax}`}
    >
      {nom(camp)} gagne {concours.scoreMax}
    </button>
  );

  const case_ = (camp: Camp): ReactNode => (
    <input
      key={camp}
      ref={camp === 'a' ? champA : champB}
      type="number"
      inputMode="numeric"
      min={0}
      max={concours.scoreMax}
      value={valeur(camp)}
      onChange={(e) => (camp === 'a' ? setA : setB)(e.target.value)}
      // Entrer dans une case la sélectionne entière : en correction, le
      // chiffre tapé remplace l'ancien au lieu de s'y ajouter.
      onFocus={(e) => e.currentTarget.select()}
      aria-label={camp === 'a' ? 'Score équipe A' : 'Score équipe B'}
      placeholder="–"
    />
  );

  // L'annonce ne dit que ce qui est vrai : le camp désigné porte toujours le
  // score de victoire.
  const annonceVisible =
    annonce && designe !== null && valeur(designe) === String(concours.scoreMax);

  return (
    <>
    <form ref={formRef} className="score-form" onSubmit={submit} onBlur={onBlur}>
      {annonceVisible && designe && (
        <p className="score-annonce" role="status">
          <span>
            <strong>
              {nom(designe)} gagne {concours.scoreMax} contre {nom(autre(designe))}
            </strong>{' '}
            : <span className="score-annonce-perdant">{valeur(autre(designe)) || '__'}</span>
          </span>
          <button
            type="button"
            className="btn btn-ghost btn-sm score-gagne"
            onClick={() => designerVainqueur(autre(designe))}
          >
            Non, {nom(autre(designe))} a gagné
          </button>
        </p>
      )}
      {/* Seulement en saisie neuve : pendant une correction, les deux scores
          sont déjà là et ces boutons les effaceraient. */}
      {a.trim() === '' && b.trim() === '' && (
        <span className="score-vainqueur">{ordreCamps.map(boutonGagne)}</span>
      )}
      {case_(ordreCamps[0])}
      <span className="score-sep">–</span>
      {case_(ordreCamps[1])}
      {/* Bouton de confirmation optionnel (surtout utile sur tablette). */}
      {a.trim() !== '' && b.trim() !== '' && (
        <button
          className="btn btn-primary btn-sm score-valider"
          title="Valider le score"
          aria-label="Valider le score"
        >
          <Check className="ic" aria-hidden />
          {/* Le mot n'apparaît qu'au doigt : au clavier, Entrée suffit. */}
          <span className="score-valider-texte">Valider</span>
        </button>
      )}
      {editing && (
        <span className="score-outils">
          <button
            type="button"
            className="btn btn-sm score-outil"
            onClick={() => void inverser()}
            title="Inverser Résultat : le mauvais camp a été désigné"
            aria-label="Inverser Résultat"
          >
            <RotateCw className="ic" aria-hidden /> Inverser
          </button>
          <button
            type="button"
            className="btn btn-sm score-outil btn-icon-danger"
            onClick={() => void erase()}
            title="Effacer le score"
            aria-label="Effacer le score"
          >
            <Trash2 className="ic" aria-hidden /> Effacer
          </button>
          <button
            type="button"
            className="btn-icon score-outil"
            onClick={fermer}
            title="Annuler la correction"
            aria-label="Annuler la correction"
          >
            <X className="ic" aria-hidden />
          </button>
        </span>
      )}
      {error && <span className="score-error">{error}</span>}
      <button
        type="button"
        className="btn-icon"
        onClick={() => setMenesOuvertes(!menesOuvertes)}
        title="Saisir la partie mène par mène (manuel : « Evolution du Score »)"
        aria-expanded={menesOuvertes}
      >
        ⊕ mènes
      </button>
      {confirmation}
    </form>
    {menesOuvertes && (
      <MenesInline concours={concours} match={match} labelA={labelA} labelB={labelB} />
    )}
    </>
  );
}

/**
 * Saisie mène par mène — les boutons `+` de l'écran « Voir Scores » du manuel,
 * plus l'évolution en clair et une annulation.
 *
 * Replié par défaut : sur le terrain, la table de marque saisit un score final,
 * et n'ouvre ceci que pour suivre une partie en cours ou reconstituer une
 * contestation.
 */
function MenesInline({
  concours,
  match,
  labelA,
  labelB,
}: {
  concours: Concours;
  match: Match;
  labelA?: string;
  labelB?: string;
}) {
  const [points, setPoints] = useState(1);
  const [erreur, setErreur] = useState<string | null>(null);
  const menes = match.menes ?? [];

  const ajouter = async (camp: 'a' | 'b') => {
    setErreur(null);
    try {
      await ajouterMeneAuMatch(concours, match, camp, points);
    } catch (err) {
      setErreur(err instanceof Error ? err.message : 'Mène refusée');
    }
  };

  return (
    <div className="menes-inline">
      <span className="menes-evolution" title="Evolution du Score">
        {evolutionEnTexte(menes)}
      </span>
      <label className="menes-points">
        points
        <select value={points} onChange={(e) => setPoints(Number(e.target.value))}>
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>
      <button type="button" className="btn btn-sm" onClick={() => void ajouter('a')}>
        + {labelA ?? 'A'}
      </button>
      <button type="button" className="btn btn-sm" onClick={() => void ajouter('b')}>
        + {labelB ?? 'B'}
      </button>
      {menes.length > 0 && (
        <button
          type="button"
          className="btn-icon"
          onClick={() => void retirerMeneDuMatch(concours, match)}
          title="Annuler la dernière mène"
        >
          <Undo className="ic" aria-hidden />
        </button>
      )}
      {erreur && <span className="score-error">{erreur}</span>}
    </div>
  );
}
