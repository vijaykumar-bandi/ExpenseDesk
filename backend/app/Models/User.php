<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

class User extends Authenticatable
{
    use HasFactory, Notifiable;

    public const ROLE_EMPLOYEE = 'Employee';
    public const ROLE_MANAGER = 'Manager';
    public const ROLE_FINANCE = 'Finance';
    public const ROLE_ADMINISTRATOR = 'Administrator';

    public const ROLES = [
        self::ROLE_EMPLOYEE,
        self::ROLE_MANAGER,
        self::ROLE_FINANCE,
        self::ROLE_ADMINISTRATOR,
    ];

    protected $fillable = [
        'name',
        'email',
        'password',
        'manager_id',
        'active',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'active' => 'boolean',
            'password' => 'hashed',
        ];
    }

    public function roles(): BelongsToMany
    {
        return $this->belongsToMany(Role::class);
    }

    public function manager(): BelongsTo
    {
        return $this->belongsTo(self::class, 'manager_id');
    }

    public function reports(): HasMany
    {
        return $this->hasMany(Report::class, 'employee_id');
    }

    public function roleNames(): array
    {
        return $this->roles->pluck('name')->all();
    }

    public function hasRole(string $role): bool
    {
        return $this->roles->contains('name', $role);
    }

    public function hasAnyRole(array $roles): bool
    {
        return $this->roles->pluck('name')->intersect($roles)->isNotEmpty();
    }

    public function isAdministrator(): bool
    {
        return $this->hasRole(self::ROLE_ADMINISTRATOR);
    }

    public function isFinance(): bool
    {
        return $this->hasRole(self::ROLE_FINANCE);
    }

    public function isManager(): bool
    {
        return $this->hasRole(self::ROLE_MANAGER);
    }

    public function toApiArray(): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'roles' => $this->roleNames(),
            'manager_id' => $this->manager_id,
            'active' => (bool) $this->active,
        ];
    }
}
