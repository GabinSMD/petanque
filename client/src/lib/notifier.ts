import { useEffect, useRef } from 'react';
import { libelleTerrain } from '@shared';
import type { Concours, Match, Team } from '@shared';
import { postJson } from './api';
import { getSession } from './session';
import { isNotableCall, matchLabel, matchTeamNumbers } from './matchLabel';
import type { Poule } from '@shared';

interface CallPayload {
  matchId: string;
  teamNumbers: number[];
  title: string;
  body: string;
}

/**
 * Émetteur de convocations (table de marque) : après chaque évolution des
 * parties, repère les équipes nouvellement appelées (barrage, tour suivant…)
 * et les signale au serveur, qui relaie en notification push aux téléphones
 * abonnés. La détection (règles du jeu) reste côté client ; le serveur
 * déduplique par partie. Sans réseau / en invité, ne fait rien.
 */
export function useCallNotifier(
  concours: Concours | undefined,
  teams: Team[],
  poules: Poule[],
  matches: Match[],
): void {
  // Parties déjà notables au montage : on les ignore (pas de rappel massif).
  const seeded = useRef(false);
  const known = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!concours) return;
    const session = getSession();
    const online = typeof navigator === 'undefined' || navigator.onLine;
    if (!session || session.guest || concours.status === 'termine') return;

    const notable = matches.filter(isNotableCall);
    if (!seeded.current) {
      seeded.current = true;
      known.current = new Set(notable.map((m) => m.id));
      return;
    }

    const fresh = notable.filter((m) => !known.current.has(m.id));
    fresh.forEach((m) => known.current.add(m.id));
    if (fresh.length === 0 || !online) return;

    const teamsById = new Map(teams.map((t) => [t.id, t]));
    const calls: CallPayload[] = fresh.map((m) => ({
      matchId: m.id,
      teamNumbers: matchTeamNumbers(m, teamsById),
      title: '🔔 Votre équipe est appelée',
      body: `${matchLabel(m, poules, matches)}${
        m.terrain
          ? ` · Terrain ${libelleTerrain(m.terrain, concours.libelleTerrains, concours.decalageTerrain)}`
          : ''
      }`,
    }));

    // Le serveur déduplique : sans abonné, l'appel est simplement ignoré.
    postJson('/api/notify', { concoursId: concours.id, calls }).catch(() => undefined);
  }, [concours?.id, concours?.status, teams, poules, matches]);
}
