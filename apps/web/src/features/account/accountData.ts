export interface AccountProfile {
  bio: string;
  email: string;
  firstName: string;
  fullName: string;
  jobTitle: string;
  lastName: string;
  location: string;
  username: string;
}

export const initialAccountProfile: AccountProfile = {
  bio: 'I help teams turn complicated problems into clear product experiences.',
  email: 'ana@northstar.test',
  firstName: 'Ana',
  fullName: 'Ana Ruiz',
  jobTitle: 'Product designer',
  lastName: 'Ruiz',
  location: 'Europe/Madrid',
  username: 'aruiz',
};
