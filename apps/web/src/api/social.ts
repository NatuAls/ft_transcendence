import { apiRequest, jsonBody } from '../core/api/client';

/** Someone as the social endpoints return them: public data only. */
export interface PublicPerson {
  id: string;
  profile: {
    avatarUrl: string | null;
    displayName: string;
    isOnline?: boolean;
    lastSeenAt?: string | null;
  } | null;
  username: string;
}

export interface Friend {
  friendshipId: string;
  since: string;
  user: PublicPerson;
}

export interface FriendRequests {
  incoming: Array<{ createdAt: string; id: string; requester: PublicPerson }>;
  outgoing: Array<{ addressee: PublicPerson; createdAt: string; id: string }>;
}

export interface PublicProfile {
  avatarUrl: string | null;
  bio: string | null;
  createdAt: string;
  displayName: string;
  id: string;
  isOnline: boolean;
  jobTitle: string | null;
  lastSeenAt: string | null;
  organizations: Array<{
    id: string;
    name: string;
    role: string;
    slug: string;
  }>;
  stats: { comments: number; ticketsAssigned: number; ticketsCreated: number };
  username: string;
}

export function listFriends(): Promise<Friend[]> {
  return apiRequest('/friends');
}

export function listFriendRequests(): Promise<FriendRequests> {
  return apiRequest('/friends/requests');
}

export async function sendFriendRequest(userId: string): Promise<void> {
  await apiRequest('/friends/requests', {
    method: 'POST',
    ...jsonBody({ userId }),
  });
}

export async function answerFriendRequest(
  id: string,
  action: 'ACCEPT' | 'DECLINE',
): Promise<void> {
  await apiRequest(`/friends/requests/${id}`, {
    method: 'PATCH',
    ...jsonBody({ action }),
  });
}

/** Ends a friendship, or withdraws a request you sent. */
export async function removeFriend(userId: string): Promise<void> {
  await apiRequest(`/friends/${userId}`, { method: 'DELETE' });
}

/** Typeahead over username and e-mail; at least two characters. */
export function searchPeople(query: string): Promise<PublicPerson[]> {
  return apiRequest(`/users/search?q=${encodeURIComponent(query)}`);
}

export function getPublicProfile(username: string): Promise<PublicProfile> {
  return apiRequest(`/users/${encodeURIComponent(username)}`);
}
