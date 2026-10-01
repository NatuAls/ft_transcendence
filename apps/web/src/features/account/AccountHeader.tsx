export function AccountHeader({
  description,
  title,
}: {
  description: string;
  title: string;
}) {
  return (
    <header>
      <span className="text-xs2 tracking-[.08em] text-muted max-md:hidden">
        ACCOUNT
      </span>
      <h1 className="my-2 text-[1.875rem] font-medium max-md:text-[1.375rem]">
        {title}
      </h1>
      <p className="text-sm text-muted max-md:text-xs">{description}</p>
    </header>
  );
}
