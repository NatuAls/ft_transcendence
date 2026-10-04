import {
  op,
  ok,
  created,
  noContent,
  errs,
  body,
  session,
  pathParam,
  listOf,
  type Paths,
} from './_helpers.ts';
import { ref } from '../schemas.ts';

export const socialPaths: Paths = {
  '/friends': {
    get: op({
      tag: 'Social',
      operationId: 'listFriends',
      summary: 'My friends',
      description:
        'Accepted friendships, most recent first, each with the friend and their live presence. Presence is kept by the realtime layer with a socket counter so reloading a tab does not make the dot blink, and changes are pushed live as `presence.changed` on the `/rt` Socket.IO namespace.',
      security: session,
      responses: {
        '200': ok('Friends.', { type: 'array', items: ref('Friend') }),
        ...errs('401'),
      },
    }),
  },
  '/friends/requests': {
    get: op({
      tag: 'Social',
      operationId: 'listFriendRequests',
      summary: 'Pending requests',
      description: 'Received and sent, so one screen can show both columns.',
      security: session,
      responses: {
        '200': ok('Requests.', ref('FriendRequests')),
        ...errs('401'),
      },
    }),
    post: op({
      tag: 'Social',
      operationId: 'sendFriendRequest',
      summary: 'Send a friend request',
      description:
        'By `userId` or `username`. There is only ever one friendship row between two people: asking again while a request is pending - in either direction - or once you are friends answers 409 `FRIEND_EXISTS`; answer the pending one instead. After a decline, the request can be sent again. Asking yourself is a 400.',
      security: session,
      requestBody: body('SendFriendRequestInput'),
      responses: {
        '201': created('Request sent.', ref('Friendship')),
        ...errs('400', '401', '404', '409'),
      },
    }),
  },
  '/friends/requests/{id}': {
    patch: op({
      tag: 'Social',
      operationId: 'respondFriendRequest',
      summary: 'Accept or decline a request',
      description:
        'Only the person who received the request can answer it, and only while it is pending; anything else is a 404. Accepting notifies the requester.',
      security: session,
      parameters: [
        pathParam('id', 'Request (the `id` of an `incoming` entry).'),
      ],
      requestBody: body('RespondFriendRequestInput'),
      responses: {
        '200': ok('Updated friendship.', ref('Friendship')),
        ...errs('400', '401', '404'),
      },
    }),
  },
  '/friends/{userId}': {
    delete: op({
      tag: 'Social',
      operationId: 'removeFriend',
      summary: 'Remove a friend',
      description:
        'Undoes the friendship in both directions; it also withdraws a pending request, sent or received. The conversation and its messages are kept.',
      security: session,
      parameters: [pathParam('userId', 'Friend to remove.')],
      responses: {
        '204': noContent('Friendship removed.'),
        ...errs('401', '404'),
      },
    }),
  },
  '/conversations': {
    get: op({
      tag: 'Social',
      operationId: 'listConversations',
      summary: 'My conversations',
      description:
        'With the last message and the unread counter, ordered by activity: exactly what a chat sidebar draws.',
      security: session,
      responses: {
        '200': ok('Conversations.', {
          type: 'array',
          items: ref('Conversation'),
        }),
        ...errs('401'),
      },
    }),
    post: op({
      tag: 'Social',
      operationId: 'openConversation',
      summary: 'Open a conversation',
      description:
        'Idempotent: between the same two people there is only ever one conversation, so opening it again returns the existing one instead of splitting the history.',
      security: session,
      requestBody: body('OpenConversationInput'),
      responses: {
        '200': ok(
          'Existing or newly created conversation.',
          ref('Conversation'),
        ),
        ...errs('400', '401', '404'),
      },
    }),
  },
  '/conversations/{id}/messages': {
    get: op({
      tag: 'Social',
      operationId: 'listMessages',
      summary: 'Messages of a conversation',
      description:
        'Paginated, newest first. Only the two participants can read it; anyone else gets 404.',
      security: session,
      parameters: [
        { $ref: '#/components/parameters/IdPath' },
        { $ref: '#/components/parameters/Page' },
        { $ref: '#/components/parameters/Take' },
      ],
      responses: {
        '200': listOf('ChatMessage', 'Messages.'),
        ...errs('401', '404'),
      },
    }),
    post: op({
      tag: 'Social',
      operationId: 'sendMessage',
      summary: 'Send a message',
      description:
        'Stores it and pushes `message.created` to the `conv:<id>` room over Socket.IO, so the other side sees it without polling. The realtime layer re-checks membership before letting anyone into that room.',
      security: session,
      parameters: [{ $ref: '#/components/parameters/IdPath' }],
      requestBody: body('SendMessageInput'),
      responses: {
        '201': created('Message sent.', ref('ChatMessage')),
        ...errs('400', '401', '404'),
      },
    }),
  },
  '/conversations/{id}/read': {
    patch: op({
      tag: 'Social',
      operationId: 'markConversationRead',
      summary: 'Mark as read',
      description:
        'Moves the read mark to now and zeroes the unread counter for the caller only.',
      security: session,
      parameters: [{ $ref: '#/components/parameters/IdPath' }],
      requestBody: body('MarkReadInput'),
      responses: { '204': noContent('Marked as read.'), ...errs('401', '404') },
    }),
  },
};
