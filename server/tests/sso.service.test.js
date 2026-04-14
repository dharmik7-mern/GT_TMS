import jwt from 'jsonwebtoken';
import { jest } from '@jest/globals';
import { completeSsoLogin, completeSsoLogoutSync } from '../src/services/ssoAuth.service.js';

function makeLoginConfig() {
  return {
    expectedIssuer: 'hrms-sso',
    expectedAudience: 'tms',
    verificationSecret: 'unit-test-secret',
    verificationPublicKey: '',
    verificationAlgorithms: ['HS256'],
    tokenExpiry: '5m',
    trustedOrigins: [],
    hrmsSsoUrl: 'https://hrms.example.com/login',
    tmsCallbackUrl: 'https://tms.example.com/api/auth/callback',
  };
}

function signInboundToken(payload, options = {}) {
  return jwt.sign(payload, 'unit-test-secret', {
    algorithm: 'HS256',
    issuer: 'hrms-sso',
    audience: 'tms',
    expiresIn: options.expiresIn || '2m',
  });
}

function createUserDoc(overrides = {}) {
  return {
    _id: 'user-1',
    name: 'Jane Doe',
    email: 'jane@example.com',
    employeeId: 'EMP-1',
    role: 'manager',
    isActive: true,
    avatar: null,
    jobTitle: null,
    department: null,
    isModified: jest.fn(() => false),
    save: jest.fn(async () => {}),
    ...overrides,
  };
}

function baseOverrides() {
  const user = createUserDoc();
  const membershipDoc = {
    workspaceId: 'ws-1',
    role: 'manager',
    status: 'active',
    save: jest.fn(async () => {}),
  };
  const models = {
    User: {
      findOne: jest.fn(() => ({
        select: jest.fn((selection) => {
          if (selection === '_id') {
            return { lean: jest.fn(async () => ({ _id: 'user-1' })) };
          }
          return Promise.resolve(user);
        }),
      })),
      create: jest.fn(async (payload) => createUserDoc({ ...payload, _id: 'user-created' })),
    },
    Workspace: {
      findOne: jest.fn(() => ({
        select: jest.fn(() => ({ lean: jest.fn(async () => ({ _id: 'ws-1', name: 'Main Workspace' })) })),
        sort: jest.fn(() => ({
          select: jest.fn(() => ({ lean: jest.fn(async () => ({ _id: 'ws-1', name: 'Main Workspace' })) })),
          lean: jest.fn(async () => ({ _id: 'ws-1', name: 'Main Workspace' })),
        })),
      })),
      create: jest.fn(async (payload) => ({ _id: 'ws-new', name: payload.name })),
    },
    Membership: {
      findOne: jest.fn((filter) => {
        if (filter?.workspaceId) return Promise.resolve(membershipDoc);
        return {
          sort: jest.fn(() => ({ lean: jest.fn(async () => ({ workspaceId: 'ws-1', role: 'manager', status: 'active' })) })),
        };
      }),
      create: jest.fn(async () => ({})),
    },
    RefreshToken: {
      updateMany: jest.fn(async () => ({ acknowledged: true })),
    },
  };

  return {
    Company: {
      findById: jest.fn(() => ({
        select: jest.fn(() => ({ lean: jest.fn(async () => ({ _id: 'tenant-1', organizationId: 'ORG-1' })) })),
      })),
      findOne: jest.fn(() => ({
        select: jest.fn(() => ({ lean: jest.fn(async () => ({ _id: 'tenant-1', organizationId: 'ORG-1' })) })),
      })),
    },
    AuthLookup: {
      findOne: jest.fn(() => ({ select: jest.fn(() => ({ lean: jest.fn(async () => null) })) })),
      updateOne: jest.fn(async () => ({ acknowledged: true })),
    },
    getTenantModels: jest.fn(async () => models),
    hashPassword: jest.fn(async () => 'hashed-secret'),
    signSsoToken: jest.fn(() => 'local-session-token'),
    writeAudit: jest.fn(async () => {}),
    models,
  };
}

describe('SSO auth service', () => {
  it('valid login should return local session token and user session', async () => {
    const token = signInboundToken({
      sub: 'hrms-user-1',
      companyId: 'tenant-1',
      workspaceId: 'ws-1',
      email: 'jane@example.com',
      role: 'manager',
      name: 'Jane Doe',
    });

    const overrides = baseOverrides();
    const result = await completeSsoLogin(
      { token, config: makeLoginConfig(), requestContext: {} },
      overrides
    );

    expect(result.accessToken).toBe('local-session-token');
    expect(result.user.email).toBe('jane@example.com');
    expect(result.autoProvisioned).toBe(false);
  });

  it('expired token should fail with token_expired reason', async () => {
    const token = signInboundToken(
      {
        sub: 'hrms-user-1',
        companyId: 'tenant-1',
        workspaceId: 'ws-1',
        email: 'jane@example.com',
        role: 'manager',
      },
      { expiresIn: '-10s' }
    );

    await expect(
      completeSsoLogin(
        { token, config: makeLoginConfig(), requestContext: {} },
        baseOverrides()
      )
    ).rejects.toMatchObject({ reason: 'token_expired', statusCode: 401 });
  });

  it('tampered token should fail with invalid_token reason', async () => {
    const token = signInboundToken({
      sub: 'hrms-user-1',
      companyId: 'tenant-1',
      workspaceId: 'ws-1',
      email: 'jane@example.com',
      role: 'manager',
    });
    const tamperedToken = `${token.slice(0, -1)}x`;

    await expect(
      completeSsoLogin(
        { token: tamperedToken, config: makeLoginConfig(), requestContext: {} },
        baseOverrides()
      )
    ).rejects.toMatchObject({ reason: 'invalid_token', statusCode: 401 });
  });

  it('missing user should auto-provision', async () => {
    const token = signInboundToken({
      sub: 'hrms-user-99',
      companyId: 'tenant-1',
      workspaceId: 'ws-1',
      email: 'new.user@example.com',
      employeeId: 'EMP-99',
      role: 'team_member',
      name: 'New User',
    });

    const overrides = baseOverrides();
    overrides.getTenantModels = jest.fn(async () => ({
      ...overrides.models,
      User: {
        findOne: jest.fn(() => ({ select: jest.fn(async () => null) })),
        create: jest.fn(async (payload) => createUserDoc({ ...payload, _id: 'new-user-1', isModified: jest.fn(() => false) })),
      },
      Membership: {
        findOne: jest.fn((filter) => {
          if (filter?.workspaceId) return Promise.resolve(null);
          return { sort: jest.fn(() => ({ lean: jest.fn(async () => null) })) };
        }),
        create: jest.fn(async () => ({})),
      },
      Workspace: {
        findOne: jest.fn(() => ({
          select: jest.fn(() => ({ lean: jest.fn(async () => ({ _id: 'ws-1', name: 'Main Workspace' })) })),
          sort: jest.fn(() => ({
            select: jest.fn(() => ({ lean: jest.fn(async () => ({ _id: 'ws-1', name: 'Main Workspace' })) })),
            lean: jest.fn(async () => ({ _id: 'ws-1', name: 'Main Workspace' }),
            ),
          })),
        })),
        create: jest.fn(async () => ({ _id: 'ws-2', name: 'Main Workspace' })),
      },
    }));

    const result = await completeSsoLogin(
      { token, config: makeLoginConfig(), requestContext: {} },
      overrides
    );

    expect(result.autoProvisioned).toBe(true);
    expect(overrides.hashPassword).toHaveBeenCalled();
    expect(overrides.AuthLookup.updateOne).toHaveBeenCalled();
  });

  it('logout sync should revoke refresh tokens for matched user', async () => {
    const token = signInboundToken({
      sub: 'hrms-user-1',
      companyId: 'tenant-1',
      email: 'jane@example.com',
      event: 'logout',
    });

    const overrides = baseOverrides();
    const result = await completeSsoLogoutSync(
      { token, config: makeLoginConfig(), requestContext: {} },
      overrides
    );

    expect(result.ok).toBe(true);
    expect(overrides.models.RefreshToken.updateMany).toHaveBeenCalled();
  });
});
