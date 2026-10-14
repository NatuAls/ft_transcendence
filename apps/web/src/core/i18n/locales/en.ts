// Inglés: idioma base y de reserva. Cada clave nueva se añade AQUÍ primero
// y después en es.ts y ca.ts (el tipo Translation obliga a que estén las tres).
export const en = {
  common: {
    actions: {
      save: 'Save',
      cancel: 'Cancel',
      retry: 'Retry',
      refresh: 'Refresh',
      close: 'Close',
      search: 'Search',
      signOut: 'Sign out',
    },
    state: {
      loading: 'Loading…',
      empty: 'Nothing here yet',
      error: 'Something went wrong',
      refreshing: 'Refreshing…',
      updatedAt: 'Updated {{time}} · refreshed every minute',
    },
    language: 'Language',
    notFound: {
      title: 'Page not found',
      description:
        'The address does not match an available HelpDesk Lite page.',
      back: 'Back to tickets',
    },
  },
  nav: {
    tickets: 'Tickets',
    people: 'People',
    messages: 'Messages',
    organization: 'Organization',
    account: 'Account',
    admin: 'Administration',
  },
  account: {
    back: '‹ Account',
    home: {
      profileTitle: 'Profile settings',
      description: 'Manage your personal details and privacy.',
      editProfile: 'Edit profile',
      user: 'User',
      settingsLabel: 'Account settings',
      preferences: {
        title: 'Preferences',
        description: 'Choose how dates and notification schedules are shown.',
        summary: 'Time zone · {{timezone}}',
      },
      privacy: {
        title: 'Privacy & data',
        description: 'Export or delete your information',
      },
      sessions: {
        title: 'Sessions & devices',
        description: 'See where you are signed in and sign devices out',
      },
    },
    preferences: {
      title: 'Preferences',
      description: 'Choose how dates and notification schedules are shown.',
      language: 'Language',
      languages: { en: 'English', es: 'Español', ca: 'Català' },
      timezone: 'Time zone',
      timezoneHelp:
        'The browser detected {{timezone}}. This setting controls ticket timestamps and future notification schedules.',
      theme: 'Theme',
      themes: { light: 'Light', dark: 'Dark', system: 'System' },
      notifications: 'Notifications',
      notifyOnTicketUpdate: 'Ticket updates',
      notifyOnComment: 'Comments',
      notifyOnMention: 'Mentions',
      notifyOnMessage: 'Messages',
      notifyOnFriendship: 'Friend requests',
      saved: 'Preference saved successfully.',
    },
    password: {
      title: 'Change password',
      description: 'Update your password to keep your account secure.',
      current: 'Current password',
      new: 'New password',
      confirm: 'Confirm new password',
      sessionWarning:
        'You will be signed out on all your devices, including this one.',
      submit: 'Change password',
      saving: 'Changing password…',
      success: 'Password changed successfully.',
    },
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
    list: {
      greeting: 'Good morning, {{name}}',
      attention_one: '{{count}} ticket needs attention',
      attention_other: '{{count}} tickets need attention',
      description: {
        organization:
          'Track requests across your organization and move work forward.',
        personal: 'Track the requests you created and follow their progress.',
      },
      stats: {
        open: 'Open',
        inProgress: 'In progress',
        resolved: 'Resolved',
        highPriority: 'High priority',
      },
      summary: 'Ticket summary',
      categoryFilter: 'Category filter',
      backToCategories: 'Back to categories',
      clearFilter: 'Clear filter',
      allTickets: 'All tickets',
      yourTickets: 'Your tickets',
      results_one: '{{count}} result',
      results_other: '{{count}} results',
      searchLabel: 'Search tickets',
      searchPlaceholder: 'Search title or description',
      empty: {
        title: 'No tickets yet',
        description: 'Create your first ticket to start tracking requests.',
        filteredDescription:
          'Try adjusting or clearing your search and filters to see more results.',
      },
      errorTitle: 'Could not load tickets',
      unassigned: 'Unassigned',
      noCategory: 'No category',
      createdBy: 'Created by {{name}}',
      assignedTo: 'Assigned to {{name}}',
      viewAll_one: 'View all {{count}} ticket',
      viewAll_other: 'View all {{count}} tickets',
      showing: 'Showing {{from}}–{{to}} of {{count}}',
      pages: 'Ticket pages',
    },
    table: {
      ticket: 'Ticket',
      status: 'Status',
      priority: 'Priority',
      assignee: 'Assignee',
      updated: 'Updated',
      createdBy: 'Created by',
    },
    detail: {
      back: 'Back to tickets',
      title: 'Ticket detail',
      actions: 'Ticket actions',
      updated: 'Updated {{date}}',
      reopen: 'Reopen ticket',
      confirmClose: 'Confirm & close',
      closeTicket: 'Confirm resolution',
      closeDescription:
        'Review the proposed resolution before closing this ticket.',
      noResolution: 'No resolution was provided.',
      requester: 'Requester',
      details: 'Ticket details',
      conversation: 'Conversation',
      conversationRestricted:
        'Only the ticket creator, assigned support agent or organization administrator can access this conversation.',
      loadingConversation: 'Loading conversation…',
      conversationFailed: 'Unable to load the conversation.',
      reply: 'Reply',
      replyPlaceholder: 'Write a reply…',
      sendReply: 'Send reply',
      send: 'Send',
      status: 'Status',
      priority: 'Priority',
      category: 'Category',
      organization: 'Organization',
      created: 'Created',
      assignment: 'Assignment',
      assignmentDescription: 'Current ticket assignment.',
      assignee: 'Assignee',
      ticketClosed: 'Ticket closed',
      closedDescription:
        'The requester confirmed the resolution. The conversation remains available for reference.',
      adminReassignOnly:
        'Only organization administrators can reassign this ticket.',
      agentOptions: 'Agent options',
      agentOptionsDescription: 'Update the ticket priority and category.',
      resolutionDescription:
        'Add a resolution before marking this ticket as resolved.',
      resolutionEyebrow: 'RESOLUTION',
      saving: 'Saving…',
      markResolved: 'Mark resolved',
      resolveTicket: 'Resolve ticket',
      resolution: 'Resolution',
      resolutionPlaceholder:
        'Describe how the issue was resolved (at least 20 characters).',
      actionsDescription: 'Actions available for ticket {{id}}.',
      eyebrow: 'TICKET',
      returnToTickets: 'Return to tickets',
      copyId: 'Copy ticket ID',
      loadError: 'Could not load the ticket',
      notFound: 'Ticket not found',
      notFoundDescription: 'This ticket may have been deleted.',
      assignToMe: 'Assign to me',
      issueDescription: 'Issue description',
      closedReadOnly:
        'This ticket is read-only while closed. Reopen it before adding another reply.',
      newLineHint: 'Shift + Enter for a new line',
      feedback: {
        replyAdded: 'Reply added.',
        replyFailed: 'Unable to add the reply. Please try again.',
        priorityUpdated: 'Priority updated.',
        priorityFailed: 'Unable to update priority. Please try again.',
        assigneeUpdated: 'Assignee updated.',
        assigneeFailed: 'Unable to update the assignee. Please try again.',
        categoryUpdated: 'Category updated.',
        categoryFailed: 'Unable to update the category. Please try again.',
        closed: 'Ticket closed.',
        resolved: 'Ticket marked as resolved.',
        reopened: 'Ticket reopened.',
        statusFailed: 'Unable to update the ticket status. Please try again.',
        assignedToMe: 'Ticket assigned to you and moved to in progress.',
        assignToMeFailed:
          'Unable to assign the ticket to you. Please try again.',
        idCopied: 'Ticket ID copied.',
        copyUnavailable:
          'Copy is unavailable in this browser. Ticket ID: {{id}}.',
      },
    },
    filters: {
      title: 'Filter tickets',
      description: 'Combine fields to narrow the ticket list.',
      apply: 'Apply filters',
      more: 'More filters',
      status: { label: 'Status', all: 'All statuses' },
      priority: { label: 'Priority', all: 'All priorities' },
      category: { label: 'Category', all: 'All categories' },
      sort: { label: 'Sort order', newest: 'Newest', oldest: 'Oldest' },
    },
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
        categoryPlaceholder: 'Select a category (optional)...',
        categoryUnassignedHelp:
          "If you're unsure, leave the category blank. Our support team will classify it for you.",
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
  // Organizaciones, sus miembros, categorías y roles. Los roles se nombran
  // aquí una sola vez (organization.role.*) y todas las pantallas los leen de
  // aquí: antes el mismo rol se llamaba «Agent» en una y «Support agent» en
  // otra.
  organization: {
    eyebrow: 'ORGANIZATION',
    role: {
      MEMBER: 'Member',
      AGENT: 'Support agent',
      ORG_ADMIN: 'Organization admin',
    },
    roleDescription: {
      MEMBER: 'Opens tickets and follows their own requests.',
      AGENT:
        'Works every ticket of the organization: status, self-assignment and internal notes.',
      ORG_ADMIN:
        'Everything an agent does, plus members, roles, categories, API keys and the organization itself.',
    },
    roleInOrganization: '{{role}} in {{organization}}',
    someOrganization: 'an organization',
    members_one: '{{count}} member',
    members_other: '{{count}} members',
    tickets_one: '{{count}} ticket',
    tickets_other: '{{count}} tickets',
    defaultDescription: 'Organization support and service requests.',
    list: {
      eyebrow: 'ORGANIZATIONS',
      eyebrowPlatform: 'PLATFORM',
      title: 'Your organizations',
      titlePlatform: 'Organizations',
      description:
        'Choose an organization to continue with your assigned access.',
      descriptionPlatform: 'Review organizations configured on the platform.',
      new: 'New organization',
      search: 'Search organizations',
      count_one: '{{count}} organization',
      count_other: '{{count}} organizations',
      open: 'Open organization',
      platformAccess: 'Platform access',
      yours: 'Your organization',
      pendingAdministrator: 'Administrator invitation pending · {{email}}',
      noResults: {
        title: 'No organizations found',
        description: 'Try another search.',
      },
      none: {
        title: 'No organizations yet',
        description:
          'An organization administrator has to give a role to your e-mail address.',
        descriptionPlatform: 'Create the first one with New organization.',
      },
    },
    create: {
      title: 'Create an organization',
      description:
        'Create the organization and give its administration to an e-mail address. The person receives it even without an account yet: it activates when they create one with that address and confirm it.',
      name: 'Organization name',
      namePlaceholder: 'Example: Acme Support',
      descriptionLabel: 'Description',
      descriptionPlaceholder: 'What this organization supports',
      administrator: 'Initial organization administrator',
      administratorPlaceholder: 'admin@company.com',
      url: 'Organization URL',
      urlPlaceholder: 'organization-name',
      urlHelp:
        'Generated from the name. If it is already in use, you will be told when you create the organization.',
      submit: 'Create organization',
      submitting: 'Creating…',
      invalidEmail: 'Enter a valid e-mail address for the administrator.',
      duplicate: 'An organization with this name or URL already exists.',
      createdPreview:
        '{{name}} was created and its administrator invitation was prepared in this frontend preview.',
      createdReserved:
        '{{name}} was created. Its administration is reserved for {{email}}: it becomes active when that address creates its account and confirms it.',
      createdApplied:
        '{{name}} was created and {{administrator}} administers it.',
      createdWithoutAdministrator:
        '{{name}} was created, but the administrator could not be assigned: {{reason}} Assign it from Roles & access.',
    },
    page: {
      eyebrowSettings: 'ORGANIZATION SETTINGS',
      descriptionAgent:
        'Review ticket workload and the categories used by this organization.',
      descriptionMember:
        'View your access and the categories available when creating tickets.',
      adminTools: 'Organization admin tools',
      edit: 'Edit organization',
      stats: {
        members: 'Members',
        agents: 'Support agents',
        openTickets: 'Open tickets',
        categories: 'Categories',
      },
      yourAccess: 'Your access',
      visibility: 'Ticket visibility',
      yourTicketsOnly: 'Your tickets only',
      tabsLabel: 'Organization settings',
      tabs: {
        members: 'Members',
        roles: 'Access roles',
        categories: 'Categories',
        apiKeys: 'API keys',
      },
      title: {
        members: 'Members and access',
        roles: 'Access roles and permissions',
        categories: 'Ticket categories',
        apiKeys: 'API keys',
      },
      description: {
        members: 'Changes apply only inside {{organization}}.',
        roles: 'Review the fixed access levels used inside {{organization}}.',
        categories:
          'Create categories used to classify and route support requests.',
        apiKeys:
          'Let another system work with {{organization}} through the public API, with only the permissions you choose.',
      },
      addMember: 'Add member',
      createCategory: 'Create category',
      columns: {
        member: 'MEMBER',
        role: 'ROLE',
        category: 'CATEGORY',
        members: 'MEMBERS',
        tickets: 'TICKETS',
        access: 'ACCESS',
        status: 'STATUS',
      },
      empty: {
        membersTitle: 'No members yet',
        membersDescription: 'Add somebody by e-mail address to get started.',
        categoriesTitle: 'No categories yet',
        categoriesDescription: 'Create one to start routing tickets.',
      },
      errorTitle: 'This organization could not be read',
      viewTickets: 'View tickets in {{name}}',
      open: 'Open {{name}}',
      editRow: 'Edit {{name}}',
      active: 'Active',
      invited: 'Invited',
      waitingForPerson: ' · waiting for the person',
      roleRows: {
        ORG_ADMIN: {
          badge: 'OA',
          description: 'Full organization access',
          access: 'All permissions',
        },
        AGENT: {
          badge: 'AG',
          description: 'Creates tickets and handles organization requests',
          access: 'Handle tickets',
        },
        MEMBER: {
          badge: 'ME',
          description: 'Creates and follows own tickets',
          access: 'Own tickets',
        },
      },
      aside: {
        rolesTitle: 'Permission summary',
        rolesDescription: 'How access is distributed by role.',
        categoriesTitle: 'Routing overview',
        categoriesDescription: 'Tickets by category.',
        membersTitle: 'Ticket categories',
        membersDescription: 'Used to route new requests.',
        apiKeysTitle: 'Using a key',
        apiKeysDescription:
          'A key acts on this organization only, with the permissions it was given, until it expires or is revoked.',
        createTickets: 'Create tickets',
        handleTickets: 'Handle tickets',
        manageMembers: 'Manage members',
        manageCategories: 'Manage categories',
        accessRoles_one: '{{count}} access role',
        accessRoles_other: '{{count}} access roles',
      },
      feedback: {
        roleReserved:
          'Role reserved for {{email}}: they join when they create their account with that address and confirm it.',
        alreadyHad: '{{name}} already had that role.',
        nowHasAccess: '{{name}} now has access to {{organization}}.',
        accessUpdated: "{{name}}'s organization access was updated.",
        detailsUpdated: 'Organization details were updated.',
        detailsUpdatedPreview:
          'Organization details were updated in this frontend preview.',
        categorySaved: 'Category “{{name}}” was saved.',
        removed: '{{name}} was removed from the organization.',
        reservationCancelled: 'The reservation for {{name}} was cancelled.',
        invitationPrepared: 'Invitation prepared for {{email}}.',
      },
    },
    dialog: {
      addMember: {
        title: 'Add organization member',
        description:
          'Invite a user to {{organization}} and assign the access they need.',
        submit: 'Send invitation',
        note: 'Ticket access comes from the selected role. A confirmed account gets it at once; any other address keeps it reserved until the person creates the account with it and confirms it.',
      },
      editMember: {
        title: 'Edit organization member',
        description: 'Change {{name}}’s access inside {{organization}}.',
        submit: 'Save access',
      },
      settings: {
        title: 'Organization settings',
        description:
          'Edit the identity and operational details of {{organization}}.',
        submit: 'Save changes',
      },
      category: {
        titleCreate: 'Create ticket category',
        titleEdit: 'Edit ticket category',
        description: 'Configure how requests are classified and routed.',
        submit: 'Save category',
      },
      deleteOrganization: {
        title: 'Delete {{organization}}?',
        description:
          'Members lose organization access and its tickets can no longer be changed.',
        submit: 'Delete organization',
        confirmLabel: 'Type the organization name',
      },
      removeMember: {
        title: 'Remove {{name}} from {{organization}}?',
        description:
          'This removes organization access. It does not delete the platform account.',
        submit: 'Remove member',
        warning:
          'The member loses access to this organization. Their platform account and data are not deleted.',
      },
      remove: 'Remove',
      delete: 'Delete',
      sending: 'Sending…',
      saving: 'Saving…',
      email: 'Email address',
      emailPlaceholder: 'name@company.com',
      role: 'Organization role',
      organizationName: 'Organization name',
      description: 'Description',
      member: 'Member',
      categoryName: 'Category name',
      ownAccess: {
        title: 'This is your own access',
        text: 'You cannot change your own role or remove yourself from here: lowering it would leave you inside the organization without the access needed to undo it. Another administrator can change it for you, and leaving the organization is a separate decision.',
      },
    },
    stats: {
      title: 'Tickets in numbers',
      total: 'All tickets',
      unassigned: 'Open or in progress, without an agent',
      firstResponse: 'Average first response',
      noFirstResponse: 'No first replies yet',
      byStatus: 'By status',
      byPriority: 'By priority',
      errorTitle: 'The statistics could not be read',
    },
    apiKeys: {
      create: 'Create key',
      usage: 'Send the key in the X-API-Key header.',
      docs: 'Public API reference',
      docsNote: 'Access to it is given by the platform team.',
      loading: 'Loading keys',
      errorTitle: 'The keys could not be read',
      emptyTitle: 'No keys yet',
      emptyDescription:
        'Create one when an integration needs to reach this organization.',
      createdBy: 'Created by {{username}} · {{date}}',
      expires: 'Expires {{date}}',
      expired: 'Expired {{date}}',
      noExpiry: 'Does not expire',
      lastUsed: 'Last used {{date}}',
      neverUsed: 'Never used',
      revokedOn: 'Revoked {{date}}',
      status: { ACTIVE: 'Active', EXPIRED: 'Expired', REVOKED: 'Revoked' },
      revoke: 'Revoke',
      revokeLabel: 'Revoke {{name}}',
      scopes: {
        ticketsRead: 'Read tickets',
        ticketsWrite: 'Create and change tickets',
        commentsRead: 'Read comments',
        commentsWrite: 'Comment on tickets',
        categoriesRead: 'Read categories',
        categoriesWrite: 'Manage categories',
        statsRead: 'Read statistics',
      },
      dialog: {
        title: 'Create an API key',
        description:
          'Name it after the system that will use it, and give it only the permissions it needs.',
        name: 'Name',
        namePlaceholder: 'Example: status page',
        scopes: 'Permissions',
        expiry: 'Expires',
        expiryOptions: {
          days30: 'In 30 days',
          days90: 'In 90 days',
          days180: 'In 180 days',
          days365: 'In a year',
          never: 'Never',
        },
        submit: 'Create key',
        submitting: 'Creating…',
      },
      secret: {
        title: 'Copy the key now',
        description:
          'This is the only time it is shown: only a fingerprint of it is kept, so nobody — not even an administrator — can show it again. If you lose it, revoke it and create another.',
        label: 'Key for {{name}}',
        copy: 'Copy',
        copied: 'Copied',
        copyFailed:
          'It could not be copied here: select it and copy it by hand.',
        done: 'I have stored it',
      },
      revokeDialog: {
        title: 'Revoke {{name}}?',
        description:
          'Whatever uses it stops working at once. A revoked key cannot be restored: to give access again, create a new one.',
        keep: 'Keep the key',
        confirm: 'Revoke key',
      },
      revoked: '{{name}} was revoked.',
    },
    leave: {
      title: 'Leave {{organization}}',
      description:
        'You lose access to its tickets right away. Your account is not affected, and an administrator can give you a role again.',
      lastAdmin:
        'You are its only administrator. Before leaving, make another member an administrator: an organization always keeps one.',
      button: 'Leave organization',
      confirmTitle: 'Leave {{organization}}?',
      confirmDescription:
        'You lose access to {{organization}} and its tickets right away. Open tickets assigned to you go back to the unassigned queue. Your account is not affected.',
      stay: 'Stay',
      leaving: 'Leaving…',
      done: 'You left {{organization}}.',
    },
    // «Roles & access»: la pantalla de roles de la organización y las piezas
    // que comparte con la de roles de plataforma.
    access: {
      title: 'Roles & access',
      summary: 'Summary',
      emailLabel: 'E-mail address',
      emailPlaceholder: 'person@company.com',
      assign: 'Assign role',
      assigning: 'Assigning…',
      cancelReservation: 'Cancel the reservation for {{email}}',
      reservedBy: 'Reserved by {{name}} · {{date}}',
      formerAdministrator: 'a former administrator',
      never: 'Never',
      loadError: 'The roles could not be loaded',
      reservationCancelled: 'The reservation for {{email}} was cancelled.',
      nothingWaiting: 'Nothing is waiting',
      waiting: {
        ACCOUNT: {
          label: 'Waiting for the account',
          hint: 'Nobody has registered this address yet.',
        },
        VERIFICATION: {
          label: 'Waiting for e-mail confirmation',
          hint: 'The account exists; its address is not confirmed yet.',
        },
      },
      link: {
        title: 'How the link works',
        stepOnePlatform:
          'You assign the role to an e-mail address for the whole platform.',
        stepOneOrganization:
          'You assign the role to an e-mail address in {{organization}}.',
        stepTwo:
          'The person creates their own account with that same address — or already has one.',
        stepThree:
          'The role becomes active the moment the address is confirmed. Until then it waits in the list below.',
        protection:
          'Confirmation is what protects the role: anybody could register somebody else’s address, but only its owner can confirm it.',
      },
      matrix: {
        title: 'What each role can do',
        description:
          'Fixed roles: the same three in every organization, enforced by the server on every request.',
        label: 'Capabilities of each organization role',
        capability: 'Capability',
        yourRole: '(your role)',
        yes: 'Yes',
        no: 'No',
      },
      capabilities: {
        createTickets: 'Open tickets and comment on them',
        readAllTickets: 'See every ticket of the organization',
        changeStatus: 'Change status and take tickets',
        internalNotes: 'Write internal notes',
        readStats: 'Read organization statistics',
        assignOthers: 'Assign tickets to other agents',
        manageCategories: 'Manage categories',
        manageMembers: 'Assign roles and manage members',
        manageOrganization: 'Edit or delete the organization',
        manageApiKeys: 'Manage API keys',
      },
      none: {
        description:
          'Roles are given inside an organization, and there is none to choose yet.',
        title: 'No organization selected',
        hint: 'Create an organization first; its roles are managed here.',
        goTo: 'Go to organizations',
      },
      manage: {
        eyebrow: 'ORGANIZATION ADMINISTRATION',
        description:
          'Give roles in {{organization}} to an e-mail address, change them and remove members. A confirmed account gets the role at once; any other address keeps it reserved until the person creates the account with it and confirms it.',
        actingAsPlatformAdmin: ' You are acting as a platform administrator.',
        cards: {
          admins: 'Organization admins',
          agents: 'Support agents',
          members: 'Members',
          waiting: 'Waiting for the person',
        },
        assignTitle: 'Assign a role by e-mail',
        assignDescription: 'The address does not need an account yet.',
        roleLabel: 'Role in this organization',
        loading: 'Loading roles',
        membersTitle: 'Members of {{organization}}',
        membersDescription:
          'Changing a role applies immediately. An organization always keeps at least one administrator.',
        since: '{{email}} · since {{date}}',
        you: '{{name}} (you)',
        roleOf: 'Role of {{name}}',
        removeFrom: 'Remove {{name}} from {{organization}}',
        reservationsTitle: 'Reserved for an e-mail address',
        reservationsDescription:
          'Roles given to addresses that have no confirmed account yet. The person joins when they confirm it.',
        reservationsEmpty:
          'When you assign a role to an address without a confirmed account, it waits here.',
        feedback: {
          applied: '{{name}} now has the role {{role}} in {{organization}}.',
          unchanged: '{{name}} already has the role {{role}}. Nothing changed.',
          reservedVerification:
            '{{role}} reserved for {{email}}. That account exists but its address is not confirmed: they join {{organization}} as soon as it is. We e-mailed them.',
          reservedAccount:
            '{{role}} reserved for {{email}}. Nobody has registered that address yet: they join {{organization}} when they create their account with it and confirm it. We e-mailed them.',
          changed: '{{name}} now has the role {{role}}.',
          removed:
            '{{name}} was removed from {{organization}}. Their open tickets went back to the unassigned queue.',
        },
        removeDialog: {
          eyebrow: 'ROLES & ACCESS',
          title: 'Remove {{name}}?',
          description:
            '{{name}} loses access to {{organization}} and its tickets immediately. Their open tickets go back to the unassigned queue. Their account is not affected.',
          keep: 'Keep member',
          confirm: 'Remove member',
        },
        demoteDialog: {
          title: 'Give up your own administration?',
          description:
            'You will stop administering {{organization}}: this screen, members, categories and API keys will no longer be available to you. Another administrator would have to give the role back.',
          keep: 'Stay administrator',
          confirm: 'Become {{role}}',
        },
      },
      readOnly: {
        descriptionAgent:
          'Who does what in {{organization}}. Roles are assigned by the organization administrators.',
        descriptionMember:
          'Your access in {{organization}}, what each role can do and whom to ask for a change.',
        yourRole: 'Your role',
        needDifferent: 'Need a different role?',
        onlyAdmin:
          'Only an organization administrator can change it. Write to one of them from Messages:',
        noAdmin: 'No administrator could be listed right now.',
        peopleTitle: 'People in {{organization}}',
        peopleDescription:
          'Read only. Agents see who handles what; administrators manage it.',
        loading: 'Loading members',
      },
    },
  },
  // Administración de la plataforma: usuarios, roles de plataforma.
  admin: {
    eyebrow: 'PLATFORM ADMINISTRATION',
    platformAdministrator: 'Platform administrator',
    platformRole: {
      USER: 'Standard user',
      GLOBAL_ADMIN: 'Global admin',
    },
    accountState: {
      ACTIVE: 'Active',
      SUSPENDED: 'Suspended',
      PENDING: 'Invitation pending',
    },
    accessDenied: {
      title: 'Access restricted',
      description:
        'Only platform administrators can open this area. If you need it, ask one of them for access.',
      back: 'Return to workspace',
    },
    audit: {
      title: 'Audit log',
      description:
        'Who did what, when and from where: platform roles, suspensions, deletions, organizations, API keys and privacy requests.',
      entity: 'Affected',
      allEntities: 'Everything',
      action: 'Action',
      allActions: 'All actions',
      person: 'Person',
      allPeople: 'Everybody',
      selectedPerson: 'The selected person',
      from: 'From',
      to: 'To',
      clear: 'Clear filters',
      columns: {
        when: 'WHEN',
        who: 'WHO',
        what: 'WHAT',
        on: 'ON',
        ip: 'FROM',
      },
      noActor: 'System or deleted account',
      emptyTitle: 'Nothing recorded',
      emptyDescription: 'No entry matches these filters.',
      errorTitle: 'The audit log could not be read',
      loading: 'Loading the audit log',
      total_one: '{{count}} entry',
      total_other: '{{count}} entries',
      pagination: 'Audit log pages',
      autoRefresh: 'The first page refreshes every minute.',
      detailLoading: 'Loading the details',
      detailError: 'The details could not be read',
      before: 'Before',
      after: 'After',
      nothing: 'Nothing recorded',
      entityId: 'Identifier',
      userAgent: 'Browser or client',
      apiKey: 'Through the API key',
      groups: {
        accounts: 'Accounts',
        organizations: 'Organizations',
        roles: 'Roles by e-mail',
        credentials: 'API keys',
        privacy: 'Privacy',
      },
      actions: {
        userCreated: 'Account created',
        userRoleChanged: 'Platform role changed',
        userStatusChanged: 'Account suspended or reactivated',
        userPasswordRotated: 'Password replaced',
        userDeleted: 'Account deleted',
        organizationCreated: 'Organization created',
        organizationUpdated: 'Organization edited',
        organizationDeleted: 'Organization deleted',
        memberInvited: 'Member added',
        memberRoleChanged: 'Member role changed',
        memberRemoved: 'Member removed',
        roleReserved: 'Role reserved for an address',
        roleReservationCancelled: 'Reservation cancelled',
        roleReservationClaimed: 'Reserved role claimed',
        apiKeyCreated: 'API key created',
        apiKeyRevoked: 'API key revoked',
        gdprExportConfirmed: 'Data export confirmed',
        gdprDeleteConfirmed: 'Account deletion confirmed',
      },
      entities: {
        User: 'Account',
        Organization: 'Organization',
        OrganizationMember: 'Membership',
        PlatformRoleGrant: 'Platform role by e-mail',
        OrganizationRoleGrant: 'Organization role by e-mail',
        ApiKey: 'API key',
        GdprRequest: 'Privacy request',
      },
    },
    stats: {
      title: 'Platform activity',
      tickets: 'Tickets',
      openTickets: 'Open or in progress',
      messages: 'Chat messages',
      attachments: 'Attachments',
      errorTitle: 'The platform statistics could not be read',
    },
    users: {
      title: 'Users',
      description:
        'Manage platform accounts, organization access and account state.',
      invite: 'Invite user',
      cards: {
        sampleUsers: 'Sample users',
        accounts: 'Accounts',
        active: 'Active',
        administrators: 'Administrators',
        organizations: 'Organizations',
      },
      panelTitle: 'Platform users',
      search: 'Search platform users',
      searchPlaceholder: 'Search name or email',
      roles: 'Roles',
      allRoles: 'All roles',
      states: 'States',
      allStates: 'All states',
      columns: {
        user: 'USER',
        organization: 'ORGANIZATION',
        globalRole: 'GLOBAL ROLE',
        state: 'STATE',
      },
      loading: 'Loading users…',
      edit: 'Edit {{name}}',
      emptyTitle: 'No users match these filters',
      emptyDescription: 'Adjust the search, role or state filters.',
      errorTitle: 'Users could not be read',
      showingSample: 'Showing {{shown}} of {{total}} sample users',
      showing: 'Showing {{shown}} of {{total}} accounts and invitations',
      organizations_one: '{{count}} organization',
      organizations_other: '{{count}} organizations',
      invitedUser: 'Invited user',
      locked: {
        primary:
          'This is the primary administrator, created at deployment: its role and state cannot be changed from here.',
        self: 'This is your own account: another administrator has to change your role or state.',
        email:
          'The e-mail address is the sign-in identity and is not edited from here. Suspending blocks access; deleting closes the account.',
      },
      feedback: {
        invitationPrepared: 'Invitation prepared for {{email}}.',
        updated: '{{name}} was updated.',
        platformReserved:
          'Invitation sent to {{email}}: platform administration is reserved until they create the account and confirm the address.',
        platformApplied:
          '{{name}} already has an account and is now a platform administrator.',
        organizationFirst:
          'Create an organization first: a standard user is invited into one.',
        roleReserved:
          'Invitation sent to {{email}}: the role is reserved until they create the account and confirm the address.',
        roleApplied: '{{name}} already has an account and now has the role.',
        deleted: "{{name}}'s account was deleted.",
      },
    },
    userDialog: {
      inviteTitle: 'Invite user',
      editTitle: 'Edit platform user',
      inviteDescription:
        'The person creates their own account and password with this address. The access you choose is reserved for it and becomes active when they confirm it — at once if they already have a confirmed account.',
      editDescription: 'Update identity, role and account state for {{name}}.',
      delete: 'Delete',
      send: 'Send invitation',
      save: 'Save changes',
      fullName: 'Full name',
      email: 'Email address',
      platformAccess: 'Platform access',
      initialOrganization: 'Initial organization',
      organizationRole: 'Organization role',
      accountState: 'Account state',
      notes: {
        globalAdmin:
          'A platform administrator can act in every organization without being a member of any.',
        standardUser:
          'Nothing is active until the person confirms the address: registering it is not enough, so nobody can claim somebody else’s invitation.',
        edit: 'Suspending blocks access. Personal-data deletion remains a separate, user-confirmed privacy request.',
      },
      deleteConfirm: {
        title: 'Delete {{name}}?',
        description:
          '{{name}} will no longer be able to sign in: every session is closed now and the account disappears from the platform. Their tickets and comments stay, for the people who depend on them.',
        keep: 'Keep account',
        confirm: 'Delete account',
      },
    },
    roles: {
      title: 'Platform roles',
      eyebrowDialog: 'PLATFORM ROLES',
      description:
        'Give platform administration to an e-mail address. A confirmed account receives it at once; any other address keeps it reserved until the person creates the account with it and confirms it.',
      cards: {
        administrators: 'Platform administrators',
        waitingAccount: 'Waiting for an account',
        waitingVerification: 'Waiting for e-mail confirmation',
      },
      assignTitle: 'Assign a platform role',
      assignDescription:
        'Every account starts as a standard user. To take administration back from somebody, use Withdraw in the list below.',
      roleToAssign: 'Role to assign',
      roleDescription:
        'Manages every account, organization and role on the platform, acts in any organization and reads the audit trail.',
      loading: 'Loading platform roles',
      administratorsDescription:
        'They can manage the whole platform. The primary administrator is created at deployment and cannot be withdrawn from here.',
      you: 'You',
      primary: 'Primary · protected',
      unconfirmed: 'Address not confirmed',
      suspended: 'Suspended',
      lastSignIn: 'Last sign-in: {{date}}',
      ownRole: 'Your own role',
      protected: 'Protected',
      withdraw: 'Withdraw',
      withdrawFrom: 'Withdraw platform administration from {{name}}',
      reservationsTitle: 'Reserved for an e-mail address',
      reservationsDescription:
        'Addresses that will become platform administrators once the account exists and the address is confirmed.',
      reservationsEmpty:
        'When you assign the role to an address without a confirmed account, it waits here.',
      feedback: {
        applied:
          '{{name}} is now a platform administrator. The change applies to their current session right away.',
        unchanged:
          '{{name}} already is a platform administrator. Nothing changed.',
        reservedVerification:
          'Reserved for {{email}}. That account exists but its address is not confirmed: the role is applied as soon as it is. We e-mailed them.',
        reservedAccount:
          'Reserved for {{email}}. Nobody has registered that address yet: the role is applied when they create their account with it and confirm it. We e-mailed them.',
        withdrawn:
          '{{name}} is a standard user again. Their account and organization roles are untouched.',
        cancelled:
          'The reservation for {{email}} was cancelled. Confirming that address no longer gives any role.',
      },
      withdrawDialog: {
        title: 'Withdraw platform administration?',
        description:
          '{{name}} keeps their account, their organizations and their roles in them. What they lose, immediately, is platform administration.',
        keep: 'Keep the role',
        confirm: 'Withdraw administration',
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
      duplicate: 'That already exists.',
      internal: 'Something went wrong on our side. Please try again.',
      invalidIdentifier: 'That identifier is not valid.',
      notFound: 'It does not exist, or you do not have access to it.',
      rateLimited: 'Too many requests. Please wait a moment and try again.',
      routeNotFound: 'That address does not exist.',
      stillReferenced: 'It cannot be deleted while something still uses it.',
    },
    auth: {
      sessionExpired: 'Your session has expired. Please sign in again.',
      invalidCredentials: 'Wrong email or password.',
      wrongPassword: 'Current password is incorrect.',
      serverUnavailable:
        'The server is temporarily unavailable. Please try again.',
      requestFailed: 'The request failed. Please try again.',
      emptyLoginResponse:
        'The server returned an empty login response. Please try again.',
      emptyRegistrationResponse:
        'The server returned an empty registration response. Please try again.',
      accountDisabled: 'This account has been disabled.',
      accountLocked:
        'Too many failed attempts. The account is locked for a while.',
      emailTaken: 'That email is already registered.',
      refreshReused:
        'Your session was used from somewhere else, so every session has been closed. Please sign in again.',
      tokenInvalid: 'The link is invalid or has expired.',
      usernameTaken: 'That username is already taken.',
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
      mustDiffer: 'Choose a password different from your current one.',
    },
    field: {
      required: 'This field is required.',
      invalid: 'Check this field.',
      tooShort: 'This value is too short.',
      tooLong: 'This value is too long.',
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
      assigneeNotAgent: 'Only an agent of this organization can be assigned.',
      invalidTransition: 'The ticket cannot move to that state from here.',
      locked: 'This ticket can no longer be edited by its author.',
      notFound: 'That ticket does not exist, or you do not have access to it.',
    },
    comment: {
      notFound: 'That comment does not exist, or you do not have access to it.',
      empty: 'The comment is empty.',
    },
    org: {
      nameTooShort: 'Organization name is too short.',
      alreadyMember: 'That person is already a member.',
      cannotLowerOwnRole:
        'You cannot lower your own role: another administrator has to do it, or you can leave the organization.',
      lastAdmin: 'An organization must keep at least one administrator.',
      notFound: 'That organization does not exist, or you do not belong to it.',
      slugTaken: 'That organization address is already in use.',
    },
    category: {
      notFound: 'That category does not exist in this organization.',
      nameTaken: 'A category with that name already exists.',
    },
    apiKey: {
      notFound: 'That API key does not exist in this organization.',
      invalid: 'The API key is missing, invalid or revoked.',
      missingScope: 'The API key does not have the permission this needs.',
      scopesRequired: 'Choose at least one permission.',
    },
    email: { invalid: 'Enter a valid e-mail address.' },
    color: { invalid: 'Choose a valid colour.' },
    slug: { invalid: 'Only lowercase letters, digits and hyphens.' },
    timezone: { invalid: 'Choose a valid time zone.' },
    message: {
      notFound: 'That message does not exist.',
      empty: 'The message is empty.',
    },
    rbac: { forbidden: 'Your role does not allow this.' },
    file: {
      notFound: 'That file does not exist, or you do not have access to it.',
      tooLarge: 'The file is too large.',
      imageUnreadable:
        'The image could not be read: it is damaged or not really an image.',
      tooMany: 'This ticket has reached the maximum number of attachments.',
      typeNotAllowed: 'That file type is not allowed.',
      uploadRejected: 'The file was rejected.',
    },
    friend: {
      exists: 'A friendship or a request already exists.',
      self: 'You cannot add yourself as a friend.',
      targetRequired: 'Say who you want to add.',
    },
    gdpr: {
      pending: 'You already have a pending request of this type.',
      tokenInvalid: 'The confirmation link is invalid or has expired.',
      usernameMismatch: 'The username you typed does not match your account.',
    },
    auditLog: { notFound: 'That audit entry does not exist.' },
    attachment: {
      notFound:
        'That attachment does not exist, or you do not have access to it.',
    },
    avatar: { notFound: 'There is no profile picture.' },
    conversation: {
      notFound: 'That conversation does not exist, or you are not part of it.',
    },
    export: { notFound: 'That export does not exist or has expired.' },
    friendship: { notFound: 'That friendship or request does not exist.' },
    member: { notFound: 'That person is not a member of this organization.' },
    organization: {
      notFound: 'That organization does not exist, or you do not belong to it.',
    },
    reservation: { notFound: 'That reservation does not exist any more.' },
    session: { notFound: 'That session does not exist any more.' },
    thumbnail: { notFound: 'That preview does not exist.' },
    user: { notFound: 'That account does not exist.' },
  },
};

export type Translation = typeof en;
