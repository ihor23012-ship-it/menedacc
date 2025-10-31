Конечно! Вот все файлы вашего приложения "Менеджер Ресурсов":
Action: {"tool_name": "mcp_view_bulk", "tool_arguments": {"paths": ["/app/backend/server.py", "/app/frontend/src/App.js", "/app/frontend/src/App.css", "/app/backend/requirements.txt", "/app/frontend/package.json", "/app/README.md", "/app/example_resources.txt"]}, "type": "mcp_tool"}
Observation: ===FILE: /app/backend/server.py
/app/backend/server.py:
1|from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File
2|from dotenv import load_dotenv
3|from starlette.middleware.cors import CORSMiddleware
4|from motor.motor_asyncio import AsyncIOMotorClient
5|import os
6|import logging
7|from pathlib import Path
8|from pydantic import BaseModel, Field, ConfigDict
9|from typing import List, Optional
10|import uuid
11|from datetime import datetime, timezone
12|import io
13|
14|ROOT_DIR = Path(__file__).parent
15|load_dotenv(ROOT_DIR / '.env')
16|
17|# MongoDB connection
18|mongo_url = os.environ['MONGO_URL']
19|client = AsyncIOMotorClient(mongo_url)
20|db = client[os.environ['DB_NAME']]
21|
22|# Create the main app without a prefix
23|app = FastAPI()
24|
25|# Create a router with the /api prefix
26|api_router = APIRouter(prefix="/api")
27|
28|# Define Models
29|class Resource(BaseModel):
30|    model_config = ConfigDict(extra="ignore")
31|    
32|    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
33|    url: str
34|    login: str
35|    password: str
36|    is_active: bool = True
37|    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
38|
39|class ResourceCreate(BaseModel):
40|    url: str
41|    login: str
42|    password: str
43|
44|class ResourceUpdate(BaseModel):
45|    is_active: bool
46|
47|# Routes
48|@api_router.get("/")
49|async def root():
50|    return {"message": "Resource Manager API"}
51|
52|@api_router.post("/resources", response_model=Resource)
53|async def create_resource(input: ResourceCreate):
54|    """Создать новый ресурс"""
55|    resource_dict = input.model_dump()
56|    resource_obj = Resource(**resource_dict)
57|    
58|    doc = resource_obj.model_dump()
59|    doc['created_at'] = doc['created_at'].isoformat()
60|    
61|    await db.resources.insert_one(doc)
62|    return resource_obj
63|
64|@api_router.get("/resources", response_model=List[Resource])
65|async def get_resources():
66|    """Получить все ресурсы"""
67|    resources = await db.resources.find({}, {"_id": 0}).to_list(1000)
68|    
69|    for resource in resources:
70|        if isinstance(resource['created_at'], str):
71|            resource['created_at'] = datetime.fromisoformat(resource['created_at'])
72|    
73|    return resources
74|
75|@api_router.put("/resources/{resource_id}", response_model=Resource)
76|async def update_resource(resource_id: str, update: ResourceUpdate):
77|    """Обновить статус ресурса (включить/отключить)"""
78|    result = await db.resources.find_one_and_update(
79|        {"id": resource_id},
80|        {"$set": {"is_active": update.is_active}},
81|        return_document=True
82|    )
83|    
84|    if not result:
85|        raise HTTPException(status_code=404, detail="Ресурс не найден")
86|    
87|    result.pop('_id', None)
88|    if isinstance(result['created_at'], str):
89|        result['created_at'] = datetime.fromisoformat(result['created_at'])
90|    
91|    return Resource(**result)
92|
93|@api_router.delete("/resources/{resource_id}")
94|async def delete_resource(resource_id: str):
95|    """Удалить ресурс"""
96|    result = await db.resources.delete_one({"id": resource_id})
97|    
98|    if result.deleted_count == 0:
99|        raise HTTPException(status_code=404, detail="Ресурс не найден")
100|    
101|    return {"message": "Ресурс удалён"}
102|
103|@api_router.post("/resources/import")
104|async def import_resources(file: UploadFile = File(...)):
105|    """Импорт ресурсов из файла формата url:login:pass"""
106|    try:
107|        contents = await file.read()
108|        text = contents.decode('utf-8')
109|        
110|        lines = text.strip().split('\n')
111|        imported = 0
112|        errors = []
113|        
114|        for i, line in enumerate(lines, 1):
115|            line = line.strip()
116|            if not line:
117|                continue
118|            
119|            # Разделяем по двоеточию справа налево (последние 2 двоеточия)
120|            parts = line.rsplit(':', 2)
121|            if len(parts) != 3:
122|                errors.append(f"Строка {i}: неверный формат (ожидается url:login:pass)")
123|                continue
124|            
125|            url, login, password = [p.strip() for p in parts]
126|            
127|            if not url or not login or not password:
128|                errors.append(f"Строка {i}: пустые поля")
129|                continue
130|            
131|            resource_obj = Resource(url=url, login=login, password=password)
132|            doc = resource_obj.model_dump()
133|            doc['created_at'] = doc['created_at'].isoformat()
134|            
135|            await db.resources.insert_one(doc)
136|            imported += 1
137|        
138|        return {
139|            "message": f"Импортировано ресурсов: {imported}",
140|            "imported": imported,
141|            "errors": errors
142|        }
143|    
144|    except Exception as e:
145|        raise HTTPException(status_code=400, detail=f"Ошибка импорта: {str(e)}")
146|
147|# Include the router in the main app
148|app.include_router(api_router)
149|
150|app.add_middleware(
151|    CORSMiddleware,
152|    allow_credentials=True,
153|    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
154|    allow_methods=["*"],
155|    allow_headers=["*"],
156|)
157|
158|# Configure logging
159|logging.basicConfig(
160|    level=logging.INFO,
161|    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
162|)
163|logger = logging.getLogger(__name__)
164|
165|@app.on_event("shutdown")
166|async def shutdown_db_client():
167|    client.close()

===END

===FILE: /app/frontend/src/App.js
/app/frontend/src/App.js:
1|import { useState, useEffect } from "react";
2|import "@/App.css";
3|import axios from "axios";
4|
5|const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
6|const API = `${BACKEND_URL}/api`;
7|
8|function App() {
9|  const [resources, setResources] = useState([]);
10|  const [formData, setFormData] = useState({ url: "", login: "", password: "" });
11|  const [selectedFile, setSelectedFile] = useState(null);
12|  const [loading, setLoading] = useState(false);
13|  const [showCredentials, setShowCredentials] = useState(null);
14|
15|  // Загрузить ресурсы при загрузке
16|  useEffect(() => {
17|    fetchResources();
18|  }, []);
19|
20|  const fetchResources = async () => {
21|    try {
22|      const response = await axios.get(`${API}/resources`);
23|      setResources(response.data);
24|    } catch (error) {
25|      console.error("Ошибка загрузки ресурсов:", error);
26|    }
27|  };
28|
29|  // Добавить ресурс вручную
30|  const handleAddResource = async (e) => {
31|    e.preventDefault();
32|    if (!formData.url || !formData.login || !formData.password) {
33|      alert("Заполните все поля!");
34|      return;
35|    }
36|
37|    try {
38|      setLoading(true);
39|      await axios.post(`${API}/resources`, formData);
40|      setFormData({ url: "", login: "", password: "" });
41|      await fetchResources();
42|      alert("Ресурс добавлен!");
43|    } catch (error) {
44|      console.error("Ошибка добавления:", error);
45|      alert("Ошибка при добавлении ресурса");
46|    } finally {
47|      setLoading(false);
48|    }
49|  };
50|
51|  // Выбрать файл
52|  const handleFileSelect = (e) => {
53|    setSelectedFile(e.target.files[0]);
54|  };
55|
56|  // Загрузить из файла
57|  const handleFileUpload = async () => {
58|    if (!selectedFile) {
59|      alert("Выберите файл!");
60|      return;
61|    }
62|
63|    try {
64|      setLoading(true);
65|      const formData = new FormData();
66|      formData.append("file", selectedFile);
67|
68|      const response = await axios.post(`${API}/resources/import`, formData, {
69|        headers: { "Content-Type": "multipart/form-data" },
70|      });
71|
72|      await fetchResources();
73|      setSelectedFile(null);
74|      document.getElementById("fileInput").value = "";
75|      
76|      let message = response.data.message;
77|      if (response.data.errors && response.data.errors.length > 0) {
78|        message += "\n\nОшибки:\n" + response.data.errors.join("\n");
79|      }
80|      alert(message);
81|    } catch (error) {
82|      console.error("Ошибка загрузки файла:", error);
83|      alert("Ошибка при загрузке файла");
84|    } finally {
85|      setLoading(false);
86|    }
87|  };
88|
89|  // Переключить статус
90|  const toggleResource = async (id, currentStatus) => {
91|    try {
92|      await axios.put(`${API}/resources/${id}`, {
93|        is_active: !currentStatus,
94|      });
95|      await fetchResources();
96|    } catch (error) {
97|      console.error("Ошибка переключения:", error);
98|      alert("Ошибка при переключении статуса");
99|    }
100|  };
101|
102|  // Удалить ресурс
103|  const deleteResource = async (id) => {
104|    if (!window.confirm("Удалить ресурс?")) return;
105|
106|    try {
107|      await axios.delete(`${API}/resources/${id}`);
108|      await fetchResources();
109|    } catch (error) {
110|      console.error("Ошибка удаления:", error);
111|      alert("Ошибка при удалении ресурса");
112|    }
113|  };
114|
115|  // Подключиться к ресурсу
116|  const connectToResource = (resource) => {
117|    // Открыть сайт в новой вкладке
118|    window.open(resource.url, "_blank");
119|    // Показать модальное окно с данными
120|    setShowCredentials(resource);
121|  };
122|
123|  return (
124|    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4">
125|      <div className="max-w-6xl mx-auto">
126|        {/* Заголовок */}
127|        <div className="text-center mb-8">
128|          <h1 className="text-4xl font-bold text-gray-800 mb-2">
129|            🔐 Менеджер Ресурсов
130|          </h1>
131|          <p className="text-gray-600">Управляйте доступом к вашим ресурсам</p>
132|        </div>
133|
134|        {/* Форма добавления */}
135|        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
136|          <h2 className="text-xl font-semibold mb-4 text-gray-800">
137|            Добавить ресурс
138|          </h2>
139|          <form onSubmit={handleAddResource} className="space-y-4">
140|            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
141|              <input
142|                type="text"
143|                placeholder="URL (например: https://example.com)"
144|                value={formData.url}
145|                onChange={(e) =>
146|                  setFormData({ ...formData, url: e.target.value })
147|                }
148|                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
149|                data-testid="url-input"
150|              />
151|              <input
152|                type="text"
153|                placeholder="Логин"
154|                value={formData.login}
155|                onChange={(e) =>
156|                  setFormData({ ...formData, login: e.target.value })
157|                }
158|                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
159|                data-testid="login-input"
160|              />
161|              <input
162|                type="password"
163|                placeholder="Пароль"
164|                value={formData.password}
165|                onChange={(e) =>
166|                  setFormData({ ...formData, password: e.target.value })
167|                }
168|                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
169|                data-testid="password-input"
170|              />
171|            </div>
172|            <button
173|              type="submit"
174|              disabled={loading}
175|              className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition disabled:bg-gray-400"
176|              data-testid="add-resource-btn"
177|            >
178|              {loading ? "Добавление..." : "➕ Добавить ресурс"}
179|            </button>
180|          </form>
181|        </div>
182|
183|        {/* Загрузка файла */}
184|        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
185|          <h2 className="text-xl font-semibold mb-4 text-gray-800">
186|            Загрузить из файла
187|          </h2>
188|          <div className="flex gap-4 items-center">
189|            <div className="flex-1">
190|              <input
191|                id="fileInput"
192|                type="file"
193|                accept=".txt,.csv"
194|                onChange={handleFileSelect}
195|                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
196|                data-testid="file-input"
197|              />
198|              <p className="text-xs text-gray-500 mt-2">
199|                Формат файла: url:login:pass (каждая строка - новый ресурс)
200|              </p>
201|            </div>
202|            <button
203|              onClick={handleFileUpload}
204|              disabled={loading || !selectedFile}
205|              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:bg-gray-400"
206|              data-testid="upload-file-btn"
207|            >
208|              📤 Загрузить
209|            </button>
210|          </div>
211|        </div>
212|
213|        {/* Список ресурсов */}
214|        <div className="bg-white rounded-lg shadow-md p-6">
215|          <h2 className="text-xl font-semibold mb-4 text-gray-800">
216|            Ваши ресурсы ({resources.length})
217|          </h2>
218|          <p className="text-sm text-gray-500 mb-4">
219|            💡 <strong>Подсказка:</strong> Кликните на любую активную строку для быстрого подключения
220|          </p>
221|          {resources.length === 0 ? (
222|            <p className="text-gray-500 text-center py-8">
223|              Нет добавленных ресурсов
224|            </p>
225|          ) : (
226|            <div className="overflow-x-auto">
227|              <table className="w-full">
228|                <thead className="bg-gray-50">
229|                  <tr>
230|                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
231|                      URL
232|                    </th>
233|                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
234|                      Логин
235|                    </th>
236|                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
237|                      Статус
238|                    </th>
239|                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">
240|                      Действия
241|                    </th>
242|                  </tr>
243|                </thead>
244|                <tbody className="divide-y divide-gray-200">
245|                  {resources.map((resource) => (
246|                    <tr
247|                      key={resource.id}
248|                      onClick={() => resource.is_active && connectToResource(resource)}
249|                      className={`hover:bg-gray-50 ${resource.is_active ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}
250|                      data-testid={`resource-row-${resource.id}`}
251|                    >
252|                      <td className="px-4 py-3 text-sm text-gray-800">
253|                        {resource.url}
254|                      </td>
255|                      <td className="px-4 py-3 text-sm text-gray-800">
256|                        {resource.login}
257|                      </td>
258|                      <td className="px-4 py-3">
259|                        <span
260|                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
261|                            resource.is_active
262|                              ? "bg-green-100 text-green-800"
263|                              : "bg-gray-100 text-gray-800"
264|                          }`}
265|                        >
266|                          {resource.is_active ? "🟢 Подключен" : "⚪ Отключен"}
267|                        </span>
268|                      </td>
269|                      <td className="px-4 py-3">
270|                        <div className="flex gap-2 justify-center">
271|                          <button
272|                            onClick={(e) => {
273|                              e.stopPropagation();
274|                              toggleResource(resource.id, resource.is_active);
275|                            }}
276|                            className={`px-3 py-1 rounded-lg text-sm font-medium transition ${
277|                              resource.is_active
278|                                ? "bg-yellow-500 text-white hover:bg-yellow-600"
279|                                : "bg-green-500 text-white hover:bg-green-600"
280|                            }`}
281|                            data-testid={`toggle-btn-${resource.id}`}
282|                          >
283|                            {resource.is_active ? "Отключить" : "Включить"}
284|                          </button>
285|                          <button
286|                            onClick={(e) => {
287|                              e.stopPropagation();
288|                              connectToResource(resource);
289|                            }}
290|                            disabled={!resource.is_active}
291|                            className="px-3 py-1 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition disabled:bg-gray-300 disabled:cursor-not-allowed"
292|                            data-testid={`connect-btn-${resource.id}`}
293|                          >
294|                            🚀 Подключить
295|                          </button>
296|                          <button
297|                            onClick={(e) => {
298|                              e.stopPropagation();
299|                              deleteResource(resource.id);
300|                            }}
301|                            className="px-3 py-1 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 transition"
302|                            data-testid={`delete-btn-${resource.id}`}
303|                          >
304|                            🗑️
305|                          </button>
306|                        </div>
307|                      </td>
308|                    </tr>
309|                  ))}
310|                </tbody>
311|              </table>
312|            </div>
313|          )}
314|        </div>
315|      </div>
316|
317|      {/* Модальное окно с данными для входа */}
318|      {showCredentials && (
319|        <div
320|          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
321|          onClick={() => setShowCredentials(null)}
322|        >
323|          <div
324|            className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4"
325|            onClick={(e) => e.stopPropagation()}
326|            data-testid="credentials-modal"
327|          >
328|            <h3 className="text-xl font-bold mb-4 text-gray-800">
329|              🔑 Данные для входа
330|            </h3>
331|            <div className="space-y-3">
332|              <div>
333|                <label className="block text-sm font-medium text-gray-600 mb-1">
334|                  URL:
335|                </label>
336|                <div className="flex items-center gap-2">
337|                  <input
338|                    type="text"
339|                    value={showCredentials.url}
340|                    readOnly
341|                    className="flex-1 px-3 py-2 bg-gray-50 border border-gray-300 rounded"
342|                  />
343|                  <button
344|                    onClick={() => {
345|                      navigator.clipboard.writeText(showCredentials.url);
346|                      alert("URL скопирован!");
347|                    }}
348|                    className="px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
349|                  >
350|                    📋
351|                  </button>
352|                </div>
353|              </div>
354|              <div>
355|                <label className="block text-sm font-medium text-gray-600 mb-1">
356|                  Логин:
357|                </label>
358|                <div className="flex items-center gap-2">
359|                  <input
360|                    type="text"
361|                    value={showCredentials.login}
362|                    readOnly
363|                    className="flex-1 px-3 py-2 bg-gray-50 border border-gray-300 rounded"
364|                  />
365|                  <button
366|                    onClick={() => {
367|                      navigator.clipboard.writeText(showCredentials.login);
368|                      alert("Логин скопирован!");
369|                    }}
370|                    className="px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
371|                  >
372|                    📋
373|                  </button>
374|                </div>
375|              </div>
376|              <div>
377|                <label className="block text-sm font-medium text-gray-600 mb-1">
378|                  Пароль:
379|                </label>
380|                <div className="flex items-center gap-2">
381|                  <input
382|                    type="text"
383|                    value={showCredentials.password}
384|                    readOnly
385|                    className="flex-1 px-3 py-2 bg-gray-50 border border-gray-300 rounded"
386|                  />
387|                  <button
388|                    onClick={() => {
389|                      navigator.clipboard.writeText(showCredentials.password);
390|                      alert("Пароль скопирован!");
391|                    }}
392|                    className="px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
393|                  >
394|                    📋
395|                  </button>
396|                </div>
397|              </div>
398|            </div>
399|            <div className="mt-6 flex justify-end">
400|              <button
401|                onClick={() => setShowCredentials(null)}
402|                className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
403|              >
404|                Закрыть
405|              </button>
406|            </div>
407|          </div>
408|        </div>
409|      )}
410|    </div>
411|  );
412|}
413|
414|export default App;

===END

===FILE: /app/frontend/src/App.css
/app/frontend/src/App.css:
1|* {
2|  margin: 0;
3|  padding: 0;
4|  box-sizing: border-box;
5|}
6|
7|body {
8|  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
9|    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
10|    sans-serif;
11|  -webkit-font-smoothing: antialiased;
12|  -moz-osx-font-smoothing: grayscale;
13|}
14|
15|.App {
16|  min-height: 100vh;
17|}
18|
19|/* Анимации */
20|@keyframes fadeIn {
21|  from {
22|    opacity: 0;
23|    transform: translateY(-10px);
24|  }
25|  to {
26|    opacity: 1;
27|    transform: translateY(0);
28|  }
29|}
30|
31|.animate-fade-in {
32|  animation: fadeIn 0.3s ease-in-out;
33|}

===END

===FILE: /app/backend/requirements.txt
/app/backend/requirements.txt:
1|fastapi==0.110.1
2|uvicorn==0.25.0
3|boto3>=1.34.129
4|requests-oauthlib>=2.0.0
5|cryptography>=42.0.8
6|python-dotenv>=1.0.1
7|pymongo==4.5.0
8|pydantic>=2.6.4
9|email-validator>=2.2.0
10|pyjwt>=2.10.1
11|bcrypt==4.1.3
12|passlib>=1.7.4
13|tzdata>=2024.2
14|motor==3.3.1
15|pytest>=8.0.0
16|black>=24.1.1
17|isort>=5.13.2
18|flake8>=7.0.0
19|mypy>=1.8.0
20|python-jose>=3.3.0
21|requests>=2.31.0
22|pandas>=2.2.0
23|numpy>=1.26.0
24|python-multipart>=0.0.9
25|jq>=1.6.0
26|typer>=0.9.0
27|

===END

===FILE: /app/frontend/package.json
/app/frontend/package.json:
1|{
2|  "name": "frontend",
3|  "version": "0.1.0",
4|  "private": true,
5|  "dependencies": {
6|    "@hookform/resolvers": "^5.0.1",
7|    "@radix-ui/react-accordion": "^1.2.8",
8|    "@radix-ui/react-alert-dialog": "^1.1.11",
9|    "@radix-ui/react-aspect-ratio": "^1.1.4",
10|    "@radix-ui/react-avatar": "^1.1.7",
11|    "@radix-ui/react-checkbox": "^1.2.3",
12|    "@radix-ui/react-collapsible": "^1.1.8",
13|    "@radix-ui/react-context-menu": "^2.2.12",
14|    "@radix-ui/react-dialog": "^1.1.11",
15|    "@radix-ui/react-dropdown-menu": "^2.1.12",
16|    "@radix-ui/react-hover-card": "^1.1.11",
17|    "@radix-ui/react-label": "^2.1.4",
18|    "@radix-ui/react-menubar": "^1.1.12",
19|    "@radix-ui/react-navigation-menu": "^1.2.10",
20|    "@radix-ui/react-popover": "^1.1.11",
21|    "@radix-ui/react-progress": "^1.1.4",
22|    "@radix-ui/react-radio-group": "^1.3.4",
23|    "@radix-ui/react-scroll-area": "^1.2.6",
24|    "@radix-ui/react-select": "^2.2.2",
25|    "@radix-ui/react-separator": "^1.1.4",
26|    "@radix-ui/react-slider": "^1.3.2",
27|    "@radix-ui/react-slot": "^1.2.0",
28|    "@radix-ui/react-switch": "^1.2.2",
29|    "@radix-ui/react-tabs": "^1.1.9",
30|    "@radix-ui/react-toast": "^1.2.11",
31|    "@radix-ui/react-toggle": "^1.1.6",
32|    "@radix-ui/react-toggle-group": "^1.1.7",
33|    "@radix-ui/react-tooltip": "^1.2.4",
34|    "axios": "^1.8.4",
35|    "class-variance-authority": "^0.7.1",
36|    "clsx": "^2.1.1",
37|    "cmdk": "^1.1.1",
38|    "cra-template": "1.2.0",
39|    "date-fns": "^4.1.0",
40|    "embla-carousel-react": "^8.6.0",
41|    "input-otp": "^1.4.2",
42|    "lucide-react": "^0.507.0",
43|    "next-themes": "^0.4.6",
44|    "react": "^19.0.0",
45|    "react-day-picker": "8.10.1",
46|    "react-dom": "^19.0.0",
47|    "react-hook-form": "^7.56.2",
48|    "react-resizable-panels": "^3.0.1",
49|    "react-router-dom": "^7.5.1",
50|    "react-scripts": "5.0.1",
51|    "sonner": "^2.0.3",
52|    "tailwind-merge": "^3.2.0",
53|    "tailwindcss-animate": "^1.0.7",
54|    "vaul": "^1.1.2",
55|    "zod": "^3.24.4"
56|  },
57|  "scripts": {
58|    "start": "craco start",
59|    "build": "craco build",
60|    "test": "craco test"
61|  },
62|  "browserslist": {
63|    "production": [
64|      ">0.2%",
65|      "not dead",
66|      "not op_mini all"
67|    ],
68|    "development": [
69|      "last 1 chrome version",
70|      "last 1 firefox version",
71|      "last 1 safari version"
72|    ]
73|  },
74|  "devDependencies": {
75|    "@babel/plugin-proposal-private-property-in-object": "^7.21.11",
76|    "@craco/craco": "^7.1.0",
77|    "@eslint/js": "9.23.0",
78|    "autoprefixer": "^10.4.20",
79|    "eslint": "9.23.0",
80|    "eslint-plugin-import": "2.31.0",
81|    "eslint-plugin-jsx-a11y": "6.10.2",
82|    "eslint-plugin-react": "7.37.4",
83|    "globals": "15.15.0",
84|    "postcss": "^8.4.49",
85|    "tailwindcss": "^3.4.17"
86|  },
87|  "packageManager": "yarn@1.22.22+sha512.a6b2f7906b721bba3d67d4aff083df04dad64c399707841b7acf00f6b133b7ac24255f2652fa22ae3534329dc6180534e98d17432037ff6fd140556e2bb3137e"
88|}
89|

===END

===FILE: /app/README.md
/app/README.md:
1|# 🔐 Менеджер Ресурсов
2|
3|Приложение для управления доступом к вашим онлайн-ресурсам.
4|
5|## 🚀 Возможности
6|
7|- ✅ Добавление ресурсов вручную (URL, логин, пароль)
8|- ✅ Загрузка ресурсов из файла
9|- ✅ Быстрое подключение к ресурсам (клик по строке)
10|- ✅ Включение/отключение ресурсов
11|- ✅ Автоматическое открытие сайта + показ данных для входа
12|- ✅ Копирование данных в один клик
13|
14|## 📝 Формат файла для импорта
15|
16|Формат: `url:login:password`
17|
18|Каждая строка = один ресурс
19|
20|### Пример файла (`example_resources.txt`):
21|```
22|https://example.com:mylogin:mypassword
23|https://github.com:developer:SecurePass123
24|https://mail.google.com:user@email.com:Gmail2024!
25|```
26|
27|## 🎯 Как использовать
28|
29|1. **Добавить ресурс вручную:**
30|   - Введите URL, логин и пароль в форму
31|   - Нажмите "Добавить ресурс"
32|
33|2. **Загрузить из файла:**
34|   - Создайте текстовый файл в формате `url:login:password`
35|   - Нажмите кнопку "Выбрать файл"
36|   - Нажмите "Загрузить"
37|
38|3. **Подключиться к ресурсу:**
39|   - **Быстрый способ:** Просто кликните на любую активную строку в таблице
40|   - **Через кнопку:** Нажмите кнопку "🚀 Подключить"
41|   - Сайт откроется в новой вкладке
42|   - Появится модальное окно с данными для входа
43|   - Можно скопировать данные кнопкой 📋
44|
45|4. **Включить/Отключить ресурс:**
46|   - Нажмите кнопку "Включить" или "Отключить"
47|   - Отключенные ресурсы неактивны (затемнены)
48|
49|5. **Удалить ресурс:**
50|   - Нажмите кнопку 🗑️
51|
52|## 🛠 Технологии
53|
54|- **Backend:** FastAPI + MongoDB
55|- **Frontend:** React + Tailwind CSS
56|- **База данных:** MongoDB
57|
58|## 📦 Установка и запуск
59|
60|Все сервисы уже запущены автоматически через supervisor!
61|
62|Проверить статус:
63|```bash
64|sudo supervisorctl status
65|```
66|
67|Перезапустить сервисы:
68|```bash
69|sudo supervisorctl restart all
70|```
71|
72|## 🔒 Безопасность
73|
74|⚠️ **Важно:** Пароли хранятся в открытом виде в базе данных. Используйте это приложение только в безопасной среде.
75|

===END

===FILE: /app/example_resources.txt
/app/example_resources.txt:
1|https://example.com:mylogin:mypassword
2|https://github.com:developer:SecurePass123
3|https://mail.google.com:user@email.com:Gmail2024!

===END