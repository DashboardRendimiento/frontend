import re

file_path = 'src/app/features/dashboard/components/employee-detail/employee-detail.component.html'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Remove Bultos/Hora card
content = re.sub(r'<!-- Bultos/Hora -->.*?</div>\s*</div>', '', content, flags=re.DOTALL)

# Remove Promedio Bultos Jornada
content = re.sub(r'<!-- Promedio Bultos Jornada -->.*?</div>\s*</div>', '', content, flags=re.DOTALL)

# Remove Evolución de Bultos Preparados section
content = re.sub(r'<!-- Rendimiento Diario \(Bar Chart\) -->.*?</apx-chart>\s*</div>', '', content, flags=re.DOTALL)

# Remove table headers for bultos
content = re.sub(r'<th style="padding: 10px 12px; text-align: right;">Bultos Preparados</th>\n?', '', content)

# Remove table row for bultos
content = re.sub(r'<td style="padding: 10px 12px; text-align: right;">\{\{ log\.bultosPreparados \| number \}\}</td>\n?', '', content)

# Remove form group for bultos
content = re.sub(r'<div class="form-group" style="display: flex; flex-direction: column; gap: 6px;">\s*<label for="prodBultos"[^>]*>Bultos Preparados</label>\s*<input type="number" id="prodBultos" name="prodBultos" \[\(ngModel\)\]="nuevaProductividad\.bultosPreparados"[^>]*/>\s*</div>', '', content)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
