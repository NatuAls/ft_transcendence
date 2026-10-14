import { unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { loadConfiguration } from '../../config/env.ts';

const PUBLIC_PREFIX = '/api/v1/users/avatars/';

/**
 * Removes an uploaded avatar from disk.
 *
 * Avatars are served publicly by their URL, so a photo that is nobody's any
 * more must not stay reachable by whoever kept the link — after removing it
 * from a profile, and after erasing the account it belonged to. The key is
 * checked with the same rule the route that serves it applies, so a value
 * that is not one of ours never turns into a path.
 */
export async function removeAvatarFile(
  avatarUrl: string | null | undefined,
): Promise<void> {
  if (!avatarUrl?.startsWith(PUBLIC_PREFIX)) return;
  const key = avatarUrl.slice(PUBLIC_PREFIX.length);
  if (!/^[0-9a-f-]{36}\.webp$/.test(key)) return;
  await unlink(join(loadConfiguration().UPLOAD_DIR, 'avatars', key)).catch(
    () => undefined,
  );
}
