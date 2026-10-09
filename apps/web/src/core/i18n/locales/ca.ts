import type { Translation } from './en';

export const ca: Translation = {
  common: {
    actions: {
      save: 'Desa',
      cancel: 'Cancel·la',
      retry: 'Torna-ho a provar',
      close: 'Tanca',
      search: 'Cerca',
      signOut: 'Tanca la sessió',
    },
    state: {
      loading: 'Carregant…',
      empty: 'Encara no hi ha res aquí',
      error: 'Alguna cosa ha fallat',
    },
    language: 'Idioma',
  },
  nav: {
    tickets: 'Tiquets',
    people: 'Persones',
    messages: 'Missatges',
    organization: 'Organització',
    account: 'Compte',
    admin: 'Administració',
  },
  account: {
    back: '‹ Compte',
    password: {
      title: 'Canvia la contrasenya',
      description: 'Actualitza la contrasenya per protegir el compte.',
      current: 'Contrasenya actual',
      new: 'Contrasenya nova',
      confirm: 'Confirma la contrasenya nova',
      sessionWarning:
        'Es tancarà la sessió en tots els teus dispositius, també en aquest.',
      submit: 'Canvia la contrasenya',
      saving: 'S’està canviant la contrasenya…',
      success: 'La contrasenya s’ha canviat correctament.',
    },
  },
  tickets: {
    title: 'Tiquets',
    new: 'Tiquet nou',
    empty: 'Cap tiquet coincideix amb aquests filtres.',
    status: {
      OPEN: 'Obert',
      IN_PROGRESS: 'En curs',
      RESOLVED: 'Resolt',
      CLOSED: 'Tancat',
    },
    priority: { LOW: 'Baixa', MEDIUM: 'Mitjana', HIGH: 'Alta' },
  },
  errors: {
    common: {
      unexpected: 'Error inesperat. Torna-ho a provar.',
      network: 'Sense connexió amb el servidor.',
      validationFailed: 'Revisa els camps marcats.',
      payloadTooLarge: 'La petició és massa gran.',
      malformedBody: "No s'ha pogut llegir la petició.",
      emptyPatch: 'No hi ha res per actualitzar.',
    },
    auth: {
      sessionExpired: 'La sessió ha caducat. Torna a iniciar la sessió.',
      invalidCredentials: 'Correu o contrasenya incorrectes.',
      wrongPassword: 'La contrasenya actual no és correcta.',
    },
    password: {
      required: 'La contrasenya és obligatòria.',
      tooShort: 'Com a mínim 10 caràcters.',
      tooLong: 'Com a màxim 128 caràcters.',
      needsLowercase: 'Afegeix una minúscula.',
      needsUppercase: 'Afegeix una majúscula.',
      needsDigit: 'Afegeix un dígit.',
      needsSymbol: 'Afegeix un símbol.',
      mismatch: 'Les contrasenyes no coincideixen.',
      mustDiffer: 'Tria una contrasenya diferent de l’actual.',
    },
    field: { required: 'Aquest camp és obligatori.' },
    username: {
      tooShort: 'Com a mínim 3 caràcters.',
      tooLong: 'Com a màxim 32 caràcters.',
      invalidChars: 'Només lletres, dígits, "_" i "-".',
    },
    terms: { required: "Has d'acceptar els termes." },
    ticket: {
      titleTooShort: 'El títol és massa curt.',
      titleTooLong: 'El títol és massa llarg.',
      descriptionTooShort: 'La descripció és massa curta.',
      descriptionTooLong: 'La descripció és massa llarga.',
      resolutionRequired: "Cal una resolució d'almenys 20 caràcters.",
    },
    comment: { empty: 'El comentari és buit.' },
    org: { nameTooShort: "El nom de l'organització és massa curt." },
    file: { tooLarge: 'El fitxer és massa gran.' },
  },
};
