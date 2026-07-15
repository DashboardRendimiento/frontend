// Para el Dashboard/Tabla
export interface EmployeePerformance {
  id: string;          // EMP-001
  name: string;        // MartÃ­n GÃ³mez
  role: string;        // Operario de Picking
  shift: string;       // MaÃ±ana (06-14h)
  workingDays?: number;
  unitsProcessed?: number;
  errors?: number;
  efficiencyRate?: number; // Porcentajes
  score?: number;       // 100, 91, 78 (Score final)
  
  // Nuevos campos del backend
  totalPedidos?: number;
  ultimaHoraCarga?: string;
  totalPendientes?: number;
  
  // Campos de KPIs especÃ­ficos del backend
  pedidosPorHora?: number;
  promedioPedidosPorJornada?: number;
  objetivoDiario?: number;
  porcentajeCumplimiento?: number;
  dni?: number;
  puesto?: string;
  
  active: boolean;     // Baja logica
}

export interface SystemInfo {
  status: string;
  version: string;
}


// Estructura requerida para CREAR o recibir un Empleado
export interface Empleado {
  id?: number; // O string, segÃºn maneje tu base de datos
  nombre: string;
  apellido: string;
  sector: string;
  puesto: string;
  turno: string;
  dni: number;
  email?: string;
  role?: string;
  active?: boolean;
  fotoReferencia?: string | null;
}

// Estructura requerida para registrar o recibir Productividad
export interface Productividad {
  id?: number;
  fecha: string;            // Ejemplo: "2026-07-03"
  empleado: number;         // ID del empleado (RelaciÃ³n)
  pedidosEncargados: number;
  pedidosPreparados: number;
}


