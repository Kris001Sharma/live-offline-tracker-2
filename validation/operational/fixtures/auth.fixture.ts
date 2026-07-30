import { AuthenticationEngine, AuthenticationState } from '../../../modules/authentication';

export class AuthFixture {
  public static async setupAuthenticatedSession(email = 'admin@sapana.local', password = 'password123') {
    AuthenticationEngine.initialize();
    return await AuthenticationEngine.login(email, password);
  }

  public static async clearSession() {
    await AuthenticationEngine.logout();
  }

  public static getStatus() {
    return AuthenticationEngine.status();
  }
}
