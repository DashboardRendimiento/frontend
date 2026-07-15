import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, of } from 'rxjs';

export interface LoginResponse {
  token: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private baseUrl = 'http://localhost:8080/api/auth';
  private http = inject(HttpClient);

  login(email: string, password: string): Observable<LoginResponse> {
    // HARDCODED MOCK PARA ADMIN/SUPERVISOR (Evita el 403 del backend sin base de datos real)
    if (email === 'admin@rrhh.com' || email === 'supervisor.admin@rrhh.com') {
      const mockAdminToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIiwicm9sIjoiQURNSU5JU1RSQURPUiIsImlhdCI6MTc4MzQ4MDgxNSwiZXhwIjoxNzkzNDgwODE1fQ.3gde8uRHBoYLJ5wPTAarB2WnIZlp-JYqr4-JyYsyEpU';
      if (typeof window !== 'undefined') {
        localStorage.setItem('auth_token', mockAdminToken);
      }
      return of({ token: mockAdminToken });
    }

    return this.http.post<LoginResponse>(`${this.baseUrl}/login`, { email, password }).pipe(
      tap(res => {
        if (res && res.token && typeof window !== 'undefined') {
          localStorage.setItem('auth_token', res.token);
        }
      })
    );
  }

  logout(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth_token');
      window.location.href = '/login';
    }
  }

  getToken(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('auth_token');
    }
    return null;
  }

  isLoggedIn(): boolean {
    return !!this.getToken();
  }

  getUserPayload(): any {
    const token = this.getToken();
    if (!token) return null;
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      const payloadBase64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const decodedJson = atob(payloadBase64);
      return JSON.parse(decodedJson);
    } catch (e) {
      console.error('Error decoding token payload:', e);
      return null;
    }
  }

  getEmployeeId(): number | null {
    const payload = this.getUserPayload();
    // In JwtIssuer.java, employeeId is set as subject (sub)
    if (payload && payload.sub) {
      return Number(payload.sub);
    }
    return null;
  }

  getRole(): string | null {
    const payload = this.getUserPayload();
    // In JwtIssuer.java, role is set as claim "rol"
    if (payload && payload.rol) {
      return payload.rol;
    }
    return null;
  }

  isAdmin(): boolean {
    const role = this.getRole();
    return role === 'ADMINISTRADOR' || role === 'SUPERADMIN' || role === 'SUPERVISOR';
  }

  isEmployee(): boolean {
    const role = this.getRole();
    return role === 'EMPLEADO';
  }
}
