import { Component, OnInit, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { Router } from '@angular/router';
import { EmployeePerformance } from '../../core/models/employee.model';
import { EmployeeTableComponent } from './employee-table/employee-table.component';
import { EmployeeDetailComponent } from './components/employee-detail/employee-detail.component';
import { PerfilComponent } from './components/perfil/perfil.component';
import { CargaHoras } from '../carga-horas/carga-horas';
import { NgApexchartsModule } from 'ng-apexcharts';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, EmployeeTableComponent, EmployeeDetailComponent, PerfilComponent, NgApexchartsModule, FormsModule, CargaHoras],
  templateUrl: './dashboard.component.html'
})
export class DashboardComponent implements OnInit {
  employees: EmployeePerformance[] = [];
  loading: boolean = true;

  // Variable de control para saber si vemos la lista o el detalle individual
  empleadoSeleccionado: EmployeePerformance | null = null;

  // Propiedades de bÃƒÆ’Ã‚Âºsqueda y filtrado de tabla
  filtroBusqueda: string = '';
  filteredEmployees: EmployeePerformance[] = [];

  // Propiedades de grÃƒÆ’Ã‚Â¡ficos globales
  public barChartOptions: any;
  public donutChartOptions: any;
  statsCards: any[] = [];
  productividadDiaria: any[] = [];
  tendenciaMensual: any[] = [];
  alertas: any[] = [];
  topPerformers: any[] = [];
  empleadosActivos = 0;
  productividadHistorica: any[] = [];

  // Variables para RevisiÃƒÆ’Ã‚Â³n Facial (Admin/Supervisor)
  fichajesPendientes: any[] = [];
  salidasAnticipadasDeHoy: any[] = [];
  mostrarModalRevision = false;
  fichajeSeleccionado: any = null;
  fotoFichajeRawUrl: string | null = null;
  fotoFichajeUrl: SafeUrl | null = null;
  revisando = false;
  isAdminUser = false;

  // Reporte HistÃƒÆ’Ã‚Â³rico de Salidas Anticipadas (Admin/Supervisor)
  mostrarReporteSalidas = false;
  reporteSalidasHistorico: any[] = [];
  reporteSalidasFiltrado: any[] = [];
  busquedaReporte = '';
  fechaInicioReporte = '';
  fechaFinReporte = '';

  // NavegaciÃƒÆ’Ã‚Â³n Sidebar
  seccionActiva = 'resumen';
  objetivosIncumplidosHoy: any[] = [];

  // Alerta y ConfirmaciÃƒÆ’Ã‚Â³n Personalizada
  customAlert = {
    mostrar: false,
    titulo: '',
    mensaje: '',
    tipo: 'info' as 'success' | 'error' | 'warning' | 'info',
    callback: null as (() => void) | null
  };

  // Variables para Crear Empleado (SuperAdmin)
  mostrarModalCrearEmpleado = false;
  creandoEmpleado = false;
  fotoSeleccionada: File | null = null;
  nuevoEmpleado = {
    nombre: '',
    apellido: '',
    dni: null as number | null,
    email: '',
    passwordHash: '',
    role: 'EMPLEADO',
    puesto: '',
    sector: '',
    turno: 'MaÃƒÆ’Ã‚Â±ana',
    active: true
  };

  // InformaciÃƒÆ’Ã‚Â³n del usuario logueado
  usuarioActual: { name: string; role: string; isAdmin: boolean } | null = null;
  miPropioEmpleado: EmployeePerformance | null = null;

  private apiService = inject(ApiService);
  private authService = inject(AuthService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  private sanitizer = inject(DomSanitizer);

  ngOnInit(): void {
    this.isAdminUser = this.authService.isAdmin();
    const roleStr = this.authService.getRole() || 'EMPLEADO';
    const employeeId = this.authService.getEmployeeId();

    this.usuarioActual = {
      name: '',
      role: roleStr,
      isAdmin: this.authService.isAdmin()
    };

    if (roleStr === 'SUPERADMIN') {
      this.seccionActiva = 'tabla';
    }

    if (this.isAdminUser) {
      this.cargarFichajesPendientes();
    }

    if (!this.usuarioActual.isAdmin) {
      // Es un Empleado o Supervisor: Cargar datos para verificar puesto
      this.loading = true;
      this.apiService.getEmployeeData().subscribe({
        next: (data) => {
          // Ordenar data descendentemente por ultimaHoraCarga
          data.sort((a, b) => {
            if (!a.ultimaHoraCarga && !b.ultimaHoraCarga) return 0;
            if (!a.ultimaHoraCarga) return 1;
            if (!b.ultimaHoraCarga) return -1;
            return new Date(b.ultimaHoraCarga).getTime() - new Date(a.ultimaHoraCarga).getTime();
          });
          this.employees = data;

          // Siempre buscamos si el usuario logueado tiene un perfil de empleado asociado
          const found = data.find(e => e.id === `EMP-${String(employeeId).padStart(3, '0')}`);
          if (found) {
            this.miPropioEmpleado = found;
          }

          if (this.authService.isEmployee()) {
            if (!found) {
              console.warn('No se encontraron los datos unificados. Se usarÃƒÆ’Ã‚Â¡ modo limitado.');
              this.usuarioActual!.role = 'EMPLEADO';
            } else if (found.puesto === 'SUPERVISOR') {
              this.usuarioActual!.role = 'SUPERVISOR';
              this.filtrarEmpleados();
              this.initCharts();
            } else {
              this.usuarioActual!.role = 'EMPLEADO';
              this.empleadoSeleccionado = found; // Forzar vista detalle
            }
          } else {
            // Es Administrador, SuperAdmin o Supervisor (desde el backend)
            if (this.usuarioActual?.role === 'SUPERVISOR') {
              this.filtrarEmpleados();
              this.initCharts();
            }
            // Vista por defecto:
            if (this.usuarioActual?.role === 'SUPERADMIN') {
              this.seccionActiva = 'tabla';
            } else {
              this.seccionActiva = 'resumen';
            }

            // Ya no forzamos empleadoSeleccionado al primero de la lista
            // Dejamos que el usuario decida a quien ver.
          }
          this.loading = false;
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Error al cargar datos del empleado (Dashboard):', err);
          this.loading = false;
        }
      });
    } else {
      // Es Administrador o Supervisor: Cargar la vista global normal
      if (roleStr === 'SUPERVISOR') {
        this.usuarioActual.name = 'Supervisor de Planta';
      } else {
        this.usuarioActual.name = 'Administrador de RRHH';
      }
      this.cargarDatos();
    }
  }

  cargarDatos(): void {
    this.loading = true;
    this.apiService.getEmployeeData().subscribe({
        next: (data) => {
          data.sort((a, b) => {
            if (!a.ultimaHoraCarga && !b.ultimaHoraCarga) return 0;
            if (!a.ultimaHoraCarga) return 1;
            if (!b.ultimaHoraCarga) return -1;
            return new Date(b.ultimaHoraCarga).getTime() - new Date(a.ultimaHoraCarga).getTime();
          });
          this.employees = data;
          this.filteredEmployees = data;
        this.loading = false;
        this.filtrarEmpleados();
        this.initCharts();
        this.cargarSalidasAnticipadas();
        this.cargarObjetivosIncumplidos();
        this.cargarReporteSalidasHistorico();
        this.cdr.detectChanges(); // Forzar detecciÃƒÆ’Ã‚Â³n de cambios para ocultar pantalla de carga
      },
      error: (err) => {
        console.error('Error al cargar la informaciÃƒÆ’Ã‚Â³n', err);
        this.loading = false;
        this.cdr.detectChanges(); // Forzar detecciÃƒÆ’Ã‚Â³n de cambios ante errores
      }
    });
  }

  // ============================================
  // REVISIÃƒÆ’Ã¢â‚¬Å“N FACIAL (ADMIN/SUPERVISOR)
  // ============================================

  cargarFichajesPendientes(): void {
    this.apiService.getPendientesRevision().subscribe({
      next: (data) => {
        const pendingList = data || [];
        this.fichajesPendientes = pendingList.map(record => {
          const empIdStr = 'EMP-' + String(record.employeeId).padStart(3, '0');
          const emp = this.employees.find(e => e.id === empIdStr);
          return {
            ...record,
            employeeName: emp ? emp.name : `Empleado #${record.employeeId}`,
            employeeDni: emp ? emp.dni : 'N/A'
          };
        });
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error al cargar fichajes pendientes de revisiÃƒÆ’Ã‚Â³n:', err);
      }
    });
  }

  getLocalStartDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  cargarSalidasAnticipadas(): void {
    if (!this.isAdminUser) return;
    this.apiService.getAllAttendanceRecords().subscribe({
      next: (records) => {
        const hoyStr = this.getLocalStartDate(new Date());

        // 1. Filtrar todos los registros de hoy que son salidas anticipadas
        const salidasAnticipadas = records.filter(r => {
          if (!r.clockOutAt) return false;
          const fechaClockOut = this.getLocalStartDate(new Date(r.clockOutAt));
          if (fechaClockOut !== hoyStr) return false;
          return this.esSalidaAnticipada(r);
        });

        // 2. Agrupar por empleado y tomar solo la ÃƒÆ’Ã‚Âºltima salida anticipada de hoy
        const ultimasSalidasAnticipadasPorEmpleado: Record<number, any> = {};
        salidasAnticipadas.forEach(sa => {
          const empId = sa.employeeId;
          const currentUltimo = ultimasSalidasAnticipadasPorEmpleado[empId];
          if (!currentUltimo || new Date(sa.clockOutAt) > new Date(currentUltimo.clockOutAt)) {
            ultimasSalidasAnticipadasPorEmpleado[empId] = sa;
          }
        });

        // 3. Para cada ÃƒÆ’Ã‚Âºltima salida anticipada, verificar si hay un fichaje posterior aceptado
        this.salidasAnticipadasDeHoy = Object.values(ultimasSalidasAnticipadasPorEmpleado).filter(sa => {
          const empId = sa.employeeId;
          const horaSa = new Date(sa.clockInAt); // Usamos clockInAt del fichaje anterior como referencia de tiempo

          const tieneFichajePosteriorAceptado = records.some(r => {
            if (r.employeeId !== empId) return false;
            if (r.id === sa.id) return false;

            const horaR = new Date(r.clockInAt);
            if (horaR <= horaSa) return false;

            const fechaR = this.getLocalStartDate(horaR);
            if (fechaR !== hoyStr) return false;

            const estaActivo = !r.clockOutAt;
            const finalizoBien = r.clockOutAt && !this.esSalidaAnticipada(r);
            const estaAceptado = r.estadoVerificacion === 'VERIFICADO_AUTOMATICO' || r.estadoVerificacion === 'VERIFICADO_MANUAL';

            return (estaActivo || finalizoBien) && estaAceptado;
          });

          return !tieneFichajePosteriorAceptado;
        }).map(r => {
          const empIdStr = 'EMP-' + String(r.employeeId).padStart(3, '0');
          const emp = this.employees.find(e => e.id === empIdStr);
          return {
            ...r,
            employeeName: emp ? emp.name : `Empleado #${r.employeeId}`,
            employeeDni: emp ? emp.dni : 'N/A'
          };
        });

        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error al cargar salidas anticipadas:', err);
      }
    });
  }

  abrirReporteSalidasAnticipadas(): void {
    this.mostrarReporteSalidas = true;
    this.busquedaReporte = '';

    const hoy = new Date();
    this.fechaFinReporte = this.getLocalStartDate(hoy);
    const hace30Dias = new Date();
    hace30Dias.setDate(hoy.getDate() - 30);
    this.fechaInicioReporte = this.getLocalStartDate(hace30Dias);

    this.apiService.getAllAttendanceRecords().subscribe({
      next: (records) => {
        const globalRecords = records || [];
        this.reporteSalidasHistorico = globalRecords.filter(r => {
          if (!r.clockOutAt) return false;
          return this.esSalidaAnticipada(r);
        }).map(r => {
          const empIdStr = 'EMP-' + String(r.employeeId).padStart(3, '0');
          const emp = this.employees.find(e => e.id === empIdStr);

          let horaFinStr = '14:00';
          if (emp) {
            const shiftStr = emp.shift || 'MaÃƒÆ’Ã‚Â±ana';
            if (shiftStr.toLowerCase().includes('tarde')) {
              horaFinStr = '22:00';
            } else if (shiftStr.toLowerCase().includes('noche')) {
              horaFinStr = '06:00';
            }
          }

          return {
            ...r,
            employeeName: emp ? emp.name : `Empleado #${r.employeeId}`,
            employeeDni: emp ? emp.dni : 'N/A',
            horaFinProgramada: horaFinStr
          };
        }).sort((a, b) => new Date(b.clockOutAt).getTime() - new Date(a.clockOutAt).getTime());

        this.filtrarReporteSalidas();
      },
      error: (err) => {
        console.error('Error al cargar reporte de salidas:', err);
      }
    });
  }

  cerrarReporteSalidasAnticipadas(): void {
    this.mostrarReporteSalidas = false;
  }

  filtrarReporteSalidas(): void {
    const query = this.busquedaReporte.toLowerCase().trim();
    const start = this.fechaInicioReporte || '0000-00-00';
    const end = this.fechaFinReporte || '9999-99-99';

    this.reporteSalidasFiltrado = this.reporteSalidasHistorico.filter(r => {
      const matchSearch = r.employeeName.toLowerCase().includes(query) || r.employeeDni.includes(query);

      const fechaStr = this.getLocalStartDate(new Date(r.clockOutAt));
      const matchDate = fechaStr >= start && fechaStr <= end;

      return matchSearch && matchDate;
    });
    this.cdr.detectChanges();
  }

  abrirModalRevision(): void {
    // Asegurar que los fichajes pendientes estÃƒÆ’Ã‚Â©n enriquecidos antes de abrir
    this.cargarFichajesPendientes();
    this.mostrarModalRevision = true;
    this.fichajeSeleccionado = null;
    this.limpiarFotoUrl();
    setTimeout(() => {
      if (this.fichajesPendientes.length > 0) {
        this.seleccionarFichaje(this.fichajesPendientes[0]);
      }
    }, 200);
  }

  cerrarModalRevision(): void {
    this.mostrarModalRevision = false;
    this.fichajeSeleccionado = null;
    this.limpiarFotoUrl();
  }

  seleccionarFichaje(fichaje: any): void {
    this.fichajeSeleccionado = fichaje;
    this.limpiarFotoUrl();

    this.apiService.getFotoFichajeBlob(fichaje.id).subscribe({
      next: (blob) => {
        this.fotoFichajeRawUrl = URL.createObjectURL(blob);
        this.fotoFichajeUrl = this.sanitizer.bypassSecurityTrustUrl(this.fotoFichajeRawUrl);
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error al obtener la foto del fichaje:', err);
      }
    });
  }

  esSalidaAnticipada(record: any): boolean {
    if (!record || !record.clockOutAt) return false;

    const empIdStr = 'EMP-' + String(record.employeeId).padStart(3, '0');
    const emp = this.employees.find(e => e.id === empIdStr);
    if (!emp) return false;

    const shiftStr = emp.shift || 'MaÃƒÆ’Ã‚Â±ana';
    let endHour = 14;
    let endMin = 0;
    if (shiftStr.toLowerCase().includes('tarde')) {
      endHour = 22;
    } else if (shiftStr.toLowerCase().includes('noche')) {
      endHour = 6;
    }

    const clockOutDate = new Date(record.clockOutAt);
    const outHour = clockOutDate.getHours();
    const outMin = clockOutDate.getMinutes();

    if (shiftStr.toLowerCase().includes('noche')) {
      const outTotalMinutes = outHour * 60 + outMin;
      const scheduledTotalMinutes = 6 * 60;
      return outTotalMinutes < scheduledTotalMinutes;
    } else {
      const outTotalMinutes = outHour * 60 + outMin;
      const scheduledTotalMinutes = endHour * 60 + endMin;
      return outTotalMinutes < scheduledTotalMinutes;
    }
  }

  limpiarFotoUrl(): void {
    if (this.fotoFichajeRawUrl) {
      URL.revokeObjectURL(this.fotoFichajeRawUrl);
      this.fotoFichajeRawUrl = null;
    }
    this.fotoFichajeUrl = null;
  }

  procesarFichaje(aprobado: boolean): void {
    console.log("procesarFichaje click!", aprobado, this.fichajeSeleccionado);
    if (this.revisando) return;
    if (!this.fichajeSeleccionado) {
      this.mostrarAlerta("AtenciÃƒÆ’Ã‚Â³n", "No hay ningÃƒÆ’Ã‚Âºn fichaje seleccionado para procesar.", "warning");
      return;
    }

    this.revisando = true;
    const id = this.fichajeSeleccionado.id;
    console.log("Enviando revisiÃƒÆ’Ã‚Â³n a API para id:", id);
    this.apiService.revisarFichaje(id, aprobado).subscribe({
      next: (res) => {
        console.log("RevisiÃƒÆ’Ã‚Â³n completada con ÃƒÆ’Ã‚Â©xito en API:", res);
        this.revisando = false;

        // Quitar de la lista local de inmediato
        this.fichajesPendientes = this.fichajesPendientes.filter(f => f.id !== id);

        // Seleccionar el siguiente o cerrar
        if (this.fichajesPendientes.length > 0) {
          this.seleccionarFichaje(this.fichajesPendientes[0]);
        } else {
          this.cerrarModalRevision();
        }
        this.cargarDatos(); // Recargar datos del dashboard por si cambiÃƒÆ’Ã‚Â³ la asistencia
      },
      error: (err) => {
        console.error('Error al procesar la revisiÃƒÆ’Ã‚Â³n de fichaje:', err);
        const errorMsg = err.error?.message || err.message || 'Error desconocido';
        this.mostrarAlerta("Error al procesar", "No se pudo procesar la decisiÃƒÆ’Ã‚Â³n: " + errorMsg, "error");
        this.revisando = false;
      }
    });
  }

  // ============================================
  // CREACIÃƒÆ’Ã¢â‚¬Å“N DE EMPLEADOS (SUPERADMIN)
  // ============================================

  abrirModalCrearEmpleado(): void {
    console.log('Abriendo modal crear empleado...');
    this.mostrarModalCrearEmpleado = true;
    this.nuevoEmpleado = {
      nombre: '',
      apellido: '',
      dni: null,
      email: '',
      passwordHash: '',
      role: 'EMPLEADO',
      puesto: '',
      sector: '',
      turno: 'MaÃƒÆ’Ã‚Â±ana',
      active: true
    };
    this.fotoSeleccionada = null;
    this.cdr.detectChanges();
  }

  cerrarModalCrearEmpleado(): void {
    this.mostrarModalCrearEmpleado = false;
    this.cdr.detectChanges();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.fotoSeleccionada = input.files[0];
    } else {
      this.fotoSeleccionada = null;
    }
  }

  guardarNuevoEmpleado(): void {
    if (!this.nuevoEmpleado.nombre || !this.nuevoEmpleado.email || !this.nuevoEmpleado.passwordHash) {
      alert('Por favor completa los campos obligatorios (Nombre, Email, ContraseÃƒÆ’Ã‚Â±a).');
      return;
    }

    this.creandoEmpleado = true;
    this.apiService.crearEmpleado(this.nuevoEmpleado as any, this.fotoSeleccionada || undefined).subscribe({
      next: () => {
        this.creandoEmpleado = false;
        this.cerrarModalCrearEmpleado();
        alert('Ãƒâ€šÃ‚Â¡Empleado creado exitosamente!');
        this.cargarDatos(); // Refrescar la tabla
      },
      error: (err) => {
        this.creandoEmpleado = false;
        console.error('Error al crear empleado:', err);
        alert('Error al crear el empleado. Verifica los datos o el correo (podrÃƒÆ’Ã‚Â­a estar duplicado).');
      }
    });
  }

  filtrarEmpleados(): void {
    if (!this.filtroBusqueda) {
      this.filteredEmployees = this.employees;
      return;
    }
    const query = this.filtroBusqueda.toLowerCase().trim();
    this.filteredEmployees = this.employees.filter(emp =>
      (emp.id && emp.id.toLowerCase().includes(query)) ||
      (emp.name && emp.name.toLowerCase().includes(query)) ||
      (emp.role && emp.role.toLowerCase().includes(query)) ||
      (emp.shift && emp.shift.toLowerCase().includes(query))
    );
  }

  initCharts(): void {
    // 1. GrÃƒÆ’Ã‚Â¡fico de Barras: ComparaciÃƒÆ’Ã‚Â³n de Bultos
    let names = this.employees.map(emp => emp.name);
    let units = this.employees.map(emp => emp.totalPedidos || 0);

    if(units.length === 0) units = [0]; if(names.length === 0) names = [""]; this.barChartOptions = {
      series: [
        {
          name: "Pedidos Preparados",
          data: units
        }
      ],
      chart: {
        type: "bar",
        height: 320,
        toolbar: { show: false }
      },
      colors: ["#2563eb"],
      plotOptions: {
        bar: {
          horizontal: false,
          columnWidth: "45%",
          borderRadius: 4
        }
      },
      dataLabels: { enabled: false },
      xaxis: {
        categories: names,
        labels: {
          style: { fontSize: "12px", colors: "#64748b" }
        }
      },
      yaxis: {
        title: { text: "Pedidos" },
        labels: {
          style: { colors: "#64748b" }
        }
      },
      grid: {
        borderColor: "#f1f5f9"
      }
    };

    // 2. GrÃ¡fico de Torta / Donut: DistribuciÃ³n por Turno
    const turnosCount: { [key: string]: number } = { 'manana': 0, 'tarde': 0, 'noche': 0 };
    this.employees.forEach(emp => {
      const shiftStr = emp.shift ? emp.shift.toLowerCase() : '';
      if (shiftStr.includes('tarde')) {
        turnosCount['tarde']++;
      } else if (shiftStr.includes('noche')) {
        turnosCount['noche']++;
      } else {
        turnosCount['manana']++;
      }
    });

    this.donutChartOptions = {
      series: [turnosCount['manana'], turnosCount['tarde'], turnosCount['noche']],
      chart: {
        type: "donut",
        height: 320
      },
      labels: ["Turno MaÃ±ana", "Turno Tarde", "Turno Noche"],
      colors: ["#3b82f6", "#8b5cf6", "#f59e0b"],
      legend: {
        position: "bottom",
        labels: { colors: "#64748b" }
      },
      dataLabels: { enabled: true },
      responsive: [
        {
          breakpoint: 480,
          options: {
            chart: { width: 200 },
            legend: { position: "bottom" }
          }
        }
      ]
    };
  }

  // Captura el clic desde la tabla para "cambiar de ventana"
  cambiarAVistaDetalle(emp: EmployeePerformance | null): void {
    this.empleadoSeleccionado = emp;
    if (emp === null) {
      this.cargarDatos(); // Recargar datos al volver al grid
    }
  }

  getTotalPedidos(): number {
    return this.employees.reduce((acc, emp) => acc + (emp.totalPedidos || 0), 0);
  }

  gettotalPedidos(): number {
    return this.employees.reduce((acc, emp) => acc + (emp.totalPedidos || 0), 0);
  }

  getTotalPendientes(): number {
    return this.employees.reduce((acc, emp) => acc + (emp.totalPendientes || 0), 0);
  }

  getMejorDesempeno(): { nombre: string; pedidos: number } | null {
    if (this.employees.length === 0) return null;
    let best = this.employees[0];
    for (const emp of this.employees) {
      if ((emp.totalPedidos || 0) > (best.totalPedidos || 0)) {
        best = emp;
      }
    }
    return {
      nombre: best.name,
      pedidos: best.totalPedidos || 0
    };
  }

  mostrarAlerta(titulo: string, mensaje: string, tipo: 'success' | 'error' | 'warning' | 'info' = 'info', callback?: () => void): void {
    this.customAlert = {
      mostrar: true,
      titulo,
      mensaje,
      tipo,
      callback: callback || null
    };
    this.cdr.detectChanges();
  }

  cerrarAlerta(): void {
    const cb = this.customAlert.callback;
    this.customAlert.mostrar = false;
    this.cdr.detectChanges();
    if (cb) cb();
  }

  cerrarSesion(): void {
    this.authService.logout();
  }

  cambiarSeccion(seccion: string): void {
    this.seccionActiva = seccion;
    this.empleadoSeleccionado = null; // Volver al panel general
    this.cdr.detectChanges();
  }

  verMiResumen(): void {
    if (this.miPropioEmpleado) {
      this.empleadoSeleccionado = this.miPropioEmpleado;
      this.seccionActiva = 'resumen';
      this.cdr.detectChanges();
    }
  }

  getTituloHeader(): string {
    if (this.empleadoSeleccionado) {
      return `Reporte Individual: ${this.empleadoSeleccionado.name}`;
    }
    switch (this.seccionActiva) {
      case 'resumen':
        return 'Panel General: Resumen y Graficos';
      case 'tabla':
        return 'Tabla de Personal y Asignación';
      case 'pendientes':
        return 'Control de Fichajes Pendientes de Validación';
      case 'salidas':
        return 'Registro Histórico de Salidas Anticipadas';
      case 'incumplidos':
        return 'Control de Objetivos Incumplidos Hoy';
      case 'perfil':
        return 'Mi Perfil';
      default:
        return 'Panel Noble RRHH';
    }
  }

  cargarObjetivosIncumplidos(): void {
    if (!this.isAdminUser) return;

    // 1. Obtener todos los fichajes
    this.apiService.getAllAttendanceRecords().subscribe({
      next: (attendanceRecords) => {
        const hoyStr = this.getLocalStartDate(new Date());

        // Filtrar los que ficharon salida hoy (es decir, completaron su jornada o salieron hoy)
        const salidasHoy = attendanceRecords.filter(r => {
          if (!r.clockOutAt) return false;
          const fechaOut = this.getLocalStartDate(new Date(r.clockOutAt));
          return fechaOut === hoyStr;
        });

        // 2. Obtener productividad registrada hoy
        this.apiService.getProductivityByDate(hoyStr).subscribe({
          next: (prodRecords) => {
            const incumplidos: any[] = [];

            // Agrupar fichajes por empleado para saber quiÃƒÆ’Ã‚Â©n saliÃƒÆ’Ã‚Â³ hoy
            const empleadosSalidos = new Set<number>();
            salidasHoy.forEach(s => empleadosSalidos.add(s.employeeId));

            // Para cada empleado que saliÃƒÆ’Ã‚Â³ hoy, verificar su productividad contra su objetivo
            this.employees.forEach(emp => {
              const numericId = parseInt(emp.id.replace('EMP-', ''), 10);
              if (empleadosSalidos.has(numericId)) {
                // Sumar pedidos preparados por este empleado hoy
                const prodEmp = prodRecords.filter(p => p.empleado && p.empleado.id === numericId);
                const preparadosHoy = prodEmp.reduce((sum, p) => sum + (p.pedidosPreparados || 0), 0);
                const objetivo = emp.objetivoDiario || 0;

                if (objetivo > 0 && preparadosHoy < objetivo) {
                  incumplidos.push({
                    employeeId: emp.id,
                    employeeName: emp.name,
                    employeeDni: emp.dni,
                    objetivo: objetivo,
                    preparados: preparadosHoy,
                    faltantes: objetivo - preparadosHoy
                  });
                }
              }
            });

            this.objetivosIncumplidosHoy = incumplidos;
            this.cdr.detectChanges();
          },
          error: (err) => {
            console.error('Error al cargar productividad para objetivos incumplidos:', err);
          }
        });
      },
      error: (err) => {
        console.error('Error al cargar asistencia para objetivos incumplidos:', err);
      }
    });
  }

  cargarReporteSalidasHistorico(): void {
    if (!this.isAdminUser) return;
    this.apiService.getAllAttendanceRecords().subscribe({
      next: (records) => {
        const globalRecords = records || [];
        this.reporteSalidasHistorico = globalRecords.filter(r => {
          if (!r.clockOutAt) return false;
          return this.esSalidaAnticipada(r);
        }).map(r => {
          const empIdStr = 'EMP-' + String(r.employeeId).padStart(3, '0');
          const emp = this.employees.find(e => e.id === empIdStr);

          let horaFinStr = '14:00';
          if (emp) {
            const shiftStr = emp.shift || 'MaÃƒÆ’Ã‚Â±ana';
            if (shiftStr.toLowerCase().includes('tarde')) {
              horaFinStr = '22:00';
            } else if (shiftStr.toLowerCase().includes('noche')) {
              horaFinStr = '06:00';
            }
          }

          return {
            ...r,
            employeeName: emp ? emp.name : `Empleado #${r.employeeId}`,
            employeeDni: emp ? emp.dni : 'N/A',
            horaFinProgramada: horaFinStr
          };
        }).sort((a, b) => new Date(b.clockOutAt).getTime() - new Date(a.clockOutAt).getTime());

        // Inicializar fechas si estÃƒÆ’Ã‚Â¡n vacÃƒÆ’Ã‚Â­as
        if (!this.fechaInicioReporte || !this.fechaFinReporte) {
          const hoy = new Date();
          this.fechaFinReporte = this.getLocalStartDate(hoy);
          const hace30Dias = new Date();
          hace30Dias.setDate(hoy.getDate() - 30);
          this.fechaInicioReporte = this.getLocalStartDate(hace30Dias);
        }

        this.filtrarReporteSalidas();
      },
      error: (err) => {
        console.error('Error al cargar reporte de salidas histÃƒÆ’Ã‚Â³rico:', err);
      }
    });
  }
}




