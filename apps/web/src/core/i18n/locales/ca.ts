import type { Translation } from './en';

export const ca: Translation = {
  common: {
    actions: {
      save: 'Desa',
      cancel: 'Cancel·la',
      retry: 'Torna-ho a provar',
      refresh: 'Actualitza',
      close: 'Tanca',
      search: 'Cerca',
      signOut: 'Tanca la sessió',
    },
    state: {
      loading: 'Carregant…',
      empty: 'Encara no hi ha res aquí',
      error: 'Alguna cosa ha fallat',
      refreshing: 'S’està actualitzant…',
      updatedAt: 'Actualitzat: {{time}} · es refresca cada minut',
    },
    language: 'Idioma',
    notFound: {
      title: 'Pàgina no trobada',
      description: 'L’adreça no coincideix amb cap pàgina disponible.',
      back: 'Tornar als tiquets',
    },
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
    home: {
      profileTitle: 'Configuració del perfil',
      description: 'Gestiona les teves dades personals i la privacitat.',
      editProfile: 'Edita el perfil',
      user: 'Usuari',
      settingsLabel: 'Configuració del compte',
      preferences: {
        title: 'Preferències',
        description:
          'Tria com es mostren les dates i es programen les notificacions.',
        summary: 'Zona horària · {{timezone}}',
      },
      privacy: {
        title: 'Privacitat i dades',
        description: 'Exporta o elimina la teva informació',
      },
      sessions: {
        title: 'Sessions i dispositius',
        description: 'Consulta on has iniciat sessió i tanca dispositius',
      },
    },
    preferences: {
      title: 'Preferències',
      description:
        'Tria com es mostren les dates i es programen les notificacions.',
      language: 'Idioma',
      languages: { en: 'English', es: 'Español', ca: 'Català' },
      timezone: 'Zona horària',
      timezoneHelp:
        'El navegador ha detectat {{timezone}}. Aquesta opció controla les marques de temps dels tiquets i la programació futura de notificacions.',
      theme: 'Tema',
      themes: { light: 'Clar', dark: 'Fosc', system: 'Sistema' },
      notifications: 'Notificacions',
      notifyOnTicketUpdate: 'Actualitzacions de tiquets',
      notifyOnComment: 'Comentaris',
      notifyOnMention: 'Mencions',
      notifyOnMessage: 'Missatges',
      notifyOnFriendship: 'Sol·licituds d’amistat',
      saved: 'Preferència desada correctament.',
    },
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
    list: {
      greeting: 'Bon dia, {{name}}',
      attention_one: '{{count}} tiquet necessita atenció',
      attention_other: '{{count}} tiquets necessiten atenció',
      description: {
        organization:
          'Segueix les sol·licituds de la teva organització i fes avançar la feina.',
        personal: 'Segueix les sol·licituds que has creat i el seu progrés.',
      },
      stats: {
        open: 'Oberts',
        inProgress: 'En curs',
        resolved: 'Resolts',
        highPriority: 'Prioritat alta',
      },
      summary: 'Resum de tiquets',
      categoryFilter: 'Filtre de categoria',
      backToCategories: 'Tornar a categories',
      clearFilter: 'Netejar filtre',
      allTickets: 'Tots els tiquets',
      yourTickets: 'Els teus tiquets',
      results_one: '{{count}} resultat',
      results_other: '{{count}} resultats',
      searchLabel: 'Cercar tiquets',
      searchPlaceholder: 'Cerca per títol o descripció',
      empty: {
        title: 'Encara no hi ha tiquets',
        description:
          'Crea el teu primer tiquet per començar a seguir sol·licituds.',
        filteredDescription:
          'Prova d’ajustar o netejar la cerca i els filtres per veure més resultats.',
      },
      errorTitle: 'No s’han pogut carregar els tiquets',
      unassigned: 'Sense assignar',
      noCategory: 'Sense categoria',
      createdBy: 'Creat per {{name}}',
      assignedTo: 'Assignat a {{name}}',
      viewAll_one: 'Veure el tiquet',
      viewAll_other: 'Veure els {{count}} tiquets',
      showing: 'Mostrant {{from}}–{{to}} de {{count}}',
      pages: 'Pàgines de tiquets',
    },
    table: {
      ticket: 'Tiquet',
      status: 'Estat',
      priority: 'Prioritat',
      assignee: 'Assignat a',
      updated: 'Actualitzat',
      createdBy: 'Creat per',
    },
    detail: {
      back: 'Tornar als tiquets',
      title: 'Detall del tiquet',
      actions: 'Accions del tiquet',
      updated: 'Actualitzat {{date}}',
      reopen: 'Reobrir el tiquet',
      confirmClose: 'Confirma i tanca',
      closeTicket: 'Confirma la resolució',
      closeDescription:
        'Revisa la resolució proposada abans de tancar aquest tiquet.',
      noResolution: 'No s’ha proporcionat cap resolució.',
      requester: 'Sol·licitant',
      details: 'Detalls del tiquet',
      conversation: 'Conversació',
      conversationRestricted:
        'Només el creador, el suport assignat o un administrador de l’organització poden accedir a aquesta conversa.',
      loadingConversation: 'S’està carregant la conversa…',
      conversationFailed: 'No s’ha pogut carregar la conversa.',
      reply: 'Respondre',
      replyPlaceholder: 'Escriu una resposta…',
      sendReply: 'Envia la resposta',
      send: 'Envia',
      status: 'Estat',
      priority: 'Prioritat',
      category: 'Categoria',
      organization: 'Organització',
      created: 'Creat',
      assignment: 'Assignació',
      assignmentDescription: 'Assignació actual del tiquet.',
      assignee: 'Assignat a',
      ticketClosed: 'Tiquet tancat',
      closedDescription:
        'El sol·licitant ha confirmat la resolució. La conversa continua disponible com a referència.',
      adminReassignOnly:
        'Només els administradors de l’organització poden reasignar aquest tiquet.',
      agentOptions: 'Opcions de l’agent',
      agentOptionsDescription:
        'Actualitza la prioritat i la categoria del tiquet.',
      resolutionDescription:
        'Afegeix una resolució abans de marcar aquest tiquet com a resolt.',
      resolutionEyebrow: 'RESOLUCIÓ',
      saving: 'Desant…',
      markResolved: 'Marca com a resolt',
      resolveTicket: 'Resol el tiquet',
      resolution: 'Resolució',
      resolutionPlaceholder:
        'Descriu com s’ha resolt el problema (com a mínim 20 caràcters).',
      actionsDescription: 'Accions disponibles per al tiquet {{id}}.',
      eyebrow: 'TIQUET',
      returnToTickets: 'Tornar als tiquets',
      copyId: 'Copiar l’ID del tiquet',
      loadError: 'No s’ha pogut carregar el tiquet',
      notFound: 'Tiquet no trobat',
      notFoundDescription: 'És possible que aquest tiquet s’hagi eliminat.',
      assignToMe: 'Assigna’m el tiquet',
      issueDescription: 'Descripció del problema',
      closedReadOnly:
        'Aquest tiquet és de només lectura mentre està tancat. Reobre’l abans d’afegir una resposta.',
      newLineHint: 'Majúscules + Retorn per a una línia nova',
      feedback: {
        replyAdded: 'Resposta afegida.',
        replyFailed: 'No s’ha pogut afegir la resposta. Torna-ho a provar.',
        priorityUpdated: 'Prioritat actualitzada.',
        priorityFailed:
          'No s’ha pogut actualitzar la prioritat. Torna-ho a provar.',
        assigneeUpdated: 'Assignació actualitzada.',
        assigneeFailed:
          'No s’ha pogut actualitzar l’assignació. Torna-ho a provar.',
        categoryUpdated: 'Categoria actualitzada.',
        categoryFailed:
          'No s’ha pogut actualitzar la categoria. Torna-ho a provar.',
        closed: 'Tiquet tancat.',
        resolved: 'Tiquet marcat com a resolt.',
        reopened: 'Tiquet reobert.',
        statusFailed: 'No s’ha pogut actualitzar l’estat. Torna-ho a provar.',
        assignedToMe: 'Tiquet assignat i mogut a “En curs”.',
        assignToMeFailed:
          'No s’ha pogut assignar el tiquet. Torna-ho a provar.',
        idCopied: 'ID del tiquet copiat.',
        copyUnavailable: 'No es pot copiar en aquest navegador. ID: {{id}}.',
      },
    },
    filters: {
      title: 'Filtrar tiquets',
      description: 'Combina camps per acotar la llista de tiquets.',
      apply: 'Aplicar filtres',
      more: 'Més filtres',
      status: { label: 'Estat', all: 'Tots els estats' },
      priority: { label: 'Prioritat', all: 'Totes les prioritats' },
      category: { label: 'Categoria', all: 'Totes les categories' },
      sort: { label: 'Ordenació', newest: 'Més nous', oldest: 'Més antics' },
    },
    create: {
      title: 'Crear un tiquet',
      subtitle:
        'Descriu el problema clarament perquè la persona adequada et pugui ajudar.',
      back: 'Tornar a tiquets',
      breadcrumbs: 'TIQUETS / NOU',
      detailsTitle: 'Detalls del tiquet',
      requiredNote: 'Tots els camps marcats amb * són obligatoris.',
      fields: {
        subject: 'Assumpte *',
        subjectPlaceholder: 'Breu resum del problema',
        organization: 'Organització *',
        category: 'Categoria',
        categoryPlaceholder: 'Selecciona una categoria (opcional)...',
        categoryUnassignedHelp:
          "Si tens dubtes, deixa la categoria en blanc. L'equip de suport la classificarà per tu.",
        description: 'Descripció *',
        descriptionPlaceholder:
          'Explica què ha passat, què esperaves i els passos per reproduir el problema.',
        priority: 'Prioritat *',
        priorityDescriptions: {
          low: 'Pot esperar',
          medium: 'Requereix atenció',
          high: 'El treball està bloquejat',
        },
      },
      actions: {
        cancel: 'Cancel·lar',
        submit: 'Crear tiquet',
        submitting: 'Creant...',
      },
      done: 'Tiquet creat amb èxit.',
      aside: {
        before: "ABANS D'ENVIAR",
        helpTitle: 'Ajuda’ns a resoldre-ho més ràpid',
        tips: {
          specificTitle: 'Sigues específic',
          specificText:
            'Fes servir un assumpte clar que descrigui el problema.',
          contextTitle: 'Afegeix context',
          contextText: 'Explica què ha canviat i a qui afecta.',
          priorityTitle: 'Tria la prioritat',
          priorityText:
            'Fes servir Alta només quan el treball estigui bloquejat.',
        },
        nextTitle: 'Què passa després?',
        steps: {
          open: 'Obert — La teva sol·licitud s’uneix a la cua.',
          inProgress: 'En progrés — Un agent se’n fa càrrec.',
          resolved: 'Resolt — Reavises la solució proposada.',
        },
      },
    },
  },
  organization: {
    eyebrow: 'ORGANITZACIÓ',
    role: {
      MEMBER: 'Membre',
      AGENT: 'Agent de suport',
      ORG_ADMIN: 'Administrador de l’organització',
    },
    roleDescription: {
      MEMBER: 'Obre tiquets i segueix les seves pròpies sol·licituds.',
      AGENT:
        'Treballa tots els tiquets de l’organització: estat, autoassignació i notes internes.',
      ORG_ADMIN:
        'Tot el que fa un agent, i a més membres, rols, categories, claus d’API i la mateixa organització.',
    },
    roleInOrganization: '{{role}} a {{organization}}',
    someOrganization: 'una organització',
    members_one: '{{count}} membre',
    members_other: '{{count}} membres',
    tickets_one: '{{count}} tiquet',
    tickets_other: '{{count}} tiquets',
    defaultDescription: 'Suport i sol·licituds de servei de l’organització.',
    list: {
      eyebrow: 'ORGANITZACIONS',
      eyebrowPlatform: 'PLATAFORMA',
      title: 'Les teves organitzacions',
      titlePlatform: 'Organitzacions',
      description: 'Tria una organització per continuar amb l’accés que tens.',
      descriptionPlatform: 'Revisa les organitzacions de la plataforma.',
      new: 'Organització nova',
      search: 'Cerca organitzacions',
      count_one: '{{count}} organització',
      count_other: '{{count}} organitzacions',
      open: 'Obre l’organització',
      platformAccess: 'Accés de plataforma',
      yours: 'La teva organització',
      pendingAdministrator: 'Invitació d’administració pendent · {{email}}',
      noResults: {
        title: 'No s’ha trobat cap organització',
        description: 'Prova amb una altra cerca.',
      },
      none: {
        title: 'Encara no hi ha organitzacions',
        description:
          'Un administrador d’una organització ha de donar un rol a la teva adreça de correu.',
        descriptionPlatform: 'Crea la primera amb Organització nova.',
      },
    },
    create: {
      title: 'Crea una organització',
      description:
        'Crea l’organització i dona’n l’administració a una adreça de correu. La persona la rep encara que no tingui compte: s’activa quan en creï un amb aquella adreça i la confirmi.',
      name: 'Nom de l’organització',
      namePlaceholder: 'Exemple: Suport Acme',
      descriptionLabel: 'Descripció',
      descriptionPlaceholder: 'A què dona suport aquesta organització',
      administrator: 'Administrador inicial de l’organització',
      administratorPlaceholder: 'admin@empresa.com',
      url: 'Adreça de l’organització',
      urlPlaceholder: 'nom-de-l-organitzacio',
      urlHelp:
        'Es genera a partir del nom. Si ja està en ús, t’ho direm en crear l’organització.',
      submit: 'Crea l’organització',
      submitting: 'S’està creant…',
      invalidEmail: 'Escriu una adreça de correu vàlida per a l’administrador.',
      duplicate:
        'Ja existeix una organització amb aquest nom o aquesta adreça.',
      createdPreview:
        'S’ha creat {{name}} i s’ha preparat la invitació del seu administrador en aquesta vista prèvia.',
      createdReserved:
        'S’ha creat {{name}}. La seva administració queda reservada per a {{email}}: s’activa quan aquella adreça creï el compte i el confirmi.',
      createdApplied: 'S’ha creat {{name}} i l’administra {{administrator}}.',
      createdWithoutAdministrator:
        'S’ha creat {{name}}, però no s’ha pogut assignar l’administrador: {{reason}} Assigna’l des de Rols i accés.',
    },
    page: {
      eyebrowSettings: 'CONFIGURACIÓ DE L’ORGANITZACIÓ',
      descriptionAgent:
        'Revisa la càrrega de tiquets i les categories que fa servir aquesta organització.',
      descriptionMember:
        'Consulta el teu accés i les categories disponibles en crear tiquets.',
      adminTools: 'Eines d’administració',
      edit: 'Edita l’organització',
      stats: {
        members: 'Membres',
        agents: 'Agents de suport',
        openTickets: 'Tiquets oberts',
        categories: 'Categories',
      },
      yourAccess: 'El teu accés',
      visibility: 'Visibilitat dels tiquets',
      yourTicketsOnly: 'Només els teus tiquets',
      tabsLabel: 'Configuració de l’organització',
      tabs: {
        members: 'Membres',
        roles: 'Rols d’accés',
        categories: 'Categories',
        apiKeys: 'Claus d’API',
      },
      title: {
        members: 'Membres i accés',
        roles: 'Rols d’accés i permisos',
        categories: 'Categories de tiquets',
        apiKeys: 'Claus d’API',
      },
      description: {
        members: 'Els canvis només s’apliquen dins de {{organization}}.',
        roles:
          'Revisa els nivells d’accés fixos que es fan servir a {{organization}}.',
        categories:
          'Crea categories per classificar i encaminar les sol·licituds de suport.',
        apiKeys:
          'Deixa que un altre sistema treballi amb {{organization}} a través de l’API pública, només amb els permisos que triïs.',
      },
      addMember: 'Afegeix un membre',
      createCategory: 'Crea una categoria',
      columns: {
        member: 'MEMBRE',
        role: 'ROL',
        category: 'CATEGORIA',
        members: 'MEMBRES',
        tickets: 'TIQUETS',
        access: 'ACCÉS',
        status: 'ESTAT',
      },
      empty: {
        membersTitle: 'Encara no hi ha membres',
        membersDescription:
          'Afegeix algú per la seva adreça de correu per començar.',
        categoriesTitle: 'Encara no hi ha categories',
        categoriesDescription: 'Crea’n una per començar a encaminar tiquets.',
      },
      errorTitle: 'No s’ha pogut llegir aquesta organització',
      viewTickets: 'Mostra els tiquets de {{name}}',
      open: 'Obre {{name}}',
      editRow: 'Edita {{name}}',
      active: 'Actiu',
      invited: 'Convidat',
      waitingForPerson: ' · esperant la persona',
      roleRows: {
        ORG_ADMIN: {
          badge: 'AO',
          description: 'Accés complet a l’organització',
          access: 'Tots els permisos',
        },
        AGENT: {
          badge: 'AG',
          description: 'Crea tiquets i atén les sol·licituds de l’organització',
          access: 'Atendre tiquets',
        },
        MEMBER: {
          badge: 'ME',
          description: 'Crea i segueix els seus propis tiquets',
          access: 'Els seus tiquets',
        },
      },
      aside: {
        rolesTitle: 'Resum de permisos',
        rolesDescription: 'Com es reparteix l’accés per rol.',
        categoriesTitle: 'Encaminament',
        categoriesDescription: 'Tiquets per categoria.',
        membersTitle: 'Categories de tiquets',
        membersDescription: 'Serveixen per encaminar les sol·licituds noves.',
        apiKeysTitle: 'Ús d’una clau',
        apiKeysDescription:
          'Una clau actua només sobre aquesta organització, amb els permisos que se li van donar, fins que caduca o es revoca.',
        createTickets: 'Crear tiquets',
        handleTickets: 'Atendre tiquets',
        manageMembers: 'Gestionar membres',
        manageCategories: 'Gestionar categories',
        accessRoles_one: '{{count}} rol d’accés',
        accessRoles_other: '{{count}} rols d’accés',
      },
      feedback: {
        roleReserved:
          'Rol reservat per a {{email}}: entra quan creï el compte amb aquella adreça i la confirmi.',
        alreadyHad: '{{name}} ja tenia aquest rol.',
        nowHasAccess: '{{name}} ja té accés a {{organization}}.',
        accessUpdated: 'S’ha actualitzat l’accés de {{name}} a l’organització.',
        detailsUpdated: 'S’han actualitzat les dades de l’organització.',
        detailsUpdatedPreview:
          'S’han actualitzat les dades de l’organització en aquesta vista prèvia.',
        categorySaved: 'S’ha desat la categoria «{{name}}».',
        removed: '{{name}} ja no forma part de l’organització.',
        reservationCancelled: 'S’ha cancel·lat la reserva per a {{name}}.',
        invitationPrepared: 'Invitació preparada per a {{email}}.',
      },
    },
    dialog: {
      addMember: {
        title: 'Afegeix un membre a l’organització',
        description:
          'Convida algú a {{organization}} i assigna-li l’accés que necessita.',
        submit: 'Envia la invitació',
        note: 'L’accés als tiquets depèn del rol triat. Un compte confirmat el rep a l’acte; qualsevol altra adreça el deixa reservat fins que la persona creï el compte amb aquella adreça i la confirmi.',
      },
      editMember: {
        title: 'Edita un membre de l’organització',
        description: 'Canvia l’accés de {{name}} dins de {{organization}}.',
        submit: 'Desa l’accés',
      },
      settings: {
        title: 'Configuració de l’organització',
        description: 'Edita la identitat i les dades de {{organization}}.',
        submit: 'Desa els canvis',
      },
      category: {
        titleCreate: 'Crea una categoria de tiquets',
        titleEdit: 'Edita la categoria de tiquets',
        description:
          'Configura com es classifiquen i s’encaminen les sol·licituds.',
        submit: 'Desa la categoria',
      },
      deleteOrganization: {
        title: 'Vols eliminar {{organization}}?',
        description:
          'Els membres perden l’accés a l’organització i els seus tiquets ja no es podran modificar.',
        submit: 'Elimina l’organització',
        confirmLabel: 'Escriu el nom de l’organització',
      },
      removeMember: {
        title: 'Vols treure {{name}} de {{organization}}?',
        description:
          'Això treu l’accés a l’organització. No elimina el compte de la plataforma.',
        submit: 'Treu el membre',
        warning:
          'La persona perd l’accés a aquesta organització. El seu compte de la plataforma i les seves dades no s’eliminen.',
      },
      remove: 'Treu',
      delete: 'Elimina',
      sending: 'S’està enviant…',
      saving: 'S’està desant…',
      email: 'Adreça de correu',
      emailPlaceholder: 'nom@empresa.com',
      role: 'Rol a l’organització',
      organizationName: 'Nom de l’organització',
      description: 'Descripció',
      member: 'Membre',
      categoryName: 'Nom de la categoria',
      ownAccess: {
        title: 'Aquest és el teu propi accés',
        text: 'No pots canviar el teu propi rol ni treure’t des d’aquí: rebaixar-lo et deixaria dins de l’organització sense l’accés necessari per desfer-ho. Un altre administrador el pot canviar per tu, i sortir de l’organització és una decisió a part.',
      },
    },
    stats: {
      title: 'Els tiquets en xifres',
      total: 'Tots els tiquets',
      unassigned: 'Oberts o en curs, sense agent',
      firstResponse: 'Primera resposta, de mitjana',
      noFirstResponse: 'Encara no hi ha primeres respostes',
      byStatus: 'Per estat',
      byPriority: 'Per prioritat',
      errorTitle: 'No s’han pogut llegir les estadístiques',
    },
    apiKeys: {
      create: 'Crea una clau',
      usage: 'Envia la clau a la capçalera X-API-Key.',
      docs: 'Referència de l’API pública',
      docsNote: 'L’accés el dona l’equip de la plataforma.',
      loading: 'S’estan carregant les claus',
      errorTitle: 'No s’han pogut llegir les claus',
      emptyTitle: 'Encara no hi ha claus',
      emptyDescription:
        'Crea’n una quan una integració hagi d’arribar a aquesta organització.',
      createdBy: 'Creada per {{username}} · {{date}}',
      expires: 'Caduca el {{date}}',
      expired: 'Va caducar el {{date}}',
      noExpiry: 'No caduca',
      lastUsed: 'Darrer ús: {{date}}',
      neverUsed: 'Sense usar',
      revokedOn: 'Revocada el {{date}}',
      status: { ACTIVE: 'Activa', EXPIRED: 'Caducada', REVOKED: 'Revocada' },
      revoke: 'Revoca',
      revokeLabel: 'Revoca {{name}}',
      scopes: {
        ticketsRead: 'Llegir tiquets',
        ticketsWrite: 'Crear i modificar tiquets',
        commentsRead: 'Llegir comentaris',
        commentsWrite: 'Comentar tiquets',
        categoriesRead: 'Llegir categories',
        categoriesWrite: 'Gestionar categories',
        statsRead: 'Llegir estadístiques',
      },
      dialog: {
        title: 'Crea una clau d’API',
        description:
          'Posa-li el nom del sistema que la farà servir, i dona-li només els permisos que necessita.',
        name: 'Nom',
        namePlaceholder: 'Exemple: pàgina d’estat',
        scopes: 'Permisos',
        expiry: 'Caducitat',
        expiryOptions: {
          days30: 'D’aquí a 30 dies',
          days90: 'D’aquí a 90 dies',
          days180: 'D’aquí a 180 dies',
          days365: 'D’aquí a un any',
          never: 'Mai',
        },
        submit: 'Crea la clau',
        submitting: 'S’està creant…',
      },
      secret: {
        title: 'Copia la clau ara',
        description:
          'És l’única vegada que es mostra: només se’n desa una empremta, de manera que ningú —ni un administrador— la pot tornar a mostrar. Si la perds, revoca-la i crea’n una altra.',
        label: 'Clau de {{name}}',
        copy: 'Copia',
        copied: 'Copiada',
        copyFailed: 'Aquí no s’ha pogut copiar: selecciona-la i copia-la a mà.',
        done: 'Ja l’he desada',
      },
      revokeDialog: {
        title: 'Vols revocar {{name}}?',
        description:
          'El que la faci servir deixa de funcionar a l’acte. Una clau revocada no es pot recuperar: per tornar a donar accés, crea’n una de nova.',
        keep: 'Mantén la clau',
        confirm: 'Revoca la clau',
      },
      revoked: 'S’ha revocat {{name}}.',
    },
    leave: {
      title: 'Surt de {{organization}}',
      description:
        'Perds a l’acte l’accés als seus tiquets. El teu compte no es veu afectat, i un administrador et pot tornar a donar un rol.',
      lastAdmin:
        'Ets el seu únic administrador. Abans de sortir, fes administrador un altre membre: una organització sempre en conserva un.',
      button: 'Surt de l’organització',
      confirmTitle: 'Vols sortir de {{organization}}?',
      confirmDescription:
        'Perds a l’acte l’accés a {{organization}} i als seus tiquets. Els tiquets oberts que tinguis assignats tornen a la cua sense assignar. El teu compte no es veu afectat.',
      stay: 'Em quedo',
      leaving: 'S’està sortint…',
      done: 'Has sortit de {{organization}}.',
    },
    access: {
      title: 'Rols i accés',
      summary: 'Resum',
      emailLabel: 'Adreça de correu',
      emailPlaceholder: 'persona@empresa.com',
      assign: 'Assigna el rol',
      assigning: 'S’està assignant…',
      cancelReservation: 'Cancel·la la reserva per a {{email}}',
      reservedBy: 'Reservat per {{name}} · {{date}}',
      formerAdministrator: 'un antic administrador',
      never: 'Mai',
      loadError: 'No s’han pogut carregar els rols',
      reservationCancelled: 'S’ha cancel·lat la reserva per a {{email}}.',
      nothingWaiting: 'No hi ha res en espera',
      waiting: {
        ACCOUNT: {
          label: 'Esperant el compte',
          hint: 'Encara ningú no ha registrat aquesta adreça.',
        },
        VERIFICATION: {
          label: 'Esperant la confirmació del correu',
          hint: 'El compte existeix, però la seva adreça encara no està confirmada.',
        },
      },
      link: {
        title: 'Com funciona el vincle',
        stepOnePlatform:
          'Assignes el rol a una adreça de correu per a tota la plataforma.',
        stepOneOrganization:
          'Assignes el rol a una adreça de correu a {{organization}}.',
        stepTwo:
          'La persona crea el seu propi compte amb aquesta mateixa adreça, o ja en té un.',
        stepThree:
          'El rol s’activa en el moment en què es confirma l’adreça. Fins aleshores espera a la llista de sota.',
        protection:
          'La confirmació és el que protegeix el rol: qualsevol podria registrar l’adreça d’una altra persona, però només el seu propietari la pot confirmar.',
      },
      matrix: {
        title: 'Què pot fer cada rol',
        description:
          'Rols fixos: els mateixos tres a totes les organitzacions, i el servidor els aplica a cada petició.',
        label: 'Capacitats de cada rol de l’organització',
        capability: 'Capacitat',
        yourRole: '(el teu rol)',
        yes: 'Sí',
        no: 'No',
      },
      capabilities: {
        createTickets: 'Obrir tiquets i comentar-los',
        readAllTickets: 'Veure tots els tiquets de l’organització',
        changeStatus: 'Canviar l’estat i fer-se càrrec de tiquets',
        internalNotes: 'Escriure notes internes',
        readStats: 'Consultar les estadístiques de l’organització',
        assignOthers: 'Assignar tiquets a altres agents',
        manageCategories: 'Gestionar categories',
        manageMembers: 'Assignar rols i gestionar membres',
        manageOrganization: 'Editar o eliminar l’organització',
        manageApiKeys: 'Gestionar claus d’API',
      },
      none: {
        description:
          'Els rols es donen dins d’una organització, i encara no n’hi ha cap per triar.',
        title: 'No hi ha cap organització seleccionada',
        hint: 'Crea primer una organització; els seus rols es gestionen aquí.',
        goTo: 'Ves a organitzacions',
      },
      manage: {
        eyebrow: 'ADMINISTRACIÓ DE L’ORGANITZACIÓ',
        description:
          'Dona rols a {{organization}} a una adreça de correu, canvia’ls i treu membres. Un compte confirmat rep el rol a l’acte; qualsevol altra adreça el deixa reservat fins que la persona creï el compte amb aquella adreça i la confirmi.',
        actingAsPlatformAdmin: ' Actues com a administrador de la plataforma.',
        cards: {
          admins: 'Administradors',
          agents: 'Agents de suport',
          members: 'Membres',
          waiting: 'Esperant la persona',
        },
        assignTitle: 'Assigna un rol per correu',
        assignDescription: 'L’adreça encara no necessita tenir compte.',
        roleLabel: 'Rol en aquesta organització',
        loading: 'S’estan carregant els rols',
        membersTitle: 'Membres de {{organization}}',
        membersDescription:
          'Canviar un rol s’aplica a l’acte. Una organització sempre conserva almenys un administrador.',
        since: '{{email}} · des del {{date}}',
        you: '{{name}} (tu)',
        roleOf: 'Rol de {{name}}',
        removeFrom: 'Treu {{name}} de {{organization}}',
        reservationsTitle: 'Reservat per a una adreça de correu',
        reservationsDescription:
          'Rols donats a adreces que encara no tenen un compte confirmat. La persona entra quan la confirma.',
        reservationsEmpty:
          'Quan assignes un rol a una adreça sense compte confirmat, espera aquí.',
        feedback: {
          applied: '{{name}} ja té el rol {{role}} a {{organization}}.',
          unchanged: '{{name}} ja tenia el rol {{role}}. No ha canviat res.',
          reservedVerification:
            '{{role}} reservat per a {{email}}. Aquest compte existeix, però la seva adreça no està confirmada: entra a {{organization}} tan aviat com ho estigui. Li hem enviat un correu.',
          reservedAccount:
            '{{role}} reservat per a {{email}}. Encara ningú no ha registrat aquesta adreça: entra a {{organization}} quan creï el compte amb aquesta adreça i la confirmi. Li hem enviat un correu.',
          changed: '{{name}} ja té el rol {{role}}.',
          removed:
            '{{name}} ja no forma part de {{organization}}. Els seus tiquets oberts han tornat a la cua sense assignar.',
        },
        removeDialog: {
          eyebrow: 'ROLS I ACCÉS',
          title: 'Vols treure {{name}}?',
          description:
            '{{name}} perd a l’acte l’accés a {{organization}} i als seus tiquets. Els seus tiquets oberts tornen a la cua sense assignar. El seu compte no es veu afectat.',
          keep: 'Mantén el membre',
          confirm: 'Treu el membre',
        },
        demoteDialog: {
          title: 'Vols renunciar a la teva pròpia administració?',
          description:
            'Deixaràs d’administrar {{organization}}: aquesta pantalla, els membres, les categories i les claus d’API deixaran d’estar al teu abast. Un altre administrador t’hauria de tornar el rol.',
          keep: 'Continua com a administrador',
          confirm: 'Passa a {{role}}',
        },
      },
      readOnly: {
        descriptionAgent:
          'Qui fa què a {{organization}}. Els rols els assignen els administradors de l’organització.',
        descriptionMember:
          'El teu accés a {{organization}}, què pot fer cada rol i a qui demanar un canvi.',
        yourRole: 'El teu rol',
        needDifferent: 'Necessites un altre rol?',
        onlyAdmin:
          'Només un administrador de l’organització el pot canviar. Escriu a un d’ells des de Missatges:',
        noAdmin: 'Ara mateix no s’ha pogut mostrar cap administrador.',
        peopleTitle: 'Persones de {{organization}}',
        peopleDescription:
          'Només lectura. Els agents veuen qui s’encarrega de què; els administradors ho gestionen.',
        loading: 'S’estan carregant els membres',
      },
    },
  },
  admin: {
    eyebrow: 'ADMINISTRACIÓ DE LA PLATAFORMA',
    platformAdministrator: 'Administrador de la plataforma',
    platformRole: {
      USER: 'Usuari estàndard',
      GLOBAL_ADMIN: 'Administrador global',
    },
    accountState: {
      ACTIVE: 'Actiu',
      SUSPENDED: 'Suspès',
      PENDING: 'Invitació pendent',
    },
    accessDenied: {
      title: 'Accés restringit',
      description:
        'Només els administradors de la plataforma poden obrir aquesta zona. Si la necessites, demana accés a un d’ells.',
      back: 'Torna a l’espai de treball',
    },
    stats: {
      title: 'Activitat de la plataforma',
      tickets: 'Tiquets',
      openTickets: 'Oberts o en curs',
      messages: 'Missatges de xat',
      attachments: 'Adjunts',
      errorTitle: 'No s’han pogut llegir les estadístiques de la plataforma',
    },
    users: {
      title: 'Usuaris',
      description:
        'Gestiona els comptes de la plataforma, el seu accés a les organitzacions i el seu estat.',
      invite: 'Convida un usuari',
      cards: {
        sampleUsers: 'Usuaris d’exemple',
        accounts: 'Comptes',
        active: 'Actius',
        administrators: 'Administradors',
        organizations: 'Organitzacions',
      },
      panelTitle: 'Usuaris de la plataforma',
      search: 'Cerca usuaris de la plataforma',
      searchPlaceholder: 'Cerca per nom o correu',
      roles: 'Rols',
      allRoles: 'Tots els rols',
      states: 'Estats',
      allStates: 'Tots els estats',
      columns: {
        user: 'USUARI',
        organization: 'ORGANITZACIÓ',
        globalRole: 'ROL GLOBAL',
        state: 'ESTAT',
      },
      loading: 'S’estan carregant els usuaris…',
      edit: 'Edita {{name}}',
      emptyTitle: 'Cap usuari coincideix amb aquests filtres',
      emptyDescription: 'Ajusta la cerca o els filtres de rol i estat.',
      errorTitle: 'No s’han pogut llegir els usuaris',
      showingSample: 'Es mostren {{shown}} de {{total}} usuaris d’exemple',
      showing: 'Es mostren {{shown}} de {{total}} comptes i invitacions',
      organizations_one: '{{count}} organització',
      organizations_other: '{{count}} organitzacions',
      invitedUser: 'Usuari convidat',
      locked: {
        primary:
          'És l’administrador principal, creat en desplegar: el seu rol i el seu estat no es poden canviar des d’aquí.',
        self: 'És el teu propi compte: un altre administrador ha de canviar el teu rol o el teu estat.',
        email:
          'L’adreça de correu és la identitat per iniciar sessió i no s’edita des d’aquí. Suspendre bloqueja l’accés; eliminar tanca el compte.',
      },
      feedback: {
        invitationPrepared: 'Invitació preparada per a {{email}}.',
        updated: 'S’ha actualitzat {{name}}.',
        platformReserved:
          'Invitació enviada a {{email}}: l’administració de la plataforma queda reservada fins que creï el compte i confirmi l’adreça.',
        platformApplied:
          '{{name}} ja tenia compte i ara és administrador de la plataforma.',
        organizationFirst:
          'Crea primer una organització: un usuari estàndard s’hi convida.',
        roleReserved:
          'Invitació enviada a {{email}}: el rol queda reservat fins que creï el compte i confirmi l’adreça.',
        roleApplied: '{{name}} ja tenia compte i ara té el rol.',
        deleted: 'S’ha eliminat el compte de {{name}}.',
      },
    },
    userDialog: {
      inviteTitle: 'Convida un usuari',
      editTitle: 'Edita un usuari de la plataforma',
      inviteDescription:
        'La persona crea el seu propi compte i la seva contrasenya amb aquesta adreça. L’accés que triïs queda reservat per a ella i s’activa quan la confirmi; a l’acte si ja té un compte confirmat.',
      editDescription:
        'Actualitza la identitat, el rol i l’estat del compte de {{name}}.',
      delete: 'Elimina',
      send: 'Envia la invitació',
      save: 'Desa els canvis',
      fullName: 'Nom complet',
      email: 'Adreça de correu',
      platformAccess: 'Accés a la plataforma',
      initialOrganization: 'Organització inicial',
      organizationRole: 'Rol a l’organització',
      accountState: 'Estat del compte',
      notes: {
        globalAdmin:
          'Un administrador de la plataforma pot actuar a totes les organitzacions sense ser membre de cap.',
        standardUser:
          'Res no s’activa fins que la persona confirma l’adreça: registrar-la no n’hi ha prou, de manera que ningú no es pot quedar la invitació d’una altra persona.',
        edit: 'Suspendre bloqueja l’accés. Esborrar les dades personals continua sent una sol·licitud de privacitat a part, que confirma la mateixa persona.',
      },
      deleteConfirm: {
        title: 'Vols eliminar {{name}}?',
        description:
          '{{name}} ja no podrà iniciar sessió: totes les seves sessions es tanquen ara i el compte desapareix de la plataforma. Els seus tiquets i comentaris es queden, per a qui en depèn.',
        keep: 'Conserva el compte',
        confirm: 'Elimina el compte',
      },
    },
    roles: {
      title: 'Rols de la plataforma',
      eyebrowDialog: 'ROLS DE LA PLATAFORMA',
      description:
        'Dona l’administració de la plataforma a una adreça de correu. Un compte confirmat la rep a l’acte; qualsevol altra adreça la deixa reservada fins que la persona creï el compte amb aquella adreça i la confirmi.',
      cards: {
        administrators: 'Administradors de la plataforma',
        waitingAccount: 'Esperant un compte',
        waitingVerification: 'Esperant la confirmació del correu',
      },
      assignTitle: 'Assigna un rol de plataforma',
      assignDescription:
        'Tot compte comença com a usuari estàndard. Per retirar l’administració a algú, fes servir Retira a la llista de sota.',
      roleToAssign: 'Rol que s’assigna',
      roleDescription:
        'Gestiona tots els comptes, organitzacions i rols de la plataforma, actua a qualsevol organització i consulta el registre d’auditoria.',
      loading: 'S’estan carregant els rols de la plataforma',
      administratorsDescription:
        'Poden gestionar tota la plataforma. L’administrador principal es crea en desplegar i no es pot retirar des d’aquí.',
      you: 'Tu',
      primary: 'Principal · protegit',
      unconfirmed: 'Adreça sense confirmar',
      suspended: 'Suspès',
      lastSignIn: 'Darrer inici de sessió: {{date}}',
      ownRole: 'El teu propi rol',
      protected: 'Protegit',
      withdraw: 'Retira',
      withdrawFrom: 'Retira l’administració de la plataforma a {{name}}',
      reservationsTitle: 'Reservat per a una adreça de correu',
      reservationsDescription:
        'Adreces que passaran a administrar la plataforma quan existeixi el compte i es confirmi l’adreça.',
      reservationsEmpty:
        'Quan assignes el rol a una adreça sense compte confirmat, espera aquí.',
      feedback: {
        applied:
          '{{name}} ja és administrador de la plataforma. El canvi s’aplica a l’acte a la seva sessió actual.',
        unchanged:
          '{{name}} ja era administrador de la plataforma. No ha canviat res.',
        reservedVerification:
          'Reservat per a {{email}}. Aquest compte existeix, però la seva adreça no està confirmada: el rol s’aplica tan aviat com ho estigui. Li hem enviat un correu.',
        reservedAccount:
          'Reservat per a {{email}}. Encara ningú no ha registrat aquesta adreça: el rol s’aplica quan creï el compte amb aquesta adreça i la confirmi. Li hem enviat un correu.',
        withdrawn:
          '{{name}} torna a ser un usuari estàndard. El seu compte i els seus rols a les organitzacions no canvien.',
        cancelled:
          'S’ha cancel·lat la reserva per a {{email}}. Confirmar aquesta adreça ja no dona cap rol.',
      },
      withdrawDialog: {
        title: 'Vols retirar l’administració de la plataforma?',
        description:
          '{{name}} conserva el seu compte, les seves organitzacions i els seus rols. El que perd, a l’acte, és l’administració de la plataforma.',
        keep: 'Mantén el rol',
        confirm: 'Retira l’administració',
      },
    },
  },
  errors: {
    common: {
      unexpected: 'Error inesperat. Torna-ho a provar.',
      network: 'Sense connexió amb el servidor.',
      validationFailed: 'Revisa els camps marcats.',
      payloadTooLarge: 'La petició és massa gran.',
      malformedBody: "No s'ha pogut llegir la petició.",
      emptyPatch: 'No hi ha res per actualitzar.',
      duplicate: 'Això ja existeix.',
      internal: 'Alguna cosa ha fallat per la nostra banda. Torna-ho a provar.',
      invalidIdentifier: 'Aquest identificador no és vàlid.',
      notFound: 'No existeix, o no hi tens accés.',
      rateLimited: "Massa peticions. Espera't un moment i torna-ho a provar.",
      routeNotFound: 'Aquesta adreça no existeix.',
      stillReferenced:
        'No es pot esborrar mentre alguna cosa encara ho faci servir.',
    },
    auth: {
      sessionExpired: 'La sessió ha caducat. Torna a iniciar la sessió.',
      invalidCredentials: 'Correu o contrasenya incorrectes.',
      wrongPassword: 'La contrasenya actual no és correcta.',
      serverUnavailable:
        'El servidor no està disponible temporalment. Torna-ho a provar.',
      requestFailed: 'La petició ha fallat. Torna-ho a provar.',
      emptyLoginResponse:
        'El servidor ha retornat una resposta d’inici de sessió buida. Torna-ho a provar.',
      emptyRegistrationResponse:
        'El servidor ha retornat una resposta de registre buida. Torna-ho a provar.',
      accountDisabled: 'Aquest compte ha estat desactivat.',
      accountLocked:
        'Massa intents fallits. El compte queda bloquejat una estona.',
      emailTaken: 'Aquest correu ja està registrat.',
      refreshReused:
        "La teva sessió s'ha fet servir des d'un altre lloc, així que s'han tancat totes. Torna a iniciar la sessió.",
      tokenInvalid: "L'enllaç no és vàlid o ha caducat.",
      usernameTaken: "Aquest nom d'usuari ja està agafat.",
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
    field: {
      required: 'Aquest camp és obligatori.',
      invalid: 'Revisa aquest camp.',
      tooShort: 'Aquest valor és massa curt.',
      tooLong: 'Aquest valor és massa llarg.',
    },
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
      assigneeNotAgent:
        "Només es pot assignar a un agent d'aquesta organització.",
      invalidTransition: "El tiquet no pot passar a aquest estat des d'aquí.",
      locked: 'El seu autor ja no pot editar aquest tiquet.',
      notFound: 'Aquest tiquet no existeix, o no hi tens accés.',
    },
    comment: {
      notFound: 'Aquest comentari no existeix, o no hi tens accés.',
      empty: 'El comentari és buit.',
    },
    org: {
      nameTooShort: "El nom de l'organització és massa curt.",
      alreadyMember: 'Aquesta persona ja és membre.',
      cannotLowerOwnRole:
        "No et pots abaixar el rol a tu mateix: ho ha de fer un altre administrador, o pots sortir de l'organització.",
      lastAdmin:
        'Una organització ha de conservar com a mínim un administrador.',
      notFound: 'Aquesta organització no existeix, o no hi pertanys.',
      slugTaken: "Aquesta adreça d'organització ja està en ús.",
    },
    category: {
      notFound: 'Aquesta categoria no existeix en aquesta organització.',
      nameTaken: 'Ja existeix una categoria amb aquest nom.',
    },
    apiKey: {
      notFound: 'Aquesta clau d’API no existeix en aquesta organització.',
      invalid: "La clau d'API falta, no és vàlida o està revocada.",
      missingScope: "La clau d'API no té el permís que cal.",
      scopesRequired: 'Tria com a mínim un permís.',
    },
    email: { invalid: 'Escriu una adreça de correu vàlida.' },
    color: { invalid: 'Tria un color vàlid.' },
    slug: { invalid: 'Només minúscules, dígits i guionets.' },
    timezone: { invalid: 'Tria una zona horària vàlida.' },
    message: {
      notFound: 'Aquest missatge no existeix.',
      empty: 'El missatge és buit.',
    },
    rbac: { forbidden: 'El teu rol no permet fer això.' },
    file: {
      notFound: 'Aquest fitxer no existeix, o no hi tens accés.',
      tooLarge: 'El fitxer és massa gran.',
      imageUnreadable:
        "No s'ha pogut llegir la imatge: està malmesa o no és una imatge.",
      tooMany: "Aquest tiquet ja té el màxim d'adjunts.",
      typeNotAllowed: 'Aquest tipus de fitxer no està permès.',
      uploadRejected: "S'ha rebutjat el fitxer.",
    },
    friend: {
      exists: 'Ja existeix una amistat o una sol·licitud.',
      self: 'No et pots afegir a tu mateix com a amic.',
      targetRequired: 'Indica a qui vols afegir.',
    },
    gdpr: {
      pending: "Ja tens una sol·licitud pendent d'aquest tipus.",
      tokenInvalid: "L'enllaç de confirmació no és vàlid o ha caducat.",
      usernameMismatch: "El nom d'usuari no coincideix amb el teu compte.",
    },
    attachment: { notFound: 'Aquest adjunt no existeix, o no hi tens accés.' },
    avatar: { notFound: 'No hi ha foto de perfil.' },
    conversation: {
      notFound: 'Aquesta conversa no existeix, o no en formes part.',
    },
    export: { notFound: 'Aquesta exportació no existeix o ha caducat.' },
    friendship: { notFound: 'Aquesta amistat o sol·licitud no existeix.' },
    member: {
      notFound: 'Aquesta persona no és membre d’aquesta organització.',
    },
    organization: {
      notFound: 'Aquesta organització no existeix, o no en formes part.',
    },
    reservation: { notFound: 'Aquesta reserva ja no existeix.' },
    session: { notFound: 'Aquesta sessió ja no existeix.' },
    thumbnail: { notFound: 'Aquesta previsualització no existeix.' },
    user: { notFound: 'Aquest compte no existeix.' },
  },
};
