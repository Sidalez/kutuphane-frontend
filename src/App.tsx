import { lazy, Suspense } from "react";
import PageLoading from "./components/feedback/PageLoading";
import PageErrorBoundary from "./components/feedback/PageErrorBoundary";
import AppFeedback from "./components/feedback/AppFeedback";
// src/App.tsx
import { Routes, Route, Navigate, useLocation } from "react-router-dom";

import Layout from "./layout/Layout";

const PersonalHubPage = lazy(() => import("./pages/PersonalHubPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const NotificationsPage = lazy(() => import("./pages/NotificationsPage"));
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
  const { user, loading, startupError } = useAuth();

  const location = useLocation();
  if(startupError)return <><AppFeedback/><div role="alert" className="flex min-h-[100dvh] items-center justify-center bg-[#fffaf3] p-6 dark:bg-slate-950"><div className="w-full max-w-sm rounded-3xl border border-orange-100 bg-white p-7 text-center dark:border-slate-800 dark:bg-slate-900"><h1 className="text-xl font-semibold">Bağlantıyı yeniden deneyelim</h1><p className="mt-4 text-sm leading-7 text-slate-500 dark:text-slate-400">{startupError}</p><button type="button" onClick={()=>window.location.reload()} className="mt-6 min-h-12 w-full rounded-2xl bg-orange-600 px-5 text-sm font-semibold text-white">Yeniden dene</button><p className="mt-4 text-xs leading-6 text-slate-400">Bu işlem hesabını veya kayıtlarını silmez.</p></div></div></>;
  if (loading) return <><AppFeedback /><PageLoading fullScreen label="Oturumun hazırlanıyor…" /></>;

  return (
    <>
    <AppFeedback />
    <PageErrorBoundary key={location.pathname}>
    <Suspense fallback={<PageLoading fullScreen label="Sayfa açılıyor…" />}>
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to="/today" replace /> : <LoginPage />}
      />

      {!user && <Route path="*" element={<Navigate to="/login" replace />} />}

      {user && (
        <Route element={<Layout />}>
          <Route path="/" element={<Navigate to="/today" replace />} />

          {["today","calendar","notes","collections","data","support"].map(path=><Route key={path} path={`/${path}`} element={<PersonalHubPage />} />)
          }
          <Route path="/library" element={<LibraryPage />} />
          <Route path="/library/:id" element={<BookDetailPage />} />
          <Route path="/add-book" element={<AddBookPage />} />
          <Route path="/edit/:id" element={<EditBookPage />} />

          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
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
