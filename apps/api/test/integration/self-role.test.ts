import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  addMember,
  api,
  apiIsUp,
  createOrganization,
  login,
  registerUser,
  SKIP_MESSAGE,
  unique,
  type TestUser,
} from './helpers.ts';
import { closeDb, dbAvailable, promoteToGlobalAdmin } from './db.ts';

/**
 * Nadie se encierra a sí mismo fuera de su propia organización.
 *
 * Reproduce lo que pasó el 07/10 probando en local. Cambiar roles exige ser
 * administrador de la organización, así que una degradación propia NO TIENE
 * VUELTA: quien se la aplica queda dentro de la organización, sin poder
 * gestionar nada y sin poder deshacerlo.
 *
 * El límite del último administrador no cubría el caso, y por eso parecía
 * seguro: basta ascender a un segundo administrador para que deje de aplicar,
 * y entonces la degradación propia pasaba sin un solo aviso. La secuencia
 * exacta era:
 *
 *   1. soy el único ORG_ADMIN → la API me protege con ORG_LAST_ADMIN,
 *   2. asciendo a otro miembro a ORG_ADMIN → ya no soy el último,
 *   3. me bajo a MEMBER → aceptado, y me quedo encerrado.
 *
 * Quien quiera dejar de administrar se lo pide a otro administrador, o se va
 * de la organización. El administrador de plataforma queda fuera de la regla:
 * su alcance no es la organización, así que no se encierra.
 */
describe(
  'integración · el rol propio no se baja solo',
  { concurrency: false },
  () => {
    let up = false;
    let admin: TestUser;
    let otro: TestUser;
    let organizationId = '';

    before(async () => {
      up = await apiIsUp();
      if (!up) return;
      admin = await registerUser();
      otro = await registerUser();
      organizationId = await createOrganization(admin.token);
      await addMember(admin.token, organizationId, otro.username, 'MEMBER');
    });

    const bajarse = (token: string, userId: string, role: string) =>
      api('PATCH', `/organizations/${organizationId}/members/${userId}`, {
        token,
        body: { role },
      });

    it('siendo el único administrador, el límite de siempre lo impide', async (t) => {
      if (!up) return t.skip(SKIP_MESSAGE);
      const response = await bajarse(admin.token, admin.id, 'MEMBER');
      assert.equal(response.status, 409);
      assert.equal((response.body as { code?: string }).code, 'ORG_LAST_ADMIN');
    });

    it('con un segundo administrador, tampoco: antes pasaba y encerraba', async (t) => {
      if (!up) return t.skip(SKIP_MESSAGE);
      // Paso 2 de la secuencia: ya no soy el último administrador.
      const ascenso = await bajarse(admin.token, otro.id, 'ORG_ADMIN');
      assert.equal(ascenso.status, 200);

      // Paso 3: aquí es donde la aplicación se rompía.
      const response = await bajarse(admin.token, admin.id, 'MEMBER');
      assert.equal(response.status, 409);
      assert.equal(
        (response.body as { code?: string }).code,
        'ORG_CANNOT_LOWER_OWN_ROLE',
      );
    });

    it('sigo administrando: la negativa no me ha dejado a medias', async (t) => {
      if (!up) return t.skip(SKIP_MESSAGE);
      const response = await api<{ role: string }>(
        'GET',
        `/organizations/${organizationId}`,
        { token: admin.token },
      );
      assert.equal(response.status, 200);
      assert.equal((response.body as { myRole?: string }).myRole, 'ORG_ADMIN');
    });

    it('subirse el rol a uno mismo no es un encierro, y se permite', async (t) => {
      if (!up) return t.skip(SKIP_MESSAGE);
      // `otro` es ORG_ADMIN desde la prueba anterior: que se baje a AGENT
      // tampoco, por el mismo motivo.
      const baja = await bajarse(otro.token, otro.id, 'AGENT');
      assert.equal(baja.status, 409);
      // Pero que un administrador suba a otro, sí.
      const subida = await bajarse(admin.token, otro.id, 'ORG_ADMIN');
      assert.equal(subida.status, 200);
    });

    it('otro administrador sí puede degradarme: es el camino previsto', async (t) => {
      if (!up) return t.skip(SKIP_MESSAGE);
      const response = await bajarse(otro.token, admin.id, 'AGENT');
      assert.equal(response.status, 200);
      assert.equal((response.body as { role?: string }).role, 'AGENT');
    });
  },
);

/**
 * El administrador de plataforma no es miembro de las organizaciones.
 *
 * Quien crea una organización se queda dentro como su administrador —si no,
 * perdería al momento lo que acaba de crear—, pero con el administrador de
 * plataforma eso sobra: su acceso es derivado del rol global, no de una
 * pertenencia. Apuntarle como miembro le hacía aparecer como «Organization
 * Admin» en los roles de acceso de la organización, donde sólo deben figurar
 * los roles propios de ella, y le contaba como miembro de un sitio del que no
 * forma parte.
 */
describe(
  'integración · plataforma no cuenta como pertenencia',
  { concurrency: false },
  () => {
    let up = false;
    let plataforma: TestUser;
    let normal: TestUser;

    before(async () => {
      up = await apiIsUp();
      if (!up || !dbAvailable()) {
        up = false;
        return;
      }
      plataforma = await registerUser('plat');
      await promoteToGlobalAdmin(plataforma.id);
      // El token trae el rol antiguo: hay que volver a entrar.
      plataforma = {
        ...plataforma,
        token: (await login(plataforma.email)).token,
      };
      normal = await registerUser('norm');
    });

    after(closeDb);

    it('al crear una organización no se añade a sí mismo', async (t) => {
      if (!up) return t.skip(SKIP_MESSAGE);
      const creada = await api<{ id: string }>('POST', '/organizations', {
        token: plataforma.token,
        body: { name: `Plat ${unique('p')}` },
      });
      assert.equal(creada.status, 201);
      const miembros = await api<unknown[]>(
        'GET',
        `/organizations/${creada.body.id}/members`,
        { token: plataforma.token },
      );
      assert.equal(miembros.status, 200);
      assert.deepEqual(
        miembros.body,
        [],
        'la organización nace sin miembros: su administrador llega por correo',
      );
    });

    it('y aun así la gestiona entera, que es de lo que se trata', async (t) => {
      if (!up) return t.skip(SKIP_MESSAGE);
      const creada = await api<{ id: string }>('POST', '/organizations', {
        token: plataforma.token,
        body: { name: `Plat ${unique('p')}` },
      });
      const base = `/organizations/${creada.body.id}`;
      assert.equal(
        (
          await api('POST', `${base}/members`, {
            token: plataforma.token,
            body: { identifier: normal.username, role: 'AGENT' },
          })
        ).status,
        201,
      );
      assert.equal(
        (
          await api('POST', `${base}/categories`, {
            token: plataforma.token,
            body: { name: 'Prueba', color: '#0d6c90' },
          })
        ).status,
        201,
      );
    });

    it('quien no es de plataforma sí se queda dentro al crearla', async (t) => {
      if (!up) return t.skip(SKIP_MESSAGE);
      const creada = await api<{ id: string }>('POST', '/organizations', {
        token: normal.token,
        body: { name: `Norm ${unique('n')}` },
      });
      assert.equal(creada.status, 201);
      const miembros = await api<Array<{ role: string }>>(
        'GET',
        `/organizations/${creada.body.id}/members`,
        { token: normal.token },
      );
      assert.equal(miembros.body.length, 1);
      assert.equal(miembros.body[0]!.role, 'ORG_ADMIN');
    });
  },
);
