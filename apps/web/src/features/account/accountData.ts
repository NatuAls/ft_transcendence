export interface AccountProfile {
  bio: string;
  email: string;
  fullName: string;
  jobTitle: string;
  location: string;
}

export const initialAccountProfile: AccountProfile = {
  bio: 'I help teams turn complicated problems into clear product experiences.',
  email: 'ana@northstar.test',
  fullName: 'Ana Ruiz',
  jobTitle: 'Product designer',
  location: 'Barcelona, Spain',
};
