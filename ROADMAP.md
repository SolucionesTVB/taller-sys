# ROADMAP — Taller SyS

Actualizado: 29 de septiembre de 2026

## 1. Objetivo
Conservar y retomar Taller SyS como base para un posible proyecto real con el cliente, aprovechando lo ya construido y evitando empezar de cero.

## 2. Fuente oficial
Repositorio: SolucionesTVB/taller-sys
Rama: main

Regla: GitHub es la fuente de código. No depender de copias permanentes en la Mac.

## 3. Lo recuperado
### Aplicación omnicanal original
- legacy/demo-omnicanal-taller/index.html
- Demo amplia: dashboard de satisfacción + tareas + bandeja WhatsApp.
- Consume Supabase para encuestas y tareas.
- La bandeja WhatsApp incluida es una simulación visual.

### Pulso Operativo
- legacy/demo-omnicanal-taller/pulso.html
- Flujo de OT: Recepción → Diagnóstico → Aprobación → Repuestos → En proceso → Pintura → Calidad → Entrega.
- Incluye alertas, siguiente paso y ejemplo de aviso WhatsApp.
- Trabaja con datos simulados/localStorage.

### Tablero ejecutivo
- backend/supabase-taller-sys/tablero.html
- KPIs, críticos, atrasados, satisfacción y detalle.
- Consume la Edge Function taller-dashboard.

### Inbox alternativo
- frontend/taller-sys-frontend/index.html
- Bandeja de mensajes conectada por REST a Supabase.
- Requiere configuración de URL/key.

### Dashboard anterior
- frontend/taller-dashboard-site/index.html
- Versión anterior. No usar como base hasta revisar credenciales/configuración.

## 4. Backend encontrado
Supabase project ref histórico: frxfhzpogtwyznjxdbnu

Funciones encontradas:
- taller-dashboard
- encuesta-wa
- wa-ingest
- wa-ack (mínima/incompleta)

Estructura SQL encontrada:
- wa_conversaciones
- wa_mensajes
- wa_survey_queue

También existe lógica histórica de salida WhatsApp mediante WaSender y una cola de notificaciones.

## 5. Estado conocido
- GitHub: recuperado y clonado correctamente el 29-09-2026.
- Copia temporal para revisión: Taller_SyS_Original.html.
- Netlify anterior: no usar como producción; el sitio histórico dejó de estar disponible.
- Nuevo destino previsto: Vercel.
- Supabase/backend: código recuperado, pero antes de producción hay que comprobar estado actual de proyecto, tablas, funciones, permisos, cron y variables.
- WhatsApp: hay código y pruebas históricas, pero no asumir integración productiva actual.
- Anti-duplicados/RPC: pendiente de verificar; no darlo por implementado.

## 6. Decisiones
1. No reconstruir desde cero.
2. Partir del código recuperado.
3. Mantener todo cloud-first: GitHub + Vercel + base de datos/servicios cloud.
4. Trabajar uno por uno: ejecutar → verificar → documentar → cerrar.
5. No exponer ni copiar credenciales en documentación o chat.
6. Antes de conectar un cliente real, separar demo, datos reales y credenciales.

## 7. Próxima fase si se confirma el cliente
1. Definir alcance comercial/operativo real del taller.
2. Elegir la interfaz base (la demo omnicanal es la candidata inicial).
3. Revisar qué datos actuales de Supabase siguen vivos.
4. Limpiar demo y separar datos simulados.
5. Integrar el flujo real de órdenes de trabajo.
6. Definir canal WhatsApp productivo.
7. Unificar Dashboard + Pulso + Inbox en una sola experiencia.
8. Desplegar en Vercel.
9. Probar con datos controlados.
10. Documentar operación y respaldo.

## 8. No tocar sin revisión
- Credenciales/keys históricas.
- Producción de otros proyectos NOA.
- Integraciones de WhatsApp activas de otros clientes.
- Código legacy que pueda contener configuración antigua.

## 9. Punto de reanudación
Cuando se retome este proyecto, comenzar por este ROADMAP y el repositorio SolucionesTVB/taller-sys. No empezar buscando el antiguo Netlify ni rehaciendo pantallas.
