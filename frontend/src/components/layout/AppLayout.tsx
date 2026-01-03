import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { Breadcrumbs } from './Breadcrumbs';
import { useIsMobile } from '@/hooks/use-mobile';
import { TourProvider } from '@/contexts/TourContext';
import { ProductTour } from '@/components/tour/ProductTour';

export function AppLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isMobile = useIsMobile();

  return (
    <TourProvider>
      <div className="min-h-screen bg-background">
        <Header onMenuClick={() => setMobileMenuOpen(!mobileMenuOpen)} />

        {/* Mobile Sidebar Overlay */}
        {isMobile && mobileMenuOpen && (
          <div
            className="fixed inset-0 z-30 bg-background/80 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        {/* Sidebar */}
        <div className={cn('hidden lg:block', isMobile && mobileMenuOpen && '!block')}>
          <Sidebar
            collapsed={sidebarCollapsed}
            onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          />
        </div>

        {/* Main Content */}
        <main
          className={cn(
            'min-h-[calc(100vh-5rem)] pt-20 transition-all duration-300',
            !isMobile && (sidebarCollapsed ? 'lg:pl-16' : 'lg:pl-64')
          )}
        >
          <div className="container mx-auto px-6 py-4">
            <Breadcrumbs />
            <Outlet />
          </div>
        </main>

        {/* Product Tour */}
        <ProductTour />
      </div>
    </TourProvider>
  );
}
