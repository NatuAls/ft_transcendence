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
  account: {
    back: '‹ Cuenta',
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
      wrongPassword: 'La contraseña actual no es correcta.',
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
    field: { required: 'Este campo es obligatorio.' },
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
