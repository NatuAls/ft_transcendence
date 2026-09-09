export function AccountHeader({
  description,
  title,
}: {
  description: string;
  title: string;
}) {
  return (
    <header className="account-heading">
      <span>ACCOUNT</span>
      <h1>{title}</h1>
      <p>{description}</p>
    </header>
  );
}
