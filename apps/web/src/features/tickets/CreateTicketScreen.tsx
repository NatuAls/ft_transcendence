import { useAsync } from '../../core/async/useAsync';
import { AsyncState } from '../../core/async/AsyncState';
import { previewMode } from '../../app/session';
import { listCategories } from '../../api/organizations';
import { organizationFixture } from '../organization/organizationData';
import { CreateTicketPage, type NewTicketValues } from './CreateTicketPage';

/**
 * Las categorías con las que se abre un ticket salen de la organización
 * activa, no de los datos de ejemplo.
 *
 * Antes `WorkspacePage` las sacaba de `organizationFixture(organizationId)`,
 * que devuelve la MISMA lista de muestra para cualquier identificador que no
 * conozca — y los de verdad son UUID, así que no conoce ninguno. En la
 * aplicación real el desplegable enseñaba las categorías de la organización de
 * muestra, y el ticket se creaba con una categoría que no existe en la
 * organización en la que estás. La vista previa sigue con su fixture.
 */
export function CreateTicketScreen({
  onCancel,
  onSubmit,
  organizationId,
  organizationName,
}: {
  onCancel: () => void;
  onSubmit: (values: NewTicketValues) => void;
  organizationId: string;
  organizationName: string;
}) {
  const categories = useAsync(async () => {
    if (previewMode || !organizationId) {
      return organizationFixture(organizationId).categories.map((row) => ({
        description: row[2],
        name: row[1],
      }));
    }
    return (await listCategories(organizationId))
      .filter((category) => category.isActive)
      .map((category) => ({
        description: category.description ?? '',
        name: category.name,
      }));
  }, [organizationId]);

  return (
    <AsyncState
      error={categories.error}
      errorTitle="The categories of this organization could not be loaded"
      onRetry={categories.reload}
      status={categories.status}
    >
      <CreateTicketPage
        categories={categories.data ?? []}
        onCancel={onCancel}
        onSubmit={onSubmit}
        organizationName={organizationName}
      />
    </AsyncState>
  );
}
