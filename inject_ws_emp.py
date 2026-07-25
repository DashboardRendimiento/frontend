import os

path = 'src/app/features/dashboard/components/employee-detail/employee-detail.component.ts'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

if 'WebSocketService' not in content:
    content = content.replace("import { ApiService }", "import { WebSocketService } from '../../../../core/services/websocket.service';\nimport { ApiService }")
    content = content.replace("export class EmployeeDetailComponent", "export class EmployeeDetailComponent")
    content = content.replace("private apiService = inject(ApiService);", "private apiService = inject(ApiService);\n  private wsService = inject(WebSocketService);")
    
    # In ngOnInit
    # We need to find ngOnInit() { ... }
    # and add this.wsService.connect();
    # this.wsService.subscribeToProductividad(numericId).subscribe(...)
    init_hook = "this.loadDailyProductivity();"
    if init_hook in content:
        ws_init = """
    this.wsService.connect();
    const numericId = this.getNumericId(this.employee.id);
    if (numericId) {
      this.wsService.subscribeToProductividad(numericId).subscribe((data: any) => {
        console.log('[WebSocket] Update for employee', numericId, data);
        if (data) {
          // Update the kpi global locally
          this.employee.kpi = data;
          this.employee.pedidosDia = data.pedidosDia;
          this.employee.porcentajeCumplimiento = data.porcentajeCumplimiento;
          this.employee.objetivoPedidos = data.objetivoPedidos;
          this.employee.pedidosPendientesObjetivo = data.pedidosPendientesObjetivo;
          
          this.checkObjetivosYNotificaciones();
          this.cdr.detectChanges();
        }
      });
    }
    """
        content = content.replace(init_hook, init_hook + "\n" + ws_init)
    
    # In ngOnDestroy
    destroy_hook = "ngOnDestroy() {"
    if destroy_hook in content:
        ws_destroy = """
    const numericId = this.getNumericId(this.employee.id);
    if (numericId) {
      this.wsService.unsubscribe(`/topic/productividad/${numericId}`);
    }
    // we don't disconnect entirely because other components might use it
        """
        content = content.replace(destroy_hook, destroy_hook + "\n" + ws_destroy)

    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Injected WebSocket in employee-detail")
else:
    print("WebSocketService already present")

