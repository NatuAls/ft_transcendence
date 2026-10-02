import {
  op,
  ok,
  noContent,
  errs,
  session,
  listOf,
  query,
  type Paths,
} from './_helpers.ts';

export const notificationsPaths: Paths = {
  '/notifications': {
    get: op({
      tag: 'Notifications',
      operationId: 'listNotifications',
      summary: 'My notifications',
      description:
        'Paginated, newest first. The text is **not** stored: each row keeps a translation key and its interpolation values, so the same notification reads in the language the user picks today, not the one they had when it was created.',
      security: session,
      parameters: [
        { $ref: '#/components/parameters/Page' },
        { $ref: '#/components/parameters/Take' },
        query('unreadOnly', 'Only the ones still unread.', { type: 'boolean' }),
      ],
      responses: {
        '200': listOf('Notification', 'Notifications.'),
        ...errs('401'),
      },
    }),
  },
  '/notifications/unread-count': {
    get: op({
      tag: 'Notifications',
      operationId: 'unreadCount',
      summary: 'Unread counter',
      description:
        'The number for the bell badge. Cheap on purpose so the interface can call it often - although the live counter arrives over the socket, which is cheaper still.',
      security: session,
      responses: {
        '200': ok('Counter.', {
          type: 'object',
          properties: { unread: { type: 'integer' } },
        }),
        ...errs('401'),
      },
    }),
  },
  '/notifications/read-all': {
    patch: op({
      tag: 'Notifications',
      operationId: 'markAllRead',
      summary: 'Mark all as read',
      description: 'Empties the badge in one call.',
      security: session,
      responses: { '204': noContent('All marked as read.'), ...errs('401') },
    }),
  },
  '/notifications/{id}/read': {
    patch: op({
      tag: 'Notifications',
      operationId: 'markNotificationRead',
      summary: 'Mark one as read',
      description:
        'Only the owner of the notification can mark it; anyone else gets 404.',
      security: session,
      parameters: [{ $ref: '#/components/parameters/IdPath' }],
      responses: { '204': noContent('Marked as read.'), ...errs('401', '404') },
    }),
  },
  '/notifications/{id}': {
    delete: op({
      tag: 'Notifications',
      operationId: 'deleteNotification',
      summary: 'Delete a notification',
      description: 'Removes it from the list for good.',
      security: session,
      parameters: [{ $ref: '#/components/parameters/IdPath' }],
      responses: {
        '204': noContent('Notification deleted.'),
        ...errs('401', '404'),
      },
    }),
  },
};
