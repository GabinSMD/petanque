import type { ReactNode } from 'react';
import {
  BrowserRouter,
  Link,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom';
import { useSession } from './db/hooks';
import { BouleLogo } from './components/BouleLogo';
import { clearSession } from './lib/session';
import { wipeLocalData } from './db/local';
import { AppFooter } from './components/AppFooter';
import { NouveautesHost } from './components/NouveautesModal';
import { SyncBadge } from './components/SyncBadge';
import { ChatBot } from './components/ChatBot';
import { InstallPrompt } from './components/InstallPrompt';
import { TourHost } from './components/Tour';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { PalmaresPage } from './pages/PalmaresPage';
import { ConcoursPage } from './pages/ConcoursPage';
import { DisplayPage } from './pages/DisplayPage';
import { LicenciesPage } from './pages/LicenciesPage';
import { ChampionnatClubsPage } from './pages/ChampionnatClubsPage';
import { FeuilleMatchPage } from './pages/FeuilleMatchPage';
import { PrintPage } from './pages/PrintPage';
import { PublicPage } from './pages/PublicPage';

function Layout() {
  const session = useSession();
  const guest = session?.guest === true;

  const logout = async () => {
    const message = guest
      ? 'Quitter le mode invité ? Vos concours ne sont PAS sauvegardés en ligne : ' +
        'ils seront définitivement effacés. Créez plutôt un compte pour les conserver.'
      : 'Se déconnecter ? Les données locales de cet appareil seront effacées ' +
        '(elles restent sauvegardées sur le serveur si elles ont été synchronisées).';
    if (!window.confirm(message)) return;
    await wipeLocalData();
    clearSession();
  };

  return (
    <div className="app">
      <header className="app-header no-print">
        <Link to="/" className="brand">
          <BouleLogo />
          <span>
            Pétanque <strong>Concours</strong>
          </span>
        </Link>
        <div className="header-right">
          <SyncBadge />
          {session && (
            <div className="user-box">
              <span className="org-name" title={session.user.name}>
                {session.org.name}
              </span>
              {guest && (
                <Link className="btn btn-sm btn-header-cta" to="/login">
                  Créer un compte
                </Link>
              )}
              <button className="btn btn-ghost btn-sm" onClick={() => void logout()}>
                {guest ? 'Quitter' : 'Déconnexion'}
              </button>
            </div>
          )}
        </div>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
      <AppFooter />
      <ChatBot />
      <TourHost />
      <NouveautesHost />
    </div>
  );
}

function RequireAuth({ children }: { children: ReactNode }) {
  const session = useSession();
  const { pathname } = useLocation();
  if (!session) {
    // Un visiteur qui arrive sur la racine mérite une présentation, pas un
    // formulaire de connexion. Partout ailleurs, la redirection ne change pas.
    return pathname === '/' ? <LandingPage /> : <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/p/:token" element={<PublicPage />} />
        <Route
          path="/concours/:id/affichage"
          element={
            <RequireAuth>
              <DisplayPage />
            </RequireAuth>
          }
        />
        <Route
          path="/concours/:id/imprimer/:doc"
          element={
            <RequireAuth>
              <PrintPage />
            </RequireAuth>
          }
        />
        <Route
          element={
            <RequireAuth>
              <Layout />
            </RequireAuth>
          }
        >
          <Route path="/" element={<DashboardPage />} />
          <Route path="/palmares" element={<PalmaresPage />} />
          <Route path="/licencies" element={<LicenciesPage />} />
          <Route path="/championnat-clubs" element={<ChampionnatClubsPage />} />
          <Route path="/championnat-clubs/:id" element={<FeuilleMatchPage />} />
          <Route path="/concours/:id" element={<ConcoursPage />} />
          <Route path="/concours/:id/:tab" element={<ConcoursPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <InstallPrompt />
    </BrowserRouter>
  );
}
