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
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Trash2,
  Save,
  Edit,
  Eye,
  CheckCircle,
  AlertTriangle,
  Users,
} from "lucide-react";
import { t } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import type { RoleCoverage } from "@/lib/schedule/role-coverage";

interface StoreJobRole {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  active: boolean;
}

interface WorkItemRoleRequirement {
  jobRoleId: string;
  minCount: number;
}

interface WorkItemRoleManagerProps {
  workItemId: string;
  storeId: string;
  locale: Locale;
  userRole: "MASTER" | "SUB_MANAGER" | "PART_TIMER";
  onSave?: (requirements: WorkItemRoleRequirement[]) => void;
  showEditButton?: boolean;
  defaultMode?: "view" | "edit";
}

export function WorkItemRoleManager({
  workItemId,
  storeId,
  locale,
  userRole,
  onSave,
  showEditButton = true,
  defaultMode = "view",
}: WorkItemRoleManagerProps) {
  const [mode, setMode] = useState<"view" | "edit">(defaultMode);
  const [availableRoles, setAvailableRoles] = useState<StoreJobRole[]>([]);
  const [requirements, setRequirements] = useState<WorkItemRoleRequirement[]>(
    []
  );
  const [roleCoverage, setRoleCoverage] = useState<RoleCoverage[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const canEdit = userRole === "MASTER" || userRole === "SUB_MANAGER";

  // 사용 가능한 역할 로드
  const loadAvailableRoles = async () => {
    try {
      const response = await fetch(`/api/store-job-roles?store_id=${storeId}`);
      const result = await response.json();

      if (result.success) {
        setAvailableRoles(
          result.data.filter((role: StoreJobRole) => role.active)
        );
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

  // 기존 역할 요구 사항 로드
  const loadExistingRequirements = async () => {
    try {
      const response = await fetch(
        `/api/work-item-required-roles?work_item_id=${workItemId}`
      );
      const result = await response.json();

      if (result.success) {
        const existingRequirements = result.data.map((item: any) => ({
          jobRoleId: item.job_role_id,
          minCount: item.min_count,
        }));
        setRequirements(existingRequirements);

        // 역할 커버리지 계산 (표시 모드용)
        if (mode === "view") {
          calculateRoleCoverage(existingRequirements);
        }
      }
    } catch (error) {
      console.error("역할 요구 사항 로드 오류:", error);
    }
  };

  // 역할 커버리지 계산 (간단한 버전)
  const calculateRoleCoverage = (reqs: WorkItemRoleRequirement[]) => {
    const coverage: RoleCoverage[] = reqs.map((req) => {
      const role = availableRoles.find((r) => r.id === req.jobRoleId);
      return {
        jobRoleId: req.jobRoleId,
        jobRoleName: role?.name || "Unknown",
        jobRoleCode: role?.code || null,
        requiredCount: req.minCount,
        currentCount: 0, // 실제 스케줄 데이터가 있을 때 계산
        isSufficient: false,
      };
    });
    setRoleCoverage(coverage);
  };

  useEffect(() => {
    loadAvailableRoles();
    loadExistingRequirements();
  }, [workItemId, storeId]);

  const addRequirement = () => {
    if (availableRoles.length === 0) return;

    const newRequirement: WorkItemRoleRequirement = {
      jobRoleId: availableRoles[0].id,
      minCount: 1,
    };
    setRequirements([...requirements, newRequirement]);
  };

  const removeRequirement = (index: number) => {
    setRequirements(requirements.filter((_, i) => i !== index));
  };

  const updateRequirement = (
    index: number,
    field: keyof WorkItemRoleRequirement,
    value: string | number
  ) => {
    const updated = [...requirements];
    updated[index] = { ...updated[index], [field]: value };
    setRequirements(updated);
  };

  const getUnusedRoles = () => {
    const usedRoleIds = requirements.map((r) => r.jobRoleId);
    return availableRoles.filter((role) => !usedRoleIds.includes(role.id));
  };

  const handleSave = async () => {
    if (requirements.length === 0) {
      // 모든 역할 요구 사항 삭제
      try {
        const response = await fetch("/api/work-item-required-roles", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workItemId }),
        });

        if (response.ok) {
          toast({
            title: t("workItemRoles.saveSuccess", locale),
          });
          onSave?.([]);
          setMode("view");
          setRoleCoverage([]);
        } else {
          throw new Error("Failed to save");
        }
      } catch (error) {
        toast({
          title: t("common.error", locale),
          description: String(error),
          variant: "destructive",
        });
      }
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/work-item-required-roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workItemId,
          roles: requirements,
        }),
      });

      if (response.ok) {
        toast({
          title: t("workItemRoles.saveSuccess", locale),
        });
        onSave?.(requirements);
        setMode("view");
        calculateRoleCoverage(requirements);
      } else {
        throw new Error("Failed to save");
      }
    } catch (error) {
      toast({
        title: t("common.error", locale),
        description: String(error),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const toggleMode = () => {
    setMode(mode === "view" ? "edit" : "view");
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("workItemRoles.title", locale)}</CardTitle>
          <CardDescription>
            {t("workItemRoles.description", locale)}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">{t("common.loading", locale)}</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              {t("workItemRoles.title", locale)}
            </CardTitle>
            <CardDescription>
              {t("workItemRoles.description", locale)}
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            {showEditButton && canEdit && (
              <Button variant="outline" size="sm" onClick={toggleMode}>
                {mode === "view" ? (
                  <>
                    <Edit className="w-4 h-4 mr-2" />
                    {t("common.edit", locale)}
                  </>
                ) : (
                  <>
                    <Eye className="w-4 h-4 mr-2" />
                    {t("common.view", locale)}
                  </>
                )}
              </Button>
            )}

            {mode === "edit" && canEdit && (
              <Button
                onClick={addRequirement}
                disabled={getUnusedRoles().length === 0}
              >
                <Plus className="w-4 h-4 mr-2" />
                {t("workItemRoles.addRole", locale)}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {mode === "edit" ? (
          // 편집 모드
          <>
            {requirements.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {t("common.noData", locale)}
              </div>
            ) : (
              requirements.map((requirement, index) => (
                <div
                  key={index}
                  className="flex items-center gap-4 p-4 border rounded-lg"
                >
                  <div className="flex-1">
                    <Label htmlFor={`role-${index}`}>역할</Label>
                    <select
                      id={`role-${index}`}
                      value={requirement.jobRoleId}
                      onChange={(e) =>
                        updateRequirement(index, "jobRoleId", e.target.value)
                      }
                      className="w-full mt-1 p-2 border rounded-md"
                    >
                      {availableRoles.map((role) => (
                        <option key={role.id} value={role.id}>
                          {role.code || role.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex-1">
                    <Label htmlFor={`count-${index}`}>
                      {t("workItemRoles.minCount", locale)}
                    </Label>
                    <Input
                      id={`count-${index}`}
                      type="number"
                      min="0"
                      max="99"
                      value={requirement.minCount}
                      onChange={(e) =>
                        updateRequirement(
                          index,
                          "minCount",
                          parseInt(e.target.value) || 0
                        )
                      }
                      className="mt-1"
                    />
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => removeRequirement(index)}
                    className="mt-6"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))
            )}

            {requirements.length > 0 && (
              <div className="flex justify-end">
                <Button onClick={handleSave} disabled={saving}>
                  <Save className="w-4 h-4 mr-2" />
                  {saving
                    ? t("common.loading", locale)
                    : t("common.save", locale)}
                </Button>
              </div>
            )}
          </>
        ) : (
          // 표시 모드
          <>
            {requirements.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {t("common.noData", locale)}
              </div>
            ) : (
              <>
                {/* 역할별 커버리지 표시 */}
                <div className="space-y-2">
                  {roleCoverage.map((role) => (
                    <div
                      key={role.jobRoleId}
                      className="flex items-center justify-between p-2 border rounded-lg"
                    >
                      <div className="flex items-center gap-2">
                        {role.isSufficient ? (
                          <CheckCircle className="w-4 h-4 text-green-600" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-red-600" />
                        )}
                        <span className="font-medium">
                          {role.jobRoleCode || role.jobRoleName}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            role.isSufficient ? "default" : "destructive"
                          }
                        >
                          {t("workItemRoles.currentCount", locale, {
                            current: role.currentCount,
                          })}
                        </Badge>
                        <span className="text-sm text-muted-foreground">/</span>
                        <Badge variant="outline">
                          {t("workItemRoles.requiredCount", locale, {
                            required: role.requiredCount,
                          })}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>

                {/* 요약 정보 */}
                <div className="pt-2 border-t">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {t("workItemRoles.roleCoverage", locale)}
                    </span>
                    <Badge variant="default">
                      {t("workItemRoles.requirementsSet", locale)}
                    </Badge>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
