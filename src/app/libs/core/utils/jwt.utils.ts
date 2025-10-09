/**
 * JWT utility functions for token handling - Frontend essentials only
 */
export class JwtUtils {

  /**
   * Decode JWT token payload
   */
  static decodeToken<T = any>(token: string): T | null {
    try {
      if (!token) return null;

      const parts = token.split('.');
      if (parts.length !== 3) return null;

      const payload = parts[1];
      const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
      return JSON.parse(decoded);
    } catch (error) {
      console.error('Error decoding JWT token:', error);
      return null;
    }
  }

  /**
   * Check if token is expired
   */
  static isTokenExpired(token: string): boolean {
    try {
      const payload = this.decodeToken(token);
      if (!payload || !payload.exp) return true;

      const currentTime = Math.floor(Date.now() / 1000);
      return payload.exp < currentTime;
    } catch (error) {
      return true;
    }
  }

  /**
   * Check if token will expire within specified minutes
   */
  static willExpireSoon(token: string, minutesThreshold = 5): boolean {
    try {
      const payload = this.decodeToken(token);
      if (!payload || !payload.exp) return true;

      const currentTime = Math.floor(Date.now() / 1000);
      const expirationTime = payload.exp;
      const thresholdTime = currentTime + (minutesThreshold * 60);

      return expirationTime <= thresholdTime;
    } catch (error) {
      return true;
    }
  }

  /**
   * Extract user ID from token (sub claim)
   */
  static getUserId(token: string): string | null {
    try {
      const payload = this.decodeToken(token);
      return payload?.sub || null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Extract user email from token
   */
  static getUserEmail(token: string): string | null {
    try {
      const payload = this.decodeToken(token);
      return payload?.email || null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Extract user role from token (student or admin)
   */
  static getUserRole(token: string): string | null {
    try {
      const payload = this.decodeToken(token);
      return payload?.role ? payload.role.toLowerCase() : null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Extract first name from token
   */
  static getFirstName(token: string): string | null {
    try {
      const payload = this.decodeToken(token);
      return payload?.first_name || null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Extract last name from token
   */
  static getLastName(token: string): string | null {
    try {
      const payload = this.decodeToken(token);
      return payload?.last_name || null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get full name from token
   */
  static getFullName(token: string): string | null {
    try {
      const firstName = this.getFirstName(token);
      const lastName = this.getLastName(token);

      if (!firstName && !lastName) return null;
      return `${firstName || ''} ${lastName || ''}`.trim();
    } catch (error) {
      return null;
    }
  }

  /**
   * Extract token type (access or refresh)
   */
  static getTokenType(token: string): string | null {
    try {
      const payload = this.decodeToken(token);
      return payload?.type ? payload.type.toLowerCase() : null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Check if user is admin
   */
  static isAdmin(token: string): boolean {
    const role = this.getUserRole(token);
    return role?.toLowerCase() === 'admin';
  }

  /**
   * Check if user is student
   */
  static isStudent(token: string): boolean {
    const role = this.getUserRole(token);
    return role?.toLowerCase() === 'student';
  }
}
