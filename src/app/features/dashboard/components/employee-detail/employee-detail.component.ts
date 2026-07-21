import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, ChangeDetectorRef, inject, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EmployeePerformance } from '../../../../core/models/employee.model';
import { WebSocketService } from '../../../../core/services/websocket.service';
import { ApiService } from '../../../../core/services/api.service';
import { AuthService } from '../../../../core/services/auth.service';
import { NgApexchartsModule } from 'ng-apexcharts';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-employee-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, NgApexchartsModule],
  templateUrl: './employee-detail.component.html'
})
export class EmployeeDetailComponent implements OnInit, OnDestroy {
  @Input() employee!: EmployeePerformance;
  @Input() showBackButton: boolean = true;
  @Output() backToGrid = new EventEmitter<void>();

  // Filtros de reporte
  fechaInicio: string = '';
  fechaFin: string = '';
  tipoFiltro: string = 'mes-actual';

  // Promedios de período cargados del backend
  periodKpis = {
    pedidosPorHora: null as number | null,
    bultosPorHora: null as number | null,
    totalHoras: null as number | null,
    pedidosPorJornada: null as number | null,
    bultosPorJornada: null as number | null,
    totalJornadas: null as number | null,
    cargando: false
  };

  // Roles y Notificaciones
  isAdminUser: boolean = false;
  isEmployeeUser: boolean = false;
  pedidosFaltantes: number = 0;
  mostrarNotificacionFaltantes: boolean = false;
  mostrarNotificacionIncumplido: boolean = false;

  // Asignación de pedidos por Admin
  pedidosAAsignar: number | null = null;
  asignandoPedidos: boolean = false;

  // Alerta y Confirmación Personalizada
  customAlert = {
    mostrar: false,
    titulo: '',
    mensaje: '',
    tipo: 'info' as 'success' | 'error' | 'warning' | 'info',
    callback: null as (() => void) | null
  };

  customConfirm = {
    mostrar: false,
    titulo: '',
    mensaje: '',
    callbackAceptar: null as (() => void) | null,
    callbackCancelar: null as (() => void) | null
  };

  // Formulario Productividad
  mostrarFormularioProductividad: boolean = false;
  nuevaProductividad = {
    empleado: null as number | null,
    fecha: '',
    pedidosEncargados: null as number | null,
    pedidosPreparados: null as number | null
  };

  // Historial diario cargado de la base de datos
  productivityLogs: any[] = [];
  filteredLogs: any[] = [];

  // Métricas del período filtrado
  periodUnits: number = 0;
  periodEfficiency: number = 100;
  periodErrors: number = 0;

  // KPI Global del backend
  employeeKpi: any = null;

  // Propiedades de gráficos individuales
  public dailyBultosChartOptions: any;
  public dailyEfficiencyChartOptions: any;

  // Asistencia y Horario del empleado
  hasSchedule = false;
  scheduleDays: string = '';
  scheduleTime: string = '';
  scheduleRaw: any = null;
  plantillaHoras: any = null;

  isClockedIn = false;
  attendanceHistory: any[] = [];
  activeRecord: any = null;
  timerVal = '00:00:00';
  private timerInterval: any = null;
  private pollInterval: any = null;

  // Calendario
  readonly diasSemana = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'];
  mesActual = new Date().getMonth();
  anioActual = new Date().getFullYear();

  // Reconocimiento Facial
  mostrarModalCamara = false;
  private mediaStream: MediaStream | null = null;
  capturandoFoto = false;
  fotoCapturadaUrl: string | null = null;
  fotoBlob: Blob | null = null;

  @ViewChild('videoElement') videoElement!: ElementRef<HTMLVideoElement>;
  @ViewChild('canvasElement') canvasElement!: ElementRef<HTMLCanvasElement>;

  private apiService = inject(ApiService);
  private wsService = inject(WebSocketService);
  private authService = inject(AuthService);
  private cdr = inject(ChangeDetectorRef);

  getLocalStartDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  ngOnInit(): void {
    this.isAdminUser = this.authService.isAdmin();
    this.isEmployeeUser = this.authService.isEmployee();
    this.establecerFiltroPredeterminado();
    this.cargarReportesFiltrados();
    this.cargarKpi();
    this.cargarPromediosPeriodo();
    this.cargarHorarioYAsistencia();

    // Polling cada 15 segundos para mantener objetivos y asistencia al día
    if (typeof window !== 'undefined') {
      this.pollInterval = setInterval(() => {
        this.cargarReportesFiltrados();
        this.cargarHorarioYAsistencia();
        this.cargarKpi();
      }, 15000);
    }
  }

  cargarKpi(): void {
    let numericId = 0;
    if (typeof this.employee.id === 'number') {
      numericId = this.employee.id;
    } else if (typeof this.employee.id === 'string') {
      const match = this.employee.id.match(/\d+/);
      numericId = match ? parseInt(match[0], 10) : 0;
    }
    this.apiService.getKpiEmpleado(numericId).subscribe({
      next: (kpi) => {
        this.employeeKpi = kpi;
        this.cdr.detectChanges();
      },
      error: (err) => console.error('Error cargando KPI:', err)
    });
  }

  cargarPromediosPeriodo(): void {
    if (!this.fechaInicio || !this.fechaFin) return;

    let numericId = 0;
    if (typeof this.employee.id === 'number') {
      numericId = this.employee.id;
    } else if (typeof this.employee.id === 'string') {
      const match = this.employee.id.match(/\d+/);
      numericId = match ? parseInt(match[0], 10) : 0;
    }
    this.periodKpis.cargando = true;

    forkJoin({
      promedioHora: this.apiService.getPromedioHora(numericId, this.fechaInicio, this.fechaFin),
      promedioJornada: this.apiService.getPromedioJornada(numericId, this.fechaInicio, this.fechaFin)
    }).subscribe({
      next: (res) => {
        this.periodKpis.cargando = false;
        if (res.promedioHora) {
          this.periodKpis.pedidosPorHora = res.promedioHora.promedioPedidos;
          this.periodKpis.bultosPorHora = res.promedioHora.promedioBultos;
          this.periodKpis.totalHoras = res.promedioHora.totalJornadasOHoras;
        } else {
          this.periodKpis.pedidosPorHora = null;
          this.periodKpis.bultosPorHora = null;
          this.periodKpis.totalHoras = null;
        }

        if (res.promedioJornada) {
          this.periodKpis.pedidosPorJornada = res.promedioJornada.promedioPedidos;
          this.periodKpis.bultosPorJornada = res.promedioJornada.promedioBultos;
          this.periodKpis.totalJornadas = res.promedioJornada.totalJornadasOHoras;
        } else {
          this.periodKpis.pedidosPorJornada = null;
          this.periodKpis.bultosPorJornada = null;
          this.periodKpis.totalJornadas = null;
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error al cargar promedios del período:', err);
        this.periodKpis.cargando = false;
        this.periodKpis.pedidosPorHora = null;
        this.periodKpis.bultosPorHora = null;
        this.periodKpis.totalHoras = null;
        this.periodKpis.pedidosPorJornada = null;
        this.periodKpis.bultosPorJornada = null;
        this.periodKpis.totalJornadas = null;
        this.cdr.detectChanges();
      }
    });
  }

  ngOnDestroy(): void {
    this.stopTimer();
    this.detenerCamara();
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }
  }

  establecerFiltroPredeterminado(): void {
    const hoy = new Date();
    this.fechaFin = this.getLocalStartDate(hoy);

    // Por defecto, mostrar los últimos 30 días para asegurar que se vean los registros recientes
    const hace30Dias = new Date();
    hace30Dias.setDate(hoy.getDate() - 30);
    this.fechaInicio = this.getLocalStartDate(hace30Dias);
  }

  aplicarFiltros(): void {
    this.filtrarLocalmente();
    this.cargarPromediosPeriodo();
  }

  restablecerFiltros(): void {
    this.establecerFiltroPredeterminado();
    this.aplicarFiltros();
  }

  cargarReportesFiltrados(): void {
    const numericId = parseInt(this.employee.id.replace('EMP-', ''), 10);
    this.apiService.getProductividadEmpleado(numericId).subscribe({
      next: (data) => {
        console.log(' [EmployeeDetail] Planillas de productividad cargadas:', data.length);
        this.productivityLogs = data;
        this.filtrarLocalmente();
      },
      error: (err) => {
        console.error('Error al cargar reportes de productividad:', err);
        this.productivityLogs = [];
        this.filteredLogs = [];
        this.periodUnits = 0;
        this.periodEfficiency = 100;
        this.periodErrors = this.employee.errors || 0;
        this.cdr.detectChanges();
      }
    });
  }

  filtrarLocalmente(): void {
    const start = this.fechaInicio || '0000-00-00';
    const end = this.fechaFin || '9999-99-99';

    // Comparación lexicográfica de cadenas (inmune a desvíos de zona horaria)
    this.filteredLogs = this.productivityLogs.filter(log => {
      if (!log.fecha) return false;
      return log.fecha >= start && log.fecha <= end;
    }).sort((a, b) => b.fecha.localeCompare(a.fecha));

    // Calcular métricas para el período seleccionado
    this.periodUnits = this.filteredLogs.reduce((sum, r) => sum + (r.bultosPreparados || 0), 0);
    this.periodErrors = this.employee.errors || 0;

    // Agrupar por fecha para no duplicar el objetivo diario en la métrica del período
    const encargadosPorFecha: Record<string, number> = {};
    const preparadosPorFecha: Record<string, number> = {};
    
    this.filteredLogs.forEach(r => {
      if (r.fecha) {
        encargadosPorFecha[r.fecha] = r.pedidosEncargados || 0;
        preparadosPorFecha[r.fecha] = (preparadosPorFecha[r.fecha] || 0) + (r.pedidosPreparados || 0);
      }
    });

    const totalEncargados = Object.values(encargadosPorFecha).reduce((sum, v) => sum + v, 0);
    const totalPreparados = Object.values(preparadosPorFecha).reduce((sum, v) => sum + v, 0);

    if (totalEncargados > 0) {
      this.periodEfficiency = Math.round((totalPreparados / totalEncargados) * 10000) / 100;
    } else {
      this.periodEfficiency = this.employee.efficiencyRate || 0;
    }

    this.initDetailCharts();

    // Lógica para detectar si faltan completar productos hoy (sumando todos los registros de hoy)
    const hoy = this.getLocalStartDate(new Date());
    const logsHoy = this.filteredLogs.filter(l => l.fecha === hoy);
    const preparadosHoy = logsHoy.reduce((sum, l) => sum + (l.pedidosPreparados || 0), 0);
    
    // Buscar objetivo para hoy y calcular diferencia
    const numericId = parseInt(this.employee.id.replace('EMP-', ''), 10);
    this.apiService.obtenerObjetivos(numericId).subscribe({
      next: (objetivos) => {
        const lunes = this.getLunesDeEstaSemana();
        const objSemana = objetivos.find(o => o.tipo === 'PEDIDOS' && o.semanaInicio === lunes);
        if (objSemana) {
          const diario = Math.round(objSemana.valorSemanal / 6);
          if (preparadosHoy < diario) {
            this.pedidosFaltantes = diario - preparadosHoy;
            if (this.isClockedIn) {
              this.mostrarNotificacionFaltantes = true;
              this.mostrarNotificacionIncumplido = false;
            } else {
              this.mostrarNotificacionFaltantes = false;
              this.mostrarNotificacionIncumplido = true;
            }
          } else {
            this.mostrarNotificacionFaltantes = false;
            this.mostrarNotificacionIncumplido = false;
          }
        } else {
          this.mostrarNotificacionFaltantes = false;
          this.mostrarNotificacionIncumplido = false;
        }
        this.cdr.detectChanges();
      },
      error: () => {
        this.mostrarNotificacionFaltantes = false;
        this.mostrarNotificacionIncumplido = false;
        this.cdr.detectChanges();
      }
    });

    // Forzar actualización visual tras aplicar el filtro
    this.cdr.detectChanges();
  }

  initDetailCharts(): void {
    // Tomar los logs ordenados por fecha ascendente para mostrar evolución temporal
    const chronologicalLogs = [...this.filteredLogs].reverse();
    const dates = chronologicalLogs.map(log => {
      if (!log.fecha) return '';
      const parts = log.fecha.split('-');
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}`; // dd/mm
      }
      return log.fecha;
    });
    const bultos = chronologicalLogs.map(log => log.bultosPreparados || 0);
    const efficiencies = chronologicalLogs.map(log => {
      if (log.pedidosEncargados && log.pedidosEncargados > 0) {
        return Math.round(((log.pedidosPreparados || 0) / log.pedidosEncargados) * 1000) / 10;
      }
      return this.employee.efficiencyRate; // Usar la eficacia histórica real en vez del 100% ficticio
    });

    // 1. Gráfico de Barras: Bultos por Día
    this.dailyBultosChartOptions = {
      series: [
        {
          name: "Bultos Preparados",
          data: bultos
        }
      ],
      chart: {
        type: "bar",
        height: 280,
        toolbar: { show: false }
      },
      colors: ["#3b82f6"],
      plotOptions: {
        bar: {
          columnWidth: "50%",
          borderRadius: 3,
          dataLabels: {
            position: 'top' // coloca las etiquetas arriba de las barras
          }
        }
      },
      dataLabels: {
        enabled: true,
        style: {
          fontSize: '10px',
          colors: ['#1e293b']
        },
        offsetY: -20
      },
      xaxis: {
        categories: dates,
        labels: { style: { colors: "#64748b" } }
      },
      yaxis: {
        labels: { style: { colors: "#64748b" } }
      },
      grid: {
        borderColor: "#e2e8f0",
        strokeDashArray: 4,
        yaxis: { lines: { show: true } }
      }
    };

    // 2. Gráfico de Área (Nuevo Modelo): Eficacia por Día
    this.dailyEfficiencyChartOptions = {
      series: [
        {
          name: "Eficacia (%)",
          data: efficiencies
        }
      ],
      chart: {
        type: "area", // Cambiado a área
        height: 280,
        toolbar: { show: false }
      },
      stroke: {
        width: 4,
        curve: "straight"
      },
      fill: {
        type: "gradient",
        gradient: {
          shadeIntensity: 1,
          opacityFrom: 0.4,
          opacityTo: 0.1,
          stops: [0, 90, 100]
        }
      },
      markers: {
        size: 5,
        colors: ["#047857"],
        strokeColors: "#ffffff",
        strokeWidth: 2,
        hover: { size: 7 }
      },
      dataLabels: {
        enabled: true,
        style: {
          fontSize: '10px',
          colors: ['#047857']
        },
        background: {
          enabled: true,
          foreColor: '#ffffff',
          padding: 3,
          borderRadius: 2,
          borderWidth: 1,
          borderColor: '#a7f3d0'
        }
      },
      colors: ["#10b981"], // Usamos verde brillante para la línea y el degradado del área
      xaxis: {
        categories: dates,
        labels: { style: { colors: "#64748b" } }
      },
      yaxis: {
        labels: {
          style: { colors: "#64748b" },
          formatter: (val: any) => {
            if (val === undefined || val === null || isNaN(Number(val))) return '';
            return Number(val).toFixed(1) + '%';
          }
        }
      },
      grid: {
        borderColor: "#e2e8f0",
        strokeDashArray: 4,
        xaxis: { lines: { show: true } },
        yaxis: { lines: { show: true } }
      }
    };
  }

  volver(): void {
    this.backToGrid.emit();
  }

  cargarHorarioYAsistencia(): void {
    let numericId = 0;
    if (typeof this.employee.id === 'number') {
      numericId = this.employee.id;
    } else if (typeof this.employee.id === 'string') {
      const match = this.employee.id.match(/\d+/);
      numericId = match ? parseInt(match[0], 10) : 0;
    }
    console.error('[EmployeeDetail] Fetching schedule for numericId:', numericId);

    // Cargar plantillaHoras para la vista de empleado
    this.apiService.getPlantillaHoras(numericId, new Date().toISOString().split('T')[0]).subscribe({
      next: (ph) => {
        this.plantillaHoras = ph;
        this.cdr.detectChanges();
      }
    });

    if (this.isEmployeeUser) {
      // 1. Aplicar Fallback de Horarios directamente para empleados (evita 403 en consola)
      this.hasSchedule = true;
      const shiftStr = this.employee.shift || 'Mañana';
      let startTime = '06:00';
      let endTime = '14:00';
      if (shiftStr.toLowerCase().includes('tarde')) {
        startTime = '14:00';
        endTime = '22:00';
      } else if (shiftStr.toLowerCase().includes('noche')) {
        startTime = '22:00';
        endTime = '06:00';
      }
      this.scheduleRaw = {
        workDays: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'],
        startTime: startTime + ':00',
        endTime: endTime + ':00'
      };
      this.scheduleDays = 'Lunes a Viernes';
      this.scheduleTime = `${startTime} - ${endTime}hs`;

      // 2. Cargar Asistencia desde localStorage directamente para empleados (evita 403 en consola)
      let openRecord = null;
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('active_clockin_' + numericId);
        if (saved) {
          try {
            openRecord = JSON.parse(saved);
          } catch (e) {
            console.error('Error al recuperar clockin del localStorage:', e);
          }
        }
      }

      if (openRecord) {
        this.isClockedIn = true;
        this.activeRecord = openRecord;
        this.attendanceHistory = [openRecord];
        this.startTimer(openRecord.clockInAt);
      } else {
        this.isClockedIn = false;
        this.activeRecord = null;
        this.attendanceHistory = [];
        this.stopTimer();

        // AUTO-ABRIR CÁMARA PARA EMPLEADOS SIN FICHAR HOY
        setTimeout(() => {
          this.abrirModalCamara();
          this.cdr.detectChanges();
        }, 500);
      }
      this.cargarObjetivosYFaltantes(numericId);
      this.cdr.detectChanges();
      return;
    }

    // Código original para Administradores / Supervisores (tienen permisos de lectura en el backend)
    this.apiService.getWorkSchedule(numericId).subscribe({
      next: (schedule) => {
        if (schedule) {
          this.hasSchedule = true;
          this.scheduleRaw = schedule;
          this.scheduleDays = this.formatDaysOfWeek(schedule.workDays);
          this.scheduleTime = `${schedule.startTime.substring(0, 5)} - ${schedule.endTime.substring(0, 5)}hs`;
        } else {
          this.hasSchedule = false;
          this.scheduleRaw = null;
        }
        this.cdr.detectChanges();
      },
      error: () => {
        this.hasSchedule = false;
        this.scheduleRaw = null;
        this.cdr.detectChanges();
      }
    });

    this.apiService.getAttendanceHistory(numericId).subscribe({
      next: (history) => {
        this.attendanceHistory = history || [];
        const openRecord = this.attendanceHistory.find(r => !r.clockOutAt);
        if (openRecord) {
          this.isClockedIn = true;
          this.activeRecord = openRecord;
          this.startTimer(openRecord.clockInAt);
        } else {
          this.isClockedIn = false;
          this.activeRecord = null;
          this.stopTimer();
        }
        this.cargarObjetivosYFaltantes(numericId);
        this.cdr.detectChanges();
      },
      error: () => {
        this.attendanceHistory = [];
        this.isClockedIn = false;
        this.activeRecord = null;
        this.stopTimer();
        this.cargarObjetivosYFaltantes(numericId);
        this.cdr.detectChanges();
      }
    });
  }

  getLunesDeEstaSemana(): string {
    const hoy = new Date();
    const day = hoy.getDay();
    const diff = hoy.getDate() - day + (day === 0 ? -6 : 1);
    const lunes = new Date(hoy.setDate(diff));
    return this.getLocalStartDate(lunes);
  }

  cargarObjetivosYFaltantes(numericId: number): void {
    this.apiService.obtenerObjetivos(numericId).subscribe({
      next: (objetivos) => {
        const lunes = this.getLunesDeEstaSemana();
        const objSemana = objetivos.find(o => o.tipo === 'PEDIDOS' && o.semanaInicio === lunes);
        if (objSemana) {
          const diario = Math.round(objSemana.valorSemanal / 6);
          
          if (!this.isEmployeeUser) {
            this.pedidosAAsignar = diario;
          }

          const hoy = this.getLocalStartDate(new Date());
          const logsHoy = this.filteredLogs.filter(l => l.fecha === hoy);
          const preparadosHoy = logsHoy.reduce((sum, l) => sum + (l.pedidosPreparados || 0), 0);

          if (this.isEmployeeUser) {
            if (preparadosHoy < diario) {
              this.pedidosFaltantes = diario - preparadosHoy;
              if (this.isClockedIn) {
                this.mostrarNotificacionFaltantes = true;
                this.mostrarNotificacionIncumplido = false;
              } else {
                this.mostrarNotificacionFaltantes = false;
                this.mostrarNotificacionIncumplido = true;
              }
            } else {
              this.mostrarNotificacionFaltantes = false;
              this.mostrarNotificacionIncumplido = false;
            }
          }

          // Asignar el diario a todos los logs de hoy
          logsHoy.forEach(log => {
            log.pedidosEncargados = diario;
          });
        } else {
          this.mostrarNotificacionFaltantes = false;
          this.mostrarNotificacionIncumplido = false;
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error al obtener objetivos:', err);
      }
    });
  }

  formatDaysOfWeek(days: string[]): string {
    if (!days || days.length === 0) return '';
    const map: Record<string, string> = {
      MONDAY: 'Lunes',
      TUESDAY: 'Martes',
      WEDNESDAY: 'Miércoles',
      THURSDAY: 'Jueves',
      FRIDAY: 'Viernes',
      SATURDAY: 'Sábado',
      SUNDAY: 'Domingo'
    };
    const translated = days.map(d => map[d] || d);
    if (translated.length === 5 && days.includes('MONDAY') && days.includes('FRIDAY')) {
      return 'Lunes a Viernes';
    }
    if (translated.length === 6 && days.includes('MONDAY') && days.includes('SATURDAY')) {
      return 'Lunes a Sábado';
    }
    return translated.join(', ');
  }

  startTimer(startTimeStr: string): void {
    if (this.timerInterval) clearInterval(this.timerInterval);
    const start = new Date(startTimeStr).getTime();
    this.timerInterval = setInterval(() => {
      const now = new Date().getTime();
      const diff = now - start;
      if (diff < 0) {
        this.timerVal = '00:00:00';
        return;
      }
      const hrs = Math.floor(diff / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      this.timerVal =
        String(hrs).padStart(2, '0') + ':' +
        String(mins).padStart(2, '0') + ':' +
        String(secs).padStart(2, '0');
      this.cdr.detectChanges();
    }, 1000);
  }

  stopTimer(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    this.timerVal = '00:00:00';
  }

  registrarEntrada(): void {
    this.abrirModalCamara();
  }

  // --- MÉTODOS PARA RECONOCIMIENTO FACIAL ---
  abrirModalCamara(): void {
    this.mostrarModalCamara = true;
    this.fotoCapturadaUrl = null;
    this.fotoBlob = null;
    this.iniciarCamara();
  }

  cerrarModalCamara(): void {
    this.mostrarModalCamara = false;
    this.detenerCamara();
  }

  iniciarCamara(): void {
    if (typeof navigator !== 'undefined' && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ video: true })
        .then(stream => {
          this.mediaStream = stream;
          setTimeout(() => {
            if (this.videoElement && this.videoElement.nativeElement) {
              this.videoElement.nativeElement.srcObject = stream;
              this.videoElement.nativeElement.play();
            }
          }, 0);
        })
        .catch(err => {
          console.error('Error al acceder a la cámara:', err);
          this.mostrarAlerta('Permiso denegado', 'No se pudo acceder a la cámara. Revisa los permisos del navegador.', 'error');
        });
    } else {
      this.mostrarAlerta('No compatible', 'Tu navegador no soporta el acceso a la cámara web.', 'error');
    }
  }

  detenerCamara(): void {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }
  }

  capturarFoto(): void {
    if (!this.videoElement || !this.canvasElement) return;
    const video = this.videoElement.nativeElement;
    const canvas = this.canvasElement.nativeElement;

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    const context = canvas.getContext('2d');
    if (context) {
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      canvas.toBlob(blob => {
        if (blob) {
          this.fotoBlob = blob;
          this.fotoCapturadaUrl = URL.createObjectURL(blob);
          this.detenerCamara();
          this.cdr.detectChanges();
        }
      }, 'image/jpeg', 0.9);
    }
  }

  reintentarFoto(): void {
    this.fotoCapturadaUrl = null;
    this.fotoBlob = null;
    this.iniciarCamara();
  }

  confirmarFichajeConFoto(): void {
    this.capturandoFoto = true;
    const numericId = parseInt(this.employee.id.replace('EMP-', ''), 10);

    this.apiService.clockIn(numericId, this.fotoBlob || undefined).subscribe({
      next: (res) => {
        this.capturandoFoto = false;
        this.cerrarModalCamara();
        if (res && typeof window !== 'undefined') {
          localStorage.setItem('active_clockin_' + numericId, JSON.stringify(res));
        }
        this.cargarHorarioYAsistencia();
        this.mostrarAlerta('Éxito', 'Fichaje de entrada registrado correctamente.', 'success');
      },
      error: (err) => {
        console.error('Error al fichar entrada con foto:', err);
        this.capturandoFoto = false;
        if (err.status === 409) {
          this.isClockedIn = true;
          const nowStr = new Date().toISOString();
          const recoveredRecord = {
            id: numericId,
            clockInAt: nowStr
          };
          this.activeRecord = recoveredRecord;
          this.attendanceHistory = [recoveredRecord];
          if (typeof window !== 'undefined') {
            localStorage.setItem('active_clockin_' + numericId, JSON.stringify(recoveredRecord));
          }
          this.startTimer(nowStr);
          this.cerrarModalCamara();
          this.mostrarAlerta('Sincronizado', 'Ya tenías un fichaje de entrada registrado. Se ha sincronizado el estado.', 'info');
        } else {
          this.mostrarAlerta('Error de Fichaje', err.error?.message || 'No se pudo fichar la entrada.', 'error');
        }
      }
    });
  }

  ficharSinFoto(): void {
    this.capturandoFoto = true;
    const numericId = parseInt(this.employee.id.replace('EMP-', ''), 10);

    this.apiService.clockIn(numericId).subscribe({
      next: (res) => {
        this.capturandoFoto = false;
        this.cerrarModalCamara();
        if (res && typeof window !== 'undefined') {
          localStorage.setItem('active_clockin_' + numericId, JSON.stringify(res));
        }
        this.cargarHorarioYAsistencia();
        this.mostrarAlerta('Éxito', 'Fichaje de entrada registrado correctamente.', 'success');
      },
      error: (err) => {
        console.error('Error al fichar entrada sin foto:', err);
        this.capturandoFoto = false;
        if (err.status === 409) {
          this.isClockedIn = true;
          const nowStr = new Date().toISOString();
          const recoveredRecord = {
            id: numericId,
            clockInAt: nowStr
          };
          this.activeRecord = recoveredRecord;
          this.attendanceHistory = [recoveredRecord];
          if (typeof window !== 'undefined') {
            localStorage.setItem('active_clockin_' + numericId, JSON.stringify(recoveredRecord));
          }
          this.startTimer(nowStr);
          this.cerrarModalCamara();
          this.mostrarAlerta('Sincronizado', 'Ya tenías un fichaje de entrada registrado. Se ha sincronizado el estado.', 'info');
        } else {
          this.mostrarAlerta('Error de Fichaje', err.error?.message || 'No se pudo fichar la entrada.', 'error');
        }
      }
    });
  }

  getScheduledEndTime(clockInDate: Date): Date | null {
    if (!this.scheduleRaw || !this.scheduleRaw.endTime) return null;
    
    const endParts = this.scheduleRaw.endTime.split(':');
    const endHour = parseInt(endParts[0], 10);
    const endMin = parseInt(endParts[1], 10);
    
    const scheduledEnd = new Date(clockInDate);
    scheduledEnd.setHours(endHour, endMin, 0, 0);
    
    if (this.scheduleRaw.startTime) {
      const startParts = this.scheduleRaw.startTime.split(':');
      const startHour = parseInt(startParts[0], 10);
      if (endHour < startHour) {
        // Cruza la medianoche (turno noche)
        scheduledEnd.setDate(scheduledEnd.getDate() + 1);
      }
    }
    return scheduledEnd;
  }

  registrarSalida(): void {
    if (this.capturandoFoto) return;
    
    // 1. Verificar si está saliendo antes de la hora de fin programada
    let clockInDate = new Date();
    if (this.activeRecord && this.activeRecord.clockInAt) {
      clockInDate = new Date(this.activeRecord.clockInAt);
    }

    const scheduledEnd = this.getScheduledEndTime(clockInDate);
    const now = new Date();

    const procederSalida = () => {
      if (this.capturandoFoto) return;
      this.capturandoFoto = true;
      const numericId = parseInt(this.employee.id.replace('EMP-', ''), 10);
      this.apiService.clockOut(numericId).subscribe({
        next: () => {
          this.capturandoFoto = false;
          if (typeof window !== 'undefined') {
            localStorage.removeItem('active_clockin_' + numericId);
          }
          this.cargarHorarioYAsistencia();
          this.mostrarAlerta('Éxito', 'Fichaje de salida registrado correctamente.', 'success');
        },
        error: (err) => {
          console.error('Error al fichar salida:', err);
          this.capturandoFoto = false;
          if (err.status === 409 || err.status === 404) {
            if (typeof window !== 'undefined') {
              localStorage.removeItem('active_clockin_' + numericId);
            }
            this.cargarHorarioYAsistencia();
            this.mostrarAlerta('Fichaje Sincronizado', 'El fichaje de salida ya estaba registrado en el servidor. Se ha sincronizado el estado.', 'info');
          } else {
            this.mostrarAlerta('Error de Fichaje', err.error?.message || 'No se pudo fichar la salida.', 'error');
          }
        }
      });
    };

    if (scheduledEnd && now < scheduledEnd) {
      const scheduledEndStr = scheduledEnd.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      this.mostrarConfirmacion(
        'Salida Anticipada',
        `¡Atención! Aún no es tu hora de salida programada (${scheduledEndStr}). ¿Estás seguro de que deseas fichar la salida antes de tiempo?`,
        procederSalida
      );
    } else {
      procederSalida();
    }
  }

  mesNombre(): string {
    return new Date(this.anioActual, this.mesActual, 1)
      .toLocaleDateString('es-AR', { month: 'long' })
      .replace(/^\w/, c => c.toUpperCase());
  }

  diasCalendario(): number[] {
    const primerDia = new Date(this.anioActual, this.mesActual, 1).getDay();
    const offset = (primerDia + 6) % 7;
    const totalDias = new Date(this.anioActual, this.mesActual + 1, 0).getDate();
    const dias: number[] = Array(offset).fill(0);
    for (let i = 1; i <= totalDias; i++) dias.push(i);
    return dias;
  }

  esDiaTrabajo(dia: number): boolean {
    if (dia === 0) return false;
    if (!this.hasSchedule || !this.scheduleRaw || !this.scheduleRaw.workDays) return false;
    const date = new Date(this.anioActual, this.mesActual, dia);
    const dowMap = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
    const currentDayName = dowMap[date.getDay()];
    return this.scheduleRaw.workDays.includes(currentDayName);
  }

  esAsistido(dia: number): boolean {
    if (dia === 0) return false;
    const dateStr = `${this.anioActual}-${String(this.mesActual + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
    return this.attendanceHistory.some(r => {
      if (!r.clockInAt) return false;
      const logDate = r.clockInAt.substring(0, 10);
      return logDate === dateStr;
    });
  }

  esHoy(dia: number): boolean {
    const hoy = new Date();
    return dia !== 0
      && dia === hoy.getDate()
      && this.mesActual === hoy.getMonth()
      && this.anioActual === hoy.getFullYear();
  }

  cambiarMes(dir: number): void {
    this.mesActual += dir;
    if (this.mesActual > 11) { this.mesActual = 0;  this.anioActual++; }
    if (this.mesActual < 0)  { this.mesActual = 11; this.anioActual--; }
    this.cdr.detectChanges();
  }

  // --- MÉTODOS PARA PRODUCTIVIDAD ---
  abrirFormularioProductividad(): void {
    this.mostrarFormularioProductividad = true;
    this.nuevaProductividad.empleado = parseInt(this.employee.id.replace('EMP-', ''), 10);
    this.nuevaProductividad.fecha = this.getLocalStartDate(new Date());

    // Buscar objetivo semanal actual para auto-completar pedidos encargados diarios
    this.apiService.obtenerObjetivos(this.nuevaProductividad.empleado).subscribe({
      next: (objetivos) => {
        const lunes = this.getLunesDeEstaSemana();
        const objSemana = objetivos.find(o => o.tipo === 'PEDIDOS' && o.semanaInicio === lunes);
        if (objSemana) {
          this.nuevaProductividad.pedidosEncargados = Math.round(objSemana.valorSemanal / 6);
        } else {
          this.nuevaProductividad.pedidosEncargados = 0;
        }
        this.cdr.detectChanges();
      },
      error: () => {
        this.nuevaProductividad.pedidosEncargados = 0;
        this.cdr.detectChanges();
      }
    });
  }

  cerrarFormularioProductividad(): void {
    this.mostrarFormularioProductividad = false;
    this.nuevaProductividad = {
      empleado: null,
      fecha: this.getLocalStartDate(new Date()),
      pedidosEncargados: null,
      pedidosPreparados: null
    };
  }

  guardarProductividad(): void {
    console.log("Valores a validar:", this.nuevaProductividad);

    // Forzamos conversión a número por si el binding de angular (ngModel) los trató como string (defaulting to 0 if empty)
    this.nuevaProductividad.pedidosEncargados = this.nuevaProductividad.pedidosEncargados != null ? Number(this.nuevaProductividad.pedidosEncargados) : 0;
    this.nuevaProductividad.pedidosPreparados = this.nuevaProductividad.pedidosPreparados != null ? Number(this.nuevaProductividad.pedidosPreparados) : 0;

    if (!this.nuevaProductividad.empleado || !this.nuevaProductividad.fecha ||
        isNaN(this.nuevaProductividad.pedidosEncargados) ||
        isNaN(this.nuevaProductividad.pedidosPreparados)) {
      this.mostrarAlerta('Atención', 'Por favor complete todos los campos obligatorios con números válidos.', 'warning');
      return;
    }

    console.log('Enviando nueva productividad al backend:', this.nuevaProductividad);

    this.apiService.registrarProductividad(this.nuevaProductividad as any).subscribe({
      next: (res) => {
        console.log('Productividad registrada con éxito:', res);
        this.cerrarFormularioProductividad();
        this.mostrarAlerta('Éxito', 'Productividad registrada con éxito.', 'success');
        this.cargarReportesFiltrados(); // Recargar datos locales
      },
      error: (err: any) => {
        console.error('Error detallado al registrar productividad:', err);
        // Interceptar cuando la sesión se desincroniza y el servidor no registra una entrada abierta
        if (err.status === 409 && err.error?.message?.includes('no tiene un fichaje de entrada abierto')) {
          if (typeof window !== 'undefined') {
            localStorage.removeItem('active_clockin_' + this.nuevaProductividad.empleado);
          }
          this.isClockedIn = false;
          this.activeRecord = null;
          this.stopTimer();
          this.cerrarFormularioProductividad();
          this.mostrarAlerta('Sesión Expirada', 'Tu sesión de fichaje se ha desincronizado (el servidor no registra tu entrada). Por favor, ficha la entrada antes de registrar tu productividad.', 'warning');
          this.abrirModalCamara();
        } else {
          this.mostrarAlerta('Error de Registro', 'Error al guardar el registro de productividad en el servidor. Revisa la consola para más detalles.', 'error');
        }
      }
    });
  }

  asignarPedidosEncargados(): void {
    if (!this.pedidosAAsignar || this.pedidosAAsignar <= 0) return;
    const numericId = parseInt(this.employee.id.replace('EMP-', ''), 10);
    const lunes = this.getLunesDeEstaSemana();
    this.asignandoPedidos = true;

    this.apiService.obtenerObjetivos(numericId).subscribe({
      next: (objetivos) => {
        const objSemana = objetivos.find(o => o.tipo === 'PEDIDOS' && o.semanaInicio === lunes);
        const valorSemanalAdicional = (this.pedidosAAsignar as number) * 6;
        const valorSemanalTotal = objSemana
          ? objSemana.valorSemanal + valorSemanalAdicional
          : valorSemanalAdicional;

        const request$ = objSemana
          ? this.apiService.actualizarObjetivo(objSemana.id, valorSemanalTotal)
          : this.apiService.crearObjetivo(numericId, 'PEDIDOS', valorSemanalTotal, lunes);

        request$.subscribe({
          next: () => {
            this.mostrarAlerta('Objetivo Agregado', `¡Se han agregado ${this.pedidosAAsignar} pedidos diarios (${valorSemanalAdicional} semanales). Total: ${Math.round(valorSemanalTotal / 6)} diarios (${valorSemanalTotal} semanales) exitosamente!`, 'success');
            this.asignandoPedidos = false;
            this.cargarHorarioYAsistencia(); // Esto recargará los objetivos y la UI
          },
          error: (err) => {
            console.error('Error al asignar el objetivo:', err);
            this.mostrarAlerta('Error de Asignación', 'Error al asignar los pedidos.', 'error');
            this.asignandoPedidos = false;
          }
        });
      },
      error: (err) => {
        console.error('Error al obtener objetivos antes de asignar:', err);
        this.mostrarAlerta('Error de Conexión', 'Error al verificar los objetivos existentes.', 'error');
        this.asignandoPedidos = false;
      }
    });
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

  mostrarConfirmacion(titulo: string, mensaje: string, onAceptar: () => void, onCancelar?: () => void): void {
    this.customConfirm = {
      mostrar: true,
      titulo,
      mensaje,
      callbackAceptar: onAceptar,
      callbackCancelar: onCancelar || null
    };
    this.cdr.detectChanges();
  }

  aceptarConfirmacion(): void {
    const cb = this.customConfirm.callbackAceptar;
    this.customConfirm.mostrar = false;
    this.cdr.detectChanges();
    if (cb) cb();
  }

  cancelarConfirmacion(): void {
    const cb = this.customConfirm.callbackCancelar;
    this.customConfirm.mostrar = false;
    this.cdr.detectChanges();
    if (cb) cb();
  }
}
