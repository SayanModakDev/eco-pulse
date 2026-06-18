import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const isDev = process.env.NODE_ENV === 'development';
    
    // In production, the backend is on Cloud Run. In dev, it might be localhost.
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // If running in production on Cloud Run, fetch OIDC ID token from Metadata Server
    if (!isDev && backendUrl.includes('.run.app')) {
      try {
        const metadataUrl = `http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity?audience=${encodeURIComponent(backendUrl)}`;
        const tokenResponse = await fetch(metadataUrl, {
          headers: { 'Metadata-Flavor': 'Google' },
        });
        if (tokenResponse.ok) {
          const token = await tokenResponse.text();
          headers['Authorization'] = `Bearer ${token}`;
        } else {
          console.warn('Failed to fetch OIDC token from metadata server. Status:', tokenResponse.status);
        }
      } catch (err: any) {
        console.error('Failed to retrieve OIDC token from Metadata Server:', err.message);
      }
    }

    const response = await fetch(`${backendUrl}/api/track`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { success: false, message: 'Backend request failed', error: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Proxy Error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error in proxy', error: error.message },
      { status: 500 }
    );
  }
}
