import { NextRequest, NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { handleAPIError } from '@/lib/auth/utils';
import { z } from 'zod';

export async function GET() {
  try {
    const { isAuthenticated, userId } = await auth();
    if (!isAuthenticated || !userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const client = await clerkClient();
    const user = await client.users.getUser(userId);

    return NextResponse.json({
      hasApiKey: !!(user.privateMetadata as Record<string, unknown>)?.anthropicApiKey,
      aiModels: (user.publicMetadata as Record<string, unknown>)?.aiModels ?? {},
      role: (user.publicMetadata as Record<string, unknown>)?.role ?? 'viewer',
    });
  } catch (error) {
    return handleAPIError(error);
  }
}

const patchSettingsSchema = z.object({
  anthropicApiKey: z.string().min(1).optional(),
  aiModels: z.record(z.string(), z.string()).optional(),
}).refine(data => data.anthropicApiKey || data.aiModels, {
  message: 'Must provide anthropicApiKey or aiModels',
});

export async function PATCH(req: NextRequest) {
  try {
    const { isAuthenticated, userId } = await auth();
    if (!isAuthenticated || !userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const parsed = patchSettingsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 422 });
    }

    const client = await clerkClient();
    const { anthropicApiKey, aiModels } = parsed.data;

    if (anthropicApiKey) {
      await client.users.updateUserMetadata(userId, {
        privateMetadata: { anthropicApiKey },
        publicMetadata: { hasApiKey: true },
      });
    }

    if (aiModels) {
      await client.users.updateUserMetadata(userId, {
        publicMetadata: { aiModels },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleAPIError(error);
  }
}
