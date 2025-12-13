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
    badge: 5,
    roles: ['manager', 'hr', 'finance', 'admin'],
  },
  {
    label: 'Reports',
    href: '/reports',
    icon: 'BarChart3',
    roles: ['manager', 'hr', 'finance', 'admin'],
  },
];

export const adminNavigation: NavItem[] = [
  {
    label: 'Employees',
    href: '/employees',
    icon: 'Users',
    roles: ['hr', 'admin'],
  },
  {
    label: 'Projects',
    href: '/projects',
    icon: 'FolderKanban',
    roles: ['hr', 'finance', 'admin'],
  },
  {
    label: 'Settlements',
    href: '/settlements',
    icon: 'Wallet',
    roles: ['finance', 'admin'],
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

export function getNavigationForRole(role: UserRole): NavItem[] {
  const filterByRole = (items: NavItem[]) =>
    items.filter((item) => !item.roles || item.roles.includes(role));

  return [...filterByRole(mainNavigation), ...filterByRole(adminNavigation)];
}
