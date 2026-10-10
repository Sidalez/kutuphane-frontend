import { lazy, Suspense } from "react";
import PageLoading from "./components/feedback/PageLoading";
import PageErrorBoundary from "./components/feedback/PageErrorBoundary";
import AppFeedback from "./components/feedback/AppFeedback";
// src/App.tsx
import { Routes, Route, Navigate, useLocation } from "react-router-dom";

import Layout from "./layout/Layout";

const LoginPage = lazy(() => import("./pages/LoginPage"));
const LibraryPage = lazy(() => import("./pages/LibraryPage"));
const AddBookPage = lazy(() => import("./pages/AddBookPage"));
const BookDetailPage = lazy(() => import("./pages/BookDetailPage"));
const EditBookPage = lazy(() => import("./pages/EditBookPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const StatisticsPage = lazy(() => import("./pages/StatisticsPage"));
const GoalsPage = lazy(() => import("./pages/GoalsPage"));
const SuggestionsPage = lazy(() => import("./pages/SuggestionsPage"));
const AddMediaPage = lazy(() => import("./pages/AddMediaPage"));
const MediaLibraryPage = lazy(() => import("./pages/MediaLibraryPage"));
import { useAuth } from "./auth/AuthContext";
const MediaDetailPage = lazy(() => import("./pages/MediaDetailPage"));
const MediaReportsPage = lazy(() => import("./pages/MediaReportsPage"));
const MediaSuggestionsPage = lazy(() => import("./pages/MediaSuggestionsPage"));
export default function App() {
  const { user, loading } = useAuth();

  const location = useLocation();
  if (loading) return <PageLoading fullScreen label="Oturumun hazırlanıyor…" />;

  return (
    <>
    <AppFeedback />
    <PageErrorBoundary key={location.pathname}>
    <Suspense fallback={<PageLoading fullScreen label="Sayfa açılıyor…" />}>
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
    </Suspense>
    </PageErrorBoundary>
    </>
  );
}