import WhoIsTraining from "@/shared/components/native/WhoIsTraining";
import Index from "@/web/pages/Index";
import { Suspense, lazy, useEffect } from "react";
import { Toaster } from "@/shared/components/ui/toaster";
import { Toaster as Sonner } from "@/shared/components/ui/sonner";
import { TooltipProvider } from "@/shared/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/shared/contexts/AuthContext";
import { ProtectedRoute } from "@/shared/components/ProtectedRoute";
const ForTrainers = lazy(() => import("@/web/pages/ForTrainers"));
const AcceptInvitation = lazy(() => import("@/web/pages/ForTrainers").then((m) => ({ default: m.AcceptInvitation })));
const AppDownload = lazy(() => import("@/web/pages/AppDownload"));
const PlanShieldDialog = lazy(() => import("@/app/components/dashboard/PlanShieldDialog"));
const PublicInfo = lazy(() => import("@/web/pages/PublicInfo"));
const Signup = lazy(() => import("@/app/pages/Signup"));
const VerifyEmail = lazy(() => import("@/app/pages/VerifyEmail"));
const Welcome = lazy(() => import("@/app/pages/Welcome"));
const Login = lazy(() => import("@/app/pages/Login"));
const ForgotPassword = lazy(() => import("@/app/pages/ForgotPassword"));
const ResetPassword = lazy(() => import("@/app/pages/ResetPassword"));
const AuthCallback = lazy(() => import("@/app/pages/AuthCallback"));
const PaymentSuccess = lazy(() => import("@/web/pages/PaymentSuccess"));
const BookDownload = lazy(() => import("@/web/pages/BookDownload"));
const SharedBook = lazy(() => import("@/web/pages/SharedBook"));

const OnboardingChoice = lazy(() => import("@/app/pages/OnboardingChoice"));
const Onboarding = lazy(() => import("@/app/pages/Configurator"));
const Dashboard = lazy(() => import("@/app/pages/Dashboard"));
const Settings = lazy(() => import("@/app/pages/Settings"));
const MySchedule = lazy(() => import("@/app/pages/MySchedule"));
const Admin = lazy(() => import("@/app/pages/Admin"));
const Drive = lazy(() => import("@/app/pages/Drive"));
const NotFound = lazy(() => import("@/web/pages/NotFound"));
const Unsubscribe = lazy(() => import("@/web/pages/Unsubscribe"));
const Legal = lazy(() => import("@/web/pages/Legal"));
const Scan = lazy(() => import("@/app/pages/Scan"));
const Trainer = lazy(() => import("@/app/pages/Trainer"));
const EmailPreview = lazy(() => import("@/app/pages/EmailPreview"));
const Blog = lazy(() => import("@/web/pages/Blog"));
const BlogPost = lazy(() => import("@/web/pages/BlogPost"));
const ImpersonateCallback = lazy(() => import("@/app/pages/ImpersonateCallback"));
const OAuthConsent = lazy(() => import("@/app/pages/OAuthConsent"));
const Connect = lazy(() => import("@/web/pages/Connect"));
const Recursos = lazy(() => import("@/web/pages/Recursos"));
import ImpersonationBanner from "@/shared/components/ImpersonationBanner";
import ErrorBoundary from "@/shared/components/ErrorBoundary";
import OfflineBanner from "@/shared/components/OfflineBanner";
import NativeDeepLinks from "@/shared/components/native/NativeDeepLinks";
import AcquisitionCapture from "@/shared/components/AcquisitionCapture";
import { Helmet } from "react-helmet-async";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/shared/contexts/AuthContext";
import { Spinner } from "@/shared/components/ui/spinner";
import { isNativeApp } from "@/shared/lib/platform";
import { hideSplashScreen } from "@/shared/lib/native";

const NativeSplashSync = () => {
  const { loading } = useAuth();
  useEffect(() => {
    if (!loading) {
      void hideSplashScreen(300);
    }
  }, [loading]);
  return null;
};

const RootRoute = () => (isNativeApp() ? <Welcome /> : <Index />);

const DashboardRedirect = () => {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Spinner size="lg" />
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
  <div className="flex min-h-screen items-center justify-center bg-background">
    <Spinner size="lg" />
  </div>
);

const App = () => (
  <ErrorBoundary>
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <NativeSplashSync />
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <Suspense fallback={null}><PlanShieldDialog /></Suspense>
        <BrowserRouter>
          <NativeDeepLinks />
          <AcquisitionCapture />
          <WhoIsTraining />
          <ImpersonationBanner />
          <OfflineBanner />
          <Suspense fallback={<RouteFallback />}>
            <Routes>
            <Route path="/" element={<RootRoute />} />
            <Route path="/planes" element={<PublicInfo page="plans" />} />
            <Route path="/como-funciona" element={<PublicInfo page="how" />} />
            <Route path="/equipo" element={<PublicInfo page="team" />} />
            <Route path="/preguntas-frecuentes" element={<PublicInfo page="faq" />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="/para-entrenadores" element={<ForTrainers />} />
            <Route path="/invitacion/:token" element={<AcceptInvitation />} />
            <Route path="/login" element={<Login />} />
            <Route path="/scan" element={<Scan />} />
            <Route path="/scan/user/:userId" element={<ProtectedRoute><Scan /></ProtectedRoute>} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/payment-success" element={<PaymentSuccess />} />
            <Route path="/descarga-libro" element={<BookDownload />} />
            <Route path="/d/:token" element={<SharedBook />} />

            <Route path="/onboarding-choice" element={<OnboardingChoice />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/dashboard" element={<DashboardRedirect />} />
            <Route path="/dashboard/user/:userId" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><NoIndex><Settings /></NoIndex></ProtectedRoute>} />
            <Route path="/my-schedule" element={<ProtectedRoute><MySchedule /></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute><NoIndex><Admin /></NoIndex></ProtectedRoute>} />
            <Route path="/drive" element={<NoIndex><Drive /></NoIndex>} />
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
            <Route path="/app" element={<AppDownload />} />
            <Route path="/descargar" element={<AppDownload />} />
            <Route path="/recomendaciones" element={<Navigate to="/recursos" replace />} />
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
