# HelpDesk Lite — estado del frontend para integración

Este documento resume cómo quedó el frontend y qué información espera al
conectarse con el backend. No define la implementación interna del servidor ni
sustituye sus reglas de autorización.

## Qué quedó implementado

- Aplicación responsive con navegación para escritorio, tablet y móvil.
- Una organización activa que determina los datos y capacidades visibles.
- Cambio de organización desde el encabezado cuando la persona tiene más de
  una disponible.
- Vistas distintas para `MEMBER`, `AGENT`, `ORG_ADMIN` y `GLOBAL_ADMIN`.
- Estados explícitos para cuenta suspendida y usuario sin organización activa.
- Tickets, directorio de personas, solicitudes de conexión, mensajes,
  organizaciones, configuración organizacional y administración de plataforma.
- Formularios y diálogos con estados de foco, validación, carga, vacío, error y
  confirmación.
- Descripciones de organizaciones y categorías en los lugares donde ayudan a
  entender el contexto.
- Flujo visual de invitación de usuarios y creación de organizaciones.

## Modelo que representa la interfaz

### Roles

- `MEMBER`: crea solicitudes y consulta sus propios tickets.
- `AGENT`: conserva las capacidades de miembro y atiende tickets de su
  organización.
- `ORG_ADMIN`: administra miembros, categorías, asignaciones y configuración de
  su organización.
- `GLOBAL_ADMIN`: administra la plataforma y puede trabajar dentro de una
  organización seleccionada sin recibir una membresía organizacional ficticia.

Los roles organizacionales son `MEMBER`, `AGENT` y `ORG_ADMIN`. `GLOBAL_ADMIN`
es un rol de plataforma independiente.

| Capacidad                                  | `MEMBER`          | `AGENT`              | `ORG_ADMIN`          | `GLOBAL_ADMIN`                |
| ------------------------------------------ | ----------------- | -------------------- | -------------------- | ----------------------------- |
| Crear y responder tickets propios          | Sí                | Sí                   | Sí                   | Sí                            |
| Tickets visibles                           | Propios           | Organización         | Organización         | Organización seleccionada     |
| Atender, reabrir y usar notas internas     | No                | Sí                   | Sí                   | Sí                            |
| Autoasignarse tickets                      | No                | Sí                   | Sí                   | Sí                            |
| Asignar a otros o eliminar tickets         | No                | No                   | Sí                   | Sí                            |
| Consultar organización y categorías        | Sí                | Sí                   | Sí                   | Sí                            |
| Ver estadísticas organizacionales         | No                | Sí                   | Sí                   | Sí                            |
| Ver y administrar miembros                 | No                | No                   | Sí                   | Sí                            |
| Editar organización y categorías           | No                | No                   | Sí                   | Sí                            |
| Administrar la plataforma                  | No                | No                   | No                   | Sí                            |
| Mensajes privados                          | Solo participante | Solo participante    | Solo participante    | Solo participante             |

Las acciones concretas también dependen del recurso y de su estado. Por
ejemplo, un ticket cerrado es de solo lectura hasta que una acción autorizada lo
reabra. Ocultar controles en la interfaz mejora la experiencia, pero no se
considera una medida de autorización.

### Organización activa

La organización activa es un identificador de contexto, no solo un nombre
visible. Al cambiarla, la interfaz espera actualizar membresía, capacidades,
tickets, categorías, estadísticas y cualquier otro dato organizacional.

Una persona con una sola organización ve su nombre sin una flecha que sugiera
un selector. Un global admin puede seleccionar una organización por alcance de
trabajo sin asumir la identidad ni el rol organizacional de otra persona.

### Invitaciones y contraseña

`Invite user` representa una invitación, no la creación inmediata de una cuenta
utilizable. El formulario recoge el email y el acceso solicitado, pero no pide
ni muestra una contraseña temporal y tampoco permite elegir `Active` o
`Suspended`.

La experiencia prevista es:

1. se registra la invitación;
2. la persona recibe un enlace de aceptación;
3. la persona crea su propia contraseña; y
4. después de aceptar, su cuenta o membresía pasa a estar disponible.

Para mostrar correctamente el estado, el frontend necesita distinguir al menos
invitaciones pendientes, aceptadas, vencidas y revocadas.

### Creación de organizaciones

El formulario solicita nombre, descripción y email del primer administrador de
la organización. El slug mostrado es una previsualización derivada del nombre;
el frontend espera recibir del backend el slug canónico y la organización
creada.

Para la interfaz esta es una única operación: termina con la organización y su
ruta de administración disponibles, o muestra un error sin representar una
creación parcial. El global admin que realiza la operación conserva su rol de
plataforma; el administrador inicial entra mediante la invitación indicada.

### Privacidad y autoría

- Los mensajes directos se muestran únicamente a sus participantes.
- El acceso global a la plataforma no se presenta como impersonación.
- Ningún perfil puede editar silenciosamente el texto escrito por otra persona.
- Suspender una cuenta representa bloqueo de acceso, no eliminación de datos.

## Datos que espera consumir el frontend

### Sesión

- identidad y perfil autenticado;
- rol global;
- organizaciones disponibles con `id`, nombre, slug y rol organizacional;
- organización activa;
- capacidades efectivas para ese contexto; y
- estado utilizable, suspendido o sin organización activa.

### Recursos organizacionales

- identificador de organización en tickets, miembros y categorías;
- datos limitados al contexto activo;
- acciones permitidas cuando dependan del propietario o del estado del recurso;
- estados de invitación independientes del estado de una cuenta activa; y
- respuestas de error estables para mostrar `forbidden`, `not found`, conflicto
  o validación sin inventar el resultado en la interfaz.

## Datos locales de preview

El modo `VITE_PREVIEW_MODE=true` permite revisar la interfaz sin depender del
backend. Utiliza identidades y datos deterministas para:

- John Lee — Member;
- Maya Singh — Agent;
- Mia Chen — Organization admin;
- Sam Okafor — Global admin;
- Carlos Vega — cuenta suspendida; y
- Noah Kim — usuario sin organización activa.

Las mutaciones realizadas en preview son locales y se reinician al recargar.
Los datos de ejemplo no representan persistencia ni autorización real.

Los puntos principales para sustituir esos datos están separados por feature:

| Dominio        | Adaptador o fuente actual                         |
| -------------- | ------------------------------------------------- |
| Tickets        | `features/tickets/ticketData.ts`                  |
| Personas       | `features/people/peopleData.ts`                   |
| Mensajes       | `features/messages/messageData.ts`                |
| Organización   | `features/organization/organizationData.ts`       |
| Organizaciones | `features/organizations/organizationsData.ts`     |
| Administración | `features/admin/adminData.ts`                     |
| Sesión         | `app/session.ts`                                  |

La intención es sustituir las fuentes locales conservando las páginas, sus
estados visuales y la comprobación centralizada de capacidades.

### Cómo retirar el preview

1. No definir `VITE_PREVIEW_MODE=true` fuera de entornos de demostración. Sin
   esa variable desaparecen el selector de identidades, el acceso directo al
   preview y la etiqueta `Frontend preview · local data`.
2. Sustituir cada fuente `*Data.ts` por su adaptador de API, dominio por dominio,
   y retirar los datos locales utilizados como fallback en producción.
3. Cuando todos los dominios consuman datos reales, retirar `previewSessions`,
   `PreviewIdentitySelect`, los estados de sesión simulados y la variable
   `VITE_PREVIEW_MODE`.
4. Comprobar que una compilación sin esa variable restaure la sesión real y no
   muestre selectores, etiquetas ni registros de ejemplo.

## Puntos para confirmar durante la integración

- Forma de seleccionar y conservar la organización activa entre sesiones.
- Correspondencia entre las capacidades de sesión y las acciones permitidas en
  recursos concretos.
- Respuesta final de invitación, vencimiento, reenvío y revocación.
- Respuesta de creación de organización, incluido su slug canónico.
- Campos y eventos disponibles para estadísticas y actividad organizacional.
- Tratamiento acordado para retirar categorías que ya tengan tickets asociados.

Estos puntos describen información que la interfaz todavía necesita; no
prescriben cómo debe implementarse internamente en el backend.

## Verificación funcional esperada

- Cambiar de organización cambia datos y capacidades sin mezclar información.
- Un miembro no ve el directorio interno ni estadísticas globales de su
  organización.
- Un agente atiende tickets, pero no administra miembros ni categorías.
- Un administrador organizacional permanece limitado a su organización.
- Un administrador global usa las herramientas de plataforma sin recibir roles
  organizacionales falsos ni acceso automático a conversaciones privadas.
- Una invitación no activa al usuario ni establece su contraseña antes de ser
  aceptada.
- Una cuenta suspendida y un usuario sin organización reciben sus estados
  específicos sin mostrar información protegida.
