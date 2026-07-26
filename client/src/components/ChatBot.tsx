import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FAQ, FEATURED_IDS, type FaqEntry } from '../help/faq';
import { searchFaq } from '../help/matcher';
import { startTour } from '../help/tourState';
import { concoursTour, dashboardTour } from '../help/tours';

interface BotMessage {
  role: 'bot';
  text?: string;
  entry?: FaqEntry;
  suggestions?: FaqEntry[];
}

interface UserMessage {
  role: 'user';
  text: string;
}

type Message = BotMessage | UserMessage;

const WELCOME: BotMessage = {
  role: 'bot',
  text:
    'Bonjour 👋 Je suis l\'assistant. Posez votre question (« comment corriger un score ? ») ' +
    'ou choisissez un sujet ci-dessous — je vous guide pas à pas, même hors connexion.',
};

export function ChatBot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [input, setInput] = useState('');
  const [showAll, setShowAll] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();

  const concoursId = location.pathname.match(/^\/concours\/([^/]+)/)?.[1];

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, open]);

  const answerWith = (entry: FaqEntry, alternatives: FaqEntry[] = []) => {
    setMessages((m) => [...m, { role: 'bot', entry, suggestions: alternatives.slice(0, 3) }]);
  };

  const ask = (text: string) => {
    setMessages((m) => [...m, { role: 'user', text }]);
    const matches = searchFaq(text, FAQ);
    const top = matches[0];
    if (top && top.score >= 2) {
      answerWith(
        top.entry,
        matches.slice(1, 4).map((r) => r.entry),
      );
    } else {
      setMessages((m) => [
        ...m,
        {
          role: 'bot',
          text:
            'Je n\'ai pas trouvé de guide correspondant. Voici les sujets les plus proches — ' +
            'ou reformulez avec un mot-clé (poules, score, tableau, consolante, hors ligne…).',
          suggestions: (matches.length > 0 ? matches.map((r) => r.entry) : FEATURED_IDS.map(
            (id) => FAQ.find((e) => e.id === id)!,
          )).slice(0, 4),
        },
      ]);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    setInput('');
    ask(text);
  };

  const pick = (entry: FaqEntry) => {
    setMessages((m) => [...m, { role: 'user', text: entry.question }]);
    answerWith(entry);
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

  const restartTour = () => {
    setOpen(false);
    startTour(concoursId ? concoursTour : dashboardTour);
  };

  const featured = FEATURED_IDS.map((id) => FAQ.find((e) => e.id === id)!).filter(Boolean);
  const categories = [...new Set(FAQ.map((e) => e.category))];

  return (
    <>
      <button
        className={`help-fab no-print${open ? ' help-fab-open' : ''}`}
        data-tour="help"
        onClick={() => setOpen(!open)}
        aria-label={open ? 'Fermer l\'assistant' : 'Ouvrir l\'assistant'}
        title="Assistant — questions fréquentes"
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
                  {msg.entry && <FaqAnswer entry={msg.entry} onAction={runAction} onTour={restartTour} />}
                  {msg.suggestions && msg.suggestions.length > 0 && (
                    <div className="chat-chips">
                      {msg.suggestions.map((s) => (
                        <button key={s.id} className="chat-chip" onClick={() => pick(s)}>
                          {s.question}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ),
            )}

            {messages.length === 1 && (
              <div className="chat-suggestions">
                <p className="chat-suggestions-title">Questions fréquentes :</p>
                <div className="chat-chips">
                  {featured.map((entry) => (
                    <button key={entry.id} className="chat-chip" onClick={() => pick(entry)}>
                      {entry.question}
                    </button>
                  ))}
                  <button className="chat-chip chat-chip-alt" onClick={() => setShowAll(!showAll)}>
                    {showAll ? 'Réduire ▲' : 'Tous les sujets ▼'}
                  </button>
                  <button className="chat-chip chat-chip-alt" onClick={restartTour}>
                    🎓 Relancer la visite guidée
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
        </div>
      )}
    </>
  );
}

function FaqAnswer({
  entry,
  onAction,
  onTour,
}: {
  entry: FaqEntry;
  onAction: (entry: FaqEntry) => void;
  onTour: () => void;
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
        {entry.action && (
          <button className="chat-chip chat-chip-action" onClick={() => onAction(entry)}>
            🧭 {entry.action.label}
          </button>
        )}
        {entry.id === 'tutoriel' && (
          <button className="chat-chip chat-chip-action" onClick={onTour}>
            🎓 Relancer la visite guidée
          </button>
        )}
      </div>
    </div>
  );
}
