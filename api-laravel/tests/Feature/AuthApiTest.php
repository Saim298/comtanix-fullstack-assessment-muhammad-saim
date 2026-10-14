<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuthApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_login(): void
    {
        $user = User::factory()->create([
            'role' => 'admin',
            'password' => 'SecurePassword123!',
        ]);

        $this->postJson('/api/login', [
            'email' => $user->email,
            'password' => 'SecurePassword123!',
        ])
            ->assertOk()
            ->assertJsonPath('user.role', 'admin')
            ->assertJsonStructure([
                'token',
                'token_type',
                'user' => ['id', 'name', 'email', 'role'],
            ]);
    }

    public function test_staff_can_login(): void
    {
        $user = User::factory()->create([
            'role' => 'staff',
            'password' => 'SecurePassword123!',
        ]);

        $this->postJson('/api/login', [
            'email' => $user->email,
            'password' => 'SecurePassword123!',
        ])
            ->assertOk()
            ->assertJsonPath('user.role', 'staff');
    }

    public function test_invalid_credentials_are_rejected(): void
    {
        $user = User::factory()->create();

        $this->postJson('/api/login', [
            'email' => $user->email,
            'password' => 'IncorrectPassword!',
        ])->assertUnprocessable();
    }

    public function test_protected_route_requires_authentication(): void
    {
        $this->getJson('/api/user')->assertUnauthorized();
    }

    public function test_authenticated_user_can_get_profile(): void
    {
        $user = User::factory()->create();

        $token = $user->createToken('test-token')->plainTextToken;

        $this->withToken($token)
            ->getJson('/api/user')
            ->assertOk()
            ->assertJsonPath('data.id', $user->id);
    }


    public function test_logout_revokes_current_token(): void
    {
        $user = User::factory()->create();

        $token = $user->createToken('test-token')->plainTextToken;

        $tokenId = $user->tokens()->firstOrFail()->id;

        $this->withToken($token)
            ->postJson('/api/logout')
            ->assertOk()
            ->assertJsonPath('message', 'Logged out successfully.');

        $this->assertDatabaseMissing('personal_access_tokens', [
            'id' => $tokenId,
        ]);
    }


    public function test_revoked_token_cannot_access_protected_route(): void
    {
        $user = User::factory()->create();

        $token = $user->createToken('test-token')->plainTextToken;

        $user->tokens()->delete();

        $this->withToken($token)
            ->getJson('/api/user')
            ->assertUnauthorized()
            ->assertJsonPath('message', 'Unauthenticated.');
    }


}
