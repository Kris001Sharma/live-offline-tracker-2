export class TimeFixture {
  public static nowISO(): string {
    return new Date().toISOString();
  }

  public static offsetMinutes(minutes: number): string {
    return new Date(Date.now() + minutes * 60 * 1000).toISOString();
  }
}
