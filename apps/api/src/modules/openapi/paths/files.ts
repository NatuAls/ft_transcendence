import {
  op,
  ok,
  created,
  noContent,
  errs,
  session,
  pathParam,
  type Paths,
} from './_helpers.ts';
import { ref } from '../schemas.ts';

const upload = {
  required: true,
  content: {
    'multipart/form-data': {
      schema: {
        type: 'object',
        properties: {
          file: {
            type: 'string',
            format: 'binary',
            description:
              'The file. Its real type is detected from the magic bytes: a script renamed to `.pdf` is rejected with 415.',
          },
        },
        required: ['file'],
      },
    },
  },
};

export const filesPaths: Paths = {
  '/attachments/limits': {
    get: op({
      tag: 'Files',
      operationId: 'attachmentLimits',
      summary: 'Upload limits',
      description:
        'Maximum size, accepted types and quota per ticket. The client should read them instead of hard-coding them, so a change in the server does not need a release of the frontend.',
      security: session,
      responses: {
        '200': ok('Current limits.', {
          type: 'object',
          properties: {
            maxBytes: { type: 'integer', example: 10485760 },
            maxPerTicket: { type: 'integer', example: 5 },
            acceptedTypes: { type: 'array', items: { type: 'string' } },
          },
        }),
        ...errs('401'),
      },
    }),
  },
  '/tickets/{ticketId}/attachments': {
    get: op({
      tag: 'Files',
      operationId: 'listAttachments',
      summary: 'Attachments of a ticket',
      description: 'Metadata only; the bytes are downloaded one by one.',
      security: session,
      parameters: [pathParam('ticketId', 'Ticket.')],
      responses: {
        '200': ok('Attachments.', { type: 'array', items: ref('Attachment') }),
        ...errs('401', '404'),
      },
    }),
    post: op({
      tag: 'Files',
      operationId: 'uploadAttachment',
      summary: 'Attach a file to a ticket',
      description:
        'Checks the type by magic bytes, the size and the per-ticket quota, stores the SHA-256 and builds a WebP thumbnail for images.',
      security: session,
      parameters: [pathParam('ticketId', 'Ticket.')],
      requestBody: upload,
      responses: {
        '201': created('File attached.', ref('Attachment')),
        '413': { $ref: '#/components/responses/BadRequest' },
        '415': { $ref: '#/components/responses/BadRequest' },
        ...errs('400', '401', '403', '404'),
      },
    }),
  },
  '/tickets/{ticketId}/comments/{commentId}/attachments': {
    post: op({
      tag: 'Files',
      operationId: 'uploadCommentAttachment',
      summary: 'Attach a file to a comment',
      description:
        'Same checks as the ticket upload; the file hangs from the comment so it disappears with it.',
      security: session,
      parameters: [
        pathParam('ticketId', 'Ticket.'),
        pathParam('commentId', 'Comment.'),
      ],
      requestBody: upload,
      responses: {
        '201': created('File attached.', ref('Attachment')),
        ...errs('400', '401', '403', '404'),
      },
    }),
  },
  '/attachments/{id}': {
    get: op({
      tag: 'Files',
      operationId: 'downloadAttachment',
      summary: 'Download an attachment',
      description:
        'Access is re-checked against the ticket: being able to guess the id is not enough. Served with `Content-Disposition: attachment`, so nothing is rendered inline in the browser.',
      security: session,
      parameters: [{ $ref: '#/components/parameters/IdPath' }],
      responses: {
        '200': {
          description: 'The file.',
          content: {
            'application/octet-stream': {
              schema: { type: 'string', format: 'binary' },
            },
          },
        },
        ...errs('401', '403', '404'),
      },
    }),
    delete: op({
      tag: 'Files',
      operationId: 'deleteAttachment',
      summary: 'Delete an attachment',
      description:
        'Its uploader or an ORG_ADMIN. Logical delete plus `unlink` of the file on disk.',
      security: session,
      parameters: [{ $ref: '#/components/parameters/IdPath' }],
      responses: {
        '204': noContent('Attachment deleted.'),
        ...errs('401', '403', '404'),
      },
    }),
  },
  '/attachments/{id}/thumbnail': {
    get: op({
      tag: 'Files',
      operationId: 'attachmentThumbnail',
      summary: 'Thumbnail',
      description:
        'WebP preview for images. Answers 404 when the attachment is not an image.',
      security: session,
      parameters: [{ $ref: '#/components/parameters/IdPath' }],
      responses: {
        '200': {
          description: 'The thumbnail.',
          content: {
            'image/webp': { schema: { type: 'string', format: 'binary' } },
          },
        },
        ...errs('401', '403', '404'),
      },
    }),
  },
};
