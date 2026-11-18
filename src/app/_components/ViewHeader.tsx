import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { api } from '@/trpc/react';
import { toast } from '@/components/ui/toast';
import { Typography } from '@/app/_components/typography';
import { X } from 'lucide-react';

/**
 * Header for a configurable view page.
 * Shows the view name, icon and provides edit / delete actions.
 * Uses the view router (`api.view.update`, `api.view.delete`).
 */
export function ViewHeader({
  viewId,
  projectId,
  initialName,
  initialIcon,
}: {
  viewId: string;
  projectId: string;
  initialName: string;
  initialIcon: string;
}) {
  const utils = api.useContext();
  const updateMutation = api.view.update.useMutation({
    onSuccess: () => {
      utils.view.getById.invalidate({ projectId, id: viewId });
      toast.success('View updated');
      setEditing(false);
    },
    onError: (err) => toast.error(err.message),
  });
  const deleteMutation = api.view.delete.useMutation({
    onSuccess: () => {
      utils.view.list.invalidate({ projectId });
      toast.success('View deleted');
    },
    onError: (err) => toast.error(err.message),
  });

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(initialName);
  const [icon, setIcon] = useState(initialIcon);

  const handleUpdate = () => {
    updateMutation.mutate({ id: viewId, projectId, name, icon });
  };

  const handleDelete = () => {
    if (confirm('Delete this view? This action cannot be undone.')) {
      deleteMutation.mutate({ id: viewId, projectId });
    }
  };

  return (
    <div className="flex items-center justify-between p-4 border-b bg-muted/50">
      <div className="flex items-center space-x-2">
        {/* Icon placeholder – you can map icon key to a Lucide component later */}
        <span className="text-2xl" aria-hidden="true">
          {icon}
        </span>
        <Typography variant="h2">{initialName}</Typography>
      </div>
      <div className="flex items-center space-x-1">
        <Dialog open={editing} onOpenChange={setEditing}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              Edit
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit View</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="view-name">
                  Name
                </label>
                <Input id="view-name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="view-icon">
                  Icon (key)
                </label>
                <Input id="view-icon" value={icon} onChange={(e) => setIcon(e.target.value)} />
              </div>
            </div>
            <DialogFooter className="flex justify-between">
              <Button variant="ghost" onClick={() => setEditing(false)}>
                Cancel
              </Button>
              <div className="flex space-x-2">
                <Button variant="destructive" onClick={handleDelete}>
                  Delete
                </Button>
                <Button onClick={handleUpdate} disabled={updateMutation.isLoading}>
                  Save
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
