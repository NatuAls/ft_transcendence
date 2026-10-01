export function AccountHeader({
  description,
  title,
}: {
  description: string;
  title: string;
}) {
  return (
    <header>
      <span className="text-[11px] tracking-[.08em] text-muted max-md:hidden">
        ACCOUNT
      </span>
      <h1 className="my-2 text-[30px] font-medium max-md:text-[22px]">
        {title}
      </h1>
      <p className="text-sm text-muted max-md:text-xs">{description}</p>
    </header>
  );
}
