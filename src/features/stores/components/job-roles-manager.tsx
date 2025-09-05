"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2, Users } from "lucide-react";
import { t } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";

interface StoreJobRole {
  id: string;
  store_id: string;
  name: string;
  code: string | null;
  description: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
  usage_count?: number;
}

interface JobRolesManagerProps {
  storeId: string;
  locale: Locale;
}

export function JobRolesManager({ storeId, locale }: JobRolesManagerProps) {
  const [roles, setRoles] = useState<StoreJobRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<StoreJobRole | null>(null);
  const [form, setForm] = useState({
    name: "",
    code: "",
    description: "",
    active: true,
  });

  const { toast } = useToast();

  const loadRoles = async () => {
    try {
      const response = await fetch(`/api/store-job-roles?store_id=${storeId}`);
      const result = await response.json();

      if (result.success) {
        setRoles(result.data);
      } else {
        toast({
          title: t("common.error", locale),
          description: result.error,
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: t("common.error", locale),
        description: String(error),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRoles();
  }, [storeId]);

  const resetForm = () => {
    setForm({
      name: "",
      code: "",
      description: "",
      active: true,
    });
  };

  const handleCreate = async () => {
    if (!form.name.trim()) {
      toast({
        title: t("common.error", locale),
        description: t("jobRoles.nameRequired", locale),
        variant: "destructive",
      });
      return;
    }

    setCreating(true);
    try {
      const response = await fetch("/api/store-job-roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId,
          ...form,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: t("jobRoles.createSuccess", locale),
        });
        setIsCreateDialogOpen(false);
        resetForm();
        await loadRoles();
      } else {
        toast({
          title: t("common.error", locale),
          description: result.error,
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: t("common.error", locale),
        description: String(error),
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const handleEdit = async () => {
    if (!selectedRole || !form.name.trim()) {
      toast({
        title: t("common.error", locale),
        description: t("jobRoles.nameRequired", locale),
        variant: "destructive",
      });
      return;
    }

    setEditing(true);
    try {
      const response = await fetch(`/api/store-job-roles/${selectedRole.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: t("jobRoles.updateSuccess", locale),
        });
        setIsEditDialogOpen(false);
        setSelectedRole(null);
        resetForm();
        await loadRoles();
      } else {
        toast({
          title: t("common.error", locale),
          description: result.error,
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: t("common.error", locale),
        description: String(error),
        variant: "destructive",
      });
    } finally {
      setEditing(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedRole) return;

    setDeleting(true);
    try {
      const response = await fetch(`/api/store-job-roles/${selectedRole.id}`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: t("jobRoles.deleteSuccess", locale),
        });
        setIsDeleteDialogOpen(false);
        setSelectedRole(null);
        await loadRoles();
      } else {
        toast({
          title: t("common.error", locale),
          description: result.error,
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: t("common.error", locale),
        description: String(error),
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  const openEditDialog = (role: StoreJobRole) => {
    setSelectedRole(role);
    setForm({
      name: role.name,
      code: role.code || "",
      description: role.description || "",
      active: role.active,
    });
    setIsEditDialogOpen(true);
  };

  const openDeleteDialog = (role: StoreJobRole) => {
    setSelectedRole(role);
    setIsDeleteDialogOpen(true);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("jobRoles.title", locale)}</CardTitle>
          <CardDescription>{t("jobRoles.description", locale)}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">{t("common.loading", locale)}</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{t("jobRoles.title", locale)}</CardTitle>
            <CardDescription>
              {t("jobRoles.description", locale)}
            </CardDescription>
          </div>
          <Dialog
            open={isCreateDialogOpen}
            onOpenChange={setIsCreateDialogOpen}
          >
            <DialogTrigger asChild>
              <Button onClick={() => resetForm()}>
                <Plus className="w-4 h-4 mr-2" />
                {t("jobRoles.create", locale)}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("jobRoles.create", locale)}</DialogTitle>
                <DialogDescription>
                  {t("jobRoles.description", locale)}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">{t("jobRoles.name", locale)}</Label>
                  <Input
                    id="name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="예: 바리스타"
                  />
                </div>
                <div>
                  <Label htmlFor="code">{t("jobRoles.code", locale)}</Label>
                  <Input
                    id="code"
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                    placeholder="예: barista"
                  />
                </div>
                <div>
                  <Label htmlFor="description">
                    {t("jobRoles.roleDescription", locale)}
                  </Label>
                  <Textarea
                    id="description"
                    value={form.description}
                    onChange={(e) =>
                      setForm({ ...form, description: e.target.value })
                    }
                    placeholder="역할에 대한 설명을 입력하세요"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="active"
                    checked={form.active}
                    onCheckedChange={(checked) =>
                      setForm({ ...form, active: checked })
                    }
                  />
                  <Label htmlFor="active">
                    {form.active
                      ? t("jobRoles.active", locale)
                      : t("jobRoles.inactive", locale)}
                  </Label>
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsCreateDialogOpen(false)}
                >
                  {t("common.cancel", locale)}
                </Button>
                <Button onClick={handleCreate} disabled={creating}>
                  {creating
                    ? t("common.loading", locale)
                    : t("jobRoles.create", locale)}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {roles.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {t("common.noData", locale)}
            </div>
          ) : (
            roles.map((role) => (
              <div
                key={role.id}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <h3 className="font-medium">{role.name}</h3>
                    {role.code && (
                      <Badge variant="secondary">{role.code}</Badge>
                    )}
                    <Badge variant={role.active ? "default" : "secondary"}>
                      {role.active
                        ? t("jobRoles.active", locale)
                        : t("jobRoles.inactive", locale)}
                    </Badge>
                  </div>
                  {role.description && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {role.description}
                    </p>
                  )}
                  {role.usage_count !== undefined && (
                    <div className="flex items-center text-sm text-muted-foreground mt-2">
                      <Users className="w-4 h-4 mr-1" />
                      {t("jobRoles.usageCount", locale, {
                        count: role.usage_count,
                      })}
                    </div>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openEditDialog(role)}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openDeleteDialog(role)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>

      {/* 편집 다이얼로그 */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("jobRoles.edit", locale)}</DialogTitle>
            <DialogDescription>
              {t("jobRoles.description", locale)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-name">{t("jobRoles.name", locale)}</Label>
              <Input
                id="edit-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="예: 바리스타"
              />
            </div>
            <div>
              <Label htmlFor="edit-code">{t("jobRoles.code", locale)}</Label>
              <Input
                id="edit-code"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder="예: barista"
              />
            </div>
            <div>
              <Label htmlFor="edit-description">
                {t("jobRoles.roleDescription", locale)}
              </Label>
              <Textarea
                id="edit-description"
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                placeholder="역할에 대한 설명을 입력하세요"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="edit-active"
                checked={form.active}
                onCheckedChange={(checked) =>
                  setForm({ ...form, active: checked })
                }
              />
              <Label htmlFor="edit-active">
                {form.active
                  ? t("jobRoles.active", locale)
                  : t("jobRoles.inactive", locale)}
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsEditDialogOpen(false)}
            >
              {t("common.cancel", locale)}
            </Button>
            <Button onClick={handleEdit} disabled={editing}>
              {editing
                ? t("common.loading", locale)
                : t("jobRoles.edit", locale)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 삭제 확인 다이얼로그 */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("jobRoles.delete", locale)}</DialogTitle>
            <DialogDescription>
              {t("jobRoles.confirmDelete", locale)}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
            >
              {t("common.cancel", locale)}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting
                ? t("common.loading", locale)
                : t("jobRoles.delete", locale)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
