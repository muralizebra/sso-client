const triggerSSORedirect = (data) => {
  if (data.protocol === 'saml') {

    // SAML: backend returns redirectUrl directly (not inside config)
    window.location.href = data.redirectUrl;

  } else if (data.protocol === 'oidc') {

    // Generate state and nonce on the frontend (client_secret_post method)
    const state = crypto.randomUUID();
    const nonce = crypto.randomUUID();

    // Save these to sessionStorage — needed at the callback page
    sessionStorage.setItem('oidc_company_id', data.company_id);
    sessionStorage.setItem('oidc_state', state);
    sessionStorage.setItem('oidc_nonce', nonce);

    const params = new URLSearchParams({
      client_id:     data.config.client_id,
      response_type: 'code',
      redirect_uri:  data.config.redirect_uri,
      scope:         data.config.scope,
      state,
      nonce,
    });

    // sso_url is inside data.config, not data directly
    window.location.href = `${data.config.sso_url}?${params.toString()}`;

  } else {
    message.error('Unsupported SSO protocol. Please contact your administrator.');
  }
};
