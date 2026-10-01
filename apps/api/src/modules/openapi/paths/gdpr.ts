import {
  op,
  ok,
  noContent,
  errs,
  body,
  session,
  type Paths,
} from './_helpers.ts';

const request = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    type: { type: 'string', enum: ['EXPORT', 'DELETE'] },
    status: {
      type: 'string',
      enum: ['PENDING', 'CONFIRMED', 'COMPLETED', 'EXPIRED'],
    },
    requestedAt: { type: 'string', format: 'date-time' },
    completedAt: { type: 'string', format: 'date-time', nullable: true },
  },
} as const;

export const gdprPaths: Paths = {
  '/gdpr/requests': {
    get: op({
      tag: 'GDPR',
      operationId: 'listGdprRequests',
      summary: 'My data requests',
      description:
        'History of exports and deletions with their state, so the user can see what they asked for and when.',
      security: session,
      responses: {
        '200': ok('Requests.', { type: 'array', items: request }),
        ...errs('401'),
      },
    }),
  },
  '/gdpr/export': {
    post: op({
      tag: 'GDPR',
      operationId: 'requestExport',
      summary: 'Request my data',
      description:
        'Starts the export and sends a confirmation e-mail. Nothing is generated until the link is followed: an export contains everything about a person, and a stolen session should not be enough to produce it.',
      security: session,
      requestBody: body('GdprRequestInput'),
      responses: {
        '202': {
          description: 'Request accepted; check your e-mail.',
          content: { 'application/json': { schema: request } },
        },
        ...errs('400', '401', '429'),
      },
    }),
  },
  '/gdpr/export/confirm': {
    post: op({
      tag: 'GDPR',
      operationId: 'confirmExport',
      summary: 'Confirm the export',
      description:
        'With the e-mailed token. Builds a ZIP with `data.json`: profile, organizations, tickets, comments, messages and audit entries of the requester.',
      security: session,
      requestBody: body('GdprConfirmInput'),
      responses: {
        '200': ok('Export ready to download.', request),
        ...errs('400', '401', '404'),
      },
    }),
  },
  '/gdpr/export/{id}/download': {
    get: op({
      tag: 'GDPR',
      operationId: 'downloadExport',
      summary: 'Download the export',
      description:
        'One-time, time-limited download of the ZIP. Only the person who asked for it can fetch it.',
      security: session,
      parameters: [{ $ref: '#/components/parameters/IdPath' }],
      responses: {
        '200': {
          description: 'The ZIP.',
          content: {
            'application/zip': { schema: { type: 'string', format: 'binary' } },
          },
        },
        ...errs('401', '403', '404'),
      },
    }),
  },
  '/gdpr/delete': {
    post: op({
      tag: 'GDPR',
      operationId: 'requestDeletion',
      summary: 'Request account deletion',
      description:
        'Starts the erasure and sends the confirmation e-mail. **Two** barriers on purpose: the e-mail token, and typing the username in the next call.',
      security: session,
      requestBody: body('GdprRequestInput'),
      responses: {
        '202': {
          description: 'Request accepted; check your e-mail.',
          content: { 'application/json': { schema: request } },
        },
        ...errs('400', '401', '429'),
      },
    }),
  },
  '/gdpr/delete/confirm': {
    post: op({
      tag: 'GDPR',
      operationId: 'confirmDeletion',
      summary: 'Confirm the deletion',
      description:
        'Token **and** username. Erases personal data and anonymises what has to stay for the tickets of others to keep making sense - an accepted trade-off under the right to erasure, and one the interface must state clearly.',
      security: session,
      requestBody: body('GdprConfirmInput'),
      responses: {
        '204': noContent('Account deleted.'),
        ...errs('400', '401', '404'),
      },
    }),
  },
};
