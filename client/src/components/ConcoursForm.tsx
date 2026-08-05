import { useState, type FormEvent } from 'react';
import type {
  CategorieAge,
  NiveauConcours,
  Concours,
  ConcoursMode,
  CritereClassification,
  CritereSexe,
  Discipline,
  Formule,
  TeamFormat,
} from '@shared';
import {
  CATEGORIES_AGE_CONCOURS,
  JEUX_FEDERAUX,
  bornesParties,
  categorieDuDessous,
  championnatsDuJeu,
  NIVEAUX_FEDERAUX,
  codeNiveauFederal,
  estNiveauChampionnat,
  nomDepuisNumero,
  numeroConcoursFederal,
  segmentCategorie,
  designationCategorie,
  estConcoursOfficiel,
  formuleOf,
  jeuDuConcours,
  jeuFederal,
  montrer,
  nomConcoursFederal,
  parametresCDF,
  type JeuFederal,
  type ParametresCDF,
} from '@shared';
import type { ConcoursInput } from '../db/actions';
import { useLicencies, useNiveauInterfaceActif } from '../db/hooks';
import {
  CATEGORIE_AGE_LABELS,
  CATEGORY_SUGGESTIONS,
  CRITERE_CLASSIFICATION_LABELS,
  CRITERE_SEXE_LABELS,
  NIVEAU_LABELS,
  FORMULE_CHOICES,
  FORMULE_HINTS,
  FORMULE_LABELS,
  DISCIPLINE_LABELS,
  FORMAT_LABELS,
  MODE_INFO,
  MODE_LABELS,
  isRondesMode,
  isTirMode,
} from '../lib/labels';

interface Props {
  initial?: Concours;
  onSubmit: (input: ConcoursInput) => void | Promise<void>;
  onCancel: () => void;
  /** Après tirage, la formule et la formation ne sont plus modifiables. */
  lockStructure?: boolean;
}

export function ConcoursForm({ initial, onSubmit, onCancel, lockStructure }: Props) {
  const today = new Date().toISOString().slice(0, 10);
  // Suggestions puisées dans le fichier des licenciés déjà importé.
  const licencies = useLicencies() ?? [];
  const comites = [...new Set(licencies.map((l) => l.comite).filter(Boolean))].sort() as string[];
  const clubs = [...new Set(licencies.map((l) => l.club).filter(Boolean))].sort() as string[];
  const [name, setName] = useState(initial?.name ?? '');
  const [date, setDate] = useState(initial?.date ?? today);
  const [lieu, setLieu] = useState(initial?.lieu ?? '');
  const [format, setFormat] = useState<TeamFormat>(initial?.format ?? 'doublette');
  const [mode, setMode] = useState<ConcoursMode>(initial?.mode ?? 'poules');
  const [category, setCategory] = useState(initial?.category ?? '');
  const [discipline, setDiscipline] = useState<Discipline>(initial?.discipline ?? 'petanque');
  const [consolante, setConsolante] = useState(initial?.consolante ?? true);
  const [complementaire, setComplementaire] = useState(initial?.complementaire ?? false);
  const [recupCadrage, setRecupCadrage] = useState(initial?.recupCadrage ?? false);
  const [parGroupes, setParGroupes] = useState(initial?.parGroupes ?? false);
  const [vainqueurSeul, setVainqueurSeul] = useState(initial?.vainqueurSeul ?? false);
  const [formule, setFormule] = useState<Formule>(initial ? formuleOf(initial) : 'ab');
  const [niveau, setNiveau] = useState<NiveauConcours | ''>(initial?.niveau ?? '');
  /**
   * « Choix CDF » (manuel §3.A) : le championnat choisi impose ses paramètres.
   * Le code n'est pas enregistré — ce sont les paramètres qui comptent, et les
   * lire ailleurs qu'à leur place les ferait diverger.
   */
  const [codeCDF, setCodeCDF] = useState('');
  /**
   * « Jeu » (manuel §3.A) : le type de championnat. Il commande la liste des
   * championnats proposés, et pour PROMOTION comme pour VETERANS il impose
   * directement les critères — ces deux-là n'ont pas de liste. Pas plus
   * enregistré que le code CDF : il se relit du concours.
   */
  const [jeu, setJeu] = useState<JeuFederal>(initial ? jeuDuConcours(initial) : 'petanque');
  const [comiteOrganisateur, setComiteOrganisateur] = useState(initial?.comiteOrganisateur ?? '');
  const [clubOrganisateur, setClubOrganisateur] = useState(initial?.clubOrganisateur ?? '');
  /**
   * Codes du numéro de concours fédéral (§3.A). Ils s'ajoutent aux noms
   * ci-dessus : les documents du comité portent les noms, le numéro porte les
   * codes. Sans eux, `numeroConcoursFederal` ne peut rien construire — c'est la
   * raison pour laquelle elle n'était appelée par aucun écran.
   */
  const [comiteNumero, setComiteNumero] = useState(initial?.comiteNumero ?? '');
  const [clubNumero, setClubNumero] = useState(initial?.clubNumero ?? '');
  const [segmentFederal, setSegmentFederal] = useState(initial?.segmentFederal ?? '');
  const [decalageEquipe, setDecalageEquipe] = useState<number | ''>(initial?.decalageEquipe ?? '');
  const [decalageTerrain, setDecalageTerrain] = useState<number | ''>(
    initial?.decalageTerrain ?? '',
  );
  const [categorieAge, setCategorieAge] = useState<CategorieAge | ''>(initial?.categorieAge ?? '');
  const [strict, setStrict] = useState(initial?.strict ?? false);
  const [critereSexe, setCritereSexe] = useState<CritereSexe>(initial?.critereSexe ?? 'tous');
  const [critereClassification, setCritereClassification] = useState<CritereClassification>(
    initial?.critereClassification ?? 'tous',
  );
  const [homogene, setHomogene] = useState(initial?.homogene ?? false);
  const [officiel, setOfficiel] = useState(
    initial ? estConcoursOfficiel(initial) : false,
  );
  const [nbQualifies, setNbQualifies] = useState<number | ''>(initial?.nbQualifies ?? '');
  const [miseParEquipe, setMiseParEquipe] = useState<number | ''>(initial?.miseParEquipe ?? '');
  const [scoreMax, setScoreMax] = useState(initial?.scoreMax ?? 13);
  const [nbTerrains, setNbTerrains] = useState(initial?.nbTerrains ?? 8);
  const [planTerrains, setPlanTerrains] = useState(initial?.planTerrains ?? true);
  const [nbRondes, setNbRondes] = useState(initial?.nbRondes ?? 4);
  // Marathon : un championnat tronqué à N rondes. Vide = calendrier complet.
  const [marathonRondes, setMarathonRondes] = useState<number | ''>(
    initial?.mode === 'championnat' ? (initial.nbRondes ?? '') : '',
  );
  const [ggStrict, setGgStrict] = useState(initial?.ggStrict ?? false);
  const [tempsLimite, setTempsLimite] = useState<number | ''>(initial?.tempsLimite ?? '');

  // `niveauInterface` et non `niveau` : ce dernier est déjà le niveau fédéral du
  // concours en cours de saisie, et ce sont deux choses sans rapport.
  const niveauInterface = useNiveauInterfaceActif();
  // Sur un concours fédéral, la catégorie découle des critères normalisés
  // (sexe, âge, classification) — le texte libre ne s'y substitue plus (#33).
  const critereFederalPose =
    officiel &&
    (categorieAge !== '' || critereSexe !== 'tous' || critereClassification !== 'tous');
  const libelleFederal = designationCategorie({
    categorieAge: categorieAge || undefined,
    critereSexe,
    critereClassification,
  });

  /** Pose les critères d'un championnat — ceux du CDF ou ceux du jeu. */
  const appliquerParametres = (p: ParametresCDF): void => {
    setFormat(p.format);
    setCategorieAge(p.categorieAge);
    setStrict(p.strict);
    setCritereSexe(p.critereSexe);
    setCritereClassification(p.critereClassification);
    setHomogene(p.homogene);
  };

  /** Applique le championnat choisi aux quatre critères qu'il fixe. */
  const appliquerCDF = (code: string): void => {
    setCodeCDF(code);
    const p = parametresCDF(code);
    if (p) appliquerParametres(p);
  };

  /**
   * Change de jeu : la liste des championnats change avec lui, donc le code
   * choisi ne veut plus rien dire et repart à zéro. PROMOTION et VETERANS
   * imposent leurs critères eux-mêmes, faute de liste.
   */
  const changerJeu = (id: JeuFederal): void => {
    setJeu(id);
    setCodeCDF('');
    if (id === 'provencal') setDiscipline('jeu_provencal');
    else if (discipline === 'jeu_provencal') setDiscipline('petanque');
    const p = jeuFederal(id)?.parametres;
    if (p) appliquerParametres(p);
  };

  const championnatsProposes = championnatsDuJeu(jeu);

  /**
   * Bornes du nombre de parties (§3.D.14) : « 3 à 7 Parties GG », « 3 à 10
   * Parties », « 3 à 5 Parties GG Strict ». Lues du moteur et non écrites ici —
   * une borne recopiée à côté de sa règle finit par la contredire.
   */
  const bornes = bornesParties({ mode, ggStrict });

  /* ------------------------------------------------------------------ */
  /* Numéro de concours fédéral (§3.A)                                   */
  /* ------------------------------------------------------------------ */

  const segmentDeduit = segmentCategorie({
    format,
    categorieAge: categorieAge === '' ? undefined : categorieAge,
    critereSexe,
    critereClassification,
  });
  /** Le segment saisi prime : c'est lui qui rattrape les cas non documentés. */
  const segmentRetenu = segmentFederal.trim() || segmentDeduit || '';
  const codeNiveau = codeNiveauFederal(niveau === '' ? undefined : niveau);
  const numeroFederal = numeroConcoursFederal({
    date,
    codeNiveau: codeNiveau ?? '',
    jeu,
    comiteNumero: comiteNumero.trim() || undefined,
    segment: segmentRetenu,
    clubNumero: clubNumero.trim() || undefined,
  });
  /**
   * Nom de la fenêtre de création fédérale : les codes du numéro, et le club en
   * clair. Contrairement au numéro, il s'affiche **en construction** — les
   * séparateurs des pièces manquantes restent visibles, comme dans le manuel.
   */
  const nomFederalCreation = nomConcoursFederal({
    date,
    codeNiveau: codeNiveau ?? '',
    jeu,
    comiteNumero: comiteNumero.trim() || undefined,
    segment: segmentRetenu,
    clubNom: clubOrganisateur.trim() || undefined,
  });
  /** Ce qui manque, dit dans l'ordre où l'organisateur peut le corriger. */
  const manquePourNumero = [
    // La liste des niveaux à code connu se lit du moteur : l'écrire à la main
    // ici, c'est se condamner à la laisser périmer — ce qui vient d'arriver.
    codeNiveau
      ? ''
      : `un niveau à code fédéral connu (${NIVEAUX_FEDERAUX.filter((n) => codeNiveauFederal(n))
          .map((n) => NIVEAU_LABELS[n].toLowerCase())
          .join(', ')})`,
    comiteNumero.trim() ? '' : 'le code du comité',
    clubNumero.trim() ? '' : 'le numéro du club',
    segmentRetenu ? '' : 'le segment de catégorie',
  ].filter(Boolean);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void onSubmit({
      name: name.trim(),
      date,
      lieu: lieu.trim() || undefined,
      format,
      mode,
      discipline,
      // Un critère fédéral posé ⇒ pas de texte libre concurrent en base (#33).
      category: critereFederalPose ? undefined : category.trim() || undefined,
      nbQualifies: nbQualifies === '' ? undefined : Number(nbQualifies),
      ...(mode === 'elimination_directe'
        ? {
            formule,
            consolante: formule !== 'a',
            complementaire: formule === 'abc' || formule === 'abc_recup' || formule === 'abc_cd19',
          }
        : {
            // Formule par groupes : le concours B n'est pas une consolante, et il
            // n'y a pas de repêchage — la donnée doit le dire.
            consolante: parGroupes ? false : MODE_INFO[mode].consolante ? consolante : false,
            complementaire: MODE_INFO[mode].consolante && consolante ? complementaire : false,
            recupCadrage:
              mode === 'poules' && consolante && recupCadrage && !parGroupes ? true : undefined,
            parGroupes: mode === 'poules' && parGroupes ? true : undefined,
          }),
      scoreMax,
      nbTerrains,
      planTerrains,
      nbRondes:
        mode === 'championnat'
          ? marathonRondes === ''
            ? undefined
            : Number(marathonRondes)
          : isRondesMode(mode)
            ? nbRondes
            : undefined,
      ggStrict: mode === 'suisse' && ggStrict ? true : undefined,
      tempsLimite: tempsLimite === '' ? undefined : Number(tempsLimite),
      // En rondes, le classement se fait au goal-average : le score est requis.
      vainqueurSeul: !isRondesMode(mode) && !isTirMode(mode) && vainqueurSeul ? true : undefined,
      miseParEquipe: miseParEquipe === '' ? undefined : Number(miseParEquipe),
      niveau: officiel && niveau !== '' ? niveau : undefined,
      comiteOrganisateur: officiel ? comiteOrganisateur.trim() || undefined : undefined,
      clubOrganisateur: officiel ? clubOrganisateur.trim() || undefined : undefined,
      comiteNumero: officiel ? comiteNumero.trim() || undefined : undefined,
      clubNumero: officiel ? clubNumero.trim() || undefined : undefined,
      // Le segment déduit n'est pas enregistré : il se recalcule des critères,
      // et une copie divergerait le jour où l'un d'eux change. Seule une saisie
      // manuelle mérite d'être gardée.
      segmentFederal: officiel ? segmentFederal.trim() || undefined : undefined,
      decalageEquipe: decalageEquipe === '' || decalageEquipe === 0 ? undefined : Number(decalageEquipe),
      decalageTerrain:
        decalageTerrain === '' || decalageTerrain === 0 ? undefined : Number(decalageTerrain),
      // Critères de contrôle : rien n'est enregistré si la section est repliée.
      categorieAge: officiel && categorieAge !== '' ? categorieAge : undefined,
      strict: officiel && categorieAge !== '' ? strict : undefined,
      critereSexe: officiel && critereSexe !== 'tous' ? critereSexe : undefined,
      critereClassification:
        officiel && critereClassification !== 'tous' ? critereClassification : undefined,
      homogene: officiel && homogene ? true : undefined,
    });
  };

  return (
    <form className="concours-form" onSubmit={submit}>
      <label>
        Nom du concours
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Concours du club — doublettes"
          required
          minLength={2}
        />
      </label>
      <div className="form-row">
        <label>
          Date
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </label>
        <label>
          Lieu
          <input
            value={lieu}
            onChange={(e) => setLieu(e.target.value)}
            placeholder="Boulodrome municipal"
          />
        </label>
      </div>
      <div className="form-row">
        <label>
          Discipline
          <select
            value={discipline}
            onChange={(e) => setDiscipline(e.target.value as Discipline)}
            disabled={lockStructure}
          >
            {Object.entries(DISCIPLINE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Catégorie
          {critereFederalPose ? (
            <>
              <input value={libelleFederal ?? ''} readOnly disabled />
              <span className="hint">Dérivée des critères fédéraux.</span>
            </>
          ) : (
            <>
              <input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Seniors, Vétérans, Féminines…"
                list="form-categories"
              />
              <datalist id="form-categories">
                {CATEGORY_SUGGESTIONS.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </>
          )}
        </label>
      </div>
      <div className="form-row">
        <label>
          Formation
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value as TeamFormat)}
            disabled={lockStructure}
          >
            {Object.entries(FORMAT_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Formule
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as ConcoursMode)}
            disabled={lockStructure}
          >
            {Object.entries(MODE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="form-row">
        <label>
          Terrains disponibles
          <input
            type="number"
            min={1}
            max={200}
            value={nbTerrains}
            onChange={(e) => setNbTerrains(Number(e.target.value))}
          />
        </label>
        <label>
          Parties en
          <input
            type="number"
            min={7}
            max={21}
            value={scoreMax}
            onChange={(e) => setScoreMax(Number(e.target.value))}
          />
        </label>
      </div>
      <div className="form-row">
        {((isRondesMode(mode) && mode !== 'championnat') || isTirMode(mode)) && (
          <label>
            {isTirMode(mode) ? 'Nombre de séries' : 'Nombre de rondes'}
            <input
              type="number"
              min={bornes?.min ?? 1}
              max={bornes?.max ?? 12}
              value={nbRondes}
              onChange={(e) => setNbRondes(Number(e.target.value))}
            />
            {bornes && (
              <span className="hint">
                De {bornes.min} à {bornes.max} parties
                {ggStrict
                  ? " : au-delà, l'appariement strict n'a plus d'équipes à égalité à opposer."
                  : ' (manuel §3.D.14).'}
              </span>
            )}
          </label>
        )}
        {mode === 'championnat' && (
          <label>
            Rondes du marathon (facultatif)
            <input
              type="number"
              min={bornes?.min ?? 1}
              max={bornes?.max ?? 20}
              value={marathonRondes}
              placeholder="calendrier complet"
              onChange={(e) =>
                setMarathonRondes(e.target.value === '' ? '' : Number(e.target.value))
              }
            />
            <small>
              Vide : chacun rencontre chacun.
              {bornes && ` Sinon de ${bornes.min} à ${bornes.max} parties (manuel §3.D.14).`}
            </small>
          </label>
        )}
        {!isTirMode(mode) && (
          <label>
            Temps limité (min, facultatif)
            <input
              type="number"
              min={15}
              max={180}
              value={tempsLimite}
              placeholder="—"
              onChange={(e) =>
                setTempsLimite(e.target.value === '' ? '' : Number(e.target.value))
              }
            />
          </label>
        )}
      </div>
      <div className="form-row">
        <label>
          Mise par équipe (€, facultatif)
          <input
            type="number"
            min={0}
            max={1000}
            step={0.5}
            value={miseParEquipe}
            placeholder="—"
            onChange={(e) =>
              setMiseParEquipe(e.target.value === '' ? '' : Number(e.target.value))
            }
          />
        </label>
        {!isRondesMode(mode) && !isTirMode(mode) && (
          <label>
            Concours qualificatif : nombre de qualifiés
            <select
              value={nbQualifies}
              onChange={(e) =>
                setNbQualifies(e.target.value === '' ? '' : Number(e.target.value))
              }
            >
              <option value="">Non — jouer jusqu'au vainqueur</option>
              {[2, 4, 8, 16, 32, 64].map((n) => (
                <option key={n} value={n}>
                  {n} équipes qualifiées
                </option>
              ))}
            </select>
            <span className="hint">
              Le tableau s'arrête dès que ce nombre est atteint, et la liste des qualifiés
              s'exporte pour la phase finale. Puissances de deux uniquement : un autre nombre
              demanderait un tour partiel que l'application ne construit pas encore.
            </span>
          </label>
        )}
      </div>
      {mode === 'elimination_directe' && (
        <label>
          Tableaux et repêchages
          <select
            value={formule}
            onChange={(e) => setFormule(e.target.value as Formule)}
            disabled={lockStructure}
          >
            {FORMULE_CHOICES.map((f) => (
              <option key={f} value={f}>
                {FORMULE_LABELS[f]}
              </option>
            ))}
          </select>
          <span className="hint">{FORMULE_HINTS[formule]}</span>
        </label>
      )}
      {mode === 'poules' && (
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={parGroupes}
            onChange={(e) => setParGroupes(e.target.checked)}
            disabled={lockStructure}
          />
          Formule par groupes A-B-C (manuel §3.D.5) : tout le monde continue
          <span className="hint">
            Groupes de 4 sans barrage. L'équipe à 2 victoires va au concours A, les deux à 1 victoire
            au B, celle à 2 défaites au C — personne ne rentre après deux parties.
          </span>
        </label>
      )}
      {mode === 'suisse' && (
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={ggStrict}
            onChange={(e) => {
              setGgStrict(e.target.checked);
              // Le strict plafonne à cinq parties : sept rondes déjà saisies
              // deviendraient hors borne sans que rien ne le dise.
              const nouvelles = bornesParties({ mode, ggStrict: e.target.checked });
              if (nouvelles && nbRondes > nouvelles.max) setNbRondes(nouvelles.max);
            }}
          />
          Gagnant contre gagnant strict (manuel §3.D.14.C)
          <span className="hint">
            N'oppose que des équipes à égalité stricte de victoires. Un groupe impair laisse une
            équipe exempte, créditée d'un 13-7 comme un forfait. Sans l'option, l'appariement suit
            le classement et un gagnant peut rencontrer un perdant.
          </span>
        </label>
      )}
      {mode !== 'elimination_directe' && MODE_INFO[mode].consolante && !parGroupes && (
        <>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={consolante}
              onChange={(e) => setConsolante(e.target.checked)}
              disabled={lockStructure}
            />
            Consolante (repêchage des éliminés)
          </label>
          {consolante && (
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={complementaire}
                onChange={(e) => setComplementaire(e.target.checked)}
                disabled={lockStructure}
              />
              Complémentaire (2ᵉ repêchage : perdants de la consolante)
            </label>
          )}
          {consolante && mode === 'poules' && (
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={recupCadrage}
                onChange={(e) => setRecupCadrage(e.target.checked)}
                disabled={lockStructure}
              />
              Repêchage au cadrage : les perdants du 1<sup>er</sup> tour du tableau rejoignent la
              2ᵉ partie de la consolante
            </label>
          )}
        </>
      )}
      {!isTirMode(mode) && (
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={planTerrains}
            onChange={(e) => setPlanTerrains(e.target.checked)}
          />
          Onglet « Plan des terrains » (décochez si vous gérez les terrains dans les poules)
        </label>
      )}
      {/* En dessous du niveau fédéral, la partie officielle est masquée — sauf
          si ce concours est déjà officiel : on ne cache pas une règle en
          vigueur. Le `|| officiel` est indispensable en plus de la clause de
          sûreté de `montrer` : celle-ci lit le concours enregistré, alors que
          cocher la case doit ouvrir le bloc sur-le-champ. */}
      {(montrer('criteresOfficiels', { niveau: niveauInterface, concours: initial }) ||
        officiel) && (
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={officiel}
            onChange={(e) => setOfficiel(e.target.checked)}
          />
          Concours officiel : contrôler les licences
        </label>
      )}
      {officiel && (
        <fieldset className="form-fieldset">
          <legend>Organisateur et niveau</legend>
          <p className="hint">
            Ces informations figurent en tête des documents remis au comité (feuille
            d'arbitrage, résultats presse).
          </p>
          <div className="form-row">
            <label>
              Jeu
              <select value={jeu} onChange={(e) => changerJeu(e.target.value as JeuFederal)}>
                {JEUX_FEDERAUX.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.label}
                  </option>
                ))}
              </select>
              <small>
                Type de championnat, comme dans la fenêtre fédérale : il commande la liste des
                championnats, et pour Promotion et Vétérans il pose lui-même les critères.
              </small>
            </label>
            <label>
              Niveau
              <select
                value={niveau}
                onChange={(e) => setNiveau(e.target.value as NiveauConcours | '')}
              >
                <option value="">Non précisé</option>
                {/* Les huit niveaux de la liste fédérale, dans son ordre, puis
                    les deux qui sont à nous. L'ancien « championnat » fourre-tout
                    n'est plus proposé — il reste affiché sur les concours qui le
                    portent déjà, pour ne pas leur changer leur niveau dans le
                    dos. */}
                {[
                  ...NIVEAUX_FEDERAUX,
                  'club' as const,
                  'coupe_de_france' as const,
                  ...(niveau === 'championnat' ? (['championnat'] as const) : []),
                ].map((value) => (
                  <option key={value} value={value}>
                    {NIVEAU_LABELS[value]}
                  </option>
                ))}
              </select>
            </label>
            {/* « Choix CDF » n'apparaît que si le jeu a une liste : sur les
                copies d'écran PROMOTION et VETERANS, la ligne disparaît de la
                fenêtre — elle n'est pas grisée. */}
            {estNiveauChampionnat(niveau === '' ? undefined : niveau) && championnatsProposes.length > 0 && (
              <label>
                Choix CDF
                <select
                  value={codeCDF}
                  onChange={(e) => appliquerCDF(e.target.value)}
                >
                  <option value="">Non précisé</option>
                  {championnatsProposes.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code}-{c.label}
                    </option>
                  ))}
                </select>
                <small>
                  Renseigne d'un coup la formation, la catégorie stricte, le genre et
                  l'homogénéité — un paramétrage de championnat ne se corrige pas après le tirage.
                </small>
              </label>
            )}
            {estNiveauChampionnat(niveau === '' ? undefined : niveau) && championnatsProposes.length === 0 && (
              <p className="hint">
                {jeuFederal(jeu)?.label} n'a pas de liste de championnats : les critères sont
                imposés par le jeu lui-même.
              </p>
            )}
            <label>
              Comité organisateur
              <input
                value={comiteOrganisateur}
                onChange={(e) => setComiteOrganisateur(e.target.value)}
                placeholder="CD 38 Isère"
                list="form-comites"
              />
              <datalist id="form-comites">
                {comites.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </label>
          </div>
          <label>
            Club organisateur
            <input
              value={clubOrganisateur}
              onChange={(e) => setClubOrganisateur(e.target.value)}
              placeholder="PC Pierre Sémard"
              list="form-clubs-org"
            />
            <datalist id="form-clubs-org">
              {clubs.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </label>
          <div className="form-row">
            <label>
              Code du comité
              <input
                value={comiteNumero}
                onChange={(e) => setComiteNumero(e.target.value)}
                placeholder="038"
                maxLength={3}
                inputMode="numeric"
              />
            </label>
            <label>
              N° fédéral du club
              <input
                value={clubNumero}
                onChange={(e) => setClubNumero(e.target.value)}
                placeholder="0380423"
                maxLength={10}
                inputMode="numeric"
              />
            </label>
            <label>
              Segment de catégorie
              <input
                value={segmentFederal}
                onChange={(e) => setSegmentFederal(e.target.value)}
                placeholder={segmentDeduit ?? 'à saisir'}
                maxLength={16}
              />
              <span className="hint">
                {segmentDeduit
                  ? `Déduit des critères : ${segmentDeduit}. À corriger si votre comité l'écrit autrement.`
                  : 'Le manuel ne documente pas l\'abréviation de ces critères (féminin, cadet, minime, élite, honneur) : saisissez-la.'}
              </span>
            </label>
          </div>
          {/* Le numéro fédéral, en lecture seule. Rien du tout quand une pièce
              manque : un numéro tronqué n'est reconnu par personne, et c'est ce
              que le comité recoupe. */}
          {/* La fédération appelle « nom » deux chaînes différentes selon
              l'écran : celle de la fenêtre de création (codes + club en clair) et
              celle du bandeau de préparation (le numéro avec des espaces). On
              montre les deux en les nommant, plutôt que d'en élire une. */}
          <p className="hint numero-federal">
            {numeroFederal ? (
              <>
                <strong>Numéro de concours :</strong> <code>{numeroFederal}</code>
                <br />
                Nom de la fenêtre de création : <code>{nomFederalCreation}</code>
                <br />
                Bandeau de préparation : <code>{nomDepuisNumero(numeroFederal)}</code>
              </>
            ) : (
              <>
                Numéro de concours indisponible : il manque {manquePourNumero.join(', ')}.
                <br />
                Nom en construction : <code>{nomFederalCreation}</code>
              </>
            )}
          </p>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() =>
              setName(
                /*
                 * Le nom de la fenêtre de création : les codes du numéro, et le
                 * club **en clair**. Le numéro exige tous ses codes et se refuse
                 * incomplet ; le nom, lui, s'affiche en construction chez la
                 * fédération, séparateurs vides compris — il sert donc aussi
                 * quand il manque une pièce.
                 */
                nomFederalCreation,
              )
            }
            title={
              'Le nom de la fenêtre de création fédérale : les codes du numéro, ' +
              'et le nom du club entre guillemets. Le bandeau de préparation, lui, ' +
              'écrit le numéro avec des espaces — la fédération appelle « nom » les deux.'
            }
          >
            ⤒ Reprendre le nom fédéral
          </button>
        </fieldset>
      )}
      {!isRondesMode(mode) && !isTirMode(mode) && (
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={vainqueurSeul}
            onChange={(e) => setVainqueurSeul(e.target.checked)}
          />
          Saisie rapide : désigner le vainqueur sans noter le score
          <span className="hint">
            Pour un concours ouvert à tous, où le score n'a pas d'enjeu. Le score reste saisissable
            partie par partie.
          </span>
        </label>
      )}
      <details className="form-details">
        <summary>Numérotation — plusieurs concours le même jour</summary>
        <p className="hint">
          Décale les numéros pour qu'il n'y ait jamais deux « équipe 1 » ni deux « terrain 1 »
          à la table de marque. 0 = numérotation normale.
        </p>
        <div className="form-row">
          <label>
            Décalage n° d'équipe
            <input
              type="number"
              min={0}
              max={9000}
              step={100}
              value={decalageEquipe}
              placeholder="0"
              onChange={(e) =>
                setDecalageEquipe(e.target.value === '' ? '' : Number(e.target.value))
              }
            />
            <span className="hint">
              1<sup>re</sup> équipe : n°{(decalageEquipe === '' ? 0 : Number(decalageEquipe)) + 1}
            </span>
          </label>
          <label>
            Décalage n° de terrain
            <input
              type="number"
              min={0}
              max={9000}
              step={50}
              value={decalageTerrain}
              placeholder="0"
              onChange={(e) =>
                setDecalageTerrain(e.target.value === '' ? '' : Number(e.target.value))
              }
            />
            <span className="hint">
              Terrains {(decalageTerrain === '' ? 0 : Number(decalageTerrain)) + 1} à{' '}
              {(decalageTerrain === '' ? 0 : Number(decalageTerrain)) + nbTerrains}
            </span>
          </label>
        </div>
      </details>
      {officiel && (
        <fieldset className="form-fieldset">
          <legend>Critères fédéraux</legend>
          <p className="hint">
            Les équipes inscrites seront confrontées à ces critères, à partir du fichier des
            licenciés importé. Laissez « ouvert à tous » pour ne rien contrôler.
          </p>
          <div className="form-row">
            <label>
              Catégorie d'âge
              <select
                value={categorieAge}
                onChange={(e) => setCategorieAge(e.target.value as CategorieAge | '')}
              >
                <option value="">Toutes catégories</option>
                {/* La liste du concours, pas celle des compétitions de clubs :
                    le « +55 » n'est pas proposé à la création d'un concours. */}
                {CATEGORIES_AGE_CONCOURS.map((value) => (
                  <option key={value} value={value}>
                    {CATEGORIE_AGE_LABELS[value]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Sexe
              <select
                value={critereSexe}
                onChange={(e) => setCritereSexe(e.target.value as CritereSexe)}
              >
                {Object.entries(CRITERE_SEXE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="form-row">
            <label>
              Classification
              <select
                value={critereClassification}
                onChange={(e) =>
                  setCritereClassification(e.target.value as CritereClassification)
                }
              >
                {Object.entries(CRITERE_CLASSIFICATION_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {categorieAge !== '' && (
            <label className="checkbox-label">
              <input type="checkbox" checked={strict} onChange={(e) => setStrict(e.target.checked)} />
              Strict : n'accepter que cette catégorie
              {/* La fenêtre fédérale renomme ses étiquettes quand Strict est
                  décoché — « Sénior (Junior) ». Nos étiquettes portent déjà les
                  bornes d'âge, donc on le dit ici plutôt que d'empiler deux
                  parenthèses. Sans cette phrase, l'écran laisse croire qu'un
                  concours sénior n'accepte que des séniors. */}
              <span className="hint">
                {strict
                  ? 'Seuls les licenciés de cette catégorie sont acceptés.'
                  : categorieDuDessous(categorieAge)
                    ? `Décoché : les ${CATEGORIE_AGE_LABELS[categorieDuDessous(categorieAge)!]
                        .split(' (')[0]
                        ?.toLowerCase()} sont admis aussi — une seule catégorie en dessous, comme dans le logiciel fédéral.`
                    : 'Aucune catégorie ne s\'ouvre en dessous de celle-ci.'}
              </span>
            </label>
          )}
          <label className="checkbox-label">
            <input type="checkbox" checked={homogene} onChange={(e) => setHomogene(e.target.checked)} />
            Équipes homogènes : tous les joueurs du même club
          </label>
        </fieldset>
      )}
      <div className="form-actions">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Annuler
        </button>
        <button className="btn btn-primary">{initial ? 'Enregistrer' : 'Créer le concours'}</button>
      </div>
    </form>
  );
}
