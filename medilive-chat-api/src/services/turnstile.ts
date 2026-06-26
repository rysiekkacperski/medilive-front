// Ask Cloudflare if the Turnstile token is legit.
export async function validateTurnstile(
  token: string,
  secret: string,
): Promise<boolean> {
  const formData = new FormData();
  formData.append("secret", secret);
  formData.append("response", token);

  try {
    const res = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      { method: "POST", body: formData },
    );
    const data = (await res.json()) as { success: boolean };
    return data.success === true;
  } catch {
    console.error("Turnstile siteverify request failed");
    return false;
  }
}