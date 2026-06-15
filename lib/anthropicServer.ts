export function getAnthropicApiKey() {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();

  if (!apiKey || apiKey === "your-key-here") {
    return null;
  }

  return apiKey;
}

export function getAnthropicErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Anthropic request failed.";
}
