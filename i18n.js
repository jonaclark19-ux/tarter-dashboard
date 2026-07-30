/* ============================================================
   TARTER YARD MAP — i18n (English / Español)
   ------------------------------------------------------------
   Usage:
     t("key")                    -> translated string
     t("key", {n: 3})            -> with {n} placeholders
     applyI18n(root)             -> translates [data-i18n*] nodes
     setLang("es")               -> switch + persist + re-render
   ============================================================ */
(function (global) {
  "use strict";

  const STRINGS = {
    en: {
      /* ---- shell / brand ---- */
      "app.title": "Yard Product Locator",
      "app.sub": "Tarter West · Free-placement yard map",
      "app.north": "NORTH",

      /* ---- login ---- */
      "login.title": "Tarter Yard Map",
      "login.sub": "Sign in to continue",
      "login.name": "Your name",
      "login.namePh": "e.g. Jonathan C.",
      "login.password": "Access code",
      "login.passwordPh": "Viewer or editor code",
      "login.submit": "Sign in",
      "login.working": "Signing in…",
      "login.badPassword": "That access code is not valid.",
      "login.needName": "Please enter your name.",
      "login.offline": "Could not reach the server. Working in local mode.",
      "login.roleHint": "The code you enter decides what you can do: viewers report issues, editors can also edit the map.",
      "login.localMode": "Local mode — no server detected. Changes stay on this device only.",
      "login.continueLocal": "Continue offline",

      /* ---- roles / session ---- */
      "role.viewer": "Viewer",
      "role.editor": "Editor",
      "role.local": "Local",
      "session.signedInAs": "Signed in as {name} · {role}",
      "session.signOut": "Sign out",
      "session.signedOut": "Signed out.",
      "session.expired": "Your session expired. Please sign in again.",
      "session.noPermission": "Your account cannot do that. Ask an editor.",

      /* ---- search ---- */
      "search.placeholder": "Search a product… (WT214, 6EBR12, RC205BL)",
      "search.clear": "Clear",
      "search.matches": "{n} match found",
      "search.matches_plural": "{n} matches found",
      "search.none": "No product matches “{q}”.",
      "search.noneHintEditor": "Turn on Edit → Add to place it on the map.",
      "search.noneHintViewer": "Use Report to tell an editor about it.",
      "search.mtoLoc": "Possibly in · {zone} (MTO)",
      "search.mtoToast": "{sku} — possibly in “{zone}” (MTO area, variable location)",

      /* ---- toolbar ---- */
      "tool.alerts": "Alerts",
      "tool.alertsTitle": "View reports",
      "tool.scan": "Scan",
      "tool.scanTitle": "Scan a barcode with the camera",
      "tool.report": "Report",
      "tool.reportTitle": "Report a product you found",
      "tool.edit": "Edit Products",
      "tool.editTitle": "Edit mode: move freely, multi-select, add, rename, delete",
      "tool.add": "Add",
      "tool.addTitle": "Add a product tile",
      "tool.editMap": "Edit Map",
      "tool.editMapTitle": "Edit the background: move/resize structures, draw shapes, edit labels",
      "tool.snap": "Snap 12px",
      "tool.snapTitle": "Snap to grid: positions and sizes jump in 12px steps so rows line up",
      "tool.legend": "Legend",
      "tool.legendTitle": "Show colour legend",
      "tool.export": "Export",
      "tool.exportTitle": "Download data as JSON",
      "tool.import": "Import",
      "tool.importTitle": "Load data from JSON",
      "tool.excel": "Import Excel",
      "tool.excelTitle": "Import products from Excel/CSV in bulk",
      "tool.mto": "MTO Zones",
      "tool.mtoTitle": "Flexible areas (MTO / specials): a list of products with no fixed spot",
      "tool.reset": "Reset",
      "tool.resetTitle": "Restore original layout",
      "tool.menu": "Menu",
      "tool.language": "Language",
      "tool.close": "Close",
      "tool.cancel": "Cancel",
      "tool.save": "Save",
      "tool.confirm": "Confirm",
      "tool.back": "Back",
      "tool.done": "Done",

      /* ---- hints ---- */
      "hint.view": "<b>Drag</b> to pan · <b>Scroll / pinch</b> to zoom · <b>Hold</b> on the map to report a product you found there",
      "hint.editBadge": "EDIT MODE · drag to move · drag empty space to box-select",
      "hint.bgbar": "Tap a shape to select · handles resize · top knob rotates · Properties changes shape, fill & border",

      /* ---- legend / groups ---- */
      "legend.title": "Product groups",
      "legend.new": "+ New",
      "legend.newTitle": "Create a new group",
      "legend.empty": "No groups yet.",
      "legend.assign": "Move the selected products into this group",
      "legend.rename": "Rename group",
      "legend.delete": "Delete group",
      "group.newPrompt": "Name of the new group:",
      "group.created": "Group “{name}” created — select products and press ⤓ to move them in",
      "group.renamePrompt": "Rename group:",
      "group.renamed": "Renamed to {name}",
      "group.needOne": "You need at least one group",
      "group.deleteConfirm": "Delete group “{name}”?",
      "group.deleteMoves": "Its {n} product(s) will move to “{to}” — nothing is erased from the map.",
      "group.deleted": "Group deleted",
      "group.deletedMoved": "Group deleted — {n} product(s) moved to {to}",
      "group.selected": "{name} — {n} selected",
      "group.emptyGroup": "That group has no products yet",
      "group.selectFirst": "Select products first (Edit mode → drag a box around them)",
      "group.moved": "{n} product(s) moved to {to}",

      /* ---- tiles / editing ---- */
      "tile.changeColor": "Change colour",
      "tile.editSku": "Edit SKU",
      "tile.resize": "Drag to resize",
      "tile.remove": "Remove",
      "tile.renamePrompt": "Edit the product SKU:",
      "tile.skuEmpty": "The SKU cannot be empty",
      "tile.skuSet": "SKU → {sku}",
      "tile.skuDup": " (heads up: another one already exists)",
      "tile.removed": "Removed {sku}",
      "tile.removedN": "Removed {n} products",
      "tile.moved": "Moved {sku}",
      "tile.movedN": "Moved {n} products",
      "tile.resized": "Resized {sku} → {w}×{h}",
      "tile.resizedN": "Resized {n} products → {w}×{h}",
      "tile.aligned": "Aligned {n} products",
      "tile.unified": "Unified size → {w}×{h}",
      "tile.selected": "{n} selected",
      "tile.addPrompt": "New product number:",
      "tile.added": "Added {sku} — drag it to its spot",
      "tile.setImageBtn": "Set product photo",
      "tile.changeImageBtn": "Change photo",
      "tile.viewImage": "View product photo",
      "tile.noImage": "No photo yet for this product.",
      "tile.imagePrompt": "Photo URL for this product (leave empty to remove):",
      "tile.imageSet": "Photo updated",
      "tile.imageRemoved": "Photo removed",
      "edit.on": "Edit mode on — drag freely. Unselect to pan.",
      "edit.off": "Edit mode off — viewing only",
      "edit.selectOne": "Select exactly 1 product to edit its SKU",

      /* ---- selection toolbar ---- */
      "sel.count": "sel",
      "sel.alignLeft": "Align left",
      "sel.alignCx": "Align centre (horizontal)",
      "sel.alignRight": "Align right",
      "sel.alignTop": "Align top",
      "sel.alignCy": "Align middle (vertical)",
      "sel.alignBottom": "Align bottom",
      "sel.rowh": "Lay out in a row",
      "sel.colv": "Lay out in a column",
      "sel.same": "Make all the same size",
      "sel.color": "Colour all selected",
      "sel.rename": "Edit the SKU (select 1 product)",
      "sel.report": "Report an issue with this product",

      /* ---- background editor ---- */
      "bg.select": "Select",
      "bg.rect": "Rectangle",
      "bg.ellipse": "Ellipse / circle",
      "bg.diamond": "Diamond",
      "bg.triangle": "Triangle",
      "bg.line": "Line",
      "bg.label": "Text label",
      "bg.door": "Door",
      "bg.props": "⚙ Properties",
      "bg.delete": "🗑 Delete",
      "bg.reset": "↺ Reset bg",
      "bg.on": "Background edit on — select to move/resize, tools to draw",
      "bg.off": "Background edit off",
      "bg.deleted": "Deleted background item",
      "bg.selectFirst": "Select a background item first",
      "bg.resetConfirm": "Reset the background to the original yard layout? Your background edits will be lost.",
      "bg.wasReset": "Background reset",
      "bg.labelPrompt": "Label text:",
      "bg.doorPrompt": "Door label (e.g. #5):",
      "bg.front": "Brought to front",
      "bg.back": "Sent to back",
      "bg.flexCount": "{n} products · variable area (MTO)",

      /* ---- inspector ---- */
      "insp.shape": "Shape",
      "insp.empty": "Tap any shape on the map to edit it.<br>Or pick a shape tool above and draw a new one.",
      "insp.fill": "Fill",
      "insp.border": "Border",
      "insp.style": "Style",
      "insp.corner": "Corner",
      "insp.rotate": "Rotate",
      "insp.size": "Size",
      "insp.text": "Text",
      "insp.textSize": "Text sz",
      "insp.labelPh": "Label…",
      "insp.duplicate": "⧉ Duplicate",
      "insp.toFront": "↑ Front",
      "insp.toBack": "↓ Back",
      "insp.delete": "🗑 Delete",

      /* ---- report flow (new logic) ---- */
      "report.title": "Report",
      "report.forSku": "Report: {sku}",
      "report.chooseWhat": "What do you want to report?",
      "report.empty": "Empty spot — it is not here",
      "report.emptyDesc": "The product should be at this spot but there is nothing.",
      "report.damaged": "Damaged / incomplete product",
      "report.damagedDesc": "It is here, but it is not in sellable condition.",
      "report.foundHere": "I found another product here",
      "report.foundHereDesc": "Something is sitting in this spot that does not belong.",
      "report.lowStock": "Running low",
      "report.lowStockDesc": "There is still some, but very little left.",

      "found.title": "I found a product here",
      "found.step1": "1 · Which product is it?",
      "found.step2": "2 · Confirm the spot",
      "found.scanBtn": "📷 Scan barcode",
      "found.manualLabel": "Or type the SKU",
      "found.manualPh": "e.g. WT214",
      "found.pickOnMap": "📍 Pick the spot on the map",
      "found.pinSet": "Spot marked on the map",
      "found.pinHint": "Tap the map where you found it, then confirm.",
      "found.expected": "Assigned spot: {loc}",
      "found.expectedUnknown": "This SKU has no assigned spot on the map yet.",
      "found.notInSystem": "This code is not in the system",
      "found.notInSystemDesc": "It is not on the map or in any MTO list. Report it so an editor can add it and give it a spot.",
      "found.reportUnknown": "Report unknown code",
      "found.createHere": "Create this product here",
      "found.note": "Note (optional)",
      "found.notePh": "e.g. mixed in with the 6EG row",
      "found.submit": "Send report",
      "found.needSku": "Enter or scan a SKU first.",
      "found.needSpot": "Mark the spot on the map first.",
      "found.sameSpot": "That is already its assigned spot — nothing to report.",

      "report.sent": "Report sent",
      "report.sentN": "{n} reports sent",
      "report.failed": "Could not send the report — it was saved on this device and will retry.",
      "longpress.hint": "Hold your finger on the map to report a product you found there",

      /* ---- alerts panel ---- */
      "alerts.title": "Active reports",
      "alerts.none": "No reported issues.<br>All good in the yard. ✅",
      "alerts.resolve": "Mark resolved ✔️",
      "alerts.resolved": "Report resolved",
      "alerts.by": "by {name}",
      "alerts.at": "on {date}",
      "alerts.goto": "Show on map",
      "alerts.filterAll": "All",
      "alerts.filterOpen": "Open",
      "alerts.filterDone": "Resolved",
      "alerts.type.empty": "EMPTY SPOT",
      "alerts.type.damaged": "DAMAGED",
      "alerts.type.found": "FOUND OUT OF PLACE",
      "alerts.type.unknown": "UNKNOWN CODE",
      "alerts.type.low": "RUNNING LOW",
      "alerts.foundMsg": "{sku} found away from its spot",
      "alerts.foundMsgNoHome": "{sku} found in the yard — no assigned spot yet",
      "alerts.unknownMsg": "Code {sku} is not in the SKU list",
      "alerts.assignSpot": "Give it a spot",
      "alerts.newCount": "{n} new report(s)",

      /* ---- scanner ---- */
      "scan.title": "Scan barcode",
      "scan.hint": "Point the camera at the product barcode.",
      "scan.starting": "Starting camera…",
      "scan.denied": "Camera access was denied. Enable it in your browser settings, or type the SKU manually.",
      "scan.noCamera": "No camera available on this device. Type the SKU manually.",
      "scan.insecure": "The camera only works over HTTPS. Open the published site instead of a local file.",
      "scan.manual": "Type it manually",
      "scan.switch": "Flip camera",
      "scan.torch": "Torch",
      "scan.detected": "Code detected: {code}",
      "scan.searching": "Looking it up…",
      "scan.foundSku": "{sku} — {loc}",
      "scan.unknown": "Code {code} is not in the system",
      "scan.retry": "Scan again",
      "scan.useThis": "Use this code",

      /* ---- MTO ---- */
      "mto.title": "Flexible zones",
      "mto.titleAccent": "MTO / Specials",
      "mto.new": "+ New MTO zone",
      "mto.empty": "No MTO zones yet.<br>Create one with “+ New MTO zone” and paste your product list.<br><br>Products in an MTO zone do not get their own tile: searching for them highlights the area.",
      "mto.namePh": "Zone name",
      "mto.skuCount": "{n} SKUs",
      "mto.skusPh": "One product per line…",
      "mto.importExcel": "⬆ Import Excel",
      "mto.viewOnMap": "🎯 Show on map",
      "mto.deleteZone": "🗑 Delete zone",
      "mto.deleteConfirm": "Delete this MTO zone and its list?",
      "mto.newPrompt": "Name of the new MTO zone:",
      "mto.created": "MTO zone created — paste your product list. Move/resize it with “Edit Map”.",
      "mto.added": "{n} products added to “{zone}”",
      "mto.noProducts": "No products found in the file",

      /* ---- import / export ---- */
      "io.downloaded": "Downloaded tarter-yard-map.json",
      "io.imported": "Data imported",
      "io.importFailed": "That file could not be read as yard data",
      "io.xlsMissing": "The Excel reader did not load — check your internet connection and try again",
      "io.xlsNoColumn": "No “Product” column with data was found — use the template",
      "io.xlsUnreadable": "Could not read the file (is it a valid .xlsx or .csv?)",
      "io.xlsImported": "{n} products imported — drag them to their spot",
      "io.xlsSkipped": " ({n} empty rows skipped)",
      "io.resetConfirm": "Restore the original layout and product positions? Your changes will be lost (export first for a backup).",
      "io.wasReset": "Restored original layout",

      /* ---- sync ---- */
      "sync.saving": "Saving…",
      "sync.saved": "Saved for everyone",
      "sync.savedLocal": "Saved on this device",
      "sync.offline": "No connection — saved locally, will sync when back online",
      "sync.conflict": "Someone else edited the map. Reloading the latest version…",
      "sync.updated": "Map updated by another user",
      "sync.newAlerts": "{n} new report(s) from another device",
      "sync.localBanner": "Local mode — changes stay on this device",
      "sync.readonly": "Read-only: you are signed in as a viewer",

      "snap.on": "Snap to grid ON",
      "snap.off": "Snap to grid OFF",
    },

    es: {
      /* ---- shell / brand ---- */
      "app.title": "Localizador de Productos",
      "app.sub": "Tarter West · Mapa libre de la yarda",
      "app.north": "NORTE",

      /* ---- login ---- */
      "login.title": "Mapa de Yarda Tarter",
      "login.sub": "Inicia sesión para continuar",
      "login.name": "Tu nombre",
      "login.namePh": "ej. Jonathan C.",
      "login.password": "Código de acceso",
      "login.passwordPh": "Código de viewer o editor",
      "login.submit": "Entrar",
      "login.working": "Entrando…",
      "login.badPassword": "Ese código de acceso no es válido.",
      "login.needName": "Por favor escribe tu nombre.",
      "login.offline": "No se pudo contactar el servidor. Trabajando en modo local.",
      "login.roleHint": "El código que escribas define lo que puedes hacer: los viewers reportan problemas, los editores además editan el mapa.",
      "login.localMode": "Modo local — no se detectó servidor. Los cambios quedan solo en este dispositivo.",
      "login.continueLocal": "Continuar sin conexión",

      /* ---- roles / session ---- */
      "role.viewer": "Viewer",
      "role.editor": "Editor",
      "role.local": "Local",
      "session.signedInAs": "Conectado como {name} · {role}",
      "session.signOut": "Cerrar sesión",
      "session.signedOut": "Sesión cerrada.",
      "session.expired": "Tu sesión expiró. Inicia sesión de nuevo.",
      "session.noPermission": "Tu cuenta no puede hacer eso. Pídeselo a un editor.",

      /* ---- search ---- */
      "search.placeholder": "Busca un producto… (WT214, 6EBR12, RC205BL)",
      "search.clear": "Limpiar",
      "search.matches": "{n} resultado",
      "search.matches_plural": "{n} resultados",
      "search.none": "Ningún producto coincide con “{q}”.",
      "search.noneHintEditor": "Activa Editar → Agregar para colocarlo en el mapa.",
      "search.noneHintViewer": "Usa Reportar para avisarle a un editor.",
      "search.mtoLoc": "Posiblemente en · {zone} (MTO)",
      "search.mtoToast": "{sku} — posiblemente en “{zone}” (área MTO, ubicación variable)",

      /* ---- toolbar ---- */
      "tool.alerts": "Alertas",
      "tool.alertsTitle": "Ver reportes",
      "tool.scan": "Escanear",
      "tool.scanTitle": "Escanear un código de barras con la cámara",
      "tool.report": "Reportar",
      "tool.reportTitle": "Reportar un producto que encontraste",
      "tool.edit": "Editar Productos",
      "tool.editTitle": "Modo edición: mover libremente, multi-selección, agregar, renombrar, borrar",
      "tool.add": "Agregar",
      "tool.addTitle": "Agregar una ficha de producto",
      "tool.editMap": "Editar Mapa",
      "tool.editMapTitle": "Editar el fondo: mover/redimensionar estructuras, dibujar formas, editar etiquetas",
      "tool.snap": "Rejilla 12px",
      "tool.snapTitle": "Ajustar a la rejilla: posiciones y tamaños saltan de 12 en 12 px para alinear filas",
      "tool.legend": "Leyenda",
      "tool.legendTitle": "Mostrar leyenda de colores",
      "tool.export": "Exportar",
      "tool.exportTitle": "Descargar los datos como JSON",
      "tool.import": "Importar",
      "tool.importTitle": "Cargar datos desde un JSON",
      "tool.excel": "Importar Excel",
      "tool.excelTitle": "Importar productos desde Excel/CSV en lote",
      "tool.mto": "Zonas MTO",
      "tool.mtoTitle": "Áreas flexibles (MTO / especiales): lista de productos sin lugar fijo",
      "tool.reset": "Restaurar",
      "tool.resetTitle": "Restaurar el diseño original",
      "tool.menu": "Menú",
      "tool.language": "Idioma",
      "tool.close": "Cerrar",
      "tool.cancel": "Cancelar",
      "tool.save": "Guardar",
      "tool.confirm": "Confirmar",
      "tool.back": "Atrás",
      "tool.done": "Listo",

      /* ---- hints ---- */
      "hint.view": "<b>Arrastra</b> para mover · <b>Scroll / pellizca</b> para zoom · <b>Mantén presionado</b> en el mapa para reportar un producto que encontraste ahí",
      "hint.editBadge": "MODO EDICIÓN · arrastra para mover · arrastra en vacío para seleccionar por caja",
      "hint.bgbar": "Toca una forma para seleccionarla · los tiradores redimensionan · la perilla de arriba rota · Propiedades cambia forma, relleno y borde",

      /* ---- legend / groups ---- */
      "legend.title": "Grupos de productos",
      "legend.new": "+ Nuevo",
      "legend.newTitle": "Crear un grupo nuevo",
      "legend.empty": "Todavía no hay grupos.",
      "legend.assign": "Mover los productos seleccionados a este grupo",
      "legend.rename": "Renombrar grupo",
      "legend.delete": "Eliminar grupo",
      "group.newPrompt": "Nombre del nuevo grupo:",
      "group.created": "Grupo “{name}” creado — selecciona productos y presiona ⤓ para moverlos aquí",
      "group.renamePrompt": "Renombrar grupo:",
      "group.renamed": "Renombrado a {name}",
      "group.needOne": "Necesitas al menos un grupo",
      "group.deleteConfirm": "¿Eliminar el grupo “{name}”?",
      "group.deleteMoves": "Sus {n} producto(s) se moverán a “{to}” — no se borra nada del mapa.",
      "group.deleted": "Grupo eliminado",
      "group.deletedMoved": "Grupo eliminado — {n} producto(s) movidos a {to}",
      "group.selected": "{name} — {n} seleccionados",
      "group.emptyGroup": "Ese grupo todavía no tiene productos",
      "group.selectFirst": "Primero selecciona productos (Modo edición → arrastra una caja alrededor)",
      "group.moved": "{n} producto(s) movidos a {to}",

      /* ---- tiles / editing ---- */
      "tile.changeColor": "Cambiar color",
      "tile.editSku": "Editar SKU",
      "tile.resize": "Arrastra para redimensionar",
      "tile.remove": "Quitar",
      "tile.renamePrompt": "Editar el SKU del producto:",
      "tile.skuEmpty": "El SKU no puede quedar vacío",
      "tile.skuSet": "SKU → {sku}",
      "tile.skuDup": " (ojo: ya existe otro igual)",
      "tile.removed": "Se quitó {sku}",
      "tile.removedN": "Se quitaron {n} productos",
      "tile.moved": "Se movió {sku}",
      "tile.movedN": "Se movieron {n} productos",
      "tile.resized": "{sku} redimensionado → {w}×{h}",
      "tile.resizedN": "{n} productos redimensionados → {w}×{h}",
      "tile.aligned": "{n} productos alineados",
      "tile.unified": "Tamaño unificado → {w}×{h}",
      "tile.selected": "{n} seleccionados",
      "tile.addPrompt": "Número del producto nuevo:",
      "tile.added": "{sku} agregado — arrástralo a su lugar",
      "tile.setImageBtn": "Poner foto del producto",
      "tile.changeImageBtn": "Cambiar foto",
      "tile.viewImage": "Ver foto del producto",
      "tile.noImage": "Todavía no hay foto de este producto.",
      "tile.imagePrompt": "URL de la foto de este producto (déjalo vacío para quitarla):",
      "tile.imageSet": "Foto actualizada",
      "tile.imageRemoved": "Foto quitada",
      "edit.on": "Modo edición activo — arrastra libremente. Deselecciona para mover el mapa.",
      "edit.off": "Modo edición apagado — solo vista",
      "edit.selectOne": "Selecciona exactamente 1 producto para editar su SKU",

      /* ---- selection toolbar ---- */
      "sel.count": "sel",
      "sel.alignLeft": "Alinear a la izquierda",
      "sel.alignCx": "Centrar (horizontal)",
      "sel.alignRight": "Alinear a la derecha",
      "sel.alignTop": "Alinear arriba",
      "sel.alignCy": "Centrar (vertical)",
      "sel.alignBottom": "Alinear abajo",
      "sel.rowh": "Acomodar en fila",
      "sel.colv": "Acomodar en columna",
      "sel.same": "Igualar el tamaño de todos",
      "sel.color": "Colorear todos los seleccionados",
      "sel.rename": "Editar el SKU (selecciona 1 producto)",
      "sel.report": "Reportar un problema con este producto",

      /* ---- background editor ---- */
      "bg.select": "Seleccionar",
      "bg.rect": "Rectángulo",
      "bg.ellipse": "Elipse / círculo",
      "bg.diamond": "Rombo",
      "bg.triangle": "Triángulo",
      "bg.line": "Línea",
      "bg.label": "Etiqueta de texto",
      "bg.door": "Puerta",
      "bg.props": "⚙ Propiedades",
      "bg.delete": "🗑 Eliminar",
      "bg.reset": "↺ Restaurar fondo",
      "bg.on": "Edición de fondo activa — selecciona para mover/redimensionar, usa las herramientas para dibujar",
      "bg.off": "Edición de fondo apagada",
      "bg.deleted": "Elemento de fondo eliminado",
      "bg.selectFirst": "Primero selecciona un elemento del fondo",
      "bg.resetConfirm": "¿Restaurar el fondo al diseño original de la yarda? Se perderán tus ediciones de fondo.",
      "bg.wasReset": "Fondo restaurado",
      "bg.labelPrompt": "Texto de la etiqueta:",
      "bg.doorPrompt": "Etiqueta de la puerta (ej. #5):",
      "bg.front": "Traído al frente",
      "bg.back": "Enviado al fondo",
      "bg.flexCount": "{n} productos · área variable (MTO)",

      /* ---- inspector ---- */
      "insp.shape": "Forma",
      "insp.empty": "Toca cualquier forma del mapa para editarla.<br>O elige una herramienta arriba y dibuja una nueva.",
      "insp.fill": "Relleno",
      "insp.border": "Borde",
      "insp.style": "Estilo",
      "insp.corner": "Esquina",
      "insp.rotate": "Rotar",
      "insp.size": "Tamaño",
      "insp.text": "Texto",
      "insp.textSize": "Tam. texto",
      "insp.labelPh": "Etiqueta…",
      "insp.duplicate": "⧉ Duplicar",
      "insp.toFront": "↑ Frente",
      "insp.toBack": "↓ Fondo",
      "insp.delete": "🗑 Eliminar",

      /* ---- report flow (new logic) ---- */
      "report.title": "Reportar",
      "report.forSku": "Reportar: {sku}",
      "report.chooseWhat": "¿Qué quieres reportar?",
      "report.empty": "Espacio vacío — no está aquí",
      "report.emptyDesc": "El producto debería estar en este lugar pero no hay nada.",
      "report.damaged": "Producto dañado / incompleto",
      "report.damagedDesc": "Sí está aquí, pero no está en condición de venta.",
      "report.foundHere": "Encontré otro producto aquí",
      "report.foundHereDesc": "Hay algo en este lugar que no corresponde.",
      "report.lowStock": "Queda poco",
      "report.lowStockDesc": "Todavía hay, pero queda muy poco.",

      "found.title": "Encontré un producto aquí",
      "found.step1": "1 · ¿Qué producto es?",
      "found.step2": "2 · Confirma el lugar",
      "found.scanBtn": "📷 Escanear código de barras",
      "found.manualLabel": "O escribe el SKU",
      "found.manualPh": "ej. WT214",
      "found.pickOnMap": "📍 Marcar el lugar en el mapa",
      "found.pinSet": "Lugar marcado en el mapa",
      "found.pinHint": "Toca el mapa donde lo encontraste y luego confirma.",
      "found.expected": "Lugar asignado: {loc}",
      "found.expectedUnknown": "Este SKU todavía no tiene un lugar asignado en el mapa.",
      "found.notInSystem": "Este código no está en el sistema",
      "found.notInSystemDesc": "No está en el mapa ni en ninguna lista MTO. Repórtalo para que un editor lo agregue y le asigne un lugar.",
      "found.reportUnknown": "Reportar código desconocido",
      "found.createHere": "Crear este producto aquí",
      "found.note": "Nota (opcional)",
      "found.notePh": "ej. revuelto con la fila de 6EG",
      "found.submit": "Enviar reporte",
      "found.needSku": "Primero escribe o escanea un SKU.",
      "found.needSpot": "Primero marca el lugar en el mapa.",
      "found.sameSpot": "Ese ya es su lugar asignado — no hay nada que reportar.",

      "report.sent": "Reporte enviado",
      "report.sentN": "{n} reportes enviados",
      "report.failed": "No se pudo enviar el reporte — se guardó en este dispositivo y se reintentará.",
      "longpress.hint": "Mantén el dedo en el mapa para reportar un producto que encontraste ahí",

      /* ---- alerts panel ---- */
      "alerts.title": "Reportes activos",
      "alerts.none": "No hay problemas reportados.<br>Todo en orden en la yarda. ✅",
      "alerts.resolve": "Marcar resuelto ✔️",
      "alerts.resolved": "Reporte resuelto",
      "alerts.by": "por {name}",
      "alerts.at": "el {date}",
      "alerts.goto": "Ver en el mapa",
      "alerts.filterAll": "Todos",
      "alerts.filterOpen": "Abiertos",
      "alerts.filterDone": "Resueltos",
      "alerts.type.empty": "ESPACIO VACÍO",
      "alerts.type.damaged": "DAÑADO",
      "alerts.type.found": "FUERA DE LUGAR",
      "alerts.type.unknown": "CÓDIGO DESCONOCIDO",
      "alerts.type.low": "QUEDA POCO",
      "alerts.foundMsg": "{sku} encontrado lejos de su lugar",
      "alerts.foundMsgNoHome": "{sku} encontrado en la yarda — todavía sin lugar asignado",
      "alerts.unknownMsg": "El código {sku} no está en la lista de SKU",
      "alerts.assignSpot": "Asignarle un lugar",
      "alerts.newCount": "{n} reporte(s) nuevo(s)",

      /* ---- scanner ---- */
      "scan.title": "Escanear código de barras",
      "scan.hint": "Apunta la cámara al código de barras del producto.",
      "scan.starting": "Iniciando la cámara…",
      "scan.denied": "Se denegó el acceso a la cámara. Actívala en los ajustes del navegador, o escribe el SKU a mano.",
      "scan.noCamera": "Este dispositivo no tiene cámara disponible. Escribe el SKU a mano.",
      "scan.insecure": "La cámara solo funciona por HTTPS. Abre el sitio publicado en vez de un archivo local.",
      "scan.manual": "Escribirlo a mano",
      "scan.switch": "Cambiar cámara",
      "scan.torch": "Linterna",
      "scan.detected": "Código detectado: {code}",
      "scan.searching": "Buscándolo…",
      "scan.foundSku": "{sku} — {loc}",
      "scan.unknown": "El código {code} no está en el sistema",
      "scan.retry": "Escanear de nuevo",
      "scan.useThis": "Usar este código",

      /* ---- MTO ---- */
      "mto.title": "Zonas flexibles",
      "mto.titleAccent": "MTO / Especiales",
      "mto.new": "+ Nueva zona MTO",
      "mto.empty": "Aún no hay zonas MTO.<br>Crea una con “+ Nueva zona MTO” y pega tu lista de productos.<br><br>Los productos de una zona MTO no crean fichas: al buscarlos, el mapa señala el área.",
      "mto.namePh": "Nombre de la zona",
      "mto.skuCount": "{n} SKUs",
      "mto.skusPh": "Un producto por línea…",
      "mto.importExcel": "⬆ Importar Excel",
      "mto.viewOnMap": "🎯 Ver en el mapa",
      "mto.deleteZone": "🗑 Eliminar zona",
      "mto.deleteConfirm": "¿Eliminar esta zona MTO y su lista?",
      "mto.newPrompt": "Nombre de la nueva zona MTO:",
      "mto.created": "Zona MTO creada — pega tu lista de productos. Muévela/redimensiónala con “Editar Mapa”.",
      "mto.added": "{n} productos agregados a “{zone}”",
      "mto.noProducts": "No encontré productos en el archivo",

      /* ---- import / export ---- */
      "io.downloaded": "Se descargó tarter-yard-map.json",
      "io.imported": "Datos importados",
      "io.importFailed": "Ese archivo no se pudo leer como datos de la yarda",
      "io.xlsMissing": "El lector de Excel no cargó — revisa tu conexión a internet e intenta de nuevo",
      "io.xlsNoColumn": "No encontré una columna “Producto” con datos — usa la plantilla",
      "io.xlsUnreadable": "No pude leer el archivo (¿es un .xlsx o .csv válido?)",
      "io.xlsImported": "{n} productos importados — arrástralos a su lugar",
      "io.xlsSkipped": " ({n} filas vacías omitidas)",
      "io.resetConfirm": "¿Restaurar el diseño y las posiciones originales? Se perderán tus cambios (exporta primero como respaldo).",
      "io.wasReset": "Diseño original restaurado",

      /* ---- sync ---- */
      "sync.saving": "Guardando…",
      "sync.saved": "Guardado para todos",
      "sync.savedLocal": "Guardado en este dispositivo",
      "sync.offline": "Sin conexión — guardado localmente, se sincronizará al volver",
      "sync.conflict": "Otra persona editó el mapa. Cargando la versión más reciente…",
      "sync.updated": "Mapa actualizado por otro usuario",
      "sync.newAlerts": "{n} reporte(s) nuevo(s) desde otro dispositivo",
      "sync.localBanner": "Modo local — los cambios quedan en este dispositivo",
      "sync.readonly": "Solo lectura: entraste como viewer",

      "snap.on": "Rejilla ACTIVADA",
      "snap.off": "Rejilla DESACTIVADA",
    },
  };

  const LANG_KEY = "tarter_yard_lang";
  const SUPPORTED = ["en", "es"];

  function detectLang() {
    try {
      const saved = localStorage.getItem(LANG_KEY);
      if (saved && SUPPORTED.includes(saved)) return saved;
    } catch (e) {}
    const navLangs = (navigator.languages && navigator.languages.length)
      ? navigator.languages
      : [navigator.language || "en"];
    for (const l of navLangs) {
      const short = String(l).toLowerCase().slice(0, 2);
      if (SUPPORTED.includes(short)) return short;
    }
    return "en";
  }

  let lang = detectLang();
  const listeners = [];

  function t(key, vars) {
    let s = (STRINGS[lang] && STRINGS[lang][key]);
    if (s == null) s = (STRINGS.en && STRINGS.en[key]);
    if (s == null) return key;
    if (vars) {
      s = s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? String(vars[k]) : m));
    }
    return s;
  }

  /** Plural helper: uses `key` for n===1 and `key_plural` otherwise. */
  function tn(key, n, vars) {
    const k = n === 1 ? key : key + "_plural";
    return t(STRINGS[lang][k] != null || STRINGS.en[k] != null ? k : key, Object.assign({ n }, vars || {}));
  }

  /**
   * Translate every node under `root` that carries an i18n attribute.
   *   data-i18n        -> textContent
   *   data-i18n-html   -> innerHTML (for strings containing <b>, <br>)
   *   data-i18n-title  -> title attribute
   *   data-i18n-ph     -> placeholder attribute
   *   data-i18n-aria   -> aria-label attribute
   */
  function applyI18n(root) {
    const scope = root || document;
    scope.querySelectorAll("[data-i18n]").forEach((el) => {
      el.textContent = t(el.getAttribute("data-i18n"));
    });
    scope.querySelectorAll("[data-i18n-html]").forEach((el) => {
      el.innerHTML = t(el.getAttribute("data-i18n-html"));
    });
    scope.querySelectorAll("[data-i18n-title]").forEach((el) => {
      el.setAttribute("title", t(el.getAttribute("data-i18n-title")));
    });
    scope.querySelectorAll("[data-i18n-ph]").forEach((el) => {
      el.setAttribute("placeholder", t(el.getAttribute("data-i18n-ph")));
    });
    scope.querySelectorAll("[data-i18n-aria]").forEach((el) => {
      el.setAttribute("aria-label", t(el.getAttribute("data-i18n-aria")));
    });
    document.documentElement.setAttribute("lang", lang);
  }

  function setLang(next) {
    if (!SUPPORTED.includes(next) || next === lang) return;
    lang = next;
    try { localStorage.setItem(LANG_KEY, lang); } catch (e) {}
    applyI18n(document);
    listeners.forEach((fn) => { try { fn(lang); } catch (e) { console.error(e); } });
  }

  function getLang() { return lang; }
  function onLangChange(fn) { listeners.push(fn); }

  /** Locale-aware date formatting for alert timestamps. */
  function fmtDate(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d)) return String(iso);
    try {
      return d.toLocaleString(lang === "es" ? "es-MX" : "en-US", {
        day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
      });
    } catch (e) { return d.toLocaleString(); }
  }

  global.I18N = { t, tn, applyI18n, setLang, getLang, onLangChange, fmtDate, SUPPORTED };
  global.t = t;
})(window);
