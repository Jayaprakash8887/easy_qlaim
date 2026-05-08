import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  FileText,
  CheckCircle,
  AlertCircle,
  Clock,
  Users,
  DollarSign,
  Building2,
  RefreshCw,
  X,
  Trash2,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import {
  useNotifications,
  useNotificationSummary,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  useClearNotification,
  useClearAllNotifications,
  Notification as DBNotification,
} from '@/hooks/useNotifications';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

// Auth helper
function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('access_token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

interface LocalNotification {
  id: string;
  type: 'claim_approved' | 'claim_rejected' | 'claim_returned' | 'pending_approval' | 'claim_submitted' | 'system' | 'tenant';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  actionUrl?: string;
  claimId?: string;
  priority: 'high' | 'medium' | 'low';
  isLocal?: boolean;
}

// Role-specific notification types
const notificationConfig: Record<string, { types: string[]; fetchEndpoints: string[] }> = {
  employee: {
    types: ['claim_approved', 'claim_rejected', 'claim_returned', 'system'],
    fetchEndpoints: ['my-claims-status'],
  },
  manager: {
    types: ['pending_approval', 'claim_submitted', 'system'],
    fetchEndpoints: ['pending-manager-approvals'],
  },
  hr: {
    types: ['pending_approval', 'claim_submitted', 'system'],
    fetchEndpoints: ['pending-hr-approvals'],
  },
  finance: {
    types: ['pending_approval', 'claim_submitted', 'system'],
    fetchEndpoints: ['pending-finance-approvals'],
  },
  admin: {
    types: ['claim_submitted', 'system'],
    fetchEndpoints: [],
  },
  system_admin: {
    types: ['tenant', 'system', 'pending_approval'],
    fetchEndpoints: ['system-alerts', 'tenant-activities'],
  },
};

export function NotificationsBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [localNotifications, setLocalNotifications] = useState<LocalNotification[]>([]);
  const [isLoadingLocal, setIsLoadingLocal] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  // Backend API hooks for persisted notifications
  const { data: dbNotifications = [], isLoading: isLoadingDb, refetch: refetchDb } = useNotifications(
    user?.id,
    user?.tenantId
  );
  const { data: summary, refetch: refetchSummary } = useNotificationSummary(
    user?.id,
    user?.tenantId
  );
  const markReadMutation = useMarkNotificationRead();
  const markAllReadMutation = useMarkAllNotificationsRead();
  const clearMutation = useClearNotification();
  const clearAllMutation = useClearAllNotifications();

  // Fetch dynamic notifications from pending approvals (real-time data)
  const fetchLocalNotifications = useCallback(async () => {
    if (!user) return;

    setIsLoadingLocal(true);
    const fetchedNotifications: LocalNotification[] = [];

    try {
      const role = user.role || 'employee';
      const tenantParam = user.tenantId ? `tenant_id=${user.tenantId}` : '';
      const userIdParam = user.id ? `&user_id=${user.id}` : '';
      const roleParam = `&role=${role}`;

      // Fetch pending approvals based on role (exclude admin - they don't need approval notifications)
      if (['manager', 'hr', 'finance'].includes(role)) {
        const pendingResponse = await fetch(
          `${API_BASE_URL}/dashboard/pending-approvals?${tenantParam}${userIdParam}${roleParam}`,
          { headers: getAuthHeaders() }
        );
        if (pendingResponse.ok) {
          const pendingData = await pendingResponse.json();

          if (role === 'manager' && pendingData.manager_pending > 0) {
            fetchedNotifications.push({
              id: 'pending-manager',
              type: 'pending_approval',
              title: 'Manager Approvals Pending',
              message: `${pendingData.manager_pending} claim(s) from your team waiting for approval`,
              timestamp: new Date(),
              read: false,
              actionUrl: '/approvals',
              priority: 'high',
            });
          }

          if (role === 'hr' && pendingData.hr_pending > 0) {
            fetchedNotifications.push({
              id: 'pending-hr',
              type: 'pending_approval',
              title: 'HR Approvals Pending',
              message: `${pendingData.hr_pending} claim(s) waiting for HR review`,
              timestamp: new Date(),
              read: false,
              actionUrl: '/approvals',
              priority: 'high',
            });
          }

          if (role === 'finance' && pendingData.finance_pending > 0) {
            fetchedNotifications.push({
              id: 'pending-finance',
              type: 'pending_approval',
              title: 'Finance Approvals Pending',
              message: `${pendingData.finance_pending} claim(s) waiting for payment processing`,
              timestamp: new Date(),
              read: false,
              actionUrl: '/approvals',
              priority: 'high',
            });
          }
        }
      }

      // For employees - fetch their recent claim status updates
      if (role === 'employee') {
        const claimsResponse = await fetch(
          `${API_BASE_URL}/claims/?${tenantParam}`,
          { headers: getAuthHeaders() }
        );
        if (claimsResponse.ok) {
          const claimsData = await claimsResponse.json();
          const claims = claimsData.claims || [];

          // Filter for user's claims and recent status changes
          const myClaims = claims.filter((c: any) => c.employee_id === user.id);

          // Check for approved claims
          const approvedClaims = myClaims.filter((c: any) =>
            c.status === 'FINANCE_APPROVED' || c.status === 'HR_APPROVED' || c.status === 'MANAGER_APPROVED'
          );
          if (approvedClaims.length > 0) {
            fetchedNotifications.push({
              id: 'claims-approved',
              type: 'claim_approved',
              title: 'Claims Approved',
              message: `${approvedClaims.length} of your claim(s) have been approved`,
              timestamp: new Date(),
              read: false,
              actionUrl: '/claims',
              priority: 'medium',
            });
          }

          // Check for returned claims
          const returnedClaims = myClaims.filter((c: any) =>
            c.status === 'RETURNED_TO_EMPLOYEE'
          );
          if (returnedClaims.length > 0) {
            fetchedNotifications.push({
              id: 'claims-returned',
              type: 'claim_returned',
              title: 'Action Required',
              message: `${returnedClaims.length} claim(s) returned for correction`,
              timestamp: new Date(),
              read: false,
              actionUrl: '/claims?status=returned',
              priority: 'high',
            });
          }

          // Check for rejected claims
          const rejectedClaims = myClaims.filter((c: any) => c.status === 'REJECTED');
          if (rejectedClaims.length > 0) {
            fetchedNotifications.push({
              id: 'claims-rejected',
              type: 'claim_rejected',
              title: 'Claims Rejected',
              message: `${rejectedClaims.length} claim(s) have been rejected`,
              timestamp: new Date(),
              read: false,
              actionUrl: '/claims?status=rejected',
              priority: 'high',
            });
          }

          // Pending claims info
          const pendingClaims = myClaims.filter((c: any) =>
            c.status?.includes('PENDING')
          );
          if (pendingClaims.length > 0) {
            fetchedNotifications.push({
              id: 'claims-pending',
              type: 'system',
              title: 'Claims In Progress',
              message: `${pendingClaims.length} claim(s) are being processed`,
              timestamp: new Date(),
              read: true, // Mark as read since it's informational
              actionUrl: '/claims',
              priority: 'low',
            });
          }
        }
      }

      // For System Admin - tenant and system notifications
      if (role === 'system_admin') {
        const tenantsResponse = await fetch(`${API_BASE_URL}/tenants/?tenant_id=${user.tenantId || ''}`, {
          headers: getAuthHeaders(),
        });
        if (tenantsResponse.ok) {
          const tenants = await tenantsResponse.json();
          const activeTenants = tenants.filter((t: any) => t.is_active).length;

          fetchedNotifications.push({
            id: 'tenants-overview',
            type: 'tenant',
            title: 'System Overview',
            message: `${activeTenants} active tenant(s) in the system`,
            timestamp: new Date(),
            read: true,
            actionUrl: '/system-admin/tenants',
            priority: 'low',
          });
        }

        // Check for any pending items across all tenants
        const pendingResponse = await fetch(`${API_BASE_URL}/dashboard/pending-approvals?tenant_id=${user.tenantId || ''}`, {
          headers: getAuthHeaders(),
        });
        if (pendingResponse.ok) {
          const pendingData = await pendingResponse.json();
          if (pendingData.total_pending > 0) {
            fetchedNotifications.push({
              id: 'system-pending',
              type: 'pending_approval',
              title: 'System-wide Pending',
              message: `${pendingData.total_pending} claim(s) pending across all tenants`,
              timestamp: new Date(),
              read: false,
              actionUrl: '/system-admin/reports',
              priority: 'medium',
            });
          }
        }
      }

      // Sort by priority and timestamp
      fetchedNotifications.sort((a, b) => {
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
          return priorityOrder[a.priority] - priorityOrder[b.priority];
        }
        return b.timestamp.getTime() - a.timestamp.getTime();
      });

      setLocalNotifications(fetchedNotifications);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setIsLoadingLocal(false);
    }
  }, [user]);

  // Fetch notifications on mount and when user changes
  useEffect(() => {
    fetchLocalNotifications();

    // Refresh notifications every 3 minutes
    const interval = setInterval(fetchLocalNotifications, 180000);
    return () => clearInterval(interval);
  }, [fetchLocalNotifications]);

  // Refetch when dropdown opens
  useEffect(() => {
    if (isOpen) {
      fetchLocalNotifications();
      refetchDb();
      refetchSummary();
    }
  }, [isOpen, fetchLocalNotifications, refetchDb, refetchSummary]);

  // Combine database notifications with dynamic local ones
  const allNotifications: LocalNotification[] = [
    // Convert DB notifications to local format
    ...dbNotifications.map((n: DBNotification) => ({
      id: n.id,
      type: n.type as LocalNotification['type'],
      title: n.title,
      message: n.message,
      timestamp: new Date(n.created_at),
      read: n.is_read,
      actionUrl: n.action_url || undefined,
      priority: n.priority as LocalNotification['priority'],
      isLocal: false,
    })),
    // Add dynamic local notifications
    ...localNotifications.map(n => ({ ...n, isLocal: true })),
  ].sort((a, b) => {
    // Sort by priority first, then by timestamp
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    }
    return b.timestamp.getTime() - a.timestamp.getTime();
  });

  // Calculate unread count
  const unreadCount = (summary?.unread || 0) + localNotifications.filter(n => !n.read).length;
  const isLoading = isLoadingDb || isLoadingLocal;

  const handleNotificationClick = async (notification: LocalNotification) => {
    // Mark as read if it's a DB notification
    if (!notification.isLocal && !notification.read) {
      try {
        await markReadMutation.mutateAsync(notification.id);
      } catch (error) {
        console.error('Failed to mark notification as read:', error);
      }
    } else if (notification.isLocal) {
      // Mark local notification as read
      setLocalNotifications(prev =>
        prev.map(n => n.id === notification.id ? { ...n, read: true } : n)
      );
    }

    // Navigate if there's an action URL
    if (notification.actionUrl) {
      navigate(notification.actionUrl);
    }
    setIsOpen(false);
  };

  const markAllAsRead = async () => {
    if (!user?.id) return;
    try {
      await markAllReadMutation.mutateAsync({
        userId: user.id,
        tenantId: user.tenantId
      });
      // Also mark local notifications as read
      setLocalNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const handleClearNotification = async (e: React.MouseEvent, notificationId: string, isLocal: boolean) => {
    e.stopPropagation();
    if (isLocal) {
      setLocalNotifications(prev => prev.filter(n => n.id !== notificationId));
    } else {
      try {
        await clearMutation.mutateAsync(notificationId);
      } catch (error) {
        console.error('Failed to clear notification:', error);
      }
    }
  };

  const handleClearAll = async () => {
    if (!user?.id) return;
    try {
      await clearAllMutation.mutateAsync({
        userId: user.id,
        tenantId: user.tenantId
      });
      setLocalNotifications([]);
    } catch (error) {
      console.error('Failed to clear all notifications:', error);
    }
  };

  const handleRefresh = () => {
    fetchLocalNotifications();
    refetchDb();
    refetchSummary();
  };

  const getNotificationIcon = (type: LocalNotification['type']) => {
    switch (type) {
      case 'claim_approved':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'claim_rejected':
        return <X className="h-4 w-4 text-red-500" />;
      case 'claim_returned':
        return <AlertCircle className="h-4 w-4 text-orange-500" />;
      case 'pending_approval':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'claim_submitted':
        return <FileText className="h-4 w-4 text-blue-500" />;
      case 'tenant':
        return <Building2 className="h-4 w-4 text-purple-500" />;
      case 'system':
      default:
        return <Bell className="h-4 w-4 text-gray-500" />;
    }
  };

  const getPriorityColor = (priority: LocalNotification['priority']) => {
    switch (priority) {
      case 'high':
        return 'border-l-red-500';
      case 'medium':
        return 'border-l-yellow-500';
      case 'low':
      default:
        return 'border-l-gray-300';
    }
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -right-1 -top-1 h-5 min-w-[20px] px-1 text-xs"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-96">
        <div className="flex items-center justify-between px-2">
          <DropdownMenuLabel>Notifications</DropdownMenuLabel>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={(e) => {
                  e.preventDefault();
                  markAllAsRead();
                }}
                disabled={markAllReadMutation.isPending}
              >
                <Check className="h-3 w-3 mr-1" />
                Mark all read
              </Button>
            )}
            {allNotifications.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-muted-foreground hover:text-destructive"
                onClick={(e) => {
                  e.preventDefault();
                  handleClearAll();
                }}
                disabled={clearAllMutation.isPending}
                title="Clear all notifications"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={(e) => {
                e.preventDefault();
                handleRefresh();
              }}
            >
              <RefreshCw className={cn("h-3 w-3", isLoading && "animate-spin")} />
            </Button>
          </div>
        </div>
        <DropdownMenuSeparator />

        {allNotifications.length === 0 ? (
          <div className="py-8 text-center">
            <Bell className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
            <p className="text-sm text-muted-foreground">No notifications</p>
            <p className="text-xs text-muted-foreground mt-1">You're all caught up!</p>
          </div>
        ) : (
          <div className="max-h-96 overflow-y-auto">
            {allNotifications.map((notification) => (
              <DropdownMenuItem
                key={notification.id}
                className={cn(
                  'flex items-start gap-3 p-3 cursor-pointer border-l-4 group',
                  getPriorityColor(notification.priority),
                  !notification.read && 'bg-accent/50'
                )}
                onClick={() => handleNotificationClick(notification)}
              >
                <div className="flex-shrink-0 mt-0.5">
                  {getNotificationIcon(notification.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "font-medium text-sm",
                      !notification.read && "text-foreground",
                      notification.read && "text-muted-foreground"
                    )}>
                      {notification.title}
                    </span>
                    {!notification.read && (
                      <span className="h-2 w-2 rounded-full bg-primary flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                    {notification.message}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                  onClick={(e) => handleClearNotification(e, notification.id, notification.isLocal || false)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </DropdownMenuItem>
            ))}
          </div>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="justify-center text-primary cursor-pointer"
          onClick={() => {
            navigate('/notifications');
            setIsOpen(false);
          }}
        >
          View all notifications
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
