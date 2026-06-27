import { Navigate, Route, Routes } from 'react-router-dom';
import { RedirectIfAuthed, RequireOnboarding, RequirePlayer } from './components/AuthGuard';
import Login from './pages/Login';
import Onboarding from './pages/Onboarding';
import Leaderboard from './pages/Leaderboard';
import LogMatch from './pages/LogMatch';
import PlayerProfile from './pages/PlayerProfile';

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route element={<RedirectIfAuthed />}>
        <Route path="/login" element={<Login />} />
      </Route>

      {/* Signed in, profile not yet created */}
      <Route element={<RequireOnboarding />}>
        <Route path="/onboarding" element={<Onboarding />} />
      </Route>

      {/* Signed in with a profile */}
      <Route element={<RequirePlayer />}>
        <Route path="/" element={<Leaderboard />} />
        <Route path="/log" element={<LogMatch />} />
        <Route path="/player/:id" element={<PlayerProfile />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
