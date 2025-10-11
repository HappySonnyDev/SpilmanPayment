import { NextRequest, NextResponse } from "next/server";
import { AuthService, setAuthCookie, validatePublicKey } from "@/lib/auth";



export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { publicKey: clientPublicKey } = body;

    const authService = new AuthService();
    let user, token;

    if (clientPublicKey) {
      // New public key authentication
      if (!validatePublicKey(clientPublicKey)) {
        return NextResponse.json(
          { error: "Invalid public key format" },
          { status: 400 },
        );
      }
      const result = await authService.loginWithPublicKey(clientPublicKey);
      user = result.user;
      token = result.token;
    } else {
      return NextResponse.json(
        { error: "Public key is required" },
        { status: 400 },
      );
    }

    // Get public key and seller address
    const userPublicKey = user.public_key;
    const sellerAddress = await authService.getSellerAddress();
    const serverPublicKey = await authService.getPublicKey();

    // Get user's active payment channel
    const activeChannel = authService.getActivePaymentChannel(user.id);

    // Create response with user data (excluding password hash) including public key and seller address
    const userData = {
      id: user.id,
      created_at: user.created_at,
      is_active: Boolean(user.is_active), // Ensure boolean conversion from SQLite integer
      public_key: userPublicKey,
      seller_address: sellerAddress,
      serverPublicKey,
            username: user.username,
      active_channel: activeChannel
        ? {
            channelId: activeChannel.channel_id,
            txHash: activeChannel.tx_hash,
            amount: activeChannel.amount,
            consumed_tokens: activeChannel.consumed_tokens,
            status: activeChannel.status,
          }
        : null,
    };

    const response = NextResponse.json({
      message: "Login successful",
      user: userData,
    });

    // Set authentication cookie
    response.headers.set("Set-Cookie", setAuthCookie(token));

    return response;
  } catch (error) {
    if (error instanceof Error) {
      if (
        error.message === "Invalid credentials" ||
        error.message === "Invalid public key format"
      ) {
        return NextResponse.json(
          { error: "Invalid credentials or public key" },
          { status: 401 },
        );
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
