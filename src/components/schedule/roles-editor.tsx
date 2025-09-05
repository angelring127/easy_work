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
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2, Save, X, Users } from "lucide-react";
import { t } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";

interface StoreJobRole {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

interface RolesEditorProps {
  storeId: string;
  locale: Locale;
}

export function RolesEditor({ storeId, locale }: RolesEditorProps) {
  const [roles, setRoles] = useState<StoreJobRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingRole, setEditingRole] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    active: true,
  });
  const { toast } = useToast();

  // 역할 목록 로드
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
    console.log("resetForm 호출됨 - 현재 상태:", { creating, editingRole });
    setForm({
      name: "",
      description: "",
      active: true,
    });
    console.log("resetForm 완료");
  };

  const handleCancel = () => {
    console.log("취소 버튼 클릭됨");
    setCreating(false);
    setEditingRole(null);
    setForm({
      name: "",
      description: "",
      active: true,
    });
    console.log("취소 완료 - 상태 초기화:", {
      creating: false,
      editingRole: null,
    });
  };

  const startCreating = () => {
    console.log("startCreating 호출됨");
    setCreating(true);
    setEditingRole(null);
    setForm({
      name: "",
      description: "",
      active: true,
    });
    console.log("startCreating 완료 - creating:", true);
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      toast({
        title: t("common.error", locale),
        description: t("jobRoles.nameRequired", locale),
        variant: "destructive",
      });
      return;
    }

    // 중복 역할명 검사
    const existingRole = roles.find(
      (role) =>
        role.name.toLowerCase() === form.name.trim().toLowerCase() &&
        role.id !== editingRole
    );

    if (existingRole) {
      toast({
        title: t("common.error", locale),
        description: t("jobRoles.nameDuplicate", locale),
        variant: "destructive",
      });
      return;
    }

    try {
      if (editingRole) {
        // 수정
        const response = await fetch(`/api/store-job-roles/${editingRole}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name.trim(),
            description: form.description.trim() || null,
            active: form.active,
          }),
        });

        if (response.ok) {
          toast({
            title: t("jobRoles.updateSuccess", locale),
          });
          await loadRoles();
          // 상태 초기화를 명확하게
          setCreating(false);
          setEditingRole(null);
          setForm({
            name: "",
            description: "",
            active: true,
          });
          console.log("역할 수정 완료 후 상태 초기화:", {
            creating: false,
            editingRole: null,
          });
        } else {
          const errorData = await response.json();
          console.error("역할 수정 실패:", errorData);
          throw new Error(errorData.error || "Failed to update role");
        }
      } else {
        // 생성
        const response = await fetch("/api/store-job-roles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            storeId,
            name: form.name.trim(),
            description: form.description.trim() || null,
            active: form.active,
          }),
        });

        if (response.ok) {
          toast({
            title: t("jobRoles.createSuccess", locale),
          });
          await loadRoles();
          // 상태 초기화를 명확하게
          setCreating(false);
          setEditingRole(null);
          setForm({
            name: "",
            description: "",
            active: true,
          });
          console.log("역할 생성 완료 후 상태 초기화:", {
            creating: false,
            editingRole: null,
          });
        } else {
          const errorData = await response.json();
          console.error("역할 생성 실패:", errorData);
          throw new Error(errorData.error || "Failed to create role");
        }
      }
    } catch (error) {
      toast({
        title: t("common.error", locale),
        description: String(error),
        variant: "destructive",
      });
    }
  };

  const handleEdit = (role: StoreJobRole) => {
    setEditingRole(role.id);
    setForm({
      name: role.name,
      description: role.description || "",
      active: role.active,
    });
    setCreating(false);
  };

  const handleDelete = async (roleId: string) => {
    if (!confirm(t("jobRoles.deleteConfirm", locale))) return;

    try {
      const response = await fetch(`/api/store-job-roles/${roleId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast({
          title: t("jobRoles.deleteSuccess", locale),
        });
        await loadRoles();
      } else {
        throw new Error("Failed to delete role");
      }
    } catch (error) {
      toast({
        title: t("common.error", locale),
        description: String(error),
        variant: "destructive",
      });
    }
  };

  const handleToggleActive = async (roleId: string, currentActive: boolean) => {
    try {
      const response = await fetch(`/api/store-job-roles/${roleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          active: !currentActive,
        }),
      });

      if (response.ok) {
        await loadRoles();
        toast({
          title: t("jobRoles.updateSuccess", locale),
        });
      } else {
        throw new Error("Failed to toggle role status");
      }
    } catch (error) {
      toast({
        title: t("common.error", locale),
        description: String(error),
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("jobRoles.title", locale)}</CardTitle>
          <CardDescription>{t("jobRoles.description", locale)}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">{t("common.loading", locale)}</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Users className="w-5 h-5" />
            {t("jobRoles.title", locale)}
          </h3>
          <p className="text-sm text-gray-600">
            {t("jobRoles.description", locale)}
          </p>
        </div>
        <Button
          onClick={startCreating}
          disabled={creating || editingRole !== null}
        >
          <Plus className="w-4 h-4 mr-2" />
          {t("jobRoles.create", locale)}
        </Button>
      </div>

      {/* 역할 생성/수정 폼 */}
      {(creating || editingRole) && (
        <Card>
          <CardHeader>
            <CardTitle>
              {editingRole
                ? t("jobRoles.edit", locale)
                : t("jobRoles.create", locale)}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="role-name">
                  {t("jobRoles.name", locale)} *
                </Label>
                <Input
                  id="role-name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder={t("jobRoles.namePlaceholder", locale)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role-active">
                  {t("jobRoles.active", locale)}
                </Label>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="role-active"
                    checked={form.active}
                    onCheckedChange={(checked) =>
                      setForm({ ...form, active: checked })
                    }
                  />
                  <Label htmlFor="role-active">
                    {form.active
                      ? t("common.yes", locale)
                      : t("common.no", locale)}
                  </Label>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="role-description">
                {t("jobRoles.description", locale)}
              </Label>
              <Textarea
                id="role-description"
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                placeholder={t("jobRoles.descriptionPlaceholder", locale)}
                rows={3}
              />
            </div>

            <div className="flex gap-2">
              <Button onClick={handleSubmit}>
                <Save className="w-4 h-4 mr-2" />
                {editingRole
                  ? t("common.update", locale)
                  : t("common.create", locale)}
              </Button>
              <Button variant="outline" onClick={handleCancel}>
                <X className="w-4 h-4 mr-2" />
                {t("common.cancel", locale)}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 역할 목록 */}
      <Card>
        <CardHeader>
          <CardTitle>{t("jobRoles.list", locale)}</CardTitle>
          <CardDescription>
            {t("jobRoles.listDescription", locale)}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {roles.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {t("jobRoles.noRoles", locale)}
            </div>
          ) : (
            <div className="space-y-3">
              {roles.map((role) => (
                <div
                  key={role.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h4 className="font-medium">{role.name}</h4>
                      <Badge variant={role.active ? "default" : "secondary"}>
                        {role.active
                          ? t("jobRoles.active", locale)
                          : t("jobRoles.inactive", locale)}
                      </Badge>
                    </div>
                    {role.description && (
                      <p className="text-sm text-gray-600 mt-1">
                        {role.description}
                      </p>
                    )}
                    <div className="text-xs text-gray-400 mt-2">
                      {t("jobRoles.createdAt", locale)}:{" "}
                      {new Date(role.created_at).toLocaleDateString()}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Switch
                      checked={role.active}
                      onCheckedChange={() =>
                        handleToggleActive(role.id, role.active)
                      }
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(role)}
                      disabled={creating || editingRole !== null}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(role.id)}
                      disabled={creating || editingRole !== null}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
