import { lazy, Suspense } from 'react';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import { BrandingProvider } from '@/contexts/BrandingContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { LoadingSpinner } from '@/components/layout/LoadingSpinner';
import { ProtectedRoute } from '@/components/ProtectedRoute';

// Lazy load pages for better performance
const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const ClaimsList = lazy(() => import('./pages/ClaimsList'));
const ClaimDetails = lazy(() => import('./pages/ClaimDetails'));
const EditClaim = lazy(() => import('./pages/EditClaim'));
const NewClaim = lazy(() => import('./pages/NewClaim'));
const ApprovalQueue = lazy(() => import('./pages/ApprovalQueue'));
const AllowancesList = lazy(() => import('./pages/AllowancesList'));
const AllowanceDetails = lazy(() => import('./pages/AllowanceDetails'));
const NewAllowance = lazy(() => import('./pages/NewAllowance'));
const Employees = lazy(() => import('./pages/Employees'));
const EmployeeDetails = lazy(() => import('./pages/EmployeeDetails'));
const Projects = lazy(() => import('./pages/Projects'));
const IBUManagement = lazy(() => import('./pages/IBUManagement'));
const Departments = lazy(() => import('./pages/Departments'));
const Policies = lazy(() => import('./pages/Policies'));
const ClaimManagement = lazy(() => import('./pages/ClaimManagement'));
const RegionManagement = lazy(() => import('./pages/RegionManagement'));
const ApprovalRules = lazy(() => import('./pages/ApprovalRules'));
const Settlements = lazy(() => import('./pages/Settlements'));
const SettlementsPending = lazy(() => import('./pages/SettlementsPending'));
const SettlementsCompleted = lazy(() => import('./pages/SettlementsCompleted'));
const Reports = lazy(() => import('./pages/Reports'));
const Profile = lazy(() => import('./pages/Profile'));
const Settings = lazy(() => import('./pages/Settings'));
const NotFound = lazy(() => import('./pages/NotFound'));
// System Admin pages
const Tenants = lazy(() => import('./pages/Tenants'));
const Designations = lazy(() => import('./pages/Designations'));
const SystemAdminSettings = lazy(() => import('./pages/SystemAdminSettings'));

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
      <BrandingProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              {/* Public route - Login page */}
              <Route
                path="/login"
                element={
                  <Suspense fallback={<PageLoader />}>
                    <Login />
                  </Suspense>
                }
              />

            {/* Protected routes */}
            <Route element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }>
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
                path="/claims/:id/edit"
                element={
                  <Suspense fallback={<PageLoader />}>
                    <EditClaim />
                  </Suspense>
                }
              />
              <Route
                path="/approvals"
                element={
                  <Suspense fallback={<PageLoader />}>
                    <ProtectedRoute allowedRoles={['manager', 'hr', 'finance', 'admin']}>
                      <ApprovalQueue />
                    </ProtectedRoute>
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
                    <ProtectedRoute allowedRoles={['hr', 'admin']}>
                      <Employees />
                    </ProtectedRoute>
                  </Suspense>
                }
              />
              <Route
                path="/employees/:id"
                element={
                  <Suspense fallback={<PageLoader />}>
                    <ProtectedRoute allowedRoles={['hr', 'admin']}>
                      <EmployeeDetails />
                    </ProtectedRoute>
                  </Suspense>
                }
              />
              <Route
                path="/projects"
                element={
                  <Suspense fallback={<PageLoader />}>
                    <ProtectedRoute allowedRoles={['hr', 'finance', 'admin']}>
                      <Projects />
                    </ProtectedRoute>
                  </Suspense>
                }
              />
              <Route
                path="/ibus"
                element={
                  <Suspense fallback={<PageLoader />}>
                    <ProtectedRoute allowedRoles={['admin']}>
                      <IBUManagement />
                    </ProtectedRoute>
                  </Suspense>
                }
              />
              <Route
                path="/departments"
                element={
                  <Suspense fallback={<PageLoader />}>
                    <ProtectedRoute allowedRoles={['admin']}>
                      <Departments />
                    </ProtectedRoute>
                  </Suspense>
                }
              />
              <Route
                path="/policies"
                element={
                  <Suspense fallback={<PageLoader />}>
                    <ProtectedRoute allowedRoles={['admin']}>
                      <Policies />
                    </ProtectedRoute>
                  </Suspense>
                }
              />
              <Route
                path="/policies/regions"
                element={
                  <Suspense fallback={<PageLoader />}>
                    <ProtectedRoute allowedRoles={['admin']}>
                      <RegionManagement />
                    </ProtectedRoute>
                  </Suspense>
                }
              />
              <Route
                path="/policies/claims"
                element={
                  <Suspense fallback={<PageLoader />}>
                    <ProtectedRoute allowedRoles={['admin']}>
                      <ClaimManagement />
                    </ProtectedRoute>
                  </Suspense>
                }
              />
              <Route
                path="/approval-rules"
                element={
                  <Suspense fallback={<PageLoader />}>
                    <ProtectedRoute allowedRoles={['admin']}>
                      <ApprovalRules />
                    </ProtectedRoute>
                  </Suspense>
                }
              />
              <Route
                path="/settlements"
                element={
                  <Suspense fallback={<PageLoader />}>
                    <ProtectedRoute allowedRoles={['finance', 'admin']}>
                      <Settlements />
                    </ProtectedRoute>
                  </Suspense>
                }
              />
              <Route
                path="/settlements/pending"
                element={
                  <Suspense fallback={<PageLoader />}>
                    <ProtectedRoute allowedRoles={['finance', 'admin']}>
                      <SettlementsPending />
                    </ProtectedRoute>
                  </Suspense>
                }
              />
              <Route
                path="/settlements/completed"
                element={
                  <Suspense fallback={<PageLoader />}>
                    <ProtectedRoute allowedRoles={['finance', 'admin']}>
                      <SettlementsCompleted />
                    </ProtectedRoute>
                  </Suspense>
                }
              />
              <Route
                path="/reports"
                element={
                  <Suspense fallback={<PageLoader />}>
                    <ProtectedRoute allowedRoles={['manager', 'hr', 'finance', 'admin']}>
                      <Reports />
                    </ProtectedRoute>
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
                    <ProtectedRoute allowedRoles={['admin']}>
                      <Settings />
                    </ProtectedRoute>
                  </Suspense>
                }
              />
              {/* System Admin Routes */}
              <Route
                path="/admin/tenants"
                element={
                  <Suspense fallback={<PageLoader />}>
                    <ProtectedRoute allowedRoles={['system_admin', 'admin']}>
                      <Tenants />
                    </ProtectedRoute>
                  </Suspense>
                }
              />
              <Route
                path="/admin/designations"
                element={
                  <Suspense fallback={<PageLoader />}>
                    <ProtectedRoute allowedRoles={['system_admin', 'admin']}>
                      <Designations />
                    </ProtectedRoute>
                  </Suspense>
                }
              />
              <Route
                path="/admin/settings"
                element={
                  <Suspense fallback={<PageLoader />}>
                    <ProtectedRoute allowedRoles={['system_admin']}>
                      <SystemAdminSettings />
                    </ProtectedRoute>
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
      </BrandingProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
