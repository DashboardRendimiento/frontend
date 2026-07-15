import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EmployeePerformance } from '../../../core/models/employee.model';
import { ApiService } from '../../../core/services/api.service';

@Component({
  selector: 'app-employee-table',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './employee-table.component.html',
  styleUrl: './employee-table.component.css'
})
export class EmployeeTableComponent implements OnChanges, OnInit {
  @Input() data: EmployeePerformance[] = [];
  @Input() usuarioActual: { name: string; role: string; isAdmin: boolean } | null = null;
  @Output() refreshData = new EventEmitter<void>();
  @Output() selectEmployee = new EventEmitter<EmployeePerformance | null>();

  // Variables de filtrado de búsqueda
  filtroBusqueda: string = '';
  filteredData: EmployeePerformance[] = [];

  // Asignación de pedidos
  mostrarModalAsignacion = false;
  empleadoParaAsignar: EmployeePerformance | null = null;
  pedidosAAsignar: number | null = null;

  mostrarFormulario: boolean = false;
  mostrarFormularioProductividad: boolean = false;
  mostrarFormularioHorario: boolean = false;
  empleadoParaHorario: EmployeePerformance | null = null;
  horarioIdExistente: number | null = null;
  diasSeleccionados: Record<string, boolean> = {
    MONDAY: false,
    TUESDAY: false,
    WEDNESDAY: false,
    THURSDAY: false,
    FRIDAY: false,
    SATURDAY: false,
    SUNDAY: false
  };
  horaInicio: string = '08:00';
  horaFin: string = '17:00';

  nuevoEmpleado = {
    nombre: '',
    apellido: '',
    dni: null as number | null,
    sector: 'Operaciones',
    puesto: 'Operario de Picking',
    turno: 'Mañana (06-14h)',
    email: '',
    passwordHash: '123456',
    role: 'EMPLEADO',
    diasTrabajados: null as number | null,
    errores: null as number | null
  };

  constructor(private apiService: ApiService) {}

  ngOnInit(): void {
    this.filteredData = this.data;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['data']) {
      this.filtrarTabla();
    }
  }

  filtrarTabla(): void {
    let filtered = this.data;
    // Ocultar inactivos si NO es Admin
    if (this.usuarioActual?.isAdmin !== true) {
      filtered = filtered.filter(emp => emp.active);
    }

    if (this.filtroBusqueda) {
      const query = this.filtroBusqueda.toLowerCase().trim();
      filtered = filtered.filter(emp =>
        (emp.id && emp.id.toLowerCase().includes(query)) ||
        (emp.name && emp.name.toLowerCase().includes(query)) ||
        (emp.role && emp.role.toLowerCase().includes(query)) ||
        (emp.shift && emp.shift.toLowerCase().includes(query))
      );
    }
    this.filteredData = filtered;
  }

  limpiarBusqueda(): void {
    this.filtroBusqueda = '';
    this.filtrarTabla();
  }


  abrirFormularioEmpleado(): void {
    this.mostrarFormulario = true;
  }

  cerrarFormulario(): void {
    this.mostrarFormulario = false;
    this.resetForm();
  }

  resetForm(): void {
    this.nuevoEmpleado = {
      nombre: '',
      apellido: '',
      dni: null,
      sector: 'Operaciones',
      puesto: 'Operario de Picking',
      turno: 'Mañana (06-14h)',
      email: '',
      passwordHash: '123456',
      role: 'EMPLEADO',
      diasTrabajados: null,
      errores: null
    };
  }

  getNumericId(id: string): number {
    if (!id) return 0;
    const cleanId = id.replace('EMP-', '');
    return parseInt(cleanId, 10);
  }

  guardarEmpleado(): void {
    if (this.nuevoEmpleado.nombre && this.nuevoEmpleado.apellido && this.nuevoEmpleado.dni) {

      // Auto-generar email para que no falle la restricción 'unique' de la base de datos
      this.nuevoEmpleado.email = `${this.nuevoEmpleado.nombre.toLowerCase().replace(/\s+/g, '')}.${this.nuevoEmpleado.apellido.toLowerCase().replace(/\s+/g, '')}${Math.floor(Math.random() * 1000)}@rrhh.com`;

      this.apiService.crearEmpleado(this.nuevoEmpleado as any).subscribe({
        next: (res: any) => {
          console.log('Empleado creado con éxito:', res);

          // Guardar valores iniciales (overrides) en localStorage si se especificaron
          if (res && res.id && typeof window !== 'undefined') {
            const workingDays = this.nuevoEmpleado.diasTrabajados || 0;
            const errors = this.nuevoEmpleado.errores || 0;
            if (workingDays > 0 || errors > 0) {
              const overrideKey = `kpi_override_${res.id}`;
              localStorage.setItem(overrideKey, JSON.stringify({ workingDays, errors }));
            }
          }

          this.cerrarFormulario();
          this.refreshData.emit(); // Recarga los datos en el dashboard
        },
        error: (err) => {
          console.error('Error al crear empleado:', err);
          alert('Error al registrar el empleado en el servidor.');
        }
      });
    } else {
      alert('Por favor complete los campos obligatorios: Nombre, Apellido y DNI.');
    }
  }

  toggleActivo(emp: EmployeePerformance): void {
    const numericId = this.getNumericId(emp.id);
    const newActiveState = !emp.active;
    const actionText = newActiveState ? 'Activar' : 'Inactivar';

    if (confirm(`¿Estás seguro de ${actionText} a ${emp.name}?`)) {
      // SOLO FRONTEND (Mock): No conectamos con backend todavía como solicitó el usuario
      emp.active = newActiveState;
      console.log(`Empleado ${newActiveState ? 'Activado' : 'Inactivado'} con éxito (Modo Mock Front-End)`);
      this.refreshData.emit();
    }
  }

  editarEmpleado(emp: EmployeePerformance): void {
    // Para simplificar, abrimos el formulario pero como "Editar"
    // Sería mejor un endpoint y form separado, pero usaremos el existente si se puede.
    alert('Función de edición en desarrollo.');
  }

  seleccionarEmpleado(emp: EmployeePerformance): void {
    if (this.usuarioActual?.role === 'SUPERADMIN') {
      return; // SUPERADMIN cannot view productivity details
    }
    this.selectEmployee.emit(emp);
  }

  abrirGestionHorario(emp: EmployeePerformance): void {
    this.empleadoParaHorario = emp;
    const numericId = this.getNumericId(emp.id);

    // Resetear formulario
    this.horarioIdExistente = null;
    this.horaInicio = '08:00';
    this.horaFin = '17:00';
    Object.keys(this.diasSeleccionados).forEach(k => this.diasSeleccionados[k] = false);

    // Cargar horario existente
    this.apiService.getWorkSchedule(numericId).subscribe({
      next: (schedule) => {
        if (schedule) {
          this.horarioIdExistente = schedule.id;
          this.horaInicio = schedule.startTime.substring(0, 5);
          this.horaFin = schedule.endTime.substring(0, 5);
          if (schedule.workDays) {
            schedule.workDays.forEach((day: string) => {
              this.diasSeleccionados[day] = true;
            });
          }
        } else {
          // Si no existe, premarcar de Lunes a Viernes
          ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'].forEach(d => {
            this.diasSeleccionados[d] = true;
          });
        }
        this.mostrarFormularioHorario = true;
      },
      error: (err) => {
        console.error('Error al cargar horario del empleado:', err);
        // Fallback premarcar Lunes a Viernes
        ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'].forEach(d => {
          this.diasSeleccionados[d] = true;
        });
        this.mostrarFormularioHorario = true;
      }
    });
  }

  cerrarFormularioHorario(): void {
    this.mostrarFormularioHorario = false;
    this.empleadoParaHorario = null;
    this.horarioIdExistente = null;
  }

  guardarHorario(): void {
    if (!this.empleadoParaHorario) return;
    const numericId = this.getNumericId(this.empleadoParaHorario.id);

    const workDays = Object.keys(this.diasSeleccionados).filter(k => this.diasSeleccionados[k]);
    if (workDays.length === 0) {
      alert('Por favor seleccione al menos un día de trabajo.');
      return;
    }

    // Formatear hora de inicio y fin como LocalTime (HH:mm:ss)
    const formattedStart = this.horaInicio.length === 5 ? `${this.horaInicio}:00` : this.horaInicio;
    const formattedEnd = this.horaFin.length === 5 ? `${this.horaFin}:00` : this.horaFin;

    const payload = {
      employeeId: numericId,
      workDays: workDays,
      startTime: formattedStart,
      endTime: formattedEnd
    };

    if (this.horarioIdExistente) {
      this.apiService.updateWorkSchedule(this.horarioIdExistente, payload).subscribe({
        next: () => {
          console.log('Horario actualizado con éxito');
          this.cerrarFormularioHorario();
          this.refreshData.emit();
        },
        error: (err) => {
          console.error('Error al actualizar horario:', err);
          alert(err.error?.message || 'Error al guardar el horario.');
        }
      });
    } else {
      this.apiService.saveWorkSchedule(payload).subscribe({
        next: () => {
          console.log('Horario guardado con éxito');
          this.cerrarFormularioHorario();
          this.refreshData.emit();
        },
        error: (err) => {
          console.error('Error al guardar horario:', err);
          alert(err.error?.message || 'Error al guardar el horario.');
        }
      });
    }
  }

  eliminarHorario(): void {
    if (!this.horarioIdExistente) return;
    if (confirm('¿Estás seguro de que deseas quitar el horario de trabajo de este empleado?')) {
      this.apiService.deleteWorkSchedule(this.horarioIdExistente).subscribe({
        next: () => {
          console.log('Horario eliminado con éxito');
          this.cerrarFormularioHorario();
          this.refreshData.emit();
        },
        error: (err) => {
          console.error('Error al eliminar horario:', err);
          alert('Error al quitar el horario del empleado.');
        }
      });
    }
  }

  // --- Métodos para Asignación de Pedidos ---

  abrirModalAsignarPedidos(emp: EmployeePerformance): void {
    this.empleadoParaAsignar = emp;
    this.pedidosAAsignar = null; // Resetear el input
    this.mostrarModalAsignacion = true;
  }

  cerrarModalAsignarPedidos(): void {
    this.mostrarModalAsignacion = false;
    this.empleadoParaAsignar = null;
  }

  guardarAsignacionPedidos(): void {
    if (!this.empleadoParaAsignar || !this.pedidosAAsignar || this.pedidosAAsignar <= 0) {
      alert('Por favor, introduce una cantidad válida de pedidos.');
      return;
    }

    const numericId = this.getNumericId(this.empleadoParaAsignar.id);
    const hoy = this.getLocalStartDate(new Date());

    this.apiService.asignarPedidosAdmin(numericId, this.pedidosAAsignar, hoy).subscribe({
      next: () => {
        alert(`Se agregaron ${this.pedidosAAsignar} pedidos a ${this.empleadoParaAsignar?.name} para hoy.`);
        this.cerrarModalAsignarPedidos();
        this.refreshData.emit(); // Refrescar datos en el dashboard
      },
      error: (err: any) => alert(err.error?.message || 'Error al asignar los pedidos.')
    });
  }

  getLocalStartDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
