// src/routes/user.routes.ts
import { getHealth } from '../../controllers/v1-CTRL/health.js';
import { Router } from 'express';
import { Route } from '../../interfaces.js';
import { catchAsync } from '../../middlewares/catchAsync.js';

const router = Router();

const routes: Route[] = [
  {
    method: 'get',
    path: '/',
    // middleware: [authenticate],
    handler: catchAsync(getHealth),
  },
];

// Dynamically register routes
routes.forEach((route) => {
  const middlewares = route.middleware ? [...route.middleware] : [];
  if (route.validationSchema) {
    // middlewares.push(validate(route.validationSchema));
  }
  if (middlewares.length > 0) {
    router[route.method](route.path, ...middlewares, route.handler);
  } else {
    router[route.method](route.path, route.handler);
  }
});

export default {
  basePath: '/health',
  router,
};
