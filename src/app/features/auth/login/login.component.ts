import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  styles: [`
    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap');

    .login-container {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #ffffff;
      font-family: 'Outfit', sans-serif;
      padding: 1.5rem;
      position: relative;
      overflow: hidden;
    }

    /* Ambient background glows (sutiles sobre blanco) */
    .glow-1 {
      position: absolute;
      top: -10%;
      right: -10%;
      width: 40vw;
      height: 40vw;
      background: radial-gradient(circle, rgba(59, 130, 246, 0.06) 0%, transparent 70%);
      pointer-events: none;
    }

    .glow-2 {
      position: absolute;
      bottom: -10%;
      left: -10%;
      width: 40vw;
      height: 40vw;
      background: radial-gradient(circle, rgba(139, 92, 246, 0.06) 0%, transparent 70%);
      pointer-events: none;
    }

    .login-card {
      width: 100%;
      max-width: 420px;
      background: #ffffff;
      border: 1px solid rgba(15, 23, 42, 0.08);
      border-radius: 24px;
      padding: 2.5rem;
      box-shadow: 0 10px 40px -12px rgba(15, 23, 42, 0.12);
      z-index: 10;
      position: relative;
    }

    .brand-section {
      text-align: center;
      margin-bottom: 2rem;
    }

    .brand-logo {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 56px;
      height: 56px;
      background: linear-gradient(135deg, #3b82f6, #8b5cf6);
      border-radius: 16px;
      margin-bottom: 1rem;
      color: #fff;
      font-size: 1.5rem;
      font-weight: 700;
      box-shadow: 0 8px 20px rgba(59, 130, 246, 0.25);
    }

    .brand-title {
      font-size: 1.75rem;
      font-weight: 700;
      color: #0f172a;
      letter-spacing: -0.5px;
      margin: 0;
    }

    .brand-subtitle {
      font-size: 0.875rem;
      color: #64748b;
      margin-top: 0.25rem;
    }

    .form-group {
      margin-bottom: 1.25rem;
      position: relative;
    }

    .form-group label {
      display: block;
      font-size: 0.8125rem;
      font-weight: 500;
      color: #475569;
      margin-bottom: 0.5rem;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .input-wrapper {
      position: relative;
    }

    .form-control {
      width: 100%;
      background: #f8fafc;
      border: 1px solid rgba(15, 23, 42, 0.1);
      border-radius: 12px;
      color: #0f172a;
      font-size: 0.95rem;
      padding: 0.85rem 1rem;
      box-sizing: border-box;
      font-family: inherit;
      transition: all 0.2s ease;
    }

    .form-control:focus {
      outline: none;
      border-color: #3b82f6;
      background: #ffffff;
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.12);
    }

    .btn-submit {
      width: 100%;
      background: linear-gradient(135deg, #3b82f6, #8b5cf6);
      color: #ffffff;
      border: none;
      border-radius: 12px;
      padding: 0.9rem;
      font-size: 0.95rem;
      font-weight: 600;
      cursor: pointer;
      font-family: inherit;
      transition: all 0.25s ease;
      margin-top: 1rem;
      box-shadow: 0 4px 12px rgba(59, 130, 246, 0.2);
    }

    .btn-submit:hover {
      transform: translateY(-1px);
      box-shadow: 0 8px 20px rgba(59, 130, 246, 0.3);
    }

    .btn-submit:active {
      transform: translateY(1px);
    }

    .btn-submit:disabled {
      opacity: 0.65;
      cursor: not-allowed;
      transform: none;
      box-shadow: none;
    }

    .alert-danger {
      background: rgba(239, 68, 68, 0.08);
      border: 1px solid rgba(239, 68, 68, 0.25);
      color: #b91c1c;
      border-radius: 12px;
      padding: 0.75rem 1rem;
      font-size: 0.875rem;
      margin-bottom: 1.5rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    /* Spinner animation */
    .spinner {
      display: inline-block;
      width: 1rem;
      height: 1rem;
      border: 2px solid rgba(255, 255, 255, 0.4);
      border-radius: 50%;
      border-top-color: #fff;
      animation: spin 0.8s linear infinite;
      margin-right: 0.5rem;
      vertical-align: middle;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `],
  template: `
    <div class="login-container">
      <div class="glow-1"></div>
      <div class="glow-2"></div>

      <div class="login-card">
        <div class="brand-section">
          <div class="brand-logo">📊</div>
          <h2 class="brand-title">Control de Depósito</h2>
          <p class="brand-subtitle">Panel de métricas y rendimiento de personal</p>
        </div>

        <div class="alert-danger" *ngIf="errorMessage()">
          ⚠️ {{ errorMessage() }}
        </div>

        <form (ngSubmit)="onSubmit()">
          <div class="form-group">
            <label>Correo Electrónico</label>
            <input
              type="email"
              class="form-control"
              placeholder="nombre.apellido@rrhh.com"
              [(ngModel)]="email"
              name="email"
              required
              autocomplete="email">
          </div>

          <div class="form-group">
            <label>Contraseña</label>
            <input
              type="password"
              class="form-control"
              placeholder="••••••••"
              [(ngModel)]="password"
              name="password"
              required
              autocomplete="current-password">
          </div>

          <button type="submit" class="btn-submit" [disabled]="loading()">
            <span class="spinner" *ngIf="loading()"></span>
            {{ loading() ? 'Iniciando sesión...' : 'Ingresar al Panel' }}
          </button>
        </form>


      </div>
    </div>
  `
})
export class LoginComponent {
  email = '';
  password = '';
  loading = signal<boolean>(false);
  errorMessage = signal<string>('');

  private authService = inject(AuthService);
  private router = inject(Router);
  private http = inject(HttpClient);

  onSubmit(): void {
    if (!this.email || !this.password) {
      this.errorMessage.set('Por favor, ingresa tu correo y contraseña.');
      return;
    }

    this.loading.set(true);
    this.errorMessage.set('');

    this.authService.login(this.email.trim(), this.password).subscribe({
      next: () => {
        this.router.navigate(['/']);
      },
      error: (err) => {
        console.error('Error al iniciar sesión:', err);
        this.loading.set(false);
        if (err.status === 401) {
          this.errorMessage.set('Credenciales inválidas. Por favor, verifica tu correo y contraseña.');
        } else {
          this.errorMessage.set('Error de conexión con el servidor. Intenta nuevamente.');
        }
      }
    });
  }

}
