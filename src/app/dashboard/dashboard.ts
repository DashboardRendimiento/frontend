import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
// Asegúrate de tener también aquí arriba los imports de TypeScript correspondientes, por ejemplo:
import { BarChart } from './components/bar-chart/bar-chart';
import { PieChart } from './components/pie-chart/pie-chart';
import { EmployeeTable } from './components/employee-table/employee-table';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    BarChart,
    PieChart,
    EmployeeTable
  ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})
export class Dashboard {
  kpis = [
    { titulo: 'Empleados', valor: 125, icono: '' },
    { titulo: 'Productividad', valor: '91%', icono: '' },
    { titulo: 'Asistencia', valor: '96%', icono: '' },
    { titulo: 'Horas Extra', valor: '28 h', icono: '' }
  ];
}
