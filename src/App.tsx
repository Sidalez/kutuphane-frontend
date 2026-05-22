// src/App.tsx
import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./layout/Layout";
import LibraryPage from "./pages/LibraryPage";
import AddBookPage from "./pages/AddBookPage";
import LoginPage from "./pages/LoginPage";
import { useAuth } from "./auth/AuthContext";
import ProfilePage from "./pages/ProfilePage";
import BookDetailPage from "./pages/BookDetailPage";
import EditBookPage from "./pages/EditBookPage";
import StatisticsPage from "./pages/StatisticsPage";
import GoalsPage from "./pages/GoalsPage";
import SuggestionsPage from "./pages/SuggestionsPage";
import AddMediaPage from "./pages/AddMediaPage";

export default function App() {
  const { user, loading } = useAuth();

  // Firebase kullanıcıyı kontrol ederken hiçbir şey gösterme
  if (loading) return null;

  return (
    <Routes>
      {/* LOGIN sayfası: kullanıcı varsa direkt /library'e at */}
      <Route
        path="/login"
        element={user ? <Navigate to="/library" replace /> : <LoginPage />}
      />

      {/* Kullanıcı yoksa tüm yollar login'e gitsin */}
      {!user && (
        <Route path="*" element={<Navigate to="/login" replace />} />
      )}

      {/* Kullanıcı varsa Layout + sayfalar */}
      {user && (
        <Route element={<Layout />}>
          <Route path="/" element={<Navigate to="/library" replace />} />
          <Route path="/library" element={<LibraryPage />} />
          <Route path="/add-book" element={<AddBookPage />} />
          <Route path="/library/:id" element={<BookDetailPage />} />
<Route path="/edit/:id" element={<EditBookPage />} />
             <Route path="/profile" element={<ProfilePage />} /> {/* 🔥 */}

             <Route path="/statistics" element={<StatisticsPage />} />
             <Route path="/goals" element={<GoalsPage />} />
              <Route path="/suggestions" element={<SuggestionsPage />} />
                {/* 🎬 Film / Dizi */}
    <Route path="/add-media" element={<AddMediaPage />} />
        </Route>
      )}
    </Routes>
  );
}
