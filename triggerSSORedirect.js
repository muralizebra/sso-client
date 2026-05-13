const triggerSSORedirect = async (data) => {
  if (data.protocol === "saml") {
    window.location.href = data.redirectUrl;
    return;
  }

  if (data.protocol !== "oidc") {
    message.error("Unsupported SSO protocol. Please contact your administrator.");
    return;
  }

  const response = await fetch("/api/sso-config", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify({
      email: data.email,
      organizationName: data.organizationName || "",
    }),
  });

  const result = await response.json();

  if (!response.ok) {
    if (result.requiresOrganizationName) {
      throw new Error(result.error);
    }

    throw new Error(result.error || "Unable to start SSO sign-in");
  }

  const params = new URLSearchParams({
    client_id: result.clientId,
    response_type: result.responseType,
    redirect_uri: result.redirectUri,
    scope: result.scope,
    state: result.state,
    login_hint: result.loginHint,
  });

  if (result.codeChallenge && result.codeChallengeMethod) {
    params.set("code_challenge", result.codeChallenge);
    params.set("code_challenge_method", result.codeChallengeMethod);
  }

  window.location.href = `${result.authorizationEndpoint}?${params.toString()}`;
};
