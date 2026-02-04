import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the PDF file from form data
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Check file type
    if (!file.type.includes('pdf') && !file.name.endsWith('.pdf')) {
      return NextResponse.json({ error: 'File must be a PDF' }, { status: 400 });
    }

    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 400 });
    }

    // Convert to base64
    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString('base64');

    // Check if Modal endpoint is configured
    const modalEndpoint = process.env.MODAL_ENDPOINT_URL;

    if (!modalEndpoint) {
      // Return mock data for development/demo
      return NextResponse.json({
        transactions: [
          {
            date: '2024-01-15',
            description: 'PDF extraction not configured - add MODAL_ENDPOINT_URL to .env.local',
            amount: 0,
          },
        ],
        error: 'MODAL_ENDPOINT_URL not configured',
        demo: true,
      });
    }

    // Call Modal endpoint
    const response = await fetch(modalEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        pdf_base64: base64,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Modal API error:', errorText);
      return NextResponse.json(
        { error: 'PDF extraction failed', details: errorText },
        { status: 500 }
      );
    }

    const result = await response.json();

    return NextResponse.json({
      transactions: result.transactions || [],
      error: result.error,
      pagesProcessed: result.pages_processed,
    });
  } catch (error) {
    console.error('PDF extraction error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process PDF' },
      { status: 500 }
    );
  }
}
