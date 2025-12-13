import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';
import { cn } from '@/lib/utils';

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
};

export function Breadcrumbs() {
  const location = useLocation();
  const pathSegments = location.pathname.split('/').filter(Boolean);

  const breadcrumbs: BreadcrumbItem[] = [
    { label: 'Home', href: '/' },
    ...pathSegments.map((segment, index) => {
      const href = '/' + pathSegments.slice(0, index + 1).join('/');
      // Check if it's a dynamic segment (like claim ID)
      const label = segment.startsWith('CLM-') || /^\d+$/.test(segment)
        ? segment
        : routeLabels[segment] || segment.charAt(0).toUpperCase() + segment.slice(1);
      
      return {
        label,
        href: index === pathSegments.length - 1 ? undefined : href,
      };
    }),
  ];

  if (pathSegments.length === 0) {
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
