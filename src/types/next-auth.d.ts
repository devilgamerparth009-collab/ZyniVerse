import "next-auth";
import type { UserRole } from "@/lib/admin-identity";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      onboarded?: boolean;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      createdAt?: Date;
      role?: UserRole;
      tokenVersion?: number;
      mfaEnabled?: boolean;
      mfaRequired?: boolean;
    };
  }
}
