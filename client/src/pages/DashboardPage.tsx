import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  archiverConcours,
  createConcours,
  deleteConcours,
  desarchiverConcours,
} from '../db/actions';
import { db } from '../db/local';
import { useConcoursList, useNiveauInterfaceActif } from '../db/hooks';
import { ClubModal } from '../components/ClubModal';
import { ReglagesModal } from '../components/ReglagesModal';
import { CreateConcoursWizard } from '../components/CreateConcoursWizard';
import { ImportSauvegarde } from '../components/ImportSauvegarde';
import { Modal } from '../components/Modal';
import {
  AssistantConfiguration,
  isConfigurationFaite,
} from '../components/AssistantConfiguration';
import { annoncerNouveautes } from '../help/nouveautesState';
import { useSession } from '../db/hooks';
import {
  FORMAT_LABELS,
  LIBELLE_NIVEAU,
  MODE_INFO,
  MODE_LABELS,
  dateLongFr,
  entrantWord,
  formatDateFr,
  isTirMode,
  statusLabel,
} from '../lib/labels';
import type { Concours } from '@shared';
import { designationCategorie, montrer, partitionArchives } from '@shared';

function useTeamCounts(): Map<string, number> {
  return (
    useLiveQuery(async () => {
      const rows = await db.entities.where('type').equals('team').toArray();
      const counts = new Map<string, number>();
      for (const r of rows) {
        if (r.deleted === 1) continue;
        counts.set(r.concoursId, (counts.get(r.concoursId) ?? 0) + 1);
      }
      return counts;
    }, []) ?? new Map()
  );
}

export function DashboardPage() {
  const navigate = useNavigate();
  const concoursList = useConcoursList();
  const teamCounts = useTeamCounts();
  const [creating, setCreating] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const [club, setClub] = useState(false);
  const [reglages, setReglages] = useState(false);
  // Niveau d'interface : masque ce dont un concours de club n'a que faire.
  const niveau = useNiveauInterfaceActif();

  // Raccourci PWA « Nouveau concours » (?nouveau=1) : ouvre l'assistant.
  useEffect(() => {
    if (searchParams.get('nouveau') !== null) {
      setCreating(true);
      searchParams.delete('nouveau');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);
  // Première ouverture : l'assistant de configuration, avant tout le reste.
  const [assistant, setAssistant] = useState(() => !isConfigurationFaite());

  // Nouveautés après une mise à jour automatique. Annoncées ici et nulle part
  // ailleurs : sur un concours, la pop-up couperait un tirage ou une saisie —
  // elle attendra le prochain passage par le tableau de bord.
  useEffect(() => {
    // À la première ouverture, l'assistant de configuration occupe déjà
    // l'écran : les nouveautés ne doivent pas s'empiler par-dessus.
    annoncerNouveautes(!isConfigurationFaite());
  }, []);

  const [categoryFilter, setCategoryFilter] = useState<string>('');
  /** Vue « archivés » (manuel §3.F.3) : les concours rangés, hors de la liste courante. */
  const [voirArchives, setVoirArchives] = useState(false);
  const session = useSession();

  const { courants, archives } = partitionArchives(concoursList ?? []);
  const visibles = voirArchives ? archives : courants;

  const categories = [
    ...new Set(
      visibles.map((c) => designationCategorie(c)).filter((c): c is string => Boolean(c)),
    ),
  ].sort((a, b) => a.localeCompare(b, 'fr'));

  const filtered = visibles.filter(
    (c) => !categoryFilter || designationCategorie(c) === categoryFilter,
  );

  // Regroupement par journée (date), déjà triées du plus récent au plus ancien.
  const byDate = new Map<string, typeof filtered>();
  for (const c of filtered) {
    byDate.set(c.date, [...(byDate.get(c.date) ?? []), c]);
  }

  const remove = async (id: string, name: string) => {
    if (window.confirm(`Supprimer le concours « ${name} » et toutes ses données ?`)) {
      await deleteConcours(id);
    }
  };

  /**
   * Ranger un concours ne perd rien, donc pas de confirmation — sauf s'il est
   * encore en cours : le faire disparaître de la liste pendant qu'on y joue
   * mérite une question.
   */
  const ranger = async (c: Concours) => {
    if (
      c.status !== 'termine' &&
      !window.confirm(
        `« ${c.name} » n'est pas terminé. L'archiver le sort de la liste courante — rien n'est perdu, il reste dans les archives. Continuer ?`,
      )
    ) {
      return;
    }
    await archiverConcours(c);
  };

  return (
    <div className="page">
      <div className="page-head">
        <h1>Mes concours</h1>
        <span className="page-head-actions">
          {!session?.guest && (
            <button className="btn btn-sm" onClick={() => setClub(true)}>
              👥 Mon club
            </button>
          )}
          {montrer('licencies', { niveau }) && (
            <Link className="btn btn-sm" to="/licencies">
              📇 Licenciés
            </Link>
          )}
          <Link className="btn btn-sm" to="/palmares">
            🏆 Palmarès
          </Link>
          {montrer('championnatClubs', { niveau }) && (
            <Link
              className="btn btn-sm"
              to="/championnat-clubs"
              title="Contrôle des compositions et feuille de rencontre"
            >
              🏅 Championnat des clubs
            </Link>
          )}
          <ImportSauvegarde />
          {/* Le bouton porte le niveau courant : c'est la porte de sortie
              visible, la réponse à « où est passé X » en un clic. */}
          <button
            className="btn btn-sm"
            title="Réglages et niveau d'interface"
            onClick={() => setReglages(true)}
          >
            ⚙ {LIBELLE_NIVEAU[niveau]}
          </button>
          <button
            className="btn btn-primary"
            data-tour="new-concours"
            onClick={() => setCreating(true)}
          >
            + Nouveau concours
          </button>
        </span>
      </div>

      {concoursList && concoursList.length === 0 && (
        <div className="empty-state">
          <p>Aucun concours pour le moment.</p>
          <p>
            Créez votre premier concours : inscriptions, tirage des poules, tableaux et
            résultats — le tout utilisable même sans connexion.
          </p>
        </div>
      )}

      {/* Liste non vide mais rien à montrer : il faut dire pourquoi, et où aller. */}
      {filtered.length === 0 && (concoursList?.length ?? 0) > 0 && (
        <div className="empty-state">
          {voirArchives ? (
            <p>Aucun concours archivé.</p>
          ) : (
            <>
              <p>
                Tous vos concours sont archivés — rien n'est perdu, ils sont rangés.
              </p>
              <p>
                <button className="btn-lien" onClick={() => setVoirArchives(true)}>
                  {archives.length > 1
                    ? `Voir les ${archives.length} concours archivés`
                    : 'Voir le concours archivé'}
                </button>
              </p>
            </>
          )}
        </div>
      )}

      {(archives.length > 0 || voirArchives) && (
        <div className="category-filter no-print">
          <button
            className={`chip-filter${voirArchives ? '' : ' active'}`}
            onClick={() => {
              setVoirArchives(false);
              setCategoryFilter('');
            }}
          >
            Courants ({courants.length})
          </button>
          <button
            className={`chip-filter${voirArchives ? ' active' : ''}`}
            onClick={() => {
              setVoirArchives(true);
              setCategoryFilter('');
            }}
          >
            🗄 Archivés ({archives.length})
          </button>
        </div>
      )}

      {categories.length > 0 && (
        <div className="category-filter no-print">
          <button
            className={`chip-filter${categoryFilter === '' ? ' active' : ''}`}
            onClick={() => setCategoryFilter('')}
          >
            Toutes
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              className={`chip-filter${categoryFilter === cat ? ' active' : ''}`}
              onClick={() => setCategoryFilter(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {[...byDate.entries()].map(([date, list]) => (
        <section key={date} className="journee">
          <h2 className="journee-head">
            {dateLongFr(date)}
            <span className="journee-count">
              {list.length} concours{list.length > 1 ? '' : ''}
            </span>
          </h2>
          <div className="card-grid">
            {list.map((c) => (
              <div
                key={c.id}
                className="concours-card"
                onClick={() => navigate(`/concours/${c.id}`)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && navigate(`/concours/${c.id}`)}
              >
                <div className="concours-card-head">
                  <span className={`status-chip status-${c.status}`}>
                    {statusLabel(c.mode, c.status)}
                  </span>
                  <span className="concours-card-actions no-print">
                    {voirArchives ? (
                      <button
                        className="btn-icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          void desarchiverConcours(c);
                        }}
                        title="Remettre dans les concours courants"
                      >
                        ↩
                      </button>
                    ) : (
                      <button
                        className="btn-icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          void ranger(c);
                        }}
                        title="Archiver : sortir de la liste courante sans rien supprimer"
                      >
                        🗄
                      </button>
                    )}
                    <button
                      className="btn-icon btn-icon-danger"
                      onClick={(e) => {
                        e.stopPropagation();
                        void remove(c.id, c.name);
                      }}
                      title="Supprimer"
                    >
                      🗑
                    </button>
                  </span>
                </div>
                <h2>{c.name}</h2>
                <p className="concours-card-meta">
                  {formatDateFr(c.date)}
                  {c.lieu ? ` · ${c.lieu}` : ''}
                </p>
                <p className="concours-card-tags">
                  {designationCategorie(c) && (
                    <span className="tag tag-cat">{designationCategorie(c)}</span>
                  )}
                  {!isTirMode(c.mode) && <span className="tag">{FORMAT_LABELS[c.format]}</span>}
                  <span className="tag">
                    {MODE_INFO[c.mode].emoji} {MODE_LABELS[c.mode]}
                  </span>
                  {c.consolante && <span className="tag">Consolante</span>}
                </p>
                <p className="concours-card-count">
                  {teamCounts.get(c.id) ?? 0}{' '}
                  {entrantWord(c.mode, (teamCounts.get(c.id) ?? 0) > 1)}
                </p>
              </div>
            ))}
          </div>
        </section>
      ))}

      {creating && (
        <Modal title="Nouveau concours" onClose={() => setCreating(false)}>
          <CreateConcoursWizard
            onCancel={() => setCreating(false)}
            onSubmit={async (input) => {
              const id = await createConcours(input);
              setCreating(false);
              navigate(`/concours/${id}`);
            }}
          />
        </Modal>
      )}

      {club && <ClubModal onClose={() => setClub(false)} />}
      {reglages && <ReglagesModal onClose={() => setReglages(false)} />}
      {assistant && <AssistantConfiguration onClose={() => setAssistant(false)} />}
    </div>
  );
}
