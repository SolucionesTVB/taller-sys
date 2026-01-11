#!/bin/bash

BASE_URL="https://frxfhzpogtwyznjxdbnu.supabase.co"

if [ -z "$ANON_KEY" ]; then
  echo "ERROR: Debe definir la variable de entorno ANON_KEY con tu anon key de Supabase."
  echo "Ejemplo:"
  echo "  export ANON_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZyeGZoenBvZ3R3eXpuanhkYm51Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk5MzI5MzYsImV4cCI6MjA3NTUwODkzNn0.qUWoWsf2_X12HIAjw1fMhKUiN2aqZW_9r2sQD4bxOTo'"
  exit 1
fi

run_curl() {
  curl "$1" \
    -H "apikey: $ANON_KEY" \
    -H "Authorization: Bearer $ANON_KEY" \
    -H "Content-Type: application/json"
}

case "$1" in
  tablero)
    echo "== TABLERO EJECUTIVO TALLER SyS =="
    run_curl "$BASE_URL/rest/v1/vw_taller_dashboard?select=*&order=prioridad.asc&order=dias_abierta.desc"
    ;;
  criticos)
    echo "== TAREAS CRÍTICAS (Alta + Pendiente) =="
    run_curl "$BASE_URL/rest/v1/vw_taller_dashboard?prioridad=eq.Alta&estado=eq.Pendiente&select=*&order=dias_abierta.desc"
    ;;
  atrasados)
    echo "== TAREAS ATRASADAS (dias_restantes < 0) =="
    run_curl "$BASE_URL/rest/v1/vw_taller_dashboard?dias_restantes=lt.0&select=*&order=prioridad.asc&order=dias_restantes.asc"
    ;;
  *)
    echo "Uso:"
    echo "  $0 tablero"
    echo "  $0 criticos"
    echo "  $0 atrasados"
    exit 1
    ;;
esac
