import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  getOrCreateSpreadsheet,
  getSettings,
  updateSettings,
} from '@/lib/google-sheets';

// GET - Fetch settings
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const spreadsheetId = await getOrCreateSpreadsheet(session.accessToken);
    const settings = await getSettings(session.accessToken, spreadsheetId);

    return NextResponse.json({ settings, spreadsheetId });
  } catch (error) {
    console.error('Error fetching settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch settings' },
      { status: 500 }
    );
  }
}

// PUT - Update settings
export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { settings, spreadsheetId } = body;

    if (!settings || !spreadsheetId) {
      return NextResponse.json(
        { error: 'Missing settings or spreadsheetId' },
        { status: 400 }
      );
    }

    await updateSettings(session.accessToken, spreadsheetId, settings);

    return NextResponse.json({ success: true, settings });
  } catch (error) {
    console.error('Error updating settings:', error);
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    );
  }
}
