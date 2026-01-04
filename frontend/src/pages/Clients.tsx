import { useState, useMemo } from 'react';
import {
  Plus,
  Search,
  Building2,
  Users,
  FolderKanban,
  Edit,
  Trash2,
  Mail,
  Phone,
  MapPin,
  User,
  Link,
  Unlink,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { toast } from 'sonner';
import {
  useClients,
  useClient,
  useCreateClient,
  useUpdateClient,
  useDeleteClient,
  useLinkProjectsToClient,
  useUnlinkProjectsFromClient,
  type Client,
  type ClientCreate,
  type ClientUpdate,
} from '@/hooks/useClients';
import { useProjects } from '@/hooks/useProjects';
import { useAuth } from '@/contexts/AuthContext';
import { useFormatting } from '@/hooks/useFormatting';

interface ClientFormData {
  client_code: string;
  client_name: string;
  description: string;
  contact_person: string;
  contact_email: string;
  contact_phone: string;
  address: string;
  is_active?: boolean;
}

const defaultFormData: ClientFormData = {
  client_code: '',
  client_name: '',
  description: '',
  contact_person: '',
  contact_email: '',
  contact_phone: '',
  address: '',
  is_active: true,
};

export default function Clients() {
  const [searchQuery, setSearchQuery] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isLinkProjectsDialogOpen, setIsLinkProjectsDialogOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [formData, setFormData] = useState<ClientFormData>(defaultFormData);
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);

  const { user } = useAuth();
  const { formatDate } = useFormatting();

  const { data: clients, isLoading } = useClients(showInactive ? undefined : true);
  const { data: clientDetails } = useClient(selectedClient?.id || null);
  const { data: allProjects } = useProjects(user?.tenantId);
  const createClient = useCreateClient();
  const updateClient = useUpdateClient();
  const deleteClient = useDeleteClient();
  const linkProjects = useLinkProjectsToClient();
  const unlinkProjects = useUnlinkProjectsFromClient();

  // Filter clients based on search
  const filteredClients = useMemo(() => {
    if (!clients) return [];
    if (!searchQuery) return clients;
    
    const query = searchQuery.toLowerCase();
    return clients.filter(
      (client) =>
        client.client_name.toLowerCase().includes(query) ||
        client.client_code.toLowerCase().includes(query) ||
        client.contact_person?.toLowerCase().includes(query) ||
        client.contact_email?.toLowerCase().includes(query)
    );
  }, [clients, searchQuery]);

  // Get unlinked projects (projects not assigned to any client or assigned to current client)
  const availableProjects = useMemo(() => {
    if (!allProjects || !selectedClient) return [];
    return allProjects.filter(
      (p) => !p.clientId || p.clientId === selectedClient.id
    );
  }, [allProjects, selectedClient]);

  // Get linked project IDs for current client
  const linkedProjectIds = useMemo(() => {
    if (!clientDetails?.projects) return [];
    return clientDetails.projects.map((p) => p.id);
  }, [clientDetails]);

  const toggleClientExpanded = (clientId: string) => {
    const newExpanded = new Set(expandedClients);
    if (newExpanded.has(clientId)) {
      newExpanded.delete(clientId);
    } else {
      newExpanded.add(clientId);
    }
    setExpandedClients(newExpanded);
  };

  const handleCreateClient = async () => {
    if (!formData.client_code || !formData.client_name) {
      toast.error('Client code and name are required');
      return;
    }

    try {
      await createClient.mutateAsync(formData);
      toast.success('Client created successfully');
      setIsCreateDialogOpen(false);
      setFormData(defaultFormData);
    } catch (error: any) {
      toast.error(error.message || 'Failed to create client');
    }
  };

  const handleUpdateClient = async () => {
    if (!selectedClient) return;

    try {
      await updateClient.mutateAsync({
        clientId: selectedClient.id,
        data: formData,
      });
      toast.success('Client updated successfully');
      setIsEditDialogOpen(false);
      setSelectedClient(null);
      setFormData(defaultFormData);
    } catch (error: any) {
      toast.error(error.message || 'Failed to update client');
    }
  };

  const handleDeleteClient = async () => {
    if (!selectedClient) return;

    try {
      const result = await deleteClient.mutateAsync(selectedClient.id);
      toast.success(result.message);
      setIsDeleteDialogOpen(false);
      setSelectedClient(null);
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete client');
    }
  };

  const handleToggleActive = async (client: Client) => {
    try {
      await updateClient.mutateAsync({
        clientId: client.id,
        data: { is_active: !client.is_active },
      });
      toast.success(`Client ${client.is_active ? 'deactivated' : 'activated'}`);
    } catch (error: any) {
      toast.error(error.message || 'Failed to update client');
    }
  };

  const handleLinkProjects = async () => {
    if (!selectedClient) return;

    const toLink = selectedProjectIds.filter((id) => !linkedProjectIds.includes(id));
    const toUnlink = linkedProjectIds.filter((id) => !selectedProjectIds.includes(id));

    try {
      if (toLink.length > 0) {
        await linkProjects.mutateAsync({
          clientId: selectedClient.id,
          projectIds: toLink,
        });
      }
      if (toUnlink.length > 0) {
        await unlinkProjects.mutateAsync({
          clientId: selectedClient.id,
          projectIds: toUnlink,
        });
      }
      toast.success('Projects updated successfully');
      setIsLinkProjectsDialogOpen(false);
      setSelectedProjectIds([]);
    } catch (error: any) {
      toast.error(error.message || 'Failed to update projects');
    }
  };

  const openEditDialog = (client: Client) => {
    setSelectedClient(client);
    setFormData({
      client_code: client.client_code,
      client_name: client.client_name,
      description: client.description || '',
      contact_person: client.contact_person || '',
      contact_email: client.contact_email || '',
      contact_phone: client.contact_phone || '',
      address: client.address || '',
      is_active: client.is_active,
    });
    setIsEditDialogOpen(true);
  };

  const openLinkProjectsDialog = (client: Client) => {
    setSelectedClient(client);
    setSelectedProjectIds(linkedProjectIds);
    setIsLinkProjectsDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Client Management</h1>
          <p className="text-muted-foreground">
            Manage your organization's clients and their associated projects
          </p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Client
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Clients</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{clients?.length || 0}</div>
            <p className="text-xs text-muted-foreground">
              {clients?.filter((c) => c.is_active).length || 0} active
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Linked Projects</CardTitle>
            <FolderKanban className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {clients?.reduce((sum, c) => sum + c.project_count, 0) || 0}
            </div>
            <p className="text-xs text-muted-foreground">across all clients</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unassigned Projects</CardTitle>
            <Link className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {allProjects?.filter((p) => !p.clientId).length || 0}
            </div>
            <p className="text-xs text-muted-foreground">projects without client</p>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filter */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <CardTitle>Clients</CardTitle>
            <div className="flex items-center gap-4">
              <div className="relative w-64">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search clients..."
                  className="pl-8"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="show-inactive"
                  checked={showInactive}
                  onCheckedChange={setShowInactive}
                />
                <Label htmlFor="show-inactive" className="text-sm">
                  Show inactive
                </Label>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Loading clients...</div>
          ) : filteredClients.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No clients found. Create your first client to get started.
            </div>
          ) : (
            <div className="space-y-4">
              {filteredClients.map((client) => (
                <Collapsible
                  key={client.id}
                  open={expandedClients.has(client.id)}
                  onOpenChange={() => toggleClientExpanded(client.id)}
                >
                  <div className="border rounded-lg">
                    <div className="flex items-center justify-between p-4">
                      <div className="flex items-center gap-4">
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="sm" className="p-0 h-8 w-8">
                            {expandedClients.has(client.id) ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </Button>
                        </CollapsibleTrigger>
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                          <Building2 className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">{client.client_name}</span>
                            <Badge variant="outline" className="font-mono">
                              {client.client_code}
                            </Badge>
                            {!client.is_active && (
                              <Badge variant="secondary">Inactive</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            {client.contact_person && (
                              <span className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {client.contact_person}
                              </span>
                            )}
                            {client.contact_email && (
                              <span className="flex items-center gap-1">
                                <Mail className="h-3 w-3" />
                                {client.contact_email}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <FolderKanban className="h-3 w-3" />
                              {client.project_count} projects
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openLinkProjectsDialog(client)}
                        >
                          <Link className="h-4 w-4 mr-1" />
                          Manage Projects
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog(client)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          onClick={() => {
                            setSelectedClient(client);
                            setIsDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <CollapsibleContent>
                      <div className="border-t p-4 bg-muted/30">
                        <div className="grid gap-4 md:grid-cols-2">
                          <div>
                            <h4 className="text-sm font-medium mb-2">Contact Information</h4>
                            <div className="space-y-2 text-sm">
                              {client.contact_phone && (
                                <div className="flex items-center gap-2">
                                  <Phone className="h-4 w-4 text-muted-foreground" />
                                  {client.contact_phone}
                                </div>
                              )}
                              {client.address && (
                                <div className="flex items-start gap-2">
                                  <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                                  <span>{client.address}</span>
                                </div>
                              )}
                              {client.description && (
                                <p className="text-muted-foreground mt-2">
                                  {client.description}
                                </p>
                              )}
                            </div>
                          </div>
                          <div>
                            <h4 className="text-sm font-medium mb-2">Status</h4>
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={client.is_active}
                                onCheckedChange={() => handleToggleActive(client)}
                              />
                              <span className="text-sm">
                                {client.is_active ? 'Active' : 'Inactive'}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-2">
                              Created: {formatDate(new Date(client.created_at))}
                            </p>
                          </div>
                        </div>
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Client Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Client</DialogTitle>
            <DialogDescription>
              Add a new client to your organization. You can link projects later.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="client_code">Client Code *</Label>
                <Input
                  id="client_code"
                  value={formData.client_code}
                  onChange={(e) =>
                    setFormData({ ...formData, client_code: e.target.value.toUpperCase() })
                  }
                  placeholder="e.g., ACME"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="client_name">Client Name *</Label>
                <Input
                  id="client_name"
                  value={formData.client_name}
                  onChange={(e) =>
                    setFormData({ ...formData, client_name: e.target.value })
                  }
                  placeholder="e.g., Acme Corporation"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Brief description of the client"
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contact_person">Contact Person</Label>
                <Input
                  id="contact_person"
                  value={formData.contact_person}
                  onChange={(e) =>
                    setFormData({ ...formData, contact_person: e.target.value })
                  }
                  placeholder="John Doe"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact_email">Email</Label>
                <Input
                  id="contact_email"
                  type="email"
                  value={formData.contact_email}
                  onChange={(e) =>
                    setFormData({ ...formData, contact_email: e.target.value })
                  }
                  placeholder="john@acme.com"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contact_phone">Phone</Label>
                <Input
                  id="contact_phone"
                  value={formData.contact_phone}
                  onChange={(e) =>
                    setFormData({ ...formData, contact_phone: e.target.value })
                  }
                  placeholder="+1 234 567 8900"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) =>
                    setFormData({ ...formData, address: e.target.value })
                  }
                  placeholder="City, Country"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateClient} disabled={createClient.isPending}>
              {createClient.isPending ? 'Creating...' : 'Create Client'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Client Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
<DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Client</DialogTitle>
            <DialogDescription>
              Update client information for {selectedClient?.client_name}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit_client_code">Client Code *</Label>
                <Input
                  id="edit_client_code"
                  value={formData.client_code}
                  onChange={(e) =>
                    setFormData({ ...formData, client_code: e.target.value.toUpperCase() })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_client_name">Client Name *</Label>
                <Input
                  id="edit_client_name"
                  value={formData.client_name}
                  onChange={(e) =>
                    setFormData({ ...formData, client_name: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_description">Description</Label>
              <Textarea
                id="edit_description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit_contact_person">Contact Person</Label>
                <Input
                  id="edit_contact_person"
                  value={formData.contact_person}
                  onChange={(e) =>
                    setFormData({ ...formData, contact_person: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_contact_email">Email</Label>
                <Input
                  id="edit_contact_email"
                  type="email"
                  value={formData.contact_email}
                  onChange={(e) =>
                    setFormData({ ...formData, contact_email: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit_contact_phone">Phone</Label>
                <Input
                  id="edit_contact_phone"
                  value={formData.contact_phone}
                  onChange={(e) =>
                    setFormData({ ...formData, contact_phone: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_address">Address</Label>
                <Input
                  id="edit_address"
                  value={formData.address}
                  onChange={(e) =>
                    setFormData({ ...formData, address: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label htmlFor="edit_is_active">Active Status</Label>
                <p className="text-sm text-muted-foreground">
                  Inactive clients are hidden from dropdowns
                </p>
              </div>
              <Switch
                id="edit_is_active"
                checked={formData.is_active ?? true}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, is_active: checked })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateClient} disabled={updateClient.isPending}>
              {updateClient.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Link Projects Dialog */}
      <Dialog open={isLinkProjectsDialogOpen} onOpenChange={setIsLinkProjectsDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manage Projects</DialogTitle>
            <DialogDescription>
              Link or unlink projects for {selectedClient?.client_name}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {availableProjects.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">
                No projects available to link
              </p>
            ) : (
              <div className="max-h-[400px] overflow-y-auto border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12"></TableHead>
                      <TableHead>Project</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Current Client</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {availableProjects.map((project) => (
                      <TableRow key={project.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedProjectIds.includes(project.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedProjectIds([...selectedProjectIds, project.id]);
                              } else {
                                setSelectedProjectIds(
                                  selectedProjectIds.filter((id) => id !== project.id)
                                );
                              }
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <div>
                            <span className="font-medium">{project.name}</span>
                            <span className="text-muted-foreground ml-2 text-sm">
                              ({project.code})
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={project.status === 'active' ? 'default' : 'secondary'}
                          >
                            {project.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {project.clientId === selectedClient?.id ? (
                            <Badge variant="outline">Current</Badge>
                          ) : project.clientId ? (
                            <span className="text-muted-foreground">Other</span>
                          ) : (
                            <span className="text-muted-foreground">None</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsLinkProjectsDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleLinkProjects}
              disabled={linkProjects.isPending || unlinkProjects.isPending}
            >
              {linkProjects.isPending || unlinkProjects.isPending
                ? 'Updating...'
                : 'Update Projects'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Client</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedClient?.project_count && selectedClient.project_count > 0 ? (
                <>
                  This client has {selectedClient.project_count} linked projects. The client
                  will be deactivated instead of deleted. Projects will remain linked.
                </>
              ) : (
                <>
                  Are you sure you want to delete "{selectedClient?.client_name}"? This action
                  cannot be undone.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteClient}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {selectedClient?.project_count && selectedClient.project_count > 0
                ? 'Deactivate'
                : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
