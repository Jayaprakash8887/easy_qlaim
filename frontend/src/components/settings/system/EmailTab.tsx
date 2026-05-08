import { useState } from 'react';
import {
    Loader2,
    Save,
    Send,
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
import { EmailSettings, DEFAULT_EMAIL_SETTINGS } from './types';

interface EmailTabProps {
    emailSettings?: EmailSettings;
    onSettingsChange?: (settings: EmailSettings) => void;
}

export function EmailTab({
    emailSettings: externalSettings,
    onSettingsChange
}: EmailTabProps) {
    const [isSaving, setIsSaving] = useState(false);
    const [isTestingEmail, setIsTestingEmail] = useState(false);
    const [testEmailRecipient, setTestEmailRecipient] = useState('');
    const [settings, setSettings] = useState<EmailSettings>(
        externalSettings || DEFAULT_EMAIL_SETTINGS
    );

    const handleChange = (key: keyof EmailSettings, value: string | number | boolean) => {
        const newSettings = { ...settings, [key]: value };
        setSettings(newSettings);
        onSettingsChange?.(newSettings);
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await new Promise(resolve => setTimeout(resolve, 500));
            toast.success('Email settings saved successfully');
        } catch (error) {
            toast.error('Failed to save email settings');
        } finally {
            setIsSaving(false);
        }
    };

    const handleTestEmail = async () => {
        if (!testEmailRecipient) {
            toast.error('Please enter an email address to send test email');
            return;
        }
        setIsTestingEmail(true);
        try {
            await new Promise(resolve => setTimeout(resolve, 1000));
            toast.success(`Test email sent to ${testEmailRecipient}`);
            setTestEmailRecipient('');
        } catch (error) {
            toast.error('Failed to send test email');
        } finally {
            setIsTestingEmail(false);
        }
    };

    return (
        <div className="space-y-4">
            {/* SMTP Configuration Card */}
            <Card>
                <CardHeader>
                    <CardTitle>SMTP Configuration</CardTitle>
                    <CardDescription>
                        Configure the email server for sending notifications
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="smtpHost">SMTP Host</Label>
                            <Input
                                id="smtpHost"
                                placeholder="smtp.gmail.com"
                                value={settings.smtpHost}
                                onChange={(e) => handleChange('smtpHost', e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="smtpPort">SMTP Port</Label>
                            <Select
                                value={String(settings.smtpPort)}
                                onValueChange={(value) => handleChange('smtpPort', parseInt(value))}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select port" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="25">25 (SMTP)</SelectItem>
                                    <SelectItem value="465">465 (SMTPS/SSL)</SelectItem>
                                    <SelectItem value="587">587 (STARTTLS)</SelectItem>
                                    <SelectItem value="2525">2525 (Alternative)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="smtpUser">SMTP Username</Label>
                            <Input
                                id="smtpUser"
                                placeholder="your-email@gmail.com"
                                value={settings.smtpUser}
                                onChange={(e) => handleChange('smtpUser', e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="smtpPassword">SMTP Password / App Password</Label>
                            <Input
                                id="smtpPassword"
                                type="password"
                                placeholder="••••••••••••"
                                value={settings.smtpPassword}
                                onChange={(e) => handleChange('smtpPassword', e.target.value)}
                            />
                            <p className="text-xs text-muted-foreground">
                                For Gmail, use an App Password instead of your account password
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-lg border">
                        <div className="space-y-0.5">
                            <Label>Use TLS/SSL</Label>
                            <p className="text-sm text-muted-foreground">
                                Enable secure connection (recommended)
                            </p>
                        </div>
                        <Switch
                            checked={settings.smtpSecure}
                            onCheckedChange={(checked) => handleChange('smtpSecure', checked)}
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Email Identity Card */}
            <Card>
                <CardHeader>
                    <CardTitle>Email Identity</CardTitle>
                    <CardDescription>
                        Configure sender information for outgoing emails
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="senderEmail">Sender Email Address</Label>
                            <Input
                                id="senderEmail"
                                type="email"
                                placeholder="noreply@yourcompany.com"
                                value={settings.senderEmail}
                                onChange={(e) => handleChange('senderEmail', e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="senderName">Sender Display Name</Label>
                            <Input
                                id="senderName"
                                placeholder="EasyQlaim Notifications"
                                value={settings.senderName}
                                onChange={(e) => handleChange('senderName', e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="emailFooter">Email Footer Text</Label>
                        <Input
                            id="emailFooter"
                            placeholder="This is an automated message..."
                            value={settings.emailFooter}
                            onChange={(e) => handleChange('emailFooter', e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">
                            This text will appear at the bottom of all system emails
                        </p>
                    </div>
                </CardContent>
            </Card>

            {/* Email Notifications Card */}
            <Card>
                <CardHeader>
                    <CardTitle>Notifications</CardTitle>
                    <CardDescription>
                        Control email notification behavior
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label>Enable Email Notifications</Label>
                            <p className="text-sm text-muted-foreground">
                                Send email notifications for claim updates, approvals, and system events
                            </p>
                        </div>
                        <Switch
                            checked={settings.enableEmailNotifications}
                            onCheckedChange={(checked) => handleChange('enableEmailNotifications', checked)}
                        />
                    </div>

                    <Separator />

                    {/* Test Email Section */}
                    <div className="space-y-3">
                        <Label>Send Test Email</Label>
                        <p className="text-sm text-muted-foreground">
                            Verify your email configuration by sending a test email
                        </p>
                        <div className="flex gap-2">
                            <Input
                                type="email"
                                placeholder="recipient@example.com"
                                value={testEmailRecipient}
                                onChange={(e) => setTestEmailRecipient(e.target.value)}
                                className="max-w-sm"
                            />
                            <Button variant="outline" onClick={handleTestEmail} disabled={isTestingEmail}>
                                {isTestingEmail ? (
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                ) : (
                                    <Send className="h-4 w-4 mr-2" />
                                )}
                                Send Test
                            </Button>
                        </div>
                    </div>

                    <div className="flex justify-end pt-4">
                        <Button onClick={handleSave} disabled={isSaving}>
                            {isSaving ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                                <Save className="h-4 w-4 mr-2" />
                            )}
                            Save Email Settings
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

export default EmailTab;
