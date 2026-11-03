<?php

namespace App\Http\Controllers\Api;

use App\Http\Requests\ReassignRequest;
use App\Http\Requests\StoreUserRequest;
use App\Http\Requests\UpdateUserRequest;
use App\Models\Report;
use App\Models\Role;
use App\Models\User;
use App\Services\ReportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AdminUserController extends Controller
{
    public function __construct(private ReportService $reports)
    {
    }

    public function index(Request $request): JsonResponse
    {
        $this->authorizeAdmin($request);

        $users = User::with(['roles', 'manager'])->orderBy('name')->get();

        return response()->json([
            'data' => $users->map(fn (User $u) => $this->adminArray($u))->values()->all(),
        ]);
    }

    public function store(StoreUserRequest $request): JsonResponse
    {
        $this->authorizeAdmin($request);

        $user = DB::transaction(function () use ($request) {
            $user = User::create([
                'name' => $request->input('name'),
                'email' => $request->input('email'),
                'password' => $request->input('password'),
                'manager_id' => $request->input('manager_id'),
                'active' => true,
            ]);

            $this->syncRoles($user, $request->input('roles', []));

            return $user;
        });

        return response()->json(['data' => $this->adminArray($user->load(['roles', 'manager']))], 201);
    }

    public function update(UpdateUserRequest $request, User $user): JsonResponse
    {
        $this->authorizeAdmin($request);

        DB::transaction(function () use ($request, $user) {
            $user->fill($request->only(['name', 'email', 'manager_id', 'active']));

            if ($request->filled('password')) {
                $user->password = $request->input('password');
            }

            $user->save();

            if ($request->has('roles')) {
                $this->syncRoles($user, $request->input('roles', []));
            }

            // Deactivating an account ends every session it holds.
            if ($request->has('active') && ! $request->boolean('active')) {
                DB::table('sessions')->where('user_id', $user->id)->delete();
            }
        });

        return response()->json(['data' => $this->adminArray($user->refresh()->load(['roles', 'manager']))]);
    }

    public function reassign(ReassignRequest $request, Report $report): JsonResponse
    {
        $this->authorizeAdmin($request);

        $report = $this->reports->reassign(
            $report,
            $request->user(),
            (int) $request->input('manager_id'),
            (string) $request->input('reason'),
        );

        return response()->json(['data' => $report->toApiArray()]);
    }

    private function syncRoles(User $user, array $roles): void
    {
        $ids = Role::whereIn('name', $roles)->pluck('id')->all();
        $user->roles()->sync($ids);
    }

    private function adminArray(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'roles' => $user->roles->pluck('name')->values()->all(),
            'manager_id' => $user->manager_id,
            'manager_name' => $user->manager?->name,
            'active' => (bool) $user->active,
            'created_at' => $user->created_at?->toIso8601String(),
        ];
    }

    private function authorizeAdmin(Request $request): void
    {
        if (! $request->user()->isAdministrator()) {
            abort(403, 'You do not have access to this page');
        }
    }
}
