import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  // Registration is no longer needed with private key authentication
  // Users are automatically created when they login with a valid private key
  return NextResponse.json(
    { 
      message: 'Registration is no longer required. Simply login with your private key to create an account automatically.',
      info: 'Users are now authenticated using private keys. When you login with a valid private key, an account will be created automatically if it doesn\'t exist.'
    },
    { status: 200 }
  );
}