/** Verify a NovaOS (Supabase) access token via Auth user endpoint. */

export type SupabaseAuthUser = {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
};

export async function fetchSupabaseUser(
  accessToken: string
): Promise<SupabaseAuthUser | null> {
  const base =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "") ||
    process.env.SUPABASE_URL?.replace(/\/$/, "");
  const anon =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY;
  if (!base || !anon || !accessToken) return null;

  const res = await fetch(`${base}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: anon,
    },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const data = (await res.json()) as SupabaseAuthUser;
  if (!data?.id) return null;
  return data;
}
