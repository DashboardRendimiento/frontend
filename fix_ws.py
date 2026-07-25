import os

path = 'src/app/core/services/websocket.service.ts'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace("import { environment } from '../../../environments/environment';", "")
content = content.replace("environment.apiUrl.replace('/api', '/ws')", "'http://localhost:8080/ws'")
content = content.replace("'Authorization': `Bearer ` + token", "'Authorization': 'Bearer ' + token")
content = content.replace("'Authorization': Bearer  + token", "'Authorization': 'Bearer ' + token")

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
