import { Component } from '@angular/core';
import {
  ApexAxisChartSeries,
  ApexChart,
  ApexXAxis,
  ApexDataLabels,
  ApexPlotOptions,
  NgApexchartsModule
} from 'ng-apexcharts';

@Component({
  selector: 'app-bar-chart',
  standalone: true,
  imports: [NgApexchartsModule],
  templateUrl: './bar-chart.html',
  styleUrl: './bar-chart.css'
})
export class BarChart {

  series: ApexAxisChartSeries = [
    {
      name: 'Productividad',
      data: [98,95,93,90,87]
    }
  ];

  chart: ApexChart = {
    type: 'bar',
    height: 320,
    toolbar:{
      show:false
    }
  };

  xaxis:ApexXAxis={
    categories:[
      'Juan',
      'María',
      'Carlos',
      'Ana',
      'Lucas'
    ]
  };

  dataLabels:ApexDataLabels={
    enabled:true
  };

  plotOptions:ApexPlotOptions={
    bar:{
      borderRadius:8,
      columnWidth:'45%'
    }
  };

}
