import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  apiClient,
  ApiError,
  ApiKeyMissingError,
  UnauthorizedError,
} from '@/lib/api-client';

describe('apiClient', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function mockResponse(body: unknown, init: { status?: number } = {}) {
    const status = init.status ?? 200;
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
      text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
      headers: new Headers({ 'content-type': 'application/json' }),
    } as unknown as Response;
  }

  describe('get', () => {
    it('issues a GET and returns parsed JSON', async () => {
      (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        mockResponse([{ id: '1' }])
      );

      const result = await apiClient.get<Array<{ id: string }>>('/api/clients');

      expect(fetch).toHaveBeenCalledWith(
        '/api/clients',
        expect.objectContaining({ method: 'GET' })
      );
      expect(result).toEqual([{ id: '1' }]);
    });

    it('appends query params when provided', async () => {
      (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        mockResponse([])
      );

      await apiClient.get('/api/clients', { search: 'acme', status: 'active' });

      const calledUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(calledUrl).toContain('search=acme');
      expect(calledUrl).toContain('status=active');
    });

    it('skips undefined and null query params', async () => {
      (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        mockResponse([])
      );

      await apiClient.get('/api/clients', { search: undefined, status: null, q: 'x' });

      const calledUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(calledUrl).not.toContain('search=');
      expect(calledUrl).not.toContain('status=');
      expect(calledUrl).toContain('q=x');
    });
  });

  describe('post', () => {
    it('issues a POST with JSON body', async () => {
      (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        mockResponse({ id: '1', name: 'Acme' }, { status: 201 })
      );

      const result = await apiClient.post('/api/clients', { name: 'Acme' });

      expect(fetch).toHaveBeenCalledWith(
        '/api/clients',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ name: 'Acme' }),
        })
      );
      expect(result).toEqual({ id: '1', name: 'Acme' });
    });

    it('omits body when not provided', async () => {
      (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        mockResponse({ ok: true })
      );

      await apiClient.post('/api/sessions/123/synthesize');

      const init = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][1];
      expect(init.body).toBeUndefined();
    });
  });

  describe('patch', () => {
    it('issues a PATCH with JSON body', async () => {
      (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        mockResponse({ id: '1', name: 'New' })
      );

      await apiClient.patch('/api/clients/1', { name: 'New' });

      expect(fetch).toHaveBeenCalledWith(
        '/api/clients/1',
        expect.objectContaining({ method: 'PATCH' })
      );
    });
  });

  describe('delete', () => {
    it('issues a DELETE and returns parsed JSON when present', async () => {
      (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        mockResponse({ ok: true })
      );

      const result = await apiClient.delete('/api/clients/1');

      expect(fetch).toHaveBeenCalledWith(
        '/api/clients/1',
        expect.objectContaining({ method: 'DELETE' })
      );
      expect(result).toEqual({ ok: true });
    });

    it('handles 204 No Content', async () => {
      (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        status: 204,
        json: async () => {
          throw new Error('no body');
        },
        text: async () => '',
        headers: new Headers(),
      } as unknown as Response);

      const result = await apiClient.delete('/api/clients/1');
      expect(result).toBeNull();
    });
  });

  describe('error mapping', () => {
    it('throws UnauthorizedError on 401', async () => {
      (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        mockResponse({ error: 'Unauthorized' }, { status: 401 })
      );

      await expect(apiClient.get('/api/clients')).rejects.toBeInstanceOf(
        UnauthorizedError
      );
    });

    it('throws ApiKeyMissingError on 422 with NO_API_KEY error', async () => {
      (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        mockResponse({ error: 'NO_API_KEY' }, { status: 422 })
      );

      await expect(
        apiClient.post('/api/sessions/1/synthesize')
      ).rejects.toBeInstanceOf(ApiKeyMissingError);
    });

    it('throws ApiError on 500 with server message', async () => {
      (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        mockResponse({ error: 'boom' }, { status: 500 })
      );

      await expect(apiClient.get('/api/clients')).rejects.toMatchObject({
        name: 'ApiError',
        status: 500,
        message: 'boom',
      });
    });

    it('throws ApiError with status text fallback when body has no error field', async () => {
      (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        mockResponse({}, { status: 503 })
      );

      await expect(apiClient.get('/api/clients')).rejects.toMatchObject({
        status: 503,
      });
    });

    it('ApiError exposes the parsed error body', async () => {
      (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        mockResponse(
          { error: 'Validation failed', details: { name: 'required' } },
          { status: 400 }
        )
      );

      try {
        await apiClient.post('/api/clients', {});
        throw new Error('should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        const apiError = error as ApiError;
        expect(apiError.status).toBe(400);
        expect(apiError.body).toEqual({
          error: 'Validation failed',
          details: { name: 'required' },
        });
      }
    });
  });
});
