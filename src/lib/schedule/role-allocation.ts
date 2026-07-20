export type RoleAllocationMetrics = {
  minimumAssignmentsNeeded: number;
  reservedRoleCost: number;
  coverageGain: number;
};

type EvaluateRoleAllocationCandidateParams = {
  candidateRoleIds: ReadonlySet<string>;
  otherCandidateRoleIds: ReadonlySet<string>[];
  missingRoleIds: ReadonlySet<string>;
  remainingHeadcount: number;
  reservableRoleIds: ReadonlySet<string>;
  roleMemberCounts: ReadonlyMap<string, number>;
};

export function findMostConstrainedRoleIds({
  roleDemandCounts,
  roleMemberCounts,
}: {
  roleDemandCounts: ReadonlyMap<string, number>;
  roleMemberCounts: ReadonlyMap<string, number>;
}) {
  let highestPressure = 0;
  const constrainedRoleIds = new Set<string>();

  roleDemandCounts.forEach((demandCount, roleId) => {
    const memberCount = roleMemberCounts.get(roleId) || 0;
    if (demandCount <= 0 || memberCount <= 0) {
      return;
    }

    const pressure = demandCount / memberCount;
    if (pressure > highestPressure) {
      highestPressure = pressure;
      constrainedRoleIds.clear();
      constrainedRoleIds.add(roleId);
      return;
    }

    if (pressure === highestPressure) {
      constrainedRoleIds.add(roleId);
    }
  });

  return constrainedRoleIds;
}

function minimumCandidatesToCoverRoles(
  roleIds: ReadonlySet<string>,
  candidates: ReadonlySet<string>[]
) {
  const roles = [...roleIds];
  if (roles.length === 0) {
    return 0;
  }

  const toStateKey = (coveredRoleIds: ReadonlySet<string>) =>
    roles.filter((roleId) => coveredRoleIds.has(roleId)).join("\u0000");
  const fullStateKey = roles.join("\u0000");
  let states = new Map<string, { coveredRoleIds: Set<string>; count: number }>([
    ["", { coveredRoleIds: new Set<string>(), count: 0 }],
  ]);

  candidates.forEach((candidateRoleIds) => {
    if (!roles.some((roleId) => candidateRoleIds.has(roleId))) {
      return;
    }

    const nextStates = new Map(states);
    states.forEach(({ coveredRoleIds, count }) => {
      const nextCoveredRoleIds = new Set(coveredRoleIds);
      roles.forEach((roleId) => {
        if (candidateRoleIds.has(roleId)) {
          nextCoveredRoleIds.add(roleId);
        }
      });
      const nextStateKey = toStateKey(nextCoveredRoleIds);
      const nextCount = count + 1;
      const previousState = nextStates.get(nextStateKey);
      if (previousState === undefined || nextCount < previousState.count) {
        nextStates.set(nextStateKey, {
          coveredRoleIds: nextCoveredRoleIds,
          count: nextCount,
        });
      }
    });
    states = nextStates;
  });

  return states.get(fullStateKey)?.count ?? Number.POSITIVE_INFINITY;
}

export function evaluateRoleAllocationCandidate({
  candidateRoleIds,
  otherCandidateRoleIds,
  missingRoleIds,
  remainingHeadcount,
  reservableRoleIds,
  roleMemberCounts,
}: EvaluateRoleAllocationCandidateParams): RoleAllocationMetrics {
  const remainingRoleIds = new Set(
    [...missingRoleIds].filter((roleId) => !candidateRoleIds.has(roleId))
  );
  const followingAssignments = minimumCandidatesToCoverRoles(
    remainingRoleIds,
    otherCandidateRoleIds
  );
  const minimumAssignmentsNeeded =
    1 +
    Math.max(
      Math.max(0, remainingHeadcount - 1),
      followingAssignments
    );
  const reservedRoleCost = [...candidateRoleIds]
    .filter(
      (roleId) =>
        reservableRoleIds.has(roleId) && !missingRoleIds.has(roleId)
    )
    .reduce(
      (cost, roleId) => cost + 1 / Math.max(1, roleMemberCounts.get(roleId) || 1),
      0
    );

  return {
    minimumAssignmentsNeeded,
    reservedRoleCost,
    coverageGain: [...missingRoleIds].filter((roleId) =>
      candidateRoleIds.has(roleId)
    ).length,
  };
}

export function compareRoleAllocationMetrics(
  left: RoleAllocationMetrics,
  right: RoleAllocationMetrics
) {
  if (left.minimumAssignmentsNeeded !== right.minimumAssignmentsNeeded) {
    return left.minimumAssignmentsNeeded - right.minimumAssignmentsNeeded;
  }

  if (left.reservedRoleCost !== right.reservedRoleCost) {
    return left.reservedRoleCost - right.reservedRoleCost;
  }

  return right.coverageGain - left.coverageGain;
}
