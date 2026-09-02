import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index";
const Signup = lazy(() => import("./pages/Signup"));
const Welcome = lazy(() => import("./pages/Welcome"));
const Login = lazy(() => import("./pages/Login"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const PaymentSuccess = lazy(() => import("./pages/PaymentSuccess"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Settings = lazy(() => import("./pages/Settings"));
const MySchedule = lazy(() => import("./pages/MySchedule"));
const Admin = lazy(() => import("./pages/Admin"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Unsubscribe = lazy(() => import("./pages/Unsubscribe"));
const Legal = lazy(() => import("./pages/Legal"));
const Scan = lazy(() => import("./pages/Scan"));
const Trainer = lazy(() => import("./pages/Trainer"));
const EmailPreview = lazy(() => import("./pages/EmailPreview"));
const Blog = lazy(() => import("./pages/Blog"));
const BlogPost = lazy(() => import("./pages/BlogPost"));
const ImpersonateCallback = lazy(() => import("./pages/ImpersonateCallback"));
const OAuthConsent = lazy(() => import("./pages/OAuthConsent"));
const Connect = lazy(() => import("./pages/Connect"));
const Recursos = lazy(() => import("./pages/Recursos"));
const GuiaEntrenamientoCasa = lazy(() => import("./pages/GuiaEntrenamientoCasa"));
const Recomendaciones = lazy(() => import("./pages/Recomendaciones"));
import ImpersonationBanner from "@/components/ImpersonationBanner";
import ErrorBoundary from "@/components/ErrorBoundary";
import OfflineBanner from "@/components/OfflineBanner";
import { Helmet } from "react-helmet-async";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";
import { isNativeApp } from "@/lib/platform";

const RootRoute = () => (isNativeApp() ? <Welcome /> : <Index />);

const DashboardRedirect = () => {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={`/dashboard/user/${user.id}`} replace />;
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000, refetchOnWindowFocus: false },
  },
});

/** Marca rutas privadas como no indexables. */
const NoIndex = ({ children }: { children: JSX.Element }) => (
  <>
    <Helmet>
      <meta name="robots" content="noindex,nofollow" />
    </Helmet>
    {children}
  </>
);

const RouteFallback = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <Loader2 className="w-8 h-8 text-primary animate-spin" />
  </div>
);

const App = () => (
  <ErrorBoundary>
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <ImpersonationBanner />
          <OfflineBanner />
          <Suspense fallback={<RouteFallback />}>
            <Routes>
            <Route path="/" element={<RootRoute />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/login" element={<Login />} />
            <Route path="/scan" element={<Scan />} />
            <Route path="/scan/user/:userId" element={<ProtectedRoute><Scan /></ProtectedRoute>} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/payment-success" element={<PaymentSuccess />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/dashboard" element={<DashboardRedirect />} />
            <Route path="/dashboard/user/:userId" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><NoIndex><Settings /></NoIndex></ProtectedRoute>} />
            <Route path="/my-schedule" element={<ProtectedRoute><MySchedule /></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute><NoIndex><Admin /></NoIndex></ProtectedRoute>} />
            <Route path="/admin/email-preview/:templateKey" element={<ProtectedRoute><EmailPreview /></ProtectedRoute>} />
            <Route path="/trainer" element={<ProtectedRoute><NoIndex><Trainer /></NoIndex></ProtectedRoute>} />
            <Route path="/unsubscribe" element={<NoIndex><Unsubscribe /></NoIndex>} />
            <Route path="/legal" element={<Navigate to="/legal/terminos" replace />} />
            <Route path="/legal/:slug" element={<Legal />} />
            <Route path="/blog" element={<Blog />} />
            <Route path="/blog/:slug" element={<BlogPost />} />
            <Route path="/impersonate/callback" element={<ImpersonateCallback />} />
            <Route path="/.lovable/oauth/consent" element={<OAuthConsent />} />
            <Route path="/connect" element={<Connect />} />
            <Route path="/recursos" element={<Recursos />} />
            <Route path="/guia-entrenamiento-casa" element={<GuiaEntrenamientoCasa />} />
            <Route path="/recomendaciones" element={<Recomendaciones />} />
            <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
