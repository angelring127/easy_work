import assert from "node:assert/strict";
import test from "node:test";

import {
  compareRoleAllocationMetrics,
  evaluateRoleAllocationCandidate,
  findMostConstrainedRoleIds,
} from "./role-allocation";

type TestCandidate = {
  id: string;
  roleIds: Set<string>;
};

const reservableRoleIds = new Set(["supervisor"]);
const roleMemberCounts = new Map([
  ["cook", 3],
  ["server", 3],
  ["supervisor", 1],
]);

test("identifies the role with the highest demand per capable member", () => {
  const constrainedRoleIds = findMostConstrainedRoleIds({
    roleDemandCounts: new Map([
      ["cook", 21],
      ["server", 21],
      ["supervisor", 21],
    ]),
    roleMemberCounts,
  });

  assert.deepEqual([...constrainedRoleIds], ["supervisor"]);
});

function rankCandidates(
  candidates: TestCandidate[],
  remainingHeadcount: number
) {
  const missingRoleIds = new Set(["cook", "server"]);

  return candidates
    .map((candidate) => ({
      candidate,
      metrics: evaluateRoleAllocationCandidate({
        candidateRoleIds: candidate.roleIds,
        otherCandidateRoleIds: candidates
          .filter((other) => other.id !== candidate.id)
          .map((other) => other.roleIds),
        missingRoleIds,
        remainingHeadcount,
        reservableRoleIds,
        roleMemberCounts,
      }),
    }))
    .sort((left, right) =>
      compareRoleAllocationMetrics(left.metrics, right.metrics)
    )
    .map(({ candidate }) => candidate.id);
}

test("preserves a scarce supervisor when two single-role workers can fill two remaining places", () => {
  const ranked = rankCandidates(
    [
      { id: "cook-only", roleIds: new Set(["cook"]) },
      { id: "server-only", roleIds: new Set(["server"]) },
      {
        id: "multi-role-supervisor",
        roleIds: new Set(["cook", "server", "supervisor"]),
      },
    ],
    2
  );

  assert.notEqual(ranked[0], "multi-role-supervisor");
});

test("uses a multi-role worker when only one place remains", () => {
  const ranked = rankCandidates(
    [
      { id: "cook-only", roleIds: new Set(["cook"]) },
      { id: "server-only", roleIds: new Set(["server"]) },
      {
        id: "multi-role-supervisor",
        roleIds: new Set(["cook", "server", "supervisor"]),
      },
    ],
    1
  );

  assert.equal(ranked[0], "multi-role-supervisor");
});

test("keeps supervisor capacity for all seven days of the Granvile pattern", () => {
  type WeeklyCandidate = TestCandidate & {
    difficultWeekdays?: Set<number>;
  };
  const candidates: WeeklyCandidate[] = [
    {
      id: "Com",
      roleIds: new Set(["cook", "server", "supervisor"]),
      difficultWeekdays: new Set([0, 1, 2, 3]),
    },
    { id: "Kurumi", roleIds: new Set(["cook", "server", "supervisor"]) },
    { id: "Veri", roleIds: new Set(["cook", "supervisor"]) },
    {
      id: "SangHo",
      roleIds: new Set(["cook", "server"]),
      difficultWeekdays: new Set([0, 1, 5, 6]),
    },
    {
      id: "Ariya",
      roleIds: new Set(["cook", "server"]),
      difficultWeekdays: new Set([2, 3]),
    },
    { id: "Bagus", roleIds: new Set(["cook"]) },
    { id: "Yeonsu", roleIds: new Set(["server"]) },
  ];
  const counts = new Map<string, number>();
  candidates.forEach((candidate) =>
    candidate.roleIds.forEach((roleId) =>
      counts.set(roleId, (counts.get(roleId) || 0) + 1)
    )
  );
  const weeklyMinutes = new Map<string, number>();
  const openings: string[] = [];

  const assign = ({
    weekday,
    assignedToday,
    missingRoleIds,
    remainingHeadcount,
    shiftMinutes,
  }: {
    weekday: number;
    assignedToday: Set<string>;
    missingRoleIds: Set<string>;
    remainingHeadcount: number;
    shiftMinutes: number;
  }) => {
    const eligible = candidates.filter(
      (candidate) =>
        !assignedToday.has(candidate.id) &&
        !candidate.difficultWeekdays?.has(weekday) &&
        (weeklyMinutes.get(candidate.id) || 0) + shiftMinutes <= 2400
    );
    const [selected] = eligible
      .map((candidate) => ({
        candidate,
        metrics: evaluateRoleAllocationCandidate({
          candidateRoleIds: candidate.roleIds,
          otherCandidateRoleIds: eligible
            .filter((other) => other.id !== candidate.id)
            .map((other) => other.roleIds),
          missingRoleIds,
          remainingHeadcount,
          reservableRoleIds,
          roleMemberCounts: counts,
        }),
      }))
      .sort((left, right) => {
        const roleDiff = compareRoleAllocationMetrics(
          left.metrics,
          right.metrics
        );
        return (
          roleDiff ||
          (weeklyMinutes.get(left.candidate.id) || 0) -
            (weeklyMinutes.get(right.candidate.id) || 0)
        );
      });

    assert.ok(
      selected,
      `No candidate for weekday ${weekday}; assigned ${[
        ...assignedToday,
      ].join(", ")}; weekly ${JSON.stringify(Object.fromEntries(weeklyMinutes))}`
    );
    assignedToday.add(selected.candidate.id);
    weeklyMinutes.set(
      selected.candidate.id,
      (weeklyMinutes.get(selected.candidate.id) || 0) + shiftMinutes
    );
    return selected.candidate;
  };

  for (let weekday = 1; weekday <= 7; weekday += 1) {
    const normalizedWeekday = weekday % 7;
    const assignedToday = new Set<string>();
    const opening = assign({
      weekday: normalizedWeekday,
      assignedToday,
      missingRoleIds: new Set(["supervisor"]),
      remainingHeadcount: 1,
      shiftMinutes: 750,
    });
    openings.push(opening.id);

    const morningMissingRoles = new Set(
      ["cook", "server", "supervisor"].filter(
        (roleId) => !opening.roleIds.has(roleId)
      )
    );
    assign({
      weekday: normalizedWeekday,
      assignedToday,
      missingRoleIds: morningMissingRoles,
      remainingHeadcount: 1,
      shiftMinutes: 390,
    });

    const afternoonWorkers = [opening];
    for (let place = 0; place < 2; place += 1) {
      const coveredRoles = new Set(
        afternoonWorkers.flatMap((worker) => [...worker.roleIds])
      );
      const worker = assign({
        weekday: normalizedWeekday,
        assignedToday,
        missingRoleIds: new Set(
          ["cook", "server", "supervisor"].filter(
            (roleId) => !coveredRoles.has(roleId)
          )
        ),
        remainingHeadcount: 3 - afternoonWorkers.length,
        shiftMinutes: 390,
      });
      afternoonWorkers.push(worker);
    }

    const coveredAfternoonRoles = new Set(
      afternoonWorkers.flatMap((worker) => [...worker.roleIds])
    );
    assert.equal(afternoonWorkers.length, 3);
    assert.deepEqual(
      [...coveredAfternoonRoles].filter((roleId) =>
        new Set(["cook", "server", "supervisor"]).has(roleId)
      ).sort(),
      ["cook", "server", "supervisor"]
    );
  }

  assert.equal(openings.length, 7);
  assert.ok(
    openings.every((candidateId) =>
      candidates
        .find((candidate) => candidate.id === candidateId)
        ?.roleIds.has("supervisor")
    )
  );
  assert.ok([...weeklyMinutes.values()].every((minutes) => minutes <= 2400));
});
