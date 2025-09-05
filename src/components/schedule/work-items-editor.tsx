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
import { useToast } from "@/hooks/use-toast";
import { Plus, Minus, Edit, Trash2, Save, X, Clock, Users } from "lucide-react";
import { t } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";

interface WorkItem {
  id: string;
  name: string;
  start_min: number;
  end_min: number;
  unpaid_break_min: number;
  max_headcount: number;
  role_hint?: string;
}

interface JobRole {
  id: string;
  name: string;
  description?: string;
  active: boolean;
}

interface WorkItemRoleRequirement {
  job_role_id: string;
  min_count: number;
}

interface WorkItemsEditorProps {
  storeId: string;
  locale: Locale;
}

export function WorkItemsEditor({ storeId, locale }: WorkItemsEditorProps) {
  const [workItems, setWorkItems] = useState<WorkItem[]>([]);
  const [jobRoles, setJobRoles] = useState<JobRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    startHour: 10,
    startMinute: 0,
    startAmPm: "am" as "am" | "pm",
    endHour: 12,
    endMinute: 0,
    endAmPm: "am" as "am" | "pm",
    unpaidBreakMin: 0,
    maxHeadcount: 1,
    roleRequirements: [] as WorkItemRoleRequirement[],
  });
  const { toast } = useToast();

  // 근무 항목과 직무 목록 로드
  const loadData = async () => {
    try {
      const [workItemsRes, jobRolesRes] = await Promise.all([
        fetch(`/api/work-items?store_id=${storeId}`),
        fetch(`/api/store-job-roles?store_id=${storeId}`),
      ]);

      if (workItemsRes.ok) {
        const workItemsData = await workItemsRes.json();
        setWorkItems(workItemsData.data || []);
      }

      if (jobRolesRes.ok) {
        const jobRolesData = await jobRolesRes.json();
        setJobRoles(jobRolesData.data || []);
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
    loadData();
  }, [storeId]);

  const resetForm = () => {
    setForm({
      name: "",
      startHour: 10,
      startMinute: 0,
      startAmPm: "am",
      endHour: 12,
      endMinute: 0,
      endAmPm: "pm",
      unpaidBreakMin: 0,
      maxHeadcount: 1,
      roleRequirements: [],
    });
  };

  const startCreating = () => {
    setCreating(true);
    setEditingItem(null);
    resetForm();
  };

  const handleCancel = () => {
    setCreating(false);
    setEditingItem(null);
    resetForm();
  };

  // AM/PM을 24시간 형식으로 변환
  const convertTo24Hour = (hour: number, amPm: "am" | "pm") => {
    if (amPm === "am") {
      return hour === 12 ? 0 : hour;
    } else {
      return hour === 12 ? 12 : hour + 12;
    }
  };

  // 24시간 형식을 AM/PM으로 변환
  const convertFrom24Hour = (hour: number) => {
    if (hour === 0) return { hour: 12, amPm: "am" as const };
    if (hour === 12) return { hour: 12, amPm: "pm" as const };
    if (hour > 12) return { hour: hour - 12, amPm: "pm" as const };
    return { hour, amPm: "am" as const };
  };

  const addRoleRequirement = (jobRoleId: string) => {
    const existing = form.roleRequirements.find(
      (r) => r.job_role_id === jobRoleId
    );
    if (existing) {
      setForm((prev) => ({
        ...prev,
        roleRequirements: prev.roleRequirements.map((r) =>
          r.job_role_id === jobRoleId
            ? { ...r, min_count: Math.min(r.min_count + 1, 99) }
            : r
        ),
      }));
    } else {
      setForm((prev) => ({
        ...prev,
        roleRequirements: [
          ...prev.roleRequirements,
          { job_role_id: jobRoleId, min_count: 1 },
        ],
      }));
    }
  };

  const removeRoleRequirement = (jobRoleId: string) => {
    setForm((prev) => ({
      ...prev,
      roleRequirements: prev.roleRequirements.filter(
        (r) => r.job_role_id !== jobRoleId
      ),
    }));
  };

  const updateRoleRequirement = (jobRoleId: string, minCount: number) => {
    setForm((prev) => ({
      ...prev,
      roleRequirements: prev.roleRequirements.map((r) =>
        r.job_role_id === jobRoleId ? { ...r, min_count: minCount } : r
      ),
    }));
  };

  // 직무별 최소 인원 합계 계산
  const totalRequiredHeadcount = form.roleRequirements.reduce(
    (sum, req) => sum + req.min_count,
    0
  );

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      toast({
        title: t("common.error", locale),
        description: t("workItems.nameRequired", locale),
        variant: "destructive",
      });
      return;
    }

    // 시간을 24시간 형식으로 변환
    const startHour24 = convertTo24Hour(form.startHour, form.startAmPm);
    const endHour24 = convertTo24Hour(form.endHour, form.endAmPm);

    // 시간을 분으로 변환
    const startMin = startHour24 * 60 + form.startMinute;
    let endMin = endHour24 * 60 + form.endMinute;

    // 다음날로 넘어가는 경우 자동 계산
    if (endMin <= startMin) {
      endMin += 24 * 60; // 다음날로 설정
    }

    if (form.unpaidBreakMin > endMin - startMin) {
      toast({
        title: t("common.error", locale),
        description: t("workItems.breakTooLong", locale),
        variant: "destructive",
      });
      return;
    }

    // 최대 인원을 직무별 합계로 설정
    const calculatedMaxHeadcount = Math.max(totalRequiredHeadcount, 1);

    try {
      const response = await fetch("/api/work-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId,
          name: form.name.trim(),
          startMin,
          endMin,
          unpaidBreakMin: form.unpaidBreakMin,
          maxHeadcount: calculatedMaxHeadcount,
        }),
      });

      if (response.ok) {
        // 직무 요구 사항 설정
        if (form.roleRequirements.length > 0) {
          const workItem = await response.json();
          await fetch("/api/work-item-required-roles", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              workItemId: workItem.data.id,
              roles: form.roleRequirements,
            }),
          });
        }

        toast({
          title: t("workItems.createSuccess", locale),
        });
        await loadData();
        handleCancel();
      } else {
        throw new Error("Failed to create work item");
      }
    } catch (error) {
      toast({
        title: t("common.error", locale),
        description: String(error),
        variant: "destructive",
      });
    }
  };

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    const isNextDay = hours >= 24;
    const displayHours = isNextDay ? hours - 24 : hours;
    const { hour, amPm } = convertFrom24Hour(displayHours);
    const ampmText = amPm === "am" ? "오전" : "오후";

    return `${isNextDay ? "다음날 " : ""}${ampmText} ${hour}시 ${mins
      .toString()
      .padStart(2, "0")}분`;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("workItems.title", locale)}</CardTitle>
          <CardDescription>
            {t("workItems.description", locale)}
          </CardDescription>
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
            <Clock className="w-5 h-5" />
            {t("workItems.title", locale)}
          </h3>
          <p className="text-sm text-gray-600">
            {t("workItems.description", locale)}
          </p>
        </div>
        <Button
          onClick={startCreating}
          disabled={creating || editingItem !== null}
        >
          <Plus className="w-4 h-4 mr-2" />
          {t("workItems.create", locale)}
        </Button>
      </div>

      {/* 근무 항목 생성/수정 폼 */}
      {creating && (
        <Card>
          <CardHeader>
            <CardTitle>{t("workItems.create", locale)}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 기본 정보 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="work-item-name">
                  {t("workItems.name", locale)} *
                </Label>
                <Input
                  id="work-item-name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder={t("workItems.namePlaceholder", locale)}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("workItems.calculatedMaxHeadcount", locale)}</Label>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-lg px-3 py-1">
                    {totalRequiredHeadcount}
                  </Badge>
                  <span className="text-sm text-gray-600">
                    {t("workItems.autoCalculated", locale)}
                  </span>
                </div>
              </div>
            </div>

            {/* 시간 설정 */}
            <div className="space-y-4">
              <Label className="text-base font-medium">
                {t("workItems.timeSettings", locale)}
              </Label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>{t("workItems.startTime", locale)}</Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      min={1}
                      max={12}
                      value={form.startHour}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          startHour: Number(e.target.value),
                        })
                      }
                      className="w-16"
                    />
                    <span className="flex items-center">:</span>
                    <Input
                      type="number"
                      min={0}
                      max={59}
                      value={form.startMinute}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          startMinute: Number(e.target.value),
                        })
                      }
                      className="w-16"
                    />
                    <select
                      value={form.startAmPm}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          startAmPm: e.target.value as "am" | "pm",
                        })
                      }
                      className="px-3 py-2 border rounded-md"
                    >
                      <option value="am">오전</option>
                      <option value="pm">오후</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>{t("workItems.endTime", locale)}</Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      min={1}
                      max={12}
                      value={form.endHour}
                      onChange={(e) =>
                        setForm({ ...form, endHour: Number(e.target.value) })
                      }
                      className="w-16"
                    />
                    <span className="flex items-center">:</span>
                    <Input
                      type="number"
                      min={0}
                      max={59}
                      value={form.endMinute}
                      onChange={(e) =>
                        setForm({ ...form, endMinute: Number(e.target.value) })
                      }
                      className="w-16"
                    />
                    <select
                      value={form.endAmPm}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          endAmPm: e.target.value as "am" | "pm",
                        })
                      }
                      className="px-3 py-2 border rounded-md"
                    >
                      <option value="am">오전</option>
                      <option value="pm">오후</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>{t("workItems.break", locale)}</Label>
                  <Input
                    type="number"
                    min={0}
                    max={240}
                    value={form.unpaidBreakMin}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        unpaidBreakMin: Number(e.target.value),
                      })
                    }
                    placeholder="분"
                  />
                </div>
              </div>
              <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded-md">
                <p>{t("workItems.timeInfo", locale)}</p>
              </div>
            </div>

            {/* 직무 요구 사항 */}
            <div className="space-y-4">
              <Label className="text-base font-medium">
                {t("workItems.roleRequirements", locale)}
              </Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t("workItems.availableJobs", locale)}</Label>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {jobRoles
                      .filter((role) => role.active)
                      .map((role) => (
                        <div
                          key={role.id}
                          className="flex items-center justify-between p-2 border rounded"
                        >
                          <span className="text-sm">{role.name}</span>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => addRoleRequirement(role.id)}
                          >
                            <Plus className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>{t("workItems.selectedJobs", locale)}</Label>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {form.roleRequirements.map((req) => {
                      const role = jobRoles.find(
                        (r) => r.id === req.job_role_id
                      );
                      if (!role) return null;

                      return (
                        <div
                          key={req.job_role_id}
                          className="flex items-center justify-between p-2 border rounded bg-gray-50"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-sm">{role.name}</span>
                            <Badge variant="secondary">{req.min_count}</Badge>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                updateRoleRequirement(
                                  req.job_role_id,
                                  Math.max(0, req.min_count - 1)
                                )
                              }
                              disabled={req.min_count <= 0}
                            >
                              <Minus className="w-3 h-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                updateRoleRequirement(
                                  req.job_role_id,
                                  req.min_count + 1
                                )
                              }
                            >
                              <Plus className="w-3 h-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                removeRoleRequirement(req.job_role_id)
                              }
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                    {form.roleRequirements.length === 0 && (
                      <div className="text-center py-4 text-gray-500 text-sm">
                        {t("workItems.noRolesSelected", locale)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* 액션 버튼 */}
            <div className="flex gap-2">
              <Button onClick={handleSubmit}>
                <Save className="w-4 h-4 mr-2" />
                {t("common.create", locale)}
              </Button>
              <Button variant="outline" onClick={handleCancel}>
                <X className="w-4 h-4 mr-2" />
                {t("common.cancel", locale)}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 근무 항목 목록 */}
      <Card>
        <CardHeader>
          <CardTitle>{t("workItems.list", locale)}</CardTitle>
          <CardDescription>
            {t("workItems.listDescription", locale)}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {workItems.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {t("workItems.noItems", locale)}
            </div>
          ) : (
            <div className="space-y-3">
              {workItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h4 className="font-medium">{item.name}</h4>
                      <Badge variant="outline">
                        {t("workItems.maxHeadcount", locale)}:{" "}
                        {item.max_headcount}
                      </Badge>
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      <div className="flex items-center gap-4">
                        <span>
                          {t("workItems.start", locale)}:{" "}
                          {formatTime(item.start_min)}
                        </span>
                        <span>
                          {t("workItems.end", locale)}:{" "}
                          {formatTime(item.end_min)}
                        </span>
                        {item.unpaid_break_min > 0 && (
                          <span>
                            {t("workItems.break", locale)}:{" "}
                            {item.unpaid_break_min}분
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        // 편집 기능은 향후 구현
                        toast({
                          title: t("common.info", locale),
                          description: t(
                            "workItems.editNotImplemented",
                            locale
                          ),
                        });
                      }}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        // 삭제 기능은 향후 구현
                        toast({
                          title: t("common.info", locale),
                          description: t(
                            "workItems.deleteNotImplemented",
                            locale
                          ),
                        });
                      }}
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
