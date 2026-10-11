import { Router } from 'express';
import { CatalogService, RestaurantService } from '../services/restaurantService.ts';

const router = Router();

// GET /restaurants
router.get('/', async (req, res, next) => {
  try {
    const category = typeof req.query.category === 'string' ? req.query.category : undefined;
    const query = typeof req.query.query === 'string' ? req.query.query : undefined;

    const list = await RestaurantService.listRestaurants({ category, query });
    res.json({
      success: true,
      data: list,
    });
  } catch (err) {
    next(err);
  }
});

// GET /restaurants/:id
router.get('/:id', async (req, res, next) => {
  try {
    const restaurant = await RestaurantService.getRestaurantById(req.params.id);
    if (!restaurant) {
      return res.status(404).json({
        success: false,
        error: `Restaurante '${req.params.id}' no encontrado`,
      });
    }
    res.json({
      success: true,
      data: restaurant,
    });
  } catch (err) {
    next(err);
  }
});

// GET /restaurants/:id/categories
router.get('/:id/categories', async (req, res, next) => {
  try {
    const products = await CatalogService.getProductsByRestaurant(req.params.id);
    const categoryNames = Array.from(new Set(products.map((p) => p.category)));
    res.json({
      success: true,
      data: categoryNames,
    });
  } catch (err) {
    next(err);
  }
});

// GET /restaurants/:id/products
router.get('/:id/products', async (req, res, next) => {
  try {
    const products = await CatalogService.getProductsByRestaurant(req.params.id);
    res.json({
      success: true,
      data: products,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
