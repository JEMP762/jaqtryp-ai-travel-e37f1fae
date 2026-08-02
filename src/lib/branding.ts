import { supabase } from "@/integrations/supabase/client";

export const BRAND_BUCKET = "brand-logos";
export const MAX_LOGO_BYTES = 2 * 1024 * 1024; // 2 MB
export const ALLOWED_LOGO_TYPES = ["image/png", "image/jpeg", "image/webp"];

export type Branding = {
  companyName: string | null;
  logoPath: string | null;
  logoUrl: string | null;
};

export async function signLogoUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await supabase.storage
    .from(BRAND_BUCKET)
    .createSignedUrl(path, 60 * 60);
  if (error) return null;
  return data?.signedUrl ?? null;
}

export async function loadBranding(): Promise<Branding> {
  const empty: Branding = { companyName: null, logoPath: null, logoUrl: null };
  try {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return empty;
    const { data, error } = await supabase
      .from("user_branding")
      .select("company_name, logo_path")
      .eq("user_id", user.id)
      .maybeSingle();
    if (error || !data) return empty;
    return {
      companyName: data.company_name ?? null,
      logoPath: data.logo_path ?? null,
      logoUrl: await signLogoUrl(data.logo_path ?? null),
    };
  } catch {
    return empty;
  }
}

export async function uploadLogo(file: File): Promise<Branding> {
  if (!ALLOWED_LOGO_TYPES.includes(file.type)) {
    throw new Error("Formato inválido. Use PNG, JPG ou WEBP.");
  }
  if (file.size > MAX_LOGO_BYTES) {
    throw new Error("A logo deve ter no máximo 2 MB.");
  }
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  if (!user) throw new Error("Sessão expirada. Entre novamente.");

  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${user.id}/logo.${ext}`;

  const { error } = await supabase.storage
    .from(BRAND_BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw new Error(error.message);

  const { error: upsertError } = await supabase
    .from("user_branding")
    .upsert({ user_id: user.id, logo_path: path }, { onConflict: "user_id" });
  if (upsertError) throw new Error(upsertError.message);

  return {
    companyName: null,
    logoPath: path,
    logoUrl: await signLogoUrl(path),
  };
}

export async function saveCompanyName(companyName: string): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  if (!user) return;
  await supabase
    .from("user_branding")
    .upsert({ user_id: user.id, company_name: companyName || null }, { onConflict: "user_id" });
}

export async function removeLogo(logoPath: string | null): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  if (!user) return;
  if (logoPath) {
    await supabase.storage.from(BRAND_BUCKET).remove([logoPath]);
  }
  await supabase
    .from("user_branding")
    .upsert({ user_id: user.id, logo_path: null }, { onConflict: "user_id" });
}

/** Converts a signed URL to a data URL so the print window always renders it. */
export async function logoAsDataUrl(url: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const blob = await resp.blob();
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}
