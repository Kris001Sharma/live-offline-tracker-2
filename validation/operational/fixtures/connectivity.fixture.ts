export class ConnectivityFixture {
  private static online = true;

  public static setOnline(isOnline: boolean) {
    ConnectivityFixture.online = isOnline;
  }

  public static isOnline(): boolean {
    return ConnectivityFixture.online;
  }
}
