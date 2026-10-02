import { IconButton } from './IconButton';

export interface PaginationProps {
  currentPage: number;
  label?: string;
  onPageChange: (page: number) => void;
  totalPages: number;
}

export function Pagination({
  currentPage,
  label = 'Pagination',
  onPageChange,
  totalPages,
}: PaginationProps) {
  return (
    <nav aria-label={label} className="flex items-center gap-1">
      <IconButton
        disabled={currentPage <= 1}
        icon="chevron-left"
        label="Previous page"
        onClick={() => onPageChange(currentPage - 1)}
        size="sm"
      />
      {Array.from({ length: totalPages }, (_, index) => index + 1).map(
        (page) => (
          <button
            aria-current={page === currentPage ? 'page' : undefined}
            className={`size-8 rounded-[7px] text-xs ${page === currentPage ? 'bg-primary text-surface' : 'text-muted'}`}
            key={page}
            onClick={() => onPageChange(page)}
            type="button"
          >
            {page}
          </button>
        ),
      )}
      <IconButton
        disabled={currentPage >= totalPages}
        icon="chevron-right"
        label="Next page"
        onClick={() => onPageChange(currentPage + 1)}
        size="sm"
      />
    </nav>
  );
}
