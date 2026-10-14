import type { Translation } from './en';

export const es: Translation = {
  common: {
    actions: {
      save: 'Guardar',
      cancel: 'Cancelar',
      retry: 'Reintentar',
      refresh: 'Actualizar',
      close: 'Cerrar',
      search: 'Buscar',
      signOut: 'Cerrar sesión',
    },
    state: {
      loading: 'Cargando…',
      empty: 'Aún no hay nada aquí',
      error: 'Algo ha salido mal',
      refreshing: 'Actualizando…',
      updatedAt: 'Actualizado: {{time}} · se refresca cada minuto',
    },
    language: 'Idioma',
    notFound: {
      title: 'Página no encontrada',
      description: 'La dirección no coincide con ninguna página disponible.',
      back: 'Volver a tickets',
    },
  },
  nav: {
    tickets: 'Tickets',
    people: 'Personas',
    messages: 'Mensajes',
    organization: 'Organización',
    account: 'Cuenta',
    admin: 'Administración',
  },
  account: {
    back: '‹ Cuenta',
    home: {
      profileTitle: 'Configuración del perfil',
      description: 'Gestiona tus datos personales y tu privacidad.',
      editProfile: 'Editar perfil',
      user: 'Usuario',
      settingsLabel: 'Configuración de la cuenta',
      preferences: {
        title: 'Preferencias',
        description:
          'Elige cómo se muestran las fechas y se programan las notificaciones.',
        summary: 'Zona horaria · {{timezone}}',
      },
      privacy: {
        title: 'Privacidad y datos',
        description: 'Exporta o elimina tu información',
      },
      sessions: {
        title: 'Sesiones y dispositivos',
        description: 'Consulta dónde has iniciado sesión y cierra dispositivos',
      },
    },
    preferences: {
      title: 'Preferencias',
      description:
        'Elige cómo se muestran las fechas y se programan las notificaciones.',
      language: 'Idioma',
      languages: { en: 'English', es: 'Español', ca: 'Català' },
      timezone: 'Zona horaria',
      timezoneHelp:
        'El navegador ha detectado {{timezone}}. Esta opción controla las marcas de tiempo de los tickets y la programación futura de notificaciones.',
      theme: 'Tema',
      themes: { light: 'Claro', dark: 'Oscuro', system: 'Sistema' },
      notifications: 'Notificaciones',
      notifyOnTicketUpdate: 'Actualizaciones de tickets',
      notifyOnComment: 'Comentarios',
      notifyOnMention: 'Menciones',
      notifyOnMessage: 'Mensajes',
      notifyOnFriendship: 'Solicitudes de amistad',
      saved: 'Preferencia guardada correctamente.',
    },
    password: {
      title: 'Cambiar contraseña',
      description: 'Actualiza tu contraseña para proteger tu cuenta.',
      current: 'Contraseña actual',
      new: 'Nueva contraseña',
      confirm: 'Confirmar nueva contraseña',
      sessionWarning:
        'Se cerrará la sesión en todos tus dispositivos, también en éste.',
      submit: 'Cambiar contraseña',
      saving: 'Cambiando contraseña…',
      success: 'Contraseña cambiada correctamente.',
    },
  },
  tickets: {
    title: 'Tickets',
    new: 'Nuevo ticket',
    empty: 'Ningún ticket coincide con estos filtros.',
    status: {
      OPEN: 'Abierto',
      IN_PROGRESS: 'En curso',
      RESOLVED: 'Resuelto',
      CLOSED: 'Cerrado',
    },
    priority: { LOW: 'Baja', MEDIUM: 'Media', HIGH: 'Alta' },
    list: {
      greeting: 'Buenos días, {{name}}',
      attention_one: '{{count}} ticket necesita atención',
      attention_other: '{{count}} tickets necesitan atención',
      description: {
        organization:
          'Sigue las solicitudes de tu organización y haz avanzar el trabajo.',
        personal: 'Sigue las solicitudes que has creado y su progreso.',
      },
      stats: {
        open: 'Abiertos',
        inProgress: 'En curso',
        resolved: 'Resueltos',
        highPriority: 'Prioridad alta',
      },
      summary: 'Resumen de tickets',
      categoryFilter: 'Filtro de categoría',
      backToCategories: 'Volver a categorías',
      clearFilter: 'Limpiar filtro',
      allTickets: 'Todos los tickets',
      yourTickets: 'Tus tickets',
      results_one: '{{count}} resultado',
      results_other: '{{count}} resultados',
      searchLabel: 'Buscar tickets',
      searchPlaceholder: 'Buscar por título o descripción',
      empty: {
        title: 'Aún no hay tickets',
        description: 'Crea tu primer ticket para empezar a seguir solicitudes.',
        filteredDescription:
          'Prueba a ajustar o borrar la búsqueda y los filtros para ver más resultados.',
      },
      errorTitle: 'No se han podido cargar los tickets',
      unassigned: 'Sin asignar',
      noCategory: 'Sin categoría',
      createdBy: 'Creado por {{name}}',
      assignedTo: 'Asignado a {{name}}',
      viewAll_one: 'Ver el ticket',
      viewAll_other: 'Ver los {{count}} tickets',
      showing: 'Mostrando {{from}}–{{to}} de {{count}}',
      pages: 'Páginas de tickets',
    },
    table: {
      ticket: 'Ticket',
      status: 'Estado',
      priority: 'Prioridad',
      assignee: 'Asignado a',
      updated: 'Actualizado',
      createdBy: 'Creado por',
    },
    detail: {
      back: 'Volver a tickets',
      title: 'Detalle del ticket',
      actions: 'Acciones del ticket',
      updated: 'Actualizado {{date}}',
      reopen: 'Reabrir ticket',
      confirmClose: 'Confirmar y cerrar',
      closeTicket: 'Confirmar resolución',
      closeDescription:
        'Revisa la resolución propuesta antes de cerrar este ticket.',
      noResolution: 'No se ha proporcionado ninguna resolución.',
      requester: 'Solicitante',
      details: 'Detalles del ticket',
      conversation: 'Conversación',
      conversationRestricted:
        'Solo el creador, el soporte asignado o un administrador de la organización pueden acceder a esta conversación.',
      loadingConversation: 'Cargando conversación…',
      conversationFailed: 'No se ha podido cargar la conversación.',
      reply: 'Responder',
      replyPlaceholder: 'Escribe una respuesta…',
      sendReply: 'Enviar respuesta',
      send: 'Enviar',
      status: 'Estado',
      priority: 'Prioridad',
      category: 'Categoría',
      organization: 'Organización',
      created: 'Creado',
      assignment: 'Asignación',
      assignmentDescription: 'Asignación actual del ticket.',
      assignee: 'Asignado a',
      ticketClosed: 'Ticket cerrado',
      closedDescription:
        'El solicitante confirmó la resolución. La conversación sigue disponible como referencia.',
      adminReassignOnly:
        'Solo los administradores pueden reasignar este ticket.',
      agentOptions: 'Opciones del agente',
      agentOptionsDescription:
        'Actualiza la prioridad y la categoría del ticket.',
      resolutionDescription:
        'Añade una resolución antes de marcar este ticket como resuelto.',
      resolutionEyebrow: 'RESOLUCIÓN',
      saving: 'Guardando…',
      markResolved: 'Marcar como resuelto',
      resolveTicket: 'Resolver ticket',
      resolution: 'Resolución',
      resolutionPlaceholder:
        'Describe cómo se resolvió el problema (al menos 20 caracteres).',
      actionsDescription: 'Acciones disponibles para el ticket {{id}}.',
      eyebrow: 'TICKET',
      returnToTickets: 'Volver a tickets',
      copyId: 'Copiar ID del ticket',
      loadError: 'No se ha podido cargar el ticket',
      notFound: 'Ticket no encontrado',
      notFoundDescription: 'Es posible que este ticket se haya eliminado.',
      assignToMe: 'Asignarme el ticket',
      issueDescription: 'Descripción del problema',
      closedReadOnly:
        'Este ticket es de solo lectura mientras está cerrado. Reábrelo antes de añadir otra respuesta.',
      newLineHint: 'Mayús + Intro para una nueva línea',
      feedback: {
        replyAdded: 'Respuesta añadida.',
        replyFailed: 'No se ha podido añadir la respuesta. Inténtalo de nuevo.',
        priorityUpdated: 'Prioridad actualizada.',
        priorityFailed:
          'No se ha podido actualizar la prioridad. Inténtalo de nuevo.',
        assigneeUpdated: 'Asignación actualizada.',
        assigneeFailed:
          'No se ha podido actualizar la asignación. Inténtalo de nuevo.',
        categoryUpdated: 'Categoría actualizada.',
        categoryFailed:
          'No se ha podido actualizar la categoría. Inténtalo de nuevo.',
        closed: 'Ticket cerrado.',
        resolved: 'Ticket marcado como resuelto.',
        reopened: 'Ticket reabierto.',
        statusFailed:
          'No se ha podido actualizar el estado. Inténtalo de nuevo.',
        assignedToMe: 'Ticket asignado y movido a “En curso”.',
        assignToMeFailed:
          'No se ha podido asignar el ticket. Inténtalo de nuevo.',
        idCopied: 'ID del ticket copiado.',
        copyUnavailable: 'No se puede copiar en este navegador. ID: {{id}}.',
      },
    },
    filters: {
      title: 'Filtrar tickets',
      description: 'Combina campos para acotar la lista de tickets.',
      apply: 'Aplicar filtros',
      more: 'Más filtros',
      status: { label: 'Estado', all: 'Todos los estados' },
      priority: { label: 'Prioridad', all: 'Todas las prioridades' },
      category: { label: 'Categoría', all: 'Todas las categorías' },
      sort: {
        label: 'Ordenar',
        newest: 'Más recientes',
        oldest: 'Más antiguos',
      },
    },
    create: {
      title: 'Crear un ticket',
      subtitle:
        'Describe el problema claramente para que la persona adecuada pueda ayudarte.',
      back: 'Volver a tickets',
      breadcrumbs: 'TICKETS / NUEVO',
      detailsTitle: 'Detalles del ticket',
      requiredNote: 'Todos los campos marcados con * son obligatorios.',
      fields: {
        subject: 'Asunto *',
        subjectPlaceholder: 'Breve resumen del problema',
        organization: 'Organización *',
        category: 'Categoría',
        categoryPlaceholder: 'Selecciona una categoría (opcional)...',
        categoryUnassignedHelp:
          'Si tienes dudas, deja la categoría en blanco. El equipo de soporte la clasificará por ti.',
        description: 'Descripción *',
        descriptionPlaceholder:
          'Explica qué pasó, qué esperabas y los pasos para reproducir el problema.',
        priority: 'Prioridad *',
        priorityDescriptions: {
          low: 'Puede esperar',
          medium: 'Requiere atención',
          high: 'El trabajo está bloqueado',
        },
      },
      actions: {
        cancel: 'Cancelar',
        submit: 'Crear ticket',
        submitting: 'Creando...',
      },
      done: 'Ticket creado con éxito.',
      aside: {
        before: 'ANTES DE ENVIAR',
        helpTitle: 'Ayúdanos a resolverlo más rápido',
        tips: {
          specificTitle: 'Sé específico',
          specificText: 'Usa un asunto claro que describa el problema.',
          contextTitle: 'Añade contexto',
          contextText: 'Explica qué ha cambiado y a quién afecta.',
          priorityTitle: 'Elige la prioridad',
          priorityText: 'Usa Alta solo cuando el trabajo esté bloqueado.',
        },
        nextTitle: '¿Qué pasa después?',
        steps: {
          open: 'Abierto — Tu solicitud se une a la cola.',
          inProgress: 'En progreso — Un agente se hace cargo.',
          resolved: 'Resuelto — Revisas la solución propuesta.',
        },
      },
    },
  },
  organization: {
    eyebrow: 'ORGANIZACIÓN',
    role: {
      MEMBER: 'Miembro',
      AGENT: 'Agente de soporte',
      ORG_ADMIN: 'Administrador de la organización',
    },
    roleDescription: {
      MEMBER: 'Abre tickets y sigue sus propias solicitudes.',
      AGENT:
        'Trabaja todos los tickets de la organización: estado, autoasignación y notas internas.',
      ORG_ADMIN:
        'Todo lo que hace un agente, y además miembros, roles, categorías, claves de API y la propia organización.',
    },
    roleInOrganization: '{{role}} en {{organization}}',
    someOrganization: 'una organización',
    members_one: '{{count}} miembro',
    members_other: '{{count}} miembros',
    tickets_one: '{{count}} ticket',
    tickets_other: '{{count}} tickets',
    defaultDescription: 'Soporte y solicitudes de servicio de la organización.',
    list: {
      eyebrow: 'ORGANIZACIONES',
      eyebrowPlatform: 'PLATAFORMA',
      title: 'Tus organizaciones',
      titlePlatform: 'Organizaciones',
      description:
        'Elige una organización para seguir con el acceso que tienes.',
      descriptionPlatform: 'Revisa las organizaciones de la plataforma.',
      new: 'Nueva organización',
      search: 'Buscar organizaciones',
      count_one: '{{count}} organización',
      count_other: '{{count}} organizaciones',
      open: 'Abrir organización',
      platformAccess: 'Acceso de plataforma',
      yours: 'Tu organización',
      pendingAdministrator:
        'Invitación de administración pendiente · {{email}}',
      noResults: {
        title: 'No se ha encontrado ninguna organización',
        description: 'Prueba con otra búsqueda.',
      },
      none: {
        title: 'Todavía no hay organizaciones',
        description:
          'Un administrador de una organización tiene que darle un rol a tu dirección de correo.',
        descriptionPlatform: 'Crea la primera con Nueva organización.',
      },
    },
    create: {
      title: 'Crear una organización',
      description:
        'Crea la organización y da su administración a una dirección de correo. La persona la recibe aunque todavía no tenga cuenta: se activa cuando cree una con esa dirección y la confirme.',
      name: 'Nombre de la organización',
      namePlaceholder: 'Ejemplo: Soporte Acme',
      descriptionLabel: 'Descripción',
      descriptionPlaceholder: 'A qué da soporte esta organización',
      administrator: 'Administrador inicial de la organización',
      administratorPlaceholder: 'admin@empresa.com',
      url: 'Dirección de la organización',
      urlPlaceholder: 'nombre-de-la-organizacion',
      urlHelp:
        'Se genera a partir del nombre. Si ya está en uso, te lo diremos al crear la organización.',
      submit: 'Crear organización',
      submitting: 'Creando…',
      invalidEmail:
        'Escribe una dirección de correo válida para el administrador.',
      duplicate: 'Ya existe una organización con ese nombre o esa dirección.',
      createdPreview:
        'Se ha creado {{name}} y se ha preparado la invitación de su administrador en esta vista previa.',
      createdReserved:
        'Se ha creado {{name}}. Su administración queda reservada para {{email}}: se activa cuando esa dirección cree su cuenta y la confirme.',
      createdApplied:
        'Se ha creado {{name}} y la administra {{administrator}}.',
      createdWithoutAdministrator:
        'Se ha creado {{name}}, pero no se ha podido asignar el administrador: {{reason}} Asígnalo desde Roles y acceso.',
    },
    page: {
      eyebrowSettings: 'AJUSTES DE LA ORGANIZACIÓN',
      descriptionAgent:
        'Revisa la carga de tickets y las categorías que usa esta organización.',
      descriptionMember:
        'Consulta tu acceso y las categorías disponibles al crear tickets.',
      adminTools: 'Herramientas de administración',
      edit: 'Editar organización',
      stats: {
        members: 'Miembros',
        agents: 'Agentes de soporte',
        openTickets: 'Tickets abiertos',
        categories: 'Categorías',
      },
      yourAccess: 'Tu acceso',
      visibility: 'Visibilidad de tickets',
      yourTicketsOnly: 'Solo tus tickets',
      tabsLabel: 'Ajustes de la organización',
      tabs: {
        members: 'Miembros',
        roles: 'Roles de acceso',
        categories: 'Categorías',
        apiKeys: 'Claves de API',
      },
      title: {
        members: 'Miembros y acceso',
        roles: 'Roles de acceso y permisos',
        categories: 'Categorías de tickets',
        apiKeys: 'Claves de API',
      },
      description: {
        members: 'Los cambios solo se aplican dentro de {{organization}}.',
        roles:
          'Revisa los niveles de acceso fijos que se usan en {{organization}}.',
        categories:
          'Crea categorías para clasificar y encaminar las solicitudes de soporte.',
        apiKeys:
          'Deja que otro sistema trabaje con {{organization}} a través de la API pública, solo con los permisos que elijas.',
      },
      addMember: 'Añadir miembro',
      createCategory: 'Crear categoría',
      columns: {
        member: 'MIEMBRO',
        role: 'ROL',
        category: 'CATEGORÍA',
        members: 'MIEMBROS',
        tickets: 'TICKETS',
        access: 'ACCESO',
        status: 'ESTADO',
      },
      empty: {
        membersTitle: 'Todavía no hay miembros',
        membersDescription:
          'Añade a alguien por su dirección de correo para empezar.',
        categoriesTitle: 'Todavía no hay categorías',
        categoriesDescription: 'Crea una para empezar a encaminar tickets.',
      },
      errorTitle: 'No se ha podido leer esta organización',
      viewTickets: 'Ver los tickets de {{name}}',
      open: 'Abrir {{name}}',
      editRow: 'Editar {{name}}',
      active: 'Activo',
      invited: 'Invitado',
      waitingForPerson: ' · esperando a la persona',
      roleRows: {
        ORG_ADMIN: {
          badge: 'AO',
          description: 'Acceso completo a la organización',
          access: 'Todos los permisos',
        },
        AGENT: {
          badge: 'AG',
          description:
            'Crea tickets y atiende las solicitudes de la organización',
          access: 'Atender tickets',
        },
        MEMBER: {
          badge: 'MI',
          description: 'Crea y sigue sus propios tickets',
          access: 'Sus tickets',
        },
      },
      aside: {
        rolesTitle: 'Resumen de permisos',
        rolesDescription: 'Cómo se reparte el acceso por rol.',
        categoriesTitle: 'Encaminamiento',
        categoriesDescription: 'Tickets por categoría.',
        membersTitle: 'Categorías de tickets',
        membersDescription: 'Sirven para encaminar las solicitudes nuevas.',
        apiKeysTitle: 'Uso de una clave',
        apiKeysDescription:
          'Una clave actúa solo sobre esta organización, con los permisos que se le dieron, hasta que caduca o se revoca.',
        createTickets: 'Crear tickets',
        handleTickets: 'Atender tickets',
        manageMembers: 'Gestionar miembros',
        manageCategories: 'Gestionar categorías',
        accessRoles_one: '{{count}} rol de acceso',
        accessRoles_other: '{{count}} roles de acceso',
      },
      feedback: {
        roleReserved:
          'Rol reservado para {{email}}: entra cuando cree su cuenta con esa dirección y la confirme.',
        alreadyHad: '{{name}} ya tenía ese rol.',
        nowHasAccess: '{{name}} ya tiene acceso a {{organization}}.',
        accessUpdated:
          'Se ha actualizado el acceso de {{name}} a la organización.',
        detailsUpdated: 'Se han actualizado los datos de la organización.',
        detailsUpdatedPreview:
          'Se han actualizado los datos de la organización en esta vista previa.',
        categorySaved: 'Se ha guardado la categoría «{{name}}».',
        removed: '{{name}} ya no forma parte de la organización.',
        reservationCancelled: 'Se ha cancelado la reserva para {{name}}.',
        invitationPrepared: 'Invitación preparada para {{email}}.',
      },
    },
    dialog: {
      addMember: {
        title: 'Añadir un miembro a la organización',
        description:
          'Invita a alguien a {{organization}} y asígnale el acceso que necesita.',
        submit: 'Enviar invitación',
        note: 'El acceso a los tickets depende del rol elegido. Una cuenta confirmada lo recibe en el acto; cualquier otra dirección lo deja reservado hasta que la persona cree la cuenta con ella y la confirme.',
      },
      editMember: {
        title: 'Editar un miembro de la organización',
        description: 'Cambia el acceso de {{name}} dentro de {{organization}}.',
        submit: 'Guardar acceso',
      },
      settings: {
        title: 'Ajustes de la organización',
        description: 'Edita la identidad y los datos de {{organization}}.',
        submit: 'Guardar cambios',
      },
      category: {
        titleCreate: 'Crear una categoría de tickets',
        titleEdit: 'Editar la categoría de tickets',
        description:
          'Configura cómo se clasifican y encaminan las solicitudes.',
        submit: 'Guardar categoría',
      },
      deleteOrganization: {
        title: '¿Eliminar {{organization}}?',
        description:
          'Los miembros pierden el acceso a la organización y sus tickets ya no se podrán modificar.',
        submit: 'Eliminar organización',
        confirmLabel: 'Escribe el nombre de la organización',
      },
      removeMember: {
        title: '¿Quitar a {{name}} de {{organization}}?',
        description:
          'Esto quita el acceso a la organización. No elimina la cuenta de la plataforma.',
        submit: 'Quitar miembro',
        warning:
          'La persona pierde el acceso a esta organización. Su cuenta de la plataforma y sus datos no se eliminan.',
      },
      remove: 'Quitar',
      delete: 'Eliminar',
      sending: 'Enviando…',
      saving: 'Guardando…',
      email: 'Dirección de correo',
      emailPlaceholder: 'nombre@empresa.com',
      role: 'Rol en la organización',
      organizationName: 'Nombre de la organización',
      description: 'Descripción',
      member: 'Miembro',
      categoryName: 'Nombre de la categoría',
      ownAccess: {
        title: 'Este es tu propio acceso',
        text: 'No puedes cambiar tu propio rol ni quitarte desde aquí: bajarlo te dejaría dentro de la organización sin el acceso necesario para deshacerlo. Otro administrador puede cambiarlo por ti, y salir de la organización es una decisión aparte.',
      },
    },
    stats: {
      title: 'Los tickets en cifras',
      total: 'Todos los tickets',
      unassigned: 'Abiertos o en curso, sin agente',
      firstResponse: 'Primera respuesta, de media',
      noFirstResponse: 'Aún no hay primeras respuestas',
      byStatus: 'Por estado',
      byPriority: 'Por prioridad',
      errorTitle: 'No se han podido leer las estadísticas',
    },
    apiKeys: {
      create: 'Crear clave',
      usage: 'Envía la clave en la cabecera X-API-Key.',
      docs: 'Referencia de la API pública',
      docsNote: 'El acceso lo da el equipo de la plataforma.',
      loading: 'Cargando las claves',
      errorTitle: 'No se han podido leer las claves',
      emptyTitle: 'Todavía no hay claves',
      emptyDescription:
        'Crea una cuando una integración necesite llegar a esta organización.',
      createdBy: 'Creada por {{username}} · {{date}}',
      expires: 'Caduca el {{date}}',
      expired: 'Caducó el {{date}}',
      noExpiry: 'No caduca',
      lastUsed: 'Último uso: {{date}}',
      neverUsed: 'Sin usar',
      revokedOn: 'Revocada el {{date}}',
      status: { ACTIVE: 'Activa', EXPIRED: 'Caducada', REVOKED: 'Revocada' },
      revoke: 'Revocar',
      revokeLabel: 'Revocar {{name}}',
      scopes: {
        ticketsRead: 'Leer tickets',
        ticketsWrite: 'Crear y modificar tickets',
        commentsRead: 'Leer comentarios',
        commentsWrite: 'Comentar tickets',
        categoriesRead: 'Leer categorías',
        categoriesWrite: 'Gestionar categorías',
        statsRead: 'Leer estadísticas',
      },
      dialog: {
        title: 'Crear una clave de API',
        description:
          'Ponle el nombre del sistema que la va a usar, y dale solo los permisos que necesita.',
        name: 'Nombre',
        namePlaceholder: 'Ejemplo: página de estado',
        scopes: 'Permisos',
        expiry: 'Caducidad',
        expiryOptions: {
          days30: 'En 30 días',
          days90: 'En 90 días',
          days180: 'En 180 días',
          days365: 'En un año',
          never: 'Nunca',
        },
        submit: 'Crear clave',
        submitting: 'Creando…',
      },
      secret: {
        title: 'Copia la clave ahora',
        description:
          'Es la única vez que se muestra: solo se guarda una huella de ella, así que nadie —ni un administrador— puede volver a enseñarla. Si la pierdes, revócala y crea otra.',
        label: 'Clave de {{name}}',
        copy: 'Copiar',
        copied: 'Copiada',
        copyFailed:
          'Aquí no se ha podido copiar: selecciónala y cópiala a mano.',
        done: 'Ya la he guardado',
      },
      revokeDialog: {
        title: '¿Revocar {{name}}?',
        description:
          'Lo que la use deja de funcionar en el acto. Una clave revocada no se puede recuperar: para volver a dar acceso, crea una nueva.',
        keep: 'Mantener la clave',
        confirm: 'Revocar clave',
      },
      revoked: 'Se ha revocado {{name}}.',
    },
    leave: {
      title: 'Salir de {{organization}}',
      description:
        'Pierdes en el acto el acceso a sus tickets. Tu cuenta no se ve afectada, y un administrador puede volver a darte un rol.',
      lastAdmin:
        'Eres su único administrador. Antes de salir, haz administrador a otro miembro: una organización siempre conserva uno.',
      button: 'Salir de la organización',
      confirmTitle: '¿Salir de {{organization}}?',
      confirmDescription:
        'Pierdes en el acto el acceso a {{organization}} y a sus tickets. Los tickets abiertos que tengas asignados vuelven a la cola sin asignar. Tu cuenta no se ve afectada.',
      stay: 'Quedarme',
      leaving: 'Saliendo…',
      done: 'Has salido de {{organization}}.',
    },
    access: {
      title: 'Roles y acceso',
      summary: 'Resumen',
      emailLabel: 'Dirección de correo',
      emailPlaceholder: 'persona@empresa.com',
      assign: 'Asignar rol',
      assigning: 'Asignando…',
      cancelReservation: 'Cancelar la reserva para {{email}}',
      reservedBy: 'Reservado por {{name}} · {{date}}',
      formerAdministrator: 'un antiguo administrador',
      never: 'Nunca',
      loadError: 'No se han podido cargar los roles',
      reservationCancelled: 'Se ha cancelado la reserva para {{email}}.',
      nothingWaiting: 'No hay nada en espera',
      waiting: {
        ACCOUNT: {
          label: 'Esperando a la cuenta',
          hint: 'Nadie ha registrado todavía esta dirección.',
        },
        VERIFICATION: {
          label: 'Esperando a que se confirme el correo',
          hint: 'La cuenta existe, pero su dirección aún no está confirmada.',
        },
      },
      link: {
        title: 'Cómo funciona el vínculo',
        stepOnePlatform:
          'Asignas el rol a una dirección de correo para toda la plataforma.',
        stepOneOrganization:
          'Asignas el rol a una dirección de correo en {{organization}}.',
        stepTwo:
          'La persona crea su propia cuenta con esa misma dirección, o ya tiene una.',
        stepThree:
          'El rol se activa en cuanto se confirma la dirección. Hasta entonces espera en la lista de abajo.',
        protection:
          'La confirmación es lo que protege el rol: cualquiera podría registrar la dirección de otra persona, pero solo su dueño puede confirmarla.',
      },
      matrix: {
        title: 'Qué puede hacer cada rol',
        description:
          'Roles fijos: los mismos tres en todas las organizaciones, y el servidor los aplica en cada petición.',
        label: 'Capacidades de cada rol de la organización',
        capability: 'Capacidad',
        yourRole: '(tu rol)',
        yes: 'Sí',
        no: 'No',
      },
      capabilities: {
        createTickets: 'Abrir tickets y comentarlos',
        readAllTickets: 'Ver todos los tickets de la organización',
        changeStatus: 'Cambiar el estado y hacerse cargo de tickets',
        internalNotes: 'Escribir notas internas',
        readStats: 'Consultar las estadísticas de la organización',
        assignOthers: 'Asignar tickets a otros agentes',
        manageCategories: 'Gestionar categorías',
        manageMembers: 'Asignar roles y gestionar miembros',
        manageOrganization: 'Editar o eliminar la organización',
        manageApiKeys: 'Gestionar claves de API',
      },
      none: {
        description:
          'Los roles se dan dentro de una organización, y todavía no hay ninguna que elegir.',
        title: 'No hay ninguna organización seleccionada',
        hint: 'Crea primero una organización; sus roles se gestionan aquí.',
        goTo: 'Ir a organizaciones',
      },
      manage: {
        eyebrow: 'ADMINISTRACIÓN DE LA ORGANIZACIÓN',
        description:
          'Da roles en {{organization}} a una dirección de correo, cámbialos y quita miembros. Una cuenta confirmada recibe el rol en el acto; cualquier otra dirección lo deja reservado hasta que la persona cree la cuenta con ella y la confirme.',
        actingAsPlatformAdmin:
          ' Estás actuando como administrador de la plataforma.',
        cards: {
          admins: 'Administradores',
          agents: 'Agentes de soporte',
          members: 'Miembros',
          waiting: 'Esperando a la persona',
        },
        assignTitle: 'Asignar un rol por correo',
        assignDescription: 'La dirección todavía no necesita tener cuenta.',
        roleLabel: 'Rol en esta organización',
        loading: 'Cargando los roles',
        membersTitle: 'Miembros de {{organization}}',
        membersDescription:
          'Cambiar un rol se aplica en el acto. Una organización siempre conserva al menos un administrador.',
        since: '{{email}} · desde el {{date}}',
        you: '{{name}} (tú)',
        roleOf: 'Rol de {{name}}',
        removeFrom: 'Quitar a {{name}} de {{organization}}',
        reservationsTitle: 'Reservado para una dirección de correo',
        reservationsDescription:
          'Roles dados a direcciones que todavía no tienen una cuenta confirmada. La persona entra cuando la confirma.',
        reservationsEmpty:
          'Cuando asignas un rol a una dirección sin cuenta confirmada, espera aquí.',
        feedback: {
          applied: '{{name}} ya tiene el rol {{role}} en {{organization}}.',
          unchanged: '{{name}} ya tenía el rol {{role}}. No ha cambiado nada.',
          reservedVerification:
            '{{role}} reservado para {{email}}. Esa cuenta existe, pero su dirección no está confirmada: entra en {{organization}} en cuanto lo esté. Le hemos enviado un correo.',
          reservedAccount:
            '{{role}} reservado para {{email}}. Nadie ha registrado todavía esa dirección: entra en {{organization}} cuando cree su cuenta con ella y la confirme. Le hemos enviado un correo.',
          changed: '{{name}} ya tiene el rol {{role}}.',
          removed:
            '{{name}} ya no forma parte de {{organization}}. Sus tickets abiertos han vuelto a la cola sin asignar.',
        },
        removeDialog: {
          eyebrow: 'ROLES Y ACCESO',
          title: '¿Quitar a {{name}}?',
          description:
            '{{name}} pierde en el acto el acceso a {{organization}} y a sus tickets. Sus tickets abiertos vuelven a la cola sin asignar. Su cuenta no se ve afectada.',
          keep: 'Mantener al miembro',
          confirm: 'Quitar miembro',
        },
        demoteDialog: {
          title: '¿Renunciar a tu propia administración?',
          description:
            'Dejarás de administrar {{organization}}: esta pantalla, los miembros, las categorías y las claves de API dejarán de estar a tu alcance. Otro administrador tendría que devolverte el rol.',
          keep: 'Seguir siendo administrador',
          confirm: 'Pasar a {{role}}',
        },
      },
      readOnly: {
        descriptionAgent:
          'Quién hace qué en {{organization}}. Los roles los asignan los administradores de la organización.',
        descriptionMember:
          'Tu acceso en {{organization}}, qué puede hacer cada rol y a quién pedir un cambio.',
        yourRole: 'Tu rol',
        needDifferent: '¿Necesitas otro rol?',
        onlyAdmin:
          'Solo un administrador de la organización puede cambiarlo. Escribe a uno de ellos desde Mensajes:',
        noAdmin: 'Ahora mismo no se ha podido mostrar ningún administrador.',
        peopleTitle: 'Personas de {{organization}}',
        peopleDescription:
          'Solo lectura. Los agentes ven quién se encarga de qué; los administradores lo gestionan.',
        loading: 'Cargando los miembros',
      },
    },
  },
  admin: {
    eyebrow: 'ADMINISTRACIÓN DE LA PLATAFORMA',
    platformAdministrator: 'Administrador de la plataforma',
    platformRole: {
      USER: 'Usuario estándar',
      GLOBAL_ADMIN: 'Administrador global',
    },
    accountState: {
      ACTIVE: 'Activa',
      SUSPENDED: 'Suspendida',
      PENDING: 'Invitación pendiente',
    },
    accessDenied: {
      title: 'Acceso restringido',
      description:
        'Solo los administradores de la plataforma pueden abrir esta zona. Si la necesitas, pide acceso a uno de ellos.',
      back: 'Volver al espacio de trabajo',
    },
    stats: {
      title: 'Actividad de la plataforma',
      tickets: 'Tickets',
      openTickets: 'Abiertos o en curso',
      messages: 'Mensajes de chat',
      attachments: 'Adjuntos',
      errorTitle: 'No se han podido leer las estadísticas de la plataforma',
    },
    users: {
      title: 'Usuarios',
      description:
        'Gestiona las cuentas de la plataforma, su acceso a las organizaciones y su estado.',
      invite: 'Invitar a un usuario',
      cards: {
        sampleUsers: 'Usuarios de ejemplo',
        accounts: 'Cuentas',
        active: 'Activas',
        administrators: 'Administradores',
        organizations: 'Organizaciones',
      },
      panelTitle: 'Usuarios de la plataforma',
      search: 'Buscar usuarios de la plataforma',
      searchPlaceholder: 'Busca por nombre o correo',
      roles: 'Roles',
      allRoles: 'Todos los roles',
      states: 'Estados',
      allStates: 'Todos los estados',
      columns: {
        user: 'USUARIO',
        organization: 'ORGANIZACIÓN',
        globalRole: 'ROL GLOBAL',
        state: 'ESTADO',
      },
      loading: 'Cargando usuarios…',
      edit: 'Editar a {{name}}',
      emptyTitle: 'Ningún usuario coincide con estos filtros',
      emptyDescription: 'Ajusta la búsqueda o los filtros de rol y estado.',
      errorTitle: 'No se han podido leer los usuarios',
      showingSample: 'Se muestran {{shown}} de {{total}} usuarios de ejemplo',
      showing: 'Se muestran {{shown}} de {{total}} cuentas e invitaciones',
      organizations_one: '{{count}} organización',
      organizations_other: '{{count}} organizaciones',
      invitedUser: 'Usuario invitado',
      locked: {
        primary:
          'Es el administrador principal, creado al desplegar: su rol y su estado no se pueden cambiar desde aquí.',
        self: 'Es tu propia cuenta: otro administrador tiene que cambiar tu rol o tu estado.',
        email:
          'La dirección de correo es la identidad para iniciar sesión y no se edita desde aquí. Suspender bloquea el acceso; eliminar cierra la cuenta.',
      },
      feedback: {
        invitationPrepared: 'Invitación preparada para {{email}}.',
        updated: 'Se ha actualizado a {{name}}.',
        platformReserved:
          'Invitación enviada a {{email}}: la administración de la plataforma queda reservada hasta que cree la cuenta y confirme la dirección.',
        platformApplied:
          '{{name}} ya tenía cuenta y ahora es administrador de la plataforma.',
        organizationFirst:
          'Crea primero una organización: a un usuario estándar se le invita a una.',
        roleReserved:
          'Invitación enviada a {{email}}: el rol queda reservado hasta que cree la cuenta y confirme la dirección.',
        roleApplied: '{{name}} ya tenía cuenta y ahora tiene el rol.',
        deleted: 'Se ha eliminado la cuenta de {{name}}.',
      },
    },
    userDialog: {
      inviteTitle: 'Invitar a un usuario',
      editTitle: 'Editar un usuario de la plataforma',
      inviteDescription:
        'La persona crea su propia cuenta y su contraseña con esta dirección. El acceso que elijas queda reservado para ella y se activa cuando la confirme; en el acto si ya tiene una cuenta confirmada.',
      editDescription:
        'Actualiza la identidad, el rol y el estado de la cuenta de {{name}}.',
      delete: 'Eliminar',
      send: 'Enviar invitación',
      save: 'Guardar cambios',
      fullName: 'Nombre completo',
      email: 'Dirección de correo',
      platformAccess: 'Acceso a la plataforma',
      initialOrganization: 'Organización inicial',
      organizationRole: 'Rol en la organización',
      accountState: 'Estado de la cuenta',
      notes: {
        globalAdmin:
          'Un administrador de la plataforma puede actuar en todas las organizaciones sin ser miembro de ninguna.',
        standardUser:
          'Nada se activa hasta que la persona confirma la dirección: registrarla no basta, así que nadie puede quedarse con la invitación de otra persona.',
        edit: 'Suspender bloquea el acceso. Borrar los datos personales sigue siendo una solicitud de privacidad aparte, que confirma la propia persona.',
      },
      deleteConfirm: {
        title: '¿Eliminar a {{name}}?',
        description:
          '{{name}} ya no podrá iniciar sesión: todas sus sesiones se cierran ahora y la cuenta desaparece de la plataforma. Sus tickets y comentarios se quedan, para quienes dependen de ellos.',
        keep: 'Conservar la cuenta',
        confirm: 'Eliminar la cuenta',
      },
    },
    roles: {
      title: 'Roles de la plataforma',
      eyebrowDialog: 'ROLES DE LA PLATAFORMA',
      description:
        'Da la administración de la plataforma a una dirección de correo. Una cuenta confirmada la recibe en el acto; cualquier otra dirección la deja reservada hasta que la persona cree la cuenta con ella y la confirme.',
      cards: {
        administrators: 'Administradores de la plataforma',
        waitingAccount: 'Esperando a una cuenta',
        waitingVerification: 'Esperando a que se confirme el correo',
      },
      assignTitle: 'Asignar un rol de plataforma',
      assignDescription:
        'Toda cuenta empieza como usuario estándar. Para retirarle la administración a alguien, usa Retirar en la lista de abajo.',
      roleToAssign: 'Rol que se asigna',
      roleDescription:
        'Gestiona todas las cuentas, organizaciones y roles de la plataforma, actúa en cualquier organización y consulta el registro de auditoría.',
      loading: 'Cargando los roles de la plataforma',
      administratorsDescription:
        'Pueden gestionar toda la plataforma. El administrador principal se crea al desplegar y no se puede retirar desde aquí.',
      you: 'Tú',
      primary: 'Principal · protegido',
      unconfirmed: 'Dirección sin confirmar',
      suspended: 'Suspendida',
      lastSignIn: 'Último inicio de sesión: {{date}}',
      ownRole: 'Tu propio rol',
      protected: 'Protegido',
      withdraw: 'Retirar',
      withdrawFrom: 'Retirar la administración de la plataforma a {{name}}',
      reservationsTitle: 'Reservado para una dirección de correo',
      reservationsDescription:
        'Direcciones que pasarán a administrar la plataforma cuando exista la cuenta y se confirme la dirección.',
      reservationsEmpty:
        'Cuando asignas el rol a una dirección sin cuenta confirmada, espera aquí.',
      feedback: {
        applied:
          '{{name}} ya es administrador de la plataforma. El cambio se aplica en el acto a su sesión actual.',
        unchanged:
          '{{name}} ya era administrador de la plataforma. No ha cambiado nada.',
        reservedVerification:
          'Reservado para {{email}}. Esa cuenta existe, pero su dirección no está confirmada: el rol se aplica en cuanto lo esté. Le hemos enviado un correo.',
        reservedAccount:
          'Reservado para {{email}}. Nadie ha registrado todavía esa dirección: el rol se aplica cuando cree su cuenta con ella y la confirme. Le hemos enviado un correo.',
        withdrawn:
          '{{name}} vuelve a ser un usuario estándar. Su cuenta y sus roles en las organizaciones no cambian.',
        cancelled:
          'Se ha cancelado la reserva para {{email}}. Confirmar esa dirección ya no da ningún rol.',
      },
      withdrawDialog: {
        title: '¿Retirar la administración de la plataforma?',
        description:
          '{{name}} conserva su cuenta, sus organizaciones y sus roles en ellas. Lo que pierde, en el acto, es la administración de la plataforma.',
        keep: 'Mantener el rol',
        confirm: 'Retirar la administración',
      },
    },
  },
  errors: {
    common: {
      unexpected: 'Error inesperado. Inténtalo de nuevo.',
      network: 'Sin conexión con el servidor.',
      validationFailed: 'Revisa los campos marcados.',
      payloadTooLarge: 'La petición es demasiado grande.',
      malformedBody: 'No se ha podido leer la petición.',
      emptyPatch: 'No hay nada que actualizar.',
      duplicate: 'Eso ya existe.',
      internal: 'Algo ha fallado por nuestra parte. Inténtalo de nuevo.',
      invalidIdentifier: 'Ese identificador no es válido.',
      notFound: 'No existe, o no tienes acceso.',
      rateLimited:
        'Demasiadas peticiones. Espera un momento y vuelve a intentarlo.',
      routeNotFound: 'Esa dirección no existe.',
      stillReferenced: 'No se puede borrar mientras algo lo siga usando.',
    },
    auth: {
      sessionExpired: 'Tu sesión ha caducado. Vuelve a iniciar sesión.',
      invalidCredentials: 'Correo o contraseña incorrectos.',
      wrongPassword: 'La contraseña actual no es correcta.',
      serverUnavailable:
        'El servidor no está disponible temporalmente. Inténtalo de nuevo.',
      requestFailed: 'La petición ha fallado. Inténtalo de nuevo.',
      emptyLoginResponse:
        'El servidor devolvió una respuesta de inicio de sesión vacía. Inténtalo de nuevo.',
      emptyRegistrationResponse:
        'El servidor devolvió una respuesta de registro vacía. Inténtalo de nuevo.',
      accountDisabled: 'Esta cuenta ha sido desactivada.',
      accountLocked:
        'Demasiados intentos fallidos. La cuenta queda bloqueada un tiempo.',
      emailTaken: 'Ese correo ya está registrado.',
      refreshReused:
        'Tu sesión se ha usado desde otro sitio, así que se han cerrado todas. Vuelve a iniciar sesión.',
      tokenInvalid: 'El enlace no es válido o ha caducado.',
      usernameTaken: 'Ese nombre de usuario ya está cogido.',
    },
    password: {
      required: 'La contraseña es obligatoria.',
      tooShort: 'Al menos 10 caracteres.',
      tooLong: 'Como máximo 128 caracteres.',
      needsLowercase: 'Añade una minúscula.',
      needsUppercase: 'Añade una mayúscula.',
      needsDigit: 'Añade un dígito.',
      needsSymbol: 'Añade un símbolo.',
      mismatch: 'Las contraseñas no coinciden.',
      mustDiffer: 'Elige una contraseña distinta de la actual.',
    },
    field: {
      required: 'Este campo es obligatorio.',
      invalid: 'Revisa este campo.',
      tooShort: 'Este valor es demasiado corto.',
      tooLong: 'Este valor es demasiado largo.',
    },
    username: {
      tooShort: 'Al menos 3 caracteres.',
      tooLong: 'Como máximo 32 caracteres.',
      invalidChars: 'Solo letras, dígitos, "_" y "-".',
    },
    terms: { required: 'Debes aceptar los términos.' },
    ticket: {
      titleTooShort: 'El título es demasiado corto.',
      titleTooLong: 'El título es demasiado largo.',
      descriptionTooShort: 'La descripción es demasiado corta.',
      descriptionTooLong: 'La descripción es demasiado larga.',
      resolutionRequired:
        'Hace falta una resolución de al menos 20 caracteres.',
      assigneeNotAgent:
        'Sólo se puede asignar a un agente de esta organización.',
      invalidTransition: 'El ticket no puede pasar a ese estado desde aquí.',
      locked: 'Su autor ya no puede editar este ticket.',
      notFound: 'Ese ticket no existe, o no tienes acceso.',
    },
    comment: { empty: 'El comentario está vacío.' },
    org: {
      nameTooShort: 'El nombre de la organización es demasiado corto.',
      alreadyMember: 'Esa persona ya es miembro.',
      cannotLowerOwnRole:
        'No puedes bajarte el rol a ti mismo: tiene que hacerlo otro administrador, o puedes salir de la organización.',
      lastAdmin:
        'Una organización tiene que conservar al menos un administrador.',
      notFound: 'Esa organización no existe, o no perteneces a ella.',
      slugTaken: 'Esa dirección de organización ya está en uso.',
    },
    category: { nameTaken: 'Ya existe una categoría con ese nombre.' },
    apiKey: {
      invalid: 'La clave de API falta, no es válida o está revocada.',
      missingScope: 'La clave de API no tiene el permiso que hace falta.',
      scopesRequired: 'Elige al menos un permiso.',
    },
    email: { invalid: 'Escribe una dirección de correo válida.' },
    color: { invalid: 'Elige un color válido.' },
    slug: { invalid: 'Sólo minúsculas, dígitos y guiones.' },
    timezone: { invalid: 'Elige una zona horaria válida.' },
    message: { empty: 'El mensaje está vacío.' },
    rbac: { forbidden: 'Tu rol no permite hacer esto.' },
    file: {
      tooLarge: 'El fichero es demasiado grande.',
      imageUnreadable:
        'No se ha podido leer la imagen: está dañada o no es una imagen.',
      tooMany: 'Este ticket ya tiene el máximo de adjuntos.',
      typeNotAllowed: 'Ese tipo de fichero no está permitido.',
      uploadRejected: 'El fichero se ha rechazado.',
    },
    friend: {
      exists: 'Ya existe una amistad o una solicitud.',
      self: 'No puedes añadirte a ti mismo como amigo.',
      targetRequired: 'Indica a quién quieres añadir.',
    },
    gdpr: {
      pending: 'Ya tienes una solicitud pendiente de este tipo.',
      tokenInvalid: 'El enlace de confirmación no es válido o ha caducado.',
      usernameMismatch: 'El nombre de usuario no coincide con tu cuenta.',
    },
  },
};
