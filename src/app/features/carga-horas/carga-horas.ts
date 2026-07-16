import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

interface EmpleadoRow {
  id: string | number;
  realId: number;
  name: string;
  puesto: string;
  shift: string;
  workSchedule: string;
  
  // Datos del formulario
  turno: string;
  licencia: boolean;
  tipoLicencia: string;
  horaEntrada: string;
  horaSalida: string;
  horasTrabajadas: number;
  horasExtra: number;
  minutosTardanza: number;
  
  saving: boolean;
  success: boolean;
  error: boolean;
  exists: boolean;
}

@Component({
  selector: 'app-carga-horas',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './carga-horas.html',
  styleUrls: ['./carga-horas.css']
})
export class CargaHoras implements OnInit {
  fecha: string = new Date().toISOString().split('T')[0];
  empleadosRow: EmpleadoRow[] = [];
  loading: boolean = true;
  
  tiposLicencia: string[] = ['Enfermedad', 'Vacaciones', 'Maternidad/Paternidad', 'Estudio', 'Sin Goce de Sueldo'];

  constructor(private apiService: ApiService, private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    console.error("====== APP RECARGADA: CARGA HORAS INICIADO ======");
    this.cargarPlanilla();
  }

  cargarPlanilla() {
    this.loading = true;
    console.error('[CargaHoras] 1. cargarPlanilla iniciada, fecha:', this.fecha);
    
    // Obtener empleados, luego la planilla de la fecha, luego los horarios
    this.apiService.getEmployeeData().subscribe({
      next: (employees) => {
        console.error('[CargaHoras] 2. getEmployeeData respondio con', employees?.length, 'empleados');
        
        forkJoin({
          plantillaHoy: this.apiService.getPlantillaHorasPorFecha(this.fecha).pipe(
            catchError(err => {
              console.error('[CargaHoras] Error en getPlantillaHorasPorFecha:', err);
              return of([]);
            })
          ),
          schedules: this.apiService.getAllWorkSchedules().pipe(
            catchError(err => {
              console.error('[CargaHoras] Error en getAllWorkSchedules:', err);
              return of([]);
            })
          )
        }).subscribe({
          next: ({ plantillaHoy, schedules }) => {
            console.error('[CargaHoras] 3. forkJoin completado. plantillaHoy:', plantillaHoy, 'schedules:', schedules);
            
            try {
              this.empleadosRow = employees.map(emp => {
                let realId: number = typeof emp.id === 'number' ? emp.id : 0;
                if (typeof emp.id === 'string') {
                  if (emp.id.startsWith('EMP-')) {
                    realId = parseInt(emp.id.replace('EMP-', ''), 10);
                  } else {
                    realId = parseInt(emp.id, 10);
                  }
                }
                
                const ph = (Array.isArray(plantillaHoy) ? plantillaHoy : []).find((p: any) => p.empleadoId === realId);
                const ws = (Array.isArray(schedules) ? schedules : []).find((s: any) => s.employeeId === realId);
                
                let horarioStr = '';
                let startStr = '';
                let endStr = '';
                if (ws) {
                  if (ws.startTime) {
                    if (typeof ws.startTime === 'string') {
                      startStr = ws.startTime.substring(0, 5);
                    } else if (Array.isArray(ws.startTime)) {
                      const h = ws.startTime[0].toString().padStart(2, '0');
                      const m = ws.startTime.length > 1 ? ws.startTime[1].toString().padStart(2, '0') : '00';
                      startStr = `${h}:${m}`;
                    }
                  }
                  if (ws.endTime) {
                    if (typeof ws.endTime === 'string') {
                      endStr = ws.endTime.substring(0, 5);
                    } else if (Array.isArray(ws.endTime)) {
                      const h = ws.endTime[0].toString().padStart(2, '0');
                      const m = ws.endTime.length > 1 ? ws.endTime[1].toString().padStart(2, '0') : '00';
                      endStr = `${h}:${m}`;
                    }
                  }
                  if (startStr && endStr) horarioStr = `${startStr} - ${endStr}`;
                }
                
                return {
                  id: emp.id,
                  realId: realId,
                  name: emp.name,
                  puesto: emp.role,
                  shift: emp.shift,
                  workSchedule: horarioStr,
                  
                  turno: ph && ph.turno ? ph.turno : horarioStr,
                  licencia: ph ? ph.licencia : false,
                  tipoLicencia: ph && ph.tipoLicencia ? ph.tipoLicencia : '',
                  horaEntrada: ph && ph.horaEntrada ? ph.horaEntrada : startStr,
                  horaSalida: ph && ph.horaSalida ? ph.horaSalida : endStr,
                  horasTrabajadas: ph ? ph.horasTrabajadas : (horarioStr ? 8 : 0),
                  horasExtra: ph ? ph.horasExtra : 0,
                  minutosTardanza: ph ? ph.minutosTardanza : 0,
                  
                  saving: false,
                  success: false,
                  error: false,
                  exists: !!ph
                };
              });

              // Calcular automáticamente si es una fila nueva sin guardar
              this.empleadosRow.forEach(row => {
                if (!row.exists && !row.licencia) {
                  this.calcularHorasTrabajadas(row);
                }
              });

              console.error('[CargaHoras] 4. map de empleados exitoso, total filas:', this.empleadosRow.length);
            } catch (err) {
              console.error('[CargaHoras] JS Error mapeando empleados:', err);
            }
            setTimeout(() => {
              this.loading = false;
              this.cdr.detectChanges();
            }, 0);
          },
          error: (err) => {
            console.error('[CargaHoras] forkJoin error global:', err);
            setTimeout(() => {
              this.loading = false;
              this.cdr.detectChanges();
            }, 0);
          }
        });
      },
      error: (err) => {
        console.error('[CargaHoras] Error global de getEmployeeData:', err);
        setTimeout(() => {
          this.loading = false;
          this.cdr.detectChanges();
        }, 0);
      }
    });
  }

  onFechaChange() {
    this.cargarPlanilla();
  }

  onLicenciaChange(row: EmpleadoRow) {
    if (row.licencia) {
      row.horasTrabajadas = 0;
      row.horasExtra = 0;
      row.minutosTardanza = 0;
      row.horaEntrada = '';
      row.horaSalida = '';
    } else {
      row.tipoLicencia = '';
      if (row.workSchedule) {
        row.horasTrabajadas = 8;
        const parts = row.workSchedule.split(' - ');
        if (parts.length === 2) {
          row.horaEntrada = parts[0];
          row.horaSalida = parts[1];
        }
      }
    }
  }

  guardarFila(row: EmpleadoRow) {
    row.saving = true;
    row.success = false;
    row.error = false;
    
    const payload = {
      empleadoId: row.realId,
      fecha: this.fecha,
      turno: row.workSchedule || row.shift, // Always save their actual schedule
      licencia: row.licencia,
      tipoLicencia: row.licencia ? row.tipoLicencia : null,
      horaEntrada: row.licencia ? null : row.horaEntrada,
      horaSalida: row.licencia ? null : row.horaSalida,
      horasTrabajadas: row.licencia ? 0 : row.horasTrabajadas,
      horasExtra: row.horasExtra,
      minutosTardanza: row.minutosTardanza
    };
    
    this.apiService.savePlantillaHoras(payload).subscribe({
      next: () => {
        row.saving = false;
        row.success = true;
        row.exists = true;
        this.cdr.detectChanges();
        alert('Datos guardados exitosamente para ' + row.name);
        setTimeout(() => { 
          row.success = false; 
          this.cdr.detectChanges(); 
        }, 3000);
      },
      error: () => {
        row.saving = false;
        row.error = true;
        this.cdr.detectChanges();
        alert('Error al guardar los datos de ' + row.name);
        setTimeout(() => { 
          row.error = false; 
          this.cdr.detectChanges(); 
        }, 3000);
      }
    });
  }

  calcularHorasTrabajadas(row: EmpleadoRow) {
    if (!row.horaEntrada || !row.horaSalida) {
      row.horasTrabajadas = 0;
      row.minutosTardanza = 0;
      return;
    }
    
    // Calcular horas trabajadas
    const [hE, mE] = row.horaEntrada.split(':').map(Number);
    const [hS, mS] = row.horaSalida.split(':').map(Number);
    let diff = (hS + mS / 60) - (hE + mE / 60);
    if (diff < 0) diff += 24; // Pasa la medianoche
    row.horasTrabajadas = parseFloat(diff.toFixed(1));

    // Calcular tardanza
    if (row.workSchedule) {
      const assignedEntrada = row.workSchedule.split(' - ')[0];
      if (assignedEntrada) {
        const [aH, aM] = assignedEntrada.split(':').map(Number);
        const assignedTotal = aH * 60 + aM;
        const actualTotal = hE * 60 + mE;
        let tardanza = actualTotal - assignedTotal;
        row.minutosTardanza = tardanza > 0 ? tardanza : 0;
      }
    } else {
      row.minutosTardanza = 0;
    }
  }
}
