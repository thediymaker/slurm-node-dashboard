"use server";

import { signIn } from "@/auth";
import { AuthError } from "next-auth";

export async function authenticate(
  prevState: string | undefined,
  formData: FormData
) {
  try {
    await signIn("credentials", {
      username: formData.get("username"),
      password: formData.get("password"),
      redirect: false,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      const isCredentialsError =
        error.name === "CredentialsSignin" ||
        (typeof error.message === "string" &&
          error.message.includes("CredentialsSignin"));

      if (isCredentialsError) {
        return "Invalid credentials.";
      }

      return "Something went wrong.";
    }
    throw error;
  }
}
