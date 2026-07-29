import { Component, type ErrorInfo, type ReactNode } from 'react';
import { analyserIncident, rapportIncident, type PorteeIncident } from '@shared';
import { APP_COMMIT, APP_VERSION } from '../lib/version';

/**
 * Frontière d'erreur : un écran qui tombe ne doit pas emporter les autres.
 *
 * Sans elle, la moindre exception de rendu vide la page entière — en-tête,
 * navigation, tout. Au boulodrome, avec des poules en cours, c'est
 * indistinguable d'une application perdue, et le rechargement ne répare rien si
 * la cause est en base.
 *
 * Elle est posée à trois niveaux, du plus fin au plus large : l'onglet d'un
 * concours, la page, puis l'application. Le plus fin l'emporte, donc un onglet
 * en échec laisse la barre d'onglets vivante — il suffit d'aller ailleurs pour
 * continuer le concours.
 *
 * Ce qui est dit à l'organisateur et ce qui est transmis à celui qui dépanne
 * sont décidés dans `incidents.ts`, côté moteur, pour être éprouvés.
 */

interface Props {
  children: ReactNode;
  /**
   * Ce que cette frontière protège. Détermine ce qu'on peut affirmer sans
   * mentir : à la racine, on ne promet pas que le reste fonctionne.
   */
  portee?: PorteeIncident;
  /**
   * Lien de repli proposé, quand il y a un ailleurs utile. C'est un lien
   * ordinaire, pas un lien de routeur : la frontière la plus large vit en
   * dehors du routeur, et y rendre un `<Link>` la ferait planter elle-même.
   */
  retour?: { to: string; label: string };
}

interface State {
  erreur: Error | null;
  pile?: string;
  /** Nombre de « Réessayer » déjà tentés : au-delà, ça ne sert plus. */
  essais: number;
  quand: string;
  /**
   * Résultat de la copie du rapport. Le presse-papier se refuse sans le dire —
   * navigateur non focalisé, permission absente, contexte non sécurisé — et un
   * bouton qui ne répond rien laisse croire que c'est copié.
   */
  copie: null | 'ok' | 'echec';
}

export class FrontiereErreur extends Component<Props, State> {
  state: State = { erreur: null, essais: 0, quand: '', copie: null };

  static getDerivedStateFromError(erreur: Error): Partial<State> {
    return { erreur, quand: new Date().toISOString() };
  }

  componentDidCatch(erreur: Error, info: ErrorInfo): void {
    this.setState({ pile: info.componentStack ?? undefined });
    // La console garde la trace complète pour qui inspecte l'appareil ; le
    // rapport affiché, lui, reste court et recopiable.
    console.error('Incident d\'affichage', erreur, info.componentStack);
  }

  private reessayer = (): void => {
    this.setState((s) => ({ erreur: null, pile: undefined, essais: s.essais + 1, copie: null }));
  };

  private copier = async (rapport: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(rapport);
      this.setState({ copie: 'ok' });
    } catch {
      this.setState({ copie: 'echec' });
    }
  };

  render(): ReactNode {
    const { erreur, pile, essais, quand, copie } = this.state;
    if (!erreur) return this.props.children;

    const incident = analyserIncident(erreur, essais, this.props.portee ?? 'onglet');
    const rapport = rapportIncident({
      erreur,
      pile,
      version: APP_VERSION,
      commit: APP_COMMIT,
      chemin: window.location.pathname,
      quand,
    });

    return (
      <div className="tab-content">
        <div className="draw-panel incident-panel">
          <h2>{incident.titre}</h2>
          <p>{incident.explication}</p>
          <div className="incident-actions">
            {incident.action === 'reessayer' ? (
              <>
                <button className="btn btn-primary" onClick={this.reessayer}>
                  ↻ Réessayer
                </button>
                <button className="btn btn-ghost" onClick={() => window.location.reload()}>
                  Recharger l'application
                </button>
              </>
            ) : (
              <>
                <button className="btn btn-primary" onClick={() => window.location.reload()}>
                  ↻ Recharger l'application
                </button>
                {essais < 3 && (
                  <button className="btn btn-ghost" onClick={this.reessayer}>
                    Réessayer quand même
                  </button>
                )}
              </>
            )}
            {this.props.retour && (
              <a className="btn btn-ghost" href={this.props.retour.to}>
                {this.props.retour.label}
              </a>
            )}
          </div>
          <details className="incident-details">
            <summary>Détail technique</summary>
            <pre>{rapport}</pre>
            <button className="btn btn-sm btn-ghost" onClick={() => void this.copier(rapport)}>
              📋 Copier le rapport
            </button>
            {copie === 'ok' && <span className="hint"> ✓ Copié</span>}
            {copie === 'echec' && (
              <span className="form-error">
                {' '}
                Le navigateur a refusé la copie — sélectionnez le texte ci-dessus.
              </span>
            )}
            <p className="hint">
              Ce rapport ne contient ni nom de joueur ni résultat : version, écran et message
              d'erreur, de quoi retrouver le défaut.
            </p>
          </details>
        </div>
      </div>
    );
  }
}
