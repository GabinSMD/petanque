import type { BilanAvantTirage } from '@shared';
import { ANOMALIE_EQUIPE_LABELS, ANOMALIE_LABELS } from '../lib/labels';
import { BesoinTerrainsHint } from './BesoinTerrains';
import { FraicheurBase } from './FraicheurBase';
import { Modal } from './Modal';

/**
 * Bilan de validité présenté avant le tirage (manuel §3.B.6).
 *
 * « Le contrôle de validité des inscriptions est effectué systématiquement lors
 * du tirage. » Il ne bloque pas — le manuel non plus : l'organisateur tire
 * quand même s'il le décide, mais il a vu, et pendant que les équipes sont
 * encore là.
 *
 * Le bilan s'imprime : à la table de marque, on part le chercher avec une
 * feuille, pas avec l'écran.
 */
interface Props {
  bilan: BilanAvantTirage;
  /** Identifiant du concours, pour le lien d'impression du bilan. */
  concoursId: string;
  onTirer: () => void;
  onCorriger: () => void;
}

export function BilanTirageModal({ bilan, concoursId, onTirer, onCorriger }: Props) {
  const n = bilan.lignes.length;
  return (
    <Modal title="Contrôle des inscriptions avant tirage" onClose={onCorriger}>
      <p>
        {bilan.conformes} équipe{bilan.conformes > 1 ? 's' : ''} en règle sur {bilan.total}.{' '}
        <strong>
          {n} équipe{n > 1 ? 's' : ''} à rectifier
        </strong>
        {bilan.inconnues > 0
          ? `, dont ${bilan.inconnues} licence${bilan.inconnues > 1 ? 's' : ''} introuvable${
              bilan.inconnues > 1 ? 's' : ''
            } dans le fichier des licenciés.`
          : '.'}
      </p>
      {/* Le rapport fédéral annonce les terrains dans la même fenêtre que le
          contrôle des inscriptions : on fait pareil. */}
      {/* Une base d'une saison révolue explique à elle seule les licences
          « introuvables » annoncées juste au-dessus. */}
      <FraicheurBase compact />
      <BesoinTerrainsHint besoin={bilan.terrains} />
      <ul className="liste-bilan">
        {bilan.lignes.map((ligne) => (
          <li key={ligne.number}>
            <strong>N° {ligne.number}</strong>
            {ligne.anomaliesEquipe.length > 0 && (
              <span className="tag tag-warn">
                {ligne.anomaliesEquipe.map((a) => ANOMALIE_EQUIPE_LABELS[a]).join(', ')}
              </span>
            )}
            <ul>
              {ligne.joueurs.map((j) => (
                <li key={j.name}>
                  {j.name} —{' '}
                  {j.inconnu && j.anomalies.length === 0
                    ? 'licence introuvable dans le fichier'
                    : j.anomalies.map((a) => ANOMALIE_LABELS[a]).join(', ')}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
      <p className="hint">
        Une licence se corrige tant que l'équipe est devant vous. Après le tirage, la composition
        reste modifiable mais pas le dossard (§3.B.8).
      </p>
      <div className="form-actions">
        <a
          className="btn btn-ghost"
          href={`/concours/${concoursId}/imprimer/bilan-licences`}
          target="_blank"
          rel="noreferrer"
        >
          🖨 Imprimer le bilan
        </a>
        <button className="btn btn-ghost" onClick={onCorriger}>
          ← Corriger d'abord
        </button>
        <button className="btn btn-primary" onClick={onTirer}>
          Tirer quand même
        </button>
      </div>
    </Modal>
  );
}
