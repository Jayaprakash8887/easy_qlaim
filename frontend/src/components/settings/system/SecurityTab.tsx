import { useState } from 'react';
import {
    Shield,
    Clock,
    Lock,
    Loader2,
    Save,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { PlatformSettings, SESSION_TIMEOUT_OPTIONS, DEFAULT_PLATFORM_SETTINGS } from './types';

interface SecurityTabProps {
    platformSettings?: PlatformSettings;
    onSettingsChange?: (settings: PlatformSettings) => void;
}

export function SecurityTab({
    platformSettings: externalSettings,
    onSettingsChange
}: SecurityTabProps) {
    const [isSaving, setIsSaving] = useState(false);
    const [settings, setSettings] = useState<PlatformSettings>(
        externalSettings || DEFAULT_PLATFORM_SETTINGS
    );

    const handleChange = (key: keyof PlatformSettings, value: string | number | boolean) => {
        const newSettings = { ...settings, [key]: value };
        setSettings(newSettings);
        onSettingsChange?.(newSettings);
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await new Promise(resolve => setTimeout(resolve, 500));
            toast.success('Security settings saved successfully');
        } catch (error) {
            toast.error('Failed to save security settings');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Security Configuration</CardTitle>
                <CardDescription>
                    Authentication and security settings for the platform
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Session Timeout */}
                <div className="space-y-3">
                    <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <Label>Platform Session Timeout</Label>
                    </div>
                    <p className="text-sm text-muted-foreground">
                        Default session duration for all users. Individual tenants can override this with a shorter timeout.
                    </p>
                    <Select
                        value={String(settings.defaultSessionTimeout)}
                        onValueChange={(value) => handleChange('defaultSessionTimeout', parseInt(value))}
                    >
                        <SelectTrigger className="w-[250px]">
                            <SelectValue placeholder="Select timeout" />
                        </SelectTrigger>
                        <SelectContent>
                            {SESSION_TIMEOUT_OPTIONS.map((option) => (
                                <SelectItem key={option.value} value={String(option.value)}>
                                    {option.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground italic">
                        Note: Tenant-specific session timeout settings will override this if set to a shorter duration.
                    </p>
                </div>

                <Separator />

                {/* Max Login Attempts */}
                <div className="space-y-3">
                    <div className="flex items-center gap-2">
                        <Lock className="h-4 w-4 text-muted-foreground" />
                        <Label htmlFor="maxLoginAttempts">Max Login Attempts</Label>
                    </div>
                    <p className="text-sm text-muted-foreground">
                        Maximum number of failed login attempts before account lockout
                    </p>
                    <div className="flex items-center gap-3">
                        <Input
                            id="maxLoginAttempts"
                            type="number"
                            min={1}
                            max={10}
                            value={settings.maxLoginAttempts}
                            onChange={(e) => handleChange('maxLoginAttempts', Math.min(10, Math.max(1, parseInt(e.target.value) || 5)))}
                            className="w-[100px]"
                        />
                        <span className="text-sm text-muted-foreground">attempts</span>
                    </div>
                    <p className="text-xs text-muted-foreground italic">
                        After {settings.maxLoginAttempts} failed attempts, the user account will be temporarily locked for 15 minutes.
                    </p>
                </div>

                <Separator />

                {/* Audit Logging */}
                <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                        <Label className="flex items-center gap-2">
                            <Shield className="h-4 w-4 text-muted-foreground" />
                            Audit Logging
                        </Label>
                        <p className="text-sm text-muted-foreground">
                            Log all user actions for security auditing and compliance
                        </p>
                    </div>
                    <Switch
                        checked={settings.enableAuditLogging}
                        onCheckedChange={(checked) => handleChange('enableAuditLogging', checked)}
                    />
                </div>

                <div className="flex justify-end">
                    <Button onClick={handleSave} disabled={isSaving}>
                        {isSaving ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                            <Save className="h-4 w-4 mr-2" />
                        )}
                        Save Security Settings
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}

export default SecurityTab;
