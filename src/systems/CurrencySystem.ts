export class CurrencySystem {
  /** Gold, starts with enough for an early shop purchase or two. */
  value = 15;

  earn(amount: number): void {
    this.value += amount;
  }

  /** Returns false and leaves value unchanged if there isn't enough gold. */
  spend(amount: number): boolean {
    if (this.value < amount) return false;
    this.value -= amount;
    return true;
  }
}
