import { lazy, Suspense } from 'react';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { LoadingSpinner } from '@/components/layout/LoadingSpinner';

// Lazy load pages for better performance
const Dashboard = lazy(() => import('./pages/Dashboard'));
const ClaimsList = lazy(() => import('./pages/ClaimsList'));
const ClaimDetails = lazy(() => import('./pages/ClaimDetails'));
const NewClaim = lazy(() => import('./pages/NewClaim'));
const ApprovalQueue = lazy(() => import('./pages/ApprovalQueue'));
const AllowancesList = lazy(() => import('./pages/AllowancesList'));
const AllowanceDetails = lazy(() => import('./pages/AllowanceDetails'));
const NewAllowance = lazy(() => import('./pages/NewAllowance'));
const Employees = lazy(() => import('./pages/Employees'));
const Projects = lazy(() => import('./pages/Projects'));
const Settlements = lazy(() => import('./pages/Settlements'));
const Reports = lazy(() => import('./pages/Reports'));
const Profile = lazy(() => import('./pages/Profile'));
const Settings = lazy(() => import('./pages/Settings'));
const NotFound = lazy(() => import('./pages/NotFound'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <LoadingSpinner size="lg" />
    </div>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route element={<AppLayout />}>
              <Route
                path="/"
                element={
                  <Suspense fallback={<PageLoader />}>
                    <Dashboard />
                  </Suspense>
                }
              />
              <Route
                path="/dashboard"
                element={
                  <Suspense fallback={<PageLoader />}>
                    <Dashboard />
                  </Suspense>
                }
              />
              <Route
                path="/claims"
                element={
                  <Suspense fallback={<PageLoader />}>
                    <ClaimsList />
                  </Suspense>
                }
              />
              <Route
                path="/claims/new"
                element={
                  <Suspense fallback={<PageLoader />}>
                    <NewClaim />
                  </Suspense>
                }
              />
              <Route
                path="/claims/:id"
                element={
                  <Suspense fallback={<PageLoader />}>
                    <ClaimDetails />
                  </Suspense>
                }
              />
              <Route
                path="/approvals"
                element={
                  <Suspense fallback={<PageLoader />}>
                    <ApprovalQueue />
                  </Suspense>
                }
              />
              <Route
                path="/allowances"
                element={
                  <Suspense fallback={<PageLoader />}>
                    <AllowancesList />
                  </Suspense>
                }
              />
              <Route
                path="/allowances/new"
                element={
                  <Suspense fallback={<PageLoader />}>
                    <NewClaim />
                  </Suspense>
                }
              />
              <Route
                path="/allowances/:id"
                element={
                  <Suspense fallback={<PageLoader />}>
                    <AllowanceDetails />
                  </Suspense>
                }
              />
              <Route
                path="/employees"
                element={
                  <Suspense fallback={<PageLoader />}>
                    <Employees />
                  </Suspense>
                }
              />
              <Route
                path="/projects"
                element={
                  <Suspense fallback={<PageLoader />}>
                    <Projects />
                  </Suspense>
                }
              />
              <Route
                path="/settlements"
                element={
                  <Suspense fallback={<PageLoader />}>
                    <Settlements />
                  </Suspense>
                }
              />
              <Route
                path="/reports"
                element={
                  <Suspense fallback={<PageLoader />}>
                    <Reports />
                  </Suspense>
                }
              />
              <Route
                path="/profile"
                element={
                  <Suspense fallback={<PageLoader />}>
                    <Profile />
                  </Suspense>
                }
              />
              <Route
                path="/settings"
                element={
                  <Suspense fallback={<PageLoader />}>
                    <Settings />
                  </Suspense>
                }
              />
            </Route>
            <Route
              path="*"
              element={
                <Suspense fallback={<PageLoader />}>
                  <NotFound />
                </Suspense>
              }
            />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
