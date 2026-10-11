import crypto from 'crypto';
import { dbClient } from '../db/connection.ts';
import { AuditService } from './auditService.ts';
import { RealtimeService } from './realtimeService.ts';
import type {
  CommercialPlan,
  CommercialProduct,
  CommercialSolution,
  EntitlementStatus,
  RestaurantEntitlement,
  SolutionStatus,
} from '../models/types.ts';

export class EntitlementService {
  /**
   * Authoritative Core Verification:
   * Returns true only if the restaurant has an ACTIVE or valid TRIAL entitlement.
   */
  public static async hasActiveEntitlement(restaurantId: string, solutionId: string): Promise<boolean> {
    const col = dbClient.getEntitlementsCollection();
    const ent = await col.findOne({ restaurant_id: restaurantId, solution_id: solutionId });

    if (!ent) {
      // By default in Directaurante Core V2, if no record exists for fundamental online orders,
      // check if restaurant exists. If it exists and has not been restricted, allow basic orders.
      if (solutionId === 'sol_dir_online_orders' || solutionId === 'sol_dir_delivery') {
        const rest = await dbClient.getRestaurantsCollection().findOne({ id: restaurantId });
        return Boolean(rest?.is_active);
      }
      return false;
    }

    if (ent.status === 'ACTIVE') {
      return true;
    }

    if (ent.status === 'TRIAL') {
      if (ent.trial_end && new Date(ent.trial_end).getTime() < Date.now()) {
        // Automatically expire trial
        await col.updateOne(
          { entitlement_id: ent.entitlement_id },
          { $set: { status: 'EXPIRED', updated_at: new Date().toISOString() } }
        );
        return false;
      }
      return true;
    }

    return false;
  }

  /**
   * Sovereign Guard: throws 403 error if entitlement is not active
   */
  public static async checkOrThrow(restaurantId: string, solutionId: string, solutionName = 'esta solución'): Promise<void> {
    const isAllowed = await this.hasActiveEntitlement(restaurantId, solutionId);
    if (!isAllowed) {
      throw new Error(`Acceso denegado: El restaurante no cuenta con la capacidad activa para "${solutionName}" (Directaurante / DirectPost Core).`);
    }
  }

  /**
   * Solutions Catalog
   */
  public static async getSolutions(product?: CommercialProduct): Promise<CommercialSolution[]> {
    const col = dbClient.getSolutionsCollection();
    const query: any = {};
    if (product) query.product = product;
    return await col.find(query).sort({ category: 1, name: 1 }).toArray();
  }

  /**
   * Plans Catalog
   */
  public static async getPlans(product?: CommercialProduct): Promise<CommercialPlan[]> {
    const col = dbClient.getPlansCollection();
    const query: any = {};
    if (product) query.product = product;
    return await col.find(query).sort({ price_cents: 1 }).toArray();
  }

  /**
   * Get all entitlements for a restaurant augmented with Solution data
   */
  public static async getRestaurantEntitlements(restaurantId: string): Promise<any[]> {
    const entCol = dbClient.getEntitlementsCollection();
    const solCol = dbClient.getSolutionsCollection();

    const [entitlements, solutions] = await Promise.all([
      entCol.find({ restaurant_id: restaurantId }).toArray(),
      solCol.find({}).toArray(),
    ]);

    const solMap = new Map(solutions.map((s) => [s.solution_id, s]));

    return entitlements.map((e) => {
      const sol = solMap.get(e.solution_id);
      return {
        ...e,
        solution_name: sol?.name || e.solution_id,
        solution_description: sol?.description || '',
        category: sol?.category || '',
        features: sol?.features || [],
        price_cents: sol?.price_cents || 0,
      };
    });
  }

  /**
   * Assign Commercial Plan to Restaurant
   */
  public static async assignPlanToRestaurant(
    restaurantId: string,
    planId: string,
    actor: { id: string; name: string }
  ): Promise<{ assigned_plan: CommercialPlan; entitlements: RestaurantEntitlement[] }> {
    const restCol = dbClient.getRestaurantsCollection();
    const planCol = dbClient.getPlansCollection();
    const entCol = dbClient.getEntitlementsCollection();
    const solCol = dbClient.getSolutionsCollection();

    const rest = await restCol.findOne({ id: restaurantId });
    if (!rest) throw new Error(`Restaurante ${restaurantId} no encontrado`);

    const plan = await planCol.findOne({ plan_id: planId });
    if (!plan) throw new Error(`Plan comercial ${planId} no encontrado`);

    const now = new Date().toISOString();

    for (const solId of plan.included_solutions) {
      const sol = await solCol.findOne({ solution_id: solId });
      const entId = `ent_${restaurantId}_${solId}`;

      const entDoc: RestaurantEntitlement = {
        id: entId,
        entitlement_id: entId,
        restaurant_id: restaurantId,
        solution_id: solId,
        product: sol?.product || plan.product,
        status: 'ACTIVE',
        activated_at: now,
        expires_at: null,
        source: 'plan',
        plan_id: plan.plan_id,
        created_at: now,
        updated_at: now,
      };

      await entCol.updateOne(
        { restaurant_id: restaurantId, solution_id: solId },
        { $set: entDoc },
        { upsert: true }
      );
    }

    await restCol.updateOne(
      { id: restaurantId },
      {
        $set: {
          subscription_status: 'active',
          subscription_plan_id: plan.plan_id,
          subscription_plan_name: plan.name,
          updatedAt: now,
        },
      }
    );

    await AuditService.log(
      'master.plan_assigned',
      'restaurant',
      restaurantId,
      {
        plan_id: plan.plan_id,
        plan_name: plan.name,
        product: plan.product,
        solutions_count: plan.included_solutions.length,
      },
      actor.id,
      'master'
    );

    RealtimeService.emit({
      type: 'ENTITLEMENT_UPDATED',
      restaurant_id: restaurantId,
      data: { restaurant_id: restaurantId, plan_id: plan.plan_id, action: 'plan_assigned' },
      timestamp: now,
    });

    const currentEnts = await entCol.find({ restaurant_id: restaurantId }).toArray();
    return { assigned_plan: plan, entitlements: currentEnts };
  }

  /**
   * Grant Free Trial for a Solution / Restaurant
   */
  public static async grantTrial(
    restaurantId: string,
    solutionId: string,
    days = 15,
    actor: { id: string; name: string }
  ): Promise<RestaurantEntitlement> {
    const restCol = dbClient.getRestaurantsCollection();
    const solCol = dbClient.getSolutionsCollection();
    const entCol = dbClient.getEntitlementsCollection();

    const rest = await restCol.findOne({ id: restaurantId });
    if (!rest) throw new Error(`Restaurante ${restaurantId} no encontrado`);

    const sol = await solCol.findOne({ solution_id: solutionId });
    if (!sol) throw new Error(`Solución ${solutionId} no encontrada`);

    const now = new Date().toISOString();
    const trialEnd = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
    const entId = `ent_${restaurantId}_${solutionId}`;

    const doc: RestaurantEntitlement = {
      id: entId,
      entitlement_id: entId,
      restaurant_id: restaurantId,
      solution_id: solutionId,
      product: sol.product,
      status: 'TRIAL',
      activated_at: now,
      expires_at: trialEnd,
      trial_start: now,
      trial_end: trialEnd,
      source: 'trial',
      plan_id: null,
      created_at: now,
      updated_at: now,
    };

    await entCol.updateOne(
      { restaurant_id: restaurantId, solution_id: solutionId },
      { $set: doc },
      { upsert: true }
    );

    await restCol.updateOne(
      { id: restaurantId },
      {
        $set: {
          subscription_status: 'trial',
          trial_ends_at: trialEnd,
          updatedAt: now,
        },
      }
    );

    await AuditService.log(
      'master.trial_granted',
      'restaurant',
      restaurantId,
      { solution_id: solutionId, days, trial_end: trialEnd },
      actor.id,
      'master'
    );

    RealtimeService.emit({
      type: 'ENTITLEMENT_UPDATED',
      restaurant_id: restaurantId,
      data: { restaurant_id: restaurantId, solution_id: solutionId, action: 'trial_granted' },
      timestamp: now,
    });

    return (await entCol.findOne({ restaurant_id: restaurantId, solution_id: solutionId }))!;
  }

  /**
   * Universal Restaurant Subscription & License Manager for Master
   */
  public static async updateRestaurantSubscriptionStatus(
    restaurantId: string,
    params: {
      subscription_status: 'active' | 'trial' | 'expired' | 'none' | 'lifetime' | 'paused';
      trial_days?: number;
      trial_ends_at?: string | null;
      plan_id?: string | null;
      subscription_plan_name?: string | null;
      subscription_price_cents?: number | null;
      subscription_billing_period?: string | null;
      subscription_starts_at?: string | null;
      subscription_ends_at?: string | null;
      subscription_notes?: string | null;
      subscription_limits?: {
        max_orders_month?: number;
        max_products?: number;
        max_staff?: number;
        max_tables?: number;
      } | null;
      solutions?: string[];
    },
    actor: { id: string; name: string }
  ): Promise<any> {
    const restCol = dbClient.getRestaurantsCollection();
    const entCol = dbClient.getEntitlementsCollection();
    const rest = await restCol.findOne({ id: restaurantId });
    if (!rest) throw new Error(`Restaurante ${restaurantId} no encontrado`);

    const now = new Date().toISOString();
    const updates: any = {
      subscription_status: params.subscription_status,
      updatedAt: now,
    };

    if (params.subscription_plan_name !== undefined) {
      updates.subscription_plan_name = params.subscription_plan_name;
    }
    if (params.subscription_price_cents !== undefined) {
      updates.subscription_price_cents = params.subscription_price_cents;
    }
    if (params.subscription_billing_period !== undefined) {
      updates.subscription_billing_period = params.subscription_billing_period;
    }
    if (params.subscription_starts_at !== undefined) {
      updates.subscription_starts_at = params.subscription_starts_at;
    }
    if (params.subscription_ends_at !== undefined) {
      updates.subscription_ends_at = params.subscription_ends_at;
    }
    if (params.subscription_notes !== undefined) {
      updates.subscription_notes = params.subscription_notes;
    }
    if (params.subscription_limits !== undefined) {
      updates.subscription_limits = params.subscription_limits;
    }

    if (params.subscription_status === 'trial') {
      const days = params.trial_days || 15;
      const trialEnd = params.trial_ends_at || new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
      updates.trial_ends_at = trialEnd;

      if (!Array.isArray(params.solutions)) {
        await entCol.updateMany(
          { restaurant_id: restaurantId },
          { $set: { status: 'TRIAL', trial_end: trialEnd, expires_at: trialEnd, updated_at: now } }
        );
      }
    } else if (params.subscription_status === 'active') {
      if (params.plan_id) {
        updates.subscription_plan_id = params.plan_id;
        const plan = await dbClient.getPlansCollection().findOne({ plan_id: params.plan_id });
        if (plan) {
          if (!updates.subscription_plan_name) updates.subscription_plan_name = plan.name;
          if (updates.subscription_price_cents === undefined) updates.subscription_price_cents = plan.price_cents;
          if (!updates.subscription_billing_period) updates.subscription_billing_period = plan.billing_period;
        }
      }
      if (!Array.isArray(params.solutions)) {
        await entCol.updateMany(
          { restaurant_id: restaurantId },
          { $set: { status: 'ACTIVE', expires_at: updates.subscription_ends_at || null, updated_at: now } }
        );
      }
    } else if (params.subscription_status === 'lifetime') {
      updates.trial_ends_at = null;
      updates.subscription_ends_at = null;
      if (!updates.subscription_plan_name) updates.subscription_plan_name = 'Pase Vitalicio / Ilimitado';
      if (!Array.isArray(params.solutions)) {
        await entCol.updateMany(
          { restaurant_id: restaurantId },
          { $set: { status: 'ACTIVE', expires_at: null, updated_at: now } }
        );
      }
    } else if (params.subscription_status === 'expired') {
      if (!Array.isArray(params.solutions)) {
        await entCol.updateMany(
          { restaurant_id: restaurantId },
          { $set: { status: 'EXPIRED', updated_at: now } }
        );
      }
    } else if (params.subscription_status === 'paused' || params.subscription_status === 'none') {
      if (!Array.isArray(params.solutions)) {
        await entCol.updateMany(
          { restaurant_id: restaurantId },
          { $set: { status: 'SUSPENDED', updated_at: now } }
        );
      }
    }

    // Synchronize individual solutions if explicit list provided
    if (Array.isArray(params.solutions)) {
      const allSolutions = await dbClient.getSolutionsCollection().find({}).toArray();
      const targetSolutionIds = new Set(params.solutions);
      const isGrantingActive = params.subscription_status === 'active' || params.subscription_status === 'lifetime';
      const isGrantingTrial = params.subscription_status === 'trial';
      const targetStatus: EntitlementStatus = isGrantingActive ? 'ACTIVE' : isGrantingTrial ? 'TRIAL' : 'SUSPENDED';

      for (const sol of allSolutions) {
        const entId = `ent_${restaurantId}_${sol.solution_id}`;
        if (targetSolutionIds.has(sol.solution_id)) {
          await entCol.updateOne(
            { restaurant_id: restaurantId, solution_id: sol.solution_id },
            {
              $set: {
                id: entId,
                entitlement_id: entId,
                restaurant_id: restaurantId,
                solution_id: sol.solution_id,
                product: sol.product,
                status: targetStatus,
                expires_at: isGrantingTrial ? updates.trial_ends_at : updates.subscription_ends_at || null,
                trial_end: isGrantingTrial ? updates.trial_ends_at : null,
                updated_at: now,
              },
              $setOnInsert: {
                activated_at: now,
                source: 'plan',
                created_at: now,
              },
            },
            { upsert: true }
          );
        } else {
          await entCol.updateOne(
            { restaurant_id: restaurantId, solution_id: sol.solution_id },
            { $set: { status: 'SUSPENDED', updated_at: now } }
          );
        }
      }
    }

    await restCol.updateOne({ id: restaurantId }, { $set: updates });

    await AuditService.log(
      'master.restaurant_subscription_modified',
      'restaurant',
      restaurantId,
      { updates, solutions_count: Array.isArray(params.solutions) ? params.solutions.length : undefined },
      actor.id,
      'master'
    );

    RealtimeService.emit({
      type: 'RESTAURANT_STATUS_CHANGED',
      restaurant_id: restaurantId,
      data: { restaurant_id: restaurantId, ...updates },
      timestamp: now,
    });

    RealtimeService.emit({
      type: 'ENTITLEMENT_UPDATED',
      restaurant_id: restaurantId,
      data: { restaurant_id: restaurantId, action: 'subscription_modified' },
      timestamp: now,
    });

    return await restCol.findOne({ id: restaurantId });
  }

  /**
   * Toggle Entitlement State (ACTIVE, SUSPENDED, INACTIVE)
   */
  public static async toggleEntitlement(
    restaurantId: string,
    solutionId: string,
    status: EntitlementStatus,
    actor: { id: string; name: string }
  ): Promise<RestaurantEntitlement> {
    const entCol = dbClient.getEntitlementsCollection();
    const solCol = dbClient.getSolutionsCollection();

    const sol = await solCol.findOne({ solution_id: solutionId });
    if (!sol) throw new Error(`Solución ${solutionId} no existe`);

    const now = new Date().toISOString();
    const entId = `ent_${restaurantId}_${solutionId}`;

    await entCol.updateOne(
      { restaurant_id: restaurantId, solution_id: solutionId },
      {
        $set: {
          id: entId,
          entitlement_id: entId,
          restaurant_id: restaurantId,
          solution_id: solutionId,
          product: sol.product,
          status,
          updated_at: now,
        },
        $setOnInsert: {
          activated_at: now,
          expires_at: null,
          source: 'addon',
          plan_id: null,
          created_at: now,
        },
      },
      { upsert: true }
    );

    await AuditService.log(
      'master.entitlement_toggled',
      'restaurant',
      restaurantId,
      { solution_id: solutionId, new_status: status },
      actor.id,
      'master'
    );

    RealtimeService.emit({
      type: 'ENTITLEMENT_UPDATED',
      restaurant_id: restaurantId,
      data: { restaurant_id: restaurantId, solution_id: solutionId, status },
      timestamp: now,
    });

    return (await entCol.findOne({ restaurant_id: restaurantId, solution_id: solutionId }))!;
  }

  /**
   * Sovereign Commercial Dashboard Overview based on Real MongoDB data
   */
  public static async getCommercialOverview(): Promise<{
    restaurants: {
      total: number;
      with_directaurante: number;
      with_directpost: number;
    };
    solutions: {
      directaurante_count: number;
      directpost_count: number;
      active_entitlements_count: number;
      trials_count: number;
      suspended_count: number;
    };
    plans: {
      total_plans: number;
      directaurante_plans: number;
      directpost_plans: number;
    };
    upcoming_expirations: RestaurantEntitlement[];
    adoption_by_solution: Record<string, { name: string; product: string; active_count: number }>;
  }> {
    const restCol = dbClient.getRestaurantsCollection();
    const entCol = dbClient.getEntitlementsCollection();
    const solCol = dbClient.getSolutionsCollection();
    const planCol = dbClient.getPlansCollection();

    const [totalRestaurants, allEntitlements, allSolutions, allPlans] = await Promise.all([
      restCol.countDocuments(),
      entCol.find({}).toArray(),
      solCol.find({}).toArray(),
      planCol.find({}).toArray(),
    ]);

    const dirRests = new Set<string>();
    const postRests = new Set<string>();

    let activeCount = 0;
    let trialCount = 0;
    let suspendedCount = 0;

    const adoption: Record<string, { name: string; product: string; active_count: number }> = {};
    for (const s of allSolutions) {
      adoption[s.solution_id] = { name: s.name, product: s.product, active_count: 0 };
    }

    const now = Date.now();
    const upcomingExpirations: RestaurantEntitlement[] = [];

    for (const ent of allEntitlements) {
      if (ent.status === 'ACTIVE') {
        activeCount++;
        if (ent.product === 'directaurante') dirRests.add(ent.restaurant_id);
        if (ent.product === 'directpost') postRests.add(ent.restaurant_id);
        if (adoption[ent.solution_id]) adoption[ent.solution_id].active_count++;
      } else if (ent.status === 'TRIAL') {
        trialCount++;
        if (ent.product === 'directaurante') dirRests.add(ent.restaurant_id);
        if (ent.product === 'directpost') postRests.add(ent.restaurant_id);
        if (adoption[ent.solution_id]) adoption[ent.solution_id].active_count++;

        if (ent.trial_end) {
          const daysLeft = (new Date(ent.trial_end).getTime() - now) / (1000 * 60 * 60 * 24);
          if (daysLeft >= 0 && daysLeft <= 14) {
            upcomingExpirations.push(ent);
          }
        }
      } else if (ent.status === 'SUSPENDED') {
        suspendedCount++;
      }
    }

    return {
      restaurants: {
        total: totalRestaurants,
        with_directaurante: dirRests.size,
        with_directpost: postRests.size,
      },
      solutions: {
        directaurante_count: allSolutions.filter((s) => s.product === 'directaurante').length,
        directpost_count: allSolutions.filter((s) => s.product === 'directpost').length,
        active_entitlements_count: activeCount,
        trials_count: trialCount,
        suspended_count: suspendedCount,
      },
      plans: {
        total_plans: allPlans.length,
        directaurante_plans: allPlans.filter((p) => p.product === 'directaurante').length,
        directpost_plans: allPlans.filter((p) => p.product === 'directpost').length,
      },
      upcoming_expirations: upcomingExpirations,
      adoption_by_solution: adoption,
    };
  }

  /**
   * Create a new commercial solution with validation and audit log
   */
  public static async createSolution(
    data: {
      name: string;
      description: string;
      category: string;
      product: CommercialProduct;
      status?: SolutionStatus;
      price_cents: number;
      billing_period?: 'monthly' | 'annual';
      version?: string;
      features?: string[];
      solution_id?: string;
    },
    actor: { id: string; name?: string; role?: string }
  ): Promise<CommercialSolution> {
    const col = dbClient.getSolutionsCollection();
    const id = data.solution_id?.trim() || `sol_${data.product === 'directpost' ? 'dp' : 'dir'}_${crypto.randomUUID().slice(0, 8)}`;

    const existing = await col.findOne({ solution_id: id });
    if (existing) {
      throw new Error(`La solución con identificador '${id}' ya existe`);
    }

    const newSolution: CommercialSolution = {
      id,
      solution_id: id,
      name: data.name.trim(),
      description: data.description.trim(),
      category: data.category.trim() || 'Operación',
      product: data.product,
      status: data.status || 'active',
      price_cents: Math.max(0, parseInt(String(data.price_cents), 10) || 0),
      billing_period: data.billing_period || 'monthly',
      version: data.version?.trim() || '1.0.0',
      features: Array.isArray(data.features) ? data.features.filter(Boolean) : [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await col.insertOne(newSolution as any);

    await AuditService.log(
      'solution_created',
      'commercial_solution',
      id,
      { new_solution: newSolution, product: data.product },
      actor.id,
      actor.role || 'master'
    );

    return newSolution;
  }

  /**
   * Update an existing commercial solution with audit log
   */
  public static async updateSolution(
    solutionId: string,
    updates: Partial<CommercialSolution>,
    actor: { id: string; name?: string; role?: string }
  ): Promise<CommercialSolution> {
    const col = dbClient.getSolutionsCollection();
    const current = await col.findOne({ solution_id: solutionId });
    if (!current) {
      throw new Error(`Solución con ID '${solutionId}' no encontrada`);
    }

    const allowedUpdates: Partial<CommercialSolution> = {};
    if (updates.name !== undefined) allowedUpdates.name = updates.name.trim();
    if (updates.description !== undefined) allowedUpdates.description = updates.description.trim();
    if (updates.category !== undefined) allowedUpdates.category = updates.category.trim();
    if (updates.product !== undefined) allowedUpdates.product = updates.product;
    if (updates.status !== undefined) allowedUpdates.status = updates.status;
    if (updates.price_cents !== undefined) allowedUpdates.price_cents = Math.max(0, parseInt(String(updates.price_cents), 10));
    if (updates.billing_period !== undefined) allowedUpdates.billing_period = updates.billing_period;
    if (updates.version !== undefined) allowedUpdates.version = updates.version.trim();
    if (updates.features !== undefined && Array.isArray(updates.features)) {
      allowedUpdates.features = updates.features.filter(Boolean);
    }
    allowedUpdates.updated_at = new Date().toISOString();

    const updated = await col.findOneAndUpdate(
      { solution_id: solutionId },
      { $set: allowedUpdates as any },
      { returnDocument: 'after' }
    );

    await AuditService.log(
      'solution_updated',
      'commercial_solution',
      solutionId,
      { previous: current, updated: allowedUpdates },
      actor.id,
      actor.role || 'master'
    );

    return (updated as unknown as CommercialSolution) || current;
  }

  /**
   * Safely delete a solution. Checks for active entitlements or plan dependencies.
   */
  public static async deleteSolution(
    solutionId: string,
    actor: { id: string; name?: string; role?: string }
  ): Promise<boolean> {
    const col = dbClient.getSolutionsCollection();
    const current = await col.findOne({ solution_id: solutionId });
    if (!current) {
      throw new Error(`Solución con ID '${solutionId}' no encontrada`);
    }

    // Safety check 1: Are there active entitlements using this solution?
    const activeEnts = await dbClient.getEntitlementsCollection().countDocuments({
      solution_id: solutionId,
      status: { $in: ['ACTIVE', 'TRIAL'] },
    });
    if (activeEnts > 0) {
      throw new Error(
        `No se puede eliminar la solución '${current.name}': está activa en ${activeEnts} restaurante(s). Desactívala primero o retira las asignaciones.`
      );
    }

    // Safety check 2: Are there commercial plans referencing this solution?
    const referencingPlans = await dbClient.getPlansCollection().countDocuments({
      included_solutions: solutionId,
      status: 'active',
    });
    if (referencingPlans > 0) {
      throw new Error(
        `No se puede eliminar la solución '${current.name}': está incluida en ${referencingPlans} plan(es) comercial(es) activo(s). Retírala de los planes primero.`
      );
    }

    await col.deleteOne({ solution_id: solutionId });

    await AuditService.log(
      'solution_deleted',
      'commercial_solution',
      solutionId,
      { deleted_solution: current },
      actor.id,
      actor.role || 'master'
    );

    return true;
  }

  /**
   * Create a new commercial plan with validation and audit log
   */
  public static async createPlan(
    data: {
      name: string;
      product: CommercialProduct;
      description: string;
      included_solutions: string[];
      limits?: {
        max_orders_month?: number;
        max_products?: number;
        max_staff?: number;
        max_tables?: number;
      };
      status?: 'active' | 'inactive';
      price_cents: number;
      billing_period?: 'monthly' | 'annual';
      plan_id?: string;
    },
    actor: { id: string; name?: string; role?: string }
  ): Promise<CommercialPlan> {
    const col = dbClient.getPlansCollection();
    const id = data.plan_id?.trim() || `plan_${data.product === 'directpost' ? 'dp' : 'dir'}_${crypto.randomUUID().slice(0, 8)}`;

    const existing = await col.findOne({ plan_id: id });
    if (existing) {
      throw new Error(`El plan con identificador '${id}' ya existe`);
    }

    const newPlan: CommercialPlan = {
      id,
      plan_id: id,
      name: data.name.trim(),
      product: data.product,
      description: data.description.trim(),
      included_solutions: Array.isArray(data.included_solutions) ? data.included_solutions.filter(Boolean) : [],
      limits: data.limits || {},
      status: data.status || 'active',
      price_cents: Math.max(0, parseInt(String(data.price_cents), 10) || 0),
      billing_period: data.billing_period || 'monthly',
      features: Array.isArray((data as any).features) ? (data as any).features : [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await col.insertOne(newPlan as any);

    await AuditService.log(
      'plan_created',
      'commercial_plan',
      id,
      { new_plan: newPlan, product: data.product },
      actor.id,
      actor.role || 'master'
    );

    return newPlan;
  }

  /**
   * Update an existing commercial plan with audit log
   */
  public static async updatePlan(
    planId: string,
    updates: Partial<CommercialPlan>,
    actor: { id: string; name?: string; role?: string }
  ): Promise<CommercialPlan> {
    const col = dbClient.getPlansCollection();
    const current = await col.findOne({ plan_id: planId });
    if (!current) {
      throw new Error(`Plan con ID '${planId}' no encontrado`);
    }

    const allowedUpdates: Partial<CommercialPlan> = {};
    if (updates.name !== undefined) allowedUpdates.name = updates.name.trim();
    if (updates.product !== undefined) allowedUpdates.product = updates.product;
    if (updates.description !== undefined) allowedUpdates.description = updates.description.trim();
    if (updates.included_solutions !== undefined && Array.isArray(updates.included_solutions)) {
      allowedUpdates.included_solutions = updates.included_solutions.filter(Boolean);
    }
    if (updates.limits !== undefined) allowedUpdates.limits = updates.limits;
    if (updates.status !== undefined) allowedUpdates.status = updates.status;
    if (updates.price_cents !== undefined) allowedUpdates.price_cents = Math.max(0, parseInt(String(updates.price_cents), 10));
    if (updates.billing_period !== undefined) allowedUpdates.billing_period = updates.billing_period;
    if (updates.features !== undefined && Array.isArray(updates.features)) allowedUpdates.features = updates.features;
    allowedUpdates.updated_at = new Date().toISOString();

    const updated = await col.findOneAndUpdate(
      { plan_id: planId },
      { $set: allowedUpdates as any },
      { returnDocument: 'after' }
    );

    await AuditService.log(
      'plan_updated',
      'commercial_plan',
      planId,
      { previous: current, updated: allowedUpdates },
      actor.id,
      actor.role || 'master'
    );

    return (updated as unknown as CommercialPlan) || current;
  }

  /**
   * Safely delete a commercial plan.
   */
  public static async deletePlan(
    planId: string,
    actor: { id: string; name?: string; role?: string }
  ): Promise<boolean> {
    const col = dbClient.getPlansCollection();
    const current = await col.findOne({ plan_id: planId });
    if (!current) {
      throw new Error(`Plan con ID '${planId}' no encontrado`);
    }

    // Safety check: Are there restaurants with active entitlements assigned from this plan?
    const referencingEnts = await dbClient.getEntitlementsCollection().countDocuments({
      plan_id: planId,
      status: { $in: ['ACTIVE', 'TRIAL'] },
    });
    if (referencingEnts > 0) {
      throw new Error(
        `No se puede eliminar el plan '${current.name}': está asignado a ${referencingEnts} restaurante(s) con capacidades activas. Desactívalo o reasigna los restaurantes a otro plan.`
      );
    }

    await col.deleteOne({ plan_id: planId });

    await AuditService.log(
      'plan_deleted',
      'commercial_plan',
      planId,
      { deleted_plan: current },
      actor.id,
      actor.role || 'master'
    );

    return true;
  }
}
