import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector:'app-employee-table',
  standalone:true,
  imports:[CommonModule],
  templateUrl:'./employee-table.html',
  styleUrl:'./employee-table.css'
})
export class EmployeeTable{

empleados=[

{
nombre:'Juan',
productividad:98,
asistencia:'100%',
horas:5
},

{
nombre:'María',
productividad:95,
asistencia:'98%',
horas:4
},

{
nombre:'Carlos',
productividad:93,
asistencia:'97%',
horas:6
},

{
nombre:'Ana',
productividad:90,
asistencia:'96%',
horas:3
}

];

}
