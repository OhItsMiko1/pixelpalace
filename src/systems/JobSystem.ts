export class JobSystem {
  /** In-game day number of the last worked shift, or null if never worked. */
  lastWorkedDay: number | null = null;

  canWork(currentDay: number): boolean {
    return this.lastWorkedDay !== currentDay;
  }

  work(currentDay: number): void {
    this.lastWorkedDay = currentDay;
  }
}
