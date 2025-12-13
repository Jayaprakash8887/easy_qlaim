import { useState } from 'react';
import {
  Settings as SettingsIcon,
  Database,
  Shield,
  Bell,
  Palette,
  Globe,
  Server,
  Activity,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

export default function Settings() {
  const [autoApproval, setAutoApproval] = useState(true);
  const [aiProcessing, setAiProcessing] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(true);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">System Settings</h1>
        <p className="text-muted-foreground">
          Configure system-wide settings and integrations
        </p>
      </div>

      <Tabs defaultValue="general" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
          <TabsTrigger value="policies">Policies</TabsTrigger>
          <TabsTrigger value="system">System</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>General Settings</CardTitle>
              <CardDescription>
                Basic configuration for the expense system
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>AI-Powered Processing</Label>
                  <p className="text-sm text-muted-foreground">
                    Enable AI for OCR and validation
                  </p>
                </div>
                <Switch checked={aiProcessing} onCheckedChange={setAiProcessing} />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Auto-Approval</Label>
                  <p className="text-sm text-muted-foreground">
                    Auto-approve high confidence claims (≥95%)
                  </p>
                </div>
                <Switch checked={autoApproval} onCheckedChange={setAutoApproval} />
              </div>
              <Separator />
              <div className="space-y-2">
                <Label>Default Currency</Label>
                <Select defaultValue="usd">
                  <SelectTrigger className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="usd">USD ($)</SelectItem>
                    <SelectItem value="eur">EUR (€)</SelectItem>
                    <SelectItem value="gbp">GBP (£)</SelectItem>
                    <SelectItem value="inr">INR (₹)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Fiscal Year Start</Label>
                <Select defaultValue="jan">
                  <SelectTrigger className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="jan">January</SelectItem>
                    <SelectItem value="apr">April</SelectItem>
                    <SelectItem value="jul">July</SelectItem>
                    <SelectItem value="oct">October</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Notification Settings</CardTitle>
              <CardDescription>
                Configure system-wide notification preferences
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Email Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Send email notifications for claim updates
                  </p>
                </div>
                <Switch
                  checked={emailNotifications}
                  onCheckedChange={setEmailNotifications}
                />
              </div>
              <div className="space-y-2">
                <Label>Notification Email</Label>
                <Input placeholder="noreply@company.com" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="integrations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Connected Integrations</CardTitle>
              <CardDescription>
                Manage external system connections
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900">
                    <Database className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="font-medium">HRMS Integration</p>
                    <p className="text-sm text-muted-foreground">
                      Sync employee data from HRMS
                    </p>
                  </div>
                </div>
                <Badge variant="outline">Not Connected</Badge>
              </div>
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900">
                    <Globe className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="font-medium">Kronos Timesheet</p>
                    <p className="text-sm text-muted-foreground">
                      Import timesheet data for validation
                    </p>
                  </div>
                </div>
                <Badge variant="outline">Not Connected</Badge>
              </div>
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900">
                    <Server className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <p className="font-medium">Payroll System</p>
                    <p className="text-sm text-muted-foreground">
                      Process settlements through payroll
                    </p>
                  </div>
                </div>
                <Badge variant="outline">Not Connected</Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>API Configuration</CardTitle>
              <CardDescription>
                Configure API keys for external services
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>OpenAI API Key</Label>
                <Input type="password" placeholder="sk-..." />
                <p className="text-xs text-muted-foreground">
                  Used for AI-powered validation and OCR
                </p>
              </div>
              <div className="space-y-2">
                <Label>Google Cloud Vision API Key</Label>
                <Input type="password" placeholder="AIza..." />
                <p className="text-xs text-muted-foreground">
                  Used for document OCR processing
                </p>
              </div>
              <Button>Save API Keys</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="policies" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Expense Policies</CardTitle>
              <CardDescription>
                Configure expense limits and approval thresholds
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Travel (per day)</Label>
                  <Input type="number" defaultValue="500" />
                </div>
                <div className="space-y-2">
                  <Label>Meals (per day)</Label>
                  <Input type="number" defaultValue="100" />
                </div>
                <div className="space-y-2">
                  <Label>Equipment (per item)</Label>
                  <Input type="number" defaultValue="5000" />
                </div>
                <div className="space-y-2">
                  <Label>Supplies (per month)</Label>
                  <Input type="number" defaultValue="200" />
                </div>
              </div>
              <Separator />
              <div className="space-y-4">
                <h4 className="font-medium">Approval Thresholds</h4>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Manager Approval Required</Label>
                    <Input type="number" defaultValue="100" />
                    <p className="text-xs text-muted-foreground">
                      Claims above this require manager approval
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>HR Approval Required</Label>
                    <Input type="number" defaultValue="2500" />
                    <p className="text-xs text-muted-foreground">
                      Claims above this require HR approval
                    </p>
                  </div>
                </div>
              </div>
              <Button>Save Policy Settings</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="system" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>System Health</CardTitle>
              <CardDescription>
                Monitor system performance and status
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Activity className="h-5 w-5 text-green-600" />
                  <span>API Status</span>
                </div>
                <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
                  Operational
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Database className="h-5 w-5 text-green-600" />
                  <span>Database</span>
                </div>
                <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
                  Healthy
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Server className="h-5 w-5 text-green-600" />
                  <span>AI Services</span>
                </div>
                <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
                  Online
                </Badge>
              </div>
              <Separator />
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Storage Usage</span>
                  <span>45%</span>
                </div>
                <Progress value={45} />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>API Rate Limit</span>
                  <span>23%</span>
                </div>
                <Progress value={23} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Audit Logs</CardTitle>
              <CardDescription>
                Recent system activity and changes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  {
                    action: 'Policy Updated',
                    user: 'Admin',
                    time: '2 hours ago',
                  },
                  {
                    action: 'User Role Changed',
                    user: 'HR Manager',
                    time: '5 hours ago',
                  },
                  {
                    action: 'Bulk Import Completed',
                    user: 'System',
                    time: '1 day ago',
                  },
                ].map((log, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between text-sm"
                  >
                    <div>
                      <p className="font-medium">{log.action}</p>
                      <p className="text-muted-foreground">by {log.user}</p>
                    </div>
                    <span className="text-muted-foreground">{log.time}</span>
                  </div>
                ))}
              </div>
              <Button variant="outline" className="w-full mt-4">
                View All Logs
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
