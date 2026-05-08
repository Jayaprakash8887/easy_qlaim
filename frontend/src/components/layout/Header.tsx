import { Link } from 'react-router-dom';
import {
  Menu,
  LogOut,
  User,
  Settings,
  HelpCircle,
  ChevronDown,
  PlayCircle,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useBranding } from '@/contexts/BrandingContext';
import { useTour } from '@/contexts/TourContext';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { GlobalSearch } from './GlobalSearch';
import { NotificationsBell } from './NotificationsBell';

interface HeaderProps {
  onMenuClick: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const { user, logout } = useAuth();
  const { branding } = useBranding();
  const { startTour } = useTour();

  // Use tenant logo if available, otherwise fall back to Easy Qlaim default
  const logoUrl = branding?.logo_url || '/logo-horizontal.svg';
  const appName = branding?.logo_url ? 'Logo' : 'Easy Qlaim';

  return (
    <header className="sticky top-0 z-50 h-20 border-b border-border bg-card/95 backdrop-blur">
      <div className="flex h-full items-center justify-between px-5">
        {/* Left Section */}
        <div className="flex items-center gap-5">
          <Button variant="ghost" size="icon" onClick={onMenuClick} className="lg:hidden h-10 w-10">
            <Menu className="h-6 w-6" />
          </Button>

          <Link to="/" className="flex items-center gap-3">
            <img
              src={logoUrl}
              alt={appName}
              className="h-12 max-w-[200px] object-contain"
            />
          </Link>
        </div>

        {/* Center - Global Search */}
        <div className="hidden flex-1 max-w-lg px-8 md:block">
          <GlobalSearch />
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-3">
          {/* Notifications */}
          <NotificationsBell />

          {/* Help Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="hidden sm:flex h-10 w-10"
                data-tour="help-menu"
              >
                <HelpCircle className="h-6 w-6" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Help & Support</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={startTour} className="cursor-pointer">
                <PlayCircle className="mr-2 h-4 w-4" />
                Rewatch Tour
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="gap-2 px-2 h-auto py-1">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={user?.avatar} alt={user?.name} />
                  <AvatarFallback>
                    {user?.name
                      ?.split(' ')
                      .map((n) => n[0])
                      .join('')}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden flex-col items-start text-left md:flex">
                  <span className="text-sm font-medium">{user?.name}</span>
                  <span className="text-xs text-muted-foreground capitalize">
                    {user?.role}
                  </span>
                </div>
                <ChevronDown className="h-4 w-4 text-muted-foreground hidden md:block" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/profile" className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={logout} className="text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
