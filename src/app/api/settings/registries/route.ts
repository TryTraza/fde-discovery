import { NextResponse } from 'next/server';
import { requireAdmin, handleAPIError } from '@/lib/auth/utils';
import { listAvailableSchemas } from '@/lib/ai/schemas/registry';
import { listAvailableTools } from '@/lib/ai/tools/registry';

export async function GET() {
  try {
    await requireAdmin();
    return NextResponse.json({
      tools: listAvailableTools(),
      schemas: listAvailableSchemas(),
    });
  } catch (error) {
    return handleAPIError(error);
  }
}
