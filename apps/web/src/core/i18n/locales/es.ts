import type { Translation } from './en';

export const es: Translation = {
  common: {
    actions: {
      save: 'Guardar',
      cancel: 'Cancelar',
      retry: 'Reintentar',
      close: 'Cerrar',
      search: 'Buscar',
      signOut: 'Cerrar sesión',
    },
    state: {
      loading: 'Cargando…',
      empty: 'Aún no hay nada aquí',
      error: 'Algo ha salido mal',
    },
    language: 'Idioma',
  },
  nav: {
    tickets: 'Tickets',
    people: 'Personas',
    messages: 'Mensajes',
    organization: 'Organización',
    account: 'Cuenta',
    admin: 'Administración',
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
        categoryPlaceholder: 'Selecciona una categoría...',
        noCategories: 'Sin categorías disponibles',
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
  errors: {
    common: {
      unexpected: 'Error inesperado. Inténtalo de nuevo.',
      network: 'Sin conexión con el servidor.',
      validationFailed: 'Revisa los campos marcados.',
      payloadTooLarge: 'La petición es demasiado grande.',
      malformedBody: 'No se ha podido leer la petición.',
      emptyPatch: 'No hay nada que actualizar.',
    },
    auth: {
      sessionExpired: 'Tu sesión ha caducado. Vuelve a iniciar sesión.',
      invalidCredentials: 'Correo o contraseña incorrectos.',
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
    },
    comment: { empty: 'El comentario está vacío.' },
    org: { nameTooShort: 'El nombre de la organización es demasiado corto.' },
    file: { tooLarge: 'El fichero es demasiado grande.' },
  },
};
