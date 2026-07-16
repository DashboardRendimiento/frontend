import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../../../core/services/api.service';
import { Empleado } from '../../../../core/models/employee.model';

@Component({
  selector: 'app-perfil',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './perfil.component.html',
  styleUrls: ['./perfil.component.scss']
})
export class PerfilComponent implements OnInit {
  perfil: Empleado | null = null;
  plantillaHoras: any = null;
  workSchedule: any = null;
  loading: boolean = true;
  error: string | null = null;

  constructor(
    private apiService: ApiService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.cargarPerfil();
  }

  cargarPerfil(): void {
    this.loading = true;
    this.error = null;
    this.apiService.getMiPerfil().subscribe({
      next: (data) => {
        this.perfil = data;
        if (this.perfil && this.perfil.id) {
          // Fetch both independently, ignoring errors so it always completes
          import('rxjs').then(({ forkJoin, of }) => {
            import('rxjs/operators').then(({ catchError }) => {
              forkJoin({
                ph: this.apiService.getPlantillaHoras(this.perfil!.id!, new Date().toISOString().split('T')[0]).pipe(catchError(() => of(null))),
                ws: this.apiService.getWorkSchedule(this.perfil!.id!).pipe(catchError(() => of(null)))
              }).subscribe({
                next: (results) => {
                  this.plantillaHoras = results.ph;
                  this.workSchedule = results.ws;
                  this.loading = false;
                  this.cdr.detectChanges();
                }
              });
            });
          });
        } else {
          this.loading = false;
          this.cdr.detectChanges();
        }
      },
      error: (err) => {
        console.error('Error cargando perfil', err);
        this.error = 'No se pudo cargar la información del perfil.';
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }


  get inicial(): string {
    if (!this.perfil) return '?';
    const first = this.perfil.nombre ? this.perfil.nombre.charAt(0) : '';
    const last = this.perfil.apellido && this.perfil.apellido !== 'Sin apellido' ? this.perfil.apellido.charAt(0) : '';
    return (first + last).toUpperCase();
  }

  getFotoUrl(): string | null {
    if (this.perfil && this.perfil.id) {
      // Return a unique URL to avoid caching
      return this.apiService.getEmpleadoFotoUrl(this.perfil.id) + '?t=' + new Date().getTime();
    }
    return null;
  }

  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      this.loading = true;
      this.apiService.uploadMiFoto(file).subscribe({
        next: () => {
          this.cargarPerfil(); // Reload to get updated photo
        },
        error: (err) => {
          console.error('Error uploading photo', err);
          this.error = 'No se pudo subir la foto.';
          this.loading = false;
          this.cdr.detectChanges();
        }
      });
    }
  }
}
