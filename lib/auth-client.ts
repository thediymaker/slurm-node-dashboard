import { createAuthClient } from "better-auth/react";
import { withBasePath } from "@/lib/base-path";

export const authClient = createAuthClient({ basePath: withBasePath("/api/auth") });
