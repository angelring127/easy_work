import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const { searchParams } = new URL(request.url);
  const store_id = searchParams.get("store_id");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const targetUserId = searchParams.get("user_id");
  const targetDate = searchParams.get("date");

  if (!store_id || !from || !to) {
    return NextResponse.json(
      { success: false, error: "store_id, from, to are required" },
      { status: 400 }
    );
  }

  const { data: authUser, error: authError } = await supabase.auth.getUser();
  if (authError || !authUser.user) {
    return NextResponse.json(
      { success: false, error: "unauthorized" },
      { status: 401 }
    );
  }

  // 간단 권한: MASTER, SUB만 허용
  const { data: role, error: roleError } = await supabase
    .from("user_store_roles")
    .select("role")
    .eq("store_id", store_id)
    .eq("user_id", authUser.user.id)
    .eq("status", "ACTIVE")
    .single();

  if (
    roleError ||
    !role ||
    !["MASTER", "SUB", "SUB_MANAGER"].includes(role.role)
  ) {
    return NextResponse.json(
      { success: false, error: "Insufficient permissions" },
      { status: 403 }
    );
  }

  try {
    // 매장 영업 시간 가져오기
    const { data: businessHours, error: businessHoursError } = await supabase
      .from("store_business_hours")
      .select("*")
      .eq("store_id", store_id);

    if (businessHoursError) {
      return NextResponse.json(
        { success: false, error: businessHoursError.message },
        { status: 500 }
      );
    }

    // 영업 시간이 없으면 기본값 사용
    const defaultStartTime = "09:00";
    const defaultEndTime = "18:00";

    // 기간 내 배정되지 않은 work_items 가져오기 (간단화: 해당 기간 날짜별 하나씩 있다고 가정)
    const { data: items, error: itemsError } = await supabase
      .from("work_items")
      .select("id, name, store_id")
      .eq("store_id", store_id);

    if (itemsError) {
      return NextResponse.json(
        { success: false, error: itemsError.message },
        { status: 500 }
      );
    }

    // 기간 내 사용자 목록과 출근 불가 조회
    // 매장 구성원(Job Role 기준 후보 계산을 위해 user_store_job_roles 사용)
    const { data: userJobRoles, error: userJobRolesError } = await supabase
      .from("user_store_job_roles")
      .select("user_id, store_job_roles(code)")
      .eq("store_id", store_id);
    if (userJobRolesError) {
      return NextResponse.json(
        { success: false, error: userJobRolesError.message },
        { status: 500 }
      );
    }

    const { data: unavailable } = await supabase
      .from("user_availability")
      .select("user_id, date")
      .eq("store_id", store_id)
      .gte("date", from)
      .lte("date", to);

    const { data: existing } = await supabase
      .from("schedule_assignments")
      .select("user_id, date")
      .eq("store_id", store_id)
      .gte("date", from)
      .lte("date", to);

    const unavailableSet = new Set(
      (unavailable || []).map((u) => `${u.user_id}:${u.date}`)
    );
    const assignedSet = new Set(
      (existing || []).map((a) => `${a.user_id}:${a.date}`)
    );

    // 간단한 규칙: 각 날짜/항목마다 첫 번째로 조건 만족하는 유저 배정(역할 포함)
    const candidatesByRole = new Map<string, string[]>();
    (userJobRoles || []).forEach((m: any) => {
      const code = m.store_job_roles?.code;
      if (!code) return;
      const arr = candidatesByRole.get(code) || [];
      arr.push(m.user_id);
      candidatesByRole.set(code, arr);
    });

    // work item의 요구 역할 조회
    const { data: reqRoles, error: reqError } = await supabase
      .from("work_item_required_roles")
      .select("work_item_id, store_job_roles(code)")
      .in(
        "work_item_id",
        (items || []).map((it) => it.id)
      );
    if (reqError) {
      return NextResponse.json(
        { success: false, error: reqError.message },
        { status: 500 }
      );
    }
    const requiredByItem = new Map<string, string[]>();
    (reqRoles || []).forEach((r: any) => {
      const arr = requiredByItem.get(r.work_item_id) || [];
      if (r.store_job_roles?.code) arr.push(r.store_job_roles.code);
      requiredByItem.set(r.work_item_id, arr);
    });

    const chosen: Array<{
      user_id: string;
      work_item_id: string;
      date: string;
    }> = [];
    // 날짜 배열 생성 (포함 범위)
    const start = new Date(from);
    const end = new Date(to);
    const dateLoop = (cb: (dateStr: string) => void) => {
      if (targetDate) {
        cb(targetDate);
        return;
      }
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        cb(d.toISOString().split("T")[0]);
      }
    };
    dateLoop((dateStr) => {
      (items || []).forEach((item) => {
        const roles: string[] = requiredByItem.get(item.id) || [];
        // 역할 만족하는 후보 집합
        let pool = new Set<string>();
        if (roles.length === 0) {
          (userJobRoles || []).forEach((m: any) => pool.add(m.user_id));
        } else {
          roles.forEach((r) => {
            (candidatesByRole.get(r) || []).forEach((uid) => pool.add(uid));
          });
        }
        if (targetUserId) {
          pool = new Set(
            Array.from(pool).filter((uid) => uid === targetUserId)
          );
        }
        // 출근 불가/이미 배정 제외
        const pick = Array.from(pool).find((uid) => {
          const key = `${uid}:${dateStr}`;
          return !unavailableSet.has(key) && !assignedSet.has(key);
        });
        if (pick) {
          chosen.push({ user_id: pick, work_item_id: item.id, date: dateStr });
          assignedSet.add(`${pick}:${dateStr}`);
        }
      });
    });

    // 삽입
    if (chosen.length > 0) {
      const rows = chosen.map((c) => {
        // 해당 날짜의 영업 시간 찾기
        const date = new Date(c.date);
        const dayOfWeek = date.getDay(); // 0=일요일, 1=월요일, ..., 6=토요일

        let startTime = defaultStartTime;
        let endTime = defaultEndTime;

        if (businessHours && businessHours.length > 0) {
          // 요일별 영업 시간 찾기 (day_of_week: 0=일요일, 1=월요일, ..., 6=토요일)
          const dayBusinessHour = businessHours.find(
            (bh) => bh.day_of_week === dayOfWeek
          );
          if (
            dayBusinessHour &&
            dayBusinessHour.open_min !== null &&
            dayBusinessHour.close_min !== null
          ) {
            // 분을 시간:분 형식으로 변환
            const openHour = Math.floor(dayBusinessHour.open_min / 60);
            const openMinute = dayBusinessHour.open_min % 60;

            // close_min이 0인 경우 자정(24:00)으로 처리
            const closeMin =
              dayBusinessHour.close_min === 0
                ? 1440
                : dayBusinessHour.close_min;
            const closeHour = Math.floor(closeMin / 60);
            const closeMinute = closeMin % 60;

            startTime = `${openHour.toString().padStart(2, "0")}:${openMinute
              .toString()
              .padStart(2, "0")}`;
            endTime = `${closeHour.toString().padStart(2, "0")}:${closeMinute
              .toString()
              .padStart(2, "0")}`;
          }
        }

        return {
          store_id,
          user_id: c.user_id,
          work_item_id: c.work_item_id,
          date: c.date,
          start_time: startTime,
          end_time: endTime,
          status: "ASSIGNED",
          created_by: authUser.user!.id,
        };
      });
      const { error: insertError } = await supabase
        .from("schedule_assignments")
        .insert(rows);
      if (insertError) {
        return NextResponse.json(
          { success: false, error: insertError.message },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      data: { created: chosen.length },
    });
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e?.message || "error" },
      { status: 500 }
    );
  }
}
