import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button, Descriptions, Result, Spin, Tag, Typography } from 'antd';
import { LoadingOutlined } from '@ant-design/icons';
import 'bootstrap/dist/css/bootstrap.min.css';

const { Title } = Typography;

const ERROR_MESSAGES = {
  INVALID_STATE: 'Authentication session expired. Please try signing in again.',
  TOKEN_EXPIRED: 'Your token has expired. Please sign in again.',
  INVALID_NONCE: 'Security validation failed. Please try again.',
  JWT_VERIFICATION_FAILED: 'Security validation failed. Please try again.',
  INTEGRATION_NOT_FOUND: 'SSO configuration not found for your organisation.',
  CONFIG_NOT_FOUND: 'SSO configuration not found for your organisation.',
  MISSING_EMAIL: 'Your account is missing a required email claim.',
  MISSING_OID: 'Your account is missing a required identifier.',
};

function resolveErrorMessage(code, fallback) {
  return ERROR_MESSAGES[code] ?? fallback ?? 'Sign-in failed. Please try again.';
}

export default function OIDCCallback({ apiBase = '' }) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('loading'); // 'loading' | 'success' | 'error'
  const [errorMsg, setErrorMsg] = useState('');
  const [tokenResponse, setTokenResponse] = useState(null);
  const exchanged = useRef(false); // prevent double-invoke in React StrictMode

  useEffect(() => {
    if (exchanged.current) return;
    exchanged.current = true;

    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const company_id = sessionStorage.getItem('oidc_company_id');

    sessionStorage.removeItem('oidc_company_id');

    if (!code || !state) {
      setErrorMsg('Missing authorisation parameters in the callback URL.');
      setStatus('error');
      return;
    }

    if (!company_id) {
      setErrorMsg('Session expired before sign-in completed. Please try again.');
      setStatus('error');
      return;
    }

    (async () => {
      try {
        const res = await fetch(`${apiBase}/auth/oidc/token-exchange`, {
          method: 'POST',
          credentials: 'include', // required — backend reads express-session cookie
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, state, company_id }),
        });

        const data = await res.json();

        if (!res.ok) {
          const errCode = data.code ?? data.error?.code;
          const message = data.error ?? data.error?.message;
          setErrorMsg(resolveErrorMessage(errCode, typeof message === 'string' ? message : undefined));
          setStatus('error');
          return;
        }

        setTokenResponse(data);
        setStatus('success');

        // TODO: redirect to dashboard once route exists
        // navigate('/dashboard');
      } catch {
        setErrorMsg('Network error. Please check your connection and try again.');
        setStatus('error');
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (status === 'loading') {
    return (
      <div className="container-fluid min-vh-100 d-flex align-items-center justify-content-center bg-light">
        <div className="text-center">
          <Spin indicator={<LoadingOutlined style={{ fontSize: 40 }} spin />} />
          <p className="mt-3 text-secondary">Verifying with Microsoft Entra&hellip;</p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="container-fluid min-vh-100 d-flex align-items-center justify-content-center bg-light">
        <div className="card shadow-sm border-0 p-4" style={{ maxWidth: 480, width: '100%' }}>
          <Result
            status="error"
            title="Sign-in failed"
            subTitle={errorMsg}
            extra={
              <Button type="primary" block onClick={() => navigate('/')}>
                Back to sign-in
              </Button>
            }
          />
        </div>
      </div>
    );
  }

  const { user, session } = tokenResponse ?? {};

  return (
    <div className="container py-5">
      <div className="row justify-content-center">
        <div className="col-12 col-lg-8">
          <div className="card shadow-sm border-0 p-4">
            <div className="d-flex align-items-center gap-3 mb-4">
              <span className="fs-2">✅</span>
              <Title level={4} className="mb-0">Authentication successful</Title>
            </div>

            <Descriptions
              title="User Claims"
              bordered
              column={1}
              size="small"
              className="mb-4"
            >
              <Descriptions.Item label="OID">{user?.oid ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="Email">{user?.email ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="Name">{user?.name ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="Tenant ID">{user?.tid ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="Groups">
                {user?.groups?.length
                  ? user.groups.map((g) => <Tag key={g}>{g}</Tag>)
                  : <Tag color="default">None</Tag>}
              </Descriptions.Item>
            </Descriptions>

            <Descriptions
              title="Session Metadata"
              bordered
              column={1}
              size="small"
            >
              <Descriptions.Item label="Protocol">
                <Tag color="blue">{session?.protocol ?? '—'}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Auth Method">
                <Tag color="geekblue">{session?.authMethod ?? '—'}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Group Source">
                <Tag color="purple">{session?.groupSource ?? '—'}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Validated At">{session?.validatedAt ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="Processing Time">
                {session?.processingTimeMs != null ? `${session.processingTimeMs} ms` : '—'}
              </Descriptions.Item>
            </Descriptions>
          </div>
        </div>
      </div>
    </div>
  );
}

"redirect_uri": "http://localhost:5763/auth/oidc/callback"
