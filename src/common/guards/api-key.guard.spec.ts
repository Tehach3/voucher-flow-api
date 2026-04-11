import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ApiKeyGuard } from './api-key.guard';

const mockContext = (headers: Record<string, string>): ExecutionContext =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({ headers, ip: '127.0.0.1' }),
    }),
  }) as unknown as ExecutionContext;

describe('ApiKeyGuard', () => {
  let guard: ApiKeyGuard;

  beforeEach(() => {
    process.env.API_KEY = 'test-secret';
    guard = new ApiKeyGuard();
  });

  afterEach(() => {
    delete process.env.API_KEY;
  });

  it('throws when Authorization header is missing', () => {
    expect(() => guard.canActivate(mockContext({}))).toThrow(
      UnauthorizedException,
    );
  });

  it('throws when format is not Bearer scheme', () => {
    expect(() =>
      guard.canActivate(mockContext({ authorization: 'Basic abc123' })),
    ).toThrow(UnauthorizedException);
  });

  it('throws when token does not match API_KEY', () => {
    expect(() =>
      guard.canActivate(mockContext({ authorization: 'Bearer wrong-key' })),
    ).toThrow(UnauthorizedException);
  });

  it('returns true when token matches API_KEY', () => {
    const result = guard.canActivate(
      mockContext({ authorization: 'Bearer test-secret' }),
    );
    expect(result).toBe(true);
  });
});
