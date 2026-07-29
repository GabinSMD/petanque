import { useEffect, useState } from 'react';
import { messageProtection } from '@shared';
import { useProtectionOrg } from '../db/hooks';
import { purgerDonneesAutreCompte } from '../sync/engine';
import { listByConcours, getEntity } from '../db/repo';
import { exportBackupJSON } from '../lib/export';
import { Modal } from './Modal';

/**
 * Données non envoyées d'un autre compte : on ne les efface pas en silence.
 *
 * La base locale appartient à une organisation, et en changer purge — c'est la
 * bonne règle. Mais ce qui n'a jamais été poussé n'est sur aucun serveur : le
 * concours saisi au boulodrome sans réseau disparaissait sans un mot. La
 * synchronisation est donc suspendue, et le choix revient à l'organisateur :
 * sauvegarder d'abord, puis effacer.
 *
 * L'attente est visible et bloquante à dessein — la synchronisation du nouveau
 * compte ne reprend qu'une fois tranché. Un avertissement qu'on peut ignorer
 * indéfiniment finirait par être ignoré, et c'est justement le cas où l'oubli
 * coûte des données.
 *
 * Le panneau est ouvert par le badge de synchronisation : l'état « en attente
 * d'un choix » est celui de la synchronisation, et deux pastilles voisines
 * disant la même chose se seraient annulées.
 */
export function PanneauAutreCompte({ onClose }: { onClose: () => void }) {
  const bilan = useProtectionOrg();
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  /**
   * Noms des concours concernés. « 5 modifications » sans nom ne dit pas quoi
   * sauvegarder ; le moteur ne connaît que les identifiants, l'écran va
   * chercher le reste.
   */
  const [noms, setNoms] = useState<Record<string, string>>({});
  const ids = (bilan?.parConcours ?? []).map((x) => x.concoursId).join(',');

  useEffect(() => {
    if (!ids) return;
    let vivant = true;
    void (async () => {
      const trouves: Record<string, string> = {};
      for (const id of ids.split(',')) {
        const concours = await getEntity('concours', id);
        if (concours) trouves[id] = concours.name;
      }
      if (vivant) setNoms(trouves);
    })();
    return () => {
      vivant = false;
    };
  }, [ids]);

  if (!bilan) return null;

  const sauvegarder = async (concoursId: string): Promise<void> => {
    setErreur(null);
    const concours = await getEntity('concours', concoursId);
    if (!concours) {
      // Des modifications rattachées à un concours qu'on n'a plus : le fichier
      // serait vide, autant le dire que produire une sauvegarde trompeuse.
      setErreur(
        'Ce concours n\'est plus sur cet appareil : ses modifications en attente ne peuvent pas être sauvegardées.',
      );
      return;
    }
    exportBackupJSON(
      concours,
      await listByConcours('team', concoursId),
      await listByConcours('poule', concoursId),
      await listByConcours('match', concoursId),
    );
  };

  const effacer = async (): Promise<void> => {
    setBusy(true);
    try {
      await purgerDonneesAutreCompte();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Données d'un autre compte sur cet appareil" onClose={onClose}>
      <p>{messageProtection(bilan)}</p>
      <p className="hint">La synchronisation de votre compte reprendra une fois ce choix fait.</p>
      {bilan.parConcours.length > 0 && (
        <ul className="liste-protege">
          {bilan.parConcours.map(({ concoursId, nb }) => (
            <li key={concoursId}>
              <span>
                <strong>{noms[concoursId] ?? 'Concours retiré de cet appareil'}</strong> — {nb}{' '}
                modification{nb > 1 ? 's' : ''}
              </span>
              <button className="btn btn-sm btn-ghost" onClick={() => void sauvegarder(concoursId)}>
                💾 Sauvegarder ce concours
              </button>
            </li>
          ))}
        </ul>
      )}
      {erreur && <p className="form-error">{erreur}</p>}
      <div className="form-actions">
        <button className="btn btn-danger" disabled={busy} onClick={() => void effacer()}>
          🗑 Effacer et utiliser mon compte
        </button>
        <button className="btn btn-ghost" onClick={onClose}>
          Plus tard
        </button>
      </div>
    </Modal>
  );
}
