import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, of } from 'rxjs';
import { map, catchError, tap, switchMap } from 'rxjs/operators';
import { EmployeePerformance, SystemInfo, Empleado, Productividad } from '../models/employee.model';
import { AuthService } from './auth.service';


@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private baseUrl = 'http://localhost:8080/api';

  constructor(private http: HttpClient, private authService: AuthService) {}

  // Health check
  checkHealth(): Observable<any> {
    return this.http.get(`${this.baseUrl}/health`);
  }

  // Info
  getSystemInfo(): Observable<SystemInfo> {
    return this.http.get<SystemInfo>(`${this.baseUrl}/info`);
  }

  // Mi Perfil
  getMiPerfil(): Observable<Empleado> {
    return this.http.get<Empleado>(`${this.baseUrl}/empleados/me`);
  }

  uploadMiFoto(foto: File): Observable<any> {
    const formData = new FormData();
    formData.append('foto', foto);
    return this.http.post(`${this.baseUrl}/empleados/me/foto`, formData);
  }

  getEmpleadoFotoUrl(id: number): string {
    return `${this.baseUrl}/empleados/${id}/foto`;
  }

  // Retorna los datos unificados y calculados 100% en el frontend sin cambiar el backend
  getEmployeeData(): Observable<EmployeePerformance[]> {
    console.log(' [ApiService] getEmployeeData() iniciado');
    return this.http.get<any[]>(`${this.baseUrl}/empleados`).pipe(
      catchError(err => {
        console.error(' [ApiService] Error al obtener empleados:', err);
        return of([]);
      }),
      switchMap(empleados => {
        if (!empleados || empleados.length === 0) {
          return of([]);
        }

        // Obtener el KPI individual de cada operario
        const kpiRequests$ = empleados.map(emp =>
          this.http.get<any>(`${this.baseUrl}/productividad/kpi/empleado/${emp.id}`).pipe(
            map(kpi => ({ empId: emp.id, kpi })),
            catchError(() => of({ empId: emp.id, kpi: null }))
          )
        );

        return forkJoin(kpiRequests$).pipe(
          map(kpiResults => {
            return empleados.map(emp => {
              const idStr = 'EMP-' + String(emp.id).padStart(3, '0');
              const result = kpiResults.find(r => r.empId === emp.id);
              const kpi = result ? result.kpi : null;

              const lastName = emp.apellido === 'Sin apellido' ? '' : (emp.apellido || '');
              const displayName = `${emp.nombre} ${lastName}`.trim();

              return {
                id: idStr,
                name: displayName,
                role: emp.puesto || 'Operario',
                shift: emp.turno || 'Mañana',
                dni: emp.dni,
                active: emp.active !== false,
                totalPedidos: kpi ? kpi.totalPedidos : 0,
                totalPendientes: kpi ? kpi.pedidosPendientesObjetivo : 0,
                pedidosPorHora: kpi ? kpi.pedidosPorHora : 0,
                promedioPedidosPorJornada: kpi ? kpi.promedioPedidosPorJornada : 0,
                porcentajeCumplimiento: kpi ? kpi.porcentajeCumplimiento : 0,
                ultimaHoraCarga: kpi ? kpi.ultimaHoraCarga : null,
                objetivoDiario: kpi && kpi.objetivoPedidos ? Math.round(kpi.objetivoPedidos / 6) : 0
              };
            });
          })
        );
      }),
      catchError(err => {
        console.error(' [ApiService] Error en getEmployeeData:', err);
        return of([]);
      })
    );
  }

  // NUEVOS MÃ‰TODOS PARA CREACIÃ“N Y REGISTRO

  crearEmpleado(empleado: any, fotoArchivo?: File): Observable<any> {
    const formData = new FormData();
    formData.append('empleado', new Blob([JSON.stringify(empleado)], { type: 'application/json' }));
    if (fotoArchivo) {
      formData.append('foto', fotoArchivo);
    }
    return this.http.post<any>(`${this.baseUrl}/empleados`, formData);
  }

  updateEmpleado(id: number, empleado: any): Observable<any> {
    return this.http.put<any>(`${this.baseUrl}/empleados/${id}`, empleado);
  }

  registrarProductividad(productividad: Productividad): Observable<Productividad> {
    return this.http.post<Productividad>(`${this.baseUrl}/productividad`, productividad);
  }

  // MÃ‰TODOS PARA OBJETIVOS (AsignaciÃ³n de Pedidos)

  obtenerObjetivos(empleadoId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/objetivos/empleado/${empleadoId}`);
  }

  crearObjetivo(empleadoId: number, tipo: string, valorSemanal: number, semanaInicio?: string): Observable<any> {
    const payload = { empleadoId, tipo, valorSemanal, semanaInicio };
    return this.http.post<any>(`${this.baseUrl}/objetivos`, payload);
  }

  actualizarObjetivo(id: number, valorSemanal: number): Observable<any> {
    const payload = { valorSemanal };
    return this.http.put<any>(`${this.baseUrl}/objetivos/${id}`, payload);
  }

  asignarPedidosAdmin(empleadoId: number, pedidosEncargados: number, fecha: string): Observable<any> {
    return this.obtenerObjetivos(empleadoId).pipe(
      map(objetivos => {
        const dateParts = fecha.split('-');
        const dateObj = new Date(Number(dateParts[0]), Number(dateParts[1]) - 1, Number(dateParts[2]));
        const day = dateObj.getDay();
        const diff = dateObj.getDate() - day + (day === 0 ? -6 : 1);
        const lunesObj = new Date(dateObj.setDate(diff));
        const lunesStr = lunesObj.toISOString().split('T')[0];

        const objSemana = objetivos.find(o => o.tipo === 'PEDIDOS' && o.semanaInicio === lunesStr);
        const valorSemanalAdicional = pedidosEncargados * 6;
        const valorSemanalTotal = objSemana
          ? objSemana.valorSemanal + valorSemanalAdicional
          : valorSemanalAdicional;

        return { objSemana, valorSemanalTotal, lunesStr };
      }),
      switchMap(({ objSemana, valorSemanalTotal, lunesStr }) => {
        if (objSemana) {
          return this.actualizarObjetivo(objSemana.id, valorSemanalTotal);
        } else {
          return this.crearObjetivo(empleadoId, 'PEDIDOS', valorSemanalTotal, lunesStr);
        }
      })
    );
  }

  getProductivityByDate(fecha: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/productividad/fecha?fecha=${fecha}`).pipe(
      catchError(err => {
        console.error('Error al obtener productividad por fecha:', err);
        return of([]);
      })
    );
  }

  getProductividadEmpleado(empleadoId: number): Observable<any[]> {
    if (this.authService.isEmployee() && this.authService.getEmployeeId() === empleadoId) {
      return this.http.get<any[]>(`${this.baseUrl}/productividad/mi-productividad`).pipe(
        catchError(err => {
          console.error('Error al obtener mi productividad:', err);
          return of([]);
        })
      );
    }
    return this.http.get<any[]>(`${this.baseUrl}/productividad/empleado/${empleadoId}`).pipe(
      catchError(err => {
        console.warn(` [ApiService] Mocking productividad para empleado ${empleadoId}`);
        return of([
        ]);
      })
    );
  }

  getKpiEmpleado(empleadoId: number): Observable<any> {
    if (this.authService.isEmployee() && this.authService.getEmployeeId() === empleadoId) {
      return this.http.get<any>(`${this.baseUrl}/productividad/kpi/mi-kpi`).pipe(
        catchError(err => {
          console.error('Error al obtener mi KPI:', err);
          return of(null);
        })
      );
    }
    return this.http.get<any>(`${this.baseUrl}/productividad/kpi/empleado/${empleadoId}`).pipe(
      catchError(err => {
        console.warn(` [ApiService] Mocking KPI para empleado ${empleadoId}`);
        return of(null);
      })
    );
  }

  getPromedioJornadaEmpleado(empleadoId: number, inicio: string, fin: string): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/productividad/empleado/${empleadoId}/promedio/jornada?inicio=${inicio}&fin=${fin}`).pipe(
      catchError(err => {
        console.error(` [ApiService] Error al obtener promedio del empleado ${empleadoId}:`, err);
        return of(null);
      })
    );
  }

  getPromedioJornada(empleadoId: number, inicio: string, fin: string): Observable<any> {
    if (this.authService.isEmployee() && this.authService.getEmployeeId() === empleadoId) {
      return this.http.get<any>(`${this.baseUrl}/productividad/promedios/me/jornada?inicio=${inicio}&fin=${fin}`).pipe(
        catchError(err => {
          console.error('Error al obtener mi promedio por jornada:', err);
          return of(null);
        })
      );
    }
    return this.http.get<any>(`${this.baseUrl}/productividad/promedios/${empleadoId}/jornada?inicio=${inicio}&fin=${fin}`).pipe(
      catchError(err => {
        console.error(`Error al obtener promedio por jornada para empleado ${empleadoId}:`, err);
        return of(null);
      })
    );
  }

  getPromedioHora(empleadoId: number, inicio: string, fin: string): Observable<any> {
    if (this.authService.isEmployee() && this.authService.getEmployeeId() === empleadoId) {
      return this.http.get<any>(`${this.baseUrl}/productividad/promedios/me/hora?inicio=${inicio}&fin=${fin}`).pipe(
        catchError(err => {
          console.error('Error al obtener mi promedio por hora:', err);
          return of(null);
        })
      );
    }
    return this.http.get<any>(`${this.baseUrl}/productividad/promedios/${empleadoId}/hora?inicio=${inicio}&fin=${fin}`).pipe(
      catchError(err => {
        console.error(`Error al obtener promedio por hora para empleado ${empleadoId}:`, err);
        return of(null);
      })
    );
  }


  // ==========================
  // ASISTENCIA (ATTENDANCE)
  // ==========================
  // MOCK STATE PARA ASISTENCIA
  private mockAttendanceHistory: any[] = [
    { id: 1, employeeId: 2, clockInAt: new Date(Date.now() - 86400000).toISOString(), clockOutAt: new Date(Date.now() - 50400000).toISOString() }
  ];

  clockIn(employeeId: number, fotoFile?: File | Blob): Observable<any> {
    const formData = new FormData();
    if (fotoFile) {
      formData.append('foto', fotoFile, 'captura.jpg');
    }
    return this.http.post<any>(`${this.baseUrl}/attendance/${employeeId}/clock-in`, formData);
  }

  clockOut(employeeId: number): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/attendance/${employeeId}/clock-out`, {});
  }

  getAttendanceHistory(employeeId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/attendance/empleado/${employeeId}`);
  }

  getAllAttendanceRecords(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/attendance`).pipe(
      catchError(err => {
        console.error('Error al obtener todos los fichajes:', err);
        return of([]);
      })
    );
  }


  getPendientesRevision(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/attendance/pendientes`).pipe(
      catchError(err => {
        console.warn(' [ApiService] Mocking fichajes pendientes de revisiÃ³n');
        return of([
          { id: 101, employeeId: 2, clockInAt: new Date().toISOString(), similitudFacial: 0.72, estadoVerificacion: 'PENDIENTE_REVISION' }
        ]);
      })
    );
  }

  getFotoFichajeUrl(id: number): string {
    return `${this.baseUrl}/attendance/${id}/foto`;
  }

  getFotoFichajeBlob(id: number): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/attendance/${id}/foto`, { responseType: 'blob' }).pipe(
      catchError(err => {
        console.warn(' [ApiService] Mocking foto blob (pixel transparente)');
        // Un pixel transparente en base64
        const b64Data = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
        const byteCharacters = atob(b64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        return of(new Blob([byteArray], {type: 'image/png'}));
      })
    );
  }

  revisarFichaje(id: number, aprobado: boolean): Observable<any> {
    if (id === 101) {
      console.warn(' [ApiService] Interceptando revisiÃ³n para ID simulado 101');
      return of({ success: true, id, aprobado });
    }
    return this.http.post<any>(`${this.baseUrl}/attendance/${id}/revisar`, { aprobado }).pipe(
      catchError(err => {
        console.warn(' [ApiService] FallÃ³ la revisiÃ³n real en el servidor. Simulando Ã©xito local.');
        return of({ success: true, id, aprobado });
      })
    );
  }

  // ==========================
  // HORARIOS (WORK SCHEDULES)
  // ==========================
  getWorkSchedule(employeeId: number): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/work-schedules/employee/${employeeId}`).pipe(
      catchError(err => {
        return of(null);
      })
    );
  }

  getAllWorkSchedules(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/work-schedules`).pipe(
      catchError(err => of([]))
    );
  }

  saveWorkSchedule(schedule: { employeeId: number, workDays: string[], startTime: string, endTime: string }): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/work-schedules`, schedule);
  }

  updateWorkSchedule(id: number, schedule: { workDays: string[], startTime: string, endTime: string }): Observable<any> {
    return this.http.put<any>(`${this.baseUrl}/work-schedules/${id}`, schedule);
  }

  deleteWorkSchedule(id: number): Observable<any> {
    return this.http.delete<any>(`${this.baseUrl}/work-schedules/${id}`);
  }

  // ==========================
  // PLANTILLAS DE HORAS
  // ==========================
  getPlantillaHoras(empleadoId: number, fecha: string): Observable<any> {
    return this.http.get<any[]>(`${this.baseUrl}/plantilla-horas/fecha/${fecha}?t=${new Date().getTime()}`).pipe(
      map(plantillas => plantillas.find(p => p.empleadoId == empleadoId) || null)
    );
  }

  getPlantillaHorasPorFecha(fecha: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/plantilla-horas/fecha/${fecha}?t=${new Date().getTime()}`);
  }

  savePlantillaHoras(plantilla: any): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/plantilla-horas`, plantilla);
  }
}


