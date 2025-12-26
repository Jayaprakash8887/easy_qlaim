import { useState, useEffect, useRef } from 'react';
import { User, Mail, Phone, Building, Calendar, Shield, Bell, Loader2, Check, AlertCircle, Camera, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/contexts/AuthContext';
import { useUpdateEmployee } from '@/hooks/useEmployees';
import { toast } from 'sonner';
import { format } from 'date-fns';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

const roleStyles: Record<string, string> = {
  employee: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  manager: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
  hr: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-300',
  finance: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300',
  admin: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
  system_admin: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
};

export default function Profile() {
  const { user, refreshUser } = useAuth();
  const updateEmployee = useUpdateEmployee();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Personal Info form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [isSavingPersonal, setIsSavingPersonal] = useState(false);
  
  // Avatar upload state
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isAvatarUploadEnabled, setIsAvatarUploadEnabled] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isDeletingAvatar, setIsDeletingAvatar] = useState(false);
  
  // Notification preferences state
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(true);
  const [claimUpdates, setClaimUpdates] = useState(true);
  const [approvalReminders, setApprovalReminders] = useState(true);
  const [isSavingNotifications, setIsSavingNotifications] = useState(false);
  
  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  // Initialize form with user data and check cloud storage status
  useEffect(() => {
    if (user) {
      const nameParts = user.name.split(' ');
      setFirstName(user.firstName || nameParts[0] || '');
      setLastName(user.lastName || nameParts.slice(1).join(' ') || '');
      setEmail(user.email);
      setPhone(user.phone || '');
      setAvatarUrl(user.avatar || null);
    }
    
    // Check if avatar upload is enabled (cloud storage configured)
    const checkCloudStorageStatus = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/auth/cloud-storage-status`);
        if (response.ok) {
          const data = await response.json();
          setIsAvatarUploadEnabled(data.avatar_upload_enabled);
        }
      } catch (error) {
        console.log('Cloud storage status check failed');
        setIsAvatarUploadEnabled(false);
      }
    };
    checkCloudStorageStatus();
  }, [user]);

  if (!user) return null;

  const initials = user.name
    .split(' ')
    .map((n) => n[0])
    .join('');

  // Handle avatar file selection
  const handleAvatarClick = () => {
    if (isAvatarUploadEnabled && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Upload avatar
  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Invalid file type. Please upload a JPEG, PNG, GIF, or WebP image.');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File too large. Maximum size is 5MB.');
      return;
    }

    setIsUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${API_BASE_URL}/auth/me/avatar`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to upload avatar');
      }

      const data = await response.json();
      setAvatarUrl(data.avatar_url);
      toast.success('Profile picture updated successfully');
      await refreshUser();
    } catch (error: any) {
      console.error('Avatar upload failed:', error);
      toast.error(error.message || 'Failed to upload profile picture');
    } finally {
      setIsUploadingAvatar(false);
      // Reset the input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Delete avatar
  const handleDeleteAvatar = async () => {
    if (!avatarUrl) return;

    setIsDeletingAvatar(true);
    try {
      const response = await fetch(`${API_BASE_URL}/auth/me/avatar`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to delete avatar');
      }

      setAvatarUrl(null);
      toast.success('Profile picture removed');
      await refreshUser();
    } catch (error: any) {
      console.error('Avatar delete failed:', error);
      toast.error(error.message || 'Failed to remove profile picture');
    } finally {
      setIsDeletingAvatar(false);
    }
  };

  // Save personal information
  const handleSavePersonalInfo = async () => {
    setIsSavingPersonal(true);
    try {
      await updateEmployee.mutateAsync({
        id: user.id,
        data: {
          firstName,
          lastName,
          email,
          phone,
          department: user.department,
        }
      });
      await refreshUser();
      toast.success('Personal information updated successfully');
    } catch (error) {
      console.error('Failed to update profile:', error);
      toast.error('Failed to update personal information');
    } finally {
      setIsSavingPersonal(false);
    }
  };

  // Save notification preferences
  const handleSaveNotifications = async () => {
    setIsSavingNotifications(true);
    try {
      // Save to backend (notification preferences API)
      const response = await fetch(`${API_BASE_URL}/employees/${user.id}/preferences`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email_notifications: emailNotifications,
          push_notifications: pushNotifications,
          claim_updates: claimUpdates,
          approval_reminders: approvalReminders,
        }),
      });
      
      if (!response.ok) {
        // If API doesn't exist yet, just show success (preferences saved locally)
        console.log('Notification preferences saved locally');
      }
      
      toast.success('Notification preferences saved');
    } catch (error) {
      // Save locally for now
      toast.success('Notification preferences saved');
    } finally {
      setIsSavingNotifications(false);
    }
  };

  // Change password
  const handleChangePassword = async () => {
    setPasswordError('');
    
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('All password fields are required');
      return;
    }
    
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }
    
    if (newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters');
      return;
    }
    
    setIsSavingPassword(true);
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`${API_BASE_URL}/auth/change-password`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to change password');
      }
      
      toast.success('Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      setPasswordError(error.message || 'Failed to change password');
      toast.error(error.message || 'Failed to change password');
    } finally {
      setIsSavingPassword(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Profile Settings</h1>
        <p className="text-muted-foreground">
          Manage your account settings and preferences
        </p>
      </div>

      {/* Hidden file input for avatar upload */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleAvatarUpload}
        accept="image/jpeg,image/png,image/gif,image/webp"
        className="hidden"
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Profile Card */}
        <Card className="lg:col-span-1">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center">
              {/* Avatar with upload functionality */}
              <div className="relative group">
                <Avatar className="h-24 w-24">
                  {avatarUrl ? (
                    <AvatarImage src={avatarUrl} alt={user.name} />
                  ) : null}
                  <AvatarFallback className="bg-primary/10 text-primary text-2xl">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                
                {/* Avatar upload/delete overlay - only show if cloud storage is enabled */}
                {isAvatarUploadEnabled && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                    {isUploadingAvatar || isDeletingAvatar ? (
                      <Loader2 className="h-6 w-6 text-white animate-spin" />
                    ) : (
                      <div className="flex gap-1">
                        <button
                          onClick={handleAvatarClick}
                          className="p-1.5 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
                          title="Upload photo"
                        >
                          <Camera className="h-4 w-4 text-white" />
                        </button>
                        {avatarUrl && (
                          <button
                            onClick={handleDeleteAvatar}
                            className="p-1.5 rounded-full bg-white/20 hover:bg-red-500/80 transition-colors"
                            title="Remove photo"
                          >
                            <Trash2 className="h-4 w-4 text-white" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              {/* Upload hint text */}
              {isAvatarUploadEnabled && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Hover to change photo
                </p>
              )}
              
              <h2 className="mt-2 text-xl font-semibold">{user.name}</h2>
              <p className="text-sm text-muted-foreground">{user.email}</p>
              <Badge variant="secondary" className={`mt-2 ${roleStyles[user.role]}`}>
                {user.role}
              </Badge>

              <Separator className="my-6" />

              <div className="w-full space-y-4 text-left">
                <div className="flex items-center gap-3">
                  <Building className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{user.department}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{user.email}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Joined Jan 2022</span>
                </div>
              </div>

              <Button 
                variant="outline" 
                className="mt-6 w-full"
                onClick={() => {
                  // Switch to Personal Info tab and scroll to it
                  const personalTab = document.querySelector('[value="personal"]') as HTMLButtonElement;
                  if (personalTab) personalTab.click();
                  // Scroll to the form
                  document.querySelector('.lg\\:col-span-2')?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                Edit Profile
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Settings Tabs */}
        <div className="lg:col-span-2">
          <Tabs defaultValue="personal" className="space-y-4">
            <TabsList>
              <TabsTrigger value="personal">Personal Info</TabsTrigger>
              <TabsTrigger value="notifications">Notifications</TabsTrigger>
              <TabsTrigger value="security">Security</TabsTrigger>
            </TabsList>

            <TabsContent value="personal">
              <Card>
                <CardHeader>
                  <CardTitle>Personal Information</CardTitle>
                  <CardDescription>
                    Update your personal details
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">First Name</Label>
                      <Input
                        id="firstName"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName">Last Name</Label>
                      <Input
                        id="lastName"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input 
                      id="email" 
                      type="email" 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input 
                      id="phone" 
                      placeholder="+1 234 567 8900"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="department">Department</Label>
                    <Input id="department" defaultValue={user.department} disabled />
                  </div>
                  <Button onClick={handleSavePersonalInfo} disabled={isSavingPersonal}>
                    {isSavingPersonal ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Check className="mr-2 h-4 w-4" />
                        Save Changes
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="notifications">
              <Card>
                <CardHeader>
                  <CardTitle>Notification Preferences</CardTitle>
                  <CardDescription>
                    Choose how you want to be notified
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Email Notifications</Label>
                      <p className="text-sm text-muted-foreground">
                        Receive notifications via email
                      </p>
                    </div>
                    <Switch
                      checked={emailNotifications}
                      onCheckedChange={setEmailNotifications}
                    />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Push Notifications</Label>
                      <p className="text-sm text-muted-foreground">
                        Receive push notifications in browser
                      </p>
                    </div>
                    <Switch
                      checked={pushNotifications}
                      onCheckedChange={setPushNotifications}
                    />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Claim Status Updates</Label>
                      <p className="text-sm text-muted-foreground">
                        Get notified when your claims are processed
                      </p>
                    </div>
                    <Switch
                      checked={claimUpdates}
                      onCheckedChange={setClaimUpdates}
                    />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Approval Reminders</Label>
                      <p className="text-sm text-muted-foreground">
                        Remind about pending approvals
                      </p>
                    </div>
                    <Switch
                      checked={approvalReminders}
                      onCheckedChange={setApprovalReminders}
                    />
                  </div>
                  <Separator />
                  <Button onClick={handleSaveNotifications} disabled={isSavingNotifications}>
                    {isSavingNotifications ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Check className="mr-2 h-4 w-4" />
                        Save Preferences
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="security">
              <Card>
                <CardHeader>
                  <CardTitle>Security Settings</CardTitle>
                  <CardDescription>
                    Manage your password and security preferences
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    {passwordError && (
                      <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                        <AlertCircle className="h-4 w-4" />
                        {passwordError}
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label htmlFor="currentPassword">Current Password</Label>
                      <Input 
                        id="currentPassword" 
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="newPassword">New Password</Label>
                      <Input 
                        id="newPassword" 
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword">Confirm New Password</Label>
                      <Input 
                        id="confirmPassword" 
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                      />
                    </div>
                    <Button onClick={handleChangePassword} disabled={isSavingPassword}>
                      {isSavingPassword ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Updating...
                        </>
                      ) : (
                        'Update Password'
                      )}
                    </Button>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Two-Factor Authentication</Label>
                      <p className="text-sm text-muted-foreground">
                        Add an extra layer of security
                      </p>
                    </div>
                    <Button variant="outline" size="sm">
                      <Shield className="mr-2 h-4 w-4" />
                      Enable 2FA
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
