import os

path = 'src/app/features/dashboard/components/perfil/perfil.component.ts'
if not os.path.exists(path):
    print("Path not found:", path)
else:
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    if 'WebSocketService' not in content:
        content = content.replace("import { ApiService }", "import { WebSocketService } from '../../../../core/services/websocket.service';\nimport { ApiService }")
        content = content.replace("private apiService = inject(ApiService);", "private apiService = inject(ApiService);\n  private wsService = inject(WebSocketService);")
        
        init_hook = "this.loadKpiHistorico();"
        if init_hook in content:
            ws_init = """
      this.wsService.connect();
      if (this.empleado.id) {
        this.wsService.subscribeToProductividad(this.empleado.id).subscribe((data: any) => {
          console.log('[WebSocket] Perfil update', data);
          if (data) {
            this.empleado.pedidosDia = data.pedidosDia;
            this.empleado.porcentajeCumplimiento = data.porcentajeCumplimiento;
            this.empleado.objetivoPedidos = data.objetivoPedidos;
            this.empleado.pedidosPendientesObjetivo = data.pedidosPendientesObjetivo;
            this.cdr.detectChanges();
          }
        });
      }
      """
            content = content.replace(init_hook, init_hook + "\n" + ws_init)
        
        destroy_hook = "ngOnDestroy() {"
        if destroy_hook in content:
            ws_destroy = """
      if (this.empleado && this.empleado.id) {
        this.wsService.unsubscribe(`/topic/productividad/${this.empleado.id}`);
      }
            """
            content = content.replace(destroy_hook, destroy_hook + "\n" + ws_destroy)

        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
        print("Injected WebSocket in perfil")
    else:
        print("WebSocketService already present")

