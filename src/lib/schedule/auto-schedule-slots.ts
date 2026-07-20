export type WorkItemSlotSource = {
  readonly start_min: number;
  readonly end_min: number;
  readonly unpaid_break_min: number | null;
};

export type WorkItemSlot<T extends WorkItemSlotSource> = {
  readonly date: string;
  readonly workItem: T;
  readonly startMin: number;
  readonly endMin: number;
  readonly unpaidBreakMin: number;
};

export function createWorkItemSlots<T extends WorkItemSlotSource>(
  date: string,
  workItems: readonly T[]
): WorkItemSlot<T>[] {
  return workItems.map((workItem) => ({
    date,
    workItem,
    startMin: workItem.start_min,
    endMin: workItem.end_min,
    unpaidBreakMin: workItem.unpaid_break_min ?? 0,
  }));
}
