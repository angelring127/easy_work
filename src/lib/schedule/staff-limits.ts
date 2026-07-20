export type StaffLimitInterval = {
  readonly startMin: number;
  readonly endMin: number;
};

type StaffLimitCheck = {
  readonly assignments: readonly StaffLimitInterval[];
  readonly proposedSlot: StaffLimitInterval;
  readonly boundaryMin: number;
  readonly maxMorningStaff: number;
  readonly maxAfternoonStaff: number;
};

function getPeakConcurrentHeadcount(
  intervals: readonly StaffLimitInterval[],
  periodStartMin: number,
  periodEndMin: number
): number {
  const events = intervals
    .filter(
      (interval) =>
        interval.startMin < periodEndMin && interval.endMin > periodStartMin
    )
    .flatMap((interval) => [
      { minute: Math.max(interval.startMin, periodStartMin), delta: 1 },
      { minute: Math.min(interval.endMin, periodEndMin), delta: -1 },
    ])
    .sort((left, right) => left.minute - right.minute || left.delta - right.delta);

  let currentHeadcount = 0;
  return events.reduce((peakHeadcount, event) => {
    currentHeadcount += event.delta;
    return Math.max(peakHeadcount, currentHeadcount);
  }, 0);
}

export function wouldExceedConcurrentStaffLimit({
  assignments,
  proposedSlot,
  boundaryMin,
  maxMorningStaff,
  maxAfternoonStaff,
}: StaffLimitCheck): boolean {
  const intervals = [...assignments, proposedSlot];
  const morningPeak = getPeakConcurrentHeadcount(intervals, 0, boundaryMin);
  const afternoonPeak = getPeakConcurrentHeadcount(
    intervals,
    boundaryMin,
    1440
  );

  return (
    (maxMorningStaff > 0 && morningPeak > maxMorningStaff) ||
    (maxAfternoonStaff > 0 && afternoonPeak > maxAfternoonStaff)
  );
}
