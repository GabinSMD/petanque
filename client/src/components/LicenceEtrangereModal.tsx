import { useMemo, useState, type FormEvent } from 'react';
import type { LicencieEtranger, Sexe } from '@shared';
import {
  PAYS_LICENCE_ETRANGERE,
  chercherEtrangers,
  joueurDepuisFicheEtrangere,
  nomCompletEtranger,
  nomDuPays,
} from '@shared';
import { deleteLicencieEtranger, saveLicencieEtranger } from '../db/actions';
import { useLicenciesEtrangers } from '../db/hooks';
import { Modal } from './Modal';

interface Props {
  /** Reçoit le joueur à inscrire : nom complet et code pays. */
  onChoisir: (joueur: { name: string; licenceEtrangere: string }) => void;
  onClose: () => void;
}

/**
 * « Création Licence Etrangère : Base Personnelle » (manuel §3.B.1, zone 21).
 *
 * La fenêtre fédérale fait deux choses d'un coup : inscrire un joueur affilié à
 * la fédération de son pays, et **enrichir une base personnelle** pour ne pas le
 * ressaisir au concours suivant. C'est cette seconde moitié qui manquait — un
 * club frontalier ressaisissait les mêmes Suisses chaque année.
 *
 * La recherche reprend ce que décrit le manuel pour le fichier fédéral : taper
 * le début d'un nom et obtenir la liste des fiches qui commencent par là.
 */
export function LicenceEtrangereModal({ onChoisir, onClose }: Props) {
  const base = useLicenciesEtrangers() ?? [];
  const [recherche, setRecherche] = useState('');
  const [licence, setLicence] = useState('');
  const [nom, setNom] = useState('');
  const [prenom, setPrenom] = useState('');
  const [dateNaissance, setDateNaissance] = useState('');
  const [sexe, setSexe] = useState<Sexe | ''>('');
  const [pays, setPays] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);

  const trouvees = useMemo(() => chercherEtrangers(base, recherche), [base, recherche]);

  const inscrire = (fiche: LicencieEtranger): void => {
    const joueur = joueurDepuisFicheEtrangere(fiche);
    onChoisir({ name: joueur.name, licenceEtrangere: joueur.licenceEtrangere! });
    onClose();
  };

  const enregistrer = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    setErreur(null);
    const r = await saveLicencieEtranger({
      licence,
      nom,
      prenom,
      dateNaissance,
      sexe: sexe === '' ? undefined : sexe,
      pays,
    });
    if (!r.ok) {
      setErreur(r.raison);
      return;
    }
    inscrire(r.fiche);
  };

  return (
    <Modal title="Licence étrangère — base personnelle" onClose={onClose}>
      <div className="etrangere-modal">
        <p className="hint">
          Joueur affilié à la fédération de son pays (manuel §3.B.1, zone 21). La fiche est
          conservée sur votre base personnelle : au prochain concours, son nom suffira.
        </p>

        <label>
          Rechercher dans la base personnelle
          <input
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Début du nom, du prénom ou n° de licence"
            autoFocus
          />
        </label>
        {recherche.trim().length > 0 && (
          <ul className="etrangere-resultats">
            {trouvees.length === 0 && <li className="empty-state">Aucune fiche.</li>}
            {trouvees.map((f) => (
              <li key={f.id}>
                <button type="button" className="btn btn-sm" onClick={() => inscrire(f)}>
                  {nomCompletEtranger(f)}
                </button>
                <span className="hint">
                  {nomDuPays(f.pays) ?? f.pays}
                  {f.licence ? ` · ${f.licence}` : ''}
                </span>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  title="Retirer de la base personnelle"
                  onClick={() => void deleteLicencieEtranger(f.id)}
                >
                  🗑
                </button>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={(e) => void enregistrer(e)}>
          <h3>Nouvelle fiche</h3>
          <div className="form-row">
            <label>
              N° de licence
              <input
                value={licence}
                onChange={(e) => setLicence(e.target.value)}
                placeholder="Numéro de sa fédération"
              />
            </label>
            <label>
              Pays de la fédération
              <select value={pays} onChange={(e) => setPays(e.target.value)} required>
                <option value="">À choisir</option>
                {PAYS_LICENCE_ETRANGERE.map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.nom}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="form-row">
            <label>
              Nom
              <input value={nom} onChange={(e) => setNom(e.target.value)} required />
            </label>
            <label>
              Prénom
              <input value={prenom} onChange={(e) => setPrenom(e.target.value)} required />
            </label>
          </div>
          <div className="form-row">
            <label>
              Date de naissance
              <input
                value={dateNaissance}
                onChange={(e) => setDateNaissance(e.target.value)}
                placeholder="JJ/MM/AAAA"
              />
            </label>
            <label>
              Sexe
              <select value={sexe} onChange={(e) => setSexe(e.target.value as Sexe | '')}>
                <option value="">Non précisé</option>
                <option value="M">Masculin</option>
                <option value="F">Féminin</option>
              </select>
            </label>
          </div>
          {erreur && <p className="form-error">{erreur}</p>}
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Annuler
            </button>
            <button type="submit" className="btn btn-primary">
              Enregistrer dans la base perso
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
