// src/App.tsx
import { Routes, Route, Navigate } from "react-router-dom";

import Layout from "./layout/Layout";

import LoginPage from "./pages/LoginPage";
import LibraryPage from "./pages/LibraryPage";
import AddBookPage from "./pages/AddBookPage";
import BookDetailPage from "./pages/BookDetailPage";
import EditBookPage from "./pages/EditBookPage";
import ProfilePage from "./pages/ProfilePage";
import StatisticsPage from "./pages/StatisticsPage";
import GoalsPage from "./pages/GoalsPage";
import SuggestionsPage from "./pages/SuggestionsPage";
import AddMediaPage from "./pages/AddMediaPage";
import MediaLibraryPage from "./pages/MediaLibraryPage";
import { useAuth } from "./auth/AuthContext";
import MediaDetailPage from "./pages/MediaDetailPage";
import MediaReportsPage from "./pages/MediaReportsPage";
import MediaSuggestionsPage from "./pages/MediaSuggestionsPage";
export default function App() {
  const { user, loading } = useAuth();

  if (loading) return null;

  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to="/library" replace /> : <LoginPage />}
      />

      {!user && <Route path="*" element={<Navigate to="/login" replace />} />}

      {user && (
        <Route element={<Layout />}>
          <Route path="/" element={<Navigate to="/library" replace />} />

          <Route path="/library" element={<LibraryPage />} />
          <Route path="/library/:id" element={<BookDetailPage />} />
          <Route path="/add-book" element={<AddBookPage />} />
          <Route path="/edit/:id" element={<EditBookPage />} />

          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/statistics" element={<StatisticsPage />} />
          <Route path="/goals" element={<GoalsPage />} />
          <Route path="/suggestions" element={<SuggestionsPage />} />

<Route path="/media" element={<MediaLibraryPage />} />
<Route path="/media/reports" element={<MediaReportsPage />} />
<Route path="/media/suggestions" element={<MediaSuggestionsPage />} />
<Route path="/media/:id" element={<MediaDetailPage />} />
<Route path="/add-media" element={<AddMediaPage />} />

        </Route>
      )}
    </Routes>
  );
}