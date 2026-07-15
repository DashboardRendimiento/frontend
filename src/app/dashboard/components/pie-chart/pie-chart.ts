import { Component } from '@angular/core';
import {
  ApexChart,
  ApexNonAxisChartSeries,
  ApexResponsive,
  ApexLegend,
  NgApexchartsModule
} from 'ng-apexcharts';

@Component({
  selector:'app-pie-chart',
  standalone:true,
  imports:[NgApexchartsModule],
  templateUrl:'./pie-chart.html',
  styleUrl:'./pie-chart.css'
})
export class PieChart{

  series:ApexNonAxisChartSeries=[96,4];

  chart:ApexChart={
      type:'donut',
      height:320
  };

  labels=[
      'Presentes',
      'Ausentes'
  ];

  legend:ApexLegend={
      position:'bottom'
  };

  responsive:ApexResponsive[]=[];

}
