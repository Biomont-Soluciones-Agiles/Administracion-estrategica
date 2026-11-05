# API de objetivos para PMO

URL de producción: `https://bionexora-git-main-mao1216s-projects.vercel.app/api/pmo-objectives`

Todas las solicitudes requieren uno de estos encabezados:

```http
X-API-Key: <PMO_OBJECTIVES_API_KEY>
```

o

```http
Authorization: Bearer <PMO_OBJECTIVES_API_KEY>
```

## 1. Actualizar el catálogo de objetivos

`GET /api/pmo-objectives`

La PMO debe invocarlo al presionar su botón **Actualizar objetivos**. Devuelve exclusivamente objetivos cuyo `status` sea `Activo`. No expone el identificador interno `id`; la integración usa `code`.

```json
{
  "data": [
    {
      "code": "OBJ-26001",
      "name": "Incrementar la rentabilidad de la empresa",
      "description": "...",
      "focus": "Financiero",
      "updated_at": "2026-11-05T17:00:00.000Z"
    }
  ],
  "generated_at": "2026-11-05T17:05:00.000Z"
}
```

Para una actualización incremental: `GET /api/pmo-objectives?updated_since=2026-11-05T00:00:00Z`.

## 2. Vincular proyectos a un objetivo

`POST /api/pmo-objectives`

```json
{
  "action": "link",
  "objective_code": "OBJ-26001",
  "projects": [
    {
      "code": "PMO-123",
      "name": "Proyecto de ejemplo",
      "description": "Alcance del proyecto",
      "responsible_name": "Responsable PMO",
      "status": "En ejecución",
      "progress": 48,
      "end_date": "2027-12-31",
      "project_url": "https://pmo.example/proyectos/PMO-123"
    }
  ]
}
```

La operación es idempotente: repetir un vínculo no crea otro. La vinculación se refleja de inmediato en BioIndicadores y queda una notificación de vinculación para GCG.

## 3. Solicitar una desvinculación

`POST /api/pmo-objectives`

```json
{
  "action": "request_unlink",
  "objective_code": "OBJ-26001",
  "project_code": "PMO-123",
  "reason": "Proyecto reorganizado en PMO"
}
```

La desvinculación queda en estado `pending`. GCG debe aprobarla o rechazarla desde BioIndicadores. No se elimina ningún vínculo hasta la aprobación.
