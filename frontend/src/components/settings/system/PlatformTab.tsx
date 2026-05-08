import { useState } from 'react';
import {
    Globe,
    AlertTriangle,
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
import { PlatformSettings, DEFAULT_PLATFORM_SETTINGS } from './types';

interface PlatformTabProps {
    platformSettings?: PlatformSettings;
    onSettingsChange?: (settings: PlatformSettings) => void;
}

export function PlatformTab({
    platformSettings: externalSettings,
    onSettingsChange
}: PlatformTabProps) {
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
            // TODO: Integrate with backend API when ready
            await new Promise(resolve => setTimeout(resolve, 500));
            toast.success('Platform settings saved successfully');
        } catch (error) {
            toast.error('Failed to save platform settings');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Platform Configuration</CardTitle>
                <CardDescription>
                    General platform settings and branding
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="space-y-2">
                    <Label htmlFor="supportEmail">Support Email</Label>
                    <p className="text-sm text-muted-foreground">
                        Email address displayed to users for support inquiries
                    </p>
                    <Input
                        id="supportEmail"
                        type="email"
                        value={settings.supportEmail}
                        onChange={(e) => handleChange('supportEmail', e.target.value)}
                        className="max-w-md"
                    />
                </div>

                <Separator />

                {/* Maintenance Mode Section */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label className="flex items-center gap-2">
                                <AlertTriangle className="h-4 w-4 text-amber-500" />
                                Maintenance Mode
                            </Label>
                            <p className="text-sm text-muted-foreground">
                                When enabled, all non-admin users will see a maintenance message and cannot access the platform
                            </p>
                        </div>
                        <Switch
                            checked={settings.maintenanceMode}
                            onCheckedChange={(checked) => handleChange('maintenanceMode', checked)}
                        />
                    </div>

                    {settings.maintenanceMode && (
                        <div className="space-y-2 p-4 border rounded-lg bg-amber-50 dark:bg-amber-950/20">
                            <Label htmlFor="maintenanceMessage">Maintenance Message</Label>
                            <p className="text-sm text-muted-foreground">
                                This message will be displayed to users when they try to access the platform
                            </p>
                            <Input
                                id="maintenanceMessage"
                                value={settings.maintenanceMessage}
                                onChange={(e) => handleChange('maintenanceMessage', e.target.value)}
                                placeholder="Enter maintenance message..."
                            />
                            <div className="mt-3 p-3 rounded bg-white dark:bg-gray-900 border">
                                <p className="text-xs text-muted-foreground mb-1">Preview:</p>
                                <div className="flex items-center gap-2 text-amber-600">
                                    <AlertTriangle className="h-4 w-4" />
                                    <span className="text-sm">{settings.maintenanceMessage}</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex justify-end">
                    <Button onClick={handleSave} disabled={isSaving}>
                        {isSaving ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                            <Save className="h-4 w-4 mr-2" />
                        )}
                        Save Platform Settings
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}

export default PlatformTab;
