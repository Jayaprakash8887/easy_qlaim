import { NavItem, UserRole } from '@/types';

export const mainNavigation: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/',
    icon: 'LayoutDashboard',
  },
  {
    label: 'My Claims',
    href: '/claims',
    icon: 'Receipt',
    roles: ['employee', 'manager', 'hr', 'finance', 'admin'],
  },
  {
    label: 'New Claim',
    href: '/claims/new',
    icon: 'Plus',
    roles: ['employee', 'manager', 'hr', 'finance', 'admin'],
  },
  {
    label: 'Approvals',
    href: '/approvals',
    icon: 'CheckSquare',
    roles: ['manager', 'hr', 'finance', 'admin'],
  },
  {
    label: 'Reports',
    href: '/reports',
    icon: 'BarChart3',
    roles: ['hr', 'finance', 'admin'],
  },
];

export const adminNavigation: NavItem[] = [
  {
    label: 'Employees',
    href: '/employees',
    icon: 'Users',
    roles: ['admin'],
  },
  {
    label: 'Projects',
    href: '/projects',
    icon: 'FolderKanban',
    roles: ['admin'],
  },
  {
    label: 'IBUs',
    href: '/ibus',
    icon: 'Building',
    roles: ['admin'],
  },
  {
    label: 'Settlements',
    href: '/settlements',
    icon: 'Wallet',
    roles: ['finance', 'admin'],
    children: [
      {
        label: 'Finance Approved',
        href: '/settlements/pending',
        icon: 'Clock',
      },
      {
        label: 'Settled',
        href: '/settlements/completed',
        icon: 'CheckCircle2',
      },
    ],
  },
  {
    label: 'Settings',
    href: '/settings',
    icon: 'Settings',
    roles: ['admin'],
  },
];

export const userNavigation: NavItem[] = [
  {
    label: 'Profile',
    href: '/profile',
    icon: 'User',
  },
];

// Admin-only navigation - only these menus are shown for admin role
export const adminOnlyNavigation: NavItem[] = [
  {
    label: 'Employees',
    href: '/employees',
    icon: 'Users',
  },
  {
    label: 'Projects',
    href: '/projects',
    icon: 'FolderKanban',
  },
  {
    label: 'IBUs',
    href: '/ibus',
    icon: 'Building',
  },
  {
    label: 'Departments',
    href: '/departments',
    icon: 'Users',
  },
  {
    label: 'Policies',
    href: '/policies',
    icon: 'FileText',
    children: [
      {
        label: 'Region Management',
        href: '/policies/regions',
        icon: 'Globe',
      },
      {
        label: 'Policy Management',
        href: '/policies',
        icon: 'FileText',
      },
      {
        label: 'Claim Management',
        href: '/policies/claims',
        icon: 'ListChecks',
      },
    ],
  },
  {
    label: 'Settings',
    href: '/settings',
    icon: 'Settings',
  },
];

// System Admin navigation - platform-level administration only
export const systemAdminNavigation: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/',
    icon: 'LayoutDashboard',
  },
  {
    label: 'Tenants',
    href: '/admin/tenants',
    icon: 'Building2',
  },
  {
    label: 'Designations',
    href: '/admin/designations',
    icon: 'Briefcase',
  },
  {
    label: 'Settings',
    href: '/admin/settings',
    icon: 'Settings',
  },
];

export function getNavigationForRole(role: UserRole): NavItem[] {
  // System Admin users see platform administration menu only
  if (role === 'system_admin') {
    return systemAdminNavigation;
  }

  // Admin users see both employee navigation AND admin-only navigation
  // They are also employees who can raise claims
  if (role === 'admin') {
    // Get employee-level navigation (Dashboard, My Claims, New Claim)
    const employeeNav = mainNavigation.filter(
      (item) => !item.roles || item.roles.includes('employee')
    );
    // Combine with admin-only navigation
    return [...employeeNav, ...adminOnlyNavigation];
  }

  const filterByRole = (items: NavItem[]) =>
    items.filter((item) => !item.roles || item.roles.includes(role));

  return [...filterByRole(mainNavigation), ...filterByRole(adminNavigation)];
}

