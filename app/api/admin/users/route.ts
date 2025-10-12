import { NextRequest, NextResponse } from 'next/server';
import { UserRepository, User } from '@/lib/server/database';

export async function GET(request: NextRequest) {
  try {
    // In a real admin system, you would add authentication checks here
    // For now, this is for demo purposes
    
    const userRepo = new UserRepository();
    const users = userRepo.getAllUsers();

    // Format users for admin display
    const formattedUsers = users.map((user: User) => ({
      id: user.id,
      email: user.email,
      username: user.username,
      created_at: user.created_at,
      is_active: Boolean(user.is_active), // Convert SQLite integer to boolean
      public_key: user.public_key
    }));

    return NextResponse.json({
      users: formattedUsers,
      total: formattedUsers.length
    });

  } catch (error) {
    console.error('Error fetching users for admin:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}