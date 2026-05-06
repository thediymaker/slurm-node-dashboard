"use server";

import { auth } from "@/auth";
import { headers } from "next/headers";

export async function authenticate(
  prevState: string | undefined,
  formData: FormData
) {
  try {
    await auth.api.signInAdmin({
      body: {
        username: String(formData.get("username") ?? ""),
        password: String(formData.get("password") ?? ""),
        rememberMe: true,
      },
      headers: await headers(),
    });
  } catch {
    return "Invalid credentials.";
  }
}
