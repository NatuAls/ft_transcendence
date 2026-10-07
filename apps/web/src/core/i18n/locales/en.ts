// Inglés: idioma base y de reserva. Cada clave nueva se añade AQUÍ primero
// y después en es.ts y ca.ts (el tipo Translation obliga a que estén las tres).
export const en = {
  common: {
    actions: {
      save: 'Save',
      cancel: 'Cancel',
      retry: 'Retry',
      close: 'Close',
      search: 'Search',
      signOut: 'Sign out',
    },
    state: {
      loading: 'Loading…',
      empty: 'Nothing here yet',
      error: 'Something went wrong',
    },
    language: 'Language',
  },
  nav: {
    tickets: 'Tickets',
    people: 'People',
    messages: 'Messages',
    organization: 'Organization',
    account: 'Account',
    admin: 'Administration',
  },
  tickets: {
    title: 'Tickets',
    new: 'New ticket',
    empty: 'No tickets match these filters.',
    status: {
      OPEN: 'Open',
      IN_PROGRESS: 'In progress',
      RESOLVED: 'Resolved',
      CLOSED: 'Closed',
    },
    priority: { LOW: 'Low', MEDIUM: 'Medium', HIGH: 'High' },
    create: {
      title: 'Create a ticket',
      subtitle: 'Describe the issue clearly so the right person can help.',
      back: 'Back to tickets',
      breadcrumbs: 'TICKETS / NEW',
      detailsTitle: 'Ticket details',
      requiredNote: 'All fields marked * are required.',
      fields: {
        subject: 'Subject *',
        subjectPlaceholder: 'Short summary of the issue',
        organization: 'Organization *',
        category: 'Category',
        categoryPlaceholder: 'Select a category...',
        noCategories: 'No categories available',
        description: 'Description *',
        descriptionPlaceholder:
          'Explain what happened, what you expected and any steps that reproduce the problem.',
        priority: 'Priority *',
        priorityDescriptions: {
          low: 'Can wait',
          medium: 'Needs attention',
          high: 'Work is blocked',
        },
      },
      actions: {
        cancel: 'Cancel',
        submit: 'Create ticket',
        submitting: 'Creating...',
      },
      done: 'Ticket created successfully.',
      aside: {
        before: 'BEFORE YOU SUBMIT',
        helpTitle: 'Help us solve it faster',
        tips: {
          specificTitle: 'Be specific',
          specificText: 'Use a clear subject that describes the problem.',
          contextTitle: 'Add context',
          contextText: 'Explain what changed and who is affected.',
          priorityTitle: 'Choose priority',
          priorityText: 'Use High only when work is blocked.',
        },
        nextTitle: 'What happens next?',
        steps: {
          open: 'Open — Your request joins the queue.',
          inProgress: 'In progress — An agent takes ownership.',
          resolved: 'Resolved — You review the proposed solution.',
        },
      },
    },
  },
  // Las claves de error coinciden con el messageKey que devuelve la API:
  // t(error.messageKey) funciona sin mapas intermedios.
  errors: {
    common: {
      unexpected: 'Unexpected error. Please try again.',
      network: 'No connection to the server.',
      validationFailed: 'Please review the highlighted fields.',
      payloadTooLarge: 'The request is too large.',
      malformedBody: 'The request could not be read.',
      emptyPatch: 'Nothing to update.',
    },
    auth: {
      sessionExpired: 'Your session has expired. Please sign in again.',
      invalidCredentials: 'Wrong email or password.',
    },
    password: {
      required: 'Password is required.',
      tooShort: 'At least 10 characters.',
      tooLong: 'At most 128 characters.',
      needsLowercase: 'Add a lowercase letter.',
      needsUppercase: 'Add an uppercase letter.',
      needsDigit: 'Add a digit.',
      needsSymbol: 'Add a symbol.',
      mismatch: 'Passwords do not match.',
    },
    username: {
      tooShort: 'At least 3 characters.',
      tooLong: 'At most 32 characters.',
      invalidChars: 'Only letters, digits, "_" and "-".',
    },
    terms: { required: 'You must accept the terms.' },
    ticket: {
      titleTooShort: 'Title is too short.',
      titleTooLong: 'Title is too long.',
      descriptionTooShort: 'Description is too short.',
      descriptionTooLong: 'Description is too long.',
      resolutionRequired: 'A resolution of at least 20 characters is required.',
    },
    comment: { empty: 'The comment is empty.' },
    org: { nameTooShort: 'Organization name is too short.' },
    file: { tooLarge: 'The file is too large.' },
  },
};

export type Translation = typeof en;
