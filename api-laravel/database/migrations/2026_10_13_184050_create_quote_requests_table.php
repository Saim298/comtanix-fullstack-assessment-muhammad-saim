<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('quote_requests', function (Blueprint $table) {
            $table->id();
            $table->string('client_name', 150);
            $table->string('email');
            $table->string('company', 150)->nullable();
            $table->string('service_type', 100);
            $table->string('budget_range', 80);
            $table->text('message');
            $table->enum('status', [
                'new',
                'in_review',
                'quoted',
                'closed'
            ])->default('new');

            $table->foreignId('assigned_user_id')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();

            $table->timestamps();
            $table->softDeletes();

            $table->index(['status', 'created_at']);
            $table->index(['assigned_user_id', 'status', 'created_at']);
            $table->index(['service_type', 'created_at']);
            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('quote_requests');
    }
};
