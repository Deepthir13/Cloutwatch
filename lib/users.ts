export type UserRole = "employee" | "client";

export type UserAccess = {
  role: UserRole;
  brand: string | null;
};

export type LoginAs = "employee" | "brand";

export type UserProfile = {
  employee?: boolean;
  clientBrands?: string[];
};

export const USER_PROFILES: Record<string, UserProfile> = {
  "rdeepthi239@gmail.com": { employee: true },
  "deepthir2309@gmail.com": { employee: true, clientBrands: ["Nike"] },
  "brandcontact@gmail.com": { clientBrands: ["Nike"] },
};

export function getUserProfile(email?: string | null) {
  if (!email) {
    return null;
  }

  return USER_PROFILES[email.toLowerCase()] ?? null;
}

export function resolveAccessForLoginAs(
  email: string | null | undefined,
  loginAs: LoginAs,
): UserAccess | null {
  const profile = getUserProfile(email);

  if (!profile) {
    return null;
  }

  if (loginAs === "employee") {
    return profile.employee ? { role: "employee", brand: null } : null;
  }

  const brand = profile.clientBrands?.[0];

  return brand ? { role: "client", brand } : null;
}

export function getUserAccess(email?: string | null) {
  const profile = getUserProfile(email);

  if (!profile) {
    return null;
  }

  if (profile.employee) {
    return { role: "employee", brand: null };
  }

  const brand = profile.clientBrands?.[0];

  return brand ? { role: "client", brand } : null;
}

export function getClientEmailForBrand(brand: string) {
  const match = Object.entries(USER_PROFILES).find(([, profile]) =>
    profile.clientBrands?.includes(brand),
  );

  return match?.[0] ?? null;
}
