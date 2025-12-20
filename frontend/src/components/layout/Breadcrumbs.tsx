import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

const routeLabels: Record<string, string> = {
  '': 'Dashboard',
  claims: 'Claims',
  new: 'New Claim',
  approvals: 'Approvals',
  reports: 'Reports',
  employees: 'Employees',
  projects: 'Projects',
  settlements: 'Settlements',
  settings: 'Settings',
  profile: 'Profile',
  tenants: 'Tenants',
  designations: 'Designations',
  admin: 'Admin',
};

// Segments to skip for specific roles
const skipSegmentsForRole: Record<string, string[]> = {
  system_admin: ['admin'], // System admin doesn't need "Admin" in breadcrumb
};

export function Breadcrumbs() {
  const location = useLocation();
  const { user } = useAuth();
  const pathSegments = location.pathname.split('/').filter(Boolean);
  
  // Filter out segments that should be skipped for this user's role
  const skipSegments = user?.role ? (skipSegmentsForRole[user.role] || []) : [];
  const filteredSegments = pathSegments.filter(segment => !skipSegments.includes(segment));

  const breadcrumbs: BreadcrumbItem[] = [
    { label: 'Home', href: '/' },
    ...filteredSegments.map((segment, index) => {
      // Build href from original path segments up to this filtered segment
      const originalIndex = pathSegments.indexOf(segment);
      const href = '/' + pathSegments.slice(0, originalIndex + 1).join('/');
      // Check if it's a dynamic segment (like claim ID)
      const label = segment.startsWith('CLM-') || /^\d+$/.test(segment)
        ? segment
        : routeLabels[segment] || segment.charAt(0).toUpperCase() + segment.slice(1);
      
      return {
        label,
        href: index === filteredSegments.length - 1 ? undefined : href,
      };
    }),
  ];

  if (filteredSegments.length === 0) {
    return null;
  }

  return (
    <nav aria-label="Breadcrumb" className="mb-6">
      <ol className="flex items-center gap-2 text-sm">
        {breadcrumbs.map((crumb, index) => (
          <li key={index} className="flex items-center gap-2">
            {index > 0 && (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
            {crumb.href ? (
              <Link
                to={crumb.href}
                className={cn(
                  'flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors',
                  index === 0 && 'text-muted-foreground'
                )}
              >
                {index === 0 && <Home className="h-4 w-4" />}
                <span>{crumb.label}</span>
              </Link>
            ) : (
              <span className="font-medium text-foreground">{crumb.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
