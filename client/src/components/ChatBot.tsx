import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  parcoursParId,
  pistesContextuelles,
  suiteSuggeree,
  type EtatParcours,
} from '@shared';
import { useConcours, useMatches, usePoules, useTeams } from '../db/hooks';
import { FAQ, FEATURED_IDS, type FaqEntry } from '../help/faq';
import { searchFaq } from '../help/matcher';
import { rappelerNouveautes } from '../help/nouveautesState';
import { demarrerParcours } from '../help/parcoursState';

/**
 * L'assistant accompagne : il ne repropose pas un menu.
 *
 * Il se comportait comme un moteur de recherche dans une FAQ — il répondait,
 * puis affichait des « sujets voisins », c'est-à-dire un catalogue ; et quand il
 * ne trouvait rien, la liste complète des sujets vedettes. Quelqu'un au milieu
 * d'un geste se retrouvait devant un sommaire au lieu de l'étape suivante.
 *
 * Désormais chaque réponse est suivie de **la suite du parcours de
 * l'utilisateur**, déduite de l'état réel du concours (voir `suiteSuggeree`), et
 * une question incomprise donne une demande de précision ancrée dans cet état
 * plutôt qu'un déroulé du sommaire. Le sommaire reste accessible, mais
 * seulement au début de la conversation ou sur demande explicite.
 */

interface BotMessage {
  role: 'bot';
  text?: string;
  entry?: FaqEntry;
  /** Parcours proposés (identifiants du catalogue) : accompagnement, pas menu. */
  guides?: string[];
}

interface UserMessage {
  role: 'user';
  text: string;
}

type Message = BotMessage | UserMessage;

const BONJOUR: BotMessage = {
  role: 'bot',
  text:
    'Bonjour 👋 Je suis l\'assistant. Posez votre question (« comment corriger un score ? ») ' +
    'ou laissez-moi vous guider — je fonctionne aussi hors connexion.',
};

export function ChatBot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([BONJOUR]);
  const [input, setInput] = useState('');
  const [showAll, setShowAll] = useState(false);
  /** Sommaire réclamé explicitement : la seule façon de le revoir. */
  const [sommaire, setSommaire] = useState(false);
  /** Dernier contexte salué, pour se resituer quand on change de concours. */
  const salueRef = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();

  const concoursId = location.pathname.match(/^\/concours\/([^/]+)/)?.[1];
  const concours = useConcours(concoursId);
  const teams = useTeams(concoursId);
  const poules = usePoules(concoursId);
  const matches = useMatches(concoursId);

  const etat: EtatParcours = useMemo(
    () => ({
      concours: concours ?? null,
      teams: teams ?? [],
      poules: poules ?? [],
      matches: matches ?? [],
    }),
    [concours, teams, poules, matches],
  );
  const donneesPretes = teams !== undefined && poules !== undefined && matches !== undefined;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, open]);

  /** Là où l'utilisateur se trouve, dit simplement. */
  const ouSuisJe = (): string =>
    concours ? `Vous êtes sur « ${concours.name} »` : 'Vous êtes sur le tableau de bord';

  /**
   * À l'ouverture, l'assistant dit où l'on en est plutôt que d'attendre une
   * question. Une fois par contexte : rouvrir le panneau dans un autre concours
   * mérite de se resituer, le rouvrir au même endroit non. Et seulement quand
   * les données ont répondu — sans quoi il annoncerait un concours vierge.
   */
  const contexte = concoursId ?? 'tableau-de-bord';
  useEffect(() => {
    if (!open || salueRef.current === contexte || !donneesPretes) return;
    salueRef.current = contexte;
    const suite = suiteSuggeree(etat);
    setMessages((m) => [
      ...m,
      { role: 'bot', text: `${ouSuisJe()}. ${suite.phrase}`, guides: [suite.parcours] },
    ]);
    // `etat` volontairement hors dépendances : on salue à l'ouverture, pas à
    // chaque changement de donnée.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, contexte, donneesPretes]);

  const ask = (text: string) => {
    setSommaire(false);
    const resultats = searchFaq(text, FAQ);
    const meilleur = resultats[0];
    const suite = suiteSuggeree(etat);

    if (meilleur && meilleur.score >= 2) {
      const entry = meilleur.entry;
      // La suite du parcours, jamais des « sujets voisins » : si la question
      // portait déjà sur l'étape courante, on le dit au lieu de dévier.
      const memeSujet = entry.parcours === suite.parcours;
      setMessages((m) => [
        ...m,
        { role: 'user', text },
        { role: 'bot', entry },
        {
          role: 'bot',
          text: memeSujet
            ? 'Et c\'est justement là que vous en êtes. On s\'y met ensemble ?'
            : suite.phrase,
          guides: [suite.parcours],
        },
      ]);
      return;
    }

    // Question incomprise : demander une précision ancrée dans l'état du
    // concours. Dérouler le sommaire renverrait l'utilisateur à sa recherche.
    setMessages((m) => [
      ...m,
      { role: 'user', text },
      {
        role: 'bot',
        text:
          `Je ne suis pas sûr d'avoir compris. ${ouSuisJe()} : ` +
          'est-ce que vous cherchez à faire l\'une de ces choses ?',
        guides: pistesContextuelles(etat),
      },
    ]);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    setInput('');
    ask(text);
  };

  const pick = (entry: FaqEntry) => {
    setSommaire(false);
    const suite = suiteSuggeree(etat);
    const memeSujet = entry.parcours === suite.parcours;
    setMessages((m) => [
      ...m,
      { role: 'user', text: entry.question },
      { role: 'bot', entry },
      {
        role: 'bot',
        text: memeSujet
          ? 'Et c\'est justement là que vous en êtes. On s\'y met ensemble ?'
          : suite.phrase,
        guides: [suite.parcours],
      },
    ]);
  };

  const runAction = (entry: FaqEntry) => {
    const action = entry.action;
    if (!action) return;
    if (action.needsConcours && !concoursId) {
      setMessages((m) => [
        ...m,
        {
          role: 'bot',
          text: 'Ouvrez d\'abord un concours depuis le tableau de bord, puis revenez me voir 😉',
        },
      ]);
      navigate('/');
      return;
    }
    navigate(action.path.replace(':id', concoursId ?? ''));
  };

  /**
   * Lance un parcours guidé. Un parcours de concours réclame un concours
   * ouvert : sans lui, on le dit au lieu de surligner le vide.
   */
  const guider = (id: string) => {
    const parcours = parcoursParId(id);
    if (!parcours) return;
    if (parcours.besoinConcours && !concoursId) {
      setMessages((m) => [
        ...m,
        {
          role: 'bot',
          text:
            'Ce guide se déroule dans un concours. Ouvrez-en un depuis le tableau de bord, ' +
            'puis redemandez-moi 😉',
        },
      ]);
      navigate('/');
      return;
    }
    setOpen(false);
    demarrerParcours(parcours, concoursId ?? null);
  };

  const showNouveautes = () => {
    setOpen(false);
    rappelerNouveautes();
  };

  const demanderSommaire = () => {
    setSommaire(true);
    setMessages((m) => [...m, { role: 'bot', text: 'Voici tous les sujets que je connais :' }]);
  };

  const featured = FEATURED_IDS.map((id) => FAQ.find((e) => e.id === id)!).filter(Boolean);
  const categories = [...new Set(FAQ.map((e) => e.category))];
  /** Aucune question encore posée : le sommaire a sa place. Après, non. */
  const vierge = !messages.some((m) => m.role === 'user');

  return (
    <>
      <button
        className={`help-fab no-print${open ? ' help-fab-open' : ''}`}
        data-tour="help"
        onClick={() => setOpen(!open)}
        aria-label={open ? 'Fermer l\'assistant' : 'Ouvrir l\'assistant'}
        title="Assistant — il vous guide pas à pas"
      >
        {open ? '✕' : '💬'}
      </button>

      {open && (
        <div className="chat-panel no-print" role="dialog" aria-label="Assistant">
          <header className="chat-head">
            <span className="chat-head-title">
              💬 Assistant
              <small>Guides pas à pas — fonctionne hors ligne</small>
            </span>
            <button className="btn-icon chat-close" onClick={() => setOpen(false)} aria-label="Fermer">
              ✕
            </button>
          </header>

          <div className="chat-messages" ref={scrollRef}>
            {messages.map((msg, i) =>
              msg.role === 'user' ? (
                <div key={i} className="chat-bubble chat-user">
                  {msg.text}
                </div>
              ) : (
                <div key={i} className="chat-bubble chat-bot">
                  {msg.text && <p className="chat-text">{msg.text}</p>}
                  {msg.entry && (
                    <FaqAnswer
                      entry={msg.entry}
                      onAction={runAction}
                      onGuider={guider}
                      onNouveautes={showNouveautes}
                    />
                  )}
                  {msg.guides && msg.guides.length > 0 && (
                    <div className="chat-chips">
                      {msg.guides.map((id) => {
                        const p = parcoursParId(id);
                        if (!p) return null;
                        return (
                          <button
                            key={id}
                            className="chat-chip chat-chip-guide"
                            onClick={() => guider(id)}
                          >
                            🎓 {p.titre}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ),
            )}

            {(vierge || sommaire) && (
              <div className="chat-suggestions">
                <p className="chat-suggestions-title">
                  {sommaire ? 'Tous les sujets :' : 'Ou une question fréquente :'}
                </p>
                <div className="chat-chips">
                  {featured.map((entry) => (
                    <button key={entry.id} className="chat-chip" onClick={() => pick(entry)}>
                      {entry.question}
                    </button>
                  ))}
                  <button className="chat-chip chat-chip-alt" onClick={() => setShowAll(!showAll)}>
                    {showAll ? 'Réduire ▲' : 'Tous les sujets ▼'}
                  </button>
                  <button className="chat-chip chat-chip-alt" onClick={showNouveautes}>
                    ✨ Quoi de neuf ?
                  </button>
                </div>
                {showAll &&
                  categories.map((cat) => (
                    <div key={cat}>
                      <p className="chat-suggestions-title">{cat}</p>
                      <div className="chat-chips">
                        {FAQ.filter((e) => e.category === cat).map((entry) => (
                          <button key={entry.id} className="chat-chip" onClick={() => pick(entry)}>
                            {entry.question}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>

          <form className="chat-input" onSubmit={submit}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Posez votre question…"
              aria-label="Votre question"
            />
            <button className="btn btn-primary btn-sm" disabled={!input.trim()}>
              Envoyer
            </button>
          </form>
          {!vierge && !sommaire && (
            <button className="chat-sommaire" onClick={demanderSommaire}>
              📋 Revoir tous les sujets
            </button>
          )}
        </div>
      )}
    </>
  );
}

function FaqAnswer({
  entry,
  onAction,
  onGuider,
  onNouveautes,
}: {
  entry: FaqEntry;
  onAction: (entry: FaqEntry) => void;
  onGuider: (parcoursId: string) => void;
  onNouveautes: () => void;
}) {
  return (
    <div className="faq-answer">
      <p className="faq-question">{entry.question}</p>
      {entry.intro && <p className="chat-text">{entry.intro}</p>}
      {entry.steps && (
        <ol className="faq-steps">
          {entry.steps.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ol>
      )}
      {entry.note && <p className="faq-note">💡 {entry.note}</p>}
      <div className="chat-chips">
        {/* Le guide d'abord : lire des étapes vaut moins que les faire. */}
        {entry.parcours && (
          <button
            className="chat-chip chat-chip-guide"
            onClick={() => onGuider(entry.parcours!)}
          >
            🎓 Me guider pas à pas
          </button>
        )}
        {entry.action && (
          <button className="chat-chip chat-chip-action" onClick={() => onAction(entry)}>
            🧭 {entry.action.label}
          </button>
        )}
        {entry.id === 'nouveautes' && (
          <button className="chat-chip chat-chip-action" onClick={onNouveautes}>
            ✨ Voir les nouveautés
          </button>
        )}
      </div>
    </div>
  );
}
