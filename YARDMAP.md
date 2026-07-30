# Tarter Yard Map — guía de instalación y uso

Mapa dinámico de la yarda con búsqueda de productos, reportes desde el celular,
escáner de código de barras y sincronización en vivo entre dispositivos.

- **App:** `index.html` → se publica en `https://TU-SITIO.netlify.app/`
- **Nota:** el dashboard de producción anterior se reemplaza; queda en el historial de git (commit `e1cb558`) por si lo necesitas.

---

## 1. Publicar en Netlify

1. En Netlify: **Add new site → Import an existing project → GitHub →
   `jonaclark19-ux/tarter-dashboard`**.
2. Rama a desplegar: la que tenga estos cambios (o `main` después de mezclarla).
3. Netlify lee `netlify.toml`, así que **no cambies** nada en la pantalla de build:
   - Publish directory: `.`
   - Functions directory: `netlify/functions`
   - Build command: vacío
4. Deploy.

## 2. Configurar las cuentas (obligatorio)

**Site configuration → Environment variables → Add a variable.** Crea estas tres:

| Variable | Qué es | Ejemplo |
|---|---|---|
| `EDITOR_CODE` | Código que da acceso **completo** de edición | `TarterEdit2026!` |
| `VIEWER_CODE` | Código que solo permite **crear reportes** | `Yarda2026` |
| `SESSION_SECRET` | Texto largo aleatorio para firmar las sesiones | genera uno con el comando de abajo |

Para generar el secreto:

```bash
openssl rand -base64 48
```

Después de guardarlas, haz **Deploys → Trigger deploy → Clear cache and deploy site**
(las variables solo entran en vigor con un deploy nuevo).

> No hay cuentas de usuario individuales: hay **dos códigos**. Cada persona escribe
> su nombre (para saber quién reportó qué) y el código que le corresponde. La sesión
> queda guardada 30 días en ese teléfono.

### Qué puede hacer cada rol

| Acción | Viewer | Editor |
|---|:--:|:--:|
| Buscar productos, ver el mapa | ✅ | ✅ |
| Escanear códigos de barras | ✅ | ✅ |
| Crear reportes (vacío, dañado, queda poco, encontrado fuera de lugar, código desconocido) | ✅ | ✅ |
| Marcar reportes como resueltos | ❌ | ✅ |
| Mover/agregar/borrar productos, editar el mapa, grupos, zonas MTO, importar/exportar | ❌ | ✅ |

## 3. Almacenamiento y sincronización

- Los datos viven en **Netlify Blobs** (incluido en el plan gratuito, sin base de datos externa):
  - `state.json` → el mapa completo (productos, fondo, grupos, zonas MTO)
  - `alerts.json` → los reportes
- **Ya no necesitas subir un HTML o un JSON cada vez que editas.** Un editor mueve un
  producto y a los ~8 segundos todos los demás dispositivos ven el cambio.
- Las alertas creadas desde cualquier celular aparecen en todos los demás igual de rápido.
- Si dos editores guardan al mismo tiempo, el segundo recibe la versión del primero y el
  aviso *"Otra persona editó el mapa"* — nadie pisa el trabajo del otro en silencio.
- **Primer arranque:** el servidor empieza vacío. El primer editor que entre sube
  automáticamente `assets/default-map.json` (tu layout actual) como punto de partida.

### Respaldos

`Menú → Exportar` descarga un JSON completo. Guárdalo antes de cambios grandes;
`Menú → Importar` lo restaura.

---

## 3.1 Foto del producto

Cada ficha puede tener una foto de referencia:

- **Al tocar una ficha en el mapa** (modo vista, no edición), el reporte del producto
  ahora muestra su foto arriba si tiene una guardada.
- Un **editor** ve un botón 🖼️ para poner/cambiar/quitar la foto (se pega una URL de
  imagen; dejarlo vacío la quita).
- Esa misma foto aparece también cuando alguien **reconoce el SKU** en el flujo de
  "Encontré un producto" (escaneo o SKU escrito a mano), para confirmar visualmente
  que es el producto correcto antes de mandar el reporte.
- Útil sobre todo para productos que se confunden fácil entre sí (p. ej. `HF20BL`
  contra `HF30BL`, `BP20BL`, etc.): con la foto puesta, cualquiera puede verificar
  el producto sin tener que memorizar el código.
- **En los resultados de búsqueda** cada producto tiene un ícono 📷/🖼️ que abre una
  ventana grande con su foto (o el botón para ponerla, si eres editor). Sirve para
  confirmar visualmente el producto antes de ir a buscarlo en la yarda.
- El campo acepta cualquier URL de imagen normal, **o un enlace `data:image/...;base64,…`**
  (por ejemplo, copiado desde una imagen ya confirmada en una búsqueda de Google
  Imágenes) — ambos funcionan igual.

### Cómo llenar las fotos rápido

En la ventana de la foto, un editor tiene el botón **🔍 Buscar imagen**: abre en otra
pestaña una búsqueda de Google Imágenes con `SKU + TARTER` ya escrita. El flujo es:

1. **🔍 Buscar imagen** → se abre la búsqueda de ese SKU.
2. Ubicas el producto correcto, tocas la imagen y **copias la dirección de la imagen**.
3. Vuelves y tocas **Poner foto** → pegas.

> **Ojo con el peso:** una URL normal no ocupa nada, pero una imagen pegada en
> `base64` se guarda completa dentro de `state.json` (~100–200 KB cada una). Para unos
> pocos productos no hay problema; si le pones base64 a decenas de productos, el mapa
> se vuelve pesado y **todos los celulares lo descargan en cada sincronización**.
> Para grupos grandes, usa URLs.

## 4. Cómo funciona el reporte (lógica nueva)

La opción vieja de *"mal ubicado"* se eliminó: no tenía sentido, porque si estabas
tocando la ficha del producto ya estabas diciendo que estaba en su lugar. Ahora hay
dos caminos distintos:

### A) Toco una ficha del mapa → "algo pasa con este producto aquí"

| Opción | Cuándo usarla |
|---|---|
| **Espacio vacío** | El producto debería estar aquí y no hay nada |
| **Producto dañado / incompleto** | Sí está, pero no se puede vender |
| **Queda poco** | Todavía hay, pero muy poco |
| **Encontré otro producto aquí** | Hay algo en ese lugar que no corresponde → salta al flujo B con el lugar ya marcado |

### B) Encontré un producto suelto → "aquí encontré esto"

Tres formas de entrar:

- **Mantén presionado** cualquier punto del mapa (≈½ segundo)
- Botón **📍 Reportar** en la barra superior
- Botón **📷 Escanear** en la barra superior

Después:

1. **Escanea el código de barras** con la cámara, o escribe el SKU a mano
   (el campo autocompleta con todos los SKU del sistema).
2. La app te dice al instante:
   - ✅ **Lo reconoce** → te muestra su lugar asignado y un botón *Ver en el mapa*.
   - ⚠️ **No lo reconoce** → *"Este código no está en el sistema"*. Un **viewer** lo
     reporta como **código desconocido** para que un editor lo dé de alta; un **editor**
     ve además el botón **"Crear este producto aquí"**, que crea la ficha en ese punto.
3. **Marca el lugar** en el mapa (📍 Marcar el lugar en el mapa → tocas el punto → Confirmar).
4. Nota opcional y **Enviar reporte**.

El reporte queda como un **pin amarillo en el mapa exactamente donde lo encontraste**
(azul si el código es desconocido), y en el panel 🔔 con quién lo reportó y cuándo. Si
marcas el mismo lugar que su spot asignado, la app te avisa que no hay nada que reportar.

### Escáner de códigos de barras

- Usa la API nativa `BarcodeDetector` en Chrome/Android; en iPhone y Firefox carga
  **ZXing** automáticamente. Formatos: EAN-13/8, UPC-A/E, Code 128/39/93, ITF, Codabar, QR.
- Exige leer el mismo código **dos veces seguidas** antes de aceptarlo, para que un
  reflejo o un enfoque malo no genere un reporte equivocado.
- Si el código trae dígitos extra de empaque (ceros a la izquierda, dígito verificador,
  prefijo de país), la app prueba esas variantes antes de declararlo desconocido.
- **La cámara solo funciona por HTTPS** — o sea, en el sitio de Netlify. Si abres el
  archivo con doble clic desde tu computadora, el escáner no arranca (te lo dice) y
  puedes escribir el SKU a mano.

---

## 5. Idiomas

Español e inglés completos. Al abrir por primera vez detecta el idioma del teléfono; a
partir de ahí recuerda el que elijas. Se cambia en:

- **Celular:** ☰ Menú → Idioma
- **Computadora:** las pastillas `EN / ES` en la barra superior (o el menú)
- **Pantalla de login:** las pastillas de abajo

---

## 6. Modo local (sin servidor)

Si abres `index.html` sin Netlify (doble clic, o un servidor sin funciones), la app
detecta que no hay API y ofrece **"Continuar sin conexión"**: funciona todo con permisos
de editor, pero guardando solo en ese dispositivo (`localStorage`). Útil para probar.

Si estás en Netlify y ves esta pantalla, casi siempre significa que falta configurar
`SESSION_SECRET` o que no se hizo un deploy después de agregar las variables.

---

## 7. Estructura de archivos

```
index.html                   marcado de la app
assets/yardmap.css           estilos (incluye el diseño responsive para celular)
assets/i18n.js               diccionario EN/ES y el motor de traducción
assets/sync.js               login, guardado, polling y cola de reportes offline
assets/scan.js               escáner de código de barras (BarcodeDetector + ZXing)
assets/app.js                motor del mapa, alertas, flujo de reportes
assets/default-map.json      layout de la yarda que se usa como semilla
netlify/functions/api.mjs    API: /api/login, /api/me, /api/state, /api/alerts, /api/sync
netlify.toml                 configuración de publicación y cabeceras
package.json                 dependencia @netlify/blobs para la función
```

## 8. Endpoints de la API

| Método | Ruta | Rol | Qué hace |
|---|---|---|---|
| POST | `/api/login` | — | Valida el código y crea la cookie de sesión |
| POST | `/api/logout` | — | Cierra la sesión |
| GET | `/api/me` | cualquiera | Devuelve rol y nombre |
| GET | `/api/state` | cualquiera | Descarga el mapa |
| PUT | `/api/state` | editor | Guarda el mapa (409 si alguien guardó antes) |
| GET | `/api/alerts` | cualquiera | Lista los reportes |
| POST | `/api/alerts` | cualquiera | Crea un reporte |
| PATCH | `/api/alerts` | editor | Resuelve o elimina un reporte |
| GET | `/api/sync?srev=&arev=` | cualquiera | Devuelve solo lo que cambió (lo usa el polling) |

La cookie de sesión es `HttpOnly`, `Secure`, `SameSite=Lax` y va firmada con HMAC-SHA256.
El servidor ignora los campos `by`, `role` y `status` que mande el cliente en un reporte:
los rellena él con los datos de la sesión.

---

## 9. Problemas comunes

| Síntoma | Causa / solución |
|---|---|
| Sale la pantalla de "modo local" en Netlify | Falta `SESSION_SECRET` o no se redesplegó tras crear las variables |
| "Ese código de acceso no es válido" | `EDITOR_CODE` / `VIEWER_CODE` mal escritos, o falta redeploy |
| El escáner no abre la cámara | Tiene que ser HTTPS y hay que dar permiso de cámara al navegador |
| Los cambios no llegan a otro teléfono | Ese usuario entró con código de viewer, o el otro dispositivo está sin internet (se sincroniza solo al volver) |
| El mapa aparece vacío la primera vez | Entra una vez con el código de **editor**: el layout inicial se sube automáticamente |
| Los reportes se quedan "por enviar" | Sin señal en la yarda: se guardan en el teléfono y se mandan solos al recuperar internet |
