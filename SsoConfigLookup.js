import { Alert, Button, Card, Form, Input, Typography } from 'antd';
import { useState } from 'react';

const initialState = {
  loading: false,
  error: '',
  result: null,
};

const { Paragraph, Text, Title } = Typography;

const buildOidcAuthorizeUrl = (config) => {
  const params = new URLSearchParams({
    client_id: config.client_id,
    response_type: 'code',
    redirect_uri: config.redirect_uri,
    scope: config.scope,
    state: config.state,
    nonce: config.nonce,
    response_mode: config.response_mode || 'query',
  });

  if (config.code_challenge) {
    params.set('code_challenge', config.code_challenge);
    params.set('code_challenge_method', config.code_challenge_method);
  }

  return `${config.sso_url}?${params.toString()}`;
};

const triggerSSORedirect = (payload) => {
  if (payload.protocol === 'saml') {
    window.location.href = payload.redirectUrl;
    return;
  }

  if (payload.protocol === 'oidc') {
    sessionStorage.setItem('oidc_company_id', payload.company_id);
    const authorizeUrl = buildOidcAuthorizeUrl(payload.config);
    window.location.href = authorizeUrl;
  }
};

function SsoConfigLookup() {
  const [form] = Form.useForm();
  const [state, setState] = useState(initialState);

  const handleSubmit = async (values) => {
    setState({
      loading: true,
      error: '',
      result: null,
    });

    try {
      const response = await fetch('/auth/domain-check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },

        body: JSON.stringify({
          email: values.email.trim(),
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error?.message || 'Unable to fetch SSO config.');
      }

      if (payload.found) {
        setState({ loading: true, error: '', result: null });
        triggerSSORedirect(payload);
        return;
      }

      setState({
        loading: false,
        error: '',
        result: payload,
      });
    } catch (error) {
      setState({
        loading: false,
        error: error.message || 'Something went wrong.',
        result: null,
      });
    }
  };


  return (
    <section className="lookup-shell container py-5">
      <div className="row justify-content-center">
        <div className="col-12 col-lg-10 col-xl-8">
          <Card className="lookup-card border-0 shadow-lg">
            <div className="lookup-copy">
              <Text className="eyebrow">SSO Lookup</Text>
              <Title level={2} className="lookup-title">
                Find your sign-in configuration
              </Title>
              <Paragraph className="copy mb-0">
                Enter your work email address and we&apos;ll fetch the matching
                SSO configuration from the API.
              </Paragraph>
            </div>

            <Form
              form={form}
              layout="vertical"
              className="lookup-form"
              onFinish={handleSubmit}
              autoComplete="off"
            >
              <Form.Item
                label="Email address"
                name="email"
                rules={[
                  {
                    required: true,
                    message: 'Please enter an email address.',
                  },
                  {
                    type: 'email',
                    message: 'Please enter a valid email address.',
                  },
                ]}
              >
                <Input
                  size="large"
                  placeholder="name@company.com"
                  allowClear
                />
              </Form.Item>

              <Form.Item className="mb-0">
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={state.loading}
                  size="large"
                  className="lookup-button"
                >
                  Fetch SSO Config
                </Button>
              </Form.Item>
            </Form>

            {state.error ? (
              <Alert
                className="mt-4"
                message="Request failed"
                description={state.error}
                type="error"
                showIcon
              />
            ) : null}

            {state.result ? (
              <Alert
                className="mt-4"
                message={state.result.message}
                type="info"
                showIcon
              />
            ) : null}
          </Card>
        </div>
      </div>
    </section>
  );
}

export default SsoConfigLookup;
